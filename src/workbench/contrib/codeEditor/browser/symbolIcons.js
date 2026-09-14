// 符号图标配色（对齐 <vscode>/src/vs/editor/contrib/symbolIcons/browser/symbolIcons.ts 与
// 同目录的 symbolIcons.css:9-71）。
//
// 权威为 34 个 `symbolIcon.*Foreground` 注册颜色，其中与文档符号（SymbolKind）对应的那批
// 在这里逐条落地：取值取 registerColor 的 dark 默认值（2026-dark.json 未覆盖任何 symbolIcon.*，
// 已核对：`grep symbolIcon 2026-dark.json` 为 0 条），
// 默认值为 `foreground` 的那些即 `editor.foreground`（baseColors.ts:20，
// 本仓库对应 --vscode-editor-foreground）。
//
// 用途：面包屑 picker 与面包屑条上的符号图标（类名 `codicon-colored` + `codicon-symbol-<kebab>`）。
// 忽略的注册项（symbolIcon.reference/snippet/text/unit/keyword/folder 等）不对应 SymbolKind，
// 本仓库没有消费方，故未登记。
import { KIND_CONFIG_PAIRS } from "@/workbench/contrib/codeEditor/browser/outline/documentSymbolsTree.js";

// registerColor 里显式给出 dark 值的那些（symbolIcons.ts:12-113）。
const EXPLICIT_DARK_COLORS = Object.freeze({
    class: "#EE9D28",
    constructor: "#B180D7",
    enumerator: "#EE9D28",
    enumeratorMember: "#75BEFF",
    event: "#EE9D28",
    field: "#75BEFF",
    function: "#B180D7",
    interface: "#75BEFF",
    method: "#B180D7",
    variable: "#75BEFF"
});

function camelToKebab(value) {
    return value.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`);
}

// configName（documentSymbolsTree.ts:288-327 的 kindToConfigName）→ 颜色 token 名与图标类名。
// 两者的命名规则都来自权威：token 用 configName 原样（`symbolIcon.enumMemberForeground`），
// 图标类名用 codicon 的 kebab 形式（`codicon-symbol-enum-member`）。
export const SYMBOL_ICON_COLOR_TOKENS = Object.freeze(
    Object.fromEntries(KIND_CONFIG_PAIRS.map(([, configName]) => [configName, `--vscode-symbolIcon-${configName}Foreground`]))
);

export const SYMBOL_ICON_CLASS_NAMES = Object.freeze(
    Object.fromEntries(KIND_CONFIG_PAIRS.map(([, configName]) => [configName, `codicon-symbol-${camelToKebab(configName)}`]))
);

/** 显式色值（用于 theme.css 的取值核对）与需要回落到 editor.foreground 的那部分。 */
export function symbolIconColor(configName) {
    return EXPLICIT_DARK_COLORS[configName] ?? "#bbbebf"; // 默认前景 = --vscode-editor-foreground
}

/** theme.css 里的 26 条 token 声明（保持权威注册顺序）。 */
export function symbolIconThemeVariables() {
    return KIND_CONFIG_PAIRS.map(([, configName]) => `    ${SYMBOL_ICON_COLOR_TOKENS[configName]}: ${symbolIconColor(configName).toLowerCase()};`).join("\n");
}

/**
 * 对齐 symbolIcons.css:9-71：`.codicon-colored.codicon.codicon-symbol-<kebab> { color: <该符号的 CSS 变量>; }`
 * 图标自身的颜色独立于行的选中/悬停前景（选择器落在图标元素上，优于行上的 color）。
 */
export function symbolIconColorRules(scope) {
    return KIND_CONFIG_PAIRS.map(
        ([, configName]) => `${scope} .codicon-colored.codicon.${SYMBOL_ICON_CLASS_NAMES[configName]} { color: var(${SYMBOL_ICON_COLOR_TOKENS[configName]}); }`
    ).join("\n");
}
