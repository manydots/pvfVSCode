// 无头核查「面包屑的文件路径段 + picker 的定位/尺寸公式」这条链路
// （AGENTS.md 第 5 条允许的 Node 逻辑测试）。
//
// 为什么需要它：文件路径段曾经是「只有最后一级」（在资源管理器根 `samples` 处截断了向上查找），
// 界面表现是「面包屑只剩文件名」——静态 grep 看不出来，所以用逻辑测试把它固定住。
// 权威取值：`breadcrumbsModel.ts:130-177` 的 `_initFilePathInfo`，本仓库按 EMPTY 分支
// （无工作区概念，`docs/vscode-reference.md:974`）取到文件系统根为止的完整路径。
//
// 固定住这几类规则：
//   1. 文件段：`samples/common.nut` → `samples › common.nut`（两段，且末段是 FILE、前段是 FOLDER）；
//      `/x.nut` → 一段；`untitled` / `data` scheme → 空（breadcrumbsModel.ts:139-144）；
//      传入工作区文件夹 / 家目录时在它们处停止（:151-156，本仓库不传，但规则要正确）；
//   2. picker 几何：宽度 = min(视口宽-8, max(240, (视口宽-8)/4.17))、最大高度 = min(视口高*0.7, 300)、
//      空间不足时 `maxHeight = innerHeight - y - 30`、箭头偏移与溢出左移（breadcrumbsControl.ts:672-705）；
//   3. picker 高度分配：树高 = min(maxHeight - 2*arrowSize, 内容高)，总高 = 树高 + 2*arrowSize
//      （breadcrumbsPicker.ts:112-127）；竖直落点为锚点下方 2px，空间不足时上翻 / 覆盖
//      （contextview.ts:337-372 + layout.ts:67-118）。
//
// 运行：node scripts/check-breadcrumbs.mjs
//
// 说明：Node 不认识 Vite 的 `@` 别名，故用 scripts/alias-loader.mjs 挂钩后再载入被测模块；
// 业务代码仍统一使用 `@/...`（AGENTS.md 第 8 条）。
import { register } from "node:module";

register(new URL("./alias-loader.mjs", import.meta.url));

const srcRoot = new URL("../src/", import.meta.url);
const { FileKind } = await import(new URL("platform/files/common/files.js", srcRoot));
const { computeFileElements } = await import(new URL("workbench/contrib/editor/breadcrumbsModel.js", srcRoot));
const { URI } = await import("monaco-editor/base/common/uri.js");

let failed = 0;
function check(description, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        console.log(`  ok   ${description} → ${a}`);
        return;
    }
    failed++;
    console.error(`  FAIL ${description} → 实际 ${a}，期望 ${e}`);
}
function ok(description, condition) {
    check(description, condition, true);
}

// ────────────────────────── 1. 文件路径段 ──────────────────────────

// `samples/common.nut` 的完整链（本仓库的启动文件）。
const sample = computeFileElements(URI.file("samples/common.nut"));
check("samples/common.nut 的段数", sample.length, 2);
check("samples/common.nut 的名称", sample.map(element => element.uri.path.split("/").pop()), ["samples", "common.nut"]);
check("samples/common.nut 的类型（前 FOLDER 后 FILE）", sample.map(element => element.fileKind), [FileKind.FOLDER, FileKind.FILE]);

// 更深一层：中间层都是 FOLDER。
const deep = computeFileElements(URI.file("samples/sub/dir/a.nut"));
check("深层路径的名称", deep.map(element => element.uri.path.split("/").pop()), ["samples", "sub", "dir", "a.nut"]);
check("深层路径的类型", deep.map(element => element.fileKind), [FileKind.FOLDER, FileKind.FOLDER, FileKind.FOLDER, FileKind.FILE]);

// 文件系统根下的文件：只有一段（根不占一段，breadcrumbsModel.ts:152 的 `path !== '/'`）。
const atRoot = computeFileElements(URI.file("x.nut"));
check("根下文件的段数", atRoot.length, 1);
check("根下文件是 FILE", atRoot[0].fileKind, FileKind.FILE);

// untitled / data 不显示文件段（breadcrumbsModel.ts:139-144）。
check("untitled 无文件段", computeFileElements(URI.from({ scheme: "untitled", path: "Untitled-1" })).length, 0);
check("data 无文件段", computeFileElements(URI.from({ scheme: "data", path: "x.nut" })).length, 0);
check("无资源时无文件段", computeFileElements(null).length, 0);

// 传入工作区文件夹 / 家目录时停止（:151-156）——本仓库不传（无工作区），规则本身仍须正确。
const insideFolder = computeFileElements(URI.file("samples/common.nut"), { workspaceFolder: URI.file("samples") });
check("文件夹处停止 → 只剩文件名", insideFolder.map(element => element.uri.path.split("/").pop()), ["common.nut"]);
const insideHome = computeFileElements(URI.file("samples/sub/dir/a.nut"), { home: URI.file("samples/sub") });
check("家目录处停止 → 家目录自身不占一段", insideHome.map(element => element.uri.path.split("/").pop()), ["dir", "a.nut"]);

// ────────────────────────── 2. picker 几何与高度 ──────────────────────────
// breadcrumbsPicker.js 依赖配置服务与主题等运行期模块，故这里只断言其纯取值公式的固定形态：
// 逐条对照源码取值，避免「实现里改了常量而文档没改」。
import fs from "node:fs";
const pickerSource = fs.readFileSync(new URL("workbench/contrib/editor/breadcrumbsPicker.js", srcRoot), "utf8");
function contains(description, snippet) {
    ok(description, pickerSource.includes(snippet));
}
contains("宽度下限 240", "Math.max(240, maxInnerWidth / 4.17)");
contains("最大高度 min(视口高*0.7, 300)", "Math.min(innerHeight * 0.7, 300)");
contains("视口内边距 8", "innerWidth - 8");
contains("空间不足时的余量 30", "innerHeight - y - 30");
contains("箭头大小 8", "const arrowSize = 8");
contains("箭头对在条目宽度 30% 处", "anchor.width * 0.3 - x");
contains("键盘触发的箭头偏移不为负", "Math.max(0, arrowOffset)");
contains("树高 = min(maxHeight - 头部, 内容高)", "Math.min(maxHeight - headerHeight, contentHeight)");
contains("头部 = 2 × 箭头大小", "const headerHeight = 2 * arrowSize");
// 视口变化只重算竖直落点：权威的 getAnchor 只在首次调用时算尺寸（breadcrumbsControl.ts:676 的
// `if (!pickerAnchor)`），resize 由 contextview 走 layout2d 重新定位（contextview.ts:339-366）。
contains("relayoutPicker 只接收视口高", "export function relayoutPicker({ viewportHeight })");
ok("relayoutPicker 不重算宽度", !/relayoutPicker[\s\S]{0,400}?\.width =/.test(pickerSource));
// 像素比变化隐藏浮层（breadcrumbsControl.ts:656 的 zoomListener）。
const controlSource = fs.readFileSync(new URL("workbench/contrib/editor/breadcrumbsControl.js", srcRoot), "utf8");
ok("resize 只用新视口高重算落点", controlSource.includes("relayoutPicker({ viewportHeight: window.innerHeight })"));
ok("注册像素比监听", controlSource.includes("(resolution: ${window.devicePixelRatio}dppx)"));
ok("像素比变化隐藏浮层", /function hidePickerByZoom\(\)[\s\S]{0,300}?hidePicker\(\)/.test(controlSource));
ok("像素比路径不设置 ignore-once", !/function hidePickerByZoom\(\)[\s\S]{0,300}?ignoreOnceKey/.test(controlSource));

// 文件图标主题的三个特征位（breadcrumbsPicker.ts:357-364）：值取自内建 Seti 主题文档本身，
// 组件按它们推导 align-icons-and-twisties / hide-arrows，而不是写死。
const seti = JSON.parse(fs.readFileSync(new URL("workbench/services/themes/seti/vs-seti-icon-theme.json", srcRoot), "utf8"));
ok("Seti 有文件图标", Boolean(seti.file));
ok("Seti 无文件夹图标", !(seti.folder || seti.folderNames || seti.folderNamesExpanded));
ok("Seti 不隐藏箭头", seti.hidesExplorerArrows !== true);
const iconThemeSource = fs.readFileSync(new URL("workbench/services/themes/fileIconTheme.js", srcRoot), "utf8");
ok("主题特征位由主题文档推导", iconThemeSource.includes("export const fileIconThemeTraits"));
const componentSourceForTraits = fs.readFileSync(new URL("workbench/contrib/editor/BreadcrumbsPicker.vue", srcRoot), "utf8");
ok("组件引用特征位", componentSourceForTraits.includes("fileIconThemeTraits.hasFileIcons && !fileIconThemeTraits.hasFolderIcons"));
ok("组件支持 hide-arrows", componentSourceForTraits.includes('classes.push("hide-arrows")'));

// ────────────────────────── 3. 组件的浮层取值 ──────────────────────────
// BreadcrumbsPicker.vue 的 DOM 与取值（箭头、树容器底色、行高、缩进参考线）逐条对照。
const componentSource = fs.readFileSync(new URL("workbench/contrib/editor/BreadcrumbsPicker.vue", srcRoot), "utf8");
function componentContains(description, snippet) {
    ok(description, componentSource.includes(snippet));
}
componentContains("浮层层级 2575", "z-index: 2575");
componentContains("箭头边框宽度取 arrowSize", "borderWidth: `${breadcrumbsPicker.arrowSize}px`");
componentContains("箭头三角取面包屑浮层底色", "transparent transparent var(--vscode-breadcrumbPicker-background)");
componentContains("树容器底色取 breadcrumbPickerBackground", "var(--vscode-breadcrumbPicker-background)");
componentContains("树容器内边距 2px", 'paddingTop: "2px"');
componentContains("树容器圆角 3px", 'borderRadius: "3px"');
componentContains("树容器边框取 widgetBorder", "1px solid var(--vscode-widget-border)");
componentContains("文件树类名 align-icons-and-twisties", '"align-icons-and-twisties"');
// 列表状态配色的选择器逐条对照 listWidget.ts:902-1007（Outlines 段在 :977-1007）：
// 非活动选中图标的规则落在 .focused 行上（:951-952），不是 .selected。
componentContains("非活动选中图标规则落在 focused 行", "${row}.focused .codicon { color: var(--vscode-list-inactiveSelectionIconForeground)");
componentContains("活动选中图标规则落在 selected 行", ':focus .monaco-list-row.selected .codicon { color: var(--vscode-list-activeSelectionIconForeground)');
componentContains("行高取 SYMBOL_ROW_HEIGHT", "SYMBOL_ROW_HEIGHT");
componentContains("Escape 不在浮层内消费（交给 breadcrumbs.selectEditor 命令）", "breadcrumbs.selectEditor");

if (failed > 0) {
    console.error(`\nFAIL 面包屑检查未通过（${failed} 项）`);
    process.exit(1);
}
console.log("\nOK 面包屑文件段与 picker 取值");
