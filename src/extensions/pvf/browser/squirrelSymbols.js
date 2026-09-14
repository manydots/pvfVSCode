// Squirrel（.nut）源码的符号解析（纯函数，无运行时依赖，便于 Node 逻辑测试）。
//
// 边界说明：VS Code 核心仓库不含 Squirrel 支持（由扩展提供），「解析出符号」属本仓库自建能力；
// 符号的消费侧（符号段如何进入面包屑、如何随光标更新）对齐权威实现
// workbench/browser/parts/editor/breadcrumbsModel.ts:100-128。

// 标识符允许 `::` 命名空间限定（如 Foo::bar）。
const IDENT = "[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*";

const PATTERNS = [
    { re: new RegExp(`^\\s*(?:local\\s+|static\\s+|global\\s+)?(${IDENT})\\s*<-\\s*class\\b`), kind: "Class" },
    { re: new RegExp(`^\\s*(?:local\\s+|static\\s+|global\\s+)?(${IDENT})\\s*<-\\s*function\\b`), kind: "Function" },
    { re: new RegExp(`^\\s*class\\s+(${IDENT})`), kind: "Class" },
    { re: new RegExp(`^\\s*function\\s+(${IDENT})\\s*\\(`), kind: "Function" },
    // 槽赋值（`X <- 值`，含 `local/static/global X <- 值`）：变量符号。排在最后，
    // `X <- class` / `X <- function` 已被上面的模式先匹配走。
    { re: new RegExp(`^\\s*(?:local\\s+|static\\s+|global\\s+)?(${IDENT})\\s*<-`), kind: "Variable" }
];

// 去掉行内字符串与注释，避免其中的大括号干扰块范围统计。
// 注释符与词法一致（squirrel.js 的 whitespace 状态）：`//`（Squirrel 规范）与 `#`（PVF 明文导出，
// 如 `#PVF_File` 头）；`/* */` 跨行块注释仍不处理（本解析器逐行工作，见文件头「边界说明」）。
function stripLiterals(line) {
    let out = "";
    let quote = null;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quote) {
            if (ch === "\\") i++;
            else if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") quote = ch;
        else if (ch === "#" || (ch === "/" && line[i + 1] === "/")) break;
        else out += ch;
    }
    return out;
}

// 代码块结束行：从起始行起按大括号配平（找不到配平则到文件末尾）。
function blockEndLine(lines, start) {
    let depth = 0;
    let started = false;
    for (let i = start; i < lines.length; i++) {
        for (const ch of stripLiterals(lines[i])) {
            if (ch === "{") {
                depth += 1;
                started = true;
            } else if (ch === "}") {
                depth -= 1;
            }
        }
        if (started && depth <= 0) return i + 1;
    }
    return lines.length;
}

/**
 * 解析符号（类、函数与变量），按块范围还原嵌套关系。
 * 返回 [{ name, kind: "Function"|"Class"|"Variable", startLine, endLine, children }]，行号从 1 起。
 */
export function parseSquirrelSymbols(lines) {
    const flat = [];
    for (let i = 0; i < lines.length; i++) {
        const text = stripLiterals(lines[i]);
        for (const { re, kind } of PATTERNS) {
            const match = re.exec(text);
            if (!match) continue;
            // 变量（槽赋值）不占块：范围就是声明行自身；类/函数按大括号配平取块尾。
            const endLine = kind === "Variable" ? i + 1 : blockEndLine(lines, i);
            flat.push({ name: match[1], kind, startLine: i + 1, endLine, children: [] });
            break;
        }
    }

    const roots = [];
    const stack = [];
    for (const symbol of flat) {
        while (stack.length && stack[stack.length - 1].endLine < symbol.startLine) stack.pop();
        const parent = stack[stack.length - 1];
        // 只有类才有嵌套成员（Squirrel 的函数内可再定义函数，但大纲按类分组更贴近使用习惯）。
        if (parent && parent.kind === "Class") parent.children.push(symbol);
        else roots.push(symbol);
        stack.push(symbol);
    }
    return roots;
}

// 解析结果 → monaco 的 DocumentSymbol（outline 服务 / 粘性滚动 outline 层需要的结构）。
// 保持纯函数：SymbolKind 由调用方传入（浏览器侧传 monaco.languages.SymbolKind，测试可传等价枚举）。
// range / selectionRange 缺一不可：monaco 的 OutlineModel 用 range 生成条目 id，
// StickyModelProvider 用 selectionRange.startLineNumber 计算粘性行（见
// editor/contrib/documentSymbols/browser/outlineModel.js:75-104、
// editor/contrib/stickyScroll/browser/stickyScrollModelProvider.js:176-230）。
export function toDocumentSymbols(symbols, SymbolKind) {
    return symbols.map(symbol => ({
        name: symbol.name,
        kind: SymbolKind[symbol.kind],
        range: { startLineNumber: symbol.startLine, startColumn: 1, endLineNumber: symbol.endLine, endColumn: 1 },
        selectionRange: { startLineNumber: symbol.startLine, startColumn: 1, endLineNumber: symbol.startLine, endColumn: 1 },
        children: toDocumentSymbols(symbol.children, SymbolKind)
    }));
}
