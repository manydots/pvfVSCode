// 底部面板贡献（对齐 VS Code 各面板视图容器的注册与 workbench/browser/parts/panel/panelActions.ts）。
//
// 容器顺序与 VS Code 一致：问题(0) / 输出(1) / 调试控制台(2) / 终端(3) / 端口(5)，
// 均注册在 ViewContainerLocation.Panel；切换器与内容区由 PanelPart 渲染。
import { MenuId } from "@/menu/menuId.js";
import { registerAction2 } from "@/menu/actions.js";
import { ContextKeyExpr, contextKeys } from "@/menu/contextKey.js";
import { appState, setStatus } from "@/menu/appState.js";
import { ViewContainerLocation, registerViewContainer, registerViews } from "@/workbench/viewsRegistry.js";
import { showPanelContainer } from "@/workbench/viewService.js";
import EmptyView from "@/base/views/EmptyView.vue";
import OutputView from "@/workbench/contrib/panel/views/OutputView.vue";
import TerminalView from "@/workbench/contrib/panel/views/TerminalView.vue";

export const PROBLEMS_CONTAINER_ID = "workbench.panel.markers";
export const OUTPUT_CONTAINER_ID = "workbench.panel.output";
export const DEBUG_CONSOLE_CONTAINER_ID = "workbench.panel.repl";
export const TERMINAL_CONTAINER_ID = "workbench.panel.terminal";
export const PORTS_CONTAINER_ID = "workbench.panel.ports";
export const TERMINAL_VIEW_ID = "workbench.panel.terminal";

const containers = [
    { id: PROBLEMS_CONTAINER_ID, title: "问题", order: 0, viewId: "workbench.panel.markers.view", component: EmptyView, props: { icon: "error", message: "尚未在工作区中检测到问题。" } },
    { id: OUTPUT_CONTAINER_ID, title: "输出", order: 1, viewId: "workbench.panel.output.view", component: OutputView },
    {
        id: DEBUG_CONSOLE_CONTAINER_ID,
        title: "调试控制台",
        order: 2,
        viewId: "workbench.panel.repl.view",
        component: EmptyView,
        props: { icon: "debug-alt", message: "调试会话未启动。", hint: "启动调试会话后可在此求值表达式。" }
    },
    { id: TERMINAL_CONTAINER_ID, title: "终端", order: 3, viewId: TERMINAL_VIEW_ID, component: TerminalView },
    {
        id: PORTS_CONTAINER_ID,
        title: "端口",
        order: 5,
        viewId: "workbench.panel.ports.view",
        component: EmptyView,
        props: { icon: "plug", message: "未转发任何端口。", hint: "转发端口后将在此列出。" }
    }
];

for (const descriptor of containers) {
    const container = registerViewContainer({ id: descriptor.id, title: descriptor.title, icon: descriptor.icon, order: descriptor.order }, ViewContainerLocation.Panel);
    registerViews([{ id: descriptor.viewId, name: descriptor.title, order: 0, component: descriptor.component, props: descriptor.props }], container);
}

const PANEL_VISIBLE = ContextKeyExpr.has("panelVisible");
const PANEL_MAXIMIZED = ContextKeyExpr.has("panelMaximized");
const TERMINAL_VIEW_ACTIVE = ContextKeyExpr.equals("view", TERMINAL_VIEW_ID);

// 终端视图的标题动作（对齐 terminalMenus.ts 贡献到 MenuId.ViewTitle 的 navigation 组）：
// 新建 order 0 / 拆分 order 2 / 杀掉 order 3 内联显示，清空 order 6 与「运行活动文件」
// order 7 标记 isHiddenByDefault，收进标题栏的「…」溢出菜单。
// 终端服务（pty）接入前，命令给出说明性反馈。
registerAction2({
    id: "workbench.action.terminal.new",
    title: "新建终端",
    icon: "add",
    menu: { id: MenuId.ViewTitle, group: "navigation", order: 0, when: TERMINAL_VIEW_ACTIVE },
    run() {
        setStatus("终端服务将在后续接入");
    }
});

registerAction2({
    id: "workbench.action.terminal.split",
    title: "拆分终端",
    icon: "split-horizontal",
    menu: { id: MenuId.ViewTitle, group: "navigation", order: 2, when: TERMINAL_VIEW_ACTIVE },
    run() {
        setStatus("终端拆分将在终端服务接入后可用");
    }
});

registerAction2({
    id: "workbench.action.terminal.kill",
    title: "杀掉终端",
    icon: "trash",
    menu: { id: MenuId.ViewTitle, group: "navigation", order: 3, when: TERMINAL_VIEW_ACTIVE },
    run() {
        setStatus("终端服务将在后续接入");
    }
});

registerAction2({
    id: "workbench.action.terminal.clear",
    title: "清空终端",
    icon: "clear-all",
    menu: { id: MenuId.ViewTitle, group: "navigation", order: 6, when: TERMINAL_VIEW_ACTIVE, isHiddenByDefault: true },
    run() {
        setStatus("终端服务将在后续接入");
    }
});

registerAction2({
    id: "workbench.action.terminal.runActiveFile",
    title: "运行活动文件",
    icon: "run",
    menu: { id: MenuId.ViewTitle, group: "navigation", order: 7, when: TERMINAL_VIEW_ACTIVE, isHiddenByDefault: true },
    run() {
        setStatus("终端服务将在后续接入");
    }
});

// 终端面板显示/隐藏：Ctrl+`。
// 来源：terminal.contribution.ts 的 openCommandActionDescriptor（id=TerminalCommandId.Toggle，
// order 3）经 viewsService.ts 的 registerOpenViewContainerAction 自动生成动作：
//   if (!isViewContainerVisible(终端) || !hasFocus(Panel)) openViewContainer(终端, true);
//   else closeViewContainer(终端);
// 即「终端已是活动容器 **且面板有焦点**」才收起，否则打开终端并聚焦。
//
// 本仓库近似：以「面板可见 且 活动容器==终端」代替「活动容器==终端 且 面板有焦点」，
// 少了焦点维度（详见 docs/vscode-reference.md 第 5 节偏差表）。差别在可感知处：
// 面板可见、停在终端、但焦点在编辑器时，VS Code 会先去聚焦终端，本仓库会直接收起。
// 焦点数据其实已在 appState.panelFocused（PanelPart.vue 的 focusin/focusout），
// 只差同步进 contextKeys 并用于这里的判据。
//
// 刻意不声明 toggled：OpenCommandActionDescriptor 的类型（common/views.ts:53-59）
// 根本没有 toggled 字段，生成的 Action2 描述符里也没有（viewsService.ts:407-425），
// 因此 VS Code 里这条命令在菜单中**不带勾选框**。此前这里写成
// `ContextKeyExpr.and(PANEL_VISIBLE, equals("activePanel", 终端))`，其条件蕴含 PANEL_VISIBLE，
// 导致面板停在终端时「切换终端」与「切换面板」必然同时打勾（用户报告的现象）。
// 复述一遍门控口径：勾选态只能来自权威源码，不得为了「看起来更丰富」自造。
registerAction2({
    id: "workbench.action.terminal.toggleTerminal",
    title: "切换终端",
    keybinding: { primary: "Ctrl+`" },
    menu: [
        // 「终端」菜单第二组：切到终端容器（与 Ctrl+` 同一条命令，仅增加菜单落点）。
        // 不挂 MenubarViewMenu：顶部菜单栏内同一功能只允许出现一次（避免「终端」与「视图」重复）。
        { id: MenuId.MenubarTerminalMenu, group: "3_terminal", order: 1 }
    ],
    run() {
        if (appState.panelVisible && appState.activePanelId === TERMINAL_CONTAINER_ID) {
            appState.panelVisible = false;
            setStatus("已隐藏终端");
            return;
        }
        showPanelContainer(TERMINAL_CONTAINER_ID);
        setStatus("已显示终端");
    }
});

// 面板显示/隐藏（Ctrl+J，对齐 TogglePanelAction）。
registerAction2({
    id: "workbench.action.togglePanel",
    title: "切换面板",
    keybinding: { primary: "Ctrl+J" },
    toggled: PANEL_VISIBLE,
    menu: [
        // 顶部「终端」菜单的第一项：面板显示/隐藏（Ctrl+J）。
        // 来源：panelActions.ts 的 TogglePanelAction（id 与 toggled 条件均一致）。
        // 顶部菜单栏内同一功能只允许一个落点，故不再挂 MenubarViewMenu；
        // 标题栏「布局控制」保留（VS Code 的 LayoutControlMenuSubmenu 亦挂该项），
        // 「终端」菜单内容属产品要求的偏差（docs/vscode-reference.md 第 5 节）。
        { id: MenuId.MenubarTerminalMenu, group: "1_layout", order: 1 },
        { id: MenuId.LayoutControlMenu, group: "1_layout", order: 4 }
    ],
    run() {
        appState.panelVisible = !appState.panelVisible;
        setStatus(appState.panelVisible ? "已显示面板" : "已隐藏面板");
    }
});

registerAction2({
    id: "workbench.action.closePanel",
    title: "隐藏面板",
    icon: "close",
    menu: { id: MenuId.PanelTitle, group: "navigation", order: 2 },
    run() {
        appState.panelVisible = false;
    }
});

// 最大化/还原：VS Code 用一条动作的 toggled 语义；这里用 menu.when 拆成两条，
// 使图标随最大化状态切换（screen-full / screen-normal）。
registerAction2({
    id: "workbench.action.maximizePanel",
    title: "最大化面板",
    icon: "screen-full",
    menu: { id: MenuId.PanelTitle, group: "navigation", order: 1, when: ContextKeyExpr.not(PANEL_MAXIMIZED) },
    run() {
        appState.panelMaximized = true;
        appState.panelVisible = true;
    }
});

registerAction2({
    id: "workbench.action.restorePanel",
    title: "还原面板大小",
    icon: "screen-normal",
    menu: { id: MenuId.PanelTitle, group: "navigation", order: 1, when: PANEL_MAXIMIZED },
    run() {
        appState.panelMaximized = false;
    }
});

// 视图菜单中的面板切换入口（对齐 VS Code 面板视图容器的 openCommand：Ctrl+J 之外，
// 每个容器可在命令面板直接打开；此处提供面板容器的聚焦命令）。
registerAction2({
    id: "workbench.action.focusPanel",
    title: "聚焦面板",
    menu: { id: MenuId.MenubarViewMenu, group: "2_focus", order: 1 },
    run() {
        showPanelContainer(appState.activePanelId);
    }
});

// 初始化面板相关上下文键（与 appState 初值一致）。
contextKeys.set("panelVisible", appState.panelVisible);
contextKeys.set("panelMaximized", appState.panelMaximized);
contextKeys.set("activePanel", appState.activePanelId);
