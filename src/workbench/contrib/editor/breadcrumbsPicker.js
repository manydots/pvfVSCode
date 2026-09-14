// 面包屑选择器（picker）：浮层定位、行模型、预览/跳转与键盘、鼠标交互的状态机。
//
// 权威来源（microsoft/vscode）：
//   workbench/browser/parts/editor/breadcrumbsPicker.ts:44-152   浮层 DOM 与 _layout
//   workbench/browser/parts/editor/breadcrumbsPicker.ts:345-440  BreadcrumbsFilePicker（树选项、_setInput、_revealElement）
//   workbench/browser/parts/editor/breadcrumbsPicker.ts:463-517  BreadcrumbsOutlinePicker（排序、collapseByDefault、_setInput）
//   workbench/browser/parts/editor/breadcrumbsControl.ts:609-624 _onFocusEvent / _breadcrumbsPickerIgnoreOnceItem
//   workbench/browser/parts/editor/breadcrumbsControl.ts:626-760 _onSelectEvent：带 payload 的选中 → _revealInEditor，普通点击 → 浮层
//   workbench/browser/parts/editor/breadcrumbsControl.ts:672-705 定位公式（宽度、最大高度、箭头、溢出翻转）
//   workbench/browser/parts/editor/breadcrumbsControl.ts:718-736 onHide（未选择时还原视图状态）
//   platform/list/browser/listService.ts:676-780               ResourceNavigator（单击/双击/中键/键盘打开与 preserveFocus、pinned）
//   workbench/browser/actions/listCommands.ts:336-380/448-490/559-570/754-765  左/右/回车/空格的命令语义
//   base/browser/ui/tree/abstractTree.ts:2534-2599             TreeNodeListMouseController.onViewPointer（箭头展开/折叠、双击）
//   base/browser/ui/list/listWidget.js:585-630                 MouseController（按下只 domFocus、click 设焦点+选中）
//   base/browser/ui/list/listWidget.js:361-368/440-483         TypeNavigationController 与可打印字符判定
//   base/browser/ui/list/listWidget.js:1367-1429               focusNextPage / focusPreviousPage
//   base/browser/ui/contextview/contextview.ts:167-175/337-372 layout2d 的锚点 rect 与落点
//
// 裁剪与替代（登记在 docs/vscode-reference.md 第 5 节）：
//   1. 行的渲染不经 monaco 的 List/Tree —— 发行包未打包 tree 样式表，且本仓库的浮层由 Vue 渲染；
//      行的取值、缩进公式、可见性、折叠默认值、交互语义均逐条对齐上面的权威实现；
//   2. 键盘不走 workbench 的 `list.*` 命令 + 上下文键体系，改为浮层自身的 keydown 处理，
//      每个分支在注释里对照 listCommands.ts 的对应实现；
//   3. SideBySide（Ctrl/Cmd/Alt + 点击、breadcrumbs.openInSideGroup）在本仓库没有第二个编辑器分组，恒按 false 处理。
import { reactive } from "vue";
import { dirname, isEqual } from "monaco-editor/base/common/resources.js";
import { matchesFuzzy2, matchesPrefix } from "monaco-editor/base/common/filters.js";
import { FileKind } from "@/platform/files/common/files.js";
import { getTreeIndent, listOpenOnSingleClick, treeExpandOnlyOnTwistieClick } from "@/platform/list/browser/listService.js";
import { compareFileNames } from "@/base/common/comparers.js";
import { outlineAncestors, outlineChildren, previewSymbol, revealSymbol, isOutlineElement } from "@/workbench/contrib/codeEditor/browser/outline/documentSymbolsOutline.js";
import { flattenSymbolRows, isSymbolVisible, symbolNavigationLabel, symbolRowMetrics, SYMBOL_ROW_HEIGHT, SYMBOL_SORT_ORDER_CONFIG } from "@/workbench/contrib/codeEditor/browser/outline/documentSymbolsTree.js";
import { getFileIconClasses } from "@/workbench/services/themes/fileIconTheme.js";
import { configurationService } from "@/workbench/services/configuration/browser/configurationService.js";
import { getItemLanguageId } from "@/workbench/contrib/explorer/explorerService.js";
import { OUTLINE_ICONS_CONFIG } from "@/workbench/contrib/codeEditor/browser/outline/outline.configuration.js";

export const BREADCRUMBS_PICKER_KIND = Object.freeze({ FILE: "file", OUTLINE: "outline" });

// 文件树的内部根（asyncDataTree.ts:783 `this.root.element = input`）：根自身不渲染，
// 但 abstractTree.js:527-563 生成缩进参考线时会一直走到根节点（getParentNodeLocation
// 对顶层行返回根的位置），故顶层行也有一条属于根的参考线，需要一个身份参与活动态判定。
const FILE_PICKER_ROOT_ID = "__breadcrumbs-file-picker-root__";

// 浮层的公开状态（由 BreadcrumbsPicker.vue 渲染）。
export const breadcrumbsPicker = reactive({
    visible: false,
    kind: null,
    // 触发本次浮层的面包屑条目下标（breadcrumbsControl.ts:610 的 event.item）
    anchorIndex: -1,
    // 触发本次浮层的面包屑条目身份（ignore-once 比较用：权威比较的是 item 对象，
    // 见 breadcrumbsControl.ts:609-613；本仓库条目以 key 为身份）
    anchorKey: null,
    // 几何（breadcrumbsControl.ts:672-705）
    x: 0,
    y: 0,
    // 竖直落点（contextview.ts:337-372 的 layout2d，锚点矩形高 2）：
    // 由 totalHeight 与视口高算出，见 recomputeRows。
    top: 0,
    viewportHeight: 0,
    width: 0,
    maxHeight: 0,
    totalHeight: 0,
    treeHeight: 0,
    arrowSize: 8,
    arrowOffset: 0,
    // 浮层是否因「选中跳转」关闭（onHide 的 didPick：为真时不还原视图状态，:719-721）
    didPick: false,
    // 扁平化后的可见行，以及聚焦/选中下标
    rows: [],
    focusIndex: -1,
    selectionIndex: -1
});

// 会话状态：打开期间存在，关闭即丢弃。内含打开时的配置快照 ——
// OutlineTreeSorter 在构造时读一次 breadcrumbs.symbolSortOrder（breadcrumbsPicker.ts:455-470），
// DocumentSymbolFilter 在 setInput 期间逐元素读 breadcrumbs.show*（documentSymbolsTree.ts:328-341），
// 两者都等价于「打开时快照」，故浮层打开后改配置不再生效。
let session = null;

// ---------------------------- 定位与尺寸（纯函数，供 check 脚本断言） ----------------------------

/**
 * 浮层的锚点与几何（breadcrumbsControl.ts:672-705）。
 * @param {{ innerWidth: number, innerHeight: number, anchor: { top: number, left: number, width: number, height: number }, pointerX?: number|null }} options
 */
export function computePickerAnchor({ innerWidth, innerHeight, anchor, pointerX = null }) {
    const maxInnerWidth = innerWidth - 8; // “a little less the full widget”（:674）
    let maxHeight = Math.min(innerHeight * 0.7, 300); // :675
    const width = Math.min(maxInnerWidth, Math.max(240, maxInnerWidth / 4.17)); // :677
    const arrowSize = 8; // :678
    let arrowOffset;

    const y = anchor.top + anchor.height + arrowSize; // :681
    if (y + maxHeight >= innerHeight) {
        maxHeight = innerHeight - y - 30; // room for shadow and status bar（:683）
    }
    let x = anchor.left; // :685
    if (x + width >= maxInnerWidth) {
        x = maxInnerWidth - width; // :687
    }
    if (typeof pointerX === "number") {
        // 鼠标触发：箭头对准点击位置；超出最大偏移时整体左移（:689-696）
        const maxArrowOffset = width - 2 * arrowSize;
        arrowOffset = pointerX - x;
        if (arrowOffset > maxArrowOffset) {
            x = Math.min(maxInnerWidth - width, x + arrowOffset - maxArrowOffset);
            arrowOffset = maxArrowOffset;
        }
    } else {
        // 键盘触发：箭头对在条目宽度的 30% 处（:698）
        arrowOffset = anchor.left + anchor.width * 0.3 - x;
    }
    return { x, y, width, maxHeight, arrowSize, arrowOffset: Math.max(0, arrowOffset) };
}

/**
 * 浮层在容器内的落点（`contextview.ts:337-372` 的 doLayout 走 `layout2d`，锚点是
 * `{x, y}` 这种 IAnchor 时 `getAnchorRect` 给 `{top: y, left: x, width: 1, height: 2}`
 * （`contextview.ts:167-175`），对齐/朝向取默认的 left + below + vertical（`contextview.ts:48-50`）。
 * 这里只实现竖直分支（layout.ts:96-118）：正常情况下 `top = y + 2`；
 * 空间不足时按 layout.ts:67-85 翻转到锚点上方或与锚点重叠。
 */
export function computePickerPosition({ viewportHeight, viewHeight, anchorTop, anchorHeight }) {
    const afterBoundary = anchorTop + anchorHeight;
    const beforeBoundary = anchorTop;
    if (viewHeight <= viewportHeight - afterBoundary) return afterBoundary; // ok：贴在锚点下方
    if (viewHeight <= beforeBoundary) return beforeBoundary - viewHeight; // flipped：翻到锚点上方
    return Math.max(viewportHeight - viewHeight, 0); // overlap：盖在锚点上
}

/**
 * 高度分配（breadcrumbsPicker.ts:112-127 的 _layout）：
 * 头部 = 2 × 箭头大小（箭头 top 为 -2×arrowSize、borderWidth 为 arrowSize），
 * 树高 = min(maxHeight - 头部, 内容高)，总高 = 树高 + 头部。
 */
export function computePickerLayout({ maxHeight, arrowSize, contentHeight }) {
    const headerHeight = 2 * arrowSize;
    const treeHeight = Math.min(maxHeight - headerHeight, contentHeight);
    return { headerHeight, treeHeight, totalHeight: treeHeight + headerHeight };
}

/** 行内容高度（monaco ListView 的 contentHeight = 行高 × 行数）。 */
export function pickerContentHeight(rows) {
    return rows.length * SYMBOL_ROW_HEIGHT;
}

// ---------------------------- 行模型 ----------------------------

function symbolRows() {
    const { outline, order, isVisible, collapsed } = session;
    const rows = flattenSymbolRows(outline, {
        order,
        isVisible,
        isCollapsed: id => collapsed.has(id),
        indent: getTreeIndent()
    });
    // 图标开关：DocumentSymbolRenderer.renderElement 逐次渲染时读 outline.icons
    // （documentSymbolsTree.ts:221-226），为假时不给 .outline-element-icon 加 codicon 类。
    if (configurationService.getValue(OUTLINE_ICONS_CONFIG)) return rows;
    return rows.map(row => ({ ...row, icon: undefined }));
}

// breadcrumbsPicker.ts:330-343 的 FileSorter：目录在前，同类按 compareFileNames。
function compareFileSorter(a, b) {
    if (a.isDirectory === b.isDirectory) return compareFileNames(a.name, b.name);
    return a.isDirectory ? -1 : 1;
}

function fileRows() {
    const { fileChildren, collapsed } = session;
    const rows = [];
    const indent = getTreeIndent();
    const visit = (items, depth, ancestorIds) => {
        for (const item of [...items].sort(compareFileSorter)) {
            const collapsible = item.isDirectory && item.children.size > 0;
            const isCollapsed = collapsible && collapsed.has(item.getId());
            rows.push({
                element: item,
                id: item.getId(),
                depth,
                collapsible,
                collapsed: isCollapsed,
                label: item.name,
                isDirectory: item.isDirectory,
                isGroup: false,
                // breadcrumbsPicker.ts:216-234 的 FileRenderer：图标类名按资源语言取（文件图标主题）。
                fileIconClasses: getFileIconClasses(item.name, item.isDirectory ? undefined : getItemLanguageId(item), item.isDirectory ? FileKind.FOLDER : FileKind.FILE),
                title: item.name,
                // 文件 picker 不传 collapseByDefault（breadcrumbsPicker.ts:381-396）→ 默认展开。
                // 缩进与参考线与符号 picker 同源：abstractTree.js:445-450 的 indentSize 公式
                // （defaultIndent + (depth-1) * indent）与 :527-563 的参考线生成对两棵树一视同仁。
                ancestorIds,
                metrics: symbolRowMetrics(depth, indent)
            });
            if (collapsible && !isCollapsed) visit([...item.children.values()], depth + 1, [...ancestorIds, item.getId()]);
        }
    };
    visit(fileChildren, 1, [FILE_PICKER_ROOT_ID]);
    return rows;
}

/**
 * 缩进参考线的活动祖先集合（abstractTree.js:565-597 的 _onDidChangeActiveNodes）：
 * 活动节点 = 焦点 ∪ 选中；每个节点自身满足「可折叠 && 有子节点 && 未折叠」时贡献自己，
 * 否则贡献它的父节点。参考线按**祖先**（而非行自身）判活动态（:527-563 的 _renderIndentGuides）。
 * @returns {Set<string>} 活动祖先的条目 id
 */
export function activeIndentNodeIds() {
    const rows = breadcrumbsPicker.rows;
    const active = new Set();
    const indexes = [breadcrumbsPicker.focusIndex, breadcrumbsPicker.selectionIndex];
    for (const index of indexes) {
        const row = rows[index];
        if (!row) continue;
        if (row.collapsible && !row.collapsed) {
            active.add(row.id);
        } else {
            // 父节点 = 深度小 1 的最近前驱（扁平行序里的祖先链）
            for (let i = index - 1; i >= 0; i--) {
                if (rows[i].depth === row.depth - 1) {
                    active.add(rows[i].id);
                    break;
                }
            }
        }
    }
    return active;
}

function recomputeRows() {
    if (!session) {
        breadcrumbsPicker.rows = [];
        return;
    }
    breadcrumbsPicker.rows = session.kind === BREADCRUMBS_PICKER_KIND.OUTLINE ? symbolRows() : fileRows();
    const layout = computePickerLayout({
        maxHeight: breadcrumbsPicker.maxHeight,
        arrowSize: breadcrumbsPicker.arrowSize,
        contentHeight: pickerContentHeight(breadcrumbsPicker.rows)
    });
    breadcrumbsPicker.treeHeight = layout.treeHeight;
    breadcrumbsPicker.totalHeight = layout.totalHeight;
    layoutPickerPosition();
}

// ---------------------------- 打开 / 关闭 ----------------------------

function beginSession(kind, anchorIndex, geometry, extra) {
    // 已有浮层时重新打开（焦点换段 → 再次选中 → 新 picker）：权威的 showContextView 会先把旧浮层
    // 隐藏（contextview.ts:287-292 的 `if (this.isVisible()) this.hide(undefined, true)`），
    // 旧 picker 的 onHide 因没有 didPick 而还原上一个预览的视图状态（breadcrumbsControl.ts:709-712），
    // 并在 :719 dispose 旧 picker（其类型导航定时器随 disposables 一并清理）。
    if (session) {
        session.restoreViewState?.();
        clearTypeNavigation();
    }
    closePreview();
    session = {
        kind,
        anchorIndex,
        collapsed: new Set(),
        order: "position",
        isVisible: () => true,
        fileChildren: [],
        outline: null,
        editor: null,
        openFile: null,
        previewDispose: null,
        restoreViewState: null,
        typeNavBuffer: "",
        typeNavWasTyping: false,
        typeNavTimer: null,
        ...extra
    };
    breadcrumbsPicker.kind = kind;
    breadcrumbsPicker.anchorIndex = anchorIndex;
    breadcrumbsPicker.anchorKey = extra.anchorKey ?? null;
    breadcrumbsPicker.didPick = false;
    breadcrumbsPicker.x = geometry.x;
    breadcrumbsPicker.y = geometry.y;
    breadcrumbsPicker.viewportHeight = geometry.viewportHeight ?? 0;
    breadcrumbsPicker.width = geometry.width;
    breadcrumbsPicker.maxHeight = geometry.maxHeight;
    breadcrumbsPicker.arrowSize = geometry.arrowSize;
    breadcrumbsPicker.arrowOffset = geometry.arrowOffset;
    breadcrumbsPicker.focusIndex = -1;
    breadcrumbsPicker.selectionIndex = -1;
    breadcrumbsPicker.visible = true;
}

/** collapseByDefault: true（breadcrumbsPicker.ts:480）：所有可折叠节点初始折叠。 */
function collectCollapsibleIds(element, ids) {
    const children = outlineChildren(element);
    if (!children.length) return;
    ids.add(element.id);
    for (const child of children) collectCollapsibleIds(child, ids);
}

/**
 * 打开符号选择器（BreadcrumbsOutlinePicker，breadcrumbsPicker.ts:463-517）。
 * @param {{ anchorIndex: number, geometry: any, outline: any, editor: any, focusElement?: any, captureViewState?: () => (() => void) }} options
 */
export function showOutlinePicker({ anchorIndex, geometry, outline, editor, focusElement, captureViewState }) {
    const order = configurationService.getValue(SYMBOL_SORT_ORDER_CONFIG);
    const collapsed = new Set();
    for (const child of outlineChildren(outline)) collectCollapsibleIds(child, collapsed);
    beginSession(BREADCRUMBS_PICKER_KIND.OUTLINE, anchorIndex, geometry, {
        outline,
        editor,
        collapsed,
        order: order === "name" || order === "type" ? order : "position",
        // DocumentSymbolFilter 的前缀为 'breadcrumbs'（documentSymbolsOutline.ts:171-175）
        isVisible: element => isSymbolVisible(element, key => configurationService.getValue(key), "breadcrumbs"),
        restoreViewState: captureViewState ? captureViewState() : null
    });
    if (focusElement && isOutlineElement(focusElement)) {
        // _setInput 的 `tree.reveal(input.element, 0.5)` → model.expandTo（abstractTree.js:1939-1941）
        // → 展开祖先路径；随后 `setFocus([input.element], fakeEvent)` 聚焦当前符号（:490-501）。
        for (const ancestor of outlineAncestors(focusElement)) session.collapsed.delete(ancestor.id);
        recomputeRows();
        focusRowById(focusElement.id);
    } else {
        recomputeRows();
    }
}

/**
 * 打开文件选择器（BreadcrumbsFilePicker，breadcrumbsPicker.ts:345-440）。
 * 调用方按 _setInput 的规则解析输入（:400-411，见 resolveFilePickerInput），
 * 并把被点击元素作为 focusResource 聚焦（:412-424）。
 * @param {{ anchorIndex: number, geometry: any, directory: any, focusResource?: any, openFile: (item: any, options: any) => void }} options
 */
export function showFilePicker({ anchorIndex, geometry, directory, focusResource, openFile }) {
    const children = directory ? [...directory.children.values()] : [];
    beginSession(BREADCRUMBS_PICKER_KIND.FILE, anchorIndex, geometry, { fileChildren: children, openFile });
    recomputeRows();
    if (focusResource) {
        const row = breadcrumbsPicker.rows.find(item => isEqual(item.element.resource, focusResource));
        if (row) focusRowById(row.id, { preview: false });
    }
}

/**
 * 关闭浮层（breadcrumbsControl.ts:718-736 的 onHide）：未选择时还原编辑器视图状态（:719-721），
 * 并清掉预览高亮（breadcrumbsPicker.ts:63-75 的 dispose → _previewDisposables.dispose()）。
 * @param {{ didPick?: boolean }} [options]
 */
export function hidePicker({ didPick = false } = {}) {
    if (!session) return;
    // onHide 的 didPick（breadcrumbsControl.ts:719-721）：为真时**不**还原编辑器视图状态。
    breadcrumbsPicker.didPick = didPick;
    if (!didPick && session.restoreViewState) session.restoreViewState();
    clearTypeNavigation();
    closePreview();
    session = null;
    breadcrumbsPicker.visible = false;
    breadcrumbsPicker.kind = null;
    breadcrumbsPicker.rows = [];
    breadcrumbsPicker.focusIndex = -1;
    breadcrumbsPicker.selectionIndex = -1;
    breadcrumbsPicker.anchorIndex = -1;
    breadcrumbsPicker.anchorKey = null;
}

export function isPickerShowing() {
    return breadcrumbsPicker.visible;
}

/**
 * 视口变化后重算竖直落点（`contextview.ts:324-337` 的 `layout()`：resize 时走 `doLayout`
 * 用**缓存的锚点**重跑 `layout2d`，浮层自身尺寸不动 —— 权威在 `picker.show(...)` 里
 * 把宽度/最大高度/箭头偏移一次性写进浮层，`getAnchor` 之后直接返回缓存的 `pickerAnchor`）。
 * 因此这里只更新视口高并重算 `top`（`computePickerPosition`），不重建行模型。
 * @param {{ viewportHeight: number }} geometry
 */
export function relayoutPicker({ viewportHeight }) {
    if (!session) return;
    breadcrumbsPicker.viewportHeight = viewportHeight;
    layoutPickerPosition();
}

/** 浮层的竖直落点：锚点是 `{x, y}`（矩形高 2，contextview.ts:167-175），默认贴在下方。 */
function layoutPickerPosition() {
    breadcrumbsPicker.top = computePickerPosition({
        viewportHeight: breadcrumbsPicker.viewportHeight,
        viewHeight: breadcrumbsPicker.totalHeight,
        anchorTop: breadcrumbsPicker.y,
        anchorHeight: 2
    });
}

function closePreview() {
    if (session?.previewDispose) {
        session.previewDispose();
        session.previewDispose = null;
    }
}

// ---------------------------- 聚焦 / 预览 / 选中 ----------------------------

/**
 * 聚焦某行并预览 —— 预览的唯一触发源是 focus 变化（breadcrumbsPicker.ts:101-103 的 onDidChangeFocus）。
 * @param {number} index
 * @param {{ preview?: boolean }} [options]
 */
export function focusRow(index, { preview = true } = {}) {
    if (!session || index < 0 || index >= breadcrumbsPicker.rows.length) return;
    breadcrumbsPicker.focusIndex = index;
    if (!preview) return;
    const row = breadcrumbsPicker.rows[index];
    closePreview();
    // OutlinePicker._previewElement → outline.preview（:506-509，documentSymbolsOutline.ts:242-260）；
    // 文件 picker 的 _previewElement 返回 Disposable.None（:429-431）→ 不预览。
    if (session.kind === BREADCRUMBS_PICKER_KIND.OUTLINE) {
        session.previewDispose = previewSymbol(session.editor, row.element);
    }
}

function focusRowById(id, options) {
    const index = breadcrumbsPicker.rows.findIndex(row => row.id === id);
    if (index >= 0) focusRow(index, options);
}

function setRowSelection(index) {
    breadcrumbsPicker.selectionIndex = index;
}

/**
 * 展开/折叠一行（list.toggleExpand → tree.toggleCollapsed，listCommands.ts:754-765；
 * 鼠标路径见 abstractTree.js:1540-1546 的 `toggleCollapsed(location, recursive = altKey)`）。
 * @param {number} index
 * @param {boolean} [recursive]
 */
export function toggleRowCollapsed(index, recursive = false) {
    if (!session) return;
    const row = breadcrumbsPicker.rows[index];
    if (!row?.collapsible) return;
    if (recursive) setCollapsedRecursive(row.element, !row.collapsed);
    else if (row.collapsed) session.collapsed.delete(row.id);
    else session.collapsed.add(row.id);
    recomputeRows();
    // 折叠会改变行下标，焦点跟回同一元素
    focusRow(
        breadcrumbsPicker.rows.findIndex(item => item.id === row.id),
        { preview: false }
    );
}

// 等价于 model.setCollapsed(location, undefined, recursive)：整棵子树一起折叠/展开。
function setCollapsedRecursive(element, collapsed) {
    const children = [...(element?.children?.values?.() ?? [])];
    if (!children.length) return;
    if (collapsed) session.collapsed.add(element.id);
    else session.collapsed.delete(element.id);
    for (const child of children) setCollapsedRecursive(child, collapsed);
}

/** 左方向键（list.collapse，listCommands.ts:336-380）：可折叠且已展开则折叠；否则聚焦父行。 */
export function collapseFocusedRow() {
    const index = breadcrumbsPicker.focusIndex;
    const row = breadcrumbsPicker.rows[index];
    if (!row) return;
    if (row.collapsible && !row.collapsed) {
        toggleRowCollapsed(index);
        return;
    }
    for (let i = index - 1; i >= 0; i--) {
        if (breadcrumbsPicker.rows[i].depth < row.depth) {
            focusRow(i);
            return;
        }
    }
}

/** 右方向键（list.expand，listCommands.ts:448-490）：可折叠且已折叠则展开；否则聚焦第一个子行。 */
export function expandFocusedRow() {
    const index = breadcrumbsPicker.focusIndex;
    const row = breadcrumbsPicker.rows[index];
    if (!row) return;
    if (row.collapsible && row.collapsed) {
        toggleRowCollapsed(index);
        return;
    }
    const next = breadcrumbsPicker.rows[index + 1];
    if (next && next.depth > row.depth) focusRow(index + 1);
}

/** 空格（listCommands.ts:754-765）：可折叠则切换折叠，否则等价于回车（selectElement(true)）。 */
export function toggleFocusedRowCollapsed() {
    const row = breadcrumbsPicker.rows[breadcrumbsPicker.focusIndex];
    if (!row) return;
    if (row.collapsible) toggleRowCollapsed(breadcrumbsPicker.focusIndex);
    else acceptRow(breadcrumbsPicker.focusIndex);
}

/**
 * 打开一行（ResourceNavigator._open 与 picker 的 onDidOpen，breadcrumbsPicker.ts:87-94）：
 * 符号 picker 的 _revealElement 恒返回 true（:511-516）→ 跳转并关闭；
 * 文件 picker 只有文件会打开（:432-439），目录返回 false → 浮层保持。
 * 两者都把 preserveFocus 覆盖为 false（picker 自己的 onDidOpen 参数），跳转后焦点交给编辑器。
 * @param {any} row
 * @param {{ pinned: boolean }} options
 * @returns {boolean} 是否发生了「打开并关闭」
 */
function openRow(row, { pinned }) {
    if (!session) return false;
    const index = breadcrumbsPicker.rows.indexOf(row);
    if (index < 0) return false;
    setRowSelection(index);
    if (session.kind === BREADCRUMBS_PICKER_KIND.OUTLINE) {
        // 跳转（revealSymbol）会同步把焦点交给编辑器 → 浮层 focusout → notifyBreadcrumbsPickerBlur。
        // 必须先置 didPick：失焦路径据此跳过视图状态还原，否则还原会抵消刚做的跳转
        // （权威的 openEditor 异步完成，onDidPick 先于失焦的 onHide 到达，无此时序问题）。
        breadcrumbsPicker.didPick = true;
        // reveal 的 select 参数为 false（:514）→ 光标落在符号 selectionRange 起点，不整段选中
        revealSymbol(session.editor, row.element);
        hidePicker({ didPick: true });
        return true;
    }
    if (row.isDirectory) return false;
    // 文件打开同样会同步移交焦点（openEditor → activateEditor → editor.focus()），先置 didPick。
    breadcrumbsPicker.didPick = true;
    session.openFile?.(row.element, { preserveFocus: false, pinned });
    hidePicker({ didPick: true });
    return true;
}

/**
 * 回车（list.select，listCommands.ts:559-570 → ResourceNavigator.onSelectionFromKeyboard）：
 * 键盘路径的 pinned = !preserveFocus = false（listService.ts:715-717）。
 * @param {number} [index]
 */
export function acceptRow(index = breadcrumbsPicker.focusIndex) {
    const row = breadcrumbsPicker.rows[index];
    if (!row) return false;
    return openRow(row, { pinned: false });
}

// ---------------------------- 键盘导航 ----------------------------

export function focusNextRow(count = 1) {
    if (breadcrumbsPicker.focusIndex < 0) return focusRow(0);
    const next = Math.min(breadcrumbsPicker.focusIndex + count, breadcrumbsPicker.rows.length - 1);
    if (next !== breadcrumbsPicker.focusIndex) focusRow(next);
}

export function focusPreviousRow(count = 1) {
    if (breadcrumbsPicker.focusIndex < 0) return focusRow(0);
    const next = Math.max(breadcrumbsPicker.focusIndex - count, 0);
    if (next !== breadcrumbsPicker.focusIndex) focusRow(next);
}

export function focusFirstRow() {
    if (breadcrumbsPicker.rows.length) focusRow(0);
}

export function focusLastRow() {
    if (breadcrumbsPicker.rows.length) focusRow(breadcrumbsPicker.rows.length - 1);
}

/**
 * PageDown（list.focusPageDown → ListWidget.focusNextPage，listWidget.js:1367-1395）：
 * 焦点不在最后可见行且在其上方时先聚焦最后可见行；否则整页下滚后取新的最后可见行
 * （scroll → timeout(0) → 递归，本仓库由组件「焦点行滚入视口」等价完成，见 BreadcrumbsPicker.vue）。
 * @param {{ firstVisible: number, lastVisible: number, pageSize: number }} viewport
 */
export function focusNextPage(viewport) {
    const count = breadcrumbsPicker.rows.length;
    if (!count) return;
    const focus = breadcrumbsPicker.focusIndex;
    if (focus !== viewport.lastVisible && (focus === -1 || viewport.lastVisible > focus)) {
        focusRow(viewport.lastVisible);
        return;
    }
    focusRow(Math.min(viewport.lastVisible + viewport.pageSize, count - 1));
}

/** PageUp（list.focusPageUp → ListWidget.focusPreviousPage，listWidget.js:1397-1429）：与上面对称。 */
export function focusPreviousPage(viewport) {
    if (!breadcrumbsPicker.rows.length) return;
    const focus = breadcrumbsPicker.focusIndex;
    if (focus !== viewport.firstVisible && (focus === -1 || focus >= viewport.firstVisible)) {
        focusRow(viewport.firstVisible);
        return;
    }
    focusRow(Math.max(viewport.firstVisible - viewport.pageSize, 0));
}

// DefaultKeyboardNavigationDelegate.mightProducePrintableCharacter（listWidget.js:361-368，
// 权威 listWidget.ts:448-455）：无 ctrl/meta/alt，且键在 A-Z｜0-9｜小键盘 0-9｜`;=,-./\`[\]'` 之内。
// 判定按 VS Code 的 KeyCode 区间；浏览器侧用 event.key 等价表达（空格不在任何区间内，须排除）。
const PRINTABLE_KEYS = /^[A-Za-z0-9;,=\-./`[\]\\']$/;
export function isTypeNavigationKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    return PRINTABLE_KEYS.test(event.key ?? "");
}

/**
 * 输入即定位（TypeNavigationController.onInput，listWidget.js:440-483）：
 * 先前缀匹配（matchesPrefix），再模糊匹配（matchesFuzzy2 且首个匹配片段长度 > 1、只匹配到一处）；
 * 800ms 无输入清零（:408 的 Event.debounce(onChar, () => null, 800)），清零即回到 Idle 态。
 * 导航标签：符号取 symbol.name（documentSymbolsTree.ts:39-49），分组取 label，文件取文件名。
 *
 * 启用条件：列表只要给了 keyboardNavigationLabelProvider 就会建 TypeNavigationController
 * （listWidget.js:1174-1178，与 keyboardSupport 无关），两个 picker 都给了（breadcrumbsPicker.ts:391/487）。
 * @param {string} key 单个可打印字符（判定见 isTypeNavigationKey）
 * @returns {boolean} 是否消费了该按键
 */
export function typeNavigationInput(key) {
    if (!session || key.length !== 1) return false;
    clearTimeout(session.typeNavTimer);
    session.typeNavTimer = setTimeout(() => {
        session.typeNavBuffer = "";
        session.typeNavWasTyping = false;
        session.typeNavTimer = null;
    }, 800);

    const word = session.typeNavBuffer + key;
    session.typeNavBuffer = word;
    // Idle 态下的首次输入从下一行开始找（listWidget.js:448 的 delta = state === Idle ? 1 : 0）
    const delta = session.typeNavWasTyping ? 0 : 1;
    session.typeNavWasTyping = true;
    if (!breadcrumbsPicker.rows.length) return true;

    const start = breadcrumbsPicker.focusIndex >= 0 ? breadcrumbsPicker.focusIndex : 0;
    for (let i = 0; i < breadcrumbsPicker.rows.length; i++) {
        const index = (start + i + delta) % breadcrumbsPicker.rows.length;
        const label = rowNavigationLabel(breadcrumbsPicker.rows[index]);
        if (matchesPrefix(word, label)) {
            focusRow(index);
            return true;
        }
        const fuzzy = matchesFuzzy2(word, label);
        if (fuzzy && fuzzy[0].end - fuzzy[0].start > 1 && fuzzy.length === 1) {
            focusRow(index);
            return true;
        }
    }
    return true;
}

/** 行的键盘导航标签（keyboardNavigationLabelProvider，breadcrumbsPicker.ts:238-243 与 documentSymbolsTree.ts:39-49）。 */
export function rowNavigationLabel(row) {
    return session?.kind === BREADCRUMBS_PICKER_KIND.FILE ? row.label : symbolNavigationLabel(row.element);
}

function clearTypeNavigation() {
    if (!session) return;
    clearTimeout(session.typeNavTimer);
    session.typeNavTimer = null;
    session.typeNavBuffer = "";
    session.typeNavWasTyping = false;
}

// ---------------------------- 鼠标 ----------------------------

/**
 * click 入口。权威是两层控制器依次处理的：
 *   1. TreeNodeListMouseController.onViewPointer（abstractTree.ts:2534-2599）：判箭头、翻转展开时机、折叠；
 *   2. ResourceNavigator.onPointer（listService.ts:724-741）：判 openMode / 双击 / 中键后「打开」。
 * 按下本身只把 DOM 焦点交给列表（MouseController.onMouseDown，listWidget.js:585-592）。
 * @param {any} row
 * @param {{ target?: HTMLElement, detail?: number, button?: number, altKey?: boolean, offsetX?: number }} event
 */
export function onRowClick(row, event) {
    if (!session) return;
    const index = breadcrumbsPicker.rows.indexOf(row);
    if (index < 0) return;
    // 点箭头时权威只 setFocus（abstractTree.ts:2586），不设选中，故先聚焦、后面按分支决定是否设选中。
    focusRow(index);

    const target = event.target;
    const onTwistie = Boolean(target?.closest?.(".monaco-tl-twistie")) || isFolderIconPointer(target, event.offsetX);
    const detail = event.detail ?? 1;
    // 符号 picker 显式传 expandOnlyOnTwistieClick: true（breadcrumbsPicker.ts:481）；
    // 文件 picker 不传 → 取 workbench.tree.expandMode（listService.ts:1170）。
    const expandOnlyOnTwistieClick = session.kind === BREADCRUMBS_PICKER_KIND.OUTLINE ? true : treeExpandOnlyOnTwistieClick();

    if (expandOnlyOnTwistieClick && !onTwistie && detail !== 2) {
        // 点标签直接打开（不折叠）；双击不走这条（abstractTree.ts:2572-2574）
        navigateOpen(row, event);
        return;
    }
    // expandOnDoubleClick 默认 true（abstractTree.ts:2818），两个 picker 都没传，
    // 故「双击时跳过折叠」这条分支（:2576-2578）在本仓库不可达。
    if (row.collapsible) {
        toggleRowCollapsed(index, Boolean(event.altKey));
        if (onTwistie) {
            // 点箭头只折叠，不打开也不设选中（abstractTree.ts:2589-2593 的 isHandledByList）
            focusRow(
                breadcrumbsPicker.rows.findIndex(item => item.id === row.id),
                { preview: false }
            );
            return;
        }
    }
    navigateOpen(row, event);
}

/**
 * ResourceNavigator.onPointer（listService.ts:724-741）：先选中，再按 openMode / 双击 / 中键决定打开。
 * preserveFocus 恒为 true、pinned 仅中键为真，但 picker 自己的 onDidOpen 会覆盖 preserveFocus
 * （breadcrumbsPicker.ts:84-90），故打开一律 preserveFocus: false（见 openRow）。
 */
function navigateOpen(row, event) {
    const index = breadcrumbsPicker.rows.indexOf(row);
    if (index >= 0) setRowSelection(index);
    if (!listOpenOnSingleClick()) return; // workbench.list.openMode = 'doubleClick'
    if ((event.detail ?? 1) === 2) return; // 双击的「打开」由 dblclick 处理器完成
    openRow(row, { pinned: event.button === 1 });
}

/** 文件 picker 里点目录图标左侧 16px 等价于点箭头（abstractTree.js:1521-1523）。 */
function isFolderIconPointer(target, offsetX) {
    if (!target?.classList) return false;
    return target.classList.contains("monaco-icon-label") && target.classList.contains("folder-icon") && typeof offsetX === "number" && offsetX < 16;
}

/** 双击（ResourceNavigator.onMouseDblClick，listService.ts:734-754）：箭头上的双击不打开；pinned = true。 */
export function onRowDoubleClick(row, event) {
    if (!session) return;
    const target = event?.target;
    if (target?.closest?.(".monaco-tl-twistie") || isFolderIconPointer(target, event?.offsetX)) return;
    openRow(row, { pinned: true });
}

/**
 * 文件 picker 的树输入（_setInput，breadcrumbsPicker.ts:400-411）：
 * ROOT_FOLDER → 工作区（多文件夹时逐个文件夹一行）；否则 `dirname(uri)`。
 * @param {{ uri: any, kind: string }} element 被点击的面包屑条目
 * @param {any} root 工作区根（单文件夹工作区的那个根条目）
 * @param {(resource: any) => any} findClosest 资源 → 树条目
 */
export function resolveFilePickerInput(element, root, findClosest) {
    if (element.kind === FileKind.ROOT_FOLDER) return root;
    const parent = dirname(element.uri);
    if (isEqual(parent, element.uri)) return root;
    return findClosest(parent) ?? root;
}
