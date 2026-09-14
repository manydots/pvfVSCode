// 自动换行的「按模型临时覆盖」状态（对齐 <vscode>/src/vs/workbench/contrib/codeEditor/browser/toggleWordWrap.ts）。
//
// 权威语义（本文件逐条对齐，出处见各处注释）：
//   1. 切换的结果**不是**写配置项，而是给「当前模型」记一份临时覆盖
//      （writeTransientState / readTransientState，:44-54：状态存在 model 上，随模型生命周期消失）；
//   2. 覆盖落到编辑器上的是 wordWrapOverride2（'on' | 'off' | 'inherit'），
//      取值优先级 wordWrapOverride2 > wordWrapOverride1 > wordWrap（:171-177 与 editorOptions.ts:2922-2924）；
//   3. 菜单勾选态取 EDITOR_WORD_WRAP 上下文键，它由「活动编辑器实际是否换行」求出
//      （wrappingInfo.wrappingColumn !== -1，:294-305），不是配置值本身；
//   4. 另有 precondition CAN_TOGGLE_WORD_WRAP（:31、:356），由「有没有可切换的编辑器」求出；
//   5. 标签栏「…」的两条条目按 isDominatedByLongLines / isWordWrapMinified 决定是否出现（:320-345）。
//
// 未迁移的判定分支：canToggleWordWrap 里「简单控件（isSimpleWidget）」与「内联 diff 左侧编辑器」
// 两种情况在本仓库不存在（只有一个普通代码编辑器，没有 diff 编辑器），故略去 —— 见第 5 节偏差。

// EditorOption 取自 monaco 发行包中定义该枚举的模块：`EditorOption` 正是从这里导出
// （esm/vs/editor/standalone/browser/standaloneEditor.js:20、:475），取同一份枚举可避免为了拿一个
// 常量把整个编辑器内核（含 CSS 与 worker）拉进本模块 —— 无头测试因此能直接载入本模块。
// 与 <vscode> 的对应关系：权威从 editor/common/config/editorOptions.js 导入 EditorOption。
import { EditorOption } from "monaco-editor/editor/common/standalone/standaloneEnums.js";
import { contextKeys } from "@/menu/contextKey.js";

export const EDITOR_WORD_WRAP = "editorWordWrap";
export const CAN_TOGGLE_WORD_WRAP = "canToggleWordWrap";
export const IS_WORD_WRAP_MINIFIED = "isWordWrapMinified";
export const IS_DOMINATED_BY_LONG_LINES = "isDominatedByLongLines";

// 等价于 ICodeEditorService.setTransientModelProperty（权威把状态记在 model 上）：
// WeakMap 以模型对象为键，模型销毁后条目自动消失，与权威的生命周期一致。
const _transientState = new WeakMap();

// toggleWordWrap.ts:49-54
export function readTransientState(model) {
    if (!model) return null;
    return _transientState.get(model) ?? null;
}

export function writeTransientState(model, state) {
    if (!model) return;
    if (state) _transientState.set(model, state);
    else _transientState.delete(model);
}

// toggleWordWrap.ts:213-240 的简化（见文件头「未迁移的判定分支」）
export function canToggleWordWrap(editor) {
    if (!editor || typeof editor.getModel !== "function") return false;
    return !!editor.getModel();
}

// toggleWordWrap.ts:171-177：没有临时状态时写 'inherit'，即回到 editor.wordWrap 设置值。
export function applyWordWrapState(editor, model) {
    if (!editor) return;
    const state = readTransientState(model);
    editor.updateOptions({ wordWrapOverride2: state ? state.wordWrapOverride : "inherit" });
}

// toggleWordWrap.ts:78-99（ToggleWordWrapAction.run）：有临时状态则清除，否则按「当前实际状态取反」写入。
export function toggleWordWrap(editor) {
    if (!canToggleWordWrap(editor)) return;

    const model = editor.getModel();
    const transientState = readTransientState(model);

    let newState;
    if (transientState) {
        newState = null;
    } else {
        const wrappingInfo = editor.getOption(EditorOption.wrappingInfo);
        newState = { wordWrapOverride: wrappingInfo.wrappingColumn === -1 ? "on" : "off" };
    }

    writeTransientState(model, newState);
    applyWordWrapState(editor, model);
}

// toggleWordWrap.ts:286-310（EditorWordWrapContextKeyTracker._update / _updateFromCodeEditor）
// 与 :249-256（没有可切换的编辑器时两者都置 false）
export function refreshWordWrapContextKeys(editor) {
    if (!canToggleWordWrap(editor)) {
        contextKeys.set(CAN_TOGGLE_WORD_WRAP, false);
        contextKeys.set(EDITOR_WORD_WRAP, false);
        contextKeys.set(IS_WORD_WRAP_MINIFIED, false);
        contextKeys.set(IS_DOMINATED_BY_LONG_LINES, false);
        return;
    }

    const wrappingInfo = editor.getOption(EditorOption.wrappingInfo);
    contextKeys.set(CAN_TOGGLE_WORD_WRAP, true);
    contextKeys.set(EDITOR_WORD_WRAP, wrappingInfo.wrappingColumn !== -1);
    contextKeys.set(IS_WORD_WRAP_MINIFIED, wrappingInfo.isWordWrapMinified);
    contextKeys.set(IS_DOMINATED_BY_LONG_LINES, wrappingInfo.isDominatedByLongLines);
}
