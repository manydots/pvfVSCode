// PVF 归档编码档案：sTrA 单字节字符串表用到的候选猜测集与「检测结果 → 编解码名」映射。
//
// 这里只有取值与映射规则，没有探测实现 —— 探测实现是唯一的，即
// @/workbench/services/textfile/common/encoding.js 的 detectEncodingFromBuffer
// （对齐权威 <vscode>/src/vs/workbench/services/textfile/common/encoding.ts:440-508）。
// 本模块被 @/utils/encoding.js 与 scripts/check-encoding-oracle.mjs 共用；
// 不 import 任何 `@/...` 模块，以便 Node 直接载入做纯函数单测（门控 §5）。

// 候选集：等价于 `files.candidateGuessEncodings` 机制里的一项，只是取值面向 PVF 域
//（归档的 sTrA 字符串表只可能是简体中文 / 繁体中文 / 韩文 / UTF-8 之一）。
// 值是 SUPPORTED_ENCODINGS 的 key，经 GUESSABLE_ENCODINGS 映射为 jschardet 名称：
// gb2312 → GB2312、cp950 → Big5、euckr → EUC-KR、utf8 → UTF-8。
export const PVF_CANDIDATE_GUESS_ENCODINGS = ["gb2312", "cp950", "euckr", "utf8"];

// 检测结果 → PVF 域使用的编解码名：
//   gb2312 → gbk（GBK 是 GB2312 的超集，PVF 文本常含 GB2312 之外的字）；
//   cp950  → big5、euckr → euc-kr（只是名字对齐，iconv 两者都支持）。
// 与权威 encoding.ts:360-363 的 JSCHARDET_TO_ICONV_ENCODINGS 同类（同为「jschardet 名 → iconv 名」），
// 只是这里的取值面向 PVF 域。
export const PVF_DETECTED_ENCODING_ALIASES = {
    gb2312: "gbk",
    cp950: "big5",
    euckr: "euc-kr"
};

/**
 * 规范化探测结果：探测不出结果（纯 ASCII、或猜测被 IGNORE_ENCODINGS 过滤）时回落调用方给的
 * 默认编码，否则按上表映射到 PVF 域使用的编解码名。
 * 对齐权威 textFileService.ts:873 的 `fileEncoding || UTF8`。
 * @param {string|null|undefined} detectedEncoding detectEncodingFromBuffer 的结果
 * @param {string} fallbackEncoding 探测无结果时的编码（调用方传 UTF8）
 * @returns {string}
 */
export function resolvePvfDetectedEncoding(detectedEncoding, fallbackEncoding) {
    if (!detectedEncoding) return fallbackEncoding;
    return PVF_DETECTED_ENCODING_ALIASES[detectedEncoding] || detectedEncoding;
}
