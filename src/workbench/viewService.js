// 视图服务：维护当前激活的视图容器，并处理活动栏点击的聚焦/收起语义。
//
// 复刻 VS Code 行为：点击已激活且侧栏可见的图标 -> 收起侧栏；否则切换容器并展开侧栏。
// 面板（Panel）位置的容器同样从这里取，供底部面板部件渲染切换器。
import { appState } from "@/menu/appState.js";
import { MenuId } from "@/menu/menuId.js";
import { MenuRegistry, resolveMenuItem } from "@/menu/actions.js";
import { contextKeys } from "@/menu/contextKey.js";
import { ViewContainerLocation, getViewContainers, getViewContainer } from "@/workbench/viewsRegistry.js";

export function focusViewContainer(id) {
    if (appState.activeViewContainerId === id && appState.sidebarVisible) {
        appState.sidebarVisible = false;
        return;
    }
    appState.activeViewContainerId = id;
    appState.sidebarVisible = true;
}

export function getActiveViewContainer() {
    const containers = getViewContainers(ViewContainerLocation.Sidebar);
    return containers.find(container => container.id === appState.activeViewContainerId) ?? getViewContainer(appState.activeViewContainerId);
}

export function getPanelViewContainers() {
    return getViewContainers(ViewContainerLocation.Panel);
}

export function getActivePanelViewContainer() {
    return getViewContainer(appState.activePanelId) ?? getPanelViewContainers()[0] ?? null;
}

// 视图标题动作：取自 MenuId.ViewTitle，以视图 id 作为 `view` 上下文求值 when 后按 order 排序
// （对齐 VS Code 各视图贡献到 MenuId.ViewTitle 的 group=navigation 动作）。
// 侧栏与面板共用此逻辑，避免各自维护一份解析代码。
export function getViewTitleActions(viewId) {
    if (!viewId) return [];
    const viewContext = { get: key => (key === "view" ? viewId : contextKeys.get(key)) };
    const items = MenuRegistry.getMenuItems(MenuId.ViewTitle)
        .filter(item => !item.when || item.when.evaluate(viewContext))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return items.map(item => resolveMenuItem(item, contextKeys));
}

// 面板视图切换：对齐 VS Code CompositePart.showComposite 的语义（点击切换器只切换/展开，
// 再次点击当前项不收起面板）。
export function showPanelContainer(id) {
    appState.activePanelId = id;
    appState.panelVisible = true;
}
