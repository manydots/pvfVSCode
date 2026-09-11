<script setup>
// 顶部菜单栏（对齐 VS Code base/browser/ui/menu/menubar.css + menubarControl.css）：
// 菜单标题内边距 0 8px、圆角 5px，悬停/展开用 menubar.selectionBackground。
// 打开状态下悬停其他标题即切换（VS Code 菜单栏行为）；点击外部或 Esc 关闭。
// 下拉面板与 VS Code 一样渲染在独立浮层（Teleport 到 body），避免被菜单栏自身的
// overflow 裁剪，也便于覆盖编辑器区域。
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { MenuId } from "@/menu/menuId.js";
import { MenuRegistry } from "@/menu/actions.js";
import { contextKeys } from "@/menu/contextKey.js";
import MenuDropdown from "@/components/MenuDropdown.vue";

const items = MenuRegistry.getMenuItems(MenuId.MenubarMainMenu)
    .filter(item => !item.when || item.when.evaluate(contextKeys))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const openIndex = ref(-1);
// 浮层锚点：当前菜单标题在视口中的位置。
const anchor = ref({ left: 0, top: 0 });

const dropdownStyle = computed(() => ({
    position: "fixed",
    left: `${anchor.value.left}px`,
    top: `${anchor.value.top}px`,
    zIndex: 2000
}));

function open(index, event) {
    const rect = event?.currentTarget?.getBoundingClientRect?.();
    if (rect) anchor.value = { left: rect.left, top: rect.bottom };
    openIndex.value = index;
}

function toggle(index, event) {
    if (openIndex.value === index) {
        openIndex.value = -1;
        return;
    }
    open(index, event);
}

function hover(index, event) {
    if (openIndex.value !== -1 && openIndex.value !== index) {
        open(index, event);
    }
}

function close() {
    openIndex.value = -1;
}

function onPointerDown(event) {
    // 下拉面板已 Teleport 到 body，不在 .menubar 内，需单独放行，否则点击菜单项会先被关闭。
    if (!event.target.closest(".menubar") && !event.target.closest(".menubar-dropdown")) close();
}

function onKeyDown(event) {
    if (event.key === "Escape") close();
}

onMounted(() => {
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
});
onBeforeUnmount(() => {
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("keydown", onKeyDown);
});
</script>

<template>
    <nav class="menubar">
        <div v-for="(item, index) in items" :key="item.submenu.id" class="menubar-slot">
            <button type="button" class="menubar-item" :class="{ open: openIndex === index }" @click="toggle(index, $event)" @mouseenter="hover(index, $event)">
                <span class="menubar-menu-title">{{ item.title }}</span>
            </button>
            <Teleport to="body">
                <MenuDropdown v-if="openIndex === index" class="menubar-dropdown" :menu-id="item.submenu" :style="dropdownStyle" @close="close" />
            </Teleport>
        </div>
    </nav>
</template>

<style scoped>
.menubar {
    display: flex;
    align-items: center;
    height: 100%;
    flex-shrink: 1;
    overflow: hidden;
}

.menubar-slot {
    position: relative;
    height: 100%;
}

.menubar-item {
    height: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    font-family: inherit;
    font-size: 13px;
    cursor: default;
}

.menubar-menu-title {
    display: inline-block;
    padding: 0 8px;
    border-radius: 5px;
}

.menubar-item:hover .menubar-menu-title,
.menubar-item.open .menubar-menu-title {
    background: var(--vscode-menubar-selectionBackground);
    color: var(--vscode-menubar-selectionForeground);
}
</style>
