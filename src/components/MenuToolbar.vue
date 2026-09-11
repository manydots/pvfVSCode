<script setup>
// 以 MenuId 为数据源的工具栏（对齐 VS Code workbench MenuWorkbenchToolBar）：
// 解析菜单动作交给通用 Toolbar 渲染。主区按钮上的子菜单锚在工具栏上展开；
// 溢出菜单里的子菜单由 MenuPanel 锚在条目上就地弹出（与 VS Code 的 Menu 一致）。
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { contextKeys } from "@/menu/contextKey.js";
import { getToolbarActions } from "@/menu/menuToolbar.js";
import { resolveMenuEntries } from "@/menu/actions.js";
import Toolbar from "@/base/toolbar/Toolbar.vue";
import MenuDropdown from "@/components/MenuDropdown.vue";

const props = defineProps({
    menuId: { type: Object, required: true },
    primaryGroup: { type: String, default: "navigation" },
    maxItems: { type: Number, default: 12 },
    ariaLabel: { type: String, default: "工具栏" }
});

const root = ref(null);
// MenuId 是标识对象，必须保持原样（shallowRef 不做深层代理），否则按 id 查找会失效。
const submenu = shallowRef(null);

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

function onExecute(action, info) {
    // 溢出菜单的子菜单已在 MenuPanel 内弹出，这里不再重复展开。
    if (action.submenu && !info?.fromOverflow) {
        submenu.value = { menuId: action.submenu };
        return;
    }
    submenu.value = null;
    action.run?.();
}

function onPointerDown(event) {
    if (submenu.value && !event.target.closest(".menu-toolbar")) {
        submenu.value = null;
    }
}

onMounted(() => document.addEventListener("pointerdown", onPointerDown));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onPointerDown));
</script>

<template>
    <div ref="root" class="menu-toolbar">
        <Toolbar :primary="layout.primary" :secondary="layout.secondary" :max-items="maxItems" :aria-label="ariaLabel" :submenu-resolver="resolveSubmenu" @execute="onExecute" />
        <MenuDropdown v-if="submenu" class="menu-toolbar-submenu" :menu-id="submenu.menuId" :style="{ left: 'auto', right: '0px' }" @close="submenu = null" />
    </div>
</template>

<style scoped>
.menu-toolbar {
    position: relative;
    display: flex;
    align-items: center;
}

.menu-toolbar-submenu {
    top: 100%;
    left: auto;
    right: 0;
}
</style>
