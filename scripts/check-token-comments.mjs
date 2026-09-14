// 无头核查「PVF 文本的行注释」在写回与校验两端的行为（AGENTS.md §5 允许的 Node 逻辑测试）。
//
// 为什么需要它：行注释的解析规则在这个仓库里有三处副本 ——
//   词法  src/extensions/pvf/browser/pvfText.js（Monarch；颜色与语料断言在 check:syntax-colors）
//   写回  src/utils/pvfTool.js 的 encodeTokenText（CN 归档）、src/utils/pvfToolTw.js 的 encodeTwToken（TW 归档）
//   校验  src/utils/pvfValidator.js 的 validatePvfText
// 三处不一致的失败方式是「静默损坏」：编辑器把 `// x` 画成注释（绿色），写回时却把它当成 token
// 编码进归档。这里按同一份语料逐个断言写回与校验两端的边界：
//   - `#` 与 `//` 在 **token 起始位置** 到行尾都是注释（写回跳过、校验不报错）；
//   - token 内部的 `//` / `#` 不是注释（`a//b` 仍是数据，原样编码 —— 保证不丢数据）。
//
// 运行：node scripts/check-token-comments.mjs
//
// 说明：被测模块用 Vite 的 `@` 别名，Node 不认识，故先挂 scripts/alias-loader.mjs 再动态载入
// （业务代码仍统一使用 `@/...`，AGENTS.md 第 8 条）。
import { register } from "node:module";

register(new URL("./alias-loader.mjs", import.meta.url));

const srcRoot = new URL("../src/", import.meta.url);
const { PvfArchive } = await import(new URL("utils/pvfTool.js", srcRoot));
const { TwPvfArchive } = await import(new URL("utils/pvfToolTw.js", srcRoot));
const { validatePvfText } = await import(new URL("utils/pvfValidator.js", srcRoot));

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

// ────────────────────────── 写回：CN 归档（encodeTokenText） ──────────────────────────

// encodeTokenText 经 this.getOrAddStringOffset 入字符串表，这里把该调用换成「记录取值」，
// 使断言只看 token 序列本身；token 字节为「1 字节类型 + 4 字节小端值」，与读回侧同构。
function encodeTokenText(text) {
	const archive = new PvfArchive(new ArrayBuffer(0));
	const strings = [];
	archive.getOrAddStringOffset = value => {
		strings.push(value);
		return strings.length;
	};
	const raw = archive.encodeTokenText(text);
	const tokens = [];
	for (let i = 0; i + 5 <= raw.length; i += 5) {
		tokens.push([raw[i], new DataView(raw.buffer, raw.byteOffset + i + 1, 4).getInt32(0, true)]);
	}
	return { tokens, strings };
}

// ────────────────────────── 写回：TW 归档（encodeTwToken） ──────────────────────────

// TW 侧同样把入表（_twIntern）与 strlst 回写（_twStrText / _twSetStrListText）换成桩，
// 只看 token 序列。字节布局为「0xD0 0xB0 魔数头 + 5 字节/token」。
function encodeTwToken(text) {
	const archive = new TwPvfArchive(new ArrayBuffer(0));
	const strings = [];
	archive._twIntern = value => {
		strings.push(value);
		return strings.length;
	};
	archive._twStrText = () => null;
	archive._twSetStrListText = () => {};
	const raw = archive.encodeTwToken(text);
	const tokens = [];
	for (let i = 2; i + 5 <= raw.length; i += 5) {
		tokens.push([raw[i], new DataView(raw.buffer, raw.byteOffset + i + 1, 4).getInt32(0, true)]);
	}
	return { tokens, strings };
}

// ────────────────────────── 0) 注释整行 / 行尾都被跳过 ──────────────────────────

console.log("0) 写回时 `#` 与 `//` 注释都被跳过");

for (const [name, encode] of [["CN(encodeTokenText)", encodeTokenText], ["TW(encodeTwToken)", encodeTwToken]]) {
	const baseline = JSON.stringify(encode("1 `x`"));
	ok(`${name}：# 整行注释不产生 token`, JSON.stringify(encode("# 注释\n1 `x`")) === baseline);
	ok(`${name}：#PVF_File 头不产生 token`, JSON.stringify(encode("#PVF_File\n1 `x`")) === baseline);
	ok(`${name}：// 整行注释不产生 token`, JSON.stringify(encode("// 注释\n1 `x`")) === baseline);
	ok(`${name}：行尾 # 注释不产生 token`, JSON.stringify(encode("1 `x` # 尾注释")) === baseline);
	ok(`${name}：行尾 // 注释不产生 token`, JSON.stringify(encode("1 `x` // 尾注释")) === baseline);
}

// ────────────────────────── 1) 注释只在 token 起始位置生效（不丢数据） ──────────────────────────

console.log("1) token 内部的 // 与 # 仍是数据");

// `a//b` / `a#b` 没有前置空白，裸串读取整体吃掉它们 —— 写回端必须原样保留，
// 否则「有 token 以 // 开头」的真实数据会在保存时被静默丢掉。
check("CN：a//b 仍是一个裸 token", encodeTokenText("a//b").strings, ["a//b"]);
check("TW：a//b 仍是一个裸 token", encodeTwToken("a//b").strings, ["a//b"]);
check("CN：a#b 仍是一个裸 token", encodeTokenText("a#b").strings, ["a#b"]);
check("TW：a#b 仍是一个裸 token", encodeTwToken("a#b").strings, ["a#b"]);
// 单独的 `/` 不是注释（只有 `//` 才是）。
check("CN：单个 / 仍是裸 token", encodeTokenText("/x").strings, ["/x"]);
check("TW：单个 / 仍是裸 token", encodeTwToken("/x").strings, ["/x"]);
// 反引号串里的 `#` / `//` 是字符串内容，不受注释规则影响。
check("CN：反引号串内的 # 与 // 原样保留", encodeTokenText("`a#b//c`").strings, ["a#b//c"]);
check("TW：反引号串内的 # 与 // 原样保留", encodeTwToken("`a#b//c`").strings, ["a#b//c"]);

// ────────────────────────── 2) 正常 token 不受影响（回归） ──────────────────────────

console.log("2) 正常 token 的编码不受影响（回归）");

// 语料拆出 6 个 token：整数 1、反引号串、[name] 标签、{5=...} 标记、两个浮点。
const REGRESSION = "1 `Character/Character.kor.str` [name] {5=`s`} 3.5 -1.5";
for (const [name, encode, expectedCount] of [["CN", encodeTokenText, 6], ["TW", encodeTwToken, 6]]) {
	const result = encode(REGRESSION);
	ok(`${name}：混合语料仍产生 ${expectedCount} 个 token`, result.tokens.length === expectedCount);
	ok(`${name}：注释规则不影响这些 token 的取值`, result.strings.includes("Character/Character.kor.str") && result.strings.includes("[name]"));
}
// 与「注释行 + 同样内容」的比较：只有注释被丢弃，其余逐字节一致。
check("CN：注释行前后的数据逐 token 相同",
	JSON.stringify(encodeTokenText("// c\n" + REGRESSION + "\n# c\n").tokens),
	JSON.stringify(encodeTokenText(REGRESSION).tokens));
check("TW：注释行前后的数据逐 token 相同",
	JSON.stringify(encodeTwToken("// c\n" + REGRESSION + "\n# c\n").tokens),
	JSON.stringify(encodeTwToken(REGRESSION).tokens));

// ────────────────────────── 3) 校验器：注释行不再被当作非法标记 ──────────────────────────

console.log("3) 校验器与写回端同规则");

// 这两条在扩展 `//` 之前会报「非法的 { 标记」（`//x{` 的 `{` 走进了标记分支），现在是注释。
check("`// {` 视为注释，不报错", validatePvfText("// { 说明"), []);
check("`# {` 视为注释，不报错", validatePvfText("# { 说明"), []);
check("`1 `x` // {` 视为注释，不报错", validatePvfText("1 `x` // { 说明"), []);
check("真实非法标记仍然报错", validatePvfText("{ 非法").length, 1);
check("未闭合反引号仍然报错", validatePvfText("` 未闭合").length, 1);
check("正常语料仍然通过", validatePvfText("1 `Character/Character.kor.str` [name]"), []);

console.log(failed === 0 ? "\n全部通过" : `\n${failed} 项失败`);
process.exit(failed === 0 ? 0 : 1);
