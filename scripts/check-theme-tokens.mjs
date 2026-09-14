// 无头核查主题变量层：组件用到的每个 `--vscode-<token>` 都必须在 src/styles/theme.css 里定义。
//
// 为什么需要它：`var(--vscode-x)` 在变量未定义时整条声明按「无效值」丢弃（不会回退到任何颜色），
// 表现是元素直接变成透明 / 无底色 / 无描边 —— 快速输入浮层曾因缺 quickInput.background、
// quickInputList.focusBackground 等 token 整块退化成透明（即「样式错乱」），而静态看代码完全正常。
// 权威里这些变量由平台主题服务统一注入：workbench 侧见 platform/theme/common/colorUtils.ts 的
// asCssVariable；monaco 侧只在 `.monaco-editor / .monaco-diff-editor / .monaco-component` 子树内注入
// （esm/vs/editor/standalone/browser/standaloneThemeService.js 的 `_updateThemeOrColorMap`），
// 工作台级部件（标题栏、命令中心、快速输入、菜单）拿不到编辑器子树里的变量，只能由本文件提供。
//
// 运行：node scripts/check-theme-tokens.mjs
//
// 口径：扫描 src/ 下全部 .vue/.css/.js 文本里的 `var(--vscode-...)`（含注释中的示例，故注释里
// 不要写未定义的 token 形式）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const theme = fs.readFileSync(path.join(root, "src/styles/theme.css"), "utf8");

// theme.css 里的定义（`--vscode-foo: value;`）。
const defined = new Map();
for (const match of theme.matchAll(/(--vscode-[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) {
    defined.set(match[1], match[2].replace(/\s+/g, " ").trim().toLowerCase());
}

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (/\.(vue|css|js)$/.test(entry.name)) out.push(full);
    }
    return out;
}

// 使用点：token → 用到它的文件集合。
const used = new Map();
for (const file of walk(path.join(root, "src"))) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/var\(\s*(--vscode-[a-zA-Z0-9-]+)/g)) {
        if (!used.has(match[1])) used.set(match[1], new Set());
        used.get(match[1]).add(path.relative(root, file));
    }
}

const failures = [];

// 1b) 高对比度专用 token（dark 下 registerColor 默认值为 null）：主题服务因此**不注入**这些 CSS 变量，
//     `var(...)` 落空 → 整条声明按无效值丢弃 —— 这正是权威在 Dark 2026 下的行为：
//     defaultStyles.ts:184-185 的 asCssVariable 照样产出 `var(--vscode-...)` 字符串，
//     DefaultStyleController.style 也照样输出这些 Outlines 规则（listWidget.ts:975-1005），
//     靠变量缺失让它们失效。故它们**必须保持未定义**，禁止「补齐」进 theme.css
//     （补了会让深色主题长出高对比度描边，反而偏离权威）。
const nullByDesign = new Map([
    ["--vscode-contrastActiveBorder", "baseColors.ts:45 activeContrastBorder：{ light: null, dark: null, hcDark: hcLight: focusBorder }"],
    ["--vscode-list-focusAndSelectionOutline", "listColors.ts:29 listFocusAndSelectionOutline：默认 null（dark 走 listFocusOutline 回落）"],
    ["--vscode-list-activeSelectionIconForeground", "listColors.ts:41 listActiveSelectionIconForeground：默认 null"],
    ["--vscode-list-inactiveSelectionIconForeground", "listColors.ts:53 listInactiveSelectionIconForeground：默认 null"],
    ["--vscode-editor-rangeHighlightBorder", "editorColorRegistry.ts:18 editorRangeHighlightBorder：{ light: null, dark: null }"]
]);
for (const [token, why] of nullByDesign) {
    if (defined.has(token)) {
        failures.push(`不应定义：${token}\n    ${why}\n    该变量应由「缺失」表达（dark 下为 null），定义它会让声明重新生效`);
    }
    used.delete(token);
}

// 1) 全部使用点都已定义。
for (const [token, files] of [...used].sort()) {
    if (!defined.has(token)) {
        failures.push(`未定义：${token}\n    使用处: ${[...files].join(", ")}\n    需按权威出处补进 src/styles/theme.css，禁止让 var() 落空`);
    }
}

// 2) 快速输入 / 命令面板的颜色与尺寸 token 取值（2026-dark.json:234-241、platform/theme/common/colors/
//    inputColors.ts:212-226、editorColors.ts:339-341、platform/theme/common/sizes/baseSizes.ts:27-29/106-108、
//    workbench/browser/media/style.css:61）—— 这几个缺失正是「浮层透明、当前项无底色、圆角与阴影丢失」的成因。
const expectedValues = [
    ["--vscode-quickInput-background", "#202122"],
    ["--vscode-quickInput-foreground", "#bfbfbf"],
    ["--vscode-quickInputList-focusBackground", "#297aa0"],
    ["--vscode-quickInputList-focusForeground", "#ffffff"],
    ["--vscode-quickInputList-focusIconForeground", "#ffffff"],
    ["--vscode-keybindingLabel-background", "#8080802b"],
    ["--vscode-keybindingLabel-foreground", "#cccccc"],
    ["--vscode-keybindingLabel-border", "#33333399"],
    ["--vscode-keybindingLabel-bottomBorder", "#44444499"],
    ["--vscode-widget-shadow", "#0000005c"],
    ["--vscode-cornerRadius-xLarge", "12px"],
    ["--vscode-bodyFontSize-xSmall", "11px"],
    ["--vscode-shadow-xl", "0 0 20px rgba(0, 0, 0, 0.15)"]
];
for (const [token, expected] of expectedValues) {
    const actual = defined.get(token);
    if (actual !== expected) {
        failures.push(`取值不符：${token}\n    实际: ${actual ?? "(未定义)"}\n    期望: ${expected}`);
    }
}

// 3) 浮层样式表必须真的引用这些 token（防止「定义了但组件不用」的假对齐）。
const widget = fs.readFileSync(path.join(root, "src/base/quickinput/QuickInputWidget.vue"), "utf8");
for (const token of ["--vscode-quickInput-background", "--vscode-quickInputList-focusBackground", "--vscode-cornerRadius-xLarge", "--vscode-shadow-xl", "--vscode-keybindingLabel-background"]) {
    if (!widget.includes(`var(${token})`)) {
        failures.push(`未引用：${token}\n    src/base/quickinput/QuickInputWidget.vue 的样式里应当使用它`);
    }
}

for (const failure of failures) console.log(`✗ ${failure}`);
console.log(`\ntheme.css 定义 ${defined.size} 个 token；组件使用 ${used.size} 个；${failures.length === 0 ? "全部命中" : `${failures.length} 项失败`}`);
process.exit(failures.length === 0 ? 0 : 1);
