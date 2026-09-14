// Squirrel 3.x 的语言定义（Monarch 词法 + 语言配置）。
//
// 来源：VS Code 核心仓库不含 Squirrel 支持（由扩展提供），权威实现即「扩展贡献语言」
// 这一机制本身（对照 <vscode>/extensions/lua/package.json 的 contributes.languages +
// contributes.grammars + language-configuration.json 三件套）。本文件是这三件套在本仓库的
// M1 形态：清单只声明语言本身（src/extensions/pvf/package.json），词法与语言配置在
// activate 里以代码注册 —— 因为
//   - `contributes.grammars`（TextMate）需要 vscode-textmate / vscode-oniguruma（M5 引入），
//   - `contributes.languages[].configuration` 需要扩展资源文件加载（M3 随扩展宿主引入）。
// 两者的差异已登记在 docs/vscode-reference.md 第 5 节。
//
// 作用域名不是自造的，逐条对照 <vscode>/extensions/javascript/syntaxes/JavaScript.tmLanguage.json
// —— VS Code 里没有 Squirrel 语法，JS 语法是它最接近的同类（同为 C 系 `{ }` 语法），
// 且主题色是按作用域名给的（theme-defaults 的 2026-dark 链），作用域名对不上就没有颜色标记，
// 所以这里只允许出现「主题链或 JS 语法里出现过」的名字，见 scripts/check-syntax-colors.mjs。
//
// 词法表（关键字 / 常量 / 运算符）取自 Squirrel 语言规范；仓库内的对照样本是
// src/samples/common.nut（`<-` 槽位赋值、function / local / return / if / else / true / null）。
//
// 注释：`//` 与 `/* */` 来自规范；`#` 行注释是本仓库的产品决定 —— PVF 明文导出（`#PVF_File` 开头）
// 走的就是这套词法，规范里没有 `#` 注释。取值（VS Code 经典注释绿）与理由见 docs/vscode-reference.md
// 第 5 节。

// 「词 → 作用域」对照表 —— 唯一一份：Monarch 规则与下面三个导出都从它派生，避免两份清单漂移。
//
// 作用域逐条对照 JavaScript.tmLanguage.json：
//   keyword.control.conditional  if / else                       （JS 同名 scope）
//   keyword.control.loop         for / foreach / while            （JS 同名 scope）
//   keyword.control.switch       switch / case                    （JS 同名 scope）
//   keyword.control.default      default                          （JS 同名 scope）
//   keyword.control.flow         break / continue / return / resume / yield
//   keyword.control.trycatch     try / catch / throw              （JS 同名 scope）
//   keyword.operator.expression.*  in / instanceof / typeof / delete / extends
//   keyword.operator.expression  clone（Squirrel 特有，无 JS 对应，取同类「表达式前缀运算符」）
//   keyword.control              function / constructor / local / const（见下方「声明关键字」说明）
//   storage.type.class           class                            （JS 同名 scope）
//   storage.type.enum            enum                             （JS 同名 scope）
//   storage.modifier             static                           （JS 的 static → storage.modifier.js）
//   variable.language.this       this                             （JS 同名 scope）
//   variable.language.super      base（Squirrel 的 base 即父类，对应 JS 的 super）
const WORD_SCOPES = [
    { kind: "keyword", scope: "keyword.control.conditional", words: ["if", "else"] },
    { kind: "keyword", scope: "keyword.control.loop", words: ["for", "foreach", "while"] },
    { kind: "keyword", scope: "keyword.control.switch", words: ["switch", "case"] },
    { kind: "keyword", scope: "keyword.control.default", words: ["default"] },
    { kind: "keyword", scope: "keyword.control.flow", words: ["break", "continue", "return", "resume", "yield"] },
    { kind: "keyword", scope: "keyword.control.trycatch", words: ["try", "catch", "throw"] },
    { kind: "keyword", scope: "keyword.operator.expression.in", words: ["in"] },
    { kind: "keyword", scope: "keyword.operator.expression.instanceof", words: ["instanceof"] },
    { kind: "keyword", scope: "keyword.operator.expression.typeof", words: ["typeof"] },
    { kind: "keyword", scope: "keyword.operator.expression.delete", words: ["delete"] },
    { kind: "keyword", scope: "keyword.operator.expression.extends", words: ["extends"] },
    { kind: "keyword", scope: "keyword.operator.expression", words: ["clone"] },
    // 声明关键字（function / constructor / local / const）与 return 同色：取 keyword.control。
    // 该作用域名两处权威都用过 —— 主题链 dark_plus.json:76 的「Control flow / Special keywords」组
    // （`keyword.control` → #C586C0，与 keyword.control.flow 同色），以及 JS 语法里用于 `package`
    // 这个非控制流关键字（JavaScript.tmLanguage.json:159-161）。JS 语法本身把 function / var / let /
    // const 记作 storage.type.*，2026-dark 给 storage.type 的取值是 #FF7B72，与本仓库「关键字统一粉」
    // 的取值要求不符，故改用 keyword.control（产品决定，登记在 docs/vscode-reference.md 第 5 节）。
    { kind: "keyword", scope: "keyword.control", words: ["function", "constructor", "local", "const"] },
    { kind: "keyword", scope: "storage.type.class", words: ["class"] },
    { kind: "keyword", scope: "storage.type.enum", words: ["enum"] },
    { kind: "keyword", scope: "storage.modifier", words: ["static"] },
    { kind: "keyword", scope: "variable.language.this", words: ["this"] },
    { kind: "keyword", scope: "variable.language.super", words: ["base"] },
    // `true` / `false` / `null` 是字面量而非保留字，单列在 constants 里（对照 JS 语法的
    // constant.language.boolean.true.js / .false.js / constant.language.null.js）。
    { kind: "constant", scope: "constant.language.boolean.true", words: ["true"] },
    { kind: "constant", scope: "constant.language.boolean.false", words: ["false"] },
    { kind: "constant", scope: "constant.language.null", words: ["null"] },
    // Squirrel 3 的编译期常量标识符（对照 JS 语法的内置常量 support.constant.js，如 Math）。
    { kind: "builtin", scope: "support.constant", words: ["__FILE__", "__LINE__"] }
];

const wordsOf = kind => WORD_SCOPES.filter(entry => entry.kind === kind).flatMap(entry => entry.words);

// Squirrel 的保留字（Squirrel 3.x 语言规范 §Language Reference / Lexical structure）。
export const SQUIRREL_KEYWORDS = wordsOf("keyword");

export const SQUIRREL_CONSTANTS = wordsOf("constant");

// Squirrel 3 的编译期常量标识符。
export const SQUIRREL_BUILTINS = wordsOf("builtin");

// 标识符允许 `::` 命名空间限定（`Foo::bar`），与 squirrelSymbols.js 的 IDENT 一致。
const IDENTIFIER = /[a-zA-Z_]\w*(?:::[a-zA-Z_]\w*)*/;

// 词 → 作用域规则。Monarch 不做最长匹配，按规则顺序取**第一条命中**，因此：
//   - 关键字规则必须排在标识符规则之前；
//   - `(?![\w:])` 防止 `if` 命中 `iffy`、`if::x`（`::` 是限定名的一部分）。
const WORD_RULES = WORD_SCOPES.map(entry => [new RegExp(`(?:${entry.words.join("|")})(?![\\w:])`), entry.scope]);

// 函数名的作用域。VS Code 里「被调用的函数名」有两个并列的标注（tokenClassificationRegistry.ts:561/563
// 的 function / method 探测作用域就是这两个）：entity.name.function（本文件内定义或调用的名字）
// 与 support.function（库/引擎函数）。2026-dark 给前者紫色 #d2a8ff、给后者淡黄 #dcdcaa（后者同时
// 也是 dark_vs/dark_plus 给 entity.name.function 的取值），本仓库取淡黄的那个。
const FUNCTION_NAME = "support.function";

// 变量的两个档位。VS Code 的 JS 语法并不区分「全局」与「函数体内」—— 两者都是
// variable.other.readwrite.js（见 docs/vscode-reference.md 第 5 节登记的偏差），这里按
// 「函数体外 = 全局 / 函数体内（含形参）= 局部」分成两色，取值都来自 2026-dark.json 自己的规则：
//   全局 → variable                        → #ffa657
//   形参 → variable.parameter.function     → #c9d1d9
//   局部 → variable.other.readwrite        → #c9d1d9
const GLOBAL_VARIABLE = "variable";
const PARAMETER = "variable.parameter.function";
const LOCAL_VARIABLE = "variable.other.readwrite";

// 名称类规则：关键字 / 根表访问 / 函数名 / 常量名 / 变量名。函数体外与函数体内共用同一份，
// 只有最后一条「变量名」的作用域按位置不同（门控 §4.1 第 6 条：同一语义只允许一份实现）。
function nameRules(variableScope) {
    return [
        // 函数定义（`function name(` / `function(` / `constructor(`）→ 转入签名/参数状态，
        // 以便把形参与函数体内的变量分别标注。关键字本身的取值与其他声明关键字一致（keyword.control）。
        // 排在关键字规则之前，否则 `function` 会被下面的 WORD_RULES 先吃掉、状态转移就不会发生。
        [/\b(?:function|constructor)\b(?=\s*(?:[a-zA-Z_]\w*\s*)?\()/, "keyword.control", "@functionSignature"],
        ...WORD_RULES,
        // `::x` 是根表访问，永远是全局变量（`::` 本身仍按运算符标注）。
        [/(::)([a-zA-Z_]\w*)/, ["keyword.operator", GLOBAL_VARIABLE]],
        // 调用位置的标识符（后接 `(`）→ 函数名；排在「全大写 → 常量」之前，
        // 因为调用优先于常量名的形态判定（`MY_CONST(...)` 是函数调用）。
        [/[a-zA-Z_]\w*(?:::[a-zA-Z_]\w*)*(?=\s*\()/, FUNCTION_NAME],
        // 全大写标识符 → variable.other.constant，正则对齐 JS 语法的 variable.other.constant.js：
        // `([[:upper:]][_$[:digit:][:upper:]]*)(?![_$[:alnum:]])`（枚举名 ENUM_*、常量表 GROW_TYPE_*）。
        [/[A-Z][A-Z0-9_]*(?![\w:])/, "variable.other.constant"],
        [IDENTIFIER, variableScope]
    ];
}

// 两个档位共用的其余规则：注释、字符串、括号、运算符、数字、分隔符。
const COMMON_RULES = [
    { include: "@whitespace" },
    // `@"..."` 逐字字符串：内部 `""` 表示一个字面双引号（放在最前，避免被下面的 `"` 规则截断）。
    [/@"(""|[^"])*"?/, "string.quoted.double"],
    [/[{}()\[\]]/, "@brackets"],
    [/@symbols/, { cases: { "@operators": "keyword.operator", "@default": "" } }],
    [/"/, "string.quoted.double", "@stringDouble"],
    [/'/, "string.quoted.single", "@stringSingle"],
    [/\d*\.\d+([eE][\-+]?\d+)?/, "constant.numeric.float"],
    [/0[xX][0-9a-fA-F]+/, "constant.numeric.hex"],
    [/\d+/, "constant.numeric"],
    [/[;,.]/, "delimiter"]
];

export const squirrelLanguageDefinition = {
    defaultToken: "",
    tokenPostfix: ".squirrel",
    operators: [
        "<-",
        "=",
        "+",
        "-",
        "*",
        "/",
        "%",
        "++",
        "--",
        "+=",
        "-=",
        "*=",
        "/=",
        "%=",
        "==",
        "!=",
        "<",
        "<=",
        ">",
        ">=",
        "&&",
        "||",
        "!",
        "~",
        "&",
        "|",
        "^",
        "<<",
        ">>",
        ">>>",
        "::",
        ".",
        "?",
        "..."
    ],
    symbols: /[=><!~?:&|+\-*\/^%]+/,
    escapes: /\\(?:[abfnrtv\\"'0]|x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4})/,
    tokenizer: {
        // 顶层的标识符是全局变量（Squirrel 里 `x <- v` / 裸标识符都落在全局表/槽位上）。
        root: [...nameRules(GLOBAL_VARIABLE), { include: "@common" }],
        // `function name(` 之后到 `(` 之前：名字本身交给下面的调用名规则（同样得到函数名标注）。
        functionSignature: [
            { include: "@whitespace" },
            [/([a-zA-Z_]\w*)(\s*)(\()/, [FUNCTION_NAME, "", { token: "delimiter.parenthesis", switchTo: "functionParams" }]],
            [/(\()/, { token: "delimiter.parenthesis", switchTo: "functionParams" }],
            // 兜底：`function` 后面不是参数表（不应发生）——退回 root，只丢这一个字符的标注。
            [/[^]/, { token: "", switchTo: "root" }]
        ],
        // 形参表：`)` 之后转入函数体。
        functionParams: [{ include: "@whitespace" }, [/\)/, { token: "delimiter.parenthesis", switchTo: "functionBodyExpect" }], [IDENTIFIER, PARAMETER], { include: "@common" }],
        // `)` 之后等函数体的 `{`：这一层的 `{` 只换状态不压栈，函数体内部的 `{` 才压栈，
        // 这样「函数体的 `}`」正好弹回 root（Monarch 的 `switchTo` = 替换栈顶而不压栈）。
        functionBodyExpect: [{ include: "@whitespace" }, [/\{/, { token: "delimiter.curly", switchTo: "functionBody" }], [/[^]/, { token: "", switchTo: "root" }]],
        // 函数体内的标识符是局部变量；嵌套的 `{ }` 压栈/弹栈，与函数体同层。
        functionBody: [...nameRules(LOCAL_VARIABLE), [/\{/, { token: "delimiter.curly", next: "@functionBody" }], [/\}/, { token: "delimiter.curly", next: "@pop" }], { include: "@common" }],
        common: COMMON_RULES,
        whitespace: [
            [/[ \t\r\n]+/, ""],
            // `#` 行注释：Squirrel 规范里只有 `//` 与 `/* */`，这条是 PVF 明文导出文本的需要 ——
            // pvfUtility 导出的 `.nut` 以 `#PVF_File` 开头（pvfToolTw.js:997-1000 的明文分支、
            // :751-759 的导出头），以 `.nut` 打开时走的就是这套词法；不加这条规则，`#PVF_File` 会被
            // 标成「`#` 无作用域 + `PVF_File` 全局变量」而不是注释。
            // 生效位置：Monarch 逐段前进，`a#b` 的 `#` 也落在规则起点、按注释处理（与 `//` 相同，
            // 不要求前置空白）；写回端（pvfTool.js / pvfToolTw.js）只在 token 边界跳过 `#`，
            // 即 `a#b` 写回时仍是一个 token —— 差异只出现在这种真实数据里不存在的位置。
            // 产品决定，偏差登记在 docs/vscode-reference.md 第 5 节。
            [/#.*$/, "comment"],
            [/\/\*/, "comment", "@comment"],
            [/\/\/.*$/, "comment"]
        ],
        comment: [
            [/[^/*]+/, "comment"],
            [/\*\//, "comment", "@pop"],
            [/[/*]/, "comment"]
        ],
        stringDouble: [
            [/[^\\"]+/, "string.quoted.double"],
            [/@escapes/, "constant.character.escape"],
            [/\\./, "invalid.illegal.character.escape"],
            [/"/, "string.quoted.double", "@pop"]
        ],
        stringSingle: [
            [/[^\\']+/, "string.quoted.single"],
            [/@escapes/, "constant.character.escape"],
            [/\\./, "invalid.illegal.character.escape"],
            [/'/, "string.quoted.single", "@pop"]
        ]
    }
};

// 语言配置覆盖 language-configuration.json 的角色（见文件头：文件加载在 M3）。
// 形状对齐 <vscode>/extensions/go/language-configuration.json：注释、括号对、
// 自动闭合、包围对、缩进规则；`wordPattern` 与 squirrelSymbols.js 的标识符规则一致，
// 使「按词移动 / 选中」把 `Foo::bar` 视作一个词。
export const squirrelLanguageConfiguration = {
    comments: {
        lineComment: "//",
        blockComment: ["/*", "*/"]
    },
    brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"]
    ],
    autoClosingPairs: [["{", "}"], ["[", "]"], ["(", ")"], { open: '"', close: '"', notIn: ["string"] }, { open: "'", close: "'", notIn: ["string"] }],
    surroundingPairs: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"],
        ['"', '"'],
        ["'", "'"]
    ],
    indentationRules: {
        // 取 go 配置的「以 `{` 或 `(` 收尾则 +1 缩进」子模式（该文件同样只依赖括号，与 Squirrel 一致）
        increaseIndentPattern: "^.*(\\{[^}\"'`]*|\\([^)\"'`]*)$",
        decreaseIndentPattern: "^\\s*(\\}[)}]*[),]?|\\)[,]?)$"
    },
    wordPattern: "(-?\\d*\\.\\d\\w*)|([a-zA-Z_]\\w*(?:::[a-zA-Z_]\\w*)*)"
};
