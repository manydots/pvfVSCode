// 自动换行的动作与菜单落点（对齐 <vscode>/src/vs/workbench/contrib/codeEditor/browser/toggleWordWrap.ts）。
//
// 勾选态的来源：EDITOR_WORD_WRAP 上下文键（权威 :32、:354），由活动编辑器**实际**是否换行求出
// （wrappingInfo.wrappingColumn !== -1，:294-305）；启用条件取 CAN_TOGGLE_WORD_WRAP（:31、:356）。
// 注意与「切换缩略图」的区别：缩略图是配置项，勾选态即 config.editor.minimap.enabled 的值；
// 自动换行因为存在「按模型临时覆盖」的语义（:44-99），勾选态不能取配置值，只能用编辑器状态。
//
// 菜单落点（逐条对齐权威）：
//   - 视图菜单 group '6_editor' order 1（:350-359）；
//   - 标签栏的两条按需条目：group 'navigation' order 1，when 分别为
//     `isDominatedByLongLines && isWordWrapMinified` 与 `isDominatedByLongLines && !isWordWrapMinified`
//     （:320-345 用裸 appendMenuItem 手写描述符 —— 两条标题不同，且都不带 toggled）。
//
// 命令面板：权威的 ToggleWordWrapAction 是 EditorAction 且没有声明 MenuId.CommandPalette 的
// menuOpts（editorExtensions.ts:100-135 只在声明了 menuOpts 时注册菜单项），故 f1: false。
import { appendMenuItem, registerAction2 } from "@/menu/actions.js";
import { MenuId } from "@/menu/menuId.js";
import { ContextKeyExpr } from "@/menu/contextKey.js";
import { setStatus } from "@/menu/appState.js";
import { getActiveEditor } from "@/menu/editorService.js";
import {
    CAN_TOGGLE_WORD_WRAP,
    EDITOR_WORD_WRAP,
    IS_DOMINATED_BY_LONG_LINES,
    IS_WORD_WRAP_MINIFIED,
    readTransientState,
    refreshWordWrapContextKeys,
    toggleWordWrap
} from "@/workbench/contrib/codeEditor/wordWrapState.js";

// 初始值与权威一致：没有可切换的编辑器时四个键均为 false
// （toggleWordWrap.ts:249-256 的 else 分支 _setValues(false, false)）。
refreshWordWrapContextKeys(null);

registerAction2({
    id: "editor.action.toggleWordWrap",
    title: "切换自动换行",
    icon: "word-wrap",
    keybinding: { primary: "Alt+Z" },
    toggled: ContextKeyExpr.has(EDITOR_WORD_WRAP),
    precondition: ContextKeyExpr.has(CAN_TOGGLE_WORD_WRAP),
    // Alt+Z 在编辑器内由 Monaco 原生处理（分发时被其 stopPropagation 拦截），
    // 编辑器外则走本命令；因此按 VS Code 归为编辑器作用域。
    editorScoped: true,
    f1: false,
    menu: [
        { id: MenuId.MenubarViewMenu, group: "6_editor", order: 1 },
        // 标题栏布局控制菜单的落点：本仓库保留（权威只挂视图菜单与标签栏，见第 5 节偏差）。
        { id: MenuId.LayoutControlMenu, group: "1_layout", order: 2 }
    ],
    run() {
        const editor = getActiveEditor();
        toggleWordWrap(editor);
        // 临时状态写入后，权威由 ToggleWordWrapController 订阅
        // codeEditorService.onDidChangeTransientModelProperty 来应用到编辑器（:138）；
        // 本仓库没有该服务，且切换是唯一的写入方，故由动作直接驱动「应用 + 刷新上下文键」两步。
        refreshWordWrapContextKeys(editor);
        setStatus(readTransientState(editor?.getModel()) ? "已为此文件开启自动换行" : "已恢复该文件的自动换行设置");
    }
});

// 标签栏的两条按需条目（toggleWordWrap.ts:320-345）：只在「长行占主导」的文件上出现，
// 分别表示「当前被压缩成一行」与「当前未换行」两种状态。
// 权威第二条的 when 还带 `EditorContextKeys.inDiffEditor.negate()`；本仓库没有 diff 编辑器，
// 该子句恒真，故略去（见 docs/vscode-reference.md 第 5 节）。
const EDITOR_TITLE_GROUP = "navigation";
const EDITOR_TITLE_ORDER = 1;

appendMenuItem(MenuId.EditorTitle, {
    command: { id: "editor.action.toggleWordWrap", title: "为此文件禁用换行", icon: "word-wrap" },
    group: EDITOR_TITLE_GROUP,
    order: EDITOR_TITLE_ORDER,
    when: ContextKeyExpr.and(ContextKeyExpr.has(IS_DOMINATED_BY_LONG_LINES), ContextKeyExpr.has(IS_WORD_WRAP_MINIFIED))
});

appendMenuItem(MenuId.EditorTitle, {
    command: { id: "editor.action.toggleWordWrap", title: "为此文件启用换行", icon: "word-wrap" },
    group: EDITOR_TITLE_GROUP,
    order: EDITOR_TITLE_ORDER,
    when: ContextKeyExpr.and(ContextKeyExpr.has(IS_DOMINATED_BY_LONG_LINES), ContextKeyExpr.not(ContextKeyExpr.has(IS_WORD_WRAP_MINIFIED)))
});
