<script setup>
// 以 MenuId 为数据源的工具栏（对齐 VS Code workbench MenuWorkbenchToolBar）：
// 解析菜单动作交给通用 Toolbar 渲染。主区按钮上的子菜单锚在工具栏上展开；
// 溢出菜单里的子菜单由 MenuPanel 锚在条目上就地弹出（与 VS Code 的 Menu 一致）。
//
// 主区子菜单的弹出（对齐 base/browser/ui/actionbar 的 DropdownMenuActionViewItem.show →
// contextMenuProvider.showContextMenu → ContextViewService.showContextView，contextViewService.ts:26、:45）：
// 权威把菜单挂到工作台之外的浮层容器，不受宿主部件 overflow:hidden 裁剪。本仓库对应为
// Teleport 到 body + position:fixed 定位 —— 内联渲染会被标题栏 .titlebar-container 等裁剪。
// 锚点对齐取 anchorAlignmentProvider：标题栏工具栏为 AnchorAlignment.RIGHT
// （titlebarPart.ts:694），其余工具栏用 dropdown.ts 的默认 AnchorAlignment.LEFT。
// 翻转规则对齐 Toolbar 溢出菜单：下方放不下翻到上方，左侧放不下（左对齐时）右对齐。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { contextKeys } from "@/menu/contextKey.js";
import { getToolbarActions } from "@/menu/menuToolbar.js";
import { resolveMenuEntries } from "@/menu/actions.js";
import Toolbar from "@/base/toolbar/Toolbar.vue";
import MenuDropdown from "@/components/MenuDropdown.vue";

const props = defineProps({
    menuId: { type: Object, required: true },
    primaryGroup: { type: String, default: "navigation" },
    maxItems: { type: Number, default: 12 },
    ariaLabel: { type: String, default: "工具栏" },
    // 子菜单锚点对齐："right" 对齐按钮右缘（AnchorAlignment.RIGHT），默认 "left"。
    anchorAlignment: { type: String, default: "left" }
});

const root = ref(null);
// MenuId 是标识对象，必须保持原样（shallowRef 不做深层代理），否则按 id 查找会失效。
const submenu = shallowRef(null);
const submenuStyle = ref({});
// 触发按钮：关闭时把焦点还给它（contextview.ts hide 的 focusToReturn 语义）。
const submenuTrigger = ref(null);

// 上下文键变化时重算可用性与勾选态。
const version = ref(0);
const off = contextKeys.onDidChange(() => {
    version.value++;
});
onBeforeUnmount(off);

const layout = computed(() => {
    void version.value;
    return getToolbarActions(props.menuId, contextKeys, props.primaryGroup);
});

// 溢出菜单的子菜单解析器（条目上的 submenu 即 MenuId）。
function resolveSubmenu(entry) {
    return entry.submenu ? resolveMenuEntries(entry.submenu, contextKeys) : [];
}

// 锚在触发按钮上的初始定位；测量后再按需翻转（见 openSubmenu）。
function anchorStyle(rect) {
    const style = { position: "fixed", zIndex: 2000, top: `${Math.round(rect.bottom)}px` };
    if (props.anchorAlignment === "right") {
        // 面板右缘与按钮右缘对齐：右偏移 = 视口宽 - 按钮右缘。
        // left 显式置 auto，压掉 MenuDropdown 默认样式里的 left: 0。
        style.left = "auto";
        style.right = `${Math.max(0, Math.round(window.innerWidth - rect.right))}px`;
    } else {
        style.left = `${Math.round(rect.left)}px`;
    }
    return style;
}

async function openSubmenu(action, trigger, event) {
    // 再次点击同一按钮收起已展开的子菜单（dropdown.ts 的 show/hide 切换语义）。
    if (submenu.value && submenuTrigger.value === trigger) {
        closeSubmenu();
        return;
    }
    const rect = trigger?.getBoundingClientRect?.();
    if (!rect) return;
    submenuTrigger.value = trigger;
    submenuStyle.value = anchorStyle(rect);
    submenu.value = { menuId: action.submenu };
    event?.stopPropagation();

    await nextTick();
    const panel = document.querySelector(".menu-toolbar-submenu");
    if (!panel) return;
    const size = { width: panel.offsetWidth, height: panel.offsetHeight };

    // 下方放不下且上方放得下：翻到按钮上方（contextview 的上下翻转）。
    let top = rect.bottom;
    if (top + size.height > window.innerHeight && rect.top - size.height >= 0) top = rect.top - size.height;
    const style = { ...submenuStyle.value, top: `${Math.round(top)}px` };
    // 左对齐时右侧放不下：改为右缘对齐按钮右缘（contextview 的水平调整）。
    if (props.anchorAlignment !== "right" && rect.left + size.width > window.innerWidth) {
        style.left = "auto";
        style.right = `${Math.max(0, Math.round(window.innerWidth - rect.right))}px`;
    }
    submenuStyle.value = style;
}

function closeSubmenu(returnFocus = true) {
    submenu.value = null;
    submenuStyle.value = {};
    const trigger = submenuTrigger.value;
    submenuTrigger.value = null;
    if (returnFocus) trigger?.isConnected && trigger.focus?.();
}

function onExecute(action, info) {
    // 溢出菜单的子菜单已在 MenuPanel 内弹出，这里不再重复展开。
    if (action.submenu && !info?.fromOverflow) {
        openSubmenu(action, info?.event?.currentTarget, info?.event);
        return;
    }
    closeSubmenu(false);
    action.run?.();
}

function onPointerDown(event) {
    // 面板已 Teleport 到 body 并在自身 stop 掉 pointerdown，这里只需处理面板外的点击。
    if (submenu.value && !event.target.closest(".menu-toolbar")) closeSubmenu(false);
}

onMounted(() => document.addEventListener("pointerdown", onPointerDown));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onPointerDown));
</script>

<template>
    <div ref="root" class="menu-toolbar">
        <Toolbar :primary="layout.primary" :secondary="layout.secondary" :max-items="maxItems" :aria-label="ariaLabel" :submenu-resolver="resolveSubmenu" @execute="onExecute" />
        <Teleport to="body">
            <MenuDropdown v-if="submenu" class="menu-toolbar-submenu" :menu-id="submenu.menuId" :style="submenuStyle" @pointerdown.stop @close="closeSubmenu()" />
        </Teleport>
    </div>
</template>

<style scoped>
.menu-toolbar {
    position: relative;
    display: flex;
    align-items: center;
}
</style>
