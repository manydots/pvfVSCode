<script setup>
// 编辑器部件（对齐 VS Code workbench/browser/parts/editor/editorPart.ts +
// editorGroupView.ts 的单组布局）：上面是编辑器标签栏，下面是 Monaco 编辑器部件。
//
// 与 VS Code 一样只创建一个 Monaco 编辑器实例，多个标签共用该实例并切换 model
// （见 editorGroupService.js），因此聚焦/光标/选区上下文键只需在此绑定一次。
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { monaco } from "@/monaco/setup.js";
import { appState } from "@/menu/appState.js";
import { contextKeys } from "@/menu/contextKey.js";
import EditorTabs from "@/workbench/contrib/editor/EditorTabs.vue";
import { attachEditorPane, detachEditorPane, editorGroup, getActiveEditorInput } from "@/workbench/contrib/editor/editorGroupService.js";

const host = ref(null);
const pane = shallowRef(null);

const isEmpty = computed(() => editorGroup.editors.length === 0);

onMounted(() => {
    const instance = monaco.editor.create(host.value, {
        model: null,
        theme: "pvf-dark",
        automaticLayout: true,
        fontSize: 13,
        fontFamily: "Menlo, Monaco, 'Courier New', monospace",
        minimap: { enabled: appState.minimap },
        wordWrap: appState.wordWrap ? "on" : "off",
        scrollBeyondLastLine: false,
        renderLineHighlight: "line",
        tabSize: 4
    });
    pane.value = instance;
    attachEditorPane(instance);

    instance.onDidFocusEditorText(() => contextKeys.set("editorFocus", true));
    instance.onDidBlurEditorText(() => contextKeys.set("editorFocus", false));

    // 编辑器自身处理的选项类按键（如 Monaco 原生的 Alt+Z 切换换行）会把结果直接写入编辑器，
    // 这里回写 appState，保证菜单勾选态与编辑器实际状态一致。
    instance.onDidChangeConfiguration(event => {
        if (event.hasChanged(monaco.editor.EditorOption.wordWrap)) {
            appState.wordWrap = instance.getOption(monaco.editor.EditorOption.wordWrap) !== "off";
        }
    });
});

// 选区长度变化时同步上下文键，供菜单项的 precondition（如剪切/复制）求值。
watch(
    () => getActiveEditorInput()?.selectionLength ?? 0,
    length => contextKeys.set("editorHasSelection", length > 0)
);

// 观察选项类命令对 appState 的改动，应用到唯一的编辑器部件。
watch(
    () => [appState.wordWrap, appState.minimap],
    ([wordWrap, minimap]) => {
        pane.value?.updateOptions({ wordWrap: wordWrap ? "on" : "off", minimap: { enabled: minimap } });
    }
);

onBeforeUnmount(() => {
    detachEditorPane();
    pane.value?.dispose();
});
</script>

<template>
    <section class="editor-part" :class="{ 'panel-maximized': appState.panelMaximized }">
        <div class="editor-group-container" :class="{ active: !isEmpty }">
            <div class="title">
                <EditorTabs />
            </div>
            <div class="editor-host" ref="host"></div>
            <div v-if="isEmpty" class="editor-group-watermark">
                <div class="watermark-title">pvfVSCode</div>
                <ul class="watermark-hints">
                    <li><span class="shortcut">Ctrl+N</span> 新建文件</li>
                    <li><span class="shortcut">Ctrl+O</span> 打开 PVF 归档</li>
                    <li><span class="shortcut">Ctrl+J</span> 切换面板</li>
                </ul>
            </div>
        </div>
    </section>
</template>

<style scoped>
.editor-part {
    flex: 1 1 auto;
    display: flex;
    min-height: 0;
    background: var(--vscode-editor-background);
}

/* 面板最大化时编辑器区收起到 0 高度（对齐 VS Code grid 中最大化面板占满主区的行为）；
   仍保留在 DOM 中，避免销毁并重建 Monaco 实例。 */
.editor-part.panel-maximized {
    flex: 0 0 0;
    min-height: 0;
    overflow: hidden;
}

.editor-group-container {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
}

.title {
    flex: 0 0 auto;
    overflow: hidden;
}

.editor-host {
    flex: 1 1 auto;
    min-height: 0;
}

/* .editor-group-watermark（对齐 editorplaceholder.css）：空编辑器组显示水印与快捷键提示 */
.editor-group-watermark {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    pointer-events: none;
    color: var(--vscode-descriptionForeground);
}

.watermark-title {
    font-size: 40px;
    opacity: 0.3;
}

.watermark-hints {
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 13px;
    line-height: 2;
}

.shortcut {
    display: inline-block;
    min-width: 72px;
    margin-right: 8px;
    text-align: right;
    color: var(--vscode-descriptionForeground);
}
</style>
