// 源代码管理视图容器注册（对齐 VS Code workbench/contrib/scm/browser/scm.contribution.ts
// 的 registerViewContainer：容器 id 取 scm/common/scm.ts 的 VIEWLET_ID、order 2、
// 图标 Codicon.sourceControl）。SCM 提供程序（Git 等）尚未接入，视图为空状态。
import { MenuId } from "@/menu/menuId.js";
import { registerAction2 } from "@/menu/actions.js";
import { ContextKeyExpr } from "@/menu/contextKey.js";
import { ViewContainerLocation, registerViewContainer, registerViews } from "@/workbench/viewsRegistry.js";
import { focusViewContainer } from "@/workbench/viewService.js";
import EmptyView from "@/base/views/EmptyView.vue";

export const SCM_CONTAINER_ID = "workbench.view.scm";
// 主视图 id 取 scm/common/scm.ts 的 VIEW_PANE_ID。
export const SCM_VIEW_ID = "workbench.scm";

const container = registerViewContainer({ id: SCM_CONTAINER_ID, title: "源代码管理", icon: "source-control", order: 2 }, ViewContainerLocation.Sidebar);

registerViews(
    [
        {
            id: SCM_VIEW_ID,
            name: "源代码管理",
            order: 0,
            component: EmptyView,
            props: {
                icon: "source-control",
                message: "尚未注册源代码管理提供程序。",
                hint: "接入 Git 等提供程序后，此处显示变更列表。"
            }
        }
    ],
    container
);

registerAction2({
    id: "workbench.view.scm",
    title: "源代码管理",
    keybinding: { primary: "Ctrl+Shift+G" },
    toggled: ContextKeyExpr.and(ContextKeyExpr.has("sidebarVisible"), ContextKeyExpr.equals("activeViewContainer", SCM_CONTAINER_ID)),
    menu: [
        { id: MenuId.MenubarViewMenu, group: "0_views", order: 3 },
        { id: MenuId.LayoutControlMenu, group: "0_views", order: 3 }
    ],
    run() {
        focusViewContainer(SCM_CONTAINER_ID);
    }
});
