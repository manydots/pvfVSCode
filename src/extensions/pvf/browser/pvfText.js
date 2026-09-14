// PVF 文本形态（.lst / .dat / token 流）的语言定义（Monarch 词法 + 语言配置）。
//
// 词法来源不是 VS Code，而是本仓库的解码/编码契约：这些语言高亮的是 **PVF 归档内容解码后的
// 文本**（见 docs/pvfine-external-reference.md），因此词法表直接取自 src/utils/pvfTool.js 的
// 互逆两半：
//   解码（写入编辑器的文本）——
//     decodeToken          :627-675   数字 / 反引号字符串 / 标签行 / {5=``} {7=``} 标记 / ?(类型,值)
//     decodeTokenIndented  :680-737   同上，另加展示用行首缩进
//     decodeLst            :751-800   「数字 + 反引号字符串」或「反引号字符串 + 数字」逐行
//     decodeDat            :1238-1270  定长记录表（纯数字），探测失败回退 decodeToken
//   编码（把文本写回 token 流）——
//     encodeTokenText      :1303-1384 `#` 与 `//` 为行注释、反引号串（`` 转义字面反引号，可跨行）、
//                                      {N=...} 标记、[标签]、整数 / 浮点 / 裸串
// 行注释有两种写法，语义完全等价（都到行尾）：`#` 是编码器本来就认的标记（原始数据里
// `#PVF_File` 这类导出文本即用它），`//` 是产品要求补上的等价写法。三处解析者
// （本词法 / src/utils/pvfTool.js 的 encodeTokenText / src/utils/pvfValidator.js）必须同步，
// 否则会出现「显示成注释、写回却当数据编码」的静默损坏。
// 三种语言（pvf-list / pvf-dat / pvf-token）的语言形态相同，共用这一份实现
// （门控 §4.1 第 6 条：同一语义只允许一份实现）；它们的区别只在「扩展名 → 用哪个 decoder」，
// 由 src/utils/pvfTool.js 的 CONTENT_DECODERS 决定，与高亮无关。
//
// 扩展名与语言的对应写在清单 src/extensions/pvf/package.json 的 contributes.languages 里：
// pvf-token 除 `.str`/`.aic`/`.ani`/`.etc` 外还认 `.stk` —— 后者是 dataType=1 未登记的后缀，
// 走该 dataType 的默认方法 decodeToken（TW 归档同此，见 pvfToolTw.js:1002-1005 的分派），
// 文本形态与上面三者一致。TW 归档的 stringtable.bin（`索引>文本` 视图，pvfToolTw.js:413-424）
// 不由 CONTENT_DECODERS 产生，因此没有对应语言，按纯文本打开。

// 作用域名同样只用「主题链认得的」那些（数字用 constant.numeric 而非 TextMate 的 number ——
// 2026-dark 链给的是 constant.numeric，见 scripts/check-syntax-colors.mjs）。
export const pvfTextLanguageDefinition = {
    defaultToken: "",
    tokenPostfix: ".pvf",
    tokenizer: {
        root: [
            [/[ \t\r\n]+/, ""],
            // 行注释：`#` 与 `//` 都到行尾。`//` 只认 token 起始位置 —— `a//b` 由下面的裸串规则
            // 整体吃掉（与 encodeTokenText 的裸串读取一致）；`#` 不在裸串字符集里，故 `a#b` 会切成
            // 「`a` + 注释」（写回端把 `a#b` 当一个 token，差异只出现在这种真实数据里不存在的位置）。
            [/#.*$/, "comment"],
            [/\/\/.*$/, "comment"],
            // 标记头 `{5=` / `{7=`（_tryParseSpecialMarker:1433-1446 只认这两种）：
            // 内部既可能是数字也可能是反引号串，故不进入单独状态，交给下面的规则继续切分。
            [/\{(?:5|7)=/, "keyword"],
            [/`/, "string", "@backtick"],
            // 标签 token：与编码器一致，`]` 必须与 `[` 同行才算标签
            // （encodeTokenText:1338-1356 的同行判定）。
            [/\[[^\]\n]*\]/, "tag"],
            // 未识别的 token 类型按 `?(类型,值)` 落进文本（decodeToken 的 default 分支）
            [/\?\(\s*-?\d+\s*,\s*-?\d+\s*\)/, "invalid"],
            [/-?(?:\d*\.\d+|\d+\.\d*)(?:[eE][-+]?\d+)?/, "constant.numeric.float"],
            [/-?\d+/, "constant.numeric"],
            [/[{}]/, "delimiter"],
            // 裸串：标签名、名称原文、以及 .lst 行尾追加的引用文件名称（decodeLstWithNames:1042-1120）
            [/[^\s`{}\[\]#]+/, "string"]
        ],
        backtick: [
            [/``/, "string"],
            [/`/, "string", "@pop"],
            [/[^`]+/, "string"]
        ]
    }
};

// 语言配置（形状对齐 <vscode>/extensions/go/language-configuration.json）。
// 不做自动闭合引号：PVF 文本里的反引号是语法本身且以 `` 转义，自动补全反引号会与转义冲突。
export const pvfTextLanguageConfiguration = {
    brackets: [
        ["{", "}"],
        ["[", "]"]
    ],
    autoClosingPairs: [
        ["{", "}"],
        ["[", "]"]
    ],
    surroundingPairs: [
        ["{", "}"],
        ["[", "]"]
    ]
};
