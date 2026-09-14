// 面包屑的文件路径段（BreadcrumbsModel._initFilePathInfo 的纯函数形态）。
//
// 权威来源（microsoft/vscode）：
//   workbench/browser/parts/editor/breadcrumbsModel.ts:130-177  _initFilePathInfo：
//     - :139-144  `untitled` / `data` 两种 scheme 直接返回空 path（不显示文件段）；
//     - :151-160  自资源向上 `dirname`，遇到**工作区文件夹**或**家目录**即停
//       （`isEqual(info.folder.uri, uriPrefix)` / `isEqual(info.home, uriPrefix.with({query:null,fragment:null}))`），
//       最靠下的那段是 `FileKind.FILE`，其余是 `FileKind.FOLDER`；
//       走到 `uriPrefix.path === '/'` 或 `dirname` 不再变化时结束 —— **文件系统根不占一段**；
//     - :162-170 家目录分支：把家目录标签按分隔符拆开，前插 `ROOT_FOLDER` + 各级 `FOLDER`；
//     - :172-177  工作区根分支：仅 `WorkbenchState.WORKSPACE` 且（多文件夹 或 资源即文件夹本身）时
//       前插一个 `FileKind.ROOT_FOLDER` 条目。
//
// 本仓库的对应形态（偏差登记在 docs/vscode-reference.md 第 5 节）：
//   本仓库**没有工作区概念**（`src/builtInFiles.js:6`、`src/workbench/contrib/explorer/explorerService.js:11`
//   的既有登记；`docs/vscode-reference.md:974` 记为「恒等价于 EMPTY」），也没有标签服务与家目录概念，
//   因此 `folder` / `home` 恒为 undefined：
//     - 循环不会在 `samples` 处提前终止 —— 文件段是**到文件系统根为止的完整路径**
//       （`samples/common.nut` → `samples › common.nut`），而不是只有文件名；
//     - 家目录分支与工作区根分支都没有产出方（这两支的结论在 docs/vscode-reference.md 第 5 节登记）。
//   两个参数保留，是为了让 §4.4 的触发源/取值核对能落到权威的同一处分支，并由 check 脚本断言
//   「传入文件夹时在文件夹处停止」这条规则的取值。
import { dirname, isEqual } from "monaco-editor/base/common/resources.js";
import { FileKind } from "@/platform/files/common/files.js";

// breadcrumbsModel.ts:139 的 matchesSomeScheme(uri, Schemas.untitled, Schemas.data)
const NO_FILE_PATH_SCHEMES = new Set(["untitled", "data"]);

/**
 * 文件路径段（权威 _initFilePathInfo 的 :139-160 部分）。
 * @param {import("@/base/common/uri.js").URI} resource 编辑器资源
 * @param {{ workspaceFolder?: any|null, home?: any|null }} [options] 本仓库两者恒为空（见文件头注释）
 * @returns {Array<{ uri: any, fileKind: number }>} 自浅到深排列；`fileKind` 为 `FileKind.FILE` / `FOLDER`
 */
export function computeFileElements(resource, { workspaceFolder = null, home = null } = {}) {
    if (!resource || NO_FILE_PATH_SCHEMES.has(resource.scheme)) return [];

    const elements = [];
    let uriPrefix = resource;
    while (uriPrefix && uriPrefix.path !== "/") {
        const homeUri = home ? uriPrefix.with({ query: null, fragment: null }) : null;
        if ((workspaceFolder && isEqual(workspaceFolder, uriPrefix)) || (homeUri && isEqual(home, homeUri))) {
            break;
        }
        elements.unshift({ uri: uriPrefix, fileKind: elements.length === 0 ? FileKind.FILE : FileKind.FOLDER });
        const prevPathLength = uriPrefix.path.length;
        uriPrefix = dirname(uriPrefix);
        // dirname 走到顶后不再变化（权威用同一个 `prevPathLength` 判据兜底，:157-159）。
        if (uriPrefix.path.length === prevPathLength) break;
    }
    return elements;
}
