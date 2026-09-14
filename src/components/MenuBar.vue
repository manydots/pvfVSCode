<script setup>
// 顶部菜单栏（对齐 VS Code base/browser/ui/menu/menubar.ts 的 MenuBar 部件与
// base/browser/ui/menu/menubar.css、workbench/browser/parts/titlebar/media/{menubarControl.css,titlebarpart.css}）。
//
// DOM 与权威一致（menubar.ts:203-204、:222；容器 role 见 titlebarPart.ts:429-430、menubar.ts:96）：
//   div.menubar[role=menubar]
//     > div.menubar-menu-button[role=menuitem][tabindex=-1][aria-haspopup=true][aria-label]
//       > div.menubar-menu-title[role=none][aria-hidden=true]
// 展开态把 .open 加在按钮上（menubar.ts:1011），标题内边距 0 8px、圆角 5px（menubar.css:54-56），
// 悬停/展开背景取 menubar.selectionBackground（menubarControl.css:41-49）。
// 顶级项标题暂不带助记符（mnemonicTitle），故 aria-label 直接取标题文本。
//
// 鼠标（menubar.ts:262-305）：左键 MOUSE_DOWN 即展开，并吃掉紧随的 MOUSE_UP（ignoreNextMouseUp）；
// 已展开时 MOUSE_DOWN 不动作，由 MOUSE_UP 走 onMenuTriggered 收起（:912-925）；
// 展开状态下 MOUSE_ENTER 其他标题即切换，聚焦但未展开时 MOUSE_ENTER 只移动焦点。
// 键盘（menubar.ts:120-149、:230-246）：← / → 在标题间移动（展开时直接换菜单）、
// ↓ / Enter 在按钮上展开、Esc 在「已聚焦未展开」时退出聚焦。
// 焦点（menubar.ts:159-181、:707-733）：容器外元素把焦点交给菜单栏时记入 focusToReturn，
// 焦点落到容器外或 Esc 退出时把它还回去（VISIBLE 分支的 blur() + focusToReturn.focus()）。
//
// 下拉面板：VS Code 把 .menubar-menu-items-holder 挂在按钮元素内部并 fixed 定位
// （menubar.ts:1013-1035、menubar.css:57-62）；本仓库为跨部件覆盖改 Teleport 到 body，
// 定位取值不变 —— 锚点是 .menubar-menu-title 的 left/bottom，不是整个按钮（已登记偏差，见
// docs/vscode-reference.md 第 5 节）。因面板不在 .menubar 内，容器的焦点进出判定与外部点击判定
// 都要把 .menubar-dropdown 一并视为「菜单栏内部」（权威中 holder 是按钮子元素，天然成立）。
//
// 未实现（均登记在 docs/vscode-reference.md 第 5 节）：Alt 助记符、悬停/展开/聚焦三态描边、
// 窄窗口的「…」溢出按钮、窗口失焦的 .inactive 态、键盘展开时不抢焦到首个条目
// （openedViaKeyboard / selectFirst 语义）。
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { MenuId } from "@/menu/menuId.js";
import { MenuRegistry } from "@/menu/actions.js";
import { contextKeys } from "@/menu/contextKey.js";
import MenuDropdown from "@/components/MenuDropdown.vue";

const items = MenuRegistry.getMenuItems(MenuId.MenubarMainMenu)
    .filter(item => !item.when || item.when.evaluate(contextKeys))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const rootEl = ref(null);
// 展开的菜单（对应 MenubarState.OPEN）与聚焦的按钮（对应 MenubarState.FOCUSED），-1 表示无。
const openIndex = ref(-1);
const focusedIndex = ref(-1);
// 浮层锚点：当前菜单标题在视口中的位置。
const anchor = ref({ left: 0, top: 0 });

const isOpen = computed(() => openIndex.value !== -1);
const isFocused = computed(() => focusedIndex.value !== -1);

const dropdownStyle = computed(() => ({
    position: "fixed",
    left: `${anchor.value.left}px`,
    top: `${anchor.value.top}px`,
    zIndex: 2000
}));

// 展开来源（对齐 openedViaKeyboard，menubar.ts:922）：键盘展开时不抢焦点到首个条目。
let openedViaKeyboard = false;
// 展开时按钮的 MOUSE_DOWN 已消费一次 MOUSE_UP（menubar.ts:272）。
let ignoreNextMouseUp = false;
// 把焦点交给菜单栏的外部元素，退出聚焦时归还（menubar.ts:71、:727-730）。
let focusToReturn = undefined;

function buttons() {
    return Array.from(rootEl.value?.querySelectorAll(".menubar-menu-button") ?? []);
}

function focusButton(index) {
    buttons()[index]?.focus?.({ preventScroll: true });
}

// 下拉面板被 Teleport 到 body，判定「属于菜单栏」时需与容器一并纳入（见文件头说明）。
function isMenubarPart(node) {
    if (!node) return false;
    return Boolean(rootEl.value?.contains(node) || node.closest?.(".menubar-dropdown"));
}

// 锚点取标题元素（.menubar-menu-title）的 rect 左缘与底边，对齐 menubar.ts:1013-1035
// 的 titleBoundingRect（按钮本身没有内边距，左缘与标题一致；底边不同：按钮撑满菜单栏高度）。
function showMenu(index, viaKeyboard = false) {
    const button = buttons()[index];
    const titleElement = button?.querySelector?.(".menubar-menu-title") ?? button;
    const rect = titleElement?.getBoundingClientRect?.();
    if (rect) anchor.value = { left: rect.left, top: rect.bottom };
    openedViaKeyboard = viaKeyboard;
    focusedIndex.value = index;
    openIndex.value = index;
    focusButton(index);
}

// 退出聚焦态（menubar.ts:793-805 置 VISIBLE + :707-733 的按钮 blur 与焦点归还）。
function setUnfocusedState() {
    if (focusedIndex.value !== -1) buttons()[focusedIndex.value]?.blur?.();
    openIndex.value = -1;
    focusedIndex.value = -1;
    ignoreNextMouseUp = false;
    const target = focusToReturn;
    focusToReturn = undefined;
    if (target?.isConnected) target.focus?.();
}

// 菜单展开/收起的统一入口（menubar.ts:912-925）。
function onMenuTriggered(index, clicked) {
    if (isOpen.value) {
        if (openIndex.value === index) setUnfocusedState();
        else showMenu(index, openedViaKeyboard);
    } else {
        showMenu(index, !clicked);
    }
}

function focusPrevious() {
    if (focusedIndex.value === -1 || items.length === 0) return;
    const next = (focusedIndex.value - 1 + items.length) % items.length;
    if (next === focusedIndex.value) return;
    if (isOpen.value) showMenu(next, openedViaKeyboard);
    else {
        focusedIndex.value = next;
        focusButton(next);
    }
}

function focusNext() {
    if (focusedIndex.value === -1 || items.length === 0) return;
    const next = (focusedIndex.value + 1) % items.length;
    if (next === focusedIndex.value) return;
    if (isOpen.value) showMenu(next, openedViaKeyboard);
    else {
        focusedIndex.value = next;
        focusButton(next);
    }
}

// 左键按下即展开（menubar.ts:262-280）；非左键只阻止默认行为。
function onButtonMouseDown(index, event) {
    if (event.button !== 0) {
        event.preventDefault();
        return;
    }
    if (!isOpen.value) {
        ignoreNextMouseUp = true;
        onMenuTriggered(index, true);
    } else {
        ignoreNextMouseUp = false;
    }
    event.preventDefault();
    event.stopPropagation();
}

// 已聚焦时按下并松开才收起（menubar.ts:282-294 的 !ignoreNextMouseUp && isFocused 分支）。
function onButtonMouseUp(index, event) {
    if (event.defaultPrevented) return;
    if (ignoreNextMouseUp) {
        ignoreNextMouseUp = false;
        return;
    }
    if (isFocused.value) onMenuTriggered(index, true);
}

function onButtonMouseEnter(index) {
    if (isOpen.value && openIndex.value !== index) {
        showMenu(index, openedViaKeyboard);
    } else if (isFocused.value && !isOpen.value) {
        focusedIndex.value = index;
        focusButton(index);
    }
}

// 按钮上的 ↓ / Enter 展开（menubar.ts:230-246，仅未展开时）。
function onButtonKeyUp(index, event) {
    let handled = true;
    if ((event.key === "ArrowDown" || event.key === "Enter") && !isOpen.value) {
        openedViaKeyboard = true;
        showMenu(index, true);
    } else {
        handled = false;
    }
    if (handled) {
        event.preventDefault();
        event.stopPropagation();
    }
}

// 菜单栏容器的键盘导航（menubar.ts:120-149）；菜单展开时 Esc 由菜单面板处理。
function onMenubarKeyDown(event) {
    let handled = true;
    if (event.key === "ArrowLeft") {
        focusPrevious();
    } else if (event.key === "ArrowRight") {
        focusNext();
    } else if (event.key === "Escape" && isFocused.value && !isOpen.value) {
        setUnfocusedState();
    } else {
        handled = false;
    }
    if (handled) {
        event.preventDefault();
        event.stopPropagation();
    }
}

function onFocusIn(event) {
    if (event.relatedTarget && !isMenubarPart(event.relatedTarget)) focusToReturn = event.relatedTarget;
}

function onFocusOut(event) {
    // 焦点离开文档（无 relatedTarget）或落到菜单栏之外时退出聚焦（menubar.ts:169-181）。
    if (!event.relatedTarget) {
        setUnfocusedState();
    } else if (!isMenubarPart(event.relatedTarget)) {
        focusToReturn = undefined;
        setUnfocusedState();
    }
}

function onPointerDown(event) {
    if (isMenubarPart(event.target)) return;
    if (isOpen.value || isFocused.value) setUnfocusedState();
}

onMounted(() => {
    document.addEventListener("pointerdown", onPointerDown);
});
onBeforeUnmount(() => {
    document.removeEventListener("pointerdown", onPointerDown);
});
</script>

<template>
    <div ref="rootEl" class="menubar" role="menubar" @keydown="onMenubarKeyDown" @focusin="onFocusIn" @focusout="onFocusOut">
        <div
            v-for="(item, index) in items"
            :key="item.submenu.id"
            class="menubar-menu-button"
            :class="{ open: openIndex === index }"
            role="menuitem"
            tabindex="-1"
            aria-haspopup="true"
            :aria-label="item.title"
            @mousedown="onButtonMouseDown(index, $event)"
            @mouseup="onButtonMouseUp(index, $event)"
            @mouseenter="onButtonMouseEnter(index)"
            @keyup="onButtonKeyUp(index, $event)">
            <div class="menubar-menu-title" role="none" aria-hidden="true">{{ item.title }}</div>
            <Teleport to="body">
                <MenuDropdown v-if="openIndex === index" class="menubar-dropdown" :menu-id="item.submenu" :style="dropdownStyle" @close="setUnfocusedState" />
            </Teleport>
        </div>
    </div>
</template>

<style scoped>
/* base/browser/ui/menu/menubar.css:10-16（.menubar） */
.menubar {
    display: flex;
    flex-shrink: 1;
    box-sizing: border-box;
    height: 100%;
    overflow: hidden;
    /* titlebar/media/titlebarpart.css:250-256：z-index 2500、min-width 36px、flex-wrap nowrap。
       同处的 order: 2 用于 .titlebar-left 内部的排序，而菜单栏是该容器的唯一子元素（居中项
       后退/前进按钮未迁移），故本仓库不需要该声明。
       web 下另有 margin-left: 4px（titlebarpart.css:258-260），桌面 classic 布局为 0。 */
    z-index: 2500;
    min-width: 36px;
    flex-wrap: nowrap;
    /* titlebar/media/titlebarpart.css:42-46：标题栏容器 line-height 22px，决定
       .menubar-menu-title 的高度，也就是下拉面板锚点的底边位置。 */
    line-height: 22px;
}

/* menubar.css:25-35（.menubar-menu-button）；zoom / -webkit-app-region 属 Electron
   与缩放体系，本仓库无对应机制，未引入。 */
.menubar-menu-button {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    cursor: default;
    white-space: nowrap;
    outline: 0 !important;
    color: inherit;
    /* 工作台基准字号 13px（workbench/browser/media/style.css:48-50 的 .monaco-workbench）。 */
    font-size: 13px;
}

/* menubar.css:54-56（.menubar-menu-title） */
.menubar-menu-title {
    padding: 0 8px;
    border-radius: 5px;
}

/* menubarControl.css:41-49：悬停/展开用 menubar.selectionBackground + selectionForeground
   （引用 token 的官方默认值与 Dark 2026 取值见 docs/vscode-reference.md 4.6）。 */
.menubar-menu-button:hover .menubar-menu-title,
.menubar-menu-button.open .menubar-menu-title {
    background: var(--vscode-menubar-selectionBackground);
    color: var(--vscode-menubar-selectionForeground);
}
</style>
