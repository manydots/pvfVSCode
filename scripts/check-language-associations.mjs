// 无头核查「资源 → languageId」的识别链：用户层（files.associations）→ 平台层 → 首行兜底。
//
// 为什么需要它：这条链决定「打开一个文件后用哪套词法 / 语言配置 / 状态栏显示什么语言」，
// 出问题时界面表现只是「颜色不对 / 语言名不对」，静态 grep 看不出来；而它又叠加了四条
// 反直觉的优先级规则，必须逐条固定下来：
//   1. 用户层（files.associations）> 平台层 > 首行；
//   2. 文件名精确匹配 > 最长 pattern > 最长扩展名（平台层内部的三档，见 monaco 的
//      getAssociationByPath）；
//   3. 同一档内「最长 pattern 胜出」，长度相同时「后注册者胜出」
//      （后者对齐 microsoft/vscode#20074）；
//   4. 识别不出或识别到的语言未注册 → plaintext。
//
// 运行：node scripts/check-language-associations.mjs
//
// 第 7 节读 src/extensions/pvf/package.json，按清单逐个断言扩展名 → 语言，
// 使「新增样本文件类型」这一步在清单层就被固定住（改清单即触发断言）。
//
// Node 不认识 Vite 的 `@` 别名，故用相对 URL 动态载入纯函数模块（AGENTS.md 第 8 条：
// 业务代码仍统一用 `@/...`）。平台层用 monaco 发行包的真实实现 ——
// registerPlatformLanguageAssociation 是 monaco 导出的平台层注册入口，本仓库不重写它。
import { readFileSync } from "node:fs";
import { registerPlatformLanguageAssociation } from "monaco-editor/editor/common/services/languagesAssociations.js";

const srcRoot = new URL("../src/", import.meta.url);
const {
	FIRST_LINE_DETECTION_LENGTH_LIMIT,
	PLAINTEXT_LANGUAGE_ID,
	clearConfiguredLanguageAssociations,
	getFirstLineText,
	getLanguageIdForResource,
	registerConfiguredLanguageAssociation,
	resolveLanguageId
} = await import(new URL("workbench/services/language/common/languageAssociations.js", srcRoot));

let failed = 0;
function check(description, actual, expected) {
	if (actual === expected) {
		console.log(`  ok   ${description} → ${actual}`);
		return;
	}
	failed++;
	console.error(`  FAIL ${description} → 实际 ${JSON.stringify(actual)}，期望 ${JSON.stringify(expected)}`);
}

// 已注册语言集合：等价于 monaco 语言注册表在启动装齐后的内容（本仓库由内置扩展清单贡献 +
// monaco 内建语言）。这里显式列出，使断言不受语言表变化影响。
const REGISTERED = new Set(["plaintext", "squirrel", "pvf-list", "pvf-dat", "pvf-token", "json", "markdown", "special-list"]);

const file = path => ({ scheme: "file", fsPath: path });
const pvf = path => ({ scheme: "pvf", path });

// ---- 0) 无命中 / 无资源 → plaintext ----
console.log("0) 兜底");
check("无资源、无首行", getLanguageIdForResource(null), PLAINTEXT_LANGUAGE_ID);
check("无资源、resolveLanguageId", resolveLanguageId(undefined, undefined, "", REGISTERED), PLAINTEXT_LANGUAGE_ID);
check("扩展名未登记", getLanguageIdForResource(file("/a/unknown.zzz")), PLAINTEXT_LANGUAGE_ID);

// ---- 1) 平台层：扩展名 / 文件名精确 / 最长 pattern ----
console.log("1) 平台层");
registerPlatformLanguageAssociation({ id: "squirrel", extension: ".nut" });
registerPlatformLanguageAssociation({ id: "pvf-list", extension: ".lst" });
registerPlatformLanguageAssociation({ id: "pvf-dat", extension: ".dat" });
registerPlatformLanguageAssociation({ id: "special-list", filename: "itemname.lst" });
registerPlatformLanguageAssociation({ id: "p1", filepattern: "a*.txt" });
registerPlatformLanguageAssociation({ id: "p2", filepattern: "*b.txt" });

check("扩展名命中（小写）", getLanguageIdForResource(file("/dir/a.nut")), "squirrel");
check("扩展名命中（大写路径）", getLanguageIdForResource(file("/dir/A.NUT")), "squirrel");
check("文件名精确优先于扩展名", getLanguageIdForResource(file("/dir/itemname.lst")), "special-list");
check("其他 .lst 走扩展名", getLanguageIdForResource(file("/dir/other.lst")), "pvf-list");
check("pattern 命中（ab.txt）", getLanguageIdForResource(file("/dir/ab.txt")), "p2");

// ---- 2) 用户层：优先于平台层，且 pattern 规则与平台层一致 ----
console.log("2) 用户层（files.associations）");
registerConfiguredLanguageAssociation({ id: "pvf-token", filepattern: "*.nut" });
check("用户层覆盖平台层", getLanguageIdForResource(file("/dir/a.nut")), "pvf-token");

registerConfiguredLanguageAssociation({ id: "json", filepattern: "**/special/*.dat" });
check("path pattern 用 ** 前缀匹配整条路径（命中）", getLanguageIdForResource(file("/x/special/a.dat")), "json");
check("path pattern 不命中其他目录", getLanguageIdForResource(file("/x/other/a.dat")), "pvf-dat");
check("不含分隔符的 pattern 匹配文件名（任意目录）", getLanguageIdForResource(file("/x/other/a.nut")), "pvf-token");
// path pattern 按「整条路径」匹配，故写 `nested/*.dat`（无 ** 前缀）匹配不到绝对路径 —— 与权威一致
registerConfiguredLanguageAssociation({ id: "json", filepattern: "nested/*.dat" });
check("path pattern 无 ** 前缀则不匹配绝对路径", getLanguageIdForResource(file("/x/nested/b.dat")), "pvf-dat");

// 最长 pattern 胜出：`common*.nut` 比 `*.nut` 长，故命中前者
registerConfiguredLanguageAssociation({ id: "markdown", filepattern: "common*.nut" });
check("用户层最长 pattern 胜出", getLanguageIdForResource(file("/dir/common.nut")), "markdown");

// 未注册的语言 id → plaintext（对齐 _createAndGetLanguageIdentifier）
registerConfiguredLanguageAssociation({ id: "no-such-language", filepattern: "*.foo" });
check("用户层指向未注册语言 → plaintext（原始识别）", getLanguageIdForResource(file("/dir/a.foo")), "no-such-language");
check("用户层指向未注册语言 → plaintext（resolveLanguageId）", resolveLanguageId(file("/dir/a.foo"), undefined, "", REGISTERED), PLAINTEXT_LANGUAGE_ID);

// 清空用户层后回落平台层
clearConfiguredLanguageAssociations();
check("清空用户层后回落平台层", getLanguageIdForResource(file("/dir/a.nut")), "squirrel");

// ---- 3) 首行兜底（平台层最低优先级，且仅在路径存在时生效）----
console.log("3) 首行兜底");
registerPlatformLanguageAssociation({ id: "pvf-token", firstline: /^\s*<!--\s*pvf/ });
check("路径未命中、首行命中", getLanguageIdForResource(file("/dir/noext"), "<!-- pvf -->"), "pvf-token");
check("路径命中时首行不参与", getLanguageIdForResource(file("/dir/a.nut"), "<!-- pvf -->"), "squirrel");
check("无路径时首行不参与（与 monaco 一致）", getLanguageIdForResource(null, "<!-- pvf -->"), PLAINTEXT_LANGUAGE_ID);

// ---- 4) 显式语言优先，资源缺失时只看显式语言 ----
console.log("4) 显式语言");
check("显式语言优先于路径识别", resolveLanguageId(file("/dir/a.nut"), "pvf-dat", "", REGISTERED), "pvf-dat");
check("显式 plaintext 等同未指定（回落路径识别）", resolveLanguageId(file("/dir/a.nut"), "plaintext", "", REGISTERED), "squirrel");
check("无资源 + 显式语言", resolveLanguageId(undefined, "squirrel", "", REGISTERED), "squirrel");
check("无资源 + 无显式语言", resolveLanguageId(undefined, undefined, "", REGISTERED), PLAINTEXT_LANGUAGE_ID);

// ---- 5) 非 file scheme 走 resource.path（pvf 归档资源的识别路径）----
console.log("5) 非 file scheme");
check("pvf scheme 按扩展名识别", getLanguageIdForResource(pvf("/character/other.lst")), "pvf-list");
check("pvf scheme 文件名精确优先", getLanguageIdForResource(pvf("/character/itemname.lst")), "special-list");
check("pvf scheme 最长 pattern", getLanguageIdForResource(pvf("/character/a.lst")), "pvf-list");

// ---- 6) 首行文本截断 ----
console.log("6) 首行文本");
check("只取第一行", getFirstLineText("abc\ndef"), "abc");
check("CRLF 也算换行", getFirstLineText("abc\r\ndef"), "abc");
check(`截断到 ${FIRST_LINE_DETECTION_LENGTH_LIMIT} 字符`, getFirstLineText("x".repeat(2000)).length, FIRST_LINE_DETECTION_LENGTH_LIMIT);
check("空内容", getFirstLineText(""), "");

// ---- 7) 内置扩展清单声明的扩展名逐个固定 ----
// 上面各节的关联都由本脚本自己登记，改 src/extensions/pvf/package.json 时测不到；
// 这一节直接以清单为准登记一遍，把「样本文件类型 → 语言」的对应固定住
// （样本见 @/builtInFiles.js；stringtable.bin 的 .bin 不在清单里 —— 它的文本形态
// `索引>文本` 不由 CONTENT_DECODERS 产生，故按纯文本打开，见 vscode-reference.md 第 5 节）。
console.log("7) 扩展清单");
const manifest = JSON.parse(readFileSync(new URL("../src/extensions/pvf/package.json", import.meta.url), "utf8"));
for (const language of manifest.contributes.languages) {
	for (const extension of language.extensions ?? []) {
		registerPlatformLanguageAssociation({ id: language.id, extension });
		check(`清单 ${extension}`, getLanguageIdForResource(file(`/samples/a${extension}`)), language.id);
	}
}
check("清单未登记的 .bin 按纯文本", getLanguageIdForResource(file("/samples/stringtable.bin")), PLAINTEXT_LANGUAGE_ID);

if (failed > 0) {
	console.error(`\n${failed} 项失败`);
	process.exitCode = 1;
} else {
	console.log("\n全部通过");
}
