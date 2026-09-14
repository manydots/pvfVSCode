// 编辑器主题：PVF Dark（= VS Code 当前的默认深色主题 Dark 2026）。
//
// 来源（门控 §1）：<vscode>/extensions/theme-defaults/themes/2026-dark.json
// （colors 取自该文件，token 颜色见 @/monaco/themeTokens.js）。工作台侧的同名配色在
// src/styles/theme.css，两者同源同值。
//
// 为什么 token 颜色必须显式登记：
//   VS Code 从主题扩展的 JSON 里读 tokenColors（colorThemeData.ts:103-152 组装、:782-787 处理
//   include），而 npm 的 monaco-editor 发行包只内置旧版 vs / vs-dark 规则
//   （editor/standalone/common/themes.js）。inherit 会把那套旧规则排在前面，于是「主题是
//   2026 的、语法颜色是 Dark+ 旧版」—— 表现是关键字蓝色 #569cd6、函数名与变量没有颜色标记。
//   所以这里把主题链的 tokenColors 展开成 monaco 的 rules（themeTokens.js），缺口与差异登记在
//   docs/vscode-reference.md 第 5 节，并由 scripts/check-syntax-colors.mjs 逐 token 比对。
//
// 例外：NUT（Squirrel）的字符串是唯一一条不取主题链的语言级覆盖 —— 取 Dark+ / Dark Modern 的
// `string` 色 #CE9178（见 docs/vscode-reference.md 第 5 节）。规则 token 名带 `.squirrel` 段，
// 因此 JS 等其它语言的 `string` 仍是主题链的 #A5D6FF。
import { DARK_2026_TOKEN_RULES } from "@/monaco/themeTokens.js";

export const PVF_DARK_THEME = {
    base: "vs-dark",
    // inherit 保持 true 是为了继续用内置 vs-dark 的 colors（编辑器部件的兜底配色，
    // 见 standaloneThemeService.js:115-148）；token 颜色不受影响 —— themeTokens.js 末尾对
    // 「内置有、主题链没有」的 token 做了显式覆盖，check-syntax-colors 会验证两者取值一致。
    inherit: true,
    rules: DARK_2026_TOKEN_RULES,
    // 取值逐条对照 2026-dark.json 的 colors（同值，含八位十六进制的 alpha）。
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
        // 高亮范围（面包屑 picker 预览当前符号体用的 `.rangeHighlight` 装饰，
        // documentSymbolsOutline.ts:246-256）。必须显式写出：主题链未覆盖时 monaco 取
        // editorColorRegistry.js:26 的 dark 默认值 #ffffff0b，而 2026-dark.json:126 覆盖为 #ffffff13。
        // 边框那条（editorColorRegistry.js:27）dark 默认为 null，monaco 不注入该变量，
        // editor.css 里引用 `--vscode-editor-rangeHighlightBorder` 的 border 声明随之失效 —— 与 VS Code 一致。
        "editor.rangeHighlightBackground": "#ffffff13",
        "editorWidget.background": "#202122",
        "editorWidget.border": "#2a2b2c"
    }
};
