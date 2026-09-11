<script setup>
// 以 MenuId 为数据源的下拉菜单（菜单栏下拉、工具栏子菜单等宿主使用）：
// 解析菜单条目后交给 MenuPanel 渲染 —— 菜单视觉/交互只有 MenuPanel 一份实现。
// 定位由宿主提供（宿主用内联 style 指定 position/top/left 等）。
import { computed, onBeforeUnmount, ref } from "vue";
import { resolveMenuEntries } from "@/menu/actions.js";
import { contextKeys } from "@/menu/contextKey.js";
import { executeCommand } from "@/menu/commands.js";
import MenuPanel from "@/base/menu/MenuPanel.vue";

const props = defineProps({
    menuId: { type: Object, required: true }
});
const emit = defineEmits(["close"]);

// 上下文键变化时（如选中/焦点改变）重算可见性与启用态。
const version = ref(0);
const off = contextKeys.onDidChange(() => {
    version.value++;
});
onBeforeUnmount(off);

const entries = computed(() => {
    void version.value;
    return resolveMenuEntries(props.menuId, contextKeys);
});

// 子菜单同样是菜单：递归解析成条目交给 MenuPanel 弹出。
function resolveSubmenu(entry) {
    return entry.submenu ? resolveMenuEntries(entry.submenu, contextKeys) : [];
}

function onExecute(entry) {
    if (!entry.commandId) return;
    executeCommand(entry.commandId);
    emit("close");
}
</script>

<template>
    <MenuPanel class="menu-dropdown" :entries="entries" :submenu-resolver="resolveSubmenu" @execute="onExecute" @close="emit('close')" />
</template>

<style scoped>
/* 默认锚在宿主底部；宿主的定位由内联 style 覆盖（如菜单栏按标题位置 fixed 定位）。 */
.menu-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 50;
}
</style>
