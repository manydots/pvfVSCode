// outline 树 → 「包含某位置的最深符号」路径（纯函数，无运行时依赖，便于 Node 逻辑测试）。
//
// 权威来源（microsoft/vscode）：
//   workbench/browser/parts/editor/breadcrumbsModel.ts:100-128  面包屑符号段取「当前符号链」
//   editor/contrib/documentSymbols/browser/outlineModel.ts       OutlineModel / OutlineElement 结构
//
// 结构要点（决定下面两个分支）：
//   1. OutlineModel.children 是 OutlineGroup 的 Map（按提供者分组）；
//   2. 只有一个提供者时 OutlineModel._compact() 会把分组拍平（monaco 发行包
//      editor/contrib/documentSymbols/browser/outlineModel.js:127-140），children 直接是
//      OutlineElement；两种形态都必须支持；
//   3. OutlineElement 带 symbol（含 range），OutlineGroup 不带，遇到分组直接下钻。

function containsPosition(range, position) {
    if (!range) return false;
    if (position.lineNumber < range.startLineNumber || position.lineNumber > range.endLineNumber) return false;
    if (position.lineNumber === range.startLineNumber && position.column < range.startColumn) return false;
    if (position.lineNumber === range.endLineNumber && position.column > range.endColumn) return false;
    return true;
}

export function isOutlineElement(node) {
    return Boolean(node?.symbol);
}

// 取「包含光标位置的最深符号」链：同级命中即下钻，得到与大纲一致的作用域路径。
export function collectPath(container, position, path) {
    for (const child of container.children.values()) {
        if (isOutlineElement(child)) {
            if (containsPosition(child.symbol.range, position)) {
                path.push(child);
                collectPath(child, position, path);
                return;
            }
        } else {
            collectPath(child, position, path);
        }
    }
}
