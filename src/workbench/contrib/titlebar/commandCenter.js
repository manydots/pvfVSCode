// 命令中心的标签与悬浮提示（纯函数，便于 Node 侧验证）。
//
// 权威来源（microsoft/vscode）：`workbench/browser/parts/titlebar/commandCenterControl.ts`
//   - `CommandCenterQuickPickItem._getLabel()`（:216-235）：
//       label = windowTitle.workspaceName；
//       若 window.title 为自定义格式 → windowTitle.getWindowTitle()；否则若 showTabs === 'none' → fileName；
//       仍为空则回退 "Search"；再套上 windowTitle 的 prefix/suffix 装饰；最后把换行替换为 ⏎（U+23CE）。
//   - `CommandCenterCenterViewItem.getTooltip()`（:254-263）：
//       `Search {workspaceName} ({keybinding}) — {windowTitle}`，查不到快捷键时省略括号段。
//
// 裁剪（登记在 docs/vscode-reference.md 第 5 节）：本仓库没有 window.title 设置（恒为「工作区名 + 编辑器名」
// 的窗口标题）、没有 workbench.editor.showTabs 的 'none' 分支、也没有窗口标题装饰（dirty / 远程前缀等），
// 所以上面两条分支与 prefix/suffix 都不存在，函数只取「工作区名」与「窗口标题」两个入参。

// 换行在单行标签里以 ⏎ 显示（权威 :234 的 replaceAll(/\r\n|\r|\n/g, '\u23CE')）。
const LINE_BREAK = /\r\n|\r|\n/g;

// 命令中心圆角框里的文字：工作区名（本仓库即 appState.title）。
export function getCommandCenterLabel(workspaceName) {
    const label = String(workspaceName ?? "");
    return (label || "搜索").replaceAll(LINE_BREAK, "\u23CE");
}

// 悬浮提示：`搜索 {workspaceName} ({keybinding}) — {windowTitle}`。
export function getCommandCenterTooltip(workspaceName, windowTitle, keybindingLabel) {
    const kb = keybindingLabel ? ` (${keybindingLabel})` : "";
    return `搜索 ${workspaceName}${kb} — ${windowTitle}`;
}
