// 快速输入 / 快速打开的命令与快捷键。
//
// 权威来源（microsoft/vscode）：
//   workbench/browser/actions/quickAccessActions.ts:17-27    workbench.action.closeQuickOpen（Esc）
//   workbench/browser/actions/quickAccessActions.ts:29-47    workbench.action.acceptSelectedQuickOpenItem（Enter）
//   workbench/browser/actions/quickAccessActions.ts:25-29    globalQuickAccessKeybinding
//     （primary Ctrl/Cmd+P；secondary Ctrl/Cmd+E，mac 无 secondary）
//   workbench/browser/actions/quickAccessActions.ts:125-153  workbench.action.quickOpen（带可选 prefix 参数）
//   workbench/contrib/quickaccess/browser/quickAccess.contribution.ts:55-62  「命令面板…」菜单落点
//     （MenubarViewMenu / group '1_open' / order 1）
//   workbench/contrib/quickaccess/browser/quickAccess.contribution.ts  workbench.action.showCommands
//     （Ctrl+Shift+P，secondary F1，见 quickAccessActions.ts 里 showCommands 的键位声明）
//   platform/quickinput/browser/quickInputActions.ts:102-125 quickInput.* 导航命令与键位
//   workbench/browser/quickaccess.ts:20-22                   inQuickPickContext = has('inQuickOpen')
//   platform/quickinput/common/quickInput.ts                 quickInputFocus / quickInputType 上下文键
//
// 裁剪（登记在 docs/vscode-reference.md 第 5 节）：未迁移 quickNavigate（按住修饰键的快速跳转）、
// 分隔线导航（quickInput.nextSeparator*）、Ctrl+数字 定位第 N 项、Tab 焦点切到列表。
import { ContextKeyExpr } from "@/menu/contextKey.js";
import { MenuId } from "@/menu/menuId.js";
import { appendMenuItem, registerAction2 } from "@/menu/actions.js";
import { showQuickAccess } from "@/platform/quickinput/quickAccess.js";
import { QuickInputHideReason, QuickPickFocus, acceptQuickPick, focusQuickPick, hideQuickPick } from "@/platform/quickinput/quickInput.js";
import { registerAnythingQuickAccess } from "@/workbench/browser/quickaccess/anythingQuickAccess.js";
import { registerCommandsQuickAccess, COMMANDS_QUICK_ACCESS_PREFIX } from "@/workbench/contrib/quickaccess/browser/commandsQuickAccess.js";

// 注册提供者：默认（文件，空前缀）与命令（'>'）。必须在任何命令可被触发前完成。
registerAnythingQuickAccess();
registerCommandsQuickAccess();

// 对齐 workbench/browser/quickaccess.ts:22 的 inQuickPickContext 与
// platform/quickinput/browser/quickInputActions.ts:30-40 的 quickPick 上下文。
const inQuickOpen = ContextKeyExpr.has("inQuickOpen");
const quickPickFocused = ContextKeyExpr.and(inQuickOpen, ContextKeyExpr.equals("quickInputType", "quickPick"));

// quickAccessActions.ts:125-153：命令面板参数 prefix 为字符串时进入对应前缀的提供者并保留输入值；
// 缺省（Ctrl+P）则落到默认提供者且**不**保留上次输入（`preserveValue: false`）。
registerAction2({
    id: "workbench.action.quickOpen",
    // 动作标题取权威 quickAccessActions.ts:129 的 "Go to File..."（命令面板里显示的就是它）；
    // 「快速打开」是命令中心那个命令（quickOpenWithModes）的标题。
    title: "转到文件…",
    // quickAccessActions.ts:25-29 的 globalQuickAccessKeybinding：primary Ctrl+P，
    // secondary Ctrl+E（mac 的 Cmd+P 变体见 docs/vscode-reference.md 第 5 节）。
    keybinding: [{ primary: "Ctrl+P" }, { primary: "Ctrl+E" }],
    run(prefix) {
        showQuickAccess(typeof prefix === "string" ? prefix : undefined, {
            preserveValue: typeof prefix === "string"
        });
    }
});

// quickAccess.contribution.ts:55-62：命令面板在顶部「视图」菜单的首组首项（group '1_open' / order 1）；
// 同一命令在 MenubarHelpMenu:64-71 / GlobalActivity:91-98 / EditorContext:100-108 另有落点，
// 本仓库的取舍见 docs/vscode-reference.md 第 5 节。
registerAction2({
    id: "workbench.action.showCommands",
    // 动作标题取权威 commandsQuickAccess.ts:280 的 "Show All Commands"（命令面板里显示的就是它）；
    // 视图菜单那一项用菜单自己的标题「命令面板…」（见下方 appendMenuItem），两者在权威里也不同。
    title: "显示所有命令",
    keybinding: [{ primary: "Ctrl+Shift+P" }, { primary: "F1" }],
    run() {
        showQuickAccess(COMMANDS_QUICK_ACCESS_PREFIX);
    }
});

// 菜单项自带标题（菜单里的写法与动作标题不同），与权威一样走 appendMenuItem 而不是
// registerAction2 的 menu 描述符 —— 后者的 title 恒取动作标题。
appendMenuItem(MenuId.MenubarViewMenu, {
    command: { id: "workbench.action.showCommands", title: "命令面板…" },
    group: "1_open",
    order: 1
});

// 以下内部命令一律 `f1: false`：权威用 KeybindingsRegistry.registerCommandAndKeybindingRule 注册
// （`quickInputActions.ts:107-125`、`quickAccessActions.ts:17-27`、`:31-51`），不走 registerAction2，
// 因此不会出现在命令面板里；本仓库的 f1 开关等价表达这一点（`actions.js` 只把 f1 !== false 的动作
// 挂进 MenuId.CommandPalette，对齐 actions.ts:754-755）。用户可主动请求的三个命令
// （quickOpen / showCommands / quickOpenWithModes）不在其中，它们照常进命令面板。
// quickInputActions.ts:213-227：Enter 接受当前项。
registerAction2({
    id: "quickInput.accept",
    title: "接受当前项",
    f1: false,
    keybinding: { primary: "Enter", when: inQuickOpen },
    run: () => acceptQuickPick()
});

// quickAccessActions.ts:17-27：Esc 关闭（Ctrl/Cmd+Esc 为重开，本仓库未迁移）。
registerAction2({
    id: "workbench.action.closeQuickOpen",
    title: "关闭快速打开",
    f1: false,
    keybinding: { primary: "Escape", when: inQuickOpen },
    run() {
        hideQuickPick(QuickInputHideReason.Gesture);
    }
});

// quickInputActions.ts:102-125 的导航命令：键位与 QuickPickFocus 成员一一对应。
registerAction2({
    id: "quickInput.next",
    title: "下一项",
    f1: false,
    keybinding: { primary: "ArrowDown", when: quickPickFocused },
    run: () => focusQuickPick(QuickPickFocus.Next)
});

registerAction2({
    id: "quickInput.previous",
    title: "上一项",
    f1: false,
    keybinding: { primary: "ArrowUp", when: quickPickFocused },
    run: () => focusQuickPick(QuickPickFocus.Previous)
});

registerAction2({
    id: "quickInput.pageNext",
    title: "下一页",
    f1: false,
    keybinding: { primary: "PageDown", when: quickPickFocused },
    run: () => focusQuickPick(QuickPickFocus.NextPage)
});

registerAction2({
    id: "quickInput.pagePrevious",
    title: "上一页",
    f1: false,
    keybinding: { primary: "PageUp", when: quickPickFocused },
    run: () => focusQuickPick(QuickPickFocus.PreviousPage)
});

registerAction2({
    id: "quickInput.first",
    title: "第一项",
    f1: false,
    keybinding: { primary: "Ctrl+Home", when: quickPickFocused },
    run: () => focusQuickPick(QuickPickFocus.First)
});

registerAction2({
    id: "quickInput.last",
    title: "最后一项",
    f1: false,
    keybinding: { primary: "Ctrl+End", when: quickPickFocused },
    run: () => focusQuickPick(QuickPickFocus.Last)
});
