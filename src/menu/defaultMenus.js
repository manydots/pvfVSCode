// 默认菜单与命令注册（对齐 VS Code workbench/contrib 各 feature 的 *.contribution.ts）。
//
// 每个动作在此一次性声明命令实现、菜单落点与快捷键；编辑器类命令转发给 Monaco 内置动作，
// 视图类命令改写 appState（响应式）并同步上下文键，供菜单勾选态显示。

import { MenuId } from "@/menu/menuId.js";
import { appendMenuItem, registerAction2 } from "@/menu/actions.js";
import { ContextKeyExpr, contextKeys } from "@/menu/contextKey.js";
import { appState, setStatus } from "@/menu/appState.js";
import { triggerEditorAction, updateEditorOptions } from "@/menu/editorService.js";
import { openEditor } from "@/workbench/contrib/editor/editorGroupService.js";
import { WELCOME_TEXT } from "@/welcome.js";
import { DEFAULT_PREVIEW_FILE } from "@/defaultPreview.js";

// 编辑器类命令：转发 Monaco 内置动作（EditorAction id）。
// 标记为编辑器作用域：快捷键分发时要求 editorFocus（对齐 VS Code 编辑器命令的 when: editorFocus），
// 焦点在编辑器内时这些按键已由 Monaco 原生处理。
function editorAction(actionId) {
    const run = () => triggerEditorAction(actionId);
    run.editorScoped = true;
    return run;
}

// 顶部菜单栏根节点：挂载各子菜单。
function addMenubarItem(title, submenu, order) {
    appendMenuItem(MenuId.MenubarMainMenu, { title, submenu, order });
}
addMenubarItem("文件", MenuId.MenubarFileMenu, 1);
addMenubarItem("编辑", MenuId.MenubarEditMenu, 2);
addMenubarItem("选择", MenuId.MenubarSelectionMenu, 3);
addMenubarItem("视图", MenuId.MenubarViewMenu, 4);
addMenubarItem("转到", MenuId.MenubarGoMenu, 5);
// 「终端」：顺序 7，对齐 VS Code menubar.contribution.ts 中 Terminal 的 order（Go=5 / Terminal=7 / Help=8）。
addMenubarItem("终端", MenuId.MenubarTerminalMenu, 7);
addMenubarItem("帮助", MenuId.MenubarHelpMenu, 9);

// 归档能力尚未接入：以恒为假的上下文键让相关项置灰（而非给出无效按钮）。
const PVF_READY = ContextKeyExpr.has("pvfArchiveSupport");
const HAS_SELECTION = ContextKeyExpr.has("editorHasSelection");

// ---------------- 文件 ----------------
// 启动默认打开的编辑器输入：本仓库没有编辑器持久化，固定打开内置示例脚本
// （对齐 VS Code 启动时恢复编辑器输入的语义）。由 main.js 在挂载前调用，不挂菜单。
registerAction2({
    id: "pvf.openDefaultPreview",
    title: "打开默认预览文件",
    run() {
        openEditor(DEFAULT_PREVIEW_FILE);
        setStatus(`${DEFAULT_PREVIEW_FILE.name} · 默认预览文件`);
    }
});
registerAction2({
    id: "pvf.openArchive",
    title: "打开 PVF 归档…",
    keybinding: { primary: "Ctrl+O" },
    precondition: PVF_READY,
    menu: { id: MenuId.MenubarFileMenu, group: "1_new", order: 2 },
    run() {
        setStatus("PVF 归档解析将在下一阶段接入");
    }
});
registerAction2({
    id: "pvf.saveArchive",
    title: "保存归档",
    keybinding: { primary: "Ctrl+S" },
    precondition: PVF_READY,
    menu: { id: MenuId.MenubarFileMenu, group: "2_save", order: 1 },
    run() {
        setStatus("PVF 归档导出将在下一阶段接入");
    }
});
// 新建文件/关闭编辑器等编辑器类命令见 workbench/contrib/editor/editor.contribution.js。

// ---------------- 编辑 ----------------
registerAction2({
    id: "undo",
    title: "撤销",
    keybinding: { primary: "Ctrl+Z" },
    menu: { id: MenuId.MenubarEditMenu, group: "1_undo", order: 1 },
    run: editorAction("undo")
});
registerAction2({
    id: "redo",
    title: "重做",
    keybinding: [{ primary: "Ctrl+Y" }, { primary: "Ctrl+Shift+Z" }],
    menu: { id: MenuId.MenubarEditMenu, group: "1_undo", order: 2 },
    run: editorAction("redo")
});
registerAction2({
    id: "editor.action.clipboardCutAction",
    title: "剪切",
    keybinding: { primary: "Ctrl+X" },
    precondition: HAS_SELECTION,
    menu: { id: MenuId.MenubarEditMenu, group: "2_clipboard", order: 1 },
    run: editorAction("editor.action.clipboardCutAction")
});
registerAction2({
    id: "editor.action.clipboardCopyAction",
    title: "复制",
    keybinding: { primary: "Ctrl+C" },
    precondition: HAS_SELECTION,
    menu: { id: MenuId.MenubarEditMenu, group: "2_clipboard", order: 2 },
    run: editorAction("editor.action.clipboardCopyAction")
});
registerAction2({
    id: "editor.action.clipboardPasteAction",
    title: "粘贴",
    keybinding: { primary: "Ctrl+V" },
    menu: { id: MenuId.MenubarEditMenu, group: "2_clipboard", order: 3 },
    run: editorAction("editor.action.clipboardPasteAction")
});
registerAction2({
    id: "actions.find",
    title: "查找",
    keybinding: { primary: "Ctrl+F" },
    menu: { id: MenuId.MenubarEditMenu, group: "3_find", order: 1 },
    run: editorAction("actions.find")
});
registerAction2({
    id: "editor.action.startFindReplaceAction",
    title: "替换",
    keybinding: { primary: "Ctrl+H" },
    menu: { id: MenuId.MenubarEditMenu, group: "3_find", order: 2 },
    run: editorAction("editor.action.startFindReplaceAction")
});
registerAction2({
    id: "editor.action.commentLine",
    title: "切换行注释",
    keybinding: { primary: "Ctrl+/" },
    menu: { id: MenuId.MenubarEditMenu, group: "4_lines", order: 1 },
    run: editorAction("editor.action.commentLine")
});
registerAction2({
    id: "editor.action.deleteLines",
    title: "删除行",
    keybinding: { primary: "Ctrl+Shift+K" },
    menu: { id: MenuId.MenubarEditMenu, group: "4_lines", order: 2 },
    run: editorAction("editor.action.deleteLines")
});
registerAction2({
    id: "editor.action.copyLinesUpAction",
    title: "向上复制行",
    keybinding: { primary: "Shift+Alt+Up" },
    menu: { id: MenuId.MenubarEditMenu, group: "4_lines", order: 3 },
    run: editorAction("editor.action.copyLinesUpAction")
});
registerAction2({
    id: "editor.action.copyLinesDownAction",
    title: "向下复制行",
    keybinding: { primary: "Shift+Alt+Down" },
    menu: { id: MenuId.MenubarEditMenu, group: "4_lines", order: 4 },
    run: editorAction("editor.action.copyLinesDownAction")
});
registerAction2({
    id: "editor.action.moveLinesUpAction",
    title: "向上移动行",
    keybinding: { primary: "Alt+Up" },
    menu: { id: MenuId.MenubarEditMenu, group: "4_lines", order: 5 },
    run: editorAction("editor.action.moveLinesUpAction")
});
registerAction2({
    id: "editor.action.moveLinesDownAction",
    title: "向下移动行",
    keybinding: { primary: "Alt+Down" },
    menu: { id: MenuId.MenubarEditMenu, group: "4_lines", order: 6 },
    run: editorAction("editor.action.moveLinesDownAction")
});
registerAction2({
    id: "editor.action.formatDocument",
    title: "格式化文档",
    keybinding: { primary: "Shift+Alt+F" },
    menu: { id: MenuId.MenubarEditMenu, group: "5_format", order: 1 },
    run: editorAction("editor.action.formatDocument")
});

// ---------------- 选择 ----------------
registerAction2({
    id: "editor.action.selectAll",
    title: "全选",
    keybinding: { primary: "Ctrl+A" },
    menu: { id: MenuId.MenubarSelectionMenu, group: "1_select", order: 1 },
    run: editorAction("editor.action.selectAll")
});
registerAction2({
    id: "expandLineSelection",
    title: "展开行选择",
    keybinding: { primary: "Ctrl+L" },
    menu: { id: MenuId.MenubarSelectionMenu, group: "1_select", order: 2 },
    run: editorAction("expandLineSelection")
});
registerAction2({
    id: "editor.action.insertCursorAbove",
    title: "在上方添加光标",
    keybinding: { primary: "Ctrl+Alt+Up" },
    menu: { id: MenuId.MenubarSelectionMenu, group: "2_cursor", order: 1 },
    run: editorAction("editor.action.insertCursorAbove")
});
registerAction2({
    id: "editor.action.insertCursorBelow",
    title: "在下方添加光标",
    keybinding: { primary: "Ctrl+Alt+Down" },
    menu: { id: MenuId.MenubarSelectionMenu, group: "2_cursor", order: 2 },
    run: editorAction("editor.action.insertCursorBelow")
});
registerAction2({
    id: "editor.action.selectHighlights",
    title: "选择所有匹配项",
    keybinding: { primary: "Ctrl+Shift+L" },
    menu: { id: MenuId.MenubarSelectionMenu, group: "3_matches", order: 1 },
    run: editorAction("editor.action.selectHighlights")
});
registerAction2({
    id: "editor.action.addSelectionToNextFindMatch",
    title: "选择下一个匹配项",
    keybinding: { primary: "Ctrl+D" },
    menu: { id: MenuId.MenubarSelectionMenu, group: "3_matches", order: 2 },
    run: editorAction("editor.action.addSelectionToNextFindMatch")
});

// ---------------- 视图 ----------------
const SIDEBAR_VISIBLE = ContextKeyExpr.has("sidebarVisible");
const WORD_WRAP_ON = ContextKeyExpr.has("wordWrapOn");
const MINIMAP_ON = ContextKeyExpr.has("minimapOn");

registerAction2({
    id: "workbench.action.toggleSidebarVisibility",
    title: "显示/隐藏侧栏",
    keybinding: { primary: "Ctrl+B" },
    toggled: SIDEBAR_VISIBLE,
    menu: [
        { id: MenuId.MenubarViewMenu, group: "1_layout", order: 1 },
        { id: MenuId.LayoutControlMenu, group: "1_layout", order: 1 }
    ],
    run() {
        appState.sidebarVisible = !appState.sidebarVisible;
        setStatus(appState.sidebarVisible ? "已显示侧栏" : "已隐藏侧栏");
    }
});
registerAction2({
    id: "editor.action.toggleWordWrap",
    title: "切换自动换行",
    keybinding: { primary: "Alt+Z" },
    toggled: WORD_WRAP_ON,
    // Alt+Z 在编辑器内由 Monaco 原生处理（分发时被其 stopPropagation 拦截），
    // 编辑器外则走本命令；因此按 VS Code 归为编辑器作用域。
    editorScoped: true,
    menu: [
        { id: MenuId.MenubarViewMenu, group: "1_layout", order: 2 },
        { id: MenuId.LayoutControlMenu, group: "1_layout", order: 2 }
    ],
    run() {
        appState.wordWrap = !appState.wordWrap;
        updateEditorOptions({ wordWrap: appState.wordWrap ? "on" : "off" });
        setStatus(appState.wordWrap ? "已开启自动换行" : "已关闭自动换行");
    }
});
registerAction2({
    id: "editor.action.toggleMinimap",
    title: "切换缩略图",
    toggled: MINIMAP_ON,
    menu: [
        { id: MenuId.MenubarViewMenu, group: "1_layout", order: 3 },
        { id: MenuId.LayoutControlMenu, group: "1_layout", order: 3 }
    ],
    run() {
        appState.minimap = !appState.minimap;
        updateEditorOptions({ minimap: { enabled: appState.minimap } });
        setStatus(appState.minimap ? "已显示缩略图" : "已隐藏缩略图");
    }
});
registerAction2({
    id: "editor.action.fontZoomIn",
    title: "放大",
    keybinding: { primary: "Ctrl+=" },
    menu: { id: MenuId.MenubarViewMenu, group: "2_zoom", order: 1 },
    run: editorAction("editor.action.fontZoomIn")
});
registerAction2({
    id: "editor.action.fontZoomOut",
    title: "缩小",
    keybinding: { primary: "Ctrl+-" },
    menu: { id: MenuId.MenubarViewMenu, group: "2_zoom", order: 2 },
    run: editorAction("editor.action.fontZoomOut")
});
registerAction2({
    id: "editor.action.fontZoomReset",
    title: "重置缩放",
    menu: { id: MenuId.MenubarViewMenu, group: "2_zoom", order: 3 },
    run: editorAction("editor.action.fontZoomReset")
});

// ---------------- 转到 ----------------
// 命令 id 用 workbench.action.gotoLine（对齐 VS Code：状态栏「行/列」条目绑定该 id），
// 实现转发到 Monaco 的 editor.action.gotoLine。
registerAction2({
    id: "workbench.action.gotoLine",
    title: "转到行/列…",
    keybinding: { primary: "Ctrl+G" },
    menu: { id: MenuId.MenubarGoMenu, group: "1_navigate", order: 1 },
    run: editorAction("editor.action.gotoLine")
});
registerAction2({
    id: "editor.action.quickOutline",
    title: "转到符号…",
    keybinding: { primary: "Ctrl+Shift+O" },
    menu: { id: MenuId.MenubarGoMenu, group: "1_navigate", order: 2 },
    run: editorAction("editor.action.quickOutline")
});
registerAction2({
    id: "editor.action.jumpToBracket",
    title: "转到匹配括号",
    keybinding: { primary: "Ctrl+Shift+\\" },
    menu: { id: MenuId.MenubarGoMenu, group: "1_navigate", order: 3 },
    run: editorAction("editor.action.jumpToBracket")
});

// ---------------- 帮助 ----------------
registerAction2({
    id: "workbench.action.showWelcome",
    title: "欢迎",
    menu: { id: MenuId.MenubarHelpMenu, group: "1_help", order: 1 },
    run() {
        openEditor({ id: "welcome", name: "欢迎", languageId: "plaintext", content: WELCOME_TEXT, pinned: true });
        setStatus("Monaco 编辑器内核");
    }
});
registerAction2({
    id: "workbench.action.showAbout",
    title: "关于 pvfVSCode",
    menu: { id: MenuId.MenubarHelpMenu, group: "1_help", order: 2 },
    run() {
        setStatus("pvfVSCode — 面向 PVF 脚本的裁剪版 VS Code 客户端", 6000);
    }
});

// 初始化视图相关上下文键（与 appState 初值保持一致）。
contextKeys.set("sidebarVisible", appState.sidebarVisible);
contextKeys.set("wordWrapOn", appState.wordWrap);
contextKeys.set("minimapOn", appState.minimap);
contextKeys.set("activeViewContainer", appState.activeViewContainerId);
contextKeys.set("editorFocus", false);
contextKeys.set("editorHasSelection", false);
contextKeys.set("editorIsPinned", false);
contextKeys.set("editorIsDirty", false);
