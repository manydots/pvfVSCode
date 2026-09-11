// 菜单 → 工具栏动作适配（对齐 VS Code platform/actions/browser/menuEntryActionViewItem.ts 的
// fillInActionBarActions）：navigation 组为主区动作，其余组进入溢出菜单，组间插入分隔符。
import { getMenuActions, resolveMenuItem } from "@/menu/actions.js";
import { executeCommand } from "@/menu/commands.js";

function toAction(item, context) {
    const resolved = resolveMenuItem(item, context);
    return {
        type: "action",
        id: resolved.isSubmenu ? `submenu:${item.submenu.id}` : resolved.commandId,
        label: resolved.label,
        icon: resolved.icon,
        tooltip: resolved.tooltip,
        enabled: resolved.enabled,
        checked: resolved.checked,
        keybinding: resolved.keybinding,
        submenu: resolved.isSubmenu ? item.submenu : null,
        run: resolved.isSubmenu ? null : () => executeCommand(resolved.commandId)
    };
}

// 返回 { primary, secondary }：primary 为工具栏主区动作，secondary 为溢出菜单动作（含分隔符）。
export function getToolbarActions(menuId, context, primaryGroup = "navigation") {
    const target = { primary: [], secondary: [] };
    for (const [group, items] of getMenuActions(menuId, context)) {
        const bucket = group === primaryGroup ? target.primary : target.secondary;
        if (bucket.length > 0) bucket.push({ type: "separator", id: `sep:${group}` });
        for (const item of items) {
            bucket.push(toAction(item, context));
        }
    }
    return target;
}
