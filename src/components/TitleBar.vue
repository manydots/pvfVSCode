<script setup>
// 标题栏部件（对齐 VS Code workbench/browser/parts/titlebar/titlebarPart.ts）：
// 左侧菜单栏、中间窗口标题、右侧动作工具栏；高度与配色取 titleBar.* 主题色。
import { computed } from "vue";
import MenuBar from "@/components/MenuBar.vue";
import MenuToolbar from "@/components/MenuToolbar.vue";
import { MenuId } from "@/menu/menuId.js";
import { appState } from "@/menu/appState.js";
import { getActiveEditorInput } from "@/workbench/contrib/editor/editorGroupService.js";

// 窗口标题展示当前激活编辑器名称（对齐 VS Code 标题栏的编辑器标题）。
const activeEditor = computed(() => getActiveEditorInput());
</script>

<template>
    <header class="titlebar">
        <MenuBar />
        <span class="titlebar-title">
            {{ appState.title }}<template v-if="activeEditor"> — {{ activeEditor.name }}</template>
        </span>
        <span class="titlebar-spacer"></span>
        <MenuToolbar :menu-id="MenuId.TitleBar" aria-label="标题操作" />
    </header>
</template>

<style scoped>
.titlebar {
    height: var(--vscode-titleBar-height);
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    padding: 0 8px;
    background: var(--vscode-titleBar-activeBackground);
    color: var(--vscode-titleBar-activeForeground);
    font-size: 12px;
    /* 底部分隔线与阴影（对齐 titlebarPart.ts 的 titleBorder 与 titlebarpart.css:10 的 shadow-md） */
    border-bottom: 1px solid var(--vscode-titleBar-border);
    box-shadow: var(--vscode-shadow-md);
}

.titlebar-title {
    margin-left: 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.titlebar-spacer {
    flex: 1 1 auto;
}
</style>
