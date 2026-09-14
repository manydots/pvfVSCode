// 命令中心的菜单与动作注册（对齐 VS Code 的两处权威贡献）。
//
// 权威来源（microsoft/vscode）：
//   workbench/browser/parts/titlebar/commandCenterControl.ts:266-271
//     MenuRegistry.appendMenuItem(MenuId.CommandCenter, { submenu: MenuId.CommandCenterCenter,
//       title: "Command Center", icon: Codicon.shield, order: 101 })
//   workbench/browser/actions/quickAccessActions.ts:156-165
//     registerAction2({ id: "workbench.action.quickOpenWithModes", title: "Quick Open",
//       icon: Codicon.search, menu: { id: MenuId.CommandCenterCenter, order: 100 } })
//
// 裁剪（登记在 docs/vscode-reference.md 第 5 节）：快速输入只迁移了默认（文件）与「>」（命令）
// 两个提供者；`chat.unifiedAgentsBar.enabled` 分支（统一快速访问）本仓库没有对应部件，恒走
// 经典分支 openClassicQuickAccess。权威也没有给该命令绑快捷键（Ctrl+P 属于
// workbench.action.quickOpen，见 menu/quickInput.contribution.js），命令中心提示因此不带快捷键段。
import { MenuId } from "@/menu/menuId.js";
import { appendMenuItem, registerAction2 } from "@/menu/actions.js";
import { showQuickAccess } from "@/platform/quickinput/quickAccess.js";

// 中心项：MenuId.CommandCenter 工具栏里指向 MenuId.CommandCenterCenter 的子菜单项，
// 由 workbench/contrib/titlebar/CommandCenter.vue 渲染成中间的圆角框。
appendMenuItem(MenuId.CommandCenter, {
    title: "命令中心",
    submenu: MenuId.CommandCenterCenter,
    icon: "shield",
    order: 101
});

// 圆角框里承载「快速打开」的动作项（id 与权威一致，见 CommandCenter.vue 的 QUICK_OPEN_ID）。
registerAction2({
    id: "workbench.action.quickOpenWithModes",
    title: "快速打开",
    icon: "search",
    menu: { id: MenuId.CommandCenterCenter, order: 100 },
    run() {
        // 对齐 quickAccessActions.ts:167-190 的 openClassicQuickAccess()：
        // quickAccess.show(undefined, { preserveValue, providerOptions: { includeHelp, from: 'commandCenter' } })
        showQuickAccess(undefined, { preserveValue: true, providerOptions: { includeHelp: true, from: "commandCenter" } });
    }
});
