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
import EditorBreadcrumbs from "@/workbench/contrib/editor/EditorBreadcrumbs.vue";
import { attachEditorPane, detachEditorPane, editorGroup, getActiveEditorInput } from "@/workbench/contrib/editor/editorGroupService.js";
import { applyWordWrapState, refreshWordWrapContextKeys } from "@/workbench/contrib/codeEditor/wordWrapState.js";
import { configurationService } from "@/workbench/services/configuration/browser/configurationService.js";

const host = ref(null);
const pane = shallowRef(null);

const isEmpty = computed(() => editorGroup.editors.length === 0);

// 编辑器的两个设置项 id（注册见 src/monaco/editorConfiguration.js）。
const WORD_WRAP_SETTING = "editor.wordWrap";
const MINIMAP_ENABLED_SETTING = "editor.minimap.enabled";

onMounted(() => {
    const instance = monaco.editor.create(host.value, {
        model: null,
        theme: "pvf-dark",
        automaticLayout: true,
        fontSize: 13,
        fontFamily: "Menlo, Monaco, 'Courier New', monospace",
        // 缩略图初值取配置（editor.minimap.enabled 默认 true，editorOptions.ts:3495-3499）
        minimap: { enabled: configurationService.getValue(MINIMAP_ENABLED_SETTING) },
        // 换行初值取配置（editor.wordWrap 默认 'off'，editorOptions.ts:6846-6872）；
        // 某个模型被切换过换行后，其覆盖由下面的 syncWordWrap 以 wordWrapOverride2 施加。
        wordWrap: configurationService.getValue(WORD_WRAP_SETTING),
        scrollBeyondLastLine: false,
        renderLineHighlight: "line",
        tabSize: 4,
        // 粘性滚动：滚动时在代码区顶部固定「当前作用域」（面包屑跟随光标，滚动这件事由它承担）。
        // 取值与 VS Code 默认完全相同（editor/common/config/editorOptions.ts:3190 的
        // EditorStickyScroll defaults：enabled / maxLineCount / defaultModel / scrollWithEditor），
        // monaco 发行包默认值见 esm/vs/editor/common/config/editorOptions.js:1382。
        // 这里显式写出而非依赖默认值：该部件的可见性完全由这组取值决定 ——
        // defaultModel 决定取数层（stickyScrollModelProvider.js:47 的分支），
        // maxLineCount 与可视行数 25% 取小（stickyScrollController.js:465-534）。
        stickyScroll: { enabled: true, maxLineCount: 5, defaultModel: "outlineModel", scrollWithEditor: true }
    });
    pane.value = instance;
    attachEditorPane(instance);

    const disposables = [];

    disposables.push(instance.onDidFocusEditorText(() => contextKeys.set("editorFocus", true)));
    disposables.push(instance.onDidBlurEditorText(() => contextKeys.set("editorFocus", false)));

    // ---- 自动换行：触发源与权威 toggleWordWrap.ts 的 ToggleWordWrapController 一致 ----
    // 覆盖状态按模型存放，切换模型或选项变化时重新施加（:134 onDidChangeModel、:116-131
    // onDidChangeConfiguration(wrappingInfo)）；currentlyApplyingEditorConfig 用于区分
    // 「自己改的」与外部改的，避免自触发回环（:115、:126-130）。
    let currentlyApplyingEditorConfig = false;

    function syncWordWrap() {
        if (!instance.getModel()) return;
        try {
            currentlyApplyingEditorConfig = true;
            applyWordWrapState(instance, instance.getModel());
        } finally {
            currentlyApplyingEditorConfig = false;
        }
    }

    disposables.push(
        instance.onDidChangeConfiguration(event => {
            if (!event.hasChanged(monaco.editor.EditorOption.wrappingInfo)) return;
            // isWordWrapMinified / isDominatedByLongLines 由 wrappingInfo 求出（:120-125）
            refreshWordWrapContextKeys(instance);
            // 不是自己引起的换行变化时，重新施加该模型的覆盖状态（:126-130）
            if (!currentlyApplyingEditorConfig) syncWordWrap();
        })
    );
    disposables.push(
        instance.onDidChangeModel(() => {
            // 切换模型后重新施加该模型的覆盖状态，并按新模型的实际换行重算上下文键
            // （toggleWordWrap.ts:134 的 controller 分支 + :286 的 tracker 分支）。
            // 覆盖状态为 null 时 applyWordWrapState 写 'inherit'：若原本已是 'inherit'
            // 不会触发变更事件，因此上下文键必须在这里显式刷新。
            syncWordWrap();
            refreshWordWrapContextKeys(instance);
        })
    );
    // 窗口焦点变化时重算 canToggleWordWrap / editorWordWrap
    // （EditorWordWrapContextKeyTracker 的 window focus/blur 监听，:245-249）
    const onWindowFocusChange = () => refreshWordWrapContextKeys(instance);
    globalThis.window?.addEventListener("focus", onWindowFocusChange, true);
    globalThis.window?.addEventListener("blur", onWindowFocusChange, true);
    disposables.push({
        dispose() {
            globalThis.window?.removeEventListener("focus", onWindowFocusChange, true);
            globalThis.window?.removeEventListener("blur", onWindowFocusChange, true);
        }
    });

    // ---- 设置项变化落到编辑器部件 ----
    disposables.push(
        configurationService.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration(MINIMAP_ENABLED_SETTING)) {
                instance.updateOptions({ minimap: { enabled: configurationService.getValue(MINIMAP_ENABLED_SETTING) } });
            }
            // 换行设置是 base 值：无覆盖的模型直接跟着变，有覆盖的模型由上面的
            // wrappingInfo 监听重新施加覆盖（override2 优先于 wordWrap）。
            if (event.affectsConfiguration(WORD_WRAP_SETTING)) {
                instance.updateOptions({ wordWrap: configurationService.getValue(WORD_WRAP_SETTING) });
            }
        })
    );

    // 首个模型的覆盖状态与上下文键（模型可能是在部件创建前打开的）
    syncWordWrap();
    refreshWordWrapContextKeys(instance);

    mountedDisposables.push(...disposables);
});

// 部件创建期注册的监听：卸载时统一撤销（Monaco 部件自身的 onDid* 监听随 dispose() 一起释放，
// 但配置服务与 window 上的监听不属于编辑器实例，必须显式撤销）。
const mountedDisposables = [];

// 选区长度变化时同步上下文键，供菜单项的 precondition（如剪切/复制）求值。
watch(
    () => getActiveEditorInput()?.selectionLength ?? 0,
    length => contextKeys.set("editorHasSelection", length > 0)
);

// 部件尺寸变化后同步重排编辑器（对齐 VS Code 的布局语义：grid 布局完成后立即调用
// editor.layout()，见 workbench/browser/layout.ts 的 WorkbenchLayout 与
// editorPart.ts 的 layout()）。
//
// 为什么不能只靠 Monaco 的 automaticLayout：它内部用 ResizeObserver（elementSizeObserver.js），
// 回调落在渲染帧的 layout 阶段之后；而 minimap 的 canvas 是在 _applyLayout 里被改写
// width/height 清空的（minimap.js:1082-1093），重绘要等编辑器 render loop 的下一帧 ——
// 持续拖拽侧栏/面板时每一帧都先清空、后重绘，缩略图表现为不断闪烁。
// 在 Vue 的 post-flush（DOM 已更新、仍在同一任务内）同步 layout()，清空与重绘落在同一帧。
// automaticLayout 保留为兜底：同步 layout 已把尺寸记入 ElementSizeObserver，它随后不会重复触发。
watch(
    () => [appState.sidebarWidth, appState.sidebarVisible, appState.panelHeight, appState.panelVisible, appState.panelMaximized, appState.statusBarVisible],
    () => pane.value?.layout(),
    { flush: "post" }
);

onBeforeUnmount(() => {
    for (const disposable of mountedDisposables.splice(0)) disposable.dispose?.();
    detachEditorPane();
    pane.value?.dispose();
});
</script>

<template>
    <section class="editor-part" :class="{ 'panel-maximized': appState.panelMaximized }">
        <div class="editor-group-container" :class="{ active: !isEmpty }">
            <div class="title">
                <EditorTabs />
                <!-- 面包屑位于标签栏下方同一 .title 容器内（对齐 editorTitleControl.ts 的
                     .breadcrumbs-below-tabs，布局取值见 media/editortitlecontrol.css:6-12） -->
                <EditorBreadcrumbs />
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
