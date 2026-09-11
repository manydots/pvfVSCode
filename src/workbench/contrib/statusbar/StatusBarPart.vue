<script setup>
// 状态栏部件（对齐 VS Code workbench/browser/parts/statusbar/statusbarPart.ts +
// statusbarItem.ts + media/statusbarpart.css）。
//
// DOM 层级：.part.statusbar > (.left-items.items-container, .right-items.items-container)，
// 每个条目为 .statusbar-item[.left|.right][.${kind}-kind][.has-command][.has-background-color]
// > a.statusbar-item-label（text 中的 $(id) 渲染为 codicon 图标）。
// 右侧容器在 CSS 中用 flex-direction: row-reverse，因此 DOM 顺序需按优先级反序
// （见 statusbarPart.appendStatusbarEntries 中的 `.reverse()`）。
import { computed } from "vue";
import { appState } from "@/menu/appState.js";
import { executeCommand } from "@/menu/commands.js";
import { StatusbarAlignment, getEntries, hasBackgroundColor } from "@/workbench/contrib/statusbar/statusbarService.js";

const leftItems = computed(() => decorate(getEntries(StatusbarAlignment.LEFT), StatusbarAlignment.LEFT));
// 高优先级靠左：DOM 反序后交给 row-reverse 还原视觉顺序。
const rightItems = computed(() => decorate(getEntries(StatusbarAlignment.RIGHT).slice().reverse(), StatusbarAlignment.RIGHT));

// 上下文：VS Code 的 codicon 文本语法（StatusBarCodiconLabel），如 "$(error) 0"。
const CODICON_RE = /\$\(([\w-]+)\)/g;
function labelSegments(text) {
    const segments = [];
    let last = 0;
    let match;
    CODICON_RE.lastIndex = 0;
    while ((match = CODICON_RE.exec(text))) {
        if (match.index > last) segments.push({ icon: null, text: text.slice(last, match.index) });
        segments.push({ icon: match[1], text: "" });
        last = match.index + match[0].length;
    }
    if (last < text.length) segments.push({ icon: null, text: text.slice(last) });
    return segments;
}

// 类名对齐 statusbarPart.doCreateStatusItem 与 statusbarItem.update：
// first/last-visible-item 用于贴角内边距（按优先级顺序而非 DOM 顺序标记，见
// statusbarPart.doMarkFirstLastVisibleStatusbarItem），kind 决定前景/背景色。
function itemClass(entry, priorityOrder, index) {
    const classes = {
        left: entry.alignment === StatusbarAlignment.LEFT,
        right: entry.alignment === StatusbarAlignment.RIGHT,
        "first-visible-item": index === 0,
        "last-visible-item": index === priorityOrder.length - 1,
        "has-command": !!entry.command,
        "has-background-color": hasBackgroundColor(entry)
    };
    if (entry.kind !== "standard") classes[`${entry.kind}-kind`] = true;
    return classes;
}

function decorate(list, alignment) {
    // 优先级顺序：左侧与 DOM 顺序一致，右侧为 DOM 顺序的反序。
    const priorityOrder = alignment === StatusbarAlignment.LEFT ? list : list.slice().reverse();
    return list.map(entry => ({ entry, classes: itemClass(entry, priorityOrder, priorityOrder.indexOf(entry)) }));
}

function onEntryClick(entry) {
    if (entry.command) executeCommand(entry.command);
}
</script>

<template>
    <footer v-show="appState.statusBarVisible" class="part statusbar" role="status" aria-label="状态栏">
        <div class="left-items items-container">
            <div v-for="item in leftItems" :id="item.entry.id" :key="item.entry.id" class="statusbar-item" :class="item.classes">
                <a
                    v-show="item.entry.text"
                    class="statusbar-item-label"
                    :class="{ disabled: !item.entry.command }"
                    :role="item.entry.role"
                    :aria-label="item.entry.ariaLabel"
                    :title="item.entry.tooltip"
                    @click="onEntryClick(item.entry)">
                    <template v-for="(segment, segmentIndex) in labelSegments(item.entry.text)" :key="segmentIndex">
                        <span v-if="segment.icon" class="codicon" :class="`codicon-${segment.icon}`"></span>
                        <span v-else>{{ segment.text }}</span>
                    </template>
                </a>
            </div>
        </div>

        <div class="right-items items-container">
            <div v-for="item in rightItems" :id="item.entry.id" :key="item.entry.id" class="statusbar-item" :class="item.classes">
                <a
                    v-show="item.entry.text"
                    class="statusbar-item-label"
                    :class="{ disabled: !item.entry.command }"
                    :role="item.entry.role"
                    :aria-label="item.entry.ariaLabel"
                    :title="item.entry.tooltip"
                    @click="onEntryClick(item.entry)">
                    <template v-for="(segment, segmentIndex) in labelSegments(item.entry.text)" :key="segmentIndex">
                        <span v-if="segment.icon" class="codicon" :class="`codicon-${segment.icon}`"></span>
                        <span v-else>{{ segment.text }}</span>
                    </template>
                </a>
            </div>
        </div>
    </footer>
</template>

<style scoped>
/* .part.statusbar（statusbarpart.css:6-14）：22px 高、12px 字号、flex 布局 */
.statusbar {
    box-sizing: border-box;
    flex: 0 0 auto;
    cursor: default;
    width: 100%;
    height: var(--vscode-statusBar-height, 22px);
    font-size: 12px;
    display: flex;
    overflow: hidden;
    background: var(--vscode-statusBar-background);
    color: var(--vscode-statusBar-foreground);
    border-top: 1px solid var(--vscode-statusBar-border);
}

.left-items,
.right-items {
    display: flex;
}

/* 右侧：row-reverse 让 DOM 中靠后的条目出现在更右侧（高优先级条目靠左） */
.right-items {
    flex-wrap: wrap;
    flex-direction: row-reverse;
}

/* 左侧撑开剩余空间，把右侧条目推到最右端 */
.left-items {
    flex-grow: 1;
}

.statusbar-item {
    display: inline-block;
    line-height: var(--vscode-statusBar-height, 22px);
    height: 100%;
    vertical-align: top;
    max-width: 40vw;
    font-variant-numeric: tabular-nums;
}

.statusbar-item.left.first-visible-item {
    padding-right: 0;
    padding-left: 2px;
}

.statusbar-item.right.last-visible-item {
    padding-right: 2px;
    padding-left: 0;
}

/* .statusbar-item-label：左右各 3px 外边距 + 5px 内边距，贴角条目改用 8px 内边距 */
.statusbar-item-label {
    cursor: pointer;
    display: flex;
    height: 100%;
    margin-right: 3px;
    margin-left: 3px;
    padding: 0 5px;
    white-space: pre;
    align-items: center;
    text-overflow: ellipsis;
    overflow: hidden;
    outline-width: 0;
    color: inherit;
    text-decoration: none;
}

.statusbar-item.left.first-visible-item .statusbar-item-label,
.statusbar-item.right.last-visible-item .statusbar-item-label,
.statusbar-item.has-background-color .statusbar-item-label {
    margin-left: 0;
    margin-right: 0;
    padding-left: 8px;
    padding-right: 8px;
}

.statusbar-item .codicon {
    text-align: center;
    color: inherit;
}

/* hover / active（statusbarpart.css:147-177）：有 command 的条目才有反馈 */
.statusbar-item-label:hover:not(.disabled) {
    text-decoration: none;
    color: var(--vscode-statusBarItem-hoverForeground);
    background-color: var(--vscode-statusBarItem-hoverBackground);
}

.statusbar-item-label:active:not(.disabled) {
    background-color: var(--vscode-statusBarItem-activeBackground);
}

.statusbar-item-label.disabled {
    cursor: default;
}

/* kind 配色（statusbarpart.css:179-243） */
.statusbar-item.warning-kind {
    color: var(--vscode-statusBarItem-warningForeground);
    background-color: var(--vscode-statusBarItem-warningBackground);
}

.statusbar-item.warning-kind .statusbar-item-label:hover:not(.disabled) {
    color: var(--vscode-statusBarItem-warningHoverForeground);
    background-color: var(--vscode-statusBarItem-warningHoverBackground);
}

.statusbar-item.error-kind {
    color: var(--vscode-statusBarItem-errorForeground);
    background-color: var(--vscode-statusBarItem-errorBackground);
}

.statusbar-item.error-kind .statusbar-item-label:hover:not(.disabled) {
    color: var(--vscode-statusBarItem-errorHoverForeground);
    background-color: var(--vscode-statusBarItem-errorHoverBackground);
}

.statusbar-item.prominent-kind {
    color: var(--vscode-statusBarItem-prominentForeground);
    background-color: var(--vscode-statusBarItem-prominentBackground);
}

.statusbar-item.prominent-kind .statusbar-item-label:hover:not(.disabled) {
    color: var(--vscode-statusBarItem-prominentHoverForeground);
    background-color: var(--vscode-statusBarItem-prominentHoverBackground);
}

.statusbar-item.remote-kind {
    color: var(--vscode-statusBarItem-remoteForeground);
    background-color: var(--vscode-statusBarItem-remoteBackground);
}

.statusbar-item.remote-kind .statusbar-item-label:hover:not(.disabled) {
    color: var(--vscode-statusBarItem-remoteHoverForeground);
    background-color: var(--vscode-statusBarItem-remoteHoverBackground);
}

.statusbar-item.offline-kind {
    color: var(--vscode-statusBarItem-offlineForeground);
    background-color: var(--vscode-statusBarItem-offlineBackground);
}

.statusbar-item.offline-kind .statusbar-item-label:hover:not(.disabled) {
    color: var(--vscode-statusBarItem-offlineHoverForeground);
    background-color: var(--vscode-statusBarItem-offlineHoverBackground);
}
</style>
