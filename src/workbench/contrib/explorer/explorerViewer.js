// 资源管理器树的数据源、虚拟代理、排序器与无障碍描述
// （对齐 <vscode>/src/vs/workbench/contrib/files/browser/views/explorerViewer.ts）。
//
// 权威这些对象都喂给 WorkbenchCompressibleAsyncDataTree（explorerView.ts:527-572 的 createTree）：
//   ExplorerDelegate        行高与模板（:78-89）
//   ExplorerDataSource      父子关系、身份、有无子节点（:92-170）
//   FileSorter              子节点排序（:1440-1562）
//   FilesRenderer 的无障碍面 getWidgetAriaLabel / getAriaLabel / getAriaLevel（:868-871、:1187-1207）
// 本仓库没有虚拟滚动与压缩文件夹，故行高只用于取值对照（行高由 CSS 的 22px 落实，见 ExplorerView.vue）。
//
// 未迁入的能力（压缩文件夹、查找过滤、拖放、文件嵌套）连同原因登记在 docs/vscode-reference.md 第 5 节。
import { compareFileNamesDefault } from "@/base/common/comparers.js";

export const FILE_TEMPLATE_ID = "file"; // FilesRenderer.ID，explorerViewer.ts:826

// explorerViewer.ts:78-89
export const ExplorerDelegate = {
    ITEM_HEIGHT: 22,
    getHeight: () => ExplorerDelegate.ITEM_HEIGHT,
    getTemplateId: () => FILE_TEMPLATE_ID
};

// FilesRenderer.getWidgetAriaLabel（explorerViewer.ts:868-871）：
// 无 nls 本地化，取英文原文（本仓库其余界面文案同样保持权威原文）。
export const EXPLORER_TREE_ARIA_LABEL = "Files Explorer";

// FilesRenderer.getAriaLabel（explorerViewer.ts:1189-1191）
export function getItemAriaLabel(item) {
    return item.name;
}

// FilesRenderer.getAriaLevel（explorerViewer.ts:1193-1207）：自己数父链长度；
// 单文件夹工作区（WorkbenchState.FOLDER）不加 1 —— 根文件夹不占 aria 层级，
// 其直接子节点的 aria-level 为 1。本仓库是单文件夹（见 explorerService.js）。
export function getItemAriaLevel(item) {
    let depth = 0;
    let parent = item.parent;
    while (parent) {
        parent = parent.parent;
        depth += 1;
    }
    return depth;
}

// 排序器的取值固定为权威默认档（explorer.sortOrder = 'default'、
// explorer.sortOrderLexicographicOptions = 'default'、explorer.sortOrderReverse = false，
// 见 files.contribution.ts:520-549）；这三项在本仓库未登记为配置项，已登记为偏差。
const SORT_ORDER = "default";
const COMPARE_FILE_NAMES = compareFileNamesDefault;

// ExplorerDataSource（explorerViewer.ts:92-170）。
// 权威的 getChildren 走 fetchChildren（可能异步解析磁盘），排序不在这里做 ——
// AsyncDataTree 取到子节点后按 sorter 排序（asyncDataTree.ts:1368-1369）。
// 本仓库的子节点是构建期已知的，故同样「取完再排」，结果与权威一致。
export class ExplorerDataSource {
    // 对齐 :116-119 的 getParent（权威对没有父的元素抛错）。
    getParent(item) {
        if (item.parent) return item.parent;
        throw new Error("getParent only supported for cached parents");
    }

    // 对齐 :111-114 的 hasChildren。
    hasChildren(item) {
        if (Array.isArray(item)) return true;
        return item.children.size > 0;
    }

    // 对齐 :116-170 的 getChildren（过滤与错误分支不迁入，见第 5 节）。
    getChildren(item) {
        if (Array.isArray(item)) return item;
        return [...item.children.values()].sort(FileSorter.compare);
    }

    // 对齐 explorerView.ts:85-93 的 identityProvider：条目身份即 ExplorerItem.getId()。
    getId(item) {
        return item.getId();
    }
}

// FileSorter（explorerViewer.ts:1440-1562）。'default' 档的判定：
// 目录在前（:1543-1556），其余按 compareFileNamesDefault 比较（:1561）。
export const FileSorter = {
    compare(a, b) {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (b.isDirectory && !a.isDirectory) return 1;
        return COMPARE_FILE_NAMES(a.name, b.name);
    }
};

// 暴露当前排序档，便于核查脚本断言「取值来自权威默认档而非自造」。
export const EXPLORER_SORT_ORDER = SORT_ORDER;
