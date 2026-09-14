// 菜单标识（对齐 VS Code platform/actions 的 MenuId）。
//
// 每个 MenuId 是一个具名菜单节点：菜单项通过 MenuRegistry 挂到节点上，
// 菜单栏、下拉、上下文菜单都只是同一节点在不同位置的渲染。
export class MenuId {
    static _instances = new Map();

    static for(identifier) {
        return MenuId._instances.get(identifier) ?? new MenuId(identifier);
    }

    constructor(identifier) {
        if (MenuId._instances.has(identifier)) {
            throw new TypeError(`MenuId '${identifier}' 已存在`);
        }
        MenuId._instances.set(identifier, this);
        this.id = identifier;
    }
}

// 顶部菜单栏根节点，其子项为各子菜单（VS Code MenuId.Menubar* 同款划分，按裁剪后的能力取舍）。
MenuId.MenubarMainMenu = new MenuId("MenubarMainMenu");
MenuId.MenubarFileMenu = new MenuId("MenubarFileMenu");
MenuId.MenubarEditMenu = new MenuId("MenubarEditMenu");
MenuId.MenubarSelectionMenu = new MenuId("MenubarSelectionMenu");
MenuId.MenubarViewMenu = new MenuId("MenubarViewMenu");
MenuId.MenubarGoMenu = new MenuId("MenubarGoMenu");
// 顶部「终端」菜单（对齐 VS Code platform/actions/common/actions.ts 的 MenubarTerminalMenu）。
MenuId.MenubarTerminalMenu = new MenuId("MenubarTerminalMenu");
MenuId.MenubarHelpMenu = new MenuId("MenubarHelpMenu");

// 编辑器右键上下文菜单与命令面板（供后续接入）。
MenuId.EditorContext = new MenuId("EditorContext");
MenuId.CommandPalette = new MenuId("CommandPalette");

// 标题栏命令中心（对齐 VS Code platform/actions/common/actions.ts:120-121 的
// MenuId.CommandCenter / CommandCenterCenter）：CommandCenter 是命令中心所在的那条工具栏，
// CommandCenterCenter 是中心圆角框里那份子菜单（快速打开等），
// 见 workbench/contrib/titlebar/commandCenter.contribution.js。
MenuId.CommandCenter = new MenuId("CommandCenter");
MenuId.CommandCenterCenter = new MenuId("CommandCenterCenter");

// 编辑器标签栏：右侧动作工具栏与标签右键菜单
// （对齐 VS Code MenuId.EditorTitle / EditorTitleContext / EditorTabsBarContext）。
MenuId.EditorTitle = new MenuId("EditorTitle");
MenuId.EditorTitleContext = new MenuId("EditorTitleContext");
MenuId.EditorTabsBarContext = new MenuId("EditorTabsBarContext");

// 底部面板标题栏全局动作（对齐 VS Code MenuId.PanelTitle：最大化/还原、关闭）。
MenuId.PanelTitle = new MenuId("PanelTitle");
MenuId.PanelTitleContext = new MenuId("PanelTitleContext");

// 标题栏工具栏（右侧动作区）与布局控制子菜单（对齐 VS Code MenuId.TitleBar / LayoutControlMenu）。
MenuId.TitleBar = new MenuId("TitleBar");
MenuId.TitleBarContext = new MenuId("TitleBarContext");
MenuId.LayoutControlMenu = new MenuId("LayoutControlMenu");

// 视图标题动作（对齐 VS Code MenuId.ViewTitle）：资源管理器的新建/刷新/折叠等挂在此处。
MenuId.ViewTitle = new MenuId("ViewTitle");
