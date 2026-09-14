// 文档符号 → 面包屑的符号段。
//
// 权威来源（microsoft/vscode）：
//   workbench/browser/parts/editor/breadcrumbsModel.ts:100-128  文件段 + 符号段组装
//     （symbolPath 为 'off' 时不取符号，'last' 时只取最后一个符号）
//   workbench/browser/parts/editor/breadcrumbsModel.ts:194-204  outline 作为符号来源
//   workbench/browser/parts/editor/breadcrumbsControl.ts:157-171 符号段的图标与 selected/focused 类
//   符号 → codicon 的映射：editor/common/languages.ts 的 SymbolKinds.toIcon
//
// 符号数据不新造协议：monaco 发行包自带 outline 模型服务
// （editor/contrib/documentSymbols/browser/outlineModel.js），由已注册的 DocumentSymbolProvider
// 驱动（Squirrel 提供者见 extensions/pvf/browser/pvfExtension.js，语言服务提供者由各自 contribution 注册）。
//
// 触发源（见 AGENTS.md §4.4）：光标位置（本文件被 EditorBreadcrumbs.vue 的 150ms 防抖监听调用）
// 与活动编辑器切换；**不订阅滚动** —— 与权威一致（documentSymbolsOutline.ts:364-371），
// 滚动时显示当前作用域由粘性滚动承担（editor/contrib/stickyScroll）。
import { StandaloneServices } from "monaco-editor/editor/standalone/browser/standaloneServices.js";
import { IOutlineModelService } from "monaco-editor/editor/contrib/documentSymbols/browser/outlineModel.js";
import { CancellationToken } from "monaco-editor/base/common/cancellation.js";
import { collectPath } from "@/monaco/outlinePath.js";

/**
 * 返回光标所在位置的符号链与它所属的 outline 模型。
 *
 * 权威的符号段来自 `outline`（breadcrumbsModel.ts:100-128 经 `_currentOutline.breadcrumbsDataSource`
 * 取元素链），而 picker 需要的是 **整棵 outline**（breadcrumbsPicker.ts:487-501 把 outline 作为树输入），
 * 故这里两者一并返回：`elements` 供面包屑条目渲染，`outline` 供选择器取全部行。
 * 语言服务未提供符号时 `elements` 为空数组（此时面包屑只有文件路径段，与 VS Code 一致）。
 *
 * @returns {Promise<{ outline: any|null, elements: any[] }>}
 */
export async function getSymbolBreadcrumbs(model, position) {
    if (!model || !position) return { outline: null, elements: [] };
    let outline;
    try {
        outline = await StandaloneServices.get(IOutlineModelService).getOrCreate(model, CancellationToken.None);
    } catch {
        return { outline: null, elements: [] };
    }
    if (!outline) return { outline: null, elements: [] };

    const path = [];
    collectPath(outline, position, path);
    return { outline, elements: path };
}
