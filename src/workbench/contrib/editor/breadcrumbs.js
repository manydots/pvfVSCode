// 面包屑条目模型与条目状态机（聚焦 / 选中 / 事件 / 上下文键）。
//
// 权威来源（microsoft/vscode）：
//   workbench/browser/parts/editor/breadcrumbsModel.ts:100-128  getElements：文件段 + 符号段组装顺序
//   workbench/browser/parts/editor/breadcrumbsModel.ts:130-177  _initFilePathInfo：文件段（实现在
//     breadcrumbsModel.js 的纯函数里，那里说明了本仓库为何按 EMPTY 分支取值）
//   workbench/browser/parts/editor/breadcrumbsModel.ts:118-125  符号段取 outline 的
//     breadcrumbsDataSource 链；链为空但 outline 非空时补一条「outline 自身」条目
//   workbench/browser/parts/editor/breadcrumbsControl.ts:96-110 该条目渲染为 `…`（element === outline）
//   base/browser/ui/breadcrumbs/breadcrumbsWidget.ts:204-232   _focus：换焦点 + 同步 DOM 焦点 + 发焦点事件
//   base/browser/ui/breadcrumbs/breadcrumbsWidget.ts:285-296   _select：换选中 + 发选中事件（payload 透传）
//   base/browser/ui/breadcrumbs/breadcrumbsWidget.ts:371-383   点击 = _focus(idx, event) + _select(idx, event)
//   workbench/browser/parts/editor/breadcrumbsControl.ts:250-257 Payload_* 与四个上下文键
//   workbench/browser/parts/editor/breadcrumbsControl.ts:194-196 isDOMFocused
//
// 与权威的等价替换（登记在 docs/vscode-reference.md 第 5 节）：
//   - 条目的 DOM 由 Vue 渲染（EditorBreadcrumbs.vue），nodeprovider 由该组件注册，
//     故 `_focus` 的「同步 DOM 焦点」经由 registerBreadcrumbNodeProvider 提供节点后落实；
//   - 条目身份用 key（`file:<uri>` / `symbol:<id>`）而非对象引用，
//     ignore-once 因此比较 key（权威比较 item 对象，见 breadcrumbsControl.ts:609-613）。
import { reactive } from "vue";
import { basename } from "monaco-editor/base/common/resources.js";
import { contextKeys } from "@/menu/contextKey.js";
import { appState } from "@/menu/appState.js";
import { getEditorPane } from "@/workbench/contrib/editor/editorGroupService.js";
import { computeFileElements } from "@/workbench/contrib/editor/breadcrumbsModel.js";
import { isPickerShowing } from "@/workbench/contrib/editor/breadcrumbsPicker.js";
import { outlineChildren } from "@/workbench/contrib/codeEditor/browser/outline/documentSymbolsOutline.js";
import { symbolIconId } from "@/workbench/contrib/codeEditor/browser/outline/documentSymbolsTree.js";

// 权威 breadcrumbsControl.ts:250-252（三个空对象只作 payload 的身份标记）。
export const BREADCRUMB_PAYLOAD = Object.freeze({
    Reveal: {},
    RevealAside: {},
    Pick: {}
});

// 条目模型（对齐 BreadcrumbsModel 的 _fileInfo.path 与 _currentOutline）。
// items = 文件段 + 符号段，供渲染与命令共用同一份列表。
export const breadcrumbModel = reactive({
    resource: null,
    outline: null,
    items: []
});

// ---------------------------- 条目组装 ----------------------------

/**
 * 文件路径段（breadcrumbsModel.ts:130-177，实现在 breadcrumbsModel.js 的纯函数里）。
 *
 * 本仓库没有工作区概念（恒等价于 EMPTY，见 `docs/vscode-reference.md:974`，以及
 * `src/builtInFiles.js:6` / `explorerService.js:11` 的既有登记），因此 `workspaceFolder` 与 `home`
 * 都不传 —— 文件段是到文件系统根为止的完整路径（`samples/common.nut` → `samples › common.nut`），
 * **不**在 `samples` 处截断。资源管理器树的根条目（`explorerRoot`）只决定树的输入，
 * 不是面包屑的工作区分界（权威的 `roots` 与 `getWorkspaceFolder` 是两件事）。
 * @param {any} resource
 */
function fileItems(resource) {
    return computeFileElements(resource).map(({ uri, fileKind }) => ({
        kind: "file",
        key: `file:${uri.toString()}`,
        name: basename(uri),
        uri,
        fileKind
    }));
}

function countSymbols(container) {
    let count = 0;
    for (const child of outlineChildren(container)) {
        count += 1 + countSymbols(child);
    }
    return count;
}

/**
 * 符号段（breadcrumbsModel.ts:118-125）。
 * @param {any} outline monaco OutlineModel
 * @param {any[]} elements collectPath 给出的符号链（自根到最深）
 */
function symbolItems(outline, elements) {
    if (!outline) return [];
    if (elements.length > 0) {
        return elements.map(element => ({
            kind: "symbol",
            key: `symbol:${element.id}`,
            name: element.symbol.name,
            element,
            icon: symbolIconId(element),
            isOutlineRoot: false
        }));
    }
    // 链为空但 outline 非空：补「outline 自身」条目（breadcrumbsModel.ts:123-125），
    // 渲染为 `…`（breadcrumbsControl.ts:101-106），点击后 picker 不聚焦任何行
    // （breadcrumbsPicker.ts:493`input.element !== input.outline` 不成立）。
    if (countSymbols(outline) === 0) return [];
    return [
        {
            kind: "symbol",
            key: "symbol:outline",
            name: "…",
            element: outline,
            isOutlineRoot: true
        }
    ];
}

/** 当前条目列表（文件段在前、符号段在后）。 */
export function getBreadcrumbItems() {
    return breadcrumbModel.items;
}

/**
 * 写入文件段（活动编辑器变化时调用）。
 * @param {any} resource 编辑器资源
 */
export function setBreadcrumbResource(resource) {
    breadcrumbModel.resource = resource ?? null;
    breadcrumbModel.outline = null;
    breadcrumbModel.items = fileItems(resource);
    updateBreadcrumbContextKeys();
}

/**
 * 写入符号段（outline 重建后调用）。
 * @param {any} resource
 * @param {any} outline
 * @param {any[]} elements
 */
export function setBreadcrumbSymbols(resource, outline, elements) {
    breadcrumbModel.resource = resource ?? null;
    breadcrumbModel.outline = outline ?? null;
    breadcrumbModel.items = fileItems(resource).concat(symbolItems(outline, elements ?? []));
    updateBreadcrumbContextKeys();
}

// 对齐 breadcrumbsControl.ts:254-257 的四个上下文键（:412/:447/:467 的取值时机）。
export function updateBreadcrumbContextKeys({ active } = {}) {
    const items = breadcrumbModel.items;
    const hasFile = items.some(item => item.kind === "file");
    contextKeys.set("breadcrumbsPossible", hasFile);
    contextKeys.set("breadcrumbsVisible", hasFile);
    contextKeys.set("breadcrumbsHasSymbols", items.some(item => item.kind === "symbol"));
    if (active !== undefined) contextKeys.set("breadcrumbsActive", active);
}

/**
 * `breadcrumbsActive` 的唯一取值口径（breadcrumbsControl.ts:724-728 的 `_updateCkBreadcrumbsActive`）：
 * **部件持有 DOM 焦点 或 picker 正在显示** —— 浮层打开时焦点在浮层里，但上下文键仍为真，
 * 这正是 Escape 的 `breadcrumbs.selectEditor` 与 `*WithPicker` 两组命令能在浮层内生效的原因。
 * 权威在两个时机调用它：条目焦点变化（:334 的 `onDidChangeFocus`）与浮层显示/隐藏（:665/:714）。
 */
export function updateBreadcrumbsActive() {
    updateBreadcrumbContextKeys({ active: isBreadcrumbsDOMFocused() || isPickerShowing() });
}

// ---------------------------- 焦点 / 选中 ----------------------------

const focusListeners = new Set();
const selectListeners = new Set();

/** 条目获得焦点（对齐 breadcrumbsWidget.onDidFocusItem）。 */
export function onDidFocusBreadcrumbItem(listener) {
    focusListeners.add(listener);
    return () => focusListeners.delete(listener);
}

/** 条目被选中（对齐 breadcrumbsWidget.onDidSelectItem，payload 透传）。 */
export function onDidSelectBreadcrumbItem(listener) {
    selectListeners.add(listener);
    return () => selectListeners.delete(listener);
}

// 条目节点的提供者：由 EditorBreadcrumbs.vue 注册（Vue 渲染的 DOM 由组件掌握）。
let nodeProvider = () => [];

export function registerBreadcrumbNodeProvider(provider) {
    nodeProvider = provider;
    return () => {
        if (nodeProvider === provider) nodeProvider = () => [];
    };
}

/** 对齐 breadcrumbsWidget.ts:194-196（dom.isAncestorOfActiveElement）。 */
export function isBreadcrumbsDOMFocused() {
    return nodeProvider().some(node => node === document.activeElement);
}

function itemAt(index) {
    return breadcrumbModel.items[index] ?? null;
}

/** 条目节点（由 EditorBreadcrumbs.vue 注册的 provider 提供）；picker 的锚点计算要用它。 */
export function getBreadcrumbNode(index) {
    return nodeProvider()[index] ?? null;
}

/**
 * 对齐 breadcrumbsWidget.ts:218-232 的 `_focus`：
 * 换焦点下标 → 把 DOM 焦点移到该条目（同步，先于事件）→ 发焦点事件。
 * 同步移焦是必须的：旧 picker 的失焦隐藏依赖它（breadcrumbsControl.ts:658-662）。
 * @param {number} index -1 表示清除焦点
 */
export function setFocusedBreadcrumb(index) {
    appState.breadcrumbsFocusedIndex = index;
    if (index >= 0) nodeProvider()[index]?.focus({ preventScroll: true });
    fireFocus(itemAt(index));
    // 权威把 `_updateCkBreadcrumbsActive` 挂在 widget 的 onDidChangeFocus 上（:334）。
    updateBreadcrumbsActive();
}

/** 对齐 breadcrumbsWidget.ts:285-296 的 `_select`（payload 原样透传）。 */
export function setSelectedBreadcrumb(index, payload) {
    appState.breadcrumbsSelectedIndex = index;
    fireSelect(itemAt(index), payload);
}

function fireFocus(item) {
    // 权威的条目事件对象形如 {type, item, node, payload}；本仓库的 row 由组件渲染，node 由 provider 提供。
    const event = { type: "focus", item, node: item ? nodeProvider()[appState.breadcrumbsFocusedIndex] : undefined };
    for (const listener of [...focusListeners]) listener(event);
}

function fireSelect(item, payload) {
    const event = { type: "select", item, payload };
    for (const listener of [...selectListeners]) listener(event);
}

/** 清除焦点与选中（breadcrumbsControl.ts:1049-1050 的 Escape 分支）。 */
export function clearBreadcrumbFocusAndSelection() {
    setFocusedBreadcrumb(-1);
    setSelectedBreadcrumb(-1);
}

// ---------------------------- 命令实现 ----------------------------

/** focusAndSelectHandler（breadcrumbsControl.ts:867-879）：聚焦最后一项，select 时以 Pick 选中。 */
export function focusBreadcrumbs(select) {
    if (!breadcrumbModel.items.length) return;
    const index = breadcrumbModel.items.length - 1;
    setFocusedBreadcrumb(index);
    if (select) setSelectedBreadcrumb(index, BREADCRUMB_PAYLOAD.Pick);
}

/** breadcrumbsWidget.ts:212-216：只在后一项存在时前移，不环绕。 */
export function focusNextBreadcrumb() {
    const index = appState.breadcrumbsFocusedIndex;
    if (index + 1 < breadcrumbModel.items.length) setFocusedBreadcrumb(index + 1);
}

/** breadcrumbsWidget.ts:206-210：只在前一项存在时后移，不环绕。 */
export function focusPrevBreadcrumb() {
    const index = appState.breadcrumbsFocusedIndex;
    if (index > 0) setFocusedBreadcrumb(index - 1);
}

/** 对齐 breadcrumbsControl.ts:1049-1054：清焦点/选中后把焦点交回编辑器。 */
export function focusEditorPane() {
    getEditorPane()?.focus();
}
