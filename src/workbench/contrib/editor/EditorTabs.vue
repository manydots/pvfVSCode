<script setup>
// 编辑器标签栏（对齐 VS Code workbench/browser/parts/editor/multiEditorTabsControl.ts
// 与 media/multieditortabscontrol.css）。
//
// DOM 层级：.tabs-and-actions-container > (.tabs-container > .tab*) + .editor-actions。
// 标签宽度采用 sizing-shrink 策略（min-width 80px、均分增长、max-fit-content），
// 脏标记在关闭按钮位置以实心圆点显示，hover 时恢复为关闭图标。
import { computed, ref } from "vue";
import { MenuId } from "@/menu/menuId.js";
import { contextKeys } from "@/menu/contextKey.js";
import Codicon from "@/components/Codicon.vue";
import MenuToolbar from "@/components/MenuToolbar.vue";
import MenuDropdown from "@/components/MenuDropdown.vue";
import { activateEditor, closeEditor, editorGroup, getEditorIcon } from "@/workbench/contrib/editor/editorGroupService.js";

const hoveredId = ref(null);
const contextMenu = ref(null);

// 当前打开的编辑器数量为 0 时整条标签栏隐藏（对齐 .tabs-and-actions-container.empty）。
const isEmpty = computed(() => editorGroup.editors.length === 0);

function iconFor(editor) {
    return getEditorIcon(editor);
}

// 脏标签在未 hover 时显示实心圆点，hover 时显示关闭图标（对齐 CSS 的 ::before 图标替换）。
function tabActionIcon(editor) {
    if (editor.dirty && hoveredId.value !== editor.id) return "circle-filled";
    return "close";
}

function tabActionTitle(editor) {
    if (editor.dirty) return "未保存的更改";
    return "关闭";
}

function onClose(event, editor) {
    event.stopPropagation();
    closeEditor(editor.id);
}

// 中键关闭（对齐 multiEditorTabsControl.ts 的 AUXCLICK 处理）。
function onAuxClick(event, editor) {
    if (event.button !== 1) return;
    event.preventDefault();
    closeEditor(editor.id);
}

function onWheel(event) {
    if (editorGroup.editors.length < 2) return;
    event.preventDefault();
    const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
    if (Math.abs(delta) < 1) return;
    const index = editorGroup.editors.findIndex(editor => editor.id === editorGroup.activeId);
    if (index < 0) return;
    const next = (index + (delta > 0 ? 1 : -1) + editorGroup.editors.length) % editorGroup.editors.length;
    activateEditor(editorGroup.editors[next].id);
}

function openContextMenu(event, editor) {
    // 右键菜单按被点击标签求值 when（固定态/脏态），不改变当前激活标签。
    contextKeys.set("editorContextId", editor.id);
    contextKeys.set("editorIsPinned", editor.pinned);
    contextKeys.set("editorIsDirty", editor.dirty);
    // 视口坐标：菜单 Teleport 到 body 后按 fixed 定位，不受标签栏 overflow 裁剪。
    contextMenu.value = { x: event.clientX, y: event.clientY };
}

function closeContextMenu() {
    contextMenu.value = null;
    contextKeys.set("editorContextId", undefined);
}
</script>

<template>
    <div class="tabs-and-actions-container" :class="{ empty: isEmpty }">
        <div class="tabs-scroll">
            <div class="tabs-container" role="tablist" @wheel="onWheel">
                <div
                    v-for="editor in editorGroup.editors"
                    :key="editor.id"
                    class="tab sizing-shrink tab-actions-right"
                    :class="{
                        active: editor.id === editorGroup.activeId,
                        pinned: editor.pinned,
                        dirty: editor.dirty
                    }"
                    role="tab"
                    :aria-selected="editor.id === editorGroup.activeId"
                    :title="editor.description ? `${editor.name} — ${editor.description}` : editor.name"
                    @click="activateEditor(editor.id)"
                    @auxclick="onAuxClick($event, editor)"
                    @mouseenter="hoveredId = editor.id"
                    @mouseleave="hoveredId = null"
                    @contextmenu.prevent.stop="openContextMenu($event, editor)">
                    <div class="tab-label monaco-icon-label" :class="{ italic: !editor.pinned }">
                        <span class="monaco-icon-label-iconpath"><Codicon :name="iconFor(editor)" :size="16" /></span>
                        <span class="label-name">{{ editor.name }}</span>
                    </div>
                    <div class="tab-actions">
                        <button type="button" class="action-label" :title="tabActionTitle(editor)" :aria-label="tabActionTitle(editor)" @click="onClose($event, editor)">
                            <Codicon :name="tabActionIcon(editor)" :size="16" />
                        </button>
                    </div>
                </div>
            </div>

            <Teleport to="body">
                <MenuDropdown
                    v-if="contextMenu"
                    class="tab-context-menu"
                    :menu-id="MenuId.EditorTitleContext"
                    :style="{ position: 'fixed', zIndex: 2000, left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
                    @close="closeContextMenu" />
            </Teleport>
        </div>

        <div class="editor-actions">
            <MenuToolbar :menu-id="MenuId.EditorTitle" :max-items="9" aria-label="编辑器操作" />
        </div>
    </div>
</template>

<style scoped>
/* .monaco-workbench .part.editor > .content .editor-group-container > .title > .tabs-and-actions-container */
.tabs-and-actions-container {
    display: flex;
    position: relative;
    height: var(--vscode-tab-height);
    background: var(--vscode-editorGroupHeader-tabsBackground);
}

.tabs-and-actions-container.empty {
    display: none;
}

.tabs-scroll {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
}

/* .tabs-container：横向轨道；溢出时隐藏原生滚动条（对齐 scrollbar-width:none 与 ::-webkit-scrollbar） */
.tabs-container {
    display: flex;
    height: var(--vscode-tab-height);
    overflow-x: auto;
    scrollbar-width: none;
    outline: none;
}

.tabs-container::-webkit-scrollbar {
    display: none;
}

/* .tab */
.tab {
    position: relative;
    display: flex;
    align-items: center;
    height: var(--vscode-tab-height);
    box-sizing: border-box;
    padding-left: 10px;
    white-space: nowrap;
    cursor: pointer;
    background-color: var(--vscode-tab-inactiveBackground);
    color: var(--vscode-tab-inactiveForeground);
    border-right: 1px solid var(--vscode-tab-border);
    outline-offset: -2px;
}

.tab:hover:not(.active) {
    box-shadow: var(--vscode-shadow-sm);
}

.tab.active {
    background-color: var(--vscode-tab-activeBackground);
    color: var(--vscode-tab-activeForeground);
    box-shadow: inset var(--vscode-shadow-active-tab);
}

/* .tab.sizing-shrink：等分增长，最小 80px，最大适应内容 */
.tab.sizing-shrink {
    min-width: 80px;
    flex-basis: 0;
    flex-grow: 1;
    max-width: fit-content;
}

/* .tab-label / .monaco-icon-label */
.tab-label {
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    min-width: 0;
    margin-top: auto;
    margin-bottom: auto;
    line-height: var(--vscode-tab-height);
    padding-right: 5px;
}

.monaco-icon-label-iconpath {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
    margin-right: 6px;
}

.tab-label .label-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.tab-label.italic .label-name {
    font-style: italic;
}

/* .tab-actions：固定 28px 宽，关闭按钮默认透明，hover/激活/脏态显示 */
.tab-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 28px;
    margin-top: auto;
    margin-bottom: auto;
}

.tab-actions .action-label {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 2px;
    border: none;
    border-radius: var(--vscode-cornerRadius-medium);
    background: transparent;
    color: inherit;
    font-size: 16px;
    opacity: 0;
    cursor: default;
}

.tab.active > .tab-actions .action-label,
.tab:hover > .tab-actions .action-label,
.tab.dirty > .tab-actions .action-label {
    opacity: 1;
}

.tab-actions .action-label:hover {
    background: var(--vscode-toolbar-hoverBackground);
}

/* .editor-actions：标签栏右侧动作工具栏（对齐 padding: 0 8px 0 4px） */
.editor-actions {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
    height: var(--vscode-tab-height);
    padding: 0 8px 0 4px;
    cursor: default;
}

/* 标签右键菜单 Teleport 到 body，定位由内联 style 提供（fixed，按指针坐标） */
</style>
