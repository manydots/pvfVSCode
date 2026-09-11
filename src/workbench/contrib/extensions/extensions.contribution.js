// 扩展视图容器注册（对齐 VS Code workbench/contrib/extensions/browser/extensions.contribution.ts
// 的 registerViewContainer：容器 id 取 extensions/common/extensions.ts 的 VIEWLET_ID、order 4、
// 图标 Codicon.extensions）。扩展市场尚未接入，视图为空状态。
import { MenuId } from "@/menu/menuId.js";
import { registerAction2 } from "@/menu/actions.js";
import { ContextKeyExpr } from "@/menu/contextKey.js";
import { ViewContainerLocation, registerViewContainer, registerViews } from "@/workbench/viewsRegistry.js";
import { focusViewContainer } from "@/workbench/viewService.js";
import EmptyView from "@/base/views/EmptyView.vue";

export const EXTENSIONS_CONTAINER_ID = "workbench.view.extensions";
export const EXTENSIONS_VIEW_ID = "workbench.extensions.search";

const container = registerViewContainer({ id: EXTENSIONS_CONTAINER_ID, title: "扩展", icon: "extensions", order: 4 }, ViewContainerLocation.Sidebar);

registerViews(
    [
        {
            id: EXTENSIONS_VIEW_ID,
            name: "扩展",
            order: 0,
            component: EmptyView,
            props: {
                icon: "extensions",
                message: "扩展市场尚未接入。",
                hint: "接入扩展服务后，此处可搜索、安装与管理扩展。"
            }
        }
    ],
    container
);

registerAction2({
    id: "workbench.view.extensions",
    title: "扩展",
    keybinding: { primary: "Ctrl+Shift+X" },
    toggled: ContextKeyExpr.and(ContextKeyExpr.has("sidebarVisible"), ContextKeyExpr.equals("activeViewContainer", EXTENSIONS_CONTAINER_ID)),
    menu: [
        { id: MenuId.MenubarViewMenu, group: "0_views", order: 5 },
        { id: MenuId.LayoutControlMenu, group: "0_views", order: 5 }
    ],
    run() {
        focusViewContainer(EXTENSIONS_CONTAINER_ID);
    }
});
