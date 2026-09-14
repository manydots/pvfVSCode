<script setup>
// 面包屑选择器浮层（BreadcrumbsFilePicker / BreadcrumbsOutlinePicker 的渲染层）。
//
// 权威来源（microsoft/vscode）：
//   workbench/browser/parts/editor/breadcrumbsPicker.ts:74-160   浮层 DOM 与 _layout
//     （.monaco-breadcrumbs-picker.show-file-icons > .arrow + 树容器；
//      headerHeight = 2×arrowSize，treeHeight = min(maxHeight-header, contentHeight)）
//   workbench/browser/parts/editor/breadcrumbsPicker.ts:345-397  文件树：file-icon-themable-tree /
//     show-file-icons / align-icons-and-twisties / hide-arrows（:357-364 的三个主题特征位：
//     hasFileIcons、hasFolderIcons、hidesExplorerArrows，见 fileIconTheme.js 的 fileIconThemeTraits）
//   workbench/browser/parts/editor/breadcrumbsPicker.ts:463-501  符号树：collapseByDefault / 
//     expandOnlyOnTwistieClick / multipleSelectionSupport:false / showNotFoundMessage:false
//   base/browser/ui/tree/abstractTree.ts:434-563                 行内 DOM（monaco-tl-row / -indent /
//     -twistie / -contents）、aria-*、缩进与参考线生成
//   base/browser/ui/list/listWidget.ts:902-1010                  DefaultStyleController + Outlines：
//     列表状态配色的完整规则表（本组件按其逐条还原，见 pickerStyleSheet）
//   base/browser/ui/list/listWidget.ts:361-483                   TypeNavigationController 与可打印字符判定
//   base/browser/ui/tree/media/tree.css:20-40                    .monaco-tl-* 结构与 .indent-guide
//   workbench/browser/parts/views/media/views.css:8-16           align-icons-and-twisties / hide-arrows 隐藏箭头
//   workbench/contrib/codeEditor/browser/outline/documentSymbolsTree.css:6-49  符号行的 DOM 与取值
//   workbench/browser/parts/editor/media/breadcrumbscontrol.css:72-81          .arrow / .picker-item
//
// 裁剪与替代（登记在 docs/vscode-reference.md 第 5 节）：
//   1. 行的渲染不经 monaco 的 List/Tree（发行包未打包 tree 的结构样式表的全部内容，
//      且本仓库浮层由 Vue 渲染）；行的取值、缩进公式、可见性、折叠默认值、交互语义逐条对齐上面的实现；
//   2. 列表状态配色与缩进参考线配色由本组件按 DefaultStyleController 的规则表注入
//      （权威是 ListWidget.style() 在运行期注入，见 listWidget.ts:902-1010）；
//   3. 滚动用原生滚动条（本仓库全应用如此，见 styles/app.css），非 monaco 的 ScrollableElement；
//   4. 拖放（dnd）、marker 徽标、find 过滤控件未迁移。
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { RenderIndentGuides, treeRenderIndentGuides } from "@/platform/list/browser/listService.js";
import { fileIconThemeTraits } from "@/workbench/services/themes/fileIconTheme.js";
import { appState } from "@/menu/appState.js";
import { symbolIconColorRules } from "@/workbench/contrib/codeEditor/browser/symbolIcons.js";
import { SYMBOL_ROW_HEIGHT } from "@/workbench/contrib/codeEditor/browser/outline/documentSymbolsTree.js";
import { BREADCRUMB_PAYLOAD, getBreadcrumbItems, setFocusedBreadcrumb, setSelectedBreadcrumb } from "@/workbench/contrib/editor/breadcrumbs.js";
import { notifyBreadcrumbsPickerBlur } from "@/workbench/contrib/editor/breadcrumbsControl.js";
import {
    BREADCRUMBS_PICKER_KIND,
    activeIndentNodeIds,
    acceptRow,
    breadcrumbsPicker,
    collapseFocusedRow,
    expandFocusedRow,
    focusFirstRow,
    focusLastRow,
    focusNextPage,
    focusNextRow,
    focusPreviousPage,
    focusPreviousRow,
    isTypeNavigationKey,
    onRowClick,
    onRowDoubleClick,
    toggleFocusedRowCollapsed,
    typeNavigationInput
} from "@/workbench/contrib/editor/breadcrumbsPicker.js";

const rootEl = ref(null);
const listEl = ref(null);
const scrollerEl = ref(null);

const isFilePicker = computed(() => breadcrumbsPicker.kind === BREADCRUMBS_PICKER_KIND.FILE);
// 文件 picker 的树容器类名（breadcrumbsPicker.ts:352-364 / :465-481）：两个类由当前文件图标主题的
// 特征位决定（`_createTree` 的 onFileIconThemeChange）：align-icons-and-twisties =
// hasFileIcons && !hasFolderIcons、hide-arrows = hidesExplorerArrows（样式见 views.css:8-16）。
const treeClass = computed(() => {
    if (!isFilePicker.value) return [];
    const classes = ["file-icon-themable-tree", "show-file-icons"];
    if (fileIconThemeTraits.hasFileIcons && !fileIconThemeTraits.hasFolderIcons) classes.push("align-icons-and-twisties");
    if (fileIconThemeTraits.hidesExplorerArrows) classes.push("hide-arrows");
    return classes;
});
const guidesMode = computed(() => treeRenderIndentGuides());
const showGuides = computed(() => guidesMode.value !== RenderIndentGuides.None);

// 浮层 DOM（breadcrumbsPicker.ts:76-107）。
const pickerStyle = computed(() => ({
    height: `${breadcrumbsPicker.totalHeight}px`,
    width: `${breadcrumbsPicker.width}px`
}));
const arrowStyle = computed(() => ({
    top: `${-2 * breadcrumbsPicker.arrowSize}px`,
    borderColor: `transparent transparent var(--vscode-breadcrumbPicker-background)`,
    borderWidth: `${breadcrumbsPicker.arrowSize}px`,
    marginLeft: `${breadcrumbsPicker.arrowOffset}px`
}));
const treeContainerStyle = computed(() => ({
    height: `${breadcrumbsPicker.treeHeight}px`,
    width: `${breadcrumbsPicker.width}px`,
    background: "var(--vscode-breadcrumbPicker-background)",
    paddingTop: "2px",
    borderRadius: "3px",
    boxShadow: "var(--vscode-shadow-lg)",
    border: "1px solid var(--vscode-widget-border)"
}));
const viewStyle = computed(() => ({
    left: `${breadcrumbsPicker.x}px`,
    top: `${breadcrumbsPicker.top}px`
}));
// 行容器高度 = 内容高度（listView.js:427-429；行绝对定位，容器必须给出真实滚动高度）。
const rowsStyle = computed(() => ({ height: `${breadcrumbsPicker.rows.length * SYMBOL_ROW_HEIGHT}px` }));
const widgetAriaLabel = computed(() => (isFilePicker.value ? "Breadcrumbs" : "Outline"));

const activeGuides = computed(() => (showGuides.value ? activeIndentNodeIds() : new Set()));

function rowStyle(index) {
    return { top: `${index * SYMBOL_ROW_HEIGHT}px`, height: `${SYMBOL_ROW_HEIGHT}px` };
}

// abstractTree.ts:461-463：twistie 的左内边距 = indentSize，缩进容器宽 = indentSize + indent - 16。
function indentStyle(row) {
    return { width: `${row.metrics.indentWidth}px` };
}
function twistieStyle(row) {
    return { paddingLeft: `${row.metrics.twistiePaddingLeft}px` };
}
// 每条参考线一格（abstractTree.ts:535-563）：从最外层祖先到直接父节点依次一个，
// 活动态取祖先是否在 activeIndentNodes 内（:565-597）。
function guidesOf(row, index) {
    const ids = row.ancestorIds ?? [];
    const count = Math.min(ids.length, row.metrics.guideCount);
    return ids.slice(0, count).map(id => ({ id, active: activeGuides.value.has(id) }));
}
function twistieClass(row) {
    // codicon 字形与 collapsible/collapsed 类只在可折叠行添加（abstractTree.ts:505-513）；
    // 叶子行（无子节点）的 twistie 无字形 —— 与权威一致，行首不留箭头。
    if (!row.collapsible) return {};
    return { codicon: true, "codicon-tree-item-expanded": true, collapsible: true, collapsed: row.collapsed };
}
function isFocused(index) {
    return breadcrumbsPicker.focusIndex === index;
}
function isSelected(index) {
    return breadcrumbsPicker.selectionIndex === index;
}
function rowDomId(index) {
    return `pvf-breadcrumbs-picker-row-${index}`;
}
const activeDescendant = computed(() => (breadcrumbsPicker.focusIndex >= 0 ? rowDomId(breadcrumbsPicker.focusIndex) : null));

// ---------------------------- 键盘 ----------------------------
// 权威的按键由 workbench 的 `list.*` 命令族处理（workbench/browser/actions/listCommands.ts），
// 本组件按同一份语义逐条实现（每条注明对应实现）。Escape **不在此处理**：
// 它由 breadcrumbs.selectEditor 命令负责（breadcrumbsControl.ts:1042-1055）。
function onKeyDown(event) {
    // `*WithPicker`（breadcrumbsControl.ts:975-1013）：列表持有焦点时 Ctrl/Cmd + 左右（mac 为 Alt + 左右）
    // = 切到上/下一段面包屑并重新打开选择器。权威靠 weight + 1 与 listFocus 上下文键压过
    // breadcrumbs.focusNext/Previous，本仓库的分发器没有这两者，故在列表持有焦点时就地实现同一语义。
    if ((event.ctrlKey || event.metaKey) && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        const index = event.key === "ArrowRight" ? appState.breadcrumbsFocusedIndex + 1 : appState.breadcrumbsFocusedIndex - 1;
        if (index >= 0 && index < getBreadcrumbItems().length) {
            // 与命令路径一致：先聚焦该段（old picker 因焦点移走而失焦隐藏），再以 Pick 选中它
            // → `_onSelectEvent` 打开新浮层（breadcrumbsControl.ts:609-613 的换段逻辑）。
            setFocusedBreadcrumb(index);
            setSelectedBreadcrumb(index, BREADCRUMB_PAYLOAD.Pick);
        }
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    switch (event.key) {
        case "ArrowDown":
            focusNextRow();
            break;
        case "ArrowUp":
            focusPreviousRow();
            break;
        case "PageDown":
            focusNextPage(viewport());
            break;
        case "PageUp":
            focusPreviousPage(viewport());
            break;
        case "Home":
            focusFirstRow();
            break;
        case "End":
            focusLastRow();
            break;
        case "Enter":
            acceptRow();
            break;
        case "ArrowRight":
            expandFocusedRow();
            break;
        case "ArrowLeft":
            collapseFocusedRow();
            break;
        case " ":
            toggleFocusedRowCollapsed();
            break;
        default:
            if (isTypeNavigationKey(event)) typeNavigationInput(event.key);
            else return;
    }
    event.preventDefault();
    event.stopPropagation();
}

function viewport() {
    const scroller = scrollerEl.value;
    const firstVisible = scroller ? Math.floor(scroller.scrollTop / SYMBOL_ROW_HEIGHT) : 0;
    const pageSize = Math.max(Math.floor((breadcrumbsPicker.treeHeight - 2) / SYMBOL_ROW_HEIGHT), 1);
    return { firstVisible, lastVisible: firstVisible + pageSize - 1, pageSize };
}

// 滚轮：列表消费滚轮（list alwaysConsumeMouseWheel），不改变焦点。
function onWheel(event) {
    event.preventDefault();
    const scroller = scrollerEl.value;
    if (scroller) scroller.scrollTop += event.deltaY;
}

// 行点击/双击（abstractTree 的鼠标控制器 + ResourceNavigator，语义见 breadcrumbsPicker.js）。
function onClick(row, event) {
    onRowClick(row, { target: event.target, detail: event.detail, button: event.button, altKey: event.altKey, offsetX: event.offsetX });
}

function onDoubleClick(row, event) {
    onRowDoubleClick(row, { target: event.target, detail: event.detail, offsetX: event.offsetX });
}

function onFocusOut(event) {
    if (event.relatedTarget && rootEl.value?.contains(event.relatedTarget)) return;
    notifyBreadcrumbsPickerBlur();
}

// ---------------------------- 焦点与可见性 ----------------------------

// 打开即把 DOM 焦点交给列表（breadcrumbsPicker.ts:424/500 的 tree.domFocus()）。
watch(
    () => breadcrumbsPicker.visible,
    async visible => {
        if (!visible) {
            // 浮层因选中跳转关闭时（openRow → hidePicker({didPick:true})）焦点可能已不在本组件内，
            // focusout 未必再触发，故这里兜底清理部件状态。
            if (breadcrumbsPicker.didPick) notifyBreadcrumbsPickerBlur();
            return;
        }
        await nextTick();
        listEl.value?.focus({ preventScroll: true });
    }
);

// 焦点行滚入视口（list.reveal，listView.js 的 reveal）。
watch(
    () => breadcrumbsPicker.focusIndex,
    async index => {
        if (index < 0) return;
        await nextTick();
        const row = listEl.value?.querySelector(`[data-index="${index}"]`);
        row?.scrollIntoView({ block: "nearest" });
    }
);

// 窗口尺寸变化后的重算由 breadcrumbsControl.js 的 relayoutBreadcrumbsPicker 负责
// （权威在 contextview.ts:224-236 用保留的锚点重新 layout），组件只负责渲染。

onMounted(() => {
    injectPickerStyleSheet();
});

// ---------------------------- 样式注入 ----------------------------
// 对齐 listWidget.ts:902-1010 的 DefaultStyleController.style + Outlines 段，
// 以及 abstractTree.ts:3045-3049 的参考线配色。选择器后缀取本列表的专属类（等价于权威的 `.<domId>`），
// 使这些规则的优先级高于发行包里同名的通用规则（如 quick-input 的 :focus 描边）。
const STYLE_ELEMENT_ID = "pvf-breadcrumbs-picker-styles";
let styleInjected = false;

function pickerStyleSheet() {
    const suffix = ".pvf-breadcrumbs-picker-list";
    const list = `.monaco-list${suffix}`;
    const row = `${list} .monaco-list-row`;
    const rules = [
        // listBackground = breadcrumbsPickerBackground（breadcrumbsPicker.ts:389-391 的 overrideStyles）
        `${list} .monaco-list-rows { background: var(--vscode-breadcrumbPicker-background); }`,
        // listFocusBackground / listFocusForeground
        `${list}:focus .monaco-list-row.focused { background-color: var(--vscode-list-focusBackground); }`,
        `${list}:focus .monaco-list-row.focused:hover { background-color: var(--vscode-list-focusBackground); }`,
        `${list}:focus .monaco-list-row.focused { color: var(--vscode-list-focusForeground); }`,
        // listActiveSelectionBackground / Foreground / IconForeground
        `${list}:focus .monaco-list-row.selected { background-color: var(--vscode-list-activeSelectionBackground); }`,
        `${list}:focus .monaco-list-row.selected:hover { background-color: var(--vscode-list-activeSelectionBackground); }`,
        `${list}:focus .monaco-list-row.selected { color: var(--vscode-list-activeSelectionForeground); }`,
        `${list}:focus .monaco-list-row.selected .codicon { color: var(--vscode-list-activeSelectionIconForeground); }`,
        // listFocusAndSelectionBackground / Foreground
        `${list}:focus .monaco-list-row.selected.focused { background-color: var(--vscode-list-activeSelectionBackground); }`,
        `${list}:focus .monaco-list-row.selected.focused { color: var(--vscode-list-activeSelectionForeground); }`,
        // listInactiveSelectionBackground / Foreground / IconForeground
        `${row}.selected { background-color: var(--vscode-list-inactiveSelectionBackground); }`,
        `${row}.selected:hover { background-color: var(--vscode-list-inactiveSelectionBackground); }`,
        `${row}.selected { color: var(--vscode-list-inactiveSelectionForeground); }`,
        // listInactiveSelectionIconForeground：权威的选择器落在 .focused 行上
        // （listWidget.ts:951-952，虽名为 inactiveSelectionIcon 但取的是 focused 行）
        `${row}.focused .codicon { color: var(--vscode-list-inactiveSelectionIconForeground); }`,
        // listHoverBackground / Foreground
        `${list}:not(.drop-target):not(.dragging) .monaco-list-row:hover:not(.selected):not(.focused) { background-color: var(--vscode-list-hoverBackground); }`,
        `${list}:not(.drop-target):not(.dragging) .monaco-list-row:hover:not(.selected):not(.focused) { color: var(--vscode-list-hoverForeground); }`,
        // Outlines（段见 listWidget.ts:977-1007）
        `${list}:focus .monaco-list-row.focused.selected { outline: 1px solid var(--vscode-list-focusAndSelectionOutline); outline-offset: -1px; }`,
        `${list}:focus .monaco-list-row.focused { outline: 1px solid var(--vscode-list-focusOutline); outline-offset: -1px; }`,
        `${list} .monaco-list-row.focused.selected { outline: 1px dotted var(--vscode-contrastActiveBorder); outline-offset: -1px; }`,
        `${list} .monaco-list-row.selected { outline: 1px dotted var(--vscode-contrastActiveBorder); outline-offset: -1px; }`,
        `${list} .monaco-list-row:hover { outline: 1px dashed var(--vscode-contrastActiveBorder); outline-offset: -1px; }`,
        // 缩进参考线（abstractTree.ts:3045-3048）
        `${list}:hover .monaco-tl-indent > .indent-guide, ${list}.always .monaco-tl-indent > .indent-guide { opacity: 1; border-color: var(--vscode-tree-inactiveIndentGuidesStroke); }`,
        `${list} .monaco-tl-indent > .indent-guide.active { opacity: 1; border-color: var(--vscode-tree-indentGuidesStroke); }`,
        // align-icons-and-twisties / hide-arrows（views.css:8-16）：
        // 前者让「无文件夹图标」的主题只在可折叠行显示箭头，后者整个隐藏箭头。
        `.file-icon-themable-tree.align-icons-and-twisties .monaco-tl-twistie:not(.force-twistie):not(.collapsible), .file-icon-themable-tree.hide-arrows .monaco-tl-twistie:not(.force-twistie) { background-image: none !important; width: 0 !important; padding-right: 0 !important; visibility: hidden; }`,
        // 符号行（documentSymbolsTree.css:6-49）。`--outline-element-color` 只在**渲染了问题标记**
        // 时才被写入（documentSymbolsTree.ts:256/272-279 的 _renderMarkerInfo）；本仓库没有标记服务，
        // 该变量恒未定义 → `color` 声明按 unset 处理（继承行色），与权威「无标记」时的表现一致
        //（权威此时走的是 `removeProperty('--outline-element-color')`）。
        `${list} .outline-element { display: flex; flex: 1; flex-flow: row nowrap; align-items: center; }`,
        `${list} .outline-element .monaco-highlighted-label { color: var(--outline-element-color); }`,
        `${list} .outline-element .outline-element-decoration { opacity: 0.75; font-size: 90%; font-weight: 600; padding: 0 12px 0 5px; margin-left: auto; text-align: center; color: var(--outline-element-color); }`,
        `${list} .outline-element .outline-element-icon { padding-right: 6px; }`,
        `${list} .monaco-list-row.focused.selected .outline-element .monaco-highlighted-label, ${list} .monaco-list-row.focused.selected .outline-element-decoration { color: inherit !important; }`,
        // 文件行（breadcrumbscontrol.css:78-81）
        `${list} .picker-item { line-height: 22px; flex: 1; }`,
        // 符号图标配色（symbolIcons.css:9-71，取自 symbolIcons.js 的权威表）
        symbolIconColorRules(list)
    ];
    return rules.join("\n");
}

function injectPickerStyleSheet() {
    if (styleInjected) return;
    const element = document.createElement("style");
    element.id = STYLE_ELEMENT_ID;
    element.textContent = pickerStyleSheet();
    document.head.appendChild(element);
    styleInjected = true;
}
</script>

<template>
    <div v-if="breadcrumbsPicker.visible" class="context-view" :style="viewStyle">
        <div ref="rootEl" class="monaco-breadcrumbs-picker show-file-icons" :style="pickerStyle" @focusout="onFocusOut">
            <div class="arrow" :style="arrowStyle"></div>
            <div :style="treeContainerStyle">
                <div
                    ref="listEl"
                    class="monaco-list pvf-breadcrumbs-picker-list mouse-support"
                    :class="[treeClass, { always: guidesMode === 'always' }]"
                    role="tree"
                    tabindex="0"
                    :aria-label="widgetAriaLabel"
                    :aria-activedescendant="activeDescendant"
                    @keydown="onKeyDown">
                    <div ref="scrollerEl" class="monaco-scrollable-element" @wheel="onWheel">
                        <div class="monaco-list-rows" :style="rowsStyle">
                            <div
                                v-for="(row, index) in breadcrumbsPicker.rows"
                                :key="row.id"
                                class="monaco-list-row"
                                :class="{ focused: isFocused(index), selected: isSelected(index) }"
                                :id="rowDomId(index)"
                                :data-index="index"
                                :style="rowStyle(index)"
                                role="treeitem"
                                :aria-level="row.depth"
                                :aria-setsize="row.setSize"
                                :aria-posinset="row.posInSet"
                                :aria-expanded="row.collapsible ? String(!row.collapsed) : null"
                                :aria-selected="isSelected(index)"
                                :aria-label="row.ariaLabel ?? row.label"
                                :title="row.title"
                                @click="onClick(row, $event)"
                                @dblclick="onDoubleClick(row, $event)">
                                <div class="monaco-tl-row">
                                    <!-- 缩进容器：宽度 = indentSize + indent - 16（abstractTree.ts:485） -->
                                    <div class="monaco-tl-indent" :style="indentStyle(row)">
                                        <div
                                            v-for="(guide, guideIndex) in showGuides ? guidesOf(row, index) : []"
                                            :key="guideIndex"
                                            class="indent-guide"
                                            :class="{ active: guide.active }"
                                            :style="{ width: `${row.metrics.guideWidth}px` }"></div>
                                    </div>
                                    <!-- 折叠箭头（abstractTree.ts:487-513）：codicon 字形只在 collapsible 时添加
                                         （:505-513），叶子行是 16px 空占位、无箭头 -->
                                    <div class="monaco-tl-twistie" :class="twistieClass(row)" :style="twistieStyle(row)"></div>
                                    <div class="monaco-tl-contents">
                                        <!-- 符号分组（DocumentSymbolGroupRenderer）：只有标签 -->
                                        <div v-if="!isFilePicker && row.isGroup" class="outline-element">
                                            <div class="outline-element-label">
                                                <span class="monaco-highlighted-label">{{ row.label }}</span>
                                            </div>
                                        </div>
                                        <!-- 符号元素（DocumentSymbolRenderer）：图标 + IconLabel + 装饰位 -->
                                        <div v-else-if="!isFilePicker" class="outline-element">
                                            <span
                                                v-if="row.icon"
                                                class="outline-element-icon inline codicon-colored codicon"
                                                :class="`codicon-${row.icon}`"></span>
                                            <div class="monaco-icon-label" :class="{ nowrap: true, deprecated: row.deprecated }">
                                                <div class="monaco-icon-label-container">
                                                    <span class="monaco-icon-name-container">
                                                        <a class="label-name"><span class="monaco-highlighted-label">{{ row.label }}</span></a>
                                                    </span>
                                                    <span class="monaco-icon-description-container">
                                                        <span class="label-description">{{ row.detail }}</span>
                                                    </span>
                                                </div>
                                            </div>
                                            <div class="outline-element-decoration"></div>
                                        </div>
                                        <!-- 文件/文件夹（FileRenderer → ResourceLabel） -->
                                        <div v-else class="monaco-icon-label picker-item" :class="row.fileIconClasses">
                                            <div class="monaco-icon-label-container">
                                                <span class="monaco-icon-name-container">
                                                    <a class="label-name"><span class="monaco-highlighted-label">{{ row.label }}</span></a>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 浮层宿主（contextview.ts:186-186 的 `.context-view`：绝对定位 + 2575 层级；
   `top/left` 由布局写入 —— 本组件用内联 style 表达） */
.context-view {
    position: absolute;
    z-index: 2575;
}

/* .monaco-breadcrumbs-picker .arrow（breadcrumbscontrol.css:72-76；其余取值由 _layout 写入） */
.arrow {
    position: absolute;
    width: 0;
    border-style: solid;
}

/* 树容器内的可滚动区域：本仓库用原生滚动条（styles/app.css 的全局规定），
   权威是 monaco 的 ScrollableElement（该差异登记在 docs/vscode-reference.md 第 5 节）。 */
.monaco-scrollable-element {
    height: 100%;
    overflow: auto;
}

/* 行容器之上的列表：高度取树高，去掉容器内边距（权威 tree.layout(treeHeight, width)） */
.monaco-list {
    height: calc(100% - 2px);
    outline: none;
}

.monaco-tl-row {
    cursor: pointer;
}
</style>
