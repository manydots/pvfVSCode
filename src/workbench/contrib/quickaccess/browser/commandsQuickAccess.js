// 命令快速输入（「>」模式，Ctrl+Shift+P / F1）。
//
// 权威来源（microsoft/vscode）：
//   platform/quickinput/browser/commandsQuickAccess.ts:51        PREFIX = '>'
//   platform/actions/common/actions.ts:754-755                   registerAction2 默认把动作挂到
//     MenuId.CommandPalette（f1 为真时，when 取 precondition）
//   workbench/contrib/quickaccess/browser/commandsQuickAccess.ts:229-236
//     getGlobalCommandPicks：命令表来自 Menu.getMenuActions(MenuId.CommandPalette, 上下文) 且 action.enabled
//   platform/quickinput/browser/commandsQuickAccess.ts:91-150    匹配（标签模糊词过滤 / 命令 id 全等）
//   platform/quickinput/browser/commandsQuickAccess.ts:139-149   标签重复时把命令 id 显示为 description
//   platform/quickinput/browser/commandsQuickAccess.ts:151-209   排序：最近使用 → 标签字典序
//   platform/quickinput/browser/commandsQuickAccess.ts:213-248   分隔线：首项在历史中才插「最近使用」，
//     之后在首个非历史项前插「其他命令」（任何过滤词下都成立，不是只在空查询时）
//   platform/quickinput/browser/commandsQuickAccess.ts:303-320   accept：先记入历史再执行命令
//   workbench/contrib/quickaccess/browser/quickAccess.contribution.ts:46  占位符文案
//   workbench/browser/actions/quickAccessActions.ts:130-148      Ctrl+Shift+P / F1 打开该提供者
//
// 裁剪（登记在 docs/vscode-reference.md 第 5 节）：无 TF-IDF 相似命令、无「常用命令」建议、
// 无命令别名（commandAlias）、无历史持久化（仅本次会话内存）、无最近使用项的「×」移除按钮与
// 配置快捷键的齿轮按钮（浮层尚无按钮支持）。
import { MenuId } from "@/menu/menuId.js";
import { getMenuActions, resolveMenuItem } from "@/menu/actions.js";
import { contextKeys } from "@/menu/contextKey.js";
import { executeCommand } from "@/menu/commands.js";
import { registerQuickAccessProvider } from "@/platform/quickinput/quickAccess.js";

export const COMMANDS_QUICK_ACCESS_PREFIX = ">";

// 最近使用的命令（对齐权威的 CommandsHistory；权威持久化在 storage，这里只在会话内保留）。
const _recentlyUsed = [];

function remember(commandId) {
    const index = _recentlyUsed.indexOf(commandId);
    if (index >= 0) _recentlyUsed.splice(index, 1);
    _recentlyUsed.unshift(commandId);
}

function isRecentlyUsed(commandId) {
    return _recentlyUsed.includes(commandId);
}

// 命令表 = MenuId.CommandPalette 的菜单动作（对齐 commandsQuickAccess.ts:229-236）。
// 走菜单注册表而非命令注册表，when 由 getMenuActions 按当前上下文求值、enabled 由 precondition 决定。
function getAllCommandPicks() {
    return getMenuActions(MenuId.CommandPalette, contextKeys)
        .flatMap(([, items]) => items)
        .map(item => resolveMenuItem(item, contextKeys))
        .filter(action => action.enabled && action.commandId);
}

// 模糊词过滤（对齐 filters.ts 的 matchesFuzzy 语义）：过滤词按空格分词，每个词都要作为子序列
// 出现在标签中；连续命中的字符越多得分越高。返回 -1 表示不匹配。
function fuzzyScore(word, text) {
    let score = 0;
    let textIndex = 0;
    let previousMatch = -2;
    for (const character of word) {
        const index = text.indexOf(character, textIndex);
        if (index < 0) return -1;
        score += index === previousMatch + 1 ? 2 : 1;
        previousMatch = index;
        textIndex = index + 1;
    }
    return score;
}

// 匹配规则（对齐 commandsQuickAccess.ts:91-150 的两条分支）：标签模糊匹配，或命令 id 全等。
function matchScore(action, terms) {
    const label = action.label.toLowerCase();
    let score = 0;
    for (const term of terms) {
        const wordScore = fuzzyScore(term, label);
        if (wordScore < 0) return -1;
        score += wordScore;
    }
    return score;
}

// 标签重复的命令把命令 id 显示为 description（对齐 :139-149）。
function withDuplicateDescriptions(actions) {
    const byLabel = new Map();
    for (const action of actions) {
        if (byLabel.has(action.label)) {
            action.description = action.commandId;
            byLabel.get(action.label).description = byLabel.get(action.label).commandId;
        } else {
            byLabel.set(action.label, action);
        }
    }
    return actions;
}

function toPick(action) {
    return {
        id: `command:${action.commandId}`,
        label: action.label,
        description: action.description ?? "",
        keybinding: action.keybinding,
        accept() {
            remember(action.commandId);
            executeCommand(action.commandId);
        }
    };
}

export function registerCommandsQuickAccess() {
    registerQuickAccessProvider({
        prefix: COMMANDS_QUICK_ACCESS_PREFIX,
        placeholder: "输入要运行的命令名称。",
        getPicks(filter) {
            const terms = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
            const all = getAllCommandPicks();
            const matched = terms.length ? all.filter(action => matchScore(action, terms) >= 0 || filter === action.commandId) : all;

            // 排序：最近使用优先，其余按标签字典序（对齐 :151-209）。
            matched.sort((a, b) => {
                const aUsed = isRecentlyUsed(a.commandId);
                const bUsed = isRecentlyUsed(b.commandId);
                if (aUsed !== bUsed) return aUsed ? -1 : 1;
                return a.label.localeCompare(b.label);
            });

            // 标签重复的命令补上命令 id 作为 description（对齐 :139-149）。
            withDuplicateDescriptions(matched);

            // 分隔线按排序结果就地插入（对齐 :213-248）：只有首项确实在历史里才出现「最近使用」。
            const picks = [];
            let pendingOtherSeparator = false;
            for (let index = 0; index < matched.length; index++) {
                const action = matched[index];
                const used = isRecentlyUsed(action.commandId);
                if (index === 0 && used) {
                    picks.push({ id: "separator:recentlyUsed", kind: -1, label: "最近使用" });
                    pendingOtherSeparator = true;
                }
                if (pendingOtherSeparator && !used) {
                    picks.push({ id: "separator:otherCommands", kind: -1, label: "其他命令" });
                    pendingOtherSeparator = false;
                }
                picks.push(toPick(action));
            }

            return picks;
        }
    });
}
