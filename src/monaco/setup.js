// Monaco 编辑器内核初始化（使用 npm 的 monaco-editor 发行包）。
//
// 裁剪说明：只注册通用编辑器 worker，不注册 JSON/CSS/HTML/TS 语言服务 worker；
// PVF 语言能力由后续业务层按需注册。
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/editor/editor.worker?worker";
import "@/monaco/codicon/codicon.css";
import "@/monaco/codicon/codicon-glyphs.css";
import { PVF_DARK_THEME } from "@/monaco/theme.js";

self.MonacoEnvironment = {
    getWorker() {
        return new editorWorker();
    }
};

// Dark 2026 的编辑器配色（与 styles/theme.css 同源：2026-dark.json 覆盖
// dark_modern.json 继承链，即 VS Code 当前默认深色主题），作为裁剪版客户端的默认主题。
// 颜色与 token 规则的取值出处见 @/monaco/theme.js。
monaco.editor.defineTheme("pvf-dark", PVF_DARK_THEME);

export { monaco };
