// 活动编辑器服务：菜单/命令通过它与 Monaco 实例交互，避免直接依赖组件状态。

let _activeEditor = null;

export function setActiveEditor(editor) {
    _activeEditor = editor ?? null;
}

export function getActiveEditor() {
    return _activeEditor;
}

// 触发 Monaco 内置动作（EditorAction id，如 undo / actions.find / editor.action.gotoLine）。
export function triggerEditorAction(actionId, ...args) {
    if (!_activeEditor) return false;
    _activeEditor.trigger("menu", actionId, ...args);
    return true;
}
