<script setup>
// 资源管理器视图（对齐 VS Code workbench/contrib/files 的 ExplorerView + OpenEditorsView）：
// 折叠面板「打开的编辑器」按 explorer-item 规格渲染（行高 22px、16px 文件图标、
// hover/选中配色取 list.* 主题色）。
// 文件树区域渲染 explorerService 的样本树（单文件夹工作区：根不渲染，样本即顶层行，
// 见 explorerService.js 头注释）；行渲染复用「打开的编辑器」同一套 explorer-item 规格。
// 文件图标走 Seti 主题（workbench/services/themes/fileIconTheme.js）；行容器带 show-file-icons，
// 类名与图标由主题样式表提供（对齐 openEditorsView.ts:246 的 container.classList.add('show-file-icons')）。
//
// 打开交互（对齐 platform/list/browser/listService.ts 的 ResourceNavigator，explorerView.ts:616
// 把 onDidOpen 的 editorOptions 透传给 openEditor）：
//   单击：preserveFocus: true + pinned: false（预览态，listService.ts:714-723 的 onPointer）；
//   双击：preserveFocus: false + pinned: true（固定，:745-760 的 onMouseDblClick）；
//   中键：pinned: true（onPointer 的 isMiddleClick 分支）。
import { onBeforeUnmount, onMounted, ref } from "vue";
import { activateEditor, closeEditor as closeEditorInput, editorGroup, openEditor } from "@/workbench/contrib/editor/editorGroupService.js";
import { explorerRoot, getBuiltInInput, getItemLanguageId } from "@/workbench/contrib/explorer/explorerService.js";
import { ExplorerDataSource } from "@/workbench/contrib/explorer/explorerViewer.js";
import { getFileIconClasses } from "@/workbench/services/themes/fileIconTheme.js";
import Codicon from "@/components/Codicon.vue";

const openEditorsExpanded = ref(true);
// 列表是否持有焦点：决定选中行用 list.activeSelectionBackground 还是 inactiveSelectionBackground。
const listFocused = ref(false);

// 树的顶层行（explorerView.ts:848-853：单文件夹工作区 roots[0] 的子节点）。
// 数据源按权威以实例使用（explorerView.ts:527-572 createTree 里 createInstance）。
const rootChildren = new ExplorerDataSource().getChildren(explorerRoot);

// 选中行：资源管理器树的高亮跟随焦点元素（explorerView.ts 的 onFocusChanged →
// selectActiveFile；本仓库等价于「当前激活编辑器的资源」）。
function isSelected(item) {
    return editorGroup.activeId === getBuiltInInput(item.resource)?.id;
}

function fileIconClasses(item) {
    return getFileIconClasses(item.name, getItemLanguageId(item));
}

// 单击打开：预览态（pinned: false），不抢编辑器焦点（preserveFocus: true）。
function openPreview(item) {
    const input = getBuiltInInput(item.resource);
    if (input) openEditor(input, { preserveFocus: true, pinned: false });
}

// 双击打开：固定态（pinned: true），焦点交给编辑器。
function openPinned(item) {
    const input = getBuiltInInput(item.resource);
    if (input) openEditor(input, { preserveFocus: false, pinned: true });
}

// 中键打开：固定态（onPointer 的 isMiddleClick 分支）。
function onRowMouseDown(event, item) {
    if (event.button === 1) {
        event.preventDefault();
        openPinned(item);
    }
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

            <ul v-show="openEditorsExpanded" class="editor-list show-file-icons" :class="{ focused: listFocused }">
                <li v-for="item in editorGroup.editors" :key="item.id" class="list-row" :class="{ selected: isSelected(item) }" @click="focusEditor(item)">
                    <div class="explorer-item">
                        <span class="item-icon monaco-icon-label" :class="fileIconClasses(item)"></span>
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

        <!-- 文件树（explorerView.ts 的 tree 容器 .explorer-folders-view）：单文件夹工作区，
             根不渲染、样本即顶层行（explorerService.js 头注释）。行规格与「打开的编辑器」一致。 -->
        <section class="pane">
            <div class="pane-header">
                <span class="twistie-placeholder"></span>
                <h3 class="title">samples</h3>
            </div>
            <ul class="editor-list show-file-icons" :class="{ focused: listFocused }">
                <li
                    v-for="item in rootChildren"
                    :key="item.getId()"
                    class="list-row"
                    :class="{ selected: isSelected(item) }"
                    @click="openPreview(item)"
                    @dblclick="openPinned(item)"
                    @mousedown="onRowMouseDown($event, item)">
                    <div class="explorer-item">
                        <span class="item-icon monaco-icon-label" :class="fileIconClasses(item)"></span>
                        <span class="label-name">{{ item.name }}</span>
                    </div>
                </li>
            </ul>
        </section>
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

/* 图标度量由 .monaco-icon-label::before 提供（app.css，出处 iconlabel.css:14-32），
   这里只固定不参与伸缩。图标前景色来自文件图标主题的样式表，选中行不改图标色
   （对齐 iconlabel.css:113-117：选中态只让标签前景色继承）。 */
.item-icon {
    flex: 0 0 auto;
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
/* 文件树折叠面板头：与「打开的编辑器」同一 .pane-header 规格；样本树无子层级，
   不渲染 twistie（占位与 twistie 同宽，保持标题缩进一致）。 */
.twistie-placeholder {
    width: 20px;
    flex: 0 0 auto;
}
</style>
