// 编辑器设置项在配置注册表中的登记（对齐 <vscode>/src/vs/editor/common/config/editorOptions.ts
// 中 `EditorOption` 自带 schema 的做法）。
//
// 只登记本仓库真正会读写的两项；权威把整个 editor 配置段（数百项）都登记进来，
// 本仓库其余编辑器选项仍由 EditorPart 直接传给 monaco（见 workbench/contrib/editor/EditorPart.vue）。
//
// 取值出处：
//   editor.wordWrap          —— editorOptions.ts:6846-6872（EditorStringEnumOption，默认 'off'，
//                               enum 为 off / on / wordWrapColumn / bounded）；
//   editor.minimap.enabled   —— editorOptions.ts:3478（minimap 的 DEFAULTS.enabled = true）、
//                               :3495-3499（type: boolean、default: defaults.enabled）。
import { configurationRegistry } from "@/platform/configuration/common/configurationRegistry.js";

configurationRegistry.registerConfiguration({
    id: "editor",
    title: "编辑器",
    properties: {
        "editor.wordWrap": {
            type: "string",
            enum: ["off", "on", "wordWrapColumn", "bounded"],
            default: "off",
            description: "Controls how lines should wrap."
        },
        "editor.minimap.enabled": {
            type: "boolean",
            default: true,
            description: "Controls whether the minimap is shown."
        }
    }
});
