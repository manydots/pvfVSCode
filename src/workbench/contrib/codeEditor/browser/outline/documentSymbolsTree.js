// 文档符号树的取值层：行高、按符号类型的过滤、三种排序、以及「树 → 可见行」的扁平化。
//
// 权威来源（microsoft/vscode）：
//   workbench/contrib/codeEditor/browser/outline/documentSymbolsTree.ts:158-166  行高 22（DocumentSymbolVirtualDelegate）
//   workbench/contrib/codeEditor/browser/outline/documentSymbolsTree.ts:288-327  DocumentSymbolFilter.kindToConfigName（SymbolKind → 配置名）
//   workbench/contrib/codeEditor/browser/outline/documentSymbolsTree.ts:329-341  filter（按 `<prefix>.<configName>` 取配置）
//   workbench/contrib/codeEditor/browser/outline/documentSymbolsTree.ts:343-375  DocumentSymbolComparator（position / type / name）
//   workbench/browser/parts/editor/breadcrumbsPicker.ts:463-481               OutlineTreeSorter（按 breadcrumbs.symbolSortOrder 选比较函数）
//   base/browser/ui/tree/abstractTree.js:227/257/294/328-329                  行缩进的三个取值（DefaultIndent / indentSize / twistie 内边距 / 缩进容器宽）
//
// 本文件只做纯计算（输入 outline 元素、配置取值函数，输出行数组），
// 渲染与交互在 breadcrumbsPicker.js / BreadcrumbsPicker.vue，取数在 documentSymbolsOutline.js。
import { SymbolKinds, symbolKindNames } from "monaco-editor/editor/common/languages.js";

// documentSymbolsTree.ts:158-164
export const SYMBOL_ROW_HEIGHT = 22;

// 缩进量的兜底值：TreeRenderer.DefaultIndent（abstractTree.js:227）。
// 权威的缩进步长取自 workbench.tree.indent（listService.ts:1161），本仓库同源见
// @/platform/list/browser/listService.js 的 getTreeIndent()。
export const DEFAULT_TREE_INDENT = 8;

// SymbolKind 在权威源码里是 `const enum`（editor/common/languages.ts），发行包把它内联成字面量
// —— `monaco-editor` 不导出运行时对象（dist 仅导出 SymbolKinds / symbolKindNames）。
// 故下面按内联值书写，取值可与 dist 的 symbolKindNames 键逐条核对
// （node_modules/monaco-editor/esm/vs/editor/common/languages.js:309-340）。
const SymbolKind = Object.freeze({
    File: 0,
    Module: 1,
    Namespace: 2,
    Package: 3,
    Class: 4,
    Method: 5,
    Property: 6,
    Field: 7,
    Constructor: 8,
    Enum: 9,
    Interface: 10,
    Function: 11,
    Variable: 12,
    Constant: 13,
    String: 14,
    Number: 15,
    Boolean: 16,
    Array: 17,
    Object: 18,
    Key: 19,
    Null: 20,
    EnumMember: 21,
    Struct: 22,
    Event: 23,
    Operator: 24,
    TypeParameter: 25
});

// documentSymbolsTree.ts:288-327 的 kindToConfigName：**顺序与权威表逐条一致**。
// 第三个元素是权威配置描述里的符号名（`filteredTypes.<label>`，见 breadcrumbs.ts:181-341 与
// outline.contribution.ts:69-141 的 markdownDescription），用于生成设置项的说明文本。
// 导出给配置登记（breadcrumbs.configuration.js / outline.configuration.js）复用同一张表，
// 避免设置项与过滤逻辑各写一份而分叉。
export const KIND_CONFIG_PAIRS = [
    [SymbolKind.File, "showFiles", "file"],
    [SymbolKind.Module, "showModules", "module"],
    [SymbolKind.Namespace, "showNamespaces", "namespace"],
    [SymbolKind.Package, "showPackages", "package"],
    [SymbolKind.Class, "showClasses", "class"],
    [SymbolKind.Method, "showMethods", "method"],
    [SymbolKind.Property, "showProperties", "property"],
    [SymbolKind.Field, "showFields", "field"],
    [SymbolKind.Constructor, "showConstructors", "constructor"],
    [SymbolKind.Enum, "showEnums", "enum"],
    [SymbolKind.Interface, "showInterfaces", "interface"],
    [SymbolKind.Function, "showFunctions", "function"],
    [SymbolKind.Variable, "showVariables", "variable"],
    [SymbolKind.Constant, "showConstants", "constant"],
    [SymbolKind.String, "showStrings", "string"],
    [SymbolKind.Number, "showNumbers", "number"],
    [SymbolKind.Boolean, "showBooleans", "boolean"],
    [SymbolKind.Array, "showArrays", "array"],
    [SymbolKind.Object, "showObjects", "object"],
    [SymbolKind.Key, "showKeys", "key"],
    [SymbolKind.Null, "showNull", "null"],
    [SymbolKind.EnumMember, "showEnumMembers", "enumMember"],
    [SymbolKind.Struct, "showStructs", "struct"],
    [SymbolKind.Event, "showEvents", "event"],
    [SymbolKind.Operator, "showOperators", "operator"],
    [SymbolKind.TypeParameter, "showTypeParameters", "typeParameter"]
];

export const SYMBOL_KIND_CONFIG_NAMES = Object.freeze(Object.fromEntries(KIND_CONFIG_PAIRS.map(([kind, configName]) => [kind, configName])));
export const SYMBOL_KIND_LABELS = Object.freeze(Object.fromEntries(KIND_CONFIG_PAIRS.map(([kind, , label]) => [kind, label])));

// 一个符号类型对应的设置键：`breadcrumbs.showMethods`（过滤）与 `outline.showMethods`（大纲面板）。
// 两个前缀对应 DocumentSymbolFilter 的构造参数（documentSymbolsTree.ts:329-341）。
export function symbolKindConfigKey(prefix, kind) {
    const configName = SYMBOL_KIND_CONFIG_NAMES[kind];
    return configName ? `${prefix}.${configName}` : undefined;
}

/**
 * 按符号类型过滤：`DocumentSymbolFilter.filter`（documentSymbolsTree.ts:328-341）。
 * 只对元素生效，分组（OutlineGroup）恒可见（`!(element instanceof OutlineElement) → true`）。
 * @param {any} element outline 元素（OutlineElement / OutlineGroup）
 * @param {(key: string) => boolean} getConfig 配置取值函数
 * @param {'breadcrumbs'|'outline'} prefix
 */
export function isSymbolVisible(element, getConfig, prefix = "breadcrumbs") {
    if (!isOutlineElement(element)) return true;
    const key = symbolKindConfigKey(prefix, element.symbol.kind);
    // 权威取不到配置名时键退化为 `breadcrumbs.undefined`，取值 undefined → 被过滤掉；
    // SymbolKind 的全部取值（0..25）都在上面的表里，故该分支在本仓库不可达，按可见处理。
    if (!key) return true;
    return Boolean(getConfig(key));
}

// documentSymbolsTree.ts:40-49 / :52-60 / :62-68：OutlineGroup 用 label，OutlineElement 用 symbol.name。
export function symbolNavigationLabel(element) {
    return isOutlineElement(element) ? element.symbol.name : element.label;
}

// documentSymbolsTree.ts:34-38 / :52-58：行标题 `名称 (符号类型名)`（localize('title.template')）。
export function symbolRowTitle(element) {
    if (!isOutlineElement(element)) return element.label;
    return `${element.symbol.name} (${symbolKindNames[element.symbol.kind]})`;
}

// 行的无障碍名称（DocumentSymbolAccessibilityProvider.getAriaLabel，documentSymbolsTree.ts:55-61）：
// 分组取 label，元素取 `getAriaLabelForSymbol(name, kind)` = `${name} (${类型名})`
// （editor/common/languages.ts:1659-1661）—— 与行标题同形。
export function symbolAriaLabel(element) {
    return isOutlineElement(element) ? `${element.symbol.name} (${symbolKindNames[element.symbol.kind]})` : element.label;
}

export function symbolIconId(element) {
    if (!isOutlineElement(element)) return undefined;
    // SymbolKinds.toIcon 的返回对象带 codicon id（如 "symbol-method"），
    // 与 breadcrumbsControl.ts:157-171 的图标取法一致（documentSymbols.js 已用同一映射）。
    return SymbolKinds.toIcon(element.symbol.kind).id;
}

// SymbolTag.Deprecated 的取值 = 1（monaco.d.ts:8434-8436 的 `export enum SymbolTag { Deprecated = 1 }`；
// 发行包里它是 const enum，编译期内联，无运行期导出，故此处用字面量）。
export const SYMBOL_TAG_DEPRECATED = 1;

// documentSymbolsTree.ts:343-375 的比较：OutlineGroup 之间按 order，OutlineElement 之间按所选维度。
// Range.compareRangesUsingStarts 的等价实现（editor/common/core/range.js:372-397：只读四个端点字段）。
export function compareRangesUsingStarts(a, b) {
    if (a.startLineNumber !== b.startLineNumber) return a.startLineNumber - b.startLineNumber;
    if (a.startColumn !== b.startColumn) return a.startColumn - b.startColumn;
    if (a.endLineNumber !== b.endLineNumber) return a.endLineNumber - b.endLineNumber;
    return a.endColumn - b.endColumn;
}

// documentSymbolsTree.ts:322：`safeIntl.Collator(undefined, { numeric: true })`。
const collator = new Intl.Collator(undefined, { numeric: true });

export const SYMBOL_SORT_ORDER_CONFIG = "breadcrumbs.symbolSortOrder"; // breadcrumbs.ts:152-163

function compareElements(order, a, b) {
    if (order === "name") {
        return collator.compare(a.symbol.name, b.symbol.name) || compareRangesUsingStarts(a.symbol.range, b.symbol.range);
    }
    if (order === "type") {
        return a.symbol.kind - b.symbol.kind || collator.compare(a.symbol.name, b.symbol.name);
    }
    return compareRangesUsingStarts(a.symbol.range, b.symbol.range) || collator.compare(a.symbol.name, b.symbol.name);
}

/**
 * 子节点的排序（DocumentSymbolComparator.compare* + OutlineTreeSorter.compare 的组合）。
 * @param {any[]} children
 * @param {'position'|'name'|'type'} order
 * @returns {any[]} 排序后的新数组（不改动入参）
 */
export function sortSymbols(children, order) {
    return [...children].sort((a, b) => {
        const aElement = isOutlineElement(a);
        const bElement = isOutlineElement(b);
        if (!aElement && !bElement) return a.order - b.order;
        if (aElement && bElement) return compareElements(order, a, b);
        return 0;
    });
}

export function isOutlineElement(node) {
    return Boolean(node?.symbol);
}

function childrenOf(node) {
    return node?.children ? [...node.children.values()] : [];
}

/**
 * 树 → 可见行（等价于 monaco IndexTreeModel 的可见节点序列，indexTreeModel.js:83-96）。
 *
 * 行的字段与 monaco 的 ITreeNode 对应：depth、collapsible、collapsed、
 * 加上渲染需要的 label/icon/title 与 identity（element.id，见 TreeElement.findId）。
 * 根输入（outline 自身）depth 0 不渲染，它的子节点 depth 1（asyncDataTree.js:783 的
 * `this.root.element = input` 决定了输入元素就是不可见的内部根）。
 *
 * 被过滤掉的元素连同其子树一起不可见（filter 的 TreeVisibility.Recurse 语义，
 * monaco IndexTreeModel.js:213-232 只对可见的父子集建行）。
 *
 * collapsible 取**未过滤**的子节点数（indexTreeModel.js:340
 * `node.collapsible = node.collapsible || node.children.length > 0`，而 `children` 里
 * 含被 filter 判为不可见的子节点）—— 故子节点全被 `breadcrumbs.show*` 过滤掉的元素仍是
 * 可展开行（展开后为空），与权威一致。
 * aria 的 setSize / posInSet 取**可见**兄弟数（abstractTree.js:148-155 的 getSetSize/getPosInSet：
 * 父节点的 visibleChildrenCount 与 visibleChildIndex + 1）。
 * ancestorIds 为「从根输入到自己父节点」的身份链（下标 = 该祖先的深度），
 * 供缩进参考线的活动态判定使用（见 breadcrumbsPicker.js 的 activeIndentNodeIds）。
 *
 * @param {any} root outline 模型（children 为 Map）
 * @param {{ order: 'position'|'name'|'type', isVisible: (element: any) => boolean, isCollapsed: (id: string) => boolean, indent?: number }} options
 */
export function flattenSymbolRows(root, { order, isVisible, isCollapsed, indent = DEFAULT_TREE_INDENT }) {
    const rows = [];

    const visit = (container, depth, ancestorIds) => {
        const children = sortSymbols(childrenOf(container), order);
        const visible = children.filter(child => isVisible(child));
        visible.forEach((element, position) => {
            const collapsible = childrenOf(element).length > 0;
            const collapsed = collapsible && isCollapsed(element.id);
            rows.push({
                element,
                id: element.id,
                depth,
                collapsible,
                collapsed,
                setSize: visible.length,
                posInSet: position + 1,
                ancestorIds,
                label: symbolNavigationLabel(element),
                icon: symbolIconId(element),
                title: symbolRowTitle(element),
                ariaLabel: symbolAriaLabel(element),
                isGroup: !isOutlineElement(element),
                // IconLabel.setLabel(name, detail)（documentSymbolsTree.ts:226-231）：
                // 分组没有 description，元素取 symbol.detail（monaco.d.ts:8440 恒为字符串）。
                detail: isOutlineElement(element) ? element.symbol.detail : undefined,
                // tags 含 SymbolTag.Deprecated(1) 时给标签加 `deprecated` 类
                // （documentSymbolsTree.ts:232-235；样式 iconlabel.css:91-94）。
                deprecated: isOutlineElement(element) && Boolean(element.symbol.tags?.includes(SYMBOL_TAG_DEPRECATED)),
                metrics: symbolRowMetrics(depth, indent)
            });
            if (collapsible && !collapsed) visit(element, depth + 1, [...ancestorIds, element.id]);
        });
    };

    visit(root, 1, [root.id]);
    return rows;
}

/**
 * 行缩进的三个取值（abstractTree.js:257/328-329 的 TreeRenderer.renderElement/renderTreeElement）：
 *   indentSize    = defaultIndent + (depth - 1) * indent      → twistie 的 padding-left
 *   indentWidth   = indentSize + indent - 16                 → 缩进容器的宽度
 * 缩进容器本身固定 left: 16px（tree.css:16-23），容器高的 100%。
 * 缩进参考线数量 = 祖先数（含不可见的根输入，abstractTree.js:360-390 的 _renderIndentGuides
 * 走 `getParentNodeLocation` 直到 undefined，indexTreeModel.js:518-528 对 depth-1 返回 `[]` 而非 undefined）。
 */
export function symbolRowMetrics(depth, indent = DEFAULT_TREE_INDENT) {
    const indentSize = DEFAULT_TREE_INDENT + (depth - 1) * indent;
    return {
        indentSize,
        twistiePaddingLeft: indentSize,
        indentWidth: Math.max(indentSize + indent - 16, 0),
        guideCount: depth,
        guideWidth: indent
    };
}
