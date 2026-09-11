// 搜索视图容器注册（对齐 VS Code workbench/contrib/search/browser/searchViewlet.ts）。
import { MenuId } from "@/menu/menuId.js";
import { registerAction2 } from "@/menu/actions.js";
import { ContextKeyExpr } from "@/menu/contextKey.js";
import { ViewContainerLocation, registerViewContainer, registerViews } from "@/workbench/viewsRegistry.js";
import { focusViewContainer } from "@/workbench/viewService.js";
import SearchView from "@/workbench/contrib/search/SearchView.vue";

export const SEARCH_CONTAINER_ID = "workbench.view.search";

// 容器 order 取 search/browser/search.contribution.ts 的 order: 1（紧跟资源管理器）。
const container = registerViewContainer({ id: SEARCH_CONTAINER_ID, title: "搜索", icon: "search", order: 1 }, ViewContainerLocation.Sidebar);

registerViews([{ id: "workbench.search.main", order: 1, component: SearchView }], container);

registerAction2({
    id: "workbench.view.search",
    title: "搜索",
    keybinding: { primary: "Ctrl+Shift+F" },
    toggled: ContextKeyExpr.and(ContextKeyExpr.has("sidebarVisible"), ContextKeyExpr.equals("activeViewContainer", SEARCH_CONTAINER_ID)),
    menu: [
        { id: MenuId.MenubarViewMenu, group: "0_views", order: 2 },
        { id: MenuId.LayoutControlMenu, group: "0_views", order: 2 }
    ],
    run() {
        focusViewContainer(SEARCH_CONTAINER_ID);
    }
});
