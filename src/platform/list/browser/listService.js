// 列表 / 树的平台层配置登记（对齐 <vscode>/src/vs/platform/list/browser/listService.ts:1376-1421
// 的 configurationRegistry.registerConfiguration({ id: 'workbench', order: 7, ... })）。
//
// 只登记本仓库已消费的四个键：
//   workbench.list.openMode   —— :1400-1408（enum singleClick / doubleClick，默认 'singleClick'），
//                                消费方见下面 listOpenOnSingleClick 的注释；
//   workbench.tree.expandMode —— :1478-1483（enum singleClick / doubleClick，默认 'singleClick'），
//                                消费方见下面 treeExpandOnlyOnTwistieClick 的注释；
//   workbench.tree.indent     —— :1417-1422（type number，默认 8，min 4，max 40）；
//   workbench.tree.renderIndentGuides —— :1424-1430（enum none / onHover / always，默认 'onHover'），
//                                消费方为面包屑选择器的缩进参考线（BreadcrumbsPicker.vue）。
// 权威同一块里还有 multiSelectModifier、horizontalScrolling、scrollByPage、
// smoothScrolling、mouseWheelScrollSensitivity 等，
// 各自随其消费方落地（与 files.contribution.js 的同一条原则一致）。
import { configurationRegistry } from "@/platform/configuration/common/configurationRegistry.js";
import { configurationService } from "@/workbench/services/configuration/browser/configurationService.js";

export const LIST_OPEN_MODE_CONFIG = "workbench.list.openMode"; // listService.ts:171 openModeSettingKey
export const TREE_EXPAND_MODE_CONFIG = "workbench.tree.expandMode"; // listService.ts:184 treeExpandMode
export const TREE_INDENT_CONFIG = "workbench.tree.indent"; // listService.ts:179 treeIndentKey
export const TREE_RENDER_INDENT_GUIDES_CONFIG = "workbench.tree.renderIndentGuides"; // listService.ts:180 treeRenderIndentGuidesKey

// 缩进参考线的渲染方式（base/browser/ui/tree/abstractTree.ts:305-309 的 RenderIndentGuides 枚举）。
export const RenderIndentGuides = Object.freeze({
    None: "none",
    OnHover: "onHover",
    Always: "always"
});

// 树的渲染缩进默认值。两处同源：TreeRenderer.DefaultIndent（abstractTree.ts:345 = 8）
// 与上面配置项的 schema.default（listService.ts:1419）。
export const DEFAULT_TREE_INDENT = 8;

configurationRegistry.registerConfiguration({
    id: "workbench",
    order: 7,
    title: "Workbench",
    type: "object",
    properties: {
        [LIST_OPEN_MODE_CONFIG]: {
            type: "string",
            enum: ["singleClick", "doubleClick"],
            default: "singleClick",
            description:
                "Controls how to open items in trees and lists using the mouse (if supported). Note that some trees and lists might choose to ignore this setting if it is not applicable."
        },
        [TREE_EXPAND_MODE_CONFIG]: {
            type: "string",
            enum: ["singleClick", "doubleClick"],
            default: "singleClick",
            description:
                "Controls how tree folders are expanded when clicking the folder names. Note that some trees and lists might choose to ignore this setting if it is not applicable."
        },
        [TREE_INDENT_CONFIG]: {
            type: "number",
            default: DEFAULT_TREE_INDENT,
            minimum: 4,
            maximum: 40,
            description: "Controls tree indentation in pixels."
        },
        [TREE_RENDER_INDENT_GUIDES_CONFIG]: {
            type: "string",
            enum: ["none", "onHover", "always"],
            default: RenderIndentGuides.OnHover,
            description: "Controls whether the tree should render indent guides."
        }
    }
});

// 对齐 ResourceNavigator 的构造（listService.ts:698-707）：openMode 不是 'doubleClick' 即单击打开。
// 权威在配置变更时改这个标志（:700-704）；本仓库的树在每次渲染时求值，等价。
export function listOpenOnSingleClick() {
    return configurationService.getValue(LIST_OPEN_MODE_CONFIG) !== "doubleClick";
}

// 树的渲染缩进（像素）。对齐 WorkbenchAsyncDataTree 取值的写法
// （listService.ts:1161：数字才用，否则回落渲染器默认值）。
export function getTreeIndent() {
    const indent = configurationService.getValue(TREE_INDENT_CONFIG);
    return typeof indent === "number" ? indent : DEFAULT_TREE_INDENT;
}

// 缩进参考线的渲染方式：对齐 WorkbenchAsyncDataTree 取值的写法
// （listService.ts:1151：选项未显式给出时取 `workbench.tree.renderIndentGuides`），
// 取值不在枚举内时回落到 schema 默认值 'onHover'。
export function treeRenderIndentGuides() {
    const value = configurationService.getValue(TREE_RENDER_INDENT_GUIDES_CONFIG);
    return value === RenderIndentGuides.None || value === RenderIndentGuides.Always ? value : RenderIndentGuides.OnHover;
}

// 「只能在展开箭头上展开/折叠」：expandMode 为 'doubleClick' 时为真（listService.ts:1170
// `options.expandOnlyOnTwistieClick ?? (getValue(treeExpandMode) === 'doubleClick')`）。
// 面包屑的文件选择器不传该选项（breadcrumbsPicker.ts:381-396），故取这里的默认值；
// 符号选择器显式传 true（:481）。语义见 abstractTree.js:1527-1544 的 TreeNodeListMouseController。
export function treeExpandOnlyOnTwistieClick() {
    return configurationService.getValue(TREE_EXPAND_MODE_CONFIG) === "doubleClick";
}
