// 编辑器分组服务（对齐 VS Code workbench/browser/parts/editor/editorGroupView.ts 的
// EditorGroupView + EditorGroupModel）。
//
// 与 VS Code 一致：多个编辑器输入（EditorInput）共用一个 Monaco 编辑器部件，
// 切换标签时只替换 model 并恢复各自的视图状态（光标/滚动/折叠），而不是为每个标签建一个编辑器。
// 标签栏、状态栏、资源管理器「打开的编辑器」都从本服务的响应式状态派生。
import { reactive } from "vue";
import { monaco } from "@/monaco/setup.js";
import { setActiveEditor as publishActiveEditor } from "@/menu/editorService.js";

// 打开顺序即标签顺序；activeId 为当前激活输入。
export const editorGroup = reactive({
    editors: [],
    activeId: null
});

const _models = new Map(); // editorId -> monaco ITextModel
const _viewStates = new Map(); // editorId -> ICodeEditorViewState
let _pane = null;
let _untitledCounter = 0;

// 语言 id -> codicon 名称。VS Code 标签页使用 Seti 文件图标；本仓库门控要求统一走
// codicon 字体（类名 codicon codicon-<id>），故此处按语言族映射到等价图标。
const LANGUAGE_ICONS = {
    json: "json",
    jsonc: "json",
    javascript: "file-code",
    typescript: "file-code",
    javascriptreact: "file-code",
    typescriptreact: "file-code",
    markdown: "file-code",
    plaintext: "file"
};

export function getEditorIcon(editor) {
    return LANGUAGE_ICONS[editor?.languageId] ?? "file";
}

export function getActiveEditorInput() {
    return editorGroup.editors.find(editor => editor.id === editorGroup.activeId) ?? null;
}

export function getEditorInput(id) {
    return editorGroup.editors.find(editor => editor.id === id) ?? null;
}

export function getModel(id) {
    return _models.get(id) ?? null;
}

export function getEditorPane() {
    return _pane;
}

// 注册 Monaco 编辑器部件，并把部件事件回写到当前输入的光标/选区状态。
export function attachEditorPane(pane) {
    _pane = pane;
    publishActiveEditor(pane);

    pane.onDidChangeCursorPosition(event => {
        const active = getActiveEditorInput();
        if (!active) return;
        active.cursor = { lineNumber: event.position.lineNumber, column: event.position.column };
    });

    pane.onDidChangeCursorSelection(event => {
        const active = getActiveEditorInput();
        if (!active) return;
        const model = _models.get(active.id);
        active.selectionLength = !event.selection.isEmpty() && model ? model.getValueInRange(event.selection).length : 0;
    });

    _applyActiveModel();
    return pane;
}

function _updateDirty(entry, model) {
    entry.dirty = model.getAlternativeVersionId() !== entry.savedVersionId;
    entry.eol = model.getEOL();
}

function _createEntry(input) {
    const languageId = input.languageId ?? "plaintext";
    const model = monaco.editor.createModel(input.content ?? "", languageId);
    _models.set(input.id, model);

    const entry = reactive({
        id: input.id,
        name: input.name,
        description: input.description ?? "",
        languageId,
        encoding: input.encoding ?? "utf-8",
        insertSpaces: model.getOptions().insertSpaces,
        tabSize: model.getOptions().tabSize,
        eol: model.getEOL(),
        pinned: input.pinned ?? false,
        readOnly: input.readOnly ?? false,
        cursor: { lineNumber: 1, column: 1 },
        selectionLength: 0,
        savedVersionId: model.getAlternativeVersionId(),
        dirty: false
    });

    // 脏标记以 alternativeVersionId 判定：撤销回保存点时自动恢复为未修改（同 VS Code isDirty）。
    model.onDidChangeContent(() => _updateDirty(entry, model));
    model.onDidChangeOptions(() => {
        entry.tabSize = model.getOptions().tabSize;
        entry.insertSpaces = model.getOptions().insertSpaces;
    });
    model.onDidChangeLanguage(event => {
        entry.languageId = event.newLanguage;
    });

    editorGroup.editors.push(entry);
    return entry;
}

function _applyActiveModel() {
    if (!_pane) return;
    const active = getActiveEditorInput();
    if (!active) {
        _pane.setModel(null);
        publishActiveEditor(null);
        return;
    }
    const model = _models.get(active.id) ?? null;
    _pane.setModel(model);
    _pane.updateOptions({ readOnly: active.readOnly });
    const viewState = _viewStates.get(active.id);
    if (viewState) _pane.restoreViewState(viewState);
}

// 打开（或激活已存在的）编辑器输入；input 结构见 _createEntry 与 editor.contribution.js。
export function openEditor(input) {
    const existing = getEditorInput(input.id);
    if (existing) {
        activateEditor(input.id);
        return existing;
    }
    const entry = _createEntry(input);
    activateEditor(entry.id);
    return entry;
}

export function openUntitledEditor() {
    _untitledCounter += 1;
    const id = `untitled:Untitled-${_untitledCounter}`;
    // 新建的无标题编辑器在 VS Code 中不是预览态，即固定标签。
    return openEditor({ id, name: `Untitled-${_untitledCounter}`, languageId: "plaintext", content: "", pinned: true });
}

export function activateEditor(id) {
    if (!getEditorInput(id)) return;
    const current = getActiveEditorInput();
    if (_pane && current && current.id !== id) {
        _viewStates.set(current.id, _pane.saveViewState());
    }
    editorGroup.activeId = id;
    _applyActiveModel();
    _pane?.focus();
}

// 关闭单个输入：优先激活右侧标签，否则左侧（对齐 VS Code 关闭后的激活策略）。
export function closeEditor(id) {
    const index = editorGroup.editors.findIndex(editor => editor.id === id);
    if (index < 0) return;
    editorGroup.editors.splice(index, 1);
    _viewStates.delete(id);
    _models.get(id)?.dispose();
    _models.delete(id);
    if (editorGroup.activeId === id) {
        const next = editorGroup.editors[index] ?? editorGroup.editors[index - 1] ?? null;
        editorGroup.activeId = next?.id ?? null;
        _applyActiveModel();
    }
}

export function closeEditors(ids) {
    for (const id of [...ids]) closeEditor(id);
}

export function closeOtherEditors(id) {
    closeEditors(editorGroup.editors.filter(editor => editor.id !== id).map(editor => editor.id));
}

export function closeAllEditors() {
    closeEditors(editorGroup.editors.map(editor => editor.id));
}

export function closeSavedEditors() {
    closeEditors(editorGroup.editors.filter(editor => !editor.dirty).map(editor => editor.id));
}

export function saveEditor(id) {
    const entry = getEditorInput(id);
    const model = _models.get(id);
    if (!entry || !model) return;
    entry.savedVersionId = model.getAlternativeVersionId();
    entry.dirty = false;
}

export function togglePinned(id) {
    const entry = getEditorInput(id);
    if (!entry) return;
    entry.pinned = !entry.pinned;
}

// 保存视图状态后分离部件（组件卸载时调用，避免遗留 Monaco 监听）。
export function detachEditorPane() {
    if (_pane) {
        const current = getActiveEditorInput();
        if (current) _viewStates.set(current.id, _pane.saveViewState());
    }
    _pane = null;
    publishActiveEditor(null);
}
