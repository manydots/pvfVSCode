// 无头核查「序列化形态语言配置 → 编辑器内部形态」的归一化：
// extractValidConfig 的逐项校验行为，以及对真实扩展配置的回归断言。
//
// 为什么需要它：语言配置有两种形态（前者是 language-configuration.json 的形态，后者是
// monaco setLanguageConfiguration 要求的形态），二元组 `["{","}"]` 在序列化形态合法、
// 在内部形态非法 —— 直接传过去会在 monaco 的 AutoClosingPairs 里以
// `Cannot read properties of undefined (reading 'charAt')` 崩掉（曾实际发生，
// 见 docs/vscode-reference.md 第 5 节）。这个差异在静态 grep 与 build 里都看不出来，
// 又只在「打开编辑器」这条路径上表现，因此固定成逻辑测试。
//
// 断言分三部分：
//   A. 归一化规则（逐条对齐 <vscode>/.../languageConfigurationExtensionPoint.ts:151-494）；
//   B. 真实扩展配置：归一化只改形状不改取值，且能喂给崩溃栈里那个类而不抛；
//   C. 静态断言：扩展注册语言配置时必须经过归一化（防止有人再直接传配置）。
//
// 运行：node scripts/check-language-configuration.mjs
//
// 说明：被测模块用 Vite 的 `@` 别名，Node 不认识，故先挂 scripts/alias-loader.mjs
// 再用相对 URL 动态载入；业务代码仍统一使用 `@/...`（AGENTS.md 第 8 条）。
import { register } from "node:module";
import { readFileSync } from "node:fs";

register(new URL("./alias-loader.mjs", import.meta.url));

const srcRoot = new URL("../src/", import.meta.url);
// 崩溃现场的两个类（monaco-editor/esm/vs/editor/common/languages/languageConfiguration.js:111-137）
// 与同一份实现同源，直接用它做「不再抛」的证据。
const { AutoClosingPairs, StandardAutoClosingPairConditional, IndentAction } = await import("monaco-editor/editor/common/languages/languageConfiguration.js");
const { extractValidConfig } = await import(new URL("workbench/contrib/codeEditor/common/languageConfigurationExtensionPoint.js", srcRoot));
const { pvfTextLanguageConfiguration } = await import(new URL("extensions/pvf/browser/pvfText.js", srcRoot));
const { squirrelLanguageConfiguration } = await import(new URL("extensions/pvf/browser/squirrel.js", srcRoot));

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

// 故意喂非法输入时会有大量 console.warn（与权威一致的行为），这里顺手把它当断言依据：
// 返回「结果 + 告警条数」，既断言结果，也断言确实报了警（而不是静默吞掉）。
function capture(configuration, languageId = "test") {
	const warnings = [];
	const original = console.warn;
	console.warn = (...args) => warnings.push(args.join(" "));
	try {
		return { result: extractValidConfig(languageId, configuration), warnings };
	} finally {
		console.warn = original;
	}
}

function normalize(configuration, languageId = "test") {
	return capture(configuration, languageId).result;
}

console.log("── A. 归一化规则（对齐 languageConfigurationExtensionPoint.ts:151-494）──");

// A1 二元组 → 对象：内部形态的 autoClosingPairs / surroundingPairs 必须是 { open, close }
check(
	"autoClosingPairs 二元组 → { open, close }",
	normalize({ autoClosingPairs: [["{", "}"], ["[", "]"]] }).autoClosingPairs,
	[{ open: "{", close: "}" }, { open: "[", close: "]" }]
);
check(
	"surroundingPairs 二元组 → { open, close }",
	normalize({ surroundingPairs: [['"', '"']] }).surroundingPairs,
	[{ open: '"', close: '"' }]
);
// A2 brackets / blockComment 在两种形态下都是二元组，不得被改写
check(
	"brackets 保持二元组（内部形态同为二元组）",
	normalize({ brackets: [["{", "}"]] }).brackets,
	[["{", "}"]]
);
check(
	"comments.blockComment 保持二元组",
	normalize({ comments: { blockComment: ["/*", "*/"] } }).comments.blockComment,
	["/*", "*/"]
);
// A3 对象形式的 autoClosingPairs 原样保留（含 notIn）；surroundingPairs 不读 notIn
check(
	"autoClosingPairs 对象形式保留 notIn",
	normalize({ autoClosingPairs: [{ open: '"', close: '"', notIn: ["string"] }] }).autoClosingPairs,
	[{ open: '"', close: '"', notIn: ["string"] }]
);
check(
	"surroundingPairs 对象形式丢弃 notIn（权威只读 open/close）",
	normalize({ surroundingPairs: [{ open: '"', close: '"', notIn: ["string"] }] }).surroundingPairs,
	[{ open: '"', close: '"' }]
);
// A4 非法项逐项丢弃，不影响同数组内的合法项
{
	const { result, warnings } = capture({
		autoClosingPairs: [
			["{", "}"],           // 合法二元组
			["["],                // 长度不是 2
			["[", "]"],           // 合法二元组
			"(",                  // 既不是数组也不是对象
			{},                   // 缺 open
			{ open: "(", close: 1 },                       // close 不是字符串
			{ open: "(", close: ")" },                     // 合法对象
			{ open: "(", close: ")", notIn: "string" }     // notIn 不是字符串数组
		]
	});
	check("autoClosingPairs 非法项被丢弃、合法项保留", result.autoClosingPairs, [
		{ open: "{", close: "}" },
		{ open: "[", close: "]" },
		{ open: "(", close: ")" }
	]);
	check("autoClosingPairs 非法项逐条告警（5 条）", warnings.length, 5);
}
check(
	"surroundingPairs 非法项被丢弃、合法项保留",
	normalize({ surroundingPairs: [["{"], ["{", "}"]] }).surroundingPairs,
	[{ open: "{", close: "}" }]
);
// A5 字段缺失 / 类型不对 → undefined（不是空数组）
// 注：数组里的 undefined 会被 JSON.stringify 变成 null，故用 String() 展示
check(
	"字段缺失时为 undefined（而非空数组）",
	[normalize({}).autoClosingPairs, normalize({}).brackets, normalize({}).colorizedBracketPairs].map(String),
	["undefined", "undefined", "undefined"]
);
check("brackets 不是数组 → undefined + 告警", capture({ brackets: "[" }).result.brackets, undefined);
// A6 特例：colorizedBracketPairs 存在即返回数组，全项非法时是 []（权威 :312 的 result 初值）
check("colorizedBracketPairs 存在但全非法 → []", normalize({ colorizedBracketPairs: [["{"], "x"] }).colorizedBracketPairs, []);
check("colorizedBracketPairs 缺失 → undefined", normalize({}).colorizedBracketPairs, undefined);
// A7 comments.lineComment 的三种形态
check("lineComment 字符串 → 原样", normalize({ comments: { lineComment: "//" } }).comments, { lineComment: "//" });
check(
	"lineComment 对象 → { comment, noIndent }",
	normalize({ comments: { lineComment: { comment: "//", noIndent: true } } }).comments,
	{ lineComment: { comment: "//", noIndent: true } }
);
check(
	"lineComment 对象缺 comment → 丢弃并告警",
	capture({ comments: { lineComment: { noIndent: true } } }).warnings.length,
	1
);
check("comments 不是对象 → undefined 并告警", capture({ comments: 1 }).warnings.length, 1);
// A8 wordPattern：字符串 / { pattern, flags } / 非法正则
check("wordPattern 字符串 → RegExp", normalize({ wordPattern: "\\w+" }).wordPattern instanceof RegExp, true);
check("wordPattern { pattern, flags } → 带 flags 的 RegExp", normalize({ wordPattern: { pattern: "\\w+", flags: "gi" } }).wordPattern.flags, "gi");
check("wordPattern 非法正则 → undefined + 告警", capture({ wordPattern: "(" }).result.wordPattern, undefined);
check("wordPattern 非字符串非对象 → undefined + 告警", capture({ wordPattern: 42 }).warnings.length, 1);
// A9 indentationRules：两项必填
check(
	"indentationRules 缺 decreaseIndentPattern → undefined",
	normalize({ indentationRules: { increaseIndentPattern: "\\{" } }).indentationRules,
	undefined
);
check(
	"indentationRules 两项齐备 → 均为 RegExp",
	(() => {
		const r = normalize({ indentationRules: { increaseIndentPattern: "\\{", decreaseIndentPattern: "\\}" } }).indentationRules;
		return [r.increaseIndentPattern instanceof RegExp, r.decreaseIndentPattern instanceof RegExp];
	})(),
	[true, true]
);
// A10 folding：markers 的 start / end 必须成对
check("folding.offSide 单独存在 → markers 为 undefined", normalize({ folding: { offSide: true } }).folding, { offSide: true, markers: undefined });
check(
	"folding.markers 缺 end → markers 为 undefined",
	normalize({ folding: { offSide: false, markers: { start: "/\\*" } } }).folding.markers,
	undefined
);
check(
	"folding.markers 成对 → 两个 RegExp",
	(() => {
		const m = normalize({ folding: { markers: { start: "/\\*", end: "\\*/" } } }).folding.markers;
		return [m.start instanceof RegExp, m.end instanceof RegExp];
	})(),
	[true, true]
);
// A11 onEnterRules：indent 字符串 → IndentAction 数值；beforeText 必填
check(
	"onEnterRules: 'indentOutdent' → IndentAction.IndentOutdent",
	normalize({ onEnterRules: [{ action: { indent: "indentOutdent" }, beforeText: "\\{" }] }).onEnterRules[0].action.indentAction,
	IndentAction.IndentOutdent
);
check(
	"onEnterRules: 四个 indent 名称的映射",
	["none", "indent", "indentOutdent", "outdent"].map(indent =>
		normalize({ onEnterRules: [{ action: { indent }, beforeText: "x" }] }).onEnterRules[0].action.indentAction
	),
	[IndentAction.None, IndentAction.Indent, IndentAction.IndentOutdent, IndentAction.Outdent]
);
check(
	"onEnterRules: 非法 indent → 整条丢弃 + 告警",
	capture({ onEnterRules: [{ action: { indent: "bogus" }, beforeText: "x" }] }).result.onEnterRules,
	undefined
);
check(
	"onEnterRules: 缺 beforeText → 整条丢弃",
	normalize({ onEnterRules: [{ action: { indent: "indent" } }] }).onEnterRules,
	undefined
);
check(
	"onEnterRules: appendText / removeText 保留",
	(() => {
		const a = normalize({ onEnterRules: [{ action: { indent: "indent", appendText: "end", removeText: 1 }, beforeText: "x", afterText: "y" }] }).onEnterRules[0];
		return [a.action.appendText, a.action.removeText, a.afterText instanceof RegExp];
	})(),
	["end", 1, true]
);
check("autoCloseBefore 非字符串 → undefined", normalize({ autoCloseBefore: 5 }).autoCloseBefore, undefined);
check("autoCloseBefore 字符串 → 原样", normalize({ autoCloseBefore: ");" }).autoCloseBefore, ");");

console.log("── B. 真实扩展配置（崩溃回归）──");

// B1 归一化只改形状不改取值：把归一化结果的 open/close 还原成二元组，必须与原配置逐项相等
function shapeOnly(configuration) {
	// 只看会做形状转换的两个字段；brackets 等本来就不转换
	const out = {};
	for (const key of ["autoClosingPairs", "surroundingPairs"]) {
		if (configuration[key]) {
			out[key] = configuration[key].map(pair => Array.isArray(pair) ? [pair[0], pair[1]] : [pair.open, pair.close]);
		}
	}
	return out;
}
for (const [name, configuration] of [["pvfText", pvfTextLanguageConfiguration], ["squirrel", squirrelLanguageConfiguration]]) {
	const normalized = normalize(configuration, name);
	check(
		`${name}：归一化只改形状不改取值`,
		shapeOnly(normalized),
		shapeOnly(configuration)
	);
	// B2 内部形态不变量：这两个字段的每一项都必须是对象且 open/close 为字符串
	// —— 这正是 monaco 的 `pair.open.charAt(...)` 不抛的充要条件
	const allPairs = [...(normalized.autoClosingPairs ?? []), ...(normalized.surroundingPairs ?? [])];
	check(
		`${name}：autoClosingPairs/surroundingPairs 共 ${allPairs.length} 项全为 { open, close } 字符串`,
		allPairs.every(pair => typeof pair === "object" && pair !== null && typeof pair.open === "string" && typeof pair.close === "string"),
		true
	);
	// B3 取值非空：空串虽不抛 charAt，但会产生无意义的自动闭合项（权威的 isCharacterPair 也放行，
	// 这里只做提示性断言 —— 本仓库配置里没有空串）
	check(`${name}：open / close 均非空串`, allPairs.every(pair => pair.open.length > 0 && pair.close.length > 0), true);
	// B4 崩溃回归：把归一化结果喂给崩溃栈里那两个类（复现注册表的构造方式）
	let failure = "未抛错";
	let maps = null;
	try {
		const wrapped = (normalized.autoClosingPairs ?? []).map(pair => new StandardAutoClosingPairConditional(pair));
		const autoClosingPairs = new AutoClosingPairs(wrapped);
		maps = [autoClosingPairs.autoClosingPairsOpenByStart.size, autoClosingPairs.autoClosingPairsCloseByStart.size];
	} catch (err) {
		failure = String(err);
	}
	check(`${name}：monaco AutoClosingPairs 构造不抛错`, failure, "未抛错");
	check(`${name}：非空配置产出了自动闭合项`, maps !== null && maps[0] > 0 && maps[1] > 0, true);
	// B5 brackets / blockComment / notIn 在真实配置里的形态
	check(`${name}：brackets 仍为二元组`, (normalized.brackets ?? []).every(pair => Array.isArray(pair) && pair.length === 2), true);
}
check(
	"squirrel：comments.blockComment 仍是二元组",
	normalize(squirrelLanguageConfiguration, "squirrel").comments.blockComment,
	["/*", "*/"]
);
check(
	"squirrel：字面量引号对的 notIn 保留",
	normalize(squirrelLanguageConfiguration, "squirrel").autoClosingPairs.filter(pair => pair.notIn).map(pair => pair.notIn),
	[["string"], ["string"]]
);

console.log("── C. 静态断言：注册路径必须经过归一化 ──");

const extensionSource = readFileSync(new URL("extensions/pvf/browser/pvfExtension.js", srcRoot), "utf8");
const registrations = [...extensionSource.matchAll(/monaco\.languages\.setLanguageConfiguration\(([^)]*)\)/g)].map(m => m[1]);
check("pvfExtension.js 中 setLanguageConfiguration 共 2 处", registrations.length, 2);
check(
	"2 处注册都经 extractValidConfig 归一化",
	registrations.every(args => args.includes("extractValidConfig(")),
	true
);

console.log(failed === 0 ? "\n全部通过" : `\n${failed} 项失败`);
process.exit(failed === 0 ? 0 : 1);
