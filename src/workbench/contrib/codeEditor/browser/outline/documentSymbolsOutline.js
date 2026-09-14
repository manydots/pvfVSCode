// 文档符号大纲的「取数 + 预览 + 跳转 + 视图状态」句柄（面包屑选择器与后续大纲面板共用）。
//
// 权威来源（microsoft/vscode）：
//   workbench/contrib/codeEditor/browser/outline/documentSymbolsOutline.ts:130-186  DocumentSymbolsOutline 的 config
//     （treeDataSource：`parent === this` 时取 `_outlineModel.children`，其余取 `parent.children`）
//   workbench/contrib/codeEditor/browser/outline/documentSymbolsOutline.ts:226-240  reveal()
//     （options + `selection: Range.collapseToStart(symbol.selectionRange)` +
//      `selectionRevealType: TextEditorSelectionRevealType.NearTopIfOutsideViewport`）
//   workbench/contrib/codeEditor/browser/outline/documentSymbolsOutline.ts:242-260  preview()
//     （revealRangeInCenterIfOutsideViewport(range, Smooth) + `.rangeHighlight` 装饰，isWholeLine: true）
//   workbench/contrib/codeEditor/browser/outline/documentSymbolsOutline.ts:262-269  captureViewState()/restoreViewState
//   workbench/contrib/codeEditor/browser/outline/documentSymbolsOutline.ts:271-300  _createOutline（getOrCreate + 版本变化重建）
//
// 裁剪与替代（登记在 docs/vscode-reference.md 第 5 节）：
//   1. 权威经 `ICodeEditorService.openCodeEditor({ options: { selection, selectionRevealType } })` 跳转；
//      monaco 发行包的 standaloneCodeEditorService 忽略 `selectionRevealType`，
//      故改为等价的两次调用：`editor.setSelection(Range.collapseToStart(selectionRange))` +
//      `editor.revealRangeNearTopIfOutsideViewport(...)`（同 `workbench/browser/parts/editor/textEditor.ts:307-312`
//      里 `codeEditor.setSelection` 与随后的 reveal 组合）。
//   2. `OutlineModel.get(entry)` / `OutlineModel.getItemEnclosingPosition` 未从发行包导出，
//      元素归属的模型 uri 与「光标所在元素」分别由调用方传入的 model 与
//      `@/monaco/outlinePath.js` 的 collectPath 提供。
import { StandaloneServices } from "monaco-editor/editor/standalone/browser/standaloneServices.js";
import { IOutlineModelService } from "monaco-editor/editor/contrib/documentSymbols/browser/outlineModel.js";
import { Range } from "monaco-editor/editor/common/core/range.js";
// ScrollType 在权威仓库位于 editor/common/editorCommon.ts，发行包把枚举统一搬到
// editor/common/standalone/standaloneEnums.js（editorCommon.js 只剩 EditorType），故从这里取。
import { ScrollType } from "monaco-editor/editor/common/standalone/standaloneEnums.js";
import { CancellationToken } from "monaco-editor/base/common/cancellation.js";

/**
 * 取（或重建）该模型的 outline。`OutlineModelService.getOrCreate` 按 `textModel.getVersionId()`
 * 校验缓存（monaco 发行包 outlineModel.js:218），版本变化即重建。
 * @param {import("monaco-editor").editor.ITextModel} model
 * @returns {Promise<any|null>} monaco 的 OutlineModel（children 为 Map，可能已 _compact）
 */
export async function getDocumentSymbolsOutline(model) {
    if (!model) return null;
    try {
        return (await StandaloneServices.get(IOutlineModelService).getOrCreate(model, CancellationToken.None)) ?? null;
    } catch {
        // provider 抛错时按「没有符号」处理（权威 onUnexpectedExternalError + 空 outline 等价）
        return null;
    }
}

export function isOutlineElement(node) {
    return Boolean(node?.symbol);
}

export function outlineChildren(node) {
    return node?.children ? [...node.children.values()] : [];
}

/** 自元素向上直到 outline 根的祖先链（不含元素自身）。用于按需展开路径与「展开第一层子节点」。 */
export function outlineAncestors(element) {
    const chain = [];
    let current = element?.parent;
    while (current && current.symbol === undefined && current.parent !== undefined) {
        chain.push(current);
        current = current.parent;
    }
    return chain;
}

/**
 * 预览：把符号体高亮并滚到视口中央（documentSymbolsOutline.ts:242-260）。
 * 返回一个清除函数（等价于权威返回的 toDisposable(() => decorationsCollection.clear())）。
 * @param {import("monaco-editor").editor.ICodeEditor} editor
 * @param {any} element
 */
export function previewSymbol(editor, element) {
    if (!editor || !isOutlineElement(element)) return () => {};
    const { symbol } = element;
    editor.revealRangeInCenterIfOutsideViewport(symbol.range, ScrollType.Smooth);
    const decorations = editor.createDecorationsCollection([
        {
            range: symbol.range,
            options: {
                description: "document-symbols-outline-range-highlight",
                className: "rangeHighlight",
                isWholeLine: true
            }
        }
    ]);
    return () => decorations.clear();
}

/**
 * 跳转（documentSymbolsOutline.ts:226-240）：选中折叠到起点的位置，并把视口挪到该行。
 * `select` 为真时选中整个符号体（权威 `select ? entry.symbol.range : Range.collapseToStart(...)`）。
 * @param {import("monaco-editor").editor.ICodeEditor} editor
 * @param {any} element
 * @param {{ select?: boolean, focus?: boolean }} [options]
 */
export function revealSymbol(editor, element, { select = false, focus = true } = {}) {
    if (!editor || !isOutlineElement(element)) return false;
    const range = select ? element.symbol.range : Range.collapseToStart(element.symbol.selectionRange);
    editor.setSelection(range);
    editor.revealRangeNearTopIfOutsideViewport(range, ScrollType.Smooth);
    if (focus) editor.focus();
    return true;
}

/**
 * 视图状态：取编辑器当前视图状态，返回一个还原函数
 * （documentSymbolsOutline.ts:262-269 的 captureViewState / restoreViewState）。
 * @param {import("monaco-editor").editor.ICodeEditor} editor
 */
export function captureEditorViewState(editor) {
    if (!editor) return () => {};
    const viewState = editor.saveViewState();
    return () => {
        if (viewState) editor.restoreViewState(viewState);
    };
}
