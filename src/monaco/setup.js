// Monaco 编辑器内核初始化（使用 npm 的 monaco-editor 发行包）。
//
// 裁剪说明：只注册通用编辑器 worker，不注册 JSON/CSS/HTML/TS 语言服务 worker；
// PVF 语言能力由后续业务层按需注册。
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/editor/editor.worker?worker";
import "@/monaco/codicon/codicon.css";
import "@/monaco/codicon/codicon-glyphs.css";

self.MonacoEnvironment = {
    getWorker() {
        return new editorWorker();
    }
};

// Dark 2026 的编辑器配色（与 styles/theme.css 同源：2026-dark.json 覆盖
// dark_modern.json 继承链，即 VS Code 当前默认深色主题），作为裁剪版客户端的默认主题。
monaco.editor.defineTheme("pvf-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
        "editor.background": "#121314",
        "editor.foreground": "#bbbebf",
        "editorLineNumber.foreground": "#858889",
        "editorLineNumber.activeForeground": "#bbbebf",
        "editor.selectionBackground": "#276782dd",
        "editor.inactiveSelectionBackground": "#27678260",
        "editor.selectionHighlightBackground": "#27678260",
        "editor.lineHighlightBackground": "#242526",
        "editorCursor.foreground": "#bbbebf",
        "editor.findMatchBackground": "#27678290",
        "editor.findMatchHighlightBackground": "#27678280",
        "editorWidget.background": "#202122",
        "editorWidget.border": "#2a2b2c"
    }
});

export { monaco };
