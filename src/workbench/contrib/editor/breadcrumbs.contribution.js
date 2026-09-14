// 面包屑命令与快捷键。
//
// 权威来源（microsoft/vscode）：
//   workbench/browser/parts/editor/breadcrumbsControl.ts:880-916  breadcrumbs.focusAndSelect
//     （Ctrl/Cmd+Shift+Period，when: breadcrumbsPossible）与 breadcrumbs.focus
//     （Ctrl/Cmd+Shift+Semicolon，when: breadcrumbsPossible）
//   workbench/browser/parts/editor/breadcrumbsControl.ts:918-935  breadcrumbs.toggleToOn
//   workbench/browser/parts/editor/breadcrumbsControl.ts:938-974  breadcrumbs.focusNext / focusPrevious
//     （左右方向键，when: breadcrumbsVisible && breadcrumbsActive）
//   workbench/browser/parts/editor/breadcrumbsControl.ts:975-1013 focusNextWithPicker / focusPreviousWithPicker
//     （Ctrl+左右，mac 为 Alt+左右；weight + 1，when: … && listFocus）—— 见下方「裁剪」
//   workbench/browser/parts/editor/breadcrumbsControl.ts:1014-1045 breadcrumbs.selectFocused
//     （Enter，secondary 下方向键）与 breadcrumbs.revealFocused（空格，secondary Ctrl+Enter）
//   workbench/browser/parts/editor/breadcrumbsControl.ts:1046-1057 breadcrumbs.selectEditor
//     （Escape，weight + 1，when: breadcrumbsVisible && breadcrumbsActive）
//   workbench/browser/parts/editor/breadcrumbsControl.ts:1058-1078 breadcrumbs.revealFocusedFromTreeAside
//     （Ctrl+Enter，when: … && listFocus）
//   workbench/browser/parts/editor/breadcrumbsControl.ts:1096-1125 breadcrumbs.openInSideGroup
//   workbench/browser/parts/editor/breadcrumbsControl.ts:726-728  `_updateCkBreadcrumbsActive`
//     （上下文键口径：部件持有 DOM 焦点 或 picker 正在显示，见 breadcrumbs.js）
//   platform/editor/common/editor.ts:227-233  `pinned` 的语义（预览态/固定态）
//
// 裁剪（登记在 docs/vscode-reference.md 第 5 节）：
//   1. 上游另有 breadcrumbs.toggleToOn（Ctrl+Shift+Period 在 `config.breadcrumbs.enabled` 关闭时的分支），
//      本仓库没有面包屑开关配置，故未迁移；
//   2. `*WithPicker`（Ctrl/Alt + 左右）与 `revealFocusedFromTreeAside`（Ctrl+Enter）的 when 里含
//      `listFocus` 与 weight + 1 的优先级，而本仓库的快捷键分发（src/menu/keybindingService.js）
//      既没有 listFocus 上下文键也没有 weight —— 这两组按键由浮层自身在「列表持有焦点」时处理
//      （BreadcrumbsPicker.vue 的 keydown：Ctrl/Cmd + 左右 = 切到上/下一段并重新打开选择器），
//      语义与命令一致，落点不同；
//   3. breadcrumbs.openInSideGroup / Payload_RevealAside 在本仓库没有第二个编辑器分组，恒不生效；
//   4. breadcrumbs.toggle（:832-878，面包屑总开关）与 `config.breadcrumbs.enabled` 未迁移
//      —— 本仓库的面包屑恒显示；
//   5. breadcrumbs.copyPath（:1101-1140：命令面板 + 编辑器标题上下文菜单 `1_cutcopypaste`，
//      无快捷键）未迁移 —— 依赖剪贴板服务与 `breadcrumbs.symbolPathSeparator` 设置（本仓库均无）；
//   6. `breadcrumbs.useQuickPick`（breadcrumbs.ts:70，默认 false）的分支未迁移：权威在该项为真时
//      改用快速输入（`'@'` 显示符号、`''` 显示文件）而不弹自绘浮层（:633-638）。
import { registerAction2 } from "@/menu/actions.js";
import { ContextKeyExpr } from "@/menu/contextKey.js";
import { BREADCRUMB_PAYLOAD, clearBreadcrumbFocusAndSelection, focusBreadcrumbs, focusEditorPane, focusNextBreadcrumb, focusPrevBreadcrumb, setSelectedBreadcrumb } from "@/workbench/contrib/editor/breadcrumbs.js";
import { relayoutBreadcrumbsPicker } from "@/workbench/contrib/editor/breadcrumbsControl.js";
import { appState } from "@/menu/appState.js";

const possible = ContextKeyExpr.has("breadcrumbsPossible");
const visible = ContextKeyExpr.has("breadcrumbsVisible");
const active = ContextKeyExpr.has("breadcrumbsActive");
const visibleAndActive = ContextKeyExpr.and(visible, active);

// 只有 focusAndSelect / focus 两条例外（权威给了 f1: true），其余命令都是纯快捷键命令
// （`KeybindingsRegistry.registerCommandAndKeybindingRule` 不追加命令面板菜单项）。
registerAction2({
    id: "breadcrumbs.focusAndSelect",
    title: "聚焦并选择面包屑",
    precondition: visible,
    keybinding: { primary: "Ctrl+Shift+.", when: possible },
    run: () => focusBreadcrumbs(true)
});

registerAction2({
    id: "breadcrumbs.focus",
    title: "聚焦面包屑",
    precondition: visible,
    keybinding: { primary: "Ctrl+Shift+;", when: possible },
    run: () => focusBreadcrumbs(false)
});

registerAction2({
    id: "breadcrumbs.focusNext",
    title: "聚焦下一个面包屑",
    f1: false,
    keybinding: { primary: "ArrowRight", when: visibleAndActive },
    run: () => focusNextBreadcrumb()
});

registerAction2({
    id: "breadcrumbs.focusPrevious",
    title: "聚焦上一个面包屑",
    f1: false,
    keybinding: { primary: "ArrowLeft", when: visibleAndActive },
    run: () => focusPrevBreadcrumb()
});

// breadcrumbsControl.ts:1014-1030：`widget.setSelection(widget.getFocused(), Payload_Pick)`
// —— 键盘触发的选中带 Pick payload，控件据此打开浮层而不是跳转（见 breadcrumbsControl.js）。
registerAction2({
    id: "breadcrumbs.selectFocused",
    title: "选择聚焦的面包屑",
    f1: false,
    keybinding: { primary: "Enter", when: visibleAndActive },
    run: () => setSelectedBreadcrumb(appState.breadcrumbsFocusedIndex, BREADCRUMB_PAYLOAD.Pick)
});

// breadcrumbsControl.ts:1031-1045：空格 → Payload_Reveal（直接跳转，不打开浮层）。
registerAction2({
    id: "breadcrumbs.revealFocused",
    title: "跳转到聚焦的面包屑",
    f1: false,
    keybinding: { primary: "Space", when: visibleAndActive },
    run: () => setSelectedBreadcrumb(appState.breadcrumbsFocusedIndex, BREADCRUMB_PAYLOAD.Reveal)
});

// breadcrumbsControl.ts:1046-1057：清焦点与选中后把焦点交回编辑器 —— 浮层随之失焦隐藏
// （权威随后由 `_revealInEditor` 之外的编辑器聚焦逻辑接管）。
registerAction2({
    id: "breadcrumbs.selectEditor",
    title: "焦点回到编辑器",
    f1: false,
    keybinding: { primary: "Escape", when: visibleAndActive },
    run: () => {
        clearBreadcrumbFocusAndSelection();
        focusEditorPane();
    }
});

// 窗口尺寸变化后重算浮层的竖直落点（contextview.ts:324-337 的 layout() → :339-366 的 doLayout()：
// 用缓存的锚点重跑 layout2d，浮层尺寸不重算）。
window.addEventListener("resize", relayoutBreadcrumbsPicker);
