// 资源管理器视图容器注册（对齐 VS Code workbench/contrib/files/browser/explorerViewlet.ts）。
import { MenuId } from "@/menu/menuId.js";
import { registerAction2 } from "@/menu/actions.js";
import { ContextKeyExpr } from "@/menu/contextKey.js";
import { setStatus } from "@/menu/appState.js";
import { ViewContainerLocation, registerViewContainer, registerViews } from "@/workbench/viewsRegistry.js";
import { focusViewContainer } from "@/workbench/viewService.js";
import ExplorerView from "@/workbench/contrib/explorer/ExplorerView.vue";

export const EXPLORER_CONTAINER_ID = "workbench.view.explorer";
export const EXPLORER_VIEW_ID = "workbench.explorer.main";

// 容器 order 与 VS Code 活动栏顺序一致：资源管理器 0 / 搜索 1 / 源代码管理 2 / 运行和调试 3 / 扩展 4
// （见 files/browser/explorerViewlet.ts 的 order: 0）。
const container = registerViewContainer({ id: EXPLORER_CONTAINER_ID, title: "资源管理器", icon: "files", order: 0 }, ViewContainerLocation.Sidebar);

registerViews([{ id: EXPLORER_VIEW_ID, order: 1, component: ExplorerView }], container);

// 视图标题动作（对齐 VS Code explorerView.ts 的 MenuId.ViewTitle 贡献：group=navigation、order 10/20/30/40）。
// 与 VS Code 一致，未打开文件夹（本项目中即未接入 PVF 归档）时新建动作处于禁用态。
const VIEW_TITLE = { id: MenuId.ViewTitle, group: "navigation", when: ContextKeyExpr.equals("view", EXPLORER_VIEW_ID) };
const CAN_CREATE = ContextKeyExpr.has("explorerFolderContext");

registerAction2({
    id: "workbench.files.action.createFileFromExplorer",
    title: "新建文件...",
    icon: "new-file",
    precondition: CAN_CREATE,
    menu: { ...VIEW_TITLE, order: 10 },
    run() {
        setStatus("新建文件将在 PVF 归档接入后可用");
    }
});

registerAction2({
    id: "workbench.files.action.createFolderFromExplorer",
    title: "新建文件夹...",
    icon: "new-folder",
    precondition: CAN_CREATE,
    menu: { ...VIEW_TITLE, order: 20 },
    run() {
        setStatus("新建文件夹将在 PVF 归档接入后可用");
    }
});

registerAction2({
    id: "workbench.files.action.refreshFilesExplorer",
    title: "刷新",
    icon: "refresh",
    menu: { ...VIEW_TITLE, order: 30 },
    run() {
        setStatus("已刷新资源管理器");
    }
});

registerAction2({
    id: "workbench.files.action.collapseExplorerFolders",
    title: "折叠文件夹",
    icon: "collapse-all",
    menu: { ...VIEW_TITLE, order: 40 },
    run() {
        setStatus("已折叠资源管理器中的文件夹");
    }
});

registerAction2({
    id: "workbench.view.explorer",
    title: "资源管理器",
    keybinding: { primary: "Ctrl+Shift+E" },
    toggled: ContextKeyExpr.and(ContextKeyExpr.has("sidebarVisible"), ContextKeyExpr.equals("activeViewContainer", EXPLORER_CONTAINER_ID)),
    menu: [
        { id: MenuId.MenubarViewMenu, group: "0_views", order: 1 },
        { id: MenuId.LayoutControlMenu, group: "0_views", order: 1 }
    ],
    run() {
        focusViewContainer(EXPLORER_CONTAINER_ID);
    }
});
