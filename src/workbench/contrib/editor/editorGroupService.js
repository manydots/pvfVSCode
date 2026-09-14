// 编辑器分组服务（对齐 VS Code workbench/browser/parts/editor/editorGroupView.ts 的
// EditorGroupView + EditorGroupModel）。
//
// 与 VS Code 一致：多个编辑器输入（EditorInput）共用一个 Monaco 编辑器部件，
// 切换标签时只替换 model 并恢复各自的视图状态（光标/滚动/折叠），而不是为每个标签建一个编辑器。
// 标签栏、状态栏、资源管理器「打开的编辑器」都从本服务的响应式状态派生。
import { reactive } from "vue";
import { URI } from "@/base/common/uri.js";
import { monaco } from "@/monaco/setup.js";
import { setActiveEditor as publishActiveEditor } from "@/menu/editorService.js";
import { getFirstLineText, resolveLanguageId } from "@/workbench/services/language/common/languageAssociations.js";
import { getRegisteredLanguageIds, setPreferredLanguageId } from "@/workbench/services/language/common/languageService.js";
import { getUnvalidatedEncoding } from "@/workbench/services/textfile/common/encoding.js";
import { createEncodingInput } from "@/workbench/services/textfile/browser/encodingInput.js";

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
    const content = input.content ?? "";
    // 语言解析：显式语言（非 plaintext）优先，否则按资源路径 + 首行识别
    // （对齐 workbench/common/editor/textEditorModel.ts:204-213 的 getOrCreateLanguage；
    // 未知/未注册的语言 id 回落 plaintext，见 languageService.resolveLanguageId）。
    const languageId = resolveLanguageId(input.resource, input.languageId, getFirstLineText(content), getRegisteredLanguageIds());
    // 资源作为模型 URI 传入：files.associations 变化后语言服务按该 URI 重新识别
    // （languageService.applyLanguageToOpenModels）。
    const model = monaco.editor.createModel(content, languageId, input.resource);
    // 语言不是从资源推出来的（显式指定，或该输入根本没有资源）时登记为偏好语言，
    // 使关联重算不改写它（对齐 textEditorModel.ts:116 的 preferredLanguageId）。
    if (input.languageId || !input.resource) {
        setPreferredLanguageId(model, languageId);
    }
    _models.set(input.id, model);

    const entry = reactive({
        id: input.id,
        name: input.name,
        description: input.description ?? "",
        // 资源随输入保留：面包屑的文件路径段、编码回落与语言关联都按 resource 取值
        // （EditorBreadcrumbs.vue 的 setBreadcrumbResource / breadcrumbs.js 的 fileItems）。
        resource: input.resource ?? null,
        languageId,
        // 编码：对齐 textFileService.ts:319-322 的 getEncoding ——
        // `model?.getEncoding() ?? encoding.getUnvalidatedEncodingForResource(resource)`。
        // 本仓库尚无文件服务，读取路径（PVF 归档解码）已定下的编码由调用方随 input.encoding 传入，
        // 等价于权威的 model.getEncoding()；未传则按 files.encoding 配置回落（默认 utf8）。
        // 取值为 SUPPORTED_ENCODINGS 的 key（如 utf8/utf8bom），状态栏据此查 labelShort
        // （editorStatus.ts:901-903），故不要在此处传 'utf-8' 这类别名。
        encoding: getUnvalidatedEncoding(input.encoding, createEncodingInput(input.resource)),
        insertSpaces: model.getOptions().insertSpaces,
        tabSize: model.getOptions().tabSize,
        eol: model.getEOL(),
        pinned: input.pinned ?? false,
        readOnly: input.readOnly ?? false,
        cursor: { lineNumber: 1, column: 1 },
        selectionLength: 0,
        // 内容版本号：符号消费方（面包屑）据此感知「模型内容变了，符号需要重取」。
        // 对齐 workbench/contrib/codeEditor/browser/outline/documentSymbolsOutline.ts:198-204
        // 的 editor.onDidChangeModelContent 触发源（权威按该事件重建 outline）。
        contentVersion: 0,
        savedVersionId: model.getAlternativeVersionId(),
        dirty: false
    });

    // 脏标记以 alternativeVersionId 判定：撤销回保存点时自动恢复为未修改（同 VS Code isDirty）。
    model.onDidChangeContent(() => {
        _updateDirty(entry, model);
        entry.contentVersion = model.getVersionId();
    });
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
// options 取 IEditorOptions / IEditorOpenOptions 里的两项（platform/editor/common/editor.ts:195
// preserveFocus、:234 pinned），语义同权威：
//   - preserveFocus：打开后不把焦点交给编辑器（editorGroupView.ts:1244 `activateGroup = !options?.preserveFocus`
//     —— 开着 preserveFocus 时只 restore、不 activate 分组），资源管理器的单击/键盘打开走这条路；
//   - pinned：非固定输入会被下一个非固定输入顶掉（platform/editor/common/editor.ts:227-233），
//     单击打开是预览态（pinned: false），双击/中键打开是固定态（pinned: true）。
export function openEditor(input, options = {}) {
    const existing = getEditorInput(input.id);
    if (existing) {
        if (typeof options.pinned === "boolean") existing.pinned = options.pinned;
        activateEditor(input.id, options);
        return existing;
    }
    const entry = _createEntry({ ...input, pinned: typeof options.pinned === "boolean" ? options.pinned : input.pinned });
    activateEditor(entry.id, options);
    return entry;
}

export function openUntitledEditor() {
    _untitledCounter += 1;
    const name = `Untitled-${_untitledCounter}`;
    // 无标题输入带 `untitled:` 资源（对齐 VS Code 的无标题资源 scheme）：
    // 语言服务据此跳过它的语言重算（applyLanguageToOpenModels），保留用户选定的语言模式。
    // 新建的无标题编辑器在 VS Code 中不是预览态，即固定标签。
    return openEditor({
        id: `untitled:${name}`,
        name,
        resource: URI.from({ scheme: "untitled", path: name }),
        content: "",
        pinned: true
    });
}

export function activateEditor(id, options = {}) {
    if (!getEditorInput(id)) return;
    const current = getActiveEditorInput();
    if (_pane && current && current.id !== id) {
        _viewStates.set(current.id, _pane.saveViewState());
    }
    editorGroup.activeId = id;
    _applyActiveModel();
    // preserveFocus 时不抢焦点（对齐 editorGroupView.ts:1238-1245：只 restore 不 activate）。
    if (!options.preserveFocus) _pane?.focus();
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
