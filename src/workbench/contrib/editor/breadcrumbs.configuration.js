// 面包屑的配置项登记（对齐 <vscode>/src/vs/workbench/browser/parts/editor/breadcrumbs.ts:115-341
// 的 registerConfiguration({ id: 'breadcrumbs', title: "Breadcrumb Navigation", order: 101, ... })）。
//
// 只登记本仓库真正会读的键：
//   breadcrumbs.symbolSortOrder —— breadcrumbs.ts:152-163，消费方是面包屑符号选择器的排序
//                                  （workbench/contrib/editor/breadcrumbsPicker.js 的 showOutlinePicker）；
//   breadcrumbs.show<Kind>      —— breadcrumbs.ts:181-341 的 26 项，值取自本文档 §4.1 的取值表
//                                  （KIND_CONFIG_PAIRS，与 documentSymbolsTree.ts:328-341 的
//                                  DocumentSymbolFilter 一一对应），消费方是 isSymbolVisible。
//
// 未登记（本仓库没有消费方，故不制造空设置项）：breadcrumbs.enabled、breadcrumbs.filePath、
// breadcrumbs.symbolPath（breadcrumbs.js 固定按默认值 'on' 处理，已在 docs/vscode-reference.md
// 第 5 节登记）、breadcrumbs.icons、breadcrumbs.showEditorType、breadcrumbs.symbolPathSeparator。
//
// 裁剪：权威为 symbolSortOrder 与 26 个 show* 都标了 `scope: ConfigurationScope.LANGUAGE_OVERRIDABLE`，
// 本仓库的配置服务没有语言/资源覆盖层（见 platform/configuration/common/configurationRegistry.js
// 的说明），故不写 scope —— 与全仓其它配置项（editor.*、files.*）一致。
import { configurationRegistry } from "@/platform/configuration/common/configurationRegistry.js";
import { KIND_CONFIG_PAIRS, SYMBOL_SORT_ORDER_CONFIG } from "@/workbench/contrib/codeEditor/browser/outline/documentSymbolsTree.js";

// breadcrumbs.ts:181-341 的 26 个过滤开关，键名与 markdownDescription 逐字取自权威。
const symbolVisibilityProperties = Object.fromEntries(
    KIND_CONFIG_PAIRS.map(([, configName, label]) => [
        `breadcrumbs.${configName}`,
        {
            type: "boolean",
            default: true,
            markdownDescription: `When enabled breadcrumbs show \`${label}\`-symbols.`
        }
    ])
);

configurationRegistry.registerConfiguration({
    id: "breadcrumbs",
    // 权威标题为 "Breadcrumb Navigation"；本仓库的配置段标题用中文（同 editor → "编辑器"）。
    title: "面包屑导航",
    order: 101,
    type: "object",
    properties: {
        [SYMBOL_SORT_ORDER_CONFIG]: {
            description: "Controls how symbols are sorted in the breadcrumbs outline view.",
            type: "string",
            default: "position",
            enum: ["position", "name", "type"],
            enumDescriptions: [
                "Show symbol outline in file position order.",
                "Show symbol outline in alphabetical order.",
                "Show symbol outline in symbol type order."
            ]
        },
        ...symbolVisibilityProperties
    }
});
