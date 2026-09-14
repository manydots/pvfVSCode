<script setup>
// 编辑器面包屑（位于编辑器标签栏下方的一行）。
//
// 权威来源（microsoft/vscode）：
//   结构  workbench/browser/parts/editor/breadcrumbsControl.ts:309（容器加 .breadcrumbs-control）
//         base/browser/ui/breadcrumbs/breadcrumbsWidget.ts:74-91（.monaco-breadcrumbs，role=list，tabIndex=0）
//         base/browser/ui/breadcrumbs/breadcrumbsWidget.ts:355-369（item：role=listitem、tabIndex=-1、
//           末尾追加分隔图标）
//         workbench/browser/parts/editor/breadcrumbsControl.ts:157-171（FileItem.render：图标标签 + file/folder 类）
//   取值  workbench/browser/parts/editor/media/editortitlecontrol.css:6-47
//         base/browser/ui/breadcrumbs/breadcrumbsWidget.css:6-36
//         platform/theme/browser/defaultStyles.ts:151-157（颜色 token 映射；widget 在
//           breadcrumbsWidget.ts:160-177 以样式表注入这些规则）
//   交互  breadcrumbsWidget.ts:218-232（_focus：切换 .focused 并 node.focus()）
//         breadcrumbsWidget.ts:371-383（点击 = _focus + _select，payload 为鼠标事件）
//         breadcrumbsControl.ts:609-613/626-760（选中后的浮层与跳转，见 breadcrumbsControl.js）
//         breadcrumbsControl.ts:867-879 / :940-979（聚焦、选中与左右方向键命令）
//         键盘（Escape / Enter / 方向键）不在部件内处理，由 breadcrumbs.contribution.js 登记的命令
//         按上下文键分发 —— 与权威一致（权威无部件内 keydown 处理器）
//
// 裁剪（登记在 docs/vscode-reference.md 第 5 节）：无横向滚动容器。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { appState } from "@/menu/appState.js";
import Codicon from "@/components/Codicon.vue";
import { getSymbolBreadcrumbs } from "@/monaco/documentSymbols.js";
import { editorGroup, getActiveEditorInput, getModel } from "@/workbench/contrib/editor/editorGroupService.js";
import { breadcrumbModel, getBreadcrumbItems, registerBreadcrumbNodeProvider, setBreadcrumbResource, setBreadcrumbSymbols, setFocusedBreadcrumb, setSelectedBreadcrumb, updateBreadcrumbsActive } from "@/workbench/contrib/editor/breadcrumbs.js";
import { getFileIconClasses } from "@/workbench/services/themes/fileIconTheme.js";

const rootEl = ref(null);

// 依赖活动编辑器与符号段：切换标签或光标移动后重算条目。
const items = computed(() => {
    void editorGroup.activeId;
    void breadcrumbModel.items;
    return getBreadcrumbItems();
});

function itemNodes() {
    return Array.from(rootEl.value?.querySelectorAll(".monaco-breadcrumb-item") ?? []);
}

function iconClasses(item) {
    // 目录与符号段没有文件图标：目录不显示图标（对齐 breadcrumbsControl.ts:162 的
    // hideIcon: kind === FileKind.FOLDER），符号段用 codicon（见模板）。
    return item.kind === "file" ? getFileIconClasses(item.name, getActiveEditorInput()?.languageId) : "";
}

// 符号段来自 outline（monaco/documentSymbols.js）：光标位置或活动编辑器变化时重取，
// 过期结果按序号丢弃（对齐 BreadcrumbsModel._bindToEditor 的 CancellationTokenSource 语义）。
//
// 初始态偏差（登记在 docs/vscode-reference.md 第 5 节）：权威打开编辑器即按当前光标计算
// 符号链（documentSymbolsOutline.ts 的 _setOutlineModel → update(model, position)），光标
// 恰好落在符号声明行时首段就显示该符号。本仓库样本的第 1 行是全局变量声明（变量符号的
// range 为单行、包含初始光标 (1,1)），「打开即选中」与用户预期的「默认未选中任何符号」
// 相悖，故在光标被用户真正移动过之前用哨兵位置取链 —— 链为空 → 补「outline 自身」条目
// （breadcrumbsModel.ts:118-125），渲染为 `…`（breadcrumbsControl.ts:96-110），与 VS Code
// 光标在符号外时的形态一致。光标一旦移动（onDidChangeCursorPosition 只由真实光标移动触发，
// setModel 不发该事件），即恢复权威语义。
let symbolRequest = 0;
let cursorEverMoved = false;
const NO_ACTIVE_POSITION = { lineNumber: -1, column: -1 };

async function refreshSymbols() {
    const editor = getActiveEditorInput();
    const request = ++symbolRequest;
    if (!editor) {
        setBreadcrumbSymbols(null, null, []);
        return;
    }
    const position = cursorEverMoved ? editor.cursor : NO_ACTIVE_POSITION;
    const { outline, elements } = await getSymbolBreadcrumbs(getModel(editor.id), position);
    if (request !== symbolRequest) return;
    setBreadcrumbSymbols(editor.resource, outline, elements);
    updateBreadcrumbsActive();
}

function onFocusIn() {
    updateBreadcrumbsActive();
}

function onFocusOut(event) {
    if (event.relatedTarget && rootEl.value?.contains(event.relatedTarget)) return;
    // 焦点离开部件**不清焦点条目**：权威只在聚焦/失焦时发一个布尔事件
    // （breadcrumbsWidget.ts:95-96 的 `onDidChangeFocus.fire(false/true)`），`_focusedItemIdx`
    // 与条目上的 `.focused` 类都保持不变 —— 这正是浮层打开时被点中的那一段仍保持
    // focused + selected 高亮的原因。清焦点只发生在两条明确路径：Escape 的
    // breadcrumbs.selectEditor（breadcrumbsControl.ts:1046-1057）与浮层 onHide 的
    // `source === this` 分支（:730-733）。
    // 这里只按「部件持有 DOM 焦点 或 浮层正在显示」重算上下文键（:724-728）。
    updateBreadcrumbsActive();
}

// 点击 = _focus(idx, event) 后 _select(idx, event)（breadcrumbsWidget.ts:371-383）：
// payload 为鼠标事件，控件据此把箭头的尖端对准点击位置（breadcrumbsControl.ts:689-696）；
// 键盘触发的选中则以 Payload_Pick 标记 payload（breadcrumbs 命令，见 breadcrumbs.contribution.js）。
function onClick(index, event) {
    setFocusedBreadcrumb(index);
    setSelectedBreadcrumb(index, event);
}

// _focus 会把 DOM 焦点移到对应条目（breadcrumbsWidget.ts:227）。
watch(
    () => appState.breadcrumbsFocusedIndex,
    async index => {
        await nextTick();
        if (index < 0) return;
        itemNodes()[index]?.focus({ preventScroll: true });
    }
);

// 触发源穷举（§4.4）取自 documentSymbolsOutline.ts:190-204 的订阅列表，逐条落点：
//   1. onDidChangeModel          :192 → 活动编辑器（模型）变化后立即重建 —— 见下方第一个 watch；
//   2. onDidChangeModelLanguage  :193 → 语言变化后立即重建 —— 第二个 watch；
//   3. onDidChangeModelContent   :198-204 → 内容变化后按 provider 实测耗时防抖重建；本仓库取该
//      防抖下限 350ms（monaco 发行包 outlineModel.js:205 的 { min: 350 }，权威的
//      getDebounceValue 未从发行包导出，登记在 docs/vscode-reference.md 第 5 节）—— 第三个 watch；
//   4. onDidChangeCursorPosition :364-371 → 光标变化经 150ms 防抖后仅更新「活动段」—— 第四个 watch。
// 四个触发源最终都调用 refreshSymbols()（本仓库一次取全，等价于
// _createOutline() + _breadcrumbsDataSource.update()），过期结果按序号丢弃。
// 注意权威实现不订阅滚动事件 —— 面包屑跟随光标，「随滚动显示当前作用域」是编辑器粘性滚动
// （editor/contrib/stickyScroll）的职责，取值固定在 EditorPart.vue 的 stickyScroll 选项
// （见 docs/vscode-reference.md 4.7）。
const SYMBOL_CURSOR_DEBOUNCE = 150;
const SYMBOL_CONTENT_DEBOUNCE = 350;

let symbolTimer = null;
let lastActiveId = null;

function scheduleSymbolRefresh(delay) {
    clearTimeout(symbolTimer);
    symbolTimer = setTimeout(refreshSymbols, delay);
}

// :192 模型变化（含打开 / 切换编辑器）→ 文件段立即更新（breadcrumbsModel.ts:130-177），符号段重建。
watch(
    () => editorGroup.activeId,
    id => {
        lastActiveId = id;
        setBreadcrumbResource(getActiveEditorInput()?.resource ?? null);
        refreshSymbols();
    },
    { immediate: true }
);

// :193 语言变化 → 立即重建。
watch(
    () => getActiveEditorInput()?.languageId,
    () => refreshSymbols()
);

// :198-204 内容变化 → 防抖重建。切换模型本身不算内容变化（权威只订阅 editor 的内容事件），
// 因此活动编辑器已在本轮切换过时跳过。
watch(
    () => getActiveEditorInput()?.contentVersion,
    () => {
        if (editorGroup.activeId !== lastActiveId) return;
        scheduleSymbolRefresh(SYMBOL_CONTENT_DEBOUNCE);
    }
);

// :364-371 光标变化 → 150ms 防抖。首次触发改写初始态标记（见 refreshSymbols 的偏差说明）。
watch(
    () => [getActiveEditorInput()?.cursor?.lineNumber, getActiveEditorInput()?.cursor?.column],
    () => {
        cursorEverMoved = true;
        scheduleSymbolRefresh(SYMBOL_CURSOR_DEBOUNCE);
    }
);

watch(
    items,
    list => {
        updateBreadcrumbsActive();
        if (appState.breadcrumbsFocusedIndex >= list.length) appState.breadcrumbsFocusedIndex = -1;
        if (appState.breadcrumbsSelectedIndex >= list.length) appState.breadcrumbsSelectedIndex = -1;
    },
    { immediate: true }
);

let unregisterNodeProvider = () => {};

onMounted(() => {
    // 条目节点由本组件渲染，故由本组件提供（等价 widget.getItemDOMNode，见 breadcrumbs.js）。
    unregisterNodeProvider = registerBreadcrumbNodeProvider(itemNodes);
    updateBreadcrumbsActive();
});

onBeforeUnmount(() => {
    clearTimeout(symbolTimer);
    unregisterNodeProvider();
    updateBreadcrumbsActive();
});
</script>

<template>
    <div v-if="items.length" class="breadcrumbs-below-tabs">
        <div class="breadcrumbs-control">
            <div ref="rootEl" class="monaco-breadcrumbs show-file-icons" role="list" tabindex="0" @focusin="onFocusIn" @focusout="onFocusOut">
                <div
                    v-for="(item, index) in items"
                    :key="item.key"
                    class="monaco-breadcrumb-item"
                    :class="[{ focused: appState.breadcrumbsFocusedIndex === index, selected: appState.breadcrumbsSelectedIndex === index, 'shows-symbol-icon': item.kind === 'symbol' }, item.kind]"
                    role="listitem"
                    tabindex="-1"
                    @click="onClick(index, $event)">
                    <div class="monaco-icon-label" :class="iconClasses(item)">
                        <span v-if="item.icon" class="codicon outline-element-icon" :class="`codicon-${item.icon}`"></span>
                        <span class="label-name">{{ item.name }}</span>
                    </div>
                    <Codicon name="chevron-right" class="breadcrumb-separator" />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* .breadcrumbs-below-tabs > .breadcrumbs-control（editortitlecontrol.css:6-12） */
.breadcrumbs-below-tabs {
    display: flex;
    flex: 1 100%;
}

.breadcrumbs-control {
    flex: 1 100%;
    height: 22px;
    cursor: default;
}

/* .monaco-breadcrumbs（breadcrumbsWidget.css:6-14 + breadcrumbsWidget.ts:162-176 注入的配色） */
.monaco-breadcrumbs {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: flex-start;
    height: 100%;
    overflow: hidden;
    outline-style: none;
    user-select: none;
    -webkit-user-select: none;
    background-color: var(--vscode-breadcrumb-background);
}

/* .monaco-breadcrumb-item（breadcrumbsWidget.css:16-28 + editortitlecontrol.css:29-31） */
.monaco-breadcrumb-item {
    display: flex;
    align-items: center;
    align-self: center;
    flex: 0 1 auto;
    height: 100%;
    max-width: 80%;
    white-space: nowrap;
    outline: none;
    cursor: pointer;
    color: var(--vscode-breadcrumb-foreground);
}

/* 选中/聚焦配色（breadcrumbsWidget.ts:165-176 注入的选择器） */
.monaco-breadcrumb-item:hover:not(.focused):not(.selected) {
    color: var(--vscode-breadcrumb-focusForeground);
}

.monaco-breadcrumb-item.focused {
    color: var(--vscode-breadcrumb-focusForeground);
}

.monaco-breadcrumb-item.focused.selected {
    color: var(--vscode-breadcrumb-activeSelectionForeground);
}

/* breadcrumbscontrol.css:56-59 */
.monaco-breadcrumb-item.focused .monaco-icon-label,
.monaco-breadcrumb-item.selected .monaco-icon-label {
    text-decoration-line: underline;
}

/* 首项占位（breadcrumbsWidget.css:34-36 + editortitlecontrol.css:33-39） */
.monaco-breadcrumb-item::before {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 22px;
}

.monaco-breadcrumb-item:first-of-type::before {
    content: " ";
}

/* 图标标签（editortitlecontrol.css:14-21） */
.monaco-breadcrumbs .monaco-icon-label {
    height: 22px;
    line-height: 22px;
}

.monaco-breadcrumbs .monaco-icon-label::before {
    height: 22px;
}

.monaco-breadcrumbs .label-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* 末项（editortitlecontrol.css:41-47） */
.monaco-breadcrumb-item:last-child {
    padding-right: 8px;
}

.monaco-breadcrumb-item:last-child .codicon:last-child {
    display: none;
}

/* 分隔图标继承条目前景（breadcrumbsWidget.css:30-32） */
.breadcrumb-separator {
    color: inherit;
}

/* 符号段的 codicon（editortitlecontrol.css:23-27；符号图标的内边距见 breadcrumbscontrol.css:66-68） */
.outline-element-icon {
    padding-right: 3px;
    height: 22px;
    line-height: 22px;
}

.monaco-breadcrumb-item.shows-symbol-icon .codicon[class*="codicon-symbol-"] {
    padding-right: 6px;
}
</style>
