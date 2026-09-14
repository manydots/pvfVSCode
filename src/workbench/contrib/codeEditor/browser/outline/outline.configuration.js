// 大纲（outline）配置段中本仓库消费得到的那一项
// （对齐 <vscode>/src/vs/workbench/contrib/outline/browser/outline.contribution.ts:44-56
// 的 registerConfiguration({ id: 'outline', order: 117, title: "Outline", ... })）。
//
// 为什么放在这里：本仓库没有「大纲」视图（outline.contribution.ts 的视图容器与 outlinePane.ts 未迁移），
// `outline.icons` 的唯一消费方是文档符号行的渲染器 ——
// DocumentSymbolRenderer.renderElement 逐次渲染时读它（documentSymbolsTree.ts:221-226：
// 为真才给 .outline-element-icon 加 `inline codicon-colored codicon-<id>`），
// 而面包屑的符号选择器用的正是这套渲染器（breadcrumbsPicker.ts:471-486 的 config.renderers）。
//
// 未登记：outline.collapseItems、outline.problems.enabled 等 —— 它们的消费方（outlinePane.ts、
// 标记信息渲染）本仓库没有。权威的 outline.* 过滤开关是 `outline.show<Kind>`，
// 本仓库的符号行只用于面包屑，故只登记面包屑前缀的那一套（见 breadcrumbs.configuration.js）。
import { configurationRegistry } from "@/platform/configuration/common/configurationRegistry.js";

export const OUTLINE_ICONS_CONFIG = "outline.icons";

configurationRegistry.registerConfiguration({
    id: "outline",
    // 权威标题为 "Outline"
    title: "大纲",
    order: 117,
    type: "object",
    properties: {
        [OUTLINE_ICONS_CONFIG]: {
            description: "Render Outline elements with icons.",
            type: "boolean",
            default: true
        }
    }
});
