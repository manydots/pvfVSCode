// 无头核查「符号取数链路」：monaco outline → 粘性滚动候选行 / 面包屑符号段。
//
// 为什么需要它：编辑器顶部那两处与符号相关的界面（面包屑的「当前方法」段、滚动时固定的
// 作用域行）都依赖同一条链路 —— DocumentSymbolProvider → OutlineModel → 消费者。
// 这条链路出问题时界面表现是「什么都没显示」，静态 grep 看不出来，所以用一个 Node 逻辑
// 测试把它跑通（AGENTS.md 第 5 条允许的验证手段之一）。
//
// 运行：node scripts/check-outline.mjs
//
// 说明：Node 不认识 Vite 的 `@` 别名，故本脚本用相对 URL 动态载入纯函数模块；
// 业务代码仍统一使用 `@/...`（AGENTS.md 第 8 条）。
import { LanguageFeatureRegistry } from "monaco-editor/editor/common/languageFeatureRegistry.js";
import { OutlineModel, OutlineModelService } from "monaco-editor/editor/contrib/documentSymbols/browser/outlineModel.js";
import { CancellationToken } from "monaco-editor/base/common/cancellation.js";
import { SymbolKind } from "monaco-editor/editor/common/standalone/standaloneEnums.js";
import { URI } from "monaco-editor/base/common/uri.js";
import { readFileSync } from "node:fs";

const srcRoot = new URL("../src/", import.meta.url);
const { parseSquirrelSymbols, toDocumentSymbols } = await import(new URL("extensions/pvf/browser/squirrelSymbols.js", srcRoot));
const { collectPath } = await import(new URL("monaco/outlinePath.js", srcRoot));

const samplePath = new URL("../src/samples/common.nut", import.meta.url);
const source = readFileSync(samplePath, "utf8");

// 与 extensions/pvf/browser/pvfExtension.js 的注册方式一致（真实 LanguageFeatureRegistry，仅模型用最小替身）。
const registry = new LanguageFeatureRegistry(() => 0);
registry.register("squirrel", {
    provideDocumentSymbols: model => toDocumentSymbols(parseSquirrelSymbols(model.getValue().split(/\r?\n/)), SymbolKind)
});

const model = {
    uri: URI.file("samples/common.nut"),
    getLanguageId: () => "squirrel",
    getValue: () => source,
    getVersionId: () => 1,
    isTooLargeForSyncing: () => false,
    isForSimpleWidget: false
};

const outline = await OutlineModel.create(registry, model, CancellationToken.None);
const fail = message => {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
};

// 1) 粘性滚动的 outline 层判据是 `outline.children.size > 0`
//    （stickyScrollModelProvider.js:176）；为空则退到 folding / indentation 层。
const topLevel = [...outline.children.values()];
console.log(`outline 顶层元素 = ${topLevel.length}`);
if (topLevel.length === 0) fail("outline 为空：粘性滚动会退化成按缩进取行，面包屑符号段为空");
for (const element of topLevel) {
    if (!element.symbol.range || !element.symbol.selectionRange) fail(`符号 ${element.symbol.name} 缺少 range / selectionRange`);
}

// 2) 面包屑符号段：光标在 requestBuy（8-17 行）内时应取到该函数。
const path = [];
collectPath(outline, { lineNumber: 10, column: 1 }, path);
console.log(`光标 10 行的符号链 = ${path.map(element => element.symbol.name).join(" > ") || "(空)"}`);
if (path.length !== 1 || path[0].symbol.name !== "requestBuy") fail("光标在 requestBuy 内却未取到该符号");

// 3) 光标在符号外（两个声明之间的空隙行）时符号段应为空，面包屑只显示文件路径段。
//    这也是**启动态**的对偶：默认预览文件的初始光标是 {1,1}，而第 1 行现在是全局变量
//    `DEBUG <- isDebugMode();` 的声明行（变量符号可点击跳转，见 squirrelSymbols.js），
//    启动态面包屑会显示该变量段 —— 与 VS Code「光标所在符号」的语义一致。
//    真正的「符号外」位置是函数之间的空隙（如第 52-53 行的空行段）。
const outside = [];
collectPath(outline, { lineNumber: 52, column: 1 }, outside);
console.log(`光标 52 行（函数间空隙）的符号链 = ${outside.map(element => element.symbol.name).join(" > ") || "(空)"}`);
if (outside.length !== 0) fail("光标不在任何符号内时不应取到符号");

// 3b) 全局变量（槽赋值）也是符号：光标停在其声明行要取到该变量（可点击跳转）。
const globalVar = [];
collectPath(outline, { lineNumber: 1, column: 1 }, globalVar);
console.log(`光标 1 行（全局变量声明）的符号链 = ${globalVar.map(element => element.symbol.name).join(" > ") || "(空)"}`);
if (globalVar.length !== 1 || globalVar[0].symbol.name !== "DEBUG") fail("光标在全局变量声明行却未取到该变量符号");

// 3b) 声明行属于符号内部（`function requestBuy(...)` 在第 8 行）：光标停在声明行时也要显示该符号段。
const declaration = [];
collectPath(outline, { lineNumber: 8, column: 1 }, declaration);
console.log(`光标 8 行（声明行）的符号链 = ${declaration.map(element => element.symbol.name).join(" > ") || "(空)"}`);
if (declaration.length !== 1 || declaration[0].symbol.name !== "requestBuy") fail("光标在符号声明行却未取到该符号");

// 4) 内容变化必须让符号段跟着变 —— 这是面包屑「内容变化」触发源（documentSymbolsOutline.ts:198-204）
//    能生效的前提：OutlineModelService 按 textModel 的 versionId 校验缓存
//    （outlineModel.js:218），版本变了就重建 outline。若这里取到旧符号，编辑后面包屑会一直显示过期段。
const service = new OutlineModelService(
    { documentSymbolProvider: registry },
    { for: () => ({ update: () => {} }) },
    { onModelRemoved: () => ({ dispose() {} }) }
);
const mutable = {
    uri: URI.file("samples/common.nut"),
    getLanguageId: () => "squirrel",
    getValue: () => source,
    getVersionId: () => versionId,
    isTooLargeForSyncing: () => false,
    isForSimpleWidget: false
};
let versionId = 1;
const beforeEdit = await service.getOrCreate(mutable, CancellationToken.None);
const cached = await service.getOrCreate(mutable, CancellationToken.None);
if (cached !== beforeEdit) fail("模型未变化时 outline 应命中缓存，不应重复构建");

// 追加一个函数（monaco 的 onDidChangeContent 会让 versionId 递增），再取一次。
versionId += 1;
const editedSource = `${source}\nfunction addedByEdit() {\n    return 1;\n}\n`;
mutable.getValue = () => editedSource;
const afterEdit = await service.getOrCreate(mutable, CancellationToken.None);
const editedNames = [...afterEdit.children.values()].map(element => element.symbol.name);
console.log(`编辑后 outline 顶层元素 = ${editedNames.length}（新增 addedByEdit：${editedNames.includes("addedByEdit")}）`);
if (afterEdit === beforeEdit) fail("内容变化后仍取到缓存的 outline：面包屑会显示过期符号");
if (!editedNames.includes("addedByEdit")) fail("内容变化后的 outline 未包含新增符号");

// 4b) 符号解析的行注释边界必须与词法（squirrel.js 的 whitespace 状态）一致：
//     两种行注释（`//`、`#PVF_File` 这类 `#` 行）都不产生符号，行内的大括号也不计入块范围配平。
//     用例把注释放在函数体内（含一个 `{`）：若注释未剥掉，Foo 的块尾会一直配平到文件末尾。
const commentCases = [
    ["//", "// 说明 {"],
    ["#", "# 说明 {"]
];
for (const [kind, commentLine] of commentCases) {
    const text = `#PVF_File\nfunction Foo(a) {\n    ${commentLine}\n    return a;\n}\nfunction Bar(b) {\n    return b;\n}\n`;
    const parsed = parseSquirrelSymbols(text.split("\n"));
    if (parsed.length !== 2 || parsed[0].name !== "Foo") fail(`\`${kind}\` 注释改变了符号解析结果：${JSON.stringify(parsed.map(s => s.name))}`);
    if (parsed[0].endLine !== 5) fail(`\`${kind}\` 注释里的大括号被计入了块范围配平（Foo 的 endLine = ${parsed[0].endLine}，应为 5）`);
    if (parsed.some(symbol => symbol.name === "PVF_File")) fail(`\`${kind}\` 注释行被解析成了符号`);
}
console.log("行注释边界（`//` 与 `#`）与词法一致：注释行不产生符号，其中的大括号不计入块范围");

// 5) 静态断言：面包屑的四个权威触发源都接在组件上（AGENTS.md 4.4 的穷举清单）。
//    组件是 Vue 单文件、依赖 monaco 编辑器部件，Node 侧跑不起来，故核对源码接线。
const component = readFileSync(new URL("../src/workbench/contrib/editor/EditorBreadcrumbs.vue", import.meta.url), "utf8");
const groupService = readFileSync(new URL("../src/workbench/contrib/editor/editorGroupService.js", import.meta.url), "utf8");
const triggers = [
    ["模型变化 → 立即重建（documentSymbolsOutline.ts:192）", /watch\(\s*\(\)\s*=>\s*editorGroup\.activeId/],
    ["语言变化 → 立即重建（:193）", /getActiveEditorInput\(\)\?\.languageId/],
    ["内容变化 → 防抖重建（:198-204）", /getActiveEditorInput\(\)\?\.contentVersion/],
    ["光标变化 → 150ms 防抖（:364-371）", /SYMBOL_CURSOR_DEBOUNCE/]
];
for (const [name, pattern] of triggers) {
    if (!pattern.test(component)) fail(`面包屑缺少触发源：${name}`);
}
if (!groupService.includes("entry.contentVersion = model.getVersionId()")) fail("内容版本号未随 model 内容变化更新，内容变化触发源不会触发");
// 防抖值必须取 provider 实测耗时的下限（monaco 发行包的 getDebounceValue 未导出，见文档第 5 节）。
if (!/SYMBOL_CONTENT_DEBOUNCE = 350/.test(component)) fail("内容变化防抖值不是 provider 下限 350ms（见 docs/vscode-reference.md 第 5 节）");
if (!/SYMBOL_CURSOR_DEBOUNCE = 150/.test(component)) fail("光标变化防抖值不是权威的 150ms（documentSymbolsOutline.ts:364-371）");

if (!process.exitCode) console.log("OK 符号取数链路（粘性滚动 outline 层 / 面包屑符号段）");
