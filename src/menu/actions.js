// 菜单注册表与动作注册（对齐 VS Code platform/actions 的 MenuRegistry / Action2 / registerAction2）。
//
// 一个动作（Action2）同时声明：命令实现、挂载到哪些菜单（含 when/group/order）、快捷键。
// 菜单只按 id 引用命令，渲染时再向上下文求值决定可见性与启用态。

import { registerCommand, getCommand } from "@/menu/commands.js";

const _menuItems = new Map();
const _keybindings = new Map();

// MenuId 是具名标识（VS Code 中为单例）。以 id 作注册表键，保证菜单标识被
// 框架（如 Vue ref）包装成代理对象后，查找仍能命中同一条目。
function menuKey(menuId) {
    return menuId.id ?? menuId;
}

export function appendMenuItem(menuId, item) {
    const key = menuKey(menuId);
    if (!_menuItems.has(key)) {
        _menuItems.set(key, []);
    }
    const list = _menuItems.get(key);
    list.push(item);
    return {
        dispose() {
            const index = list.indexOf(item);
            if (index >= 0) list.splice(index, 1);
        }
    };
}

export const MenuRegistry = {
    appendMenuItem,
    getMenuItems(menuId) {
        return _menuItems.get(menuKey(menuId)) ?? [];
    }
};

// 声明式注册一个动作；menu 为单个描述或描述数组，支持挂载到多个菜单。
export function registerAction2(action) {
    if (typeof action.run === "function") {
        // 包一层以便挂载作用域标记：editorScoped 的命令（转发 Monaco 内置动作的编辑器命令，
        // 或显式声明的编辑器命令）在快捷键分发时要求 editorFocus 成立，
        // 对齐 VS Code 编辑器命令的 when: editorFocus。
        const handler = (...args) => action.run(...args);
        handler.editorScoped = action.run.editorScoped === true || action.editorScoped === true;
        registerCommand(action.id, handler);
    }
    if (action.menu) {
        const menus = Array.isArray(action.menu) ? action.menu : [action.menu];
        for (const menu of menus) {
            appendMenuItem(menu.id, {
                command: { id: action.id, title: action.title, icon: action.icon },
                precondition: action.precondition,
                toggled: action.toggled,
                when: menu.when,
                group: menu.group,
                order: menu.order,
                // 视图标题栏中默认收进「…」溢出菜单的项（对齐 VS Code 的 isHiddenByDefault）。
                isHiddenByDefault: menu.isHiddenByDefault
            });
        }
    }
    if (action.keybinding) {
        const rules = Array.isArray(action.keybinding) ? action.keybinding : [action.keybinding];
        _keybindings.set(action.id, rules);
    }
    return {
        dispose() {
            // 本项目动作在模块加载期一次性注册，运行期不撤销。
        }
    };
}

// 展平快捷键注册表，供快捷键服务分发：每条规则含命令 id、按键串（和弦以空格分隔）与可选 when。
export function getKeybindingRules() {
    const rules = [];
    for (const [commandId, list] of _keybindings) {
        for (const rule of list) {
            if (!rule?.primary) continue;
            // primary 为数组时表示和弦序列（VS Code 写作 "ctrl+k ctrl+w"）。
            const chord = Array.isArray(rule.primary) ? rule.primary.join(" ") : rule.primary;
            rules.push({ commandId, chord, when: rule.when });
        }
    }
    return rules;
}

// 快捷键显示文本（如 Ctrl+Shift+K）；多条规则的主键位以 " / " 并列。
export function getKeybindingLabel(commandId) {
    const rules = _keybindings.get(commandId);
    if (!rules || !rules.length) return "";
    const primaries = [];
    for (const rule of rules) {
        if (!rule.primary) continue;
        primaries.push(Array.isArray(rule.primary) ? rule.primary.join(" / ") : rule.primary);
    }
    return primaries.join(" / ");
}

// 按菜单 id + 上下文解析菜单结构，返回 [group, items[]] 分组列表（对齐 IMenu.getActions）。
export function getMenuActions(menuId, context) {
    const groups = new Map();
    for (const item of MenuRegistry.getMenuItems(menuId)) {
        if (item.when && !item.when.evaluate(context)) continue;
        const group = item.group ?? "default";
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(item);
    }

    const result = [];
    for (const [group, items] of groups) {
        items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        result.push([group, items]);
    }
    // 组间排序：navigation 组恒在最前，其余按组名字典序（组名形如 1_undo、2_clipboard）。
    result.sort((a, b) => {
        if (a[0] === "navigation") return -1;
        if (b[0] === "navigation") return 1;
        return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    });
    return result;
}

// 解析单条菜单项的渲染/执行状态：label、enabled、checked、keybinding、是否存在命令。
export function resolveMenuItem(item, context) {
    if (item.submenu) {
        return {
            item,
            isSubmenu: true,
            commandId: null,
            label: item.title,
            icon: item.icon,
            tooltip: item.title,
            enabled: true,
            checked: undefined,
            keybinding: "",
            hiddenByDefault: false
        };
    }
    const commandId = item.command.id;
    const enabled = !!getCommand(commandId) && (!item.precondition || item.precondition.evaluate(context));
    return {
        item,
        isSubmenu: false,
        commandId,
        label: item.command.title,
        icon: item.command.icon,
        tooltip: item.command.title,
        enabled,
        // 只有声明了 toggled 的动作才有勾选态（对齐 VS Code：Action.checked 未声明时为 undefined），
        // undefined 在菜单中的语义是「普通菜单项」而非「未勾选的复选项」。
        checked: item.toggled ? !!item.toggled.evaluate(context) : undefined,
        keybinding: getKeybindingLabel(commandId),
        // 视图标题栏据此把该项放进「…」溢出菜单（对齐 VS Code 的 isHiddenByDefault）。
        hiddenByDefault: !!item.isHiddenByDefault
    };
}

// 把菜单解析成扁平的「面板条目」列表（分隔线 + 动作项），交给 MenuPanel 渲染。
// 一个分组对应一段条目，段与段之间插一条分隔线（对齐 Menu.getActions 的分组语义）。
// options.skipGroups 可排除整组（如工具栏中已单独取出主区的 navigation 组）。
export function resolveMenuEntries(menuId, context, options) {
    const skipGroups = new Set(options?.skipGroups ?? []);
    const entries = [];
    for (const [group, items] of getMenuActions(menuId, context)) {
        if (skipGroups.has(group)) continue;
        if (entries.length > 0) entries.push({ type: "separator", id: `sep:${group}` });
        for (const item of items) {
            const resolved = resolveMenuItem(item, context);
            entries.push({
                type: "action",
                id: resolved.isSubmenu ? `submenu:${item.submenu.id}` : resolved.commandId,
                commandId: resolved.commandId,
                label: resolved.label,
                keybinding: resolved.keybinding,
                checked: resolved.checked,
                enabled: resolved.enabled,
                isSubmenu: resolved.isSubmenu,
                submenu: resolved.isSubmenu ? item.submenu : null
            });
        }
    }
    return entries;
}
