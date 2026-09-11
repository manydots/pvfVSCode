<script setup>
// 通用工具栏（对齐 VS Code base/browser/ui/toolbar/toolbar.ts 的 ToolBar）：
// 主区渲染 primary 动作，放不下的动作与 secondary 动作一起收进末尾的「…」菜单。
//
// 溢出菜单交给 MenuPanel（对齐 base/browser/ui/menu/menu.ts 的 Menu widget）：
// 工具栏溢出菜单与菜单栏下拉、上下文菜单是同一个菜单组件，只允许一份实现。
// 面板 Teleport 到 body —— VS Code 的菜单渲染在工作台之外的浮层（.context-view），
// 而工具栏宿主常带 overflow:hidden（如编辑器标签栏 .title），就地渲染会被整体裁剪。
//
// 定位对齐 DropdownMenu.show() → showContextMenu 的默认值（contextMenuHandler.ts:56）
// 与 base/common/layout.ts 的 layout2d：AnchorAlignment.LEFT + AnchorPosition.BELOW，
// 即面板左缘与「…」按钮左缘对齐、顶边紧贴按钮底边（无间隙）；下方空间不足翻到上方，
// 右侧放不下改为右对齐。锚点是按钮本身（dropdown.ts 的 getAnchor 返回 .monaco-dropdown）。
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import ActionView from "@/base/toolbar/ActionView.vue";
import MenuPanel from "@/base/menu/MenuPanel.vue";

const props = defineProps({
    primary: { type: Array, default: () => [] },
    secondary: { type: Array, default: () => [] },
    maxItems: { type: Number, default: 12 },
    ariaLabel: { type: String, default: "工具栏" },
    // 溢出菜单中子菜单（MenuId）的解析器 entry => entries[]，由调用方注入，
    // 让 base/ 不依赖 @/menu 的解析实现。
    submenuResolver: { type: Function, default: null }
});
// 执行动作：第二个参数是执行来源 { event, fromOverflow }。
// fromOverflow 用于区分「溢出菜单里的子菜单」（由 MenuPanel 就地弹出）
// 与「主区按钮上的子菜单」（由宿主锚在按钮上弹出）。
const emit = defineEmits(["execute"]);

const overflowOpen = ref(false);
const overflowStyle = ref({});
const overflowTrigger = ref(null);
const overflowPanel = ref(null);

const layout = computed(() => {
    let visible = [...props.primary];
    const overflow = [...props.secondary];

    // 主区超出上限时，把尾部动作移入溢出菜单（预留一个位置给「…」按钮）。
    if (visible.length > props.maxItems) {
        overflow.unshift(...visible.slice(props.maxItems - 1));
        visible = visible.slice(0, props.maxItems - 1);
    }
    if (overflow.length > 0 && visible.length + 1 > props.maxItems && visible.length > 0) {
        overflow.unshift(visible.pop());
    }
    return { visible, overflow };
});

// 「…」按钮：ToggleMenuAction 的等价物。VS Code 中该动作未声明 checked，
// 打开菜单时只给 .monaco-dropdown 加 active 类（dropdown.ts:show，dropdown.css 无对应样式），
// 所以按钮不会出现选中背景。
const overflowButton = computed(() => ({
    type: "action",
    id: "__overflow",
    label: "更多操作…",
    icon: "ellipsis",
    tooltip: "更多操作",
    enabled: true,
    checked: undefined,
    submenu: null
}));

// 溢出动作 → MenuPanel 条目；source 保留原动作，执行时原样回传。
const overflowEntries = computed(() =>
    layout.value.overflow.map(action =>
        action.type === "separator"
            ? { type: "separator", id: action.id }
            : {
                  type: "action",
                  id: action.id,
                  label: action.label,
                  keybinding: action.keybinding,
                  checked: action.checked,
                  enabled: action.enabled,
                  isSubmenu: !!action.submenu,
                  submenu: action.submenu,
                  source: action
              }
    )
);

function onExecute(action, event) {
    emit("execute", action, { event, fromOverflow: false });
}

async function onOverflowExecute(event) {
    if (overflowOpen.value) {
        closeOverflow();
        event?.stopPropagation();
        return;
    }
    const rect = overflowTrigger.value?.getBoundingClientRect();
    if (!rect) return;

    // 先落在锚点左下角，避免测量前多出一帧错位；下一帧再按需翻转。
    overflowStyle.value = { position: "fixed", zIndex: 2000, left: `${Math.round(rect.left)}px`, top: `${Math.round(rect.bottom)}px` };
    overflowOpen.value = true;
    event?.stopPropagation();

    await nextTick();
    const panel = overflowPanel.value?.getRootElement();
    if (!panel) return;
    const size = { width: panel.offsetWidth, height: panel.offsetHeight };
    let left = rect.left;
    let top = rect.bottom;
    if (top + size.height > window.innerHeight && rect.top - size.height >= 0) top = rect.top - size.height;
    if (left + size.width > window.innerWidth) left = Math.max(0, rect.right - size.width);
    overflowStyle.value = { position: "fixed", zIndex: 2000, left: `${Math.round(left)}px`, top: `${Math.round(top)}px` };
}

// 关闭后把焦点交还「…」按钮（对齐 ContextViewService 隐藏时恢复 focusToReturn）。
function closeOverflow(returnFocus = true) {
    if (!overflowOpen.value) return;
    overflowOpen.value = false;
    if (returnFocus) overflowTrigger.value?.querySelector("button")?.focus();
}

function onOverflowItem(entry) {
    closeOverflow();
    emit("execute", entry.source, { event: null, fromOverflow: true });
}

function onPointerDown(event) {
    // 面板已 Teleport 到 body（自身 stop 掉 pointerdown），只需判断触发按钮区域。
    if (overflowOpen.value && !event.target.closest(".toolbar-overflow")) closeOverflow(false);
}

onMounted(() => document.addEventListener("pointerdown", onPointerDown));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onPointerDown));
</script>

<template>
    <div class="toolbar" role="toolbar" :aria-label="ariaLabel">
        <ActionView v-for="action in layout.visible" :key="action.id ?? action.type" :action="action" @execute="onExecute(action, $event)" />

        <div v-if="layout.overflow.length > 0" ref="overflowTrigger" class="toolbar-overflow">
            <ActionView :action="overflowButton" @execute="onOverflowExecute" />
            <Teleport to="body">
                <MenuPanel
                    v-if="overflowOpen"
                    ref="overflowPanel"
                    :entries="overflowEntries"
                    :submenu-resolver="submenuResolver"
                    :style="overflowStyle"
                    @pointerdown.stop
                    @execute="onOverflowItem"
                    @close="closeOverflow()" />
            </Teleport>
        </div>
    </div>
</template>

<style scoped>
.toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
}

.toolbar-overflow {
    position: relative;
    display: flex;
    align-items: center;
}
</style>
