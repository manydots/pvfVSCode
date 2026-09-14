// 编码服务：编解码、编码探测、读/写编码决策。
//
// 权威出处（逐条对照，见 docs/vscode-reference.md 第 6.2 节）：
//   - <vscode>/src/vs/workbench/services/textfile/common/encoding.ts
//     （编解码实现 :68-107 / :217-264、toNodeEncoding :272-278、BOM 探测 :280-315、
//      jschardet 猜测 :317-389、detectEncodingFromBuffer :440-508、SUPPORTED_ENCODINGS :512-781）
//   - <vscode>/src/vs/workbench/services/textfile/browser/textFileService.ts:819-886
//     （读/写编码决策链；权威是服务方法，本仓库抽成纯函数以便 Node 单测，语义逐条对齐）
//
// 本模块是仓库内**唯一**的编解码与编码探测实现（门控 §4.1 第 6 条）：
// 编解码统一走 @vscode/iconv-lite-umd（权威 package.json:122 同款，两端同一份实现），
// 猜测统一走 jschardet（权威 package.json:152 同款）。PVF 域代码（@/utils/encoding.js）
// 不再自带码表与试探解码，只做本模块的门面。
//
// 与权威的差异（均登记于 docs/vscode-reference.md 第 5 节）：
//   - 无流式路径（权威 toDecodeStream :119-215 / toEncodeReadable :217-264）：本仓库一次拿到
//     完整 buffer，探测与编解码同步整块完成；因此 detectEncodingFromBuffer 在
//     autoGuessEncoding 为真时也同步返回（权威返回 Promise），acceptTextOnly /
//     DecodeStreamError 的「二进制即失败」语义由调用方按 seemsBinary 自行处理；
//   - iconv / jschardet 为静态 import（权威用 importAMDNodeModule 懒加载，:88、:221、:262）：
//     取值与语义一致，代价是主 bundle 体积；
//   - toCanonicalName（:397-419，ripgrep 用）随文本搜索一并省略；
//   - 语言级 override（`[language] files.encoding`）未迁入：决策输入里的 encodingOverride 由调用方
//     给值，本仓库暂无产出方，与第 5 节「无语言/资源级设置覆盖」是同一项。
//
// 本模块不 import 任何 `@/...` 模块（只用 @vscode/iconv-lite-umd 与 jschardet 两个 npm 包），
// 以便 scripts/check-encoding-oracle.mjs 直接用 Node 载入决策表做纯函数单测（门控 §5）。

import iconv from "@vscode/iconv-lite-umd";
import jschardet from "jschardet/dist/jschardet.min.js";

// ---- encoding.ts:12-30 ----

export const UTF8 = "utf8";
export const UTF8_with_bom = "utf8bom";
export const UTF16be = "utf16be";
export const UTF16le = "utf16le";

export function isUTFEncoding(encoding) {
    return [UTF8, UTF8_with_bom, UTF16be, UTF16le].some(utfEncoding => utfEncoding === encoding);
}

export const UTF16be_BOM = [0xfe, 0xff];
export const UTF16le_BOM = [0xff, 0xfe];
export const UTF8_BOM = [0xef, 0xbb, 0xbf];

// 探测阈值（权威 :27-30）。权威的 MIN 阈值用于流式缓冲「攒够多少字节才开始探测」，
// 本仓库整块读入，故只用 MAX 值限制交给 jschardet 的字节数。
const ZERO_BYTE_DETECTION_BUFFER_MAX_LEN = 512; // number of bytes to look at to decide about a file being binary or not
const NO_ENCODING_GUESS_MIN_BYTES = 512; // when not auto guessing the encoding, small number of bytes are enough
const AUTO_ENCODING_GUESS_MIN_BYTES = 512 * 8; // with auto guessing we want a lot more content to be read for guessing
const AUTO_ENCODING_GUESS_MAX_BYTES = 512 * 128; // set an upper limit for the number of bytes we pass on to jschardet

// 供调用方判断「要不要为了猜测多读一些字节」（权威 :119 用同一对阈值算 minBytesRequiredForDetection）。
export const MIN_BYTES_FOR_DETECTION = {
    withoutGuess: NO_ENCODING_GUESS_MIN_BYTES,
    withGuess: AUTO_ENCODING_GUESS_MIN_BYTES
};

// ---- IEncodingCodec：编解码的唯一实现（权威 encoding.ts:68-107 的 DecoderStream + :217-264 的 toEncodeReadable）----
//
// 权威对 UTF-8 特判走 TextDecoder 以免加载 iconv（:88-106）；本仓库 iconv 已在包内，
// 统一走 iconv（BOM 去除行为一致：iconv 解码时自动剥离 BOM，实测 utf8/utf16le/utf16be 均如此）。

export const encodingCodec = {
    /**
     * 编码名是否被支持（权威 :266-270 的 encodingExists）。
     * @param {string} encoding
     * @returns {boolean}
     */
    exists(encoding) {
        return iconv.encodingExists(toNodeEncoding(encoding));
    },

    /**
     * 字节 → 字符串（权威 :131-137 的 decoder.write(buffered) 与 :166 的 decoder.write(chunk)）。
     * @param {Uint8Array} buffer
     * @param {string} encoding
     * @returns {string}
     */
    decode(buffer, encoding) {
        return iconv.decode(buffer, toNodeEncoding(encoding));
    },

    /**
     * 字符串 → 字节（权威 :217-264 的 toEncodeReadable）。
     * @param {string} text
     * @param {string} encoding
     * @param {{ addBOM?: boolean }} [options] 权威由 getPreferredWriteEncoding 的 hasBOM 决定
     * @returns {Uint8Array}
     */
    encode(text, encoding, options) {
        return iconv.encode(text, toNodeEncoding(encoding), { addBOM: !!options?.addBOM });
    }
};

// encoding.ts:272-278
export function toNodeEncoding(enc) {
    if (enc === UTF8_with_bom || enc === null) {
        return UTF8; // iconv does not distinguish UTF 8 with or without BOM, so we need to help it
    }

    return enc;
}

// ---- BOM 探测（encoding.ts:280-315）----

/**
 * @param {Uint8Array|null} buffer
 * @param {number} bytesRead
 * @returns {typeof UTF8_with_bom | typeof UTF16le | typeof UTF16be | null}
 */
export function detectEncodingByBOMFromBuffer(buffer, bytesRead) {
    if (!buffer || bytesRead < UTF16be_BOM.length) {
        return null;
    }

    const b0 = buffer[0];
    const b1 = buffer[1];

    // UTF-16 BE
    if (b0 === UTF16be_BOM[0] && b1 === UTF16be_BOM[1]) {
        return UTF16be;
    }

    // UTF-16 LE
    if (b0 === UTF16le_BOM[0] && b1 === UTF16le_BOM[1]) {
        return UTF16le;
    }

    if (bytesRead < UTF8_BOM.length) {
        return null;
    }

    const b2 = buffer[2];

    // UTF-8
    if (b0 === UTF8_BOM[0] && b1 === UTF8_BOM[1] && b2 === UTF8_BOM[2]) {
        return UTF8_with_bom;
    }

    return null;
}

// ---- 编码猜测（encoding.ts:317-389）----

// we explicitly ignore a specific set of encodings from auto guessing
// - ASCII: we never want this encoding (most UTF-8 files would happily detect as
//          ASCII files and then you could not type non-ASCII characters anymore)
// - UTF-16: we have our own detection logic for UTF-16
// - UTF-32: we do not support this encoding in VSCode
const IGNORE_ENCODINGS = ["ascii", "utf-16", "utf-32"];

/**
 * Guesses the encoding from buffer.
 * @param {Uint8Array} buffer
 * @param {string[]} [candidateGuessEncodings]
 * @returns {string|null}
 */
export function guessEncodingByBuffer(buffer, candidateGuessEncodings) {
    // ensure to limit buffer for guessing due to https://github.com/aadsm/jschardet/issues/53
    const limitedBuffer = buffer.subarray(0, AUTO_ENCODING_GUESS_MAX_BYTES);

    // before guessing jschardet calls toString('binary') on input if it is a Buffer,
    // since we are using it inside browser environment as well we do conversion ourselves
    // https://github.com/aadsm/jschardet/blob/v2.1.1/src/index.js#L36-L40
    const binaryString = encodeLatin1(limitedBuffer);

    // ensure to convert candidate encodings to jschardet encoding names if provided
    if (candidateGuessEncodings) {
        candidateGuessEncodings = candidateGuessEncodings.map(e => toJschardetEncoding(e)).filter(e => !!e);
        if (candidateGuessEncodings.length === 0) {
            candidateGuessEncodings = undefined;
        }
    }

    let guessed;
    try {
        guessed = jschardet.detect(binaryString, candidateGuessEncodings ? { detectEncodings: candidateGuessEncodings } : undefined);
    } catch (error) {
        return null; // jschardet throws for unknown encodings (https://github.com/microsoft/vscode/issues/239928)
    }

    if (!guessed?.encoding) {
        return null;
    }

    const enc = guessed.encoding.toLowerCase();
    if (0 <= IGNORE_ENCODINGS.indexOf(enc)) {
        return null; // see comment above why we ignore some encodings
    }

    return toIconvLiteEncoding(guessed.encoding);
}

const JSCHARDET_TO_ICONV_ENCODINGS = {
    ibm866: "cp866",
    big5: "cp950"
};

function normalizeEncoding(encodingName) {
    return encodingName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export function toIconvLiteEncoding(encodingName) {
    const normalizedEncodingName = normalizeEncoding(encodingName);
    const mapped = JSCHARDET_TO_ICONV_ENCODINGS[normalizedEncodingName];

    return mapped || normalizedEncodingName;
}

export function toJschardetEncoding(encodingName) {
    const normalizedEncodingName = normalizeEncoding(encodingName);
    const mapped = GUESSABLE_ENCODINGS[normalizedEncodingName];

    return mapped ? mapped.guessableName : undefined;
}

function encodeLatin1(buffer) {
    let result = "";
    for (let i = 0; i < buffer.length; i++) {
        result += String.fromCharCode(buffer[i]);
    }

    return result;
}

// ---- 完整探测（encoding.ts:427-508）----

/**
 * @param {{ buffer: Uint8Array|null, bytesRead: number }} readResult
 * @param {boolean} [autoGuessEncoding]
 * @param {string[]} [candidateGuessEncodings]
 * @returns {{ encoding: string|null, seemsBinary: boolean }}
 */
export function detectEncodingFromBuffer({ buffer, bytesRead }, autoGuessEncoding, candidateGuessEncodings) {
    // Always first check for BOM to find out about encoding
    let encoding = detectEncodingByBOMFromBuffer(buffer, bytesRead);

    // Detect 0 bytes to see if file is binary or UTF-16 LE/BE
    // unless we already know that this file has a UTF-16 encoding
    let seemsBinary = false;
    if (encoding !== UTF16be && encoding !== UTF16le && buffer) {
        let couldBeUTF16LE = true; // e.g. 0xAA 0x00
        let couldBeUTF16BE = true; // e.g. 0x00 0xAA
        let containsZeroByte = false;

        // This is a simplified guess to detect UTF-16 BE or LE by just checking if
        // the first 512 bytes have the 0-byte at a specific location. For UTF-16 LE
        // this would be the odd byte index and for UTF-16 BE the even one.
        // Note: this can produce false positives (a binary file that uses a 2-byte
        // encoding of the same format as UTF-16) and false negatives (a UTF-16 file
        // that is using 4 bytes to encode a character).
        for (let i = 0; i < bytesRead && i < ZERO_BYTE_DETECTION_BUFFER_MAX_LEN; i++) {
            const isEndian = i % 2 === 1; // assume 2-byte sequences typical for UTF-16
            const isZeroByte = buffer[i] === 0;

            if (isZeroByte) {
                containsZeroByte = true;
            }

            // UTF-16 LE: expect e.g. 0xAA 0x00
            if (couldBeUTF16LE && ((isEndian && !isZeroByte) || (!isEndian && isZeroByte))) {
                couldBeUTF16LE = false;
            }

            // UTF-16 BE: expect e.g. 0x00 0xAA
            if (couldBeUTF16BE && ((isEndian && isZeroByte) || (!isEndian && !isZeroByte))) {
                couldBeUTF16BE = false;
            }

            // Return if this is neither UTF16-LE nor UTF16-BE and thus treat as binary
            if (isZeroByte && !couldBeUTF16LE && !couldBeUTF16BE) {
                break;
            }
        }

        // Handle case of 0-byte included
        if (containsZeroByte) {
            if (couldBeUTF16LE) {
                encoding = UTF16le;
            } else if (couldBeUTF16BE) {
                encoding = UTF16be;
            } else {
                seemsBinary = true;
            }
        }
    }

    // Auto guess encoding if configured
    if (autoGuessEncoding && !seemsBinary && !encoding && buffer) {
        return {
            seemsBinary: false,
            encoding: guessEncodingByBuffer(buffer.subarray(0, bytesRead), candidateGuessEncodings)
        };
    }

    return { seemsBinary, encoding };
}

// ---- 读/写编码决策（browser/textFileService.ts:819-886）----

/**
 * 决策输入。权威由服务构造参数拿到 textResourceConfigurationService 与 encodingOverrides
 * （textFileService.ts:790-816 的 ResourceEncodingRegistry），再在 :826-886 逐项读取；
 * 本仓库把「读配置 / 查覆盖」留在浏览器层（@/workbench/services/textfile/browser/encodingContext.js），
 * 决策函数只收已解析好的值 —— 权威的 resource 参数就是为这两件事存在的，两者都已外移，
 * 故本模块的签名里不再出现 resource。这样决策链本身是纯函数，可按门控 §5 用 Node 直测。
 * @typedef {{
 *   configEncoding?: string,               // files.encoding（按资源解析后的值）
 *   configAutoGuessEncoding?: boolean,     // files.autoGuessEncoding
 *   candidateGuessEncodings?: string[],    // files.candidateGuessEncodings
 *   encodingOverride?: string              // 语言/资源级覆盖（权威 :322-331 的 encodingOverride）
 * }} IEncodingInput
 */

// textFileService.ts:866-877
export function getUnvalidatedEncoding(preferredEncoding, input = {}) {
    let fileEncoding;

    if (input.encodingOverride) {
        fileEncoding = input.encodingOverride; // encoding override always wins
    } else if (preferredEncoding) {
        fileEncoding = preferredEncoding; // preferred encoding comes second
    } else {
        fileEncoding = input.configEncoding; // and last we check for settings
    }

    return fileEncoding || UTF8;
}

// textFileService.ts:879-886
export function getValidatedEncoding(preferredEncoding, input = {}) {
    let fileEncoding = getUnvalidatedEncoding(preferredEncoding, input);
    if (fileEncoding !== UTF8 && !encodingCodec.exists(fileEncoding)) {
        fileEncoding = UTF8;
    }

    return fileEncoding;
}

// textFileService.ts:834-857
export function getPreferredReadEncoding(options, detectedEncoding, input = {}) {
    let preferredEncoding;

    // Encoding passed in as option
    if (options?.encoding) {
        if (detectedEncoding === UTF8_with_bom && options.encoding === UTF8) {
            preferredEncoding = UTF8_with_bom; // indicate the file has BOM if we are to resolve with UTF 8
        } else {
            preferredEncoding = options.encoding; // give passed in encoding highest priority
        }
    }

    // Encoding detected
    else if (typeof detectedEncoding === "string") {
        preferredEncoding = detectedEncoding;
    }

    // Encoding configured
    else if (input.configEncoding === UTF8_with_bom) {
        preferredEncoding = UTF8; // if we did not detect UTF 8 BOM before, this can only be UTF 8 then
    }

    const encoding = getValidatedEncoding(preferredEncoding, input);

    return {
        encoding,
        hasBOM: encoding === UTF16be || encoding === UTF16le || encoding === UTF8_with_bom // enforce BOM for certain encodings
    };
}

// textFileService.ts:826-832
export function getPreferredWriteEncoding(preferredEncoding, input = {}) {
    const resourceEncoding = getValidatedEncoding(preferredEncoding, input);

    return {
        encoding: resourceEncoding,
        hasBOM: resourceEncoding === UTF16be || resourceEncoding === UTF16le || resourceEncoding === UTF8_with_bom // enforce BOM for certain encodings
    };
}

/**
 * 读文件的完整探测 + 决策（权威 textFileService.ts:302-317 的 doGetDecodedStream +
 * validateDetectedEncoding :336-340 的两步合成）：先探测，再按决策链定最终编码。
 * @param {Uint8Array} buffer
 * @param {{ encoding?: string, autoGuessEncoding?: boolean, candidateGuessEncodings?: string[] }} [options]
 * @param {IEncodingInput} [input]
 * @returns {{ encoding: string, hasBOM: boolean, seemsBinary: boolean, detectedEncoding: string|null }}
 */
export function resolveReadEncoding(buffer, options, input = {}) {
    const guessEncoding = options?.autoGuessEncoding || input.configAutoGuessEncoding;
    const candidateGuessEncodings = options?.candidateGuessEncodings || input.candidateGuessEncodings;

    const detected = detectEncodingFromBuffer({ buffer, bytesRead: buffer.length }, guessEncoding, candidateGuessEncodings);
    const { encoding, hasBOM } = getPreferredReadEncoding(options, detected.encoding ?? undefined, input);

    return { encoding, hasBOM, seemsBinary: detected.seemsBinary, detectedEncoding: detected.encoding };
}

// ---- 编码表（encoding.ts:512-781，逐行取自权威）----

export const SUPPORTED_ENCODINGS = {
    utf8: {
        labelLong: "UTF-8",
        labelShort: "UTF-8",
        order: 1,
        alias: "utf8bom",
        guessableName: "UTF-8"
    },
    utf8bom: {
        labelLong: "UTF-8 with BOM",
        labelShort: "UTF-8 with BOM",
        encodeOnly: true,
        order: 2,
        alias: "utf8"
    },
    utf16le: {
        labelLong: "UTF-16 LE",
        labelShort: "UTF-16 LE",
        order: 3,
        guessableName: "UTF-16LE"
    },
    utf16be: {
        labelLong: "UTF-16 BE",
        labelShort: "UTF-16 BE",
        order: 4,
        guessableName: "UTF-16BE"
    },
    windows1252: {
        labelLong: "Western (Windows 1252)",
        labelShort: "Windows 1252",
        order: 5,
        guessableName: "windows-1252"
    },
    iso88591: {
        labelLong: "Western (ISO 8859-1)",
        labelShort: "ISO 8859-1",
        order: 6
    },
    iso88593: {
        labelLong: "Western (ISO 8859-3)",
        labelShort: "ISO 8859-3",
        order: 7
    },
    iso885915: {
        labelLong: "Western (ISO 8859-15)",
        labelShort: "ISO 8859-15",
        order: 8
    },
    macroman: {
        labelLong: "Western (Mac Roman)",
        labelShort: "Mac Roman",
        order: 9
    },
    cp437: {
        labelLong: "DOS (CP 437)",
        labelShort: "CP437",
        order: 10
    },
    windows1256: {
        labelLong: "Arabic (Windows 1256)",
        labelShort: "Windows 1256",
        order: 11
    },
    iso88596: {
        labelLong: "Arabic (ISO 8859-6)",
        labelShort: "ISO 8859-6",
        order: 12
    },
    windows1257: {
        labelLong: "Baltic (Windows 1257)",
        labelShort: "Windows 1257",
        order: 13
    },
    iso88594: {
        labelLong: "Baltic (ISO 8859-4)",
        labelShort: "ISO 8859-4",
        order: 14
    },
    iso885914: {
        labelLong: "Celtic (ISO 8859-14)",
        labelShort: "ISO 8859-14",
        order: 15
    },
    windows1250: {
        labelLong: "Central European (Windows 1250)",
        labelShort: "Windows 1250",
        order: 16,
        guessableName: "windows-1250"
    },
    iso88592: {
        labelLong: "Central European (ISO 8859-2)",
        labelShort: "ISO 8859-2",
        order: 17,
        guessableName: "ISO-8859-2"
    },
    cp852: {
        labelLong: "Central European (CP 852)",
        labelShort: "CP 852",
        order: 18
    },
    windows1251: {
        labelLong: "Cyrillic (Windows 1251)",
        labelShort: "Windows 1251",
        order: 19,
        guessableName: "windows-1251"
    },
    cp866: {
        labelLong: "Cyrillic (CP 866)",
        labelShort: "CP 866",
        order: 20,
        guessableName: "IBM866"
    },
    cp1125: {
        labelLong: "Cyrillic (CP 1125)",
        labelShort: "CP 1125",
        order: 21,
        guessableName: "IBM1125"
    },
    iso88595: {
        labelLong: "Cyrillic (ISO 8859-5)",
        labelShort: "ISO 8859-5",
        order: 22,
        guessableName: "ISO-8859-5"
    },
    koi8r: {
        labelLong: "Cyrillic (KOI8-R)",
        labelShort: "KOI8-R",
        order: 23,
        guessableName: "KOI8-R"
    },
    koi8u: {
        labelLong: "Cyrillic (KOI8-U)",
        labelShort: "KOI8-U",
        order: 24
    },
    iso885913: {
        labelLong: "Estonian (ISO 8859-13)",
        labelShort: "ISO 8859-13",
        order: 25
    },
    windows1253: {
        labelLong: "Greek (Windows 1253)",
        labelShort: "Windows 1253",
        order: 26,
        guessableName: "windows-1253"
    },
    iso88597: {
        labelLong: "Greek (ISO 8859-7)",
        labelShort: "ISO 8859-7",
        order: 27,
        guessableName: "ISO-8859-7"
    },
    windows1255: {
        labelLong: "Hebrew (Windows 1255)",
        labelShort: "Windows 1255",
        order: 28,
        guessableName: "windows-1255"
    },
    iso88598: {
        labelLong: "Hebrew (ISO 8859-8)",
        labelShort: "ISO 8859-8",
        order: 29,
        guessableName: "ISO-8859-8"
    },
    iso885910: {
        labelLong: "Nordic (ISO 8859-10)",
        labelShort: "ISO 8859-10",
        order: 30
    },
    iso885916: {
        labelLong: "Romanian (ISO 8859-16)",
        labelShort: "ISO 8859-16",
        order: 31
    },
    windows1254: {
        labelLong: "Turkish (Windows 1254)",
        labelShort: "Windows 1254",
        order: 32
    },
    iso88599: {
        labelLong: "Turkish (ISO 8859-9)",
        labelShort: "ISO 8859-9",
        order: 33
    },
    cp857: {
        labelLong: "Turkish (CP 857)",
        labelShort: "CP 857",
        order: 34
    },
    windows1258: {
        labelLong: "Vietnamese (Windows 1258)",
        labelShort: "Windows 1258",
        order: 35
    },
    gbk: {
        labelLong: "Simplified Chinese (GBK)",
        labelShort: "GBK",
        order: 36
    },
    gb18030: {
        labelLong: "Simplified Chinese (GB18030)",
        labelShort: "GB18030",
        order: 37
    },
    cp950: {
        labelLong: "Traditional Chinese (Big5)",
        labelShort: "Big5",
        order: 38,
        guessableName: "Big5"
    },
    big5hkscs: {
        labelLong: "Traditional Chinese (Big5-HKSCS)",
        labelShort: "Big5-HKSCS",
        order: 39
    },
    shiftjis: {
        labelLong: "Japanese (Shift JIS)",
        labelShort: "Shift JIS",
        order: 40,
        guessableName: "SHIFT_JIS"
    },
    eucjp: {
        labelLong: "Japanese (EUC-JP)",
        labelShort: "EUC-JP",
        order: 41,
        guessableName: "EUC-JP"
    },
    euckr: {
        labelLong: "Korean (EUC-KR)",
        labelShort: "EUC-KR",
        order: 42,
        guessableName: "EUC-KR"
    },
    windows874: {
        labelLong: "Thai (Windows 874)",
        labelShort: "Windows 874",
        order: 43
    },
    iso885911: {
        labelLong: "Latin/Thai (ISO 8859-11)",
        labelShort: "ISO 8859-11",
        order: 44
    },
    koi8ru: {
        labelLong: "Cyrillic (KOI8-RU)",
        labelShort: "KOI8-RU",
        order: 45
    },
    koi8t: {
        labelLong: "Tajik (KOI8-T)",
        labelShort: "KOI8-T",
        order: 46
    },
    gb2312: {
        labelLong: "Simplified Chinese (GB 2312)",
        labelShort: "GB 2312",
        order: 47,
        guessableName: "GB2312"
    },
    cp865: {
        labelLong: "Nordic DOS (CP 865)",
        labelShort: "CP 865",
        order: 48
    },
    cp850: {
        labelLong: "Western European DOS (CP 850)",
        labelShort: "CP 850",
        order: 49
    }
};

export const GUESSABLE_ENCODINGS = (() => {
    const guessableEncodings = {};
    for (const encoding in SUPPORTED_ENCODINGS) {
        if (SUPPORTED_ENCODINGS[encoding].guessableName) {
            guessableEncodings[encoding] = SUPPORTED_ENCODINGS[encoding];
        }
    }

    return guessableEncodings;
})();
