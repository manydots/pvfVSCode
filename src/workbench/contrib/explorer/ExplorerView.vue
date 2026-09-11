<script setup>
// 资源管理器视图（对齐 VS Code workbench/contrib/files 的 ExplorerView + OpenEditorsView）：
// 折叠面板「打开的编辑器」按 explorer-item 规格渲染（行高 22px、16px 文件图标、
// hover/选中配色取 list.* 主题色），文件树区域在 PVF 归档接入前为占位。
import { onBeforeUnmount, onMounted, ref } from "vue";
import { activateEditor, closeEditor as closeEditorInput, editorGroup, getEditorIcon } from "@/workbench/contrib/editor/editorGroupService.js";
import Codicon from "@/components/Codicon.vue";

const openEditorsExpanded = ref(true);
// 列表是否持有焦点：决定选中行用 list.activeSelectionBackground 还是 inactiveSelectionBackground。
const listFocused = ref(false);

function isSelected(item) {
    return editorGroup.activeId === item.id;
}

function focusEditor(item) {
    activateEditor(item.id);
}

function closeEditor(item) {
    closeEditorInput(item.id);
}

function onPointerDown(event) {
    listFocused.value = !!event.target.closest?.(".editor-list");
}

onMounted(() => document.addEventListener("pointerdown", onPointerDown));
onBeforeUnmount(() => document.removeEventListener("pointerdown", onPointerDown));
</script>

<template>
    <div class="explorer-view">
        <section class="pane">
            <div class="pane-header" :class="{ expanded: openEditorsExpanded }" @click="openEditorsExpanded = !openEditorsExpanded">
                <Codicon name="chevron-down" :size="16" class="twistie" :class="{ collapsed: !openEditorsExpanded }" />
                <h3 class="title">打开的编辑器</h3>
            </div>

            <ul v-show="openEditorsExpanded" class="editor-list" :class="{ focused: listFocused }">
                <li v-for="item in editorGroup.editors" :key="item.id" class="list-row" :class="{ selected: isSelected(item) }" @click="focusEditor(item)">
                    <div class="explorer-item">
                        <span class="item-icon"><Codicon :name="getEditorIcon(item)" :size="16" /></span>
                        <span class="label-name">{{ item.name }}</span>
                        <span class="item-actions">
                            <button type="button" class="action-label" title="关闭" aria-label="关闭" @click.stop="closeEditor(item)">
                                <Codicon :name="item.dirty ? 'circle-filled' : 'close'" :size="16" />
                            </button>
                        </span>
                    </div>
                </li>
            </ul>
        </section>

        <div class="tree-empty">
            <p class="tree-empty-title"></p>
            <p class="tree-empty-hint"></p>
        </div>
    </div>
</template>

<style scoped>
.explorer-view {
    display: flex;
    flex-direction: column;
    font-size: 13px;
    color: var(--vscode-sideBar-foreground);
}

/* --- 折叠面板头部（paneview.css 的 .pane > .pane-header） --- */
.pane-header {
    display: flex;
    align-items: center;
    height: var(--vscode-paneHeader-height);
    line-height: var(--vscode-paneHeader-height);
    font-size: 11px;
    font-weight: normal;
    cursor: pointer;
    overflow: hidden;
}

.pane-header .twistie {
    margin: 0 2px;
    transition: transform 0.1s ease-out;
}

.pane-header.expanded .twistie {
    transform: translateY(1px);
}

.pane-header .twistie.collapsed {
    transform: rotate(-90deg);
}

.pane-header .title {
    margin: 0;
    font-size: 11px;
    font-weight: normal;
}

/* --- 打开的编辑器列表（explorerviewlet.css 的 .explorer-item） --- */
.editor-list {
    list-style: none;
    margin: 0;
    padding: 0;
}

/* 注意：不要复用 Monaco 的 .monaco-list-row 类名——Monaco 的全局 CSS 会把它设为
   position: absolute，导致行脱离文档流、区块高度塌陷。 */
.list-row {
    height: 22px;
    overflow: hidden;
    cursor: pointer;
}

.list-row:hover {
    background: var(--vscode-list-hoverBackground);
}

.list-row.selected {
    background: var(--vscode-list-inactiveSelectionBackground);
}

.editor-list.focused .list-row.selected {
    background: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
}

.editor-list.focused .list-row.selected .item-icon {
    color: var(--vscode-list-activeSelectionForeground);
}

.editor-list:focus-within .list-row.selected {
    outline: 1px solid var(--vscode-list-focusOutline);
    outline-offset: -1px;
}

.explorer-item {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    height: 22px;
    line-height: 22px;
    padding-left: 8px;
    overflow: hidden;
}

.item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 16px;
    height: 22px;
    padding-right: 6px;
    box-sizing: content-box;
    color: var(--vscode-icon-foreground);
}

.label-name {
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.item-actions {
    flex: 0 0 auto;
    display: none;
    align-items: center;
    margin-right: 4px;
}

.list-row:hover .item-actions,
.list-row.selected .item-actions {
    display: flex;
}

.item-actions .action-label {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: none;
    border-radius: var(--vscode-cornerRadius-medium);
    background: transparent;
    color: inherit;
    cursor: default;
}

.item-actions .action-label:hover {
    background: var(--vscode-toolbar-hoverBackground);
}

/* --- 未接入归档时的空状态 --- */
.tree-empty {
    padding: 16px 12px;
    color: var(--vscode-descriptionForeground);
}

.tree-empty-title {
    margin: 0 0 6px;
}

.tree-empty-hint {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
}
</style>
