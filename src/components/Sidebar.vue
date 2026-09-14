<script setup>
// 侧栏宿主（对齐 VS Code workbench/browser/parts/sidebarPart.ts）：
// 顶部为容器标题栏（35px、11px 大写标题 + 右侧容器动作），下面渲染当前容器的视图，
// 右边界挂 4px 分隔条用于拖拽调宽。
import { computed } from "vue";
import { getViews } from "@/workbench/viewsRegistry.js";
import { getActiveViewContainer, getViewTitleActions } from "@/workbench/viewService.js";
import { appState } from "@/menu/appState.js";
import { executeCommand } from "@/menu/commands.js";
import Codicon from "@/components/Codicon.vue";
import Sash from "@/base/sash/Sash.vue";
// 宽度约束与复位值见 workbench/browser/partDimensions.js（各取值的权威出处写在该文件里）；
// 拖拽与「启动恢复已存宽度」共用同一份夹取规则。
import { SIDEBAR_MIN_WIDTH, SIDEBAR_PREFERRED_WIDTH, clampSidebarWidth, maxSidebarWidth } from "@/workbench/browser/partDimensions.js";

const container = computed(() => getActiveViewContainer());
const views = computed(() => getViews(container.value));

// 标题动作取自 MenuId.ViewTitle（对齐 VS Code 视图标题动作贡献）：以当前视图 id 求值 when，
// 无贡献时回退到容器声明式 titleActions。
const titleActions = computed(() => {
    const active = container.value;
    if (!active) return [];
    const actions = getViewTitleActions(getViews(active)[0]?.id);
    return actions.length ? actions : (active.titleActions ?? []);
});

function runTitleAction(action) {
    if (action.commandId) executeCommand(action.commandId);
    else action.run?.();
}

const sashState = computed(() => {
    if (appState.sidebarWidth <= SIDEBAR_MIN_WIDTH) return "minimum";
    if (appState.sidebarWidth >= maxSidebarWidth(window.innerWidth)) return "maximum";
    return "enabled";
});

let dragStart = null;

function onSashStart(event) {
    dragStart = { x: event.startX, width: appState.sidebarWidth };
}

function onSashChange(event) {
    if (!dragStart) return;
    const next = dragStart.width + (event.currentX - dragStart.x);
    appState.sidebarWidth = clampSidebarWidth(next, window.innerWidth);
}

function onSashEnd() {
    dragStart = null;
}

function onSashReset() {
    appState.sidebarWidth = SIDEBAR_PREFERRED_WIDTH;
}
</script>

<template>
    <aside v-show="appState.sidebarVisible" class="sidebar" :style="{ width: `${appState.sidebarWidth}px` }">
        <Sash class="sidebar-sash" orientation="vertical" :state="sashState" @start="onSashStart" @change="onSashChange" @end="onSashEnd" @reset="onSashReset" />

        <div class="title">
            <div class="title-label">
                <h2>{{ container?.title }}</h2>
            </div>
            <div class="title-actions">
                <button
                    v-for="action in titleActions"
                    :key="action.commandId ?? action.id ?? action.icon"
                    type="button"
                    class="action-label"
                    :disabled="action.enabled === false"
                    :title="action.label ?? action.title"
                    :aria-label="action.label ?? action.title"
                    @click="runTitleAction(action)">
                    <Codicon :name="action.icon" :size="16" />
                </button>
            </div>
        </div>

        <div class="body">
            <component v-for="view in views" :key="view.id" :is="view.component" v-bind="view.props" />
        </div>
    </aside>
</template>

<style scoped>
.sidebar {
    /* 宽度由 appState.sidebarWidth 内联给出（对齐 VS Code 由 grid 设置部件尺寸，
       不是主题 token —— 上游不存在 --vscode-sideBar-width） */
    position: relative;
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    background: var(--vscode-sideBar-background);
    /* 右侧分隔线（对齐 sidebarPart.ts:updateStyles：左侧布局时设 borderRight*） */
    border-right: 1px solid var(--vscode-sideBar-border);
}

/* 分隔条居中于侧栏右边界（对齐 sash.ts:667：left = 边界 - size/2） */
.sidebar-sash {
    right: calc(var(--vscode-sash-size) / -2);
}

.title {
    height: var(--vscode-titleBar-height);
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    overflow: hidden;
}

.title-label {
    padding-left: 12px;
    line-height: var(--vscode-titleBar-height);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.title-label h2 {
    margin: 0;
    font-size: 11px;
    font-weight: normal;
    text-transform: uppercase;
    color: var(--vscode-sideBarTitle-foreground);
}

.title-actions {
    flex: 1 1 auto;
    height: var(--vscode-titleBar-height);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-left: 5px;
}

.action-label {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin-right: 4px;
    padding: 2px;
    border: none;
    border-radius: var(--vscode-cornerRadius-medium);
    background: transparent;
    color: var(--vscode-icon-foreground);
    cursor: default;
}

.action-label:hover:not(:disabled) {
    background: var(--vscode-toolbar-hoverBackground);
}

.action-label:disabled {
    color: var(--vscode-disabledForeground);
    cursor: default;
}

.body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
}
</style>
