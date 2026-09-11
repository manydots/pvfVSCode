// 标题栏工具栏动作注册（对齐 VS Code workbench/browser/parts/titlebar 的 TitleBar / LayoutControlMenu）。
//
// 右侧工具栏 = MenuId.TitleBar；其中「布局控制」指向 MenuId.LayoutControlMenu 子菜单，
// 其具体条目由各视图贡献模块挂入（见 defaultMenus 与各 *.contribution.js）。
import { MenuId } from "@/menu/menuId.js";
import { appendMenuItem, registerAction2 } from "@/menu/actions.js";
import { setStatus } from "@/menu/appState.js";

// 布局控制：子菜单入口（主区动作，navigation 组）。
appendMenuItem(MenuId.TitleBar, {
    title: "布局控制",
    submenu: MenuId.LayoutControlMenu,
    icon: "layout",
    group: "navigation",
    order: 1
});

// 管理/设置入口（占位，设置面板后续接入）。
registerAction2({
    id: "workbench.action.openSettings",
    title: "设置",
    icon: "settings",
    keybinding: { primary: "Ctrl+," },
    menu: { id: MenuId.TitleBar, group: "navigation", order: 2 },
    run() {
        setStatus("设置面板将在后续接入");
    }
});
