// 运行和调试视图容器注册（对齐 VS Code workbench/contrib/debug/browser/debug.contribution.ts
// 的 registerViewContainer：容器 id 取 debug/common/debug.ts 的 VIEWLET_ID、order 3、
// 图标 icons.runViewIcon 即 Codicon.debugAlt）。调试会话未启动时，容器内为空状态视图
// （对应 debug/browser/welcomeView.ts 的 WelcomeView，id workbench.debug.welcome）。
import { MenuId } from "@/menu/menuId.js";
import { registerAction2 } from "@/menu/actions.js";
import { ContextKeyExpr } from "@/menu/contextKey.js";
import { ViewContainerLocation, registerViewContainer, registerViews } from "@/workbench/viewsRegistry.js";
import { focusViewContainer } from "@/workbench/viewService.js";
import EmptyView from "@/base/views/EmptyView.vue";

export const DEBUG_CONTAINER_ID = "workbench.view.debug";
// 视图 id 取 welcomeView.ts 的 WelcomeView.ID。
export const DEBUG_WELCOME_VIEW_ID = "workbench.debug.welcome";

const container = registerViewContainer({ id: DEBUG_CONTAINER_ID, title: "运行和调试", icon: "debug-alt", order: 3 }, ViewContainerLocation.Sidebar);

registerViews(
    [
        {
            id: DEBUG_WELCOME_VIEW_ID,
            name: "运行和调试",
            order: 0,
            component: EmptyView,
            props: {
                icon: "debug-alt",
                message: "尚未启动调试会话。",
                hint: "接入调试适配器后，此处可创建 launch 配置并启动会话。"
            }
        }
    ],
    container
);

registerAction2({
    id: "workbench.view.debug",
    title: "运行和调试",
    keybinding: { primary: "Ctrl+Shift+D" },
    toggled: ContextKeyExpr.and(ContextKeyExpr.has("sidebarVisible"), ContextKeyExpr.equals("activeViewContainer", DEBUG_CONTAINER_ID)),
    menu: [
        { id: MenuId.MenubarViewMenu, group: "0_views", order: 4 },
        { id: MenuId.LayoutControlMenu, group: "0_views", order: 4 }
    ],
    run() {
        focusViewContainer(DEBUG_CONTAINER_ID);
    }
});
