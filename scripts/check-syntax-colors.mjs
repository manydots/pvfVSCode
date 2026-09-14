// 无头核查「语法着色」：编辑器主题（PVF_DARK_THEME）的 token 颜色必须与 VS Code 的深色主题链
// 一致，且两个语法真正产出的每个 token 名都能解析出颜色（否则就是「没有颜色标记」）。
//
// 权威来源（门控 §1）—— <vscode> 只读参考仓库：
//   extensions/theme-defaults/themes/dark_vs.json → dark_plus.json → dark_modern.json → 2026-dark.json
// 取值与组装语义对照：
//   <vscode>/src/vs/workbench/services/themes/common/colorThemeData.ts:103-152（tokenColors 怎么拼：
//   默认规则只有 editor.foreground / editor.background 那一条，主题里其余空 scope 条目一律忽略）
//   与 :782-787（include 的加载顺序：被包含主题的规则排在前）。
//
// 为什么需要这个检查：VS Code 从主题扩展的 JSON 里读 tokenColors，而 npm 的 monaco-editor
// 发行包只内置旧版 vs / vs-dark 规则（editor/standalone/common/themes.js），所以本仓库必须把这条链
// 显式登记成 monaco 的 rules —— src/monaco/themeTokens.js 就是它的展开结果，由本脚本 `--write`
// 生成。一旦作用域名写错或漏登记，失败方式是「静默没有颜色」：既不报错，build 也看不出来。
//
// 断言分六段：
//   A. 参考仓库在时重新展开主题链，与 src/monaco/themeTokens.js 逐条比对（防止过期/手改）；
//   B. 主题形状与取值出处（inherit / base / editor.foreground / colors 均来自 2026-dark.json）；
//   C. 用 monaco 真实 tokenizer 跑语料，逐个 token 断言「PVF_DARK_THEME 解析结果 == 主题链解析结果」
//      （PRODUCT_OVERRIDE_RULES 里的 token 不在此列：NUT 字符串与 PVF/NUT 注释，
//      都带语言段、也不得泄漏到其它语言）；
//   D. 可见性（用户可见的取值）：关键字粉、函数名淡黄、全局变量 / 形参 / 函数体内局部量 / 常量各成一色，
//      NUT 字符串橙红 #CE9178 而其它语言的字符串仍是主题链的 #A5D6FF，
//      PVF / NUT 的注释是 VS Code 经典注释绿 #6A9955 而其它语言的注释仍是主题链的 #8B949E；
//   E. 关键字覆盖：31 个保留字 + 3 个字面量 + 2 个编译期常量都落到具体作用域；
//   F. 静态断言：setup.js 只从 theme.js 取主题、作用域名不含 sanitize 会改写的字符。
//
// 运行：node scripts/check-syntax-colors.mjs
//       node scripts/check-syntax-colors.mjs --write   （重新生成 src/monaco/themeTokens.js）
//
// 说明：被测模块用 Vite 的 `@` 别名，Node 不认识，故先挂 scripts/alias-loader.mjs 再动态载入；
// 业务代码仍统一使用 `@/...`（AGENTS.md 第 8 条）。
import { register } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

register(new URL("./alias-loader.mjs", import.meta.url));

const { compile } = await import("monaco-editor/editor/standalone/common/monarch/monarchCompile.js");
const { MonarchTokenizer } = await import("monaco-editor/editor/standalone/common/monarch/monarchLexer.js");
const { TokenTheme } = await import("monaco-editor/editor/common/languages/supports/tokenization.js");
const { TokenMetadata } = await import("monaco-editor/editor/common/encodedTokenAttributes.js");
// base: "vs-dark" 对应的内置规则就是 vs_dark（standaloneThemeService.js:173-181 的 getBuiltinRules）。
const { vs_dark } = await import("monaco-editor/editor/standalone/common/themes.js");

const srcRoot = new URL("../src/", import.meta.url);
const themeDir = new URL("../../vscode/extensions/theme-defaults/themes/", import.meta.url);
const tokensFile = new URL("monaco/themeTokens.js", srcRoot);
const CHAIN = ["dark_vs", "dark_plus", "dark_modern", "2026-dark"];
const WRITE = process.argv.includes("--write");

// 本仓库两条「不取主题链、只作用于单个语言」的显式覆盖（PRODUCT_OVERRIDE_RULES），
// 取值都是 VS Code 自己的默认深色主题里的颜色，产品决定，理由与偏差登记见
// docs/vscode-reference.md 第 5 节：
//
//   1) NUT（Squirrel）字符串取 Dark Modern / Dark+ 的 `string` 色 `#ce9178`
//      （出处 <vscode>/extensions/theme-defaults/themes/dark_vs.json 的 `string`；
//      dark_plus.json:4 与 dark_modern.json:4 逐级 include 它，即 VS Code 默认深色主题里
//      字符串的实际渲染值）。
//   2) 注释取 Dark Modern / Dark+ 的 `comment` 色 `#6A9955`（出处 dark_vs.json:80-84 的
//      `comment`，即 VS Code 经典的注释绿）。2026-dark.json:300-306 把
//      comment / punctuation.definition.comment / string.comment 一起改成了灰 `#8b949e`，
//      本仓库按产品要求保留绿色；PVF 文本与 NUT 各一条，两种行注释（`//` 与 `#PVF_File`）
//      都落在这两个 token 上。
//
// 为什么必须写全路径：Monarch 的 `tokenPostfix`（squirrel.js 的 ".squirrel"、
// pvfText.js 的 ".pvf"）让 token 名以语言段收尾，而 monaco 的主题匹配沿点号逐段下行、
// 要求**连续前缀**（editor/common/languages/supports/tokenization.js 的 ThemeTrieElement.match），
// 因此 `string.squirrel` 这种跳段写法不会命中，只有 `string.quoted.double.squirrel` 才生效；
// 反过来带上语言段又保证了其它语言的同名 token 不受影响。
const NUT_STRING_RULES = [
	{ token: "string.quoted.double.squirrel", foreground: "#CE9178" },
	{ token: "string.quoted.single.squirrel", foreground: "#CE9178" }
];
const COMMENT_RULES = [
	{ token: "comment.pvf", foreground: "#6A9955" },
	{ token: "comment.squirrel", foreground: "#6A9955" }
];
const PRODUCT_OVERRIDE_RULES = [...NUT_STRING_RULES, ...COMMENT_RULES];
const OVERRIDE_TOKENS = new Set(PRODUCT_OVERRIDE_RULES.map(rule => rule.token));

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

// ────────────────────────── 主题链展开（对齐 colorThemeData.ts） ──────────────────────────

// 主题 JSON 是 JSONC（注释 + 尾随逗号），monaco 的 ESM 发行包不含 base/common/json.js，
// 这里用一个只认这两件事的扫描器，避免为此引入依赖（门控 §4.2）。
function parseJsonc(text) {
	let out = "", inString = false, escaped = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i], next = text[i + 1];
		if (inString) {
			out += c;
			if (escaped) escaped = false;
			else if (c === "\\") escaped = true;
			else if (c === '"') inString = false;
			continue;
		}
		if (c === '"') { inString = true; out += c; continue; }
		if (c === "/" && next === "/") { while (i < text.length && text[i] !== "\n") i++; out += "\n"; continue; }
		if (c === "/" && next === "*") { i += 2; while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++; i++; continue; }
		out += c;
	}
	return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

// 按 include 顺序拼出主题链的 tokenColors（分组记录来源，便于生成文件时标注）。
// 空 scope 条目丢弃：权威只保留 editor.foreground / editor.background 那一条默认规则。
function readThemeChain() {
	const groups = [];
	const rules = [];
	const colors = {};
	let editorForeground, editorBackground;
	for (const name of CHAIN) {
		const file = new URL(name + ".json", themeDir);
		if (!existsSync(file)) return null;
		const theme = parseJsonc(readFileSync(file, "utf8"));
		const start = rules.length;
		for (const entry of theme.tokenColors ?? []) {
			if (!entry.scope) continue;
			const scopes = typeof entry.scope === "string" ? [entry.scope] : entry.scope;
			for (const scope of scopes) {
				const rule = { token: scope.trim() };
				if (typeof entry.settings.foreground === "string") rule.foreground = entry.settings.foreground;
				if (typeof entry.settings.background === "string") rule.background = entry.settings.background;
				if (typeof entry.settings.fontStyle === "string") rule.fontStyle = entry.settings.fontStyle;
				rules.push(rule);
			}
		}
		groups.push({ name, entries: (theme.tokenColors ?? []).length, from: start, to: rules.length });
		for (const [id, value] of Object.entries(theme.colors ?? {})) colors[id] = value;
		if (typeof theme.colors?.["editor.foreground"] === "string") editorForeground = theme.colors["editor.foreground"];
		if (typeof theme.colors?.["editor.background"] === "string") editorBackground = theme.colors["editor.background"];
	}
	return { groups, rules, colors, editorForeground, editorBackground };
}

// 与 monaco standaloneThemeService.js:115-148 同构：inherit 时先取内置 base 规则，
// 再补一条来自 editor.foreground / editor.background 的默认规则，最后接主题自己的 rules。
function themeRulesOf(theme) {
	const rules = [];
	if (theme.inherit) {
		rules.push(...vs_dark.rules.map(rule => ({ ...rule })));
	}
	const foreground = theme.colors["editor.foreground"];
	const background = theme.colors["editor.background"];
	if (foreground || background) {
		// monaco 这里传的是带 `#` 的颜色；ColorMap.getId 两种写法都接受（tokenization.js:115-134）。
		rules.push({ token: "", foreground, background });
	}
	rules.push(...theme.rules);
	return rules;
}

function resolversOf(rules) {
	const theme = TokenTheme.createFromRawTokenTheme(rules, []);
	const colorMap = theme.getColorMap();
	return token => {
		const metadata = theme._match(token).metadata;
		const id = TokenMetadata.getForeground(metadata);
		return {
			foreground: id === 0 ? "inherit" : (colorMap[id] ?? "?").toString(),
			fontStyle: TokenMetadata.getFontStyle(metadata)
		};
	};
}

const FONT_STYLE_BITS = [[1, "italic"], [2, "bold"], [4, "underline"], [8, "strikethrough"]];
const fontStyleString = mask => mask < 0 ? undefined : FONT_STYLE_BITS.filter(([bit]) => mask & bit).map(([, name]) => name).join(" ");

// ────────────────────────── 段 A：主题链展开与 themeTokens.js 比对 ──────────────────────────

console.log("── A. 主题链展开与 src/monaco/themeTokens.js 比对 ──");

const chain = existsSync(themeDir) ? readThemeChain() : null;
const committed = (await import(tokensFile)).DARK_2026_TOKEN_RULES;
const { PVF_DARK_THEME } = await import(new URL("monaco/theme.js", srcRoot));

// 尾部覆盖：PVF_DARK_THEME 的 base 是 vs-dark 且 inherit 为 true，monaco 会把内置 vs_dark 规则
// 排在主题链之前；凡是「内置 trie 有、主题链没有」的节点都会因此拿到旧版 Dark+ 颜色。
// 这里逐个探针 token 比对「内置 + 主题链」与「主题链」的解析结果，差异项按主题链的取值补成显式规则。
function deriveTail(chain) {
	const rules = [{ token: "", foreground: chain.editorForeground, background: chain.editorBackground }, ...chain.rules];
	const reference = resolversOf(rules);
	// 探针集合取「主题链 token ∪ 内置 vs_dark token」的点号前缀闭包：monaco 解析一个 token 时沿
	// 点号逐段下行、取最深命中的节点（tokenization.js 的 ThemeTrieElement.match），而每个节点都在
	// 某个规则 token 的前缀闭包里，所以覆盖这个集合即可保证两侧对任意实际 token 的解析一致。
	const probes = new Set();
	const addWithPrefixes = token => {
		if (!token) return;
		const parts = token.split(".");
		for (let i = 1; i <= parts.length; i++) probes.add(parts.slice(0, i).join("."));
	};
	for (const rule of chain.rules) addWithPrefixes(rule.token);
	for (const rule of vs_dark.rules) addWithPrefixes(rule.token);

	// 覆盖只针对「主题链没有显式规则」的节点；已定义的节点本来就不会被内置规则盖住。
	const chainTokens = new Set(chain.rules.map(rule => rule.token));
	const tail = [];
	const covered = new Set();
	for (let round = 0; round < 8; round++) {
		const probe = resolversOf(themeRulesOf({ ...PVF_DARK_THEME, rules: [...chain.rules, ...tail] }));
		const mismatched = [...probes].filter(token => !covered.has(token)
			&& JSON.stringify(probe(token)) !== JSON.stringify(reference(token)));
		if (mismatched.length === 0) return tail;
		for (const token of mismatched) {
			covered.add(token);
			if (chainTokens.has(token)) continue;
			const want = reference(token);
			const rule = { token, foreground: want.foreground };
			// 只在「主题链给了字形样式」或「内置规则会带来字形样式」时才写 fontStyle：
			// 空串是 monaco 的显式清除（parseTokenTheme 把 "" 解析成 FontStyle.None）。
			const fontStyle = fontStyleString(want.fontStyle);
			if (fontStyle || probe(token).fontStyle !== 0) rule.fontStyle = fontStyle ?? "";
			tail.push(rule);
		}
	}
	throw new Error("尾部覆盖未收敛");
}

const expectedTail = chain ? deriveTail(chain) : [];
const expectedRules = chain ? [...chain.rules, ...expectedTail, ...PRODUCT_OVERRIDE_RULES] : committed;

// 段 C/D 一律针对「本次应有的规则」求值 —— 这样 `--write` 当次就能验证即将写入的内容，
// 不必先写一遍再跑第二遍（写之前导入的模块对象里还是旧内容）。
const effectiveTheme = { ...PVF_DARK_THEME, rules: expectedRules };

if (!chain) {
	console.log("  --   参考仓库 <vscode> 不可用，跳过主题链比对（运行期不依赖它）");
} else {
	for (const group of chain.groups) {
		console.log(`  ---- ${group.name}.json：tokenColors ${group.entries} 条 → 展开 ${group.to - group.from} 条`);
	}
	if (WRITE) {
		writeFileSync(tokensFile, renderTokensFile(chain, expectedTail));
		console.log(`  --   已重写 src/monaco/themeTokens.js（主题链 ${chain.rules.length} 条 + 尾部覆盖 ${expectedTail.length} 条 + 产品覆盖 ${PRODUCT_OVERRIDE_RULES.length} 条：NUT 字符串 ${NUT_STRING_RULES.length} + 注释 ${COMMENT_RULES.length}）`);
	} else {
		ok(`themeTokens.js 与主题链 ${chain.rules.length} 条 + 尾部覆盖 ${expectedTail.length} 条 + 产品覆盖 ${PRODUCT_OVERRIDE_RULES.length} 条逐条一致`,
			JSON.stringify(committed) === JSON.stringify(expectedRules));
	}
	// 覆盖项必须真的生效：套用 tail 后，探针集合的解析结果与纯主题链完全一致。
	const probes = [];
	const addWithPrefixes = token => {
		if (!token) return;
		const parts = token.split(".");
		for (let i = 1; i <= parts.length; i++) probes.push(parts.slice(0, i).join("."));
	};
	for (const rule of chain.rules) addWithPrefixes(rule.token);
	for (const rule of vs_dark.rules) addWithPrefixes(rule.token);
	const pure = resolversOf([
		{ token: "", foreground: chain.editorForeground, background: chain.editorBackground },
		...chain.rules
	]);
	const inherited = resolversOf(themeRulesOf(effectiveTheme));
	check("尾部覆盖后，内置 vs_dark 的残留颜色已全部消除",
		[...new Set(probes)].filter(token => JSON.stringify(inherited(token)) !== JSON.stringify(pure(token))), []);
	ok("尾部覆盖项不与主题链的规则重复",
		expectedTail.every(rule => !chain.rules.some(source => source.token === rule.token)));
}

// ────────────────────────── 段 B：主题形状与取值出处 ──────────────────────────

console.log("── B. 主题形状与取值出处 ──");

ok("base 为 vs-dark", PVF_DARK_THEME.base === "vs-dark");
ok("inherit 为 true（保留内置 vs-dark 的编辑器部件配色）", PVF_DARK_THEME.inherit === true);
ok("rules 即 themeTokens.js 的展开结果",
	JSON.stringify(PVF_DARK_THEME.rules) === JSON.stringify(committed));
ok("editor.foreground 为 2026-dark 的值 #BBBEBF",
	PVF_DARK_THEME.colors["editor.foreground"].toLowerCase() === "#bbbebf");
if (chain) {
	const fromTheme = Object.entries(PVF_DARK_THEME.colors)
		.filter(([, value]) => !Object.values(chain.colors).some(source => source.toLowerCase() === value.toLowerCase()));
	check("colors 的每个取值都能在主题链里找到", fromTheme, []);
}

const pvfTheme = resolversOf(themeRulesOf(effectiveTheme));
// 参照：VS Code 实际加载 2026-dark 后的规则集（默认规则来自 editor.foreground / editor.background）。
const referenceTheme = resolversOf([
	{ token: "", foreground: chain?.editorForeground ?? "#BBBEBF", background: chain?.editorBackground },
	...(chain?.rules ?? committed)
]);

// ────────────────────────── 语料与真实 token 采集 ──────────────────────────

const disposable = { dispose() { } };
const languageServiceStub = {
	languageIdCodec: { encodeLanguageId: () => 1, decodeLanguageId: () => "probe" },
	onDidChange: () => disposable,
	getLanguageId: () => "probe"
};
// MonarchTokenizer 只用到这两个服务接口（构造期读一次 maxTokenizationLineLength 并订阅配置变化）。
const themeServiceStub = {
	getColorTheme: () => ({ type: 2, tokenTheme: null }),
	onColorThemeChange: () => disposable
};
const configurationServiceStub = { getValue: () => 100000, onDidChangeConfiguration: () => disposable };

function collectTokens(languageId, definition, corpus) {
	const lexer = compile(languageId, definition);
	const tokenizer = new MonarchTokenizer(languageServiceStub, themeServiceStub, languageId, lexer, configurationServiceStub);
	let state = tokenizer.getInitialState();
	const seen = new Map();
	for (const line of corpus) {
		// 逐行调用是 monaco 的真实形态（Monarch 的行状态跨行传递）。
		const result = tokenizer.tokenize(line, false, state);
		state = result.endState ?? state;
		for (const token of result.tokens) {
			if (token.type && !seen.has(token.type)) seen.set(token.type, line);
		}
	}
	return seen;
}

// 语料逐条覆盖两个语法里所有会产出 token 的分支：关键字 / 字面量 / 字符串与转义 / 注释 / 数字 /
// 运算符 / 括号 / 参数表 / 函数体与嵌套块 / 顶层与函数体内的变量 / 根表访问。
const SQUIRREL_CORPUS = [
	"local func = function(param, other) { local inside = 1; return inside; }",
	"GLOBAL_NAME <- func(param2, ::root);",
	"local f = function(a, b) { return ENUM_X; } // 行注释",
	// PVF 明文导出（pvfUtility）的头，以 .nut 打开时走这套词法 —— 两种行注释都要命中 comment.squirrel。
	"#PVF_File",
	"if (x instanceof Foo) { y <- this.base.clone(); } else { z = null; }",
	"foreach (v in arr) { switch (v) { case 1: break; default: continue; } }",
	"for (local i = 0; i < 10; i++) { resume f; } while (x) { yield 1; }",
	"class Foo extends Bar { static x = 0x1F; constructor(a) {} }",
	"enum E { a = 1 } local s = \"a\\nb\\t\" + @\"raw\" + \"\\q\" + 1.5 + 0.5e-3;",
	"Table::slot = 2; local q = (1 + 2) * 3;",
	"try { throw 1; } catch (e) { delete x; }",
	"local nested = function() { local inner = { a = ::Global }; if (inner) { return __LINE__; } };",
	"GLOBAL_TABLE <- true; local t = 1;",
	"local quoted = 'single';",
	""
];
const PVF_CORPUS = [
	"# 行注释",
	"// 行注释",
	"#PVF_File",
	"`字符串 `` 转义` {5=1} {7=`s`}",
	"[标签] ?(1,2) 3.5 -1 { }",
	""
];

const sampleFile = new URL("samples/common.nut", srcRoot);
if (existsSync(sampleFile)) {
	SQUIRREL_CORPUS.push(...readFileSync(sampleFile, "utf8").split(/\r?\n/));
}

const { squirrelLanguageDefinition, SQUIRREL_KEYWORDS, SQUIRREL_CONSTANTS, SQUIRREL_BUILTINS } =
	await import(new URL("extensions/pvf/browser/squirrel.js", srcRoot));
const { pvfTextLanguageDefinition } = await import(new URL("extensions/pvf/browser/pvfText.js", srcRoot));

const squirrelTokens = collectTokens("squirrel", squirrelLanguageDefinition, SQUIRREL_CORPUS);
const pvfTokens = collectTokens("pvf-list", pvfTextLanguageDefinition, PVF_CORPUS);

// ────────────────────────── 段 C：逐 token 与主题链一致 ──────────────────────────

console.log("── C. 语法产出的每个 token 都与主题链一致 ──");

// NUT 字符串与 PVF/NUT 注释是本仓库的显式覆盖（PRODUCT_OVERRIDE_RULES），它们按定义就与主题链
// 不同，因此不参与本节的一致性断言 —— 取值改由段 D 逐条钉住，并断言没有泄漏到其它语言。
for (const [languageId, tokens] of [["squirrel", squirrelTokens], ["pvf-list", pvfTokens]]) {
	for (const [token] of tokens) {
		if (OVERRIDE_TOKENS.has(token)) continue;
		check(`${languageId}: ${token}`, pvfTheme(token), referenceTheme(token));
	}
}
// 覆盖项都带语言段，只能被对应语言的语料命中：`.pvf` 的不得出现在 squirrel 语料里，反之同理。
check("PVF 的覆盖没有泄漏到 squirrel 语料",
	[...squirrelTokens.keys()].filter(token => OVERRIDE_TOKENS.has(token) && token.endsWith(".pvf")), []);
check("Squirrel 的覆盖没有泄漏到 pvf-list 语料",
	[...pvfTokens.keys()].filter(token => OVERRIDE_TOKENS.has(token) && token.endsWith(".squirrel")), []);
if (chain) {
	ok("产品覆盖不与主题链的规则重复",
		PRODUCT_OVERRIDE_RULES.every(rule => !chain.rules.some(source => source.token === rule.token)));
}
ok(`squirrel 语料命中 ${squirrelTokens.size} 个不同 token（含注释/字符串/数字/转义）`, squirrelTokens.size >= 25);
ok(`pvf 语料命中 ${pvfTokens.size} 个不同 token`, pvfTokens.size >= 6);

// ────────────────────────── 段 D：可见性（用户可见的取值） ──────────────────────────

console.log("── D. 关键字 / 函数名 / 变量各成一色 ──");

// 取值出处均为 2026-dark.json（tokenColors 的 scope → settings.foreground），此处按解析结果钉住，
// 便于日后主题换版时立刻看到变化。monaco 的 Color 输出小写，比较时统一大小写（期望值保留文件里的原写法）。
const value = token => pvfTheme(token).foreground;
const color = (description, token, expected) =>
	check(description, (value(token) ?? "").toLowerCase(), expected.toLowerCase());
// 关键字一律粉（含控制流与声明关键字），见 squirrel.js 的 WORD_SCOPES 与 docs/vscode-reference.md 第 5 节。
color("控制流关键字 if/else（keyword.control.conditional → #C586C0，粉）",
	"keyword.control.conditional.squirrel", "#C586C0");
color("声明关键字 function/local（keyword.control → #C586C0，粉）",
	"keyword.control.squirrel", "#C586C0");
color("class/enum（storage.type.class/enum → #FF7B72）", "storage.type.class.squirrel", "#FF7B72");
color("函数名（support.function → #DCDCAA，淡黄）", "support.function.squirrel", "#DCDCAA");
color("全局变量（variable → #FFA657）", "variable.squirrel", "#FFA657");
color("形参（variable.parameter.function → #C9D1D9）", "variable.parameter.function.squirrel", "#C9D1D9");
color("函数体内局部量（variable.other.readwrite → #C9D1D9）", "variable.other.readwrite.squirrel", "#C9D1D9");
color("全大写常量（variable.other.constant → #79C0FF）", "variable.other.constant.squirrel", "#79C0FF");
// NUT 的字符串取 Dark Modern / Dark+ 的 #CE9178（出处 dark_vs.json 的 `string`，由 NUT_STRING_RULES
// 显式覆盖），不再跟随 2026-dark 的 #A5D6FF；`string.quoted.single` 同值。产品决定，见第 5 节。
color("NUT 双引号字符串（string.quoted.double.squirrel → #CE9178）", "string.quoted.double.squirrel", "#CE9178");
color("NUT 单引号字符串（string.quoted.single.squirrel → #CE9178）", "string.quoted.single.squirrel", "#CE9178");
// 覆盖带 `.squirrel` 段，所以其它语言（JS 等）的字符串仍是主题链的 #A5D6FF。
color("其它语言的字符串不受影响（string.quoted.double.js → #A5D6FF）", "string.quoted.double.js", "#A5D6FF");
// 注释取 Dark Modern / Dark+ 的 #6A9955（出处 dark_vs.json:80-84 的 `comment`，由 COMMENT_RULES
// 显式覆盖），不跟随 2026-dark 的灰 #8B949E；两种行注释（`//`、`#PVF_File`）都是这两个 token。
color("PVF 文本注释（comment.pvf → #6A9955，绿）", "comment.pvf", "#6A9955");
color("NUT 注释（comment.squirrel → #6A9955，绿）", "comment.squirrel", "#6A9955");
// 覆盖同样带语言段，其它语言（JS / Markdown 等）的注释仍是主题链的 #8B949E。
color("其它语言的注释不受影响（comment.js → #8B949E）", "comment.js", "#8B949E");
color("其它语言的注释不受影响（punctuation.definition.comment.js → #8B949E）",
	"punctuation.definition.comment.js", "#8B949E");
color("数字（constant.numeric → #B5CEA8）", "constant.numeric.squirrel", "#B5CEA8");
ok("function / local 与 return 同色（三者的取值严格相等）",
	value("keyword.control.squirrel") === value("keyword.control.flow.squirrel"));
ok("语料里 function / local 与 return 都命中各自的作用域",
	squirrelTokens.has("keyword.control.squirrel") && squirrelTokens.has("keyword.control.flow.squirrel"));
ok("全局变量与函数体内的变量颜色不同（本仓库自定，见 docs/vscode-reference.md 第 5 节）",
	value("variable.squirrel") !== value("variable.other.readwrite.squirrel"));
ok("形参与函数体内变量同色（都在函数内）",
	value("variable.parameter.function.squirrel") === value("variable.other.readwrite.squirrel"));

ok("语料里出现了全局变量（variable.squirrel）", squirrelTokens.has("variable.squirrel"));
ok("语料里出现了函数体内的局部量（variable.other.readwrite.squirrel）",
	squirrelTokens.has("variable.other.readwrite.squirrel"));
ok("语料里出现了形参（variable.parameter.function.squirrel）",
	squirrelTokens.has("variable.parameter.function.squirrel"));
// 两个被覆盖的字符串 token 都必须真的被语料命中，否则上面的取值断言只是理论值。
ok("语料里出现了 NUT 双引号字符串（string.quoted.double.squirrel）",
	squirrelTokens.has("string.quoted.double.squirrel"));
ok("语料里出现了 NUT 单引号字符串（string.quoted.single.squirrel）",
	squirrelTokens.has("string.quoted.single.squirrel"));
// 注释的两个覆盖 token 也必须真的被语料命中（`//` 与 `#PVF_File` 两种写法各一条）。
ok("语料里出现了 PVF 文本注释（comment.pvf）", pvfTokens.has("comment.pvf"));
ok("语料里出现了 NUT 注释（comment.squirrel）", squirrelTokens.has("comment.squirrel"));
ok("NUT 的两种行注释都命中 comment.squirrel",
	collectTokens("squirrel", squirrelLanguageDefinition, ["// x"]).has("comment.squirrel")
	&& collectTokens("squirrel", squirrelLanguageDefinition, ["#PVF_File"]).has("comment.squirrel"));
ok("PVF 文本的两种行注释都命中 comment.pvf",
	collectTokens("pvf-list", pvfTextLanguageDefinition, ["// x"]).has("comment.pvf")
	&& collectTokens("pvf-list", pvfTextLanguageDefinition, ["#PVF_File"]).has("comment.pvf"));
// 行注释与 PVF 文本的裸串规则的分界：`a//b` 在 PVF 文本里整体是一条裸串（与 encodeTokenText 的
// 裸串读取一致 —— 注释只在 token 起始位置生效）；Squirrel 侧不要求前置空白，`a//b` 就是注释，
// 与真实语言（JS / Squirrel）的语义一致。
ok("PVF 文本里 token 中间的 // 不是注释（a//b 整体是裸串）",
	!collectTokens("pvf-list", pvfTextLanguageDefinition, ["a//b"]).has("comment.pvf")
	&& collectTokens("pvf-list", pvfTextLanguageDefinition, ["a//b"]).has("string.pvf"));
ok("Squirrel 里紧跟标识符的 // 仍是注释（与语言语义一致）",
	collectTokens("squirrel", squirrelLanguageDefinition, ["a//b"]).has("comment.squirrel"));
ok("语料里函数体内的标识符不再落回全局档位",
	SQUIRREL_CORPUS.length > 0 && squirrelTokens.get("variable.other.readwrite.squirrel") !== undefined);

// ────────────────────────── 段 E：关键字 / 字面量 / 编译期常量的作用域覆盖 ──────────────────────────

console.log("── E. 关键字 / 字面量 / 编译期常量的作用域覆盖 ──");

check("关键字表共 31 个保留字", SQUIRREL_KEYWORDS.length, 31);
const allWords = [...SQUIRREL_KEYWORDS, ...SQUIRREL_CONSTANTS, ...SQUIRREL_BUILTINS];
const wordScopes = new Map();
for (const word of allWords) {
	const tokens = collectTokens("squirrel", squirrelLanguageDefinition, [`${word};`]);
	const scope = [...tokens.keys()].find(token => token !== "delimiter.squirrel");
	wordScopes.set(word, scope ?? "(无作用域)");
}
check("每个保留字/字面量/编译期常量都落到具体作用域",
	[...wordScopes].filter(([, scope]) => scope === "(无作用域)"), []);
check("`if` → keyword.control.conditional.squirrel", wordScopes.get("if"), "keyword.control.conditional.squirrel");
// 声明关键字统一走 keyword.control（与 return 同色）：裸词与「后跟参数表」两种形态都必须一致。
check("`function`（后无参数表）→ keyword.control.squirrel",
	wordScopes.get("function"), "keyword.control.squirrel");
check("`local` → keyword.control.squirrel", wordScopes.get("local"), "keyword.control.squirrel");
check("`const` → keyword.control.squirrel", wordScopes.get("const"), "keyword.control.squirrel");
check("`constructor` → keyword.control.squirrel", wordScopes.get("constructor"), "keyword.control.squirrel");
check("`return` → keyword.control.flow.squirrel", wordScopes.get("return"), "keyword.control.flow.squirrel");
check("`class` → storage.type.class.squirrel", wordScopes.get("class"), "storage.type.class.squirrel");
check("`enum` → storage.type.enum.squirrel", wordScopes.get("enum"), "storage.type.enum.squirrel");
// 「function name(params) { ... }」这条规则会先命中专门的函数定义规则（转入签名状态），
// 它必须给出与裸词相同的作用域，否则同一关键字在同一行里会变两次色。
{
	const tokens = collectTokens("squirrel", squirrelLanguageDefinition, ["local f = function named(a, b) { return a; }"]);
	ok("`function`（后跟名字与参数表）与裸词同作用域（keyword.control.squirrel）",
		tokens.has("keyword.control.squirrel"));
	ok("函数定义行里不再出现 storage.type.function.squirrel", !tokens.has("storage.type.function.squirrel"));
}
check("`true` → constant.language.boolean.true.squirrel",
	wordScopes.get("true"), "constant.language.boolean.true.squirrel");
check("`__LINE__` → support.constant.squirrel", wordScopes.get("__LINE__"), "support.constant.squirrel");
check("`this` → variable.language.this.squirrel", wordScopes.get("this"), "variable.language.this.squirrel");
check("`base` → variable.language.super.squirrel", wordScopes.get("base"), "variable.language.super.squirrel");

// ────────────────────────── 段 F：静态断言 ──────────────────────────

console.log("── F. 静态断言 ──");

const setupSource = readFileSync(new URL("monaco/setup.js", srcRoot), "utf8");
ok("setup.js 从 @/monaco/theme.js 取主题定义", setupSource.includes('from "@/monaco/theme.js"'));
ok("setup.js 不再内联 token 规则", !/rules\s*:\s*\[/.test(setupSource));
const themeSource = readFileSync(new URL("monaco/theme.js", srcRoot), "utf8");
ok("theme.js 注明 token 颜色来源（2026-dark.json / colorThemeData.ts）",
	themeSource.includes("2026-dark.json") && themeSource.includes("colorThemeData.ts"));

// Monarch 会把 token 名过一遍 sanitize（`&<>'"_` → `-`，monarchCommon.js:35-37），改写过就再也匹配不上
// 主题规则，所以语法里的作用域名只能是字母、数字、点。
for (const name of ["squirrel.js", "pvfText.js"]) {
	const source = readFileSync(new URL(`extensions/pvf/browser/${name}`, srcRoot), "utf8");
	const scopes = [...source.matchAll(/\[\s*[^,\]]+,\s*"([a-z][a-zA-Z0-9.]*)"/g)].map(match => match[1]);
	const illegal = scopes.filter(scope => /[&<>'"_]/.test(scope));
	check(`${name} 的作用域名不含 sanitize 会改写的字符`, illegal, []);
	ok(`${name} 至少登记了 5 个作用域名`, scopes.length >= 5);
}

console.log(failed === 0 ? "\n全部通过" : `\n${failed} 项失败`);
process.exit(failed === 0 ? 0 : 1);

// ────────────────────────── 生成器 ──────────────────────────

function renderTokensFile(chain, tail) {
	const lines = [];
	lines.push("// 本文件由 scripts/check-syntax-colors.mjs --write 生成，请勿手工编辑。");
	lines.push("//");
	lines.push("// 内容 = VS Code 深色主题继承链的 tokenColors 展开，顺序即优先级（同一 token 后者覆盖前者）：");
	for (const group of chain.groups) {
		lines.push(`//   ${group.name}.json：tokenColors ${group.entries} 条 → 展开 ${group.to - group.from} 条`);
	}
	lines.push("// 组装语义对齐 <vscode>/src/vs/workbench/services/themes/common/colorThemeData.ts:103-152、:782-787：");
	lines.push("// 被包含主题的规则排在前；默认色由 editor.foreground / editor.background 承担，主题里的空 scope 条目一律忽略。");
	lines.push("//");
	lines.push("// 为什么要在本仓库存一份：VS Code 从主题扩展的 JSON 读 tokenColors，而 npm 的 monaco-editor 发行包只内置");
	lines.push("// 旧版 vs / vs-dark 规则（editor/standalone/common/themes.js），没有这条链的等价物 —— 缺口登记在");
	lines.push("// docs/vscode-reference.md 第 5 节，由 scripts/check-syntax-colors.mjs 逐 token 比对。");
	if (tail.length) {
		lines.push("//");
		lines.push(`// 末尾 ${tail.length} 条是「内置 vs_dark 有、主题链没有」的 token 的显式覆盖：PVF_DARK_THEME 以 vs-dark 为 base 且`);
		lines.push("// inherit 为 true，monaco 会把内置规则排在前面（standaloneThemeService.js:115-148），这些 token 会因此拿到旧版");
		lines.push("// Dark+ 颜色而不是主题链的回落色；覆盖值即主题链对这些 token 的实际解析结果。");
	}
	lines.push("//");
	lines.push(`// 最后 ${PRODUCT_OVERRIDE_RULES.length} 条不属于主题链，都是本仓库的产品决定（偏差登记在 docs/vscode-reference.md 第 5 节）：`);
	lines.push(`//   NUT（Squirrel）字符串 ${NUT_STRING_RULES.length} 条 → Dark Modern / Dark+ 的 \`string\` 色 #ce9178（dark_vs.json 的 \`string\`）`);
	lines.push(`//   注释 ${COMMENT_RULES.length} 条 → Dark Modern / Dark+ 的 \`comment\` 色 #6A9955（dark_vs.json:80-84，VS Code 经典的注释绿；`);
	lines.push("//     2026-dark.json:300-306 已把 comment 改成灰 #8b949e）");
	lines.push("// 都带语言段（`.squirrel` / `.pvf`），其它语言不受影响。");
	lines.push("export const DARK_2026_TOKEN_RULES = [");
	for (const group of chain.groups) {
		if (group.to === group.from) continue;
		lines.push(`\t// ---- ${group.name}.json ----`);
		for (let i = group.from; i < group.to; i++) lines.push(`\t${JSON.stringify(chain.rules[i])},`);
	}
	if (tail.length) {
		lines.push("\t// ---- 覆盖：内置 vs_dark 独家 token ----");
		for (const rule of tail) lines.push(`\t${JSON.stringify(rule)},`);
	}
	lines.push("\t// ---- 覆盖：NUT（Squirrel）字符串（本仓库产品决定，见 docs/vscode-reference.md 第 5 节） ----");
	for (const rule of NUT_STRING_RULES) lines.push(`\t${JSON.stringify(rule)},`);
	lines.push("\t// ---- 覆盖：注释（PVF 文本 + NUT，本仓库产品决定，见 docs/vscode-reference.md 第 5 节） ----");
	for (const rule of COMMENT_RULES) lines.push(`\t${JSON.stringify(rule)},`);
	lines.push("];");
	lines.push("");
	return lines.join("\n");
}
