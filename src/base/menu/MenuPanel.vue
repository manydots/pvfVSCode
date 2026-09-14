<script setup>
// VS Code 菜单面板（对齐 base/browser/ui/menu/menu.ts 的 Menu widget）：
// 菜单栏下拉、上下文菜单、工具栏「…」溢出面板共用本组件 —— 菜单只有一份渲染实现。
//
// DOM 与 VS Code 一致（menu.ts 的 BaseMenuActionViewItem / SubmenuMenuActionViewItem /
// MenuSeparatorActionViewItem，以及 ContextMenuHandler 的容器）：
//   .context-view.monaco-menu-container
//     > .monaco-menu[role=presentation]
//       > .monaco-action-bar.vertical[role=menu] > ul.actions-container
//         > li.action-item > a.action-menu-item[role=menuitem|menuitemcheckbox]
//             > span.menu-item-check + span.action-label + span.keybinding + span.submenu-indicator
//         > li.action-item > span.action-label.separator
// 普通菜单项是纯文字：Menu.doGetActionViewItem 只给分隔线传 icon:true，普通项的 icon 为 false，
// 所以菜单项不含条目图标；构成菜单项的只有勾选列、文字、快捷键与子菜单箭头。
//
// 取值来自 menu.ts 的 getMenuWidgetCSS 与 platform/theme/browser/defaultStyles.ts 的 defaultMenuStyles：
//   容器圆角 cornerRadius.large、1px 菜单边框、13px 字号、min-width 160px、列表上下 4px 内边距、
//   条目 24px 高 + 左右 4px 外边距 + 6px 圆角、勾选列 2em、文字/快捷键水平 2em 内边距、
//   选中背景 list.hoverBackground（defaultMenuStyles.selectionBackgroundColor，
//   **不是** menu.selectionBackground）、键盘导航态才叠 menu.selectionBorder 描边。
//
// 交互同样照搬：Up/Down 跳过禁用项、Home/End 首尾、Right/Enter 进子菜单、Left 退回父菜单、
// Enter/Space 执行、Escape 关闭、指针移出清除高亮；子菜单贴条目右缘、放不下翻到左侧。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps({
    // 条目列表：[{ type: "separator", id }] 或
    // { type: "action", id, label, keybinding, checked, enabled, isSubmenu, submenu }
    entries: { type: Array, default: () => [] },
    // 展开子菜单：entry => entries[]（返回空数组表示无子项）。为 null 时子菜单条目不可展开。
    submenuResolver: { type: Function, default: null }
});
const emit = defineEmits(["execute", "close"]);

const rootEl = ref(null);
// .monaco-action-bar.vertical：子菜单垂直定位要对齐它的上内边距（menu.ts 的 paddingTop 计算）
const menuEl = ref(null);

const focusedIndex = ref(-1);
// 键盘导航态：仅此时显示 menu.selectionBorder 描边（对齐 .action-menu-item:focus:not(:focus-visible) 的抑制规则）
const keyboardNav = ref(false);

const submenuIndex = ref(-1);
const submenuEntries = ref([]);
const submenuStyle = ref({});
const submenuRef = ref(null);
const entryEls = new Map();

// 键盘导航只落在启用中的动作项上（对齐 Menu 的 focusOnlyEnabledItems: true）
const navigable = computed(() =>
    props.entries
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.type === "action" && entry.enabled !== false)
        .map(({ index }) => index)
);

let showTimer = null;
let hideTimer = null;

function clearTimers() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    showTimer = null;
    hideTimer = null;
}

function focus() {
    rootEl.value?.focus({ preventScroll: true });
}

function setFocused(index, keyboard) {
    focusedIndex.value = index;
    keyboardNav.value = !!keyboard;
}

function moveFocus(delta) {
    const list = navigable.value;
    if (list.length === 0) return;
    const current = list.indexOf(focusedIndex.value);
    const next = current < 0 ? (delta > 0 ? 0 : list.length - 1) : (current + delta + list.length) % list.length;
    setFocused(list[next], true);
}

function focusedEntry() {
    return props.entries[focusedIndex.value];
}

function onKeyDown(event) {
    switch (event.key) {
        case "ArrowDown":
            moveFocus(1);
            break;
        case "ArrowUp":
            moveFocus(-1);
            break;
        case "Home":
            setFocused(navigable.value[0] ?? -1, true);
            break;
        case "End":
            setFocused(navigable.value[navigable.value.length - 1] ?? -1, true);
            break;
        case "ArrowRight":
        case "Enter":
        case " ":
            activate(focusedEntry(), focusedIndex.value);
            break;
        case "ArrowLeft":
            // 根菜单不退格（子菜单自己处理 Left，事件不会冒泡到这里）
            break;
        case "Escape":
            emit("close");
            break;
        default:
            return;
    }
    event.preventDefault();
    event.stopPropagation();
}

function onEntryEnter(entry, index) {
    clearTimers();
    setFocused(index, false);

    if (entry.isSubmenu) {
        // 悬停 250ms 展开，与 SubmenuMenuActionViewItem 的 showScheduler 一致
        showTimer = setTimeout(() => openSubmenu(entry, index), 250);
        return;
    }
    // 移到其他条目：已有的子菜单在 750ms 后收起（hideScheduler）
    if (submenuIndex.value >= 0) hideTimer = setTimeout(() => closeSubmenu(false), 750);
}

function onPanelMouseLeave() {
    clearTimers();
    if (submenuIndex.value < 0) setFocused(-1, false);
}

function activate(entry, index) {
    if (!entry || entry.type !== "action" || entry.enabled === false) return;
    if (entry.isSubmenu) {
        openSubmenu(entry, index);
        return;
    }
    emit("execute", entry);
}

function onEntryClick(event, entry, index) {
    // 菜单条目用点击执行（VS Code 的菜单视图项用 mouseup，且禁用项不响应）
    event.stopPropagation();
    activate(entry, index);
}

async function openSubmenu(entry, index) {
    clearTimers();
    const children = props.submenuResolver?.(entry) ?? [];
    if (children.length === 0) return;

    submenuEntries.value = children;
    submenuIndex.value = index;
    await nextTick();

    const anchor = entryEls.get(index);
    const panel = submenuRef.value?.getRootElement();
    if (!anchor || !panel) return;

    // 垂直：与父条目顶边对齐 —— 父列表有 4px 上内边距，故面板顶边要上移同样距离
    // （menu.ts:calculateSubmenuMenuLayout 的 entryBoxUpdated.top = entry.top - paddingTop）
    const paddingTop = menuEl.value ? parseFloat(getComputedStyle(menuEl.value).paddingTop) || 0 : 0;
    const entryRect = anchor.getBoundingClientRect();
    const size = { width: panel.offsetWidth, height: panel.offsetHeight };

    // 水平：贴条目右缘（条目有 4px 外边距，故实际比父菜单右边界内缩 4px）；右侧放不下翻到左侧
    let left = entryRect.right;
    if (left + size.width > window.innerWidth) left = entryRect.left - size.width;
    let top = entryRect.top - paddingTop;
    top = Math.min(top, Math.max(0, window.innerHeight - size.height));

    submenuStyle.value = {
        position: "fixed",
        zIndex: 1,
        left: `${Math.max(0, Math.round(left))}px`,
        top: `${Math.max(0, Math.round(top))}px`
    };
    submenuRef.value?.focus();
}

function closeSubmenu(returnFocus) {
    clearTimers();
    submenuIndex.value = -1;
    submenuEntries.value = [];
    submenuStyle.value = {};
    if (returnFocus) focus();
}

// 子菜单自己处理按键（@keydown.stop），Left 在子菜单里退回父条目
function onSubmenuKeyDownLeft() {
    closeSubmenu(true);
}

watch(
    () => props.entries,
    () => {
        clearTimers();
        // 父条目列表被换掉（宿主按上下文键重算了菜单）时，已展开的子菜单就地刷新内容，
        // 而不是收起：子菜单里的 checked / enabled 同样按上下文键求值（如「切换缩略图」的
        // 勾选态），收起会让展开中的子菜单永远停在旧状态上。
        if (submenuIndex.value >= 0) {
            const entry = props.entries[submenuIndex.value];
            const children = entry?.isSubmenu && props.submenuResolver ? (props.submenuResolver(entry) ?? []) : [];
            if (children.length > 0) {
                submenuEntries.value = children;
                return;
            }
        }
        submenuIndex.value = -1;
        submenuEntries.value = [];
        focusedIndex.value = -1;
    }
);

onBeforeUnmount(clearTimers);

onMounted(() => {
    // 菜单渲染后立即把焦点收进面板（对齐 ContextMenuHandler 渲染菜单时的 menu.focus()），
    // 方向键/回车/Escape 才能直接生效；preventScroll 避免聚焦引发滚动。
    focus();
});

defineExpose({ focus, getRootElement: () => rootEl.value });
</script>

<template>
    <div ref="rootEl" class="context-view monaco-menu-container menu-panel" tabindex="-1" role="presentation" @keydown="onKeyDown" @mouseleave="onPanelMouseLeave">
        <div ref="menuEl" class="monaco-menu" role="presentation">
            <ul class="monaco-action-bar vertical actions-container" role="menu">
                <template v-for="(entry, index) in entries" :key="(entry.id ?? 'entry') + ':' + index">
                    <li v-if="entry.type === 'separator'" class="action-item separator-item">
                        <span class="action-label separator" role="presentation"></span>
                    </li>
                    <li v-else class="action-item" :class="{ focused: focusedIndex === index, keyboard: keyboardNav && focusedIndex === index, disabled: entry.enabled === false }">
                        <a
                            :ref="el => entryEls.set(index, el)"
                            class="action-menu-item"
                            :class="{ checked: entry.checked === true }"
                            :role="entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'"
                            :aria-checked="entry.checked === undefined ? undefined : String(entry.checked)"
                            :aria-disabled="entry.enabled === false ? 'true' : undefined"
                            :aria-haspopup="entry.isSubmenu ? 'true' : undefined"
                            :aria-expanded="entry.isSubmenu ? String(submenuIndex === index) : undefined"
                            @mouseenter="onEntryEnter(entry, index)"
                            @click="onEntryClick($event, entry, index)">
                            <span class="menu-item-check codicon codicon-check" role="none"></span>
                            <span class="action-label" :aria-label="entry.label">{{ entry.label }}</span>
                            <span v-if="entry.keybinding" class="keybinding">{{ entry.keybinding }}</span>
                            <span v-if="entry.isSubmenu" class="submenu-indicator codicon codicon-chevron-right" aria-hidden="true"></span>
                        </a>
                    </li>
                </template>
            </ul>
        </div>

        <MenuPanel
            v-if="submenuIndex >= 0"
            ref="submenuRef"
            :entries="submenuEntries"
            :submenu-resolver="submenuResolver"
            :style="submenuStyle"
            @keydown.left.stop="onSubmenuKeyDownLeft"
            @keydown.stop
            @execute="entry => emit('execute', entry)"
            @close="closeSubmenu(true)" />
    </div>
</template>

<style scoped>
/* .context-view.monaco-menu-container：圆角 + 阴影 + 裁剪（menu.ts 的 getMenuWidgetCSS 结尾） */
.menu-panel {
    position: absolute;
    border-radius: var(--vscode-cornerRadius-large);
    box-shadow: var(--vscode-shadow-lg);
    overflow: hidden;
    user-select: none;
    /* menu.ts:1251-1258 的 .context-view.monaco-menu-container { outline: 0; border: none }：
       容器是 tabindex=-1 的聚焦落点（Menu 渲染后立即 focus 它），若不抑制，浏览器会给它画出
       默认焦点环（白 + 蓝双色 outline）。 */
    outline: 0;
}

/* menu.ts:1262-1266：容器内的一切 :focus（含垂直 action bar）都不带 outline ——
   条目自身的键盘选中态由 .action-item.keyboard 的 menu.selectionBorder 表达。 */
.menu-panel :focus {
    outline: 0;
}

/* .monaco-menu：字体与描边（getMenuWidgetCSS 开头） */
.monaco-menu {
    font-size: 13px;
    min-width: 160px;
    border-radius: var(--vscode-cornerRadius-large);
    border: var(--vscode-strokeThickness) solid var(--vscode-menu-border);
    /* defaultMenuStyles 的 backgroundColor/foregroundColor 以内联样式施加在菜单盒上 */
    background: var(--vscode-menu-background);
    color: var(--vscode-menu-foreground);
}

/* .monaco-action-bar.vertical：上下 4px 内边距 */
.actions-container {
    display: block;
    margin: 0;
    padding: 4px 0;
    list-style: none;
}

/* .monaco-action-bar.vertical .action-item */
.action-item {
    position: static;
    display: flex;
    padding: 0;
    overflow: visible;
}

/* .action-item > a.action-menu-item：24px 高、左右 4px 外边距、6px 圆角 */
.action-menu-item {
    position: relative;
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    height: 24px;
    margin: 0 4px;
    border-radius: var(--vscode-cornerRadius-medium);
    color: inherit;
    text-decoration: none;
    cursor: default;
}

/* 选中态（defaultMenuStyles 的 selectionBackgroundColor/ForegroundColor = list.hover*） */
.action-item.focused > .action-menu-item {
    background: var(--vscode-list-hoverBackground);
    color: var(--vscode-list-hoverForeground);
}

/* 键盘导航才显示描边（对齐 .action-menu-item:focus:not(:focus-visible) 的抑制规则） */
.action-item.keyboard > .action-menu-item {
    outline: 1px solid var(--vscode-menu-selectionBorder);
    outline-offset: -1px;
}

.action-item.disabled > .action-menu-item {
    color: var(--vscode-disabledForeground);
}

/* .menu-item-check：勾选列 2em，未勾选 visibility:hidden —— 与 menu.ts 的两条规则逐值一致
   （menu.ts:1236 的 position/visibility/height + menu.ts:1321 的 width:2em/font-size:inherit；
   menu.ts:1243 的 .checked 规则给出 visibility:visible + flex 居中）。
   绝对定位，故用 left:0 固定在对齐位（与静态位置等价）。 */
.menu-item-check {
    position: absolute;
    left: 0;
    visibility: hidden;
    width: 2em;
    height: 100%;
    font-size: inherit;
}

.action-menu-item.checked > .menu-item-check {
    visibility: visible;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* .action-label：文字，水平 2em 内边距 */
.action-label:not(.separator) {
    flex: 1 1 auto;
    display: inline-block;
    box-sizing: border-box;
    margin: 0;
    padding: 0 2em;
    max-height: 100%;
    font-size: inherit;
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* .keybinding：右对齐、opacity .7 */
.keybinding {
    flex: 2 1 auto;
    display: inline-block;
    padding: 0 2em;
    max-height: 100%;
    font-size: inherit;
    line-height: 1;
    text-align: right;
    white-space: nowrap;
    opacity: 0.7;
}

/* .submenu-indicator：codicon chevron-right（menu-submenu 在 monaco 中即由该字形派生） */
.submenu-indicator {
    display: flex;
    align-items: center;
    height: 100%;
    padding: 0 1.8em;
    font-size: 60%;
}

/* 禁用项的快捷键与子菜单箭头更淡（getMenuWidgetCSS） */
.action-item.disabled > .action-menu-item > .keybinding,
.action-item.disabled > .action-menu-item > .submenu-indicator {
    opacity: 0.4;
}

/* .action-label.separator：整宽 1px 分隔线，上下 5px 外边距 */
.separator-item > .action-label.separator {
    display: block;
    width: 100%;
    height: 0;
    margin: 5px 0;
    padding: 0;
    border-bottom: 1px solid var(--vscode-menu-separatorBackground);
    border-radius: 0;
}
</style>
