<script setup>
// 快速输入浮层（命令中心 / Ctrl+P / Ctrl+Shift+P 的宿主部件）。
//
// 权威来源（microsoft/vscode）：
//   platform/quickinput/browser/quickInputController.ts:164-254  浮层 DOM 层级与类名
//   platform/quickinput/browser/quickInputList.ts:347-397        列表项 DOM（entry/label/rows/keybinding/meta）
//   platform/quickinput/browser/media/quickInput.css:6-350        全部取值
//   base/browser/ui/list/listView.js + list.css                   .monaco-list / .monaco-list-rows /
//     .monaco-list-row 的定位方式（row 绝对定位，top = index * 行高）
//   base/browser/ui/inputbox/inputBox.ts                          .monaco-inputbox > .ibwrapper > .input
//   workbench/browser/layout.ts:255-275                           浮层位置：命令中心可见时 quickPickTop = 6
//   platform/quickinput/browser/quickInputController.ts:946-1007   宽度 = min(容器宽 * 0.62, 600)、
//     left 居中、列表高度 = 容器高 * 0.4
//   platform/quickinput/browser/quickInputList.ts:807                列表 alwaysConsumeMouseWheel（滚轮只滚列表）
//   base/browser/ui/list/listView.js:140/427-429                    行容器高度 = 内容高度（决定能否滚动）
//   platform/theme/common/colors/quickpickColors.ts               颜色 token 来源
//
// 裁剪（登记在 docs/vscode-reference.md 第 5 节）：无标题栏动作条、无多选复选框、
// 无 quick tree、无进度条与自定义按钮。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { QuickPickItemKind, notifyQuickPickFocusOut, quickInput, acceptQuickPick, setQuickPickActiveIndex, setQuickPickValue } from "@/platform/quickinput/quickInput.js";

const rootEl = ref(null);
const inputEl = ref(null);
const listEl = ref(null);
const hostWidth = ref(0);
const hostHeight = ref(0);

// 宽度 = min(容器宽 * 0.62, 600)（quickInputController.ts:946 + :67 的 MAX_WIDTH）。
const MAX_WIDTH = 600;
const width = computed(() => Math.min(hostWidth.value * 0.62, MAX_WIDTH));
// left：居中（quickInputController.ts:1004 的 `width * 0.5 - width / 2`）。
const left = computed(() => Math.round(hostWidth.value * 0.5 - width.value / 2));
// 高度：命令中心可见时 quickPickTop = 6（workbench/browser/layout.ts:264-270）。
const top = 6;
// 列表高度 = 容器高 * 0.4（quickInputController.ts:949）。
const listHeight = computed(() => Math.max(hostHeight.value * 0.4, 22));

const widgetStyle = computed(() => ({
    width: `${width.value}px`,
    left: `${left.value}px`,
    top: `${top}px`
}));

const listStyle = computed(() => ({ height: `${listHeight.value}px` }));

// 行容器高度 = 内容高度（= 条目数 × 行高），由 JS 写入 —— 与 monaco 的 ListView 一致：
//   listView.js:427-429 `this._scrollHeight = this.contentHeight; this.rowsContainer.style.height = ...`
//   （contentHeight = rangeMap.size，见 listView.js:140；定高列表即 条目数 × 行高）
// list.css:23-27 里 `.monaco-list-rows{height:100%}` 只是兜底，真实滚动高度必须由这里给出：
// 行是绝对定位的，行容器若恒为 100%，滚动容器的 scrollHeight 就等于 clientHeight，
// 列表将完全不能滚动（既滚不动也够不到可视区之外的条目）。
const rowsStyle = computed(() => ({ height: `${quickInput.items.length * ROW_HEIGHT}px` }));

// 可见行数（供 PageUp / PageDown 使用；对齐 listWidget 的 renderHeight / rowHeight）。
const ROW_HEIGHT = 22;
const visibleCount = computed(() => Math.max(Math.floor(listHeight.value / ROW_HEIGHT), 1));

watch(
    visibleCount,
    value => {
        quickInput.visibleCount = value;
    },
    { immediate: true }
);

function measure() {
    const host = document.documentElement;
    hostWidth.value = host.clientWidth;
    hostHeight.value = host.clientHeight;
}

onMounted(() => {
    measure();
    window.addEventListener("resize", measure);
});

onBeforeUnmount(() => {
    window.removeEventListener("resize", measure);
});

// 打开时把焦点移到输入框（对齐 QuickInputBox.focus()，controller.open() 里调用）。
watch(
    () => quickInput.visible,
    async visible => {
        if (!visible) return;
        measure();
        await nextTick();
        inputEl.value?.focus();
    }
);

// 打开时的光标选区（对齐 quickAccess.ts:170-186 的 adjustValueSelection）：
// 未要求 preserveValue 时选中前缀之后的部分，键入即替换过滤词；要求保留时光标落到末尾。
watch(
    () => quickInput.valueSelection,
    async selection => {
        if (!selection || !quickInput.visible) return;
        await nextTick();
        const input = inputEl.value;
        if (!input) return;
        input.focus();
        input.setSelectionRange(selection[0], selection[1]);
    }
);

// 活动项变化时滚动到可见（对齐 list.reveal/scrollToActiveItem）。
watch(
    () => quickInput.activeIndex,
    async index => {
        if (index < 0) return;
        await nextTick();
        listEl.value?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
    }
);

function onInput(event) {
    setQuickPickValue(event.target.value);
}

// 失焦关闭：对齐 QuickInput.ignoreFocusOut 默认 false（点击编辑器等外部区域即隐藏）。
function onFocusOut(event) {
    if (event.relatedTarget && rootEl.value?.contains(event.relatedTarget)) return;
    notifyQuickPickFocusOut();
}

function onItemHover(index) {
    setQuickPickActiveIndex(index);
}

function onItemClick(index) {
    setQuickPickActiveIndex(index);
    acceptQuickPick();
}

// 滚轮滚动列表：权威把列表建为带 `alwaysConsumeMouseWheel: true` 的树/列表
// （quickInputList.ts:807），滚轮由滚动容器消费、只滚动列表本身（不改变活动项），
// 滚到两端也不外溢给下层的编辑器。
function onWheel(event) {
    event.preventDefault();
    const element = listEl.value;
    if (!element) return;
    element.scrollTop += event.deltaY;
}

function itemIconClass(item) {
    return item.icon ? `codicon codicon-${item.icon}` : "";
}
</script>

<template>
    <div v-show="quickInput.visible" ref="rootEl" class="quick-input-widget show-file-icons" :style="widgetStyle" tabindex="-1" @focusout="onFocusOut">
        <div class="quick-input-header">
            <div class="quick-input-and-message">
                <div class="quick-input-filter">
                    <div class="quick-input-box">
                        <div class="monaco-inputbox idle">
                            <div class="ibwrapper">
                                <input
                                    ref="inputEl"
                                    class="input"
                                    type="text"
                                    autocomplete="off"
                                    spellcheck="false"
                                    role="combobox"
                                    aria-expanded="true"
                                    aria-controls="quick-input-list"
                                    aria-autocomplete="list"
                                    :placeholder="quickInput.placeholder"
                                    :value="quickInput.value"
                                    @input="onInput" />
                                <div class="mirror" aria-hidden="true"></div>
                            </div>
                        </div>
                    </div>
                    <div class="quick-input-count">
                        <span v-if="quickInput.items.length" class="monaco-count-badge">{{ quickInput.items.length }}</span>
                    </div>
                </div>
                <div v-if="quickInput.validationMessage" class="quick-input-message">
                    <span class="codicon codicon-error"></span>
                    {{ quickInput.validationMessage }}
                </div>
            </div>
        </div>

        <div class="quick-input-list">
            <div class="monaco-list" :style="listStyle" @wheel="onWheel">
                <div ref="listEl" class="monaco-scrollable-element">
                    <div class="monaco-list-rows" :style="rowsStyle" role="listbox" id="quick-input-list">
                        <div
                            v-for="(item, index) in quickInput.items"
                            :key="item.id"
                            class="monaco-list-row"
                            :class="{ focused: quickInput.activeIndex === index }"
                            :data-index="index"
                            :style="{ top: `${index * ROW_HEIGHT}px`, height: `${ROW_HEIGHT}px` }"
                            role="option"
                            :aria-selected="quickInput.activeIndex === index"
                            @mousemove="onItemHover(index)"
                            @click="onItemClick(index)">
                            <div class="quick-input-list-entry" :class="{ 'quick-input-list-separator-border': item.kind !== QuickPickItemKind.Separator && item.separatorBefore }">
                                <!-- 分隔行（对齐 quickInputList.ts:387 的 .quick-input-list-separator） -->
                                <template v-if="item.kind === QuickPickItemKind.Separator">
                                    <span class="quick-input-list-separator">{{ item.label }}</span>
                                </template>
                                <template v-else>
                                    <label class="quick-input-list-label">
                                        <span class="quick-input-list-icon" :class="itemIconClass(item)"></span>
                                        <div class="quick-input-list-rows">
                                            <div class="quick-input-list-row">
                                                <span class="monaco-icon-label">
                                                    <span class="monaco-icon-label-container">
                                                        <span class="monaco-icon-name-container">
                                                            <span class="label-name">{{ item.label }}</span>
                                                        </span>
                                                    </span>
                                                </span>
                                                <span v-if="item.keybinding" class="quick-input-list-entry-keybinding">
                                                    <span class="monaco-keybinding">
                                                        <span class="monaco-keybinding-key">{{ item.keybinding }}</span>
                                                    </span>
                                                </span>
                                            </div>
                                            <div class="quick-input-list-row">
                                                <span class="quick-input-list-label-meta">{{ item.description }}</span>
                                            </div>
                                        </div>
                                    </label>
                                </template>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 浮层容器 —— quickInput.css:6-14（position/width/z-index/left/圆角/阴影），
   top 与 left 由 JS 计算（quickInputController.ts:1003-1007）。 */
.quick-input-widget {
    position: absolute;
    width: 600px;
    z-index: 2550;
    -webkit-app-region: no-drag;
    border-radius: var(--vscode-cornerRadius-xLarge);
    box-shadow: var(--vscode-shadow-xl);
    /* 容器配色由 quickInputController.ts:1055-1062 注入：
       background = quickInput.background、foreground = quickInput.foreground、border = widget.border */
    background-color: var(--vscode-quickInput-background);
    color: var(--vscode-quickInput-foreground);
    border: 1px solid var(--vscode-widget-border);
}

/* quickInput.css:130-134 */
.quick-input-header {
    display: flex;
    padding: 6px 6px 4px 6px;
}

/* quickInput.css:146-152 */
.quick-input-and-message {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-width: 0;
    position: relative;
}

/* quickInput.css:136-138：输入框圆角 */
.quick-input-widget .quick-input-filter .monaco-inputbox {
    border-radius: var(--vscode-cornerRadius-medium);
}

/* quickInput.css:163-171 */
.quick-input-filter {
    flex-grow: 1;
    display: flex;
    position: relative;
}

.quick-input-box {
    flex-grow: 1;
}

/* quickInput.css:183-189 */
.quick-input-count {
    align-self: center;
    position: absolute;
    right: 4px;
    display: flex;
    align-items: center;
}

/* quickInput.css:191-197 */
.quick-input-count .monaco-count-badge {
    vertical-align: middle;
    padding: 2px 4px;
    border-radius: 2px;
    min-height: auto;
    line-height: normal;
}

/* quickInput.css:203-207 */
.quick-input-message {
    margin-top: -1px;
    padding: 5px;
    overflow-wrap: break-word;
}

.quick-input-message > .codicon {
    margin: 0 0.2em;
    vertical-align: text-bottom;
}

/* quickInput.css:223-237：列表与 .monaco-list 的可见高度（高度由 JS 按布局写入） */
.quick-input-list {
    line-height: 22px;
}

.quick-input-list .monaco-list {
    overflow: hidden;
    max-height: calc(20 * 22px);
    padding-bottom: 7px;
    position: relative;
}

/* list.css:6-14 + listView.js：滚动容器占满 list 高度 */
.quick-input-list .monaco-scrollable-element {
    padding: 0 6px;
    position: relative;
    overflow: hidden;
    height: 100%;
}

/* list.css:23-27：行容器（row 绝对定位；高度为兜底值，真实滚动高度由 rowsStyle 按内容高度写入，
   见 listView.js:427-429） */
.monaco-list-rows {
    position: relative;
    width: 100%;
    height: 100%;
}

/* list.css:34-39 */
.monaco-list-row {
    position: absolute;
    box-sizing: border-box;
    overflow: hidden;
    width: 100%;
    touch-action: none;
}

/* quickInput.css:255-257 */
.quick-input-list .monaco-list-row {
    border-radius: 3px;
}

/* quickInput.css:243-248 */
.quick-input-list .quick-input-list-entry {
    box-sizing: border-box;
    overflow: hidden;
    display: flex;
    height: 100%;
    padding: 0 6px;
}

/* quickInput.css:263-268 */
.quick-input-list .quick-input-list-label {
    overflow: hidden;
    display: flex;
    height: 100%;
    flex: 1;
}

/* quickInput.css:279-289 */
.quick-input-list .quick-input-list-icon {
    background-size: 16px;
    background-position: left center;
    background-repeat: no-repeat;
    padding-right: 6px;
    width: 16px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* quickInput.css:291-304 */
.quick-input-list .quick-input-list-rows {
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    flex-direction: column;
    height: 100%;
    flex: 1;
    margin-left: 5px;
}

.quick-input-list .quick-input-list-rows > .quick-input-list-row {
    display: flex;
    align-items: center;
}

.quick-input-list .quick-input-list-rows > .quick-input-list-row .monaco-icon-label {
    flex: 1;
}

/* quickInput.css:320-323 */
.quick-input-list .quick-input-list-entry .quick-input-list-entry-keybinding {
    margin-right: 8px;
}

/* quickInput.css:325-330 */
.quick-input-list .quick-input-list-label-meta {
    opacity: 0.7;
    line-height: normal;
    text-overflow: ellipsis;
    overflow: hidden;
}

.quick-input-list .monaco-list-row.focused .quick-input-list-label-meta {
    opacity: 1;
}

/* 聚焦行配色：quickInputController.ts:1064 的 styles.list 映射 ——
   focusBackground = quickInputList.focusBackground、focusForeground = quickInputList.focusForeground、
   focusIconForeground = quickInputList.focusIconForeground（quickpickColors.ts:41-51）。 */
.quick-input-list .monaco-list-row.focused {
    background-color: var(--vscode-quickInputList-focusBackground);
    color: var(--vscode-quickInputList-focusForeground);
}

.quick-input-list .monaco-list-row.focused .quick-input-list-icon {
    color: var(--vscode-quickInputList-focusIconForeground);
}

/* 非聚焦行的 hover：list.hoverBackground（listColors 默认值 = list.focusBackground 的弱化版），
   与权威 list widget 的 mouse-support hover 一致（list.css:41-51）。 */
.quick-input-list .monaco-list-row:not(.focused):hover {
    background-color: var(--vscode-list-hoverBackground);
}

/* quickInput.css:348-353：分组分隔标签（颜色取 descriptionForeground，不是 pickerGroup.foreground —— 
   权威该处用的是前者；font-size 为 bodyFontSize.xSmall） */
.quick-input-list .quick-input-list-entry .quick-input-list-separator {
    margin-right: 4px;
    font-size: var(--vscode-bodyFontSize-xSmall);
    color: var(--vscode-descriptionForeground);
    line-height: 22px;
}

/* quickInput.css:250-253：分组上边框（权威只给宽度与线型，颜色取 currentColor） */
.quick-input-list .quick-input-list-entry.quick-input-list-separator-border {
    border-top-width: 1px;
    border-top-style: solid;
}

/* quickInput.css:259-261：首行不画分组上边框 */
.quick-input-list .monaco-list-row[data-index="0"] .quick-input-list-entry.quick-input-list-separator-border {
    border-top-style: none;
}

/* 快捷键标签配色：权威由 keybindingLabel.ts:78/164-174 以内联样式写入（取值见
   platform/theme/browser/defaultStyles.ts:34-40 的 asCssVariable 映射），
   本仓库的列表项是声明式渲染，故在此用同一组 token 复现；行内 hover/focus 的覆盖规则见
   quickInput.css:413-426。 */
.quick-input-list .monaco-keybinding {
    color: var(--vscode-keybindingLabel-foreground);
}

.quick-input-list .monaco-keybinding > .monaco-keybinding-key {
    background-color: var(--vscode-keybindingLabel-background);
    border-color: var(--vscode-keybindingLabel-border);
    border-bottom-color: var(--vscode-keybindingLabel-bottomBorder);
    box-shadow: inset 0 -1px 0 var(--vscode-widget-shadow);
}

/* quickInput.css:412-426：聚焦 / hover 行里的快捷键标签改为无底色、文字跟随行色；
   描边权威对 vs/vs-dark 主题用前景色 30% 推导（注释见该文件 :421-425），
   本仓库是固定的深色主题，直接取其 vs-dark 分支。 */
.quick-input-list .monaco-list-row.focused .monaco-keybinding-key,
.quick-input-list .monaco-list-row.focused .quick-input-list-entry .quick-input-list-separator {
    color: inherit;
}

.quick-input-list .monaco-list-row.focused .monaco-keybinding-key,
.quick-input-list .monaco-list-row:hover .monaco-keybinding-key {
    background: none;
    border-color: color-mix(in srgb, currentColor 30%, transparent);
}

/* 分隔行不可作为选中项，去掉 hover 底色（对齐 Separator 不进 activeItems 的语义） */
.quick-input-list .monaco-list-row:has(.quick-input-list-separator) {
    cursor: default;
    background-color: transparent !important;
}
</style>
