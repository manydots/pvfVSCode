// 无头核查编码决策链与编解码实现（对齐 <vscode>/src/vs/workbench/services/textfile 的
// common/encoding.ts + browser/textFileService.ts:819-886）。
//
// 为什么需要它：这段逻辑决定「文件里读出来的字节按哪个字符集解释、写回时按哪个字符集编码」，
// 出问题时表现是乱码或数据损坏（不是界面颜色不对那种一眼可见的偏差），而决策链本身有多条
// 优先级与回退（显式 option > 探测 > 配置 > utf8），靠 grep 与构建都查不出来。必须逐条固定：
//   1. BOM 优先于一切（utf8bom / utf16le / utf16be）；
//   2. 无 BOM 时按零字节启发式判 UTF-16 还是二进制；
//   3. 允许猜测时交给 jschardet，候选名只认 SUPPORTED_ENCODINGS 的 guessableName，
//      未知候选名不得抛错（权威 encoding.ts:180-182 捕获 jschardet 的异常）；
//   4. 决策链：encodingOverride > option.encoding > 探测结果 > files.encoding > utf8，
//      未知编码一律回落 utf8；
//   5. BOM 的强制语义：utf16le / utf16be / utf8bom 三种编码写出时必须带 BOM（hasBOM）。
//
// 运行：node scripts/check-encoding-oracle.mjs
//
// Node 不认识 Vite 的 `@` 别名，故用相对 URL 载入模块（AGENTS.md 第 8 条：业务代码仍统一
// 用 `@/...`）。被载入的两个模块都不 import `@/...`：
//   - workbench/services/textfile/common/encoding.js（本仓库唯一的编解码 / 探测 / 决策实现）
//   - utils/pvfEncoding.js（PVF 域的候选集与名字映射，纯取值）
// 因此 PVF 侧的 `detectEncoding`（@/utils/encoding.js 的薄封装，含 `@/` 导入）不在此覆盖。
const srcRoot = new URL("../src/", import.meta.url);
const {
	GUESSABLE_ENCODINGS,
	SUPPORTED_ENCODINGS,
	UTF16be,
	UTF16le,
	UTF8,
	UTF8_with_bom,
	detectEncodingByBOMFromBuffer,
	detectEncodingFromBuffer,
	encodingCodec,
	getPreferredReadEncoding,
	getPreferredWriteEncoding,
	getUnvalidatedEncoding,
	getValidatedEncoding,
	guessEncodingByBuffer,
	isUTFEncoding,
	resolveReadEncoding
} = await import(new URL("workbench/services/textfile/common/encoding.js", srcRoot));
const { PVF_CANDIDATE_GUESS_ENCODINGS, resolvePvfDetectedEncoding } = await import(new URL("utils/pvfEncoding.js", srcRoot));

let failed = 0;
function check(description, actual, expected) {
	const actualText = JSON.stringify(actual);
	const expectedText = JSON.stringify(expected);
	if (actualText === expectedText) {
		console.log(`  ok   ${description} → ${actualText}`);
		return;
	}
	failed++;
	console.error(`  FAIL ${description} → 实际 ${actualText}，期望 ${expectedText}`);
}

const bytes = (...values) => Uint8Array.from(values);
const at = (buffer, autoGuessEncoding, candidateGuessEncodings) => detectEncodingFromBuffer({ buffer, bytesRead: buffer.length }, autoGuessEncoding, candidateGuessEncodings);
const utf8 = text => encodingCodec.encode(text, UTF8);
const utf8Bom = text => bytes(0xef, 0xbb, 0xbf, ...utf8(text));

// PVF 域相关断言用的样本：归档字符串表只会是这几种文字之一
const CHINESE_SIMPLIFIED = "角色名称：鬼剑士 属性：力量 智力 体力 精神 攻击力 防御力 技能等级 冷却时间".repeat(4);
const CHINESE_TRADITIONAL = "角色名稱：鬼劍士 屬性：力量 智力 體力 精神 攻擊力 防禦力 技能等級 冷卻時間".repeat(4);
const KOREAN = "캐릭터 이름: 귀검사 힘 지능 체력 정신 공격력 방어력 스킬 레벨 쿨타임 설명".repeat(4);

// ---- 1) BOM 优先 ----
console.log("1) BOM 探测");
check("UTF-8 BOM", detectEncodingByBOMFromBuffer(utf8Bom("中文"), 9), UTF8_with_bom);
check("UTF-16 LE BOM", detectEncodingByBOMFromBuffer(bytes(0xff, 0xfe, 0x2d, 0x4e), 4), UTF16le);
check("UTF-16 BE BOM", detectEncodingByBOMFromBuffer(bytes(0xfe, 0xff, 0x4e, 0x2d), 4), UTF16be);
check("无 BOM", detectEncodingByBOMFromBuffer(utf8("中文"), 6), null);
check("空缓冲", detectEncodingByBOMFromBuffer(bytes(), 0), null);
check("探测链拿到 BOM", at(utf8Bom("中文")), { seemsBinary: false, encoding: UTF8_with_bom });
check("BOM 优先于猜测（autoGuess 为真也返回 BOM 结果）", at(utf8Bom(CHINESE_SIMPLIFIED), true, PVF_CANDIDATE_GUESS_ENCODINGS).encoding, UTF8_with_bom);

// ---- 2) 零字节启发式（无 BOM 的 UTF-16 / 二进制）----
console.log("2) 零字节启发式");
const utf16leNoBom = encodingCodec.encode("abc", UTF16le);
check("无 BOM 的 UTF-16 LE", at(utf16leNoBom).encoding, UTF16le);
check("无 BOM 的 UTF-16 BE", at(bytes(0x00, 0x61, 0x00, 0x62)).encoding, UTF16be);
check("零字节错位 → 二进制", at(bytes(0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x00, 0x02)), { seemsBinary: true, encoding: null });
check("纯 ASCII 无零字节 → 非二进制且探测不出", at(utf8("hello world hello world"), true, PVF_CANDIDATE_GUESS_ENCODINGS), { seemsBinary: false, encoding: null });

// ---- 3) jschardet 猜测 ----
console.log("3) 猜测");
check("简体中文 → gb2312", guessEncodingByBuffer(encodingCodec.encode(CHINESE_SIMPLIFIED, "gbk"), PVF_CANDIDATE_GUESS_ENCODINGS), "gb2312");
check("繁体中文 → cp950", guessEncodingByBuffer(encodingCodec.encode(CHINESE_TRADITIONAL, "big5"), PVF_CANDIDATE_GUESS_ENCODINGS), "cp950");
check("韩文 → euckr", guessEncodingByBuffer(encodingCodec.encode(KOREAN, "euc-kr"), PVF_CANDIDATE_GUESS_ENCODINGS), "euckr");
check("空候选表（全部名字未知）= 不限制候选", guessEncodingByBuffer(encodingCodec.encode(KOREAN, "euc-kr"), ["nope"]), "euckr");
check("未知候选名不抛错（权威 encoding.ts:180-182）", guessEncodingByBuffer(encodingCodec.encode(KOREAN, "euc-kr"), ["GBK"]), "euckr");
check("候选表限定后不返回候选之外的编码（韩文样本 + 仅 gb2312 候选 → 探测不出）", guessEncodingByBuffer(encodingCodec.encode(KOREAN, "euc-kr"), ["gb2312"]), null);
check("jschardet 的 ascii 结果被忽略", guessEncodingByBuffer(utf8("hello world"), ["utf8"]), null);
check("空缓冲不猜测", guessEncodingByBuffer(bytes(), PVF_CANDIDATE_GUESS_ENCODINGS), null);

// ---- 4) 决策链（textFileService.ts:826-886）----
console.log("4) 决策链");
const CONFIG_GBK = { configEncoding: "gbk" };
check("无 option / 无探测 / 无配置 → utf8", getUnvalidatedEncoding(undefined, {}), UTF8);
check("配置优先于默认值", getUnvalidatedEncoding(undefined, CONFIG_GBK), "gbk");
check("option 优先于配置", getUnvalidatedEncoding("big5", CONFIG_GBK), "big5");
check("override 优先于 option（权威 :866-870）", getUnvalidatedEncoding("big5", { configEncoding: "gbk", encodingOverride: "euckr" }), "euckr");
check("未知编码回落 utf8（权威 :879-886）", getValidatedEncoding("no-such-encoding", {}), UTF8);
check("已知编码不改写", getValidatedEncoding("gbk", {}), "gbk");
check("探测结果优先于配置", getPreferredReadEncoding(undefined, "gbk", CONFIG_GBK), { encoding: "gbk", hasBOM: false });
check("无探测结果时用配置", getPreferredReadEncoding(undefined, undefined, CONFIG_GBK), { encoding: "gbk", hasBOM: false });
check("option 优先于探测结果", getPreferredReadEncoding({ encoding: "big5" }, "gbk", CONFIG_GBK), { encoding: "big5", hasBOM: false });
check("显式 utf8 + 探测到 UTF-8 BOM → utf8bom（权威 :834-841）", getPreferredReadEncoding({ encoding: UTF8 }, UTF8_with_bom, {}), { encoding: UTF8_with_bom, hasBOM: true });
check("配置 utf8bom 且未探测到 BOM → utf8（权威 :847-849）", getPreferredReadEncoding(undefined, undefined, { configEncoding: UTF8_with_bom }), { encoding: UTF8, hasBOM: false });
check("配置 utf8bom 且探测到 BOM → utf8bom", getPreferredReadEncoding(undefined, UTF8_with_bom, { configEncoding: UTF8_with_bom }), { encoding: UTF8_with_bom, hasBOM: true });
check("utf16le 强制 BOM", getPreferredWriteEncoding(UTF16le, {}), { encoding: UTF16le, hasBOM: true });
check("utf16be 强制 BOM", getPreferredWriteEncoding(UTF16be, {}), { encoding: UTF16be, hasBOM: true });
check("写：无 option 时用配置", getPreferredWriteEncoding(undefined, CONFIG_GBK), { encoding: "gbk", hasBOM: false });
check("utf8bom/utf16 均属 UTF 族", [UTF8, UTF8_with_bom, UTF16le, UTF16be].map(isUTFEncoding), [true, true, true, true]);
check("非 UTF 编码不属于 UTF 族", isUTFEncoding("gbk"), false);

// ---- 5) 读文件端到端（探测 + 决策两步合成）----
console.log("5) 读文件端到端");
check("BOM 文件 → utf8bom + hasBOM", resolveReadEncoding(utf8Bom("中文"), undefined, {}), { encoding: UTF8_with_bom, hasBOM: true, seemsBinary: false, detectedEncoding: UTF8_with_bom });
check("GBK 文件 + 允许猜测 → gb2312（PVF 域再映射为 gbk）", resolveReadEncoding(encodingCodec.encode(CHINESE_SIMPLIFIED, "gbk"), undefined, { configAutoGuessEncoding: true, candidateGuessEncodings: PVF_CANDIDATE_GUESS_ENCODINGS }), { encoding: "gb2312", hasBOM: false, seemsBinary: false, detectedEncoding: "gb2312" });
check("GBK 文件 + 不允许猜测 → 回落配置", resolveReadEncoding(encodingCodec.encode(CHINESE_SIMPLIFIED, "gbk"), undefined, CONFIG_GBK), { encoding: "gbk", hasBOM: false, seemsBinary: false, detectedEncoding: null });
check("option.autoGuessEncoding 覆盖配置（权威 :307-313）", resolveReadEncoding(encodingCodec.encode(CHINESE_SIMPLIFIED, "gbk"), { autoGuessEncoding: true, candidateGuessEncodings: PVF_CANDIDATE_GUESS_ENCODINGS }, {}).encoding, "gb2312");
check("二进制文件报 seemsBinary", resolveReadEncoding(bytes(0x89, 0x50, 0x4e, 0x47, 0x00, 0x01), undefined, {}).seemsBinary, true);

// ---- 6) 编码表（encoding.ts:512-781）----
console.log("6) 编码表");
const keys = Object.keys(SUPPORTED_ENCODINGS);
check("条目数", keys.length, 49);
check("order 为 1..49 且唯一", keys.map(key => SUPPORTED_ENCODINGS[key].order).sort((a, b) => a - b), keys.map((_, i) => i + 1));
check("每项都有 labelLong / labelShort", keys.every(key => !!SUPPORTED_ENCODINGS[key].labelLong && !!SUPPORTED_ENCODINGS[key].labelShort), true);
check("alias 双向对称（utf8 ↔ utf8bom）", [SUPPORTED_ENCODINGS[UTF8].alias, SUPPORTED_ENCODINGS[UTF8_with_bom].alias], [UTF8_with_bom, UTF8]);
check("encodeOnly 仅 utf8bom 一项", keys.filter(key => SUPPORTED_ENCODINGS[key].encodeOnly), [UTF8_with_bom]);
check("可猜测项数", Object.keys(GUESSABLE_ENCODINGS).length, 20);
check("每个编码都能被 iconv-lite 编码", keys.filter(key => !encodingCodec.exists(key)), []);
// 候选名必须被 jschardet 接受：权威 :180-182 会吞掉异常并返回 null，
// 故这里断言「不抛错且不返回意外结果」，取值本身由第 3 节的正样本覆盖。
const jschardetRejects = Object.keys(GUESSABLE_ENCODINGS).filter(key => guessEncodingByBuffer(utf8("hello"), [key]) !== null);
check("每个 guessableName 都能被 jschardet 接受（否则候选表会静默失效）", jschardetRejects, []);
check("utf8bom 不参与猜测（无 guessableName）", GUESSABLE_ENCODINGS[UTF8_with_bom], undefined);

// ---- 7) 编解码往返 ----
console.log("7) 编解码往返");
function roundTrip(description, text, encoding, options) {
	const encoded = encodingCodec.encode(text, encoding, options);
	check(description, encodingCodec.decode(encoded, encoding), text);
}
roundTrip("UTF-8", "中文 abc 123", UTF8);
roundTrip("UTF-8 with BOM", "中文 abc", UTF8_with_bom, { addBOM: true });
roundTrip("GBK（简体）", "角色名称：鬼剑士", "gbk");
roundTrip("Big5（繁体）", "角色名稱：鬼劍士", "big5");
roundTrip("EUC-KR（韩文）", "캐릭터 이름: 귀검사", "euc-kr");
roundTrip("Windows 1252", "Grüße äöü", "windows1252");
roundTrip("UTF-16 LE with BOM", "中文 abc", UTF16le, { addBOM: true });
roundTrip("UTF-16 BE with BOM", "中文 abc", UTF16be, { addBOM: true });
check("utf8bom 的 BOM 只由 addBOM 决定（编解码名归一为 utf8）", [...encodingCodec.encode("a", UTF8_with_bom)].length, 1);
check("utf8bom + addBOM 写出 3 字节 BOM", [...encodingCodec.encode("a", UTF8_with_bom, { addBOM: true })], [0xef, 0xbb, 0xbf, 0x61]);
check("不支持的编码 exists 为假", encodingCodec.exists("no-such-encoding"), false);
check("空串往返（gbk）", encodingCodec.decode(encodingCodec.encode("", "gbk"), "gbk"), "");

// ---- 8) PVF 域档案（@/utils/pvfEncoding.js）----
console.log("8) PVF 域档案");
check("候选集", PVF_CANDIDATE_GUESS_ENCODINGS, ["gb2312", "cp950", "euckr", "utf8"]);
check("候选集都是编码表里的可猜测项", PVF_CANDIDATE_GUESS_ENCODINGS.filter(key => !GUESSABLE_ENCODINGS[key]), []);
check("gb2312 → gbk", resolvePvfDetectedEncoding("gb2312", UTF8), "gbk");
check("cp950 → big5", resolvePvfDetectedEncoding("cp950", UTF8), "big5");
check("euckr → euc-kr", resolvePvfDetectedEncoding("euckr", UTF8), "euc-kr");
check("utf8 不变", resolvePvfDetectedEncoding("utf8", UTF8), UTF8);
check("探测不出结果 → 回落 utf8", resolvePvfDetectedEncoding(null, UTF8), UTF8);
// 端到端：探测 → 映射 → 解码，覆盖归档字符串表的三种主要文字
const pvfEncodingOf = buffer => resolvePvfDetectedEncoding(at(buffer, true, PVF_CANDIDATE_GUESS_ENCODINGS).encoding, UTF8);
check("简体归档 → gbk", pvfEncodingOf(encodingCodec.encode(CHINESE_SIMPLIFIED, "gbk")), "gbk");
check("繁体归档 → big5", pvfEncodingOf(encodingCodec.encode(CHINESE_TRADITIONAL, "big5")), "big5");
check("韩文归档 → euc-kr", pvfEncodingOf(encodingCodec.encode(KOREAN, "euc-kr")), "euc-kr");
check("ASCII 归档（纯英文资源）→ utf8", pvfEncodingOf(utf8("npc/act/idle.nut")), UTF8);
check("映射后的编码可解码原文", encodingCodec.decode(encodingCodec.encode(CHINESE_SIMPLIFIED, "gbk"), pvfEncodingOf(encodingCodec.encode(CHINESE_SIMPLIFIED, "gbk"))), CHINESE_SIMPLIFIED);

if (failed > 0) {
	console.error(`\n${failed} 项失败`);
	process.exitCode = 1;
} else {
	console.log("\n全部通过");
}
