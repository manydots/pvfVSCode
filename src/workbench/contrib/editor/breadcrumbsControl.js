// 面包屑控制（BreadcrumbsControl）：条目事件的消费、picker 的打开/关闭与跳转。
//
// 权威来源（microsoft/vscode）：
//   workbench/browser/parts/editor/breadcrumbsControl.ts:609-613  _onFocusEvent
//     （picker 显示中聚焦到新条目 → 直接选中它，picker 随即跟着换内容）
//   workbench/browser/parts/editor/breadcrumbsControl.ts:615-624  _onSelectEvent 的 ignore-once 分支
//   workbench/browser/parts/editor/breadcrumbsControl.ts:626-635  _onSelectEvent 的 payload 分支（跳转）
//   workbench/browser/parts/editor/breadcrumbsControl.ts:658-662  picker 失焦：记住 ignore-once 条目后隐藏
//   workbench/browser/parts/editor/breadcrumbsControl.ts:664-716  showContextView 的 render/getAnchor
//   workbench/browser/parts/editor/breadcrumbsControl.ts:718-736  onHide（未选择时还原视图状态）
//   workbench/browser/parts/editor/breadcrumbsControl.ts:738-760  _revealInEditor / _getEditorGroup
//   workbench/browser/parts/editor/breadcrumbsPicker.ts:400-424  文件 picker 的输入与聚焦资源
//   workbench/browser/parts/editor/breadcrumbsPicker.ts:487-501  符号 picker 的输入与聚焦元素
//
// 等价替换（登记在 docs/vscode-reference.md 第 5 节）：
//   1. 浮层宿主：权威走 IContextViewService.showContextView（contextview.ts 的 `.context-view`
//      绝对定位 + layout2d 定位），本仓库由 BreadcrumbsPicker.vue 承担同一份 DOM 与定位取值
//      （computePickerAnchor / computePickerPosition 见 breadcrumbsPicker.js）；
//   2. 「关闭浮层」：权威的主路径是 picker 自身父节点的 focusTracker 失焦
//      （breadcrumbsControl.ts:658-662：失焦 → 记下 ignore-once 条目 → hideContextView），
//      本仓库由 BreadcrumbsPicker.vue 的 focusout 承担同一职责（等价）；
//      contextview 的捕获阶段 click 只覆盖「点在工作台容器之外」的点击
//      （contextview.ts:277-281 → :467-471 的 `!isAncestor(target, container)`），
//      本仓库工作台即整窗，无对应场景。
//      Escape 由 breadcrumbs.selectEditor 命令处理（清状态 → 焦点回编辑器 → 浮层失焦隐藏）；
//   3. SIDE_GROUP（Payload_RevealAside / SideBySide）在本仓库没有第二个编辑器分组，恒不生效。
import { FileKind } from "@/platform/files/common/files.js";
import { explorerRoot, findClosest, getBuiltInInput } from "@/workbench/contrib/explorer/explorerService.js";
import { getEditorPane, openEditor } from "@/workbench/contrib/editor/editorGroupService.js";
import { captureEditorViewState, revealSymbol } from "@/workbench/contrib/codeEditor/browser/outline/documentSymbolsOutline.js";
import { BREADCRUMB_PAYLOAD, breadcrumbModel, clearBreadcrumbFocusAndSelection, getBreadcrumbItems, getBreadcrumbNode, isBreadcrumbsDOMFocused, onDidFocusBreadcrumbItem, onDidSelectBreadcrumbItem, setFocusedBreadcrumb, setSelectedBreadcrumb, updateBreadcrumbsActive } from "@/workbench/contrib/editor/breadcrumbs.js";
import { appState } from "@/menu/appState.js";
import { breadcrumbsPicker, computePickerAnchor, hidePicker, isPickerShowing, relayoutPicker, resolveFilePickerInput, showFilePicker, showOutlinePicker } from "@/workbench/contrib/editor/breadcrumbsPicker.js";

// picker 失焦后要忽略一次的那一条（breadcrumbsControl.ts:609 的 _breadcrumbsPickerIgnoreOnceItem）。
let ignoreOnceKey = null;

// 浮层显示期间监听像素比变化（breadcrumbsControl.ts:656 的 zoomListener：浏览器缩放会让
// 已算好的尺寸与行高失真，权威直接隐藏浮层）。监听器随浮层的显示/关闭建立与销毁 ——
// 权威在 render 回调里创建、随 combinedDisposable 释放（:667-673）。
let zoomQuery = null;
let zoomHandler = null;

// ---------------------------- 事件消费 ----------------------------

// breadcrumbsControl.ts:609-613：picker 显示期间，焦点换到哪一段就选中哪一段
//（选中会再触发一次 _onSelectEvent，这次带着 payload=Pick 之外的空 payload → 又打开新 picker，
// 旧 picker 因焦点移走而失焦隐藏，于是「换段即换 picker 内容」）。
function onFocusEvent(event) {
    if (event.item && isPickerShowing()) {
        ignoreOnceKey = null;
        setSelectedBreadcrumb(appState.breadcrumbsFocusedIndex);
    }
}

// breadcrumbsControl.ts:615-760。
function onSelectEvent(event) {
    const { item, payload } = event;
    if (!item) return;

    if (item.key === ignoreOnceKey) {
        // 浮层因失焦关闭后又点回同一段：只还原状态，不再打开浮层
        ignoreOnceKey = null;
        clearBreadcrumbFocusAndSelection();
        return;
    }

    // breadcrumbsControl.ts:630：选中即把焦点交给编辑器分组（随后浮层才接管键盘）
    getEditorPane()?.focus();

    const group = payload === BREADCRUMB_PAYLOAD.RevealAside ? "aside" : payload === BREADCRUMB_PAYLOAD.Reveal ? "active" : undefined;
    if (group !== undefined) {
        clearBreadcrumbFocusAndSelection();
        revealInEditor(item, group);
        return;
    }

    openPicker(item, payload);
}

// ---------------------------- 打开浮层 ----------------------------

/**
 * 打开该条目的 picker（breadcrumbsControl.ts:664-716 的 render + getAnchor）。
 * 几何取值：条目节点的页面矩形 → computePickerAnchor（宽度、最大高度、箭头偏移、溢出处理）；
 * 鼠标触发时用点击位置对准箭头（`event.payload instanceof StandardMouseEvent`，:689-696）。
 * @param {any} item
 * @param {unknown} payload 条目的选中 payload（键盘触发时为 Payload_* 对象，鼠标触发时为 MouseEvent）
 */
function openPicker(item, payload) {
    const index = appState.breadcrumbsSelectedIndex;
    const node = getBreadcrumbNode(index);
    const editor = getEditorPane();
    if (!node || !editor) return;

    const rect = node.getBoundingClientRect();
    const pointerX = typeof payload?.clientX === "number" ? payload.clientX : null;
    // 本仓库的工作台容器即整窗且不滚动，故视口坐标与权威的页面坐标同值。
    // y 取 `锚点下方 + 箭头高`（breadcrumbsControl.ts:681），最终落点由浮层按自身高度定
    // （computePickerPosition，见 breadcrumbsPicker.js 的 recomputeRows）。
    // 几何只在打开时算这一次：权威的 getAnchor 把结果缓存进 pickerAnchor 后
    // 直接返回（`if (!pickerAnchor)`，:676-706），resize 不会重算尺寸。
    const geometry = computePickerAnchor({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        anchor: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        pointerX
    });
    const anchor = {
        anchorIndex: index,
        anchorKey: item.key,
        geometry: { ...geometry, viewportHeight: window.innerHeight }
    };

    if (item.kind === "file") {
        showFilePicker({
            ...anchor,
            directory: resolveFilePickerInput({ uri: item.uri }, explorerRoot, findClosest),
            // _setInput 的 focusElement（:412-424）：与被点击条目同资源的行
            focusResource: item.uri,
            openFile: (resource, options) => {
                const input = getBuiltInInput(resource);
                if (input) openEditor(input, options);
            }
        });
    } else {
        showOutlinePicker({
            ...anchor,
            outline: breadcrumbModel.outline,
            editor,
            // `input.element !== input.outline` 才 reveal + setFocus（:493-500）；
            // 「outline 自身」条目（渲染为 `…`）因此不聚焦任何行，与本仓库 isOutlineRoot 等价。
            focusElement: item.isOutlineRoot ? null : item.element,
            captureViewState: () => captureEditorViewState(editor)
        });
    }

    // 浮层显示后 `breadcrumbsActive` 仍为真（breadcrumbsControl.ts:664-665 的
    // `_breadcrumbsPickerShowing = true` → `_updateCkBreadcrumbsActive()`）——
    // 这是 Escape（breadcrumbs.selectEditor）与 *WithPicker 两组命令在浮层内可用的前提。
    watchPixelRatio();
    updateBreadcrumbsActive();
}

// ---------------------------- 关闭浮层 ----------------------------

/**
 * 浮层失焦（breadcrumbsControl.ts:658-662）：
 * 记住「焦点仍在面包屑上时对应的那条」以便忽略下一次选中，然后隐藏并清理部件状态
 *（onHide 的 `data?.source === this` 分支，:730-733）。
 * 浮层内部的选择（openRow）已经把焦点交给了编辑器，此时 isBreadcrumbsDOMFocused() 为假，
 * ignoreOnceKey 落空 —— 与权威一致。
 */
export function notifyBreadcrumbsPickerBlur() {
    const anchorKey = breadcrumbsPicker.anchorKey;
    // 浮层内部已自行关闭（选中跳转）：那次关闭带 didPick，不还原视图状态
    const didPick = breadcrumbsPicker.didPick === true;
    ignoreOnceKey = isBreadcrumbsDOMFocused() ? anchorKey : null;
    hidePicker({ didPick });
    stopPixelRatioWatch();
    // onHide 里先清 `_breadcrumbsPickerShowing` 再刷新上下文键（breadcrumbsControl.ts:713-714）。
    updateBreadcrumbsActive();
    if (!isPickerShowing()) clearBreadcrumbFocusAndSelection();
}

/**
 * 像素比变化（浏览器缩放）→ 隐藏浮层（breadcrumbsControl.ts:656 的 zoomListener）。
 * 与失焦路径的差别：权威的 zoomListener 不设置 `_breadcrumbsPickerIgnoreOnceItem`
 * （只由失焦分支 :660 设置），故这里也不动 ignoreOnceKey，只走 onHide 的 source===this 分支
 * （:713-718：清焦点与选中、未选择时还原视图状态——由 hidePicker 完成）。
 */
function hidePickerByZoom() {
    if (!isPickerShowing()) return;
    hidePicker();
    stopPixelRatioWatch();
    updateBreadcrumbsActive();
    clearBreadcrumbFocusAndSelection();
}

// 监听当前像素比；PixelRatio.onDidChange（base/browser/pixelRatio.ts）用 matchMedia 逐值重注册，
// 这里等价实现：像素比一变当前查询即失配，回调里先注销再隐藏浮层。
function watchPixelRatio() {
    stopPixelRatioWatch();
    zoomQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    zoomHandler = () => hidePickerByZoom();
    zoomQuery.addEventListener("change", zoomHandler);
}

function stopPixelRatioWatch() {
    zoomQuery?.removeEventListener("change", zoomHandler);
    zoomQuery = null;
    zoomHandler = null;
}

/**
 * 窗口尺寸变化后重算浮层的竖直落点（contextview.ts:324-337 的 layout() → :339-366 的 doLayout()：
 * resize 时拿缓存的锚点重跑 layout2d，浮层尺寸本身不再重算 —— 权威的 getAnchor 只在首次调用时
 * 计算（breadcrumbsControl.ts:676 的 `if (!pickerAnchor)`），宽度/最大高度都是打开时的值。
 * 由 breadcrumbs.contribution.js 注册监听）。
 */
export function relayoutBreadcrumbsPicker() {
    if (!isPickerShowing()) return;
    relayoutPicker({ viewportHeight: window.innerHeight });
}

// ---------------------------- 跳转 ----------------------------

/**
 * breadcrumbsControl.ts:738-760 的 _revealInEditor。
 * @param {any} item
 * @param {"active"|"aside"} group
 */
function revealInEditor(item, group) {
    if (item.kind === "file") {
        if (item.fileKind === FileKind.FILE) {
            const input = getBuiltInInput(item.uri);
            // `_editorService.openEditor({resource, options: {pinned}}, group)`：pinned 默认 false（预览态）；
            // SIDE_GROUP 在本仓库不存在，group === 'aside' 时仍按当前分组打开（第 5 节偏差）。
            if (input) openEditor(input, { pinned: false });
            return;
        }
        // 目录段：聚焦并选中下一段（:743-748 的「show next picker」）
        const items = getBreadcrumbItems();
        const index = items.findIndex(candidate => candidate.key === item.key);
        const next = items[index + 1];
        if (next) {
            setFocusedBreadcrumb(index + 1);
            setSelectedBreadcrumb(index + 1, BREADCRUMB_PAYLOAD.Pick);
        }
        return;
    }
    // 符号段：outline.reveal(element, {pinned}, sideBySide, false)（:755），
    // select=false → 光标落在 selectionRange 起点（documentSymbolsOutline.ts:226-240）。
    revealSymbol(getEditorPane(), item.element, { select: false });
}

// 订阅条目事件（对齐 BreadcrumbsControl 构造函数里的 widget.onDidFocusItem / onDidSelectItem）。
onDidFocusBreadcrumbItem(onFocusEvent);
onDidSelectBreadcrumbItem(onSelectEvent);

// 供检查脚本与调试观察当前 ignore-once 状态。
export function getBreadcrumbsIgnoreOnceKey() {
    return ignoreOnceKey;
}
