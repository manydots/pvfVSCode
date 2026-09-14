<script setup>
// 底部面板部件（对齐 VS Code workbench/browser/parts/panel/panelPart.ts +
// paneCompositePart.ts + media/panelpart.css + media/paneCompositePart.css）。
//
// DOM 层级：.part.panel > (.sash) + .composite.title > [.composite-bar-container, .title-actions,
// .global-actions] + .content > .composite.panel > 视图组件。
// 切换器是 ViewContainerLocation.Panel 的容器列表；标题栏动作分两段：
// .title-actions 为当前视图动作（MenuId.ViewTitle），.global-actions 为 MenuId.PanelTitle（最大化/关闭）。
import { computed } from "vue";
import { appState } from "@/menu/appState.js";
import { MenuId } from "@/menu/menuId.js";
import { executeCommand } from "@/menu/commands.js";
import { getViews } from "@/workbench/viewsRegistry.js";
import { getActivePanelViewContainer, getPanelViewContainers, getViewTitleActions, showPanelContainer } from "@/workbench/viewService.js";
import { PANEL_MIN_HEIGHT, clampPanelHeight } from "@/workbench/browser/partDimensions.js";
import Toolbar from "@/base/toolbar/Toolbar.vue";
import MenuToolbar from "@/components/MenuToolbar.vue";
import Sash from "@/base/sash/Sash.vue";

const containers = computed(() => getPanelViewContainers());
const activeContainer = computed(() => getActivePanelViewContainer());
const activeViews = computed(() => getViews(activeContainer.value));
const activeViewId = computed(() => activeViews.value[0]?.id ?? null);

// .title-actions：当前视图的标题动作。navigation 组中未标记 isHiddenByDefault 的项内联显示
// （终端的新建/拆分/杀掉），其余收进标题栏的「…」溢出菜单（终端的清空/运行活动文件），
// 与 VS Code 视图标题栏 ActionBar 的 fillInActions 行为一致。
const viewActions = computed(() => {
    const toAction = action => ({
        type: "action",
        id: action.commandId,
        label: action.label,
        icon: action.icon,
        tooltip: action.label,
        enabled: action.enabled,
        checked: action.checked,
        keybinding: action.keybinding,
        submenu: null,
        run: action.commandId ? () => executeCommand(action.commandId) : null
    });
    const resolved = getViewTitleActions(activeViewId.value);
    return {
        inline: resolved.filter(action => !action.hiddenByDefault).map(toAction),
        hidden: resolved.filter(action => action.hiddenByDefault).map(toAction)
    };
});

function runViewAction(action) {
    action.run?.();
}

// 面板高度拖拽（对齐 VS Code grid 的 sash 行为：向上拖动增高，拖动时自动取消最大化）。
// 高度约束与夹取见 workbench/browser/partDimensions.js（最小 77 的出处写在文件里），
// 与「启动恢复已存高度」共用同一份规则。分隔条本体复用 base/sash/Sash.vue。
let dragStart = null;

const sashState = computed(() => (appState.panelHeight <= PANEL_MIN_HEIGHT ? "minimum" : "enabled"));

function onSashStart(event) {
    appState.panelMaximized = false;
    dragStart = { y: event.startY, height: appState.panelHeight };
}

function onSashChange(event) {
    if (!dragStart) return;
    const next = dragStart.height - (event.currentY - dragStart.y);
    appState.panelHeight = clampPanelHeight(next, window.innerHeight);
}

function onSashEnd() {
    dragStart = null;
}

function onFocusIn() {
    appState.panelFocused = true;
}

function onFocusOut(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) appState.panelFocused = false;
}
</script>

<template>
    <section
        v-show="appState.panelVisible"
        class="part panel basepanel bottom"
        :class="{ maximized: appState.panelMaximized, focused: appState.panelFocused }"
        :style="appState.panelMaximized ? {} : { height: `${appState.panelHeight}px` }"
        @focusin="onFocusIn"
        @focusout="onFocusOut">
        <Sash v-if="!appState.panelMaximized" class="panel-sash" orientation="horizontal" :state="sashState" @start="onSashStart" @change="onSashChange" @end="onSashEnd" />

        <div class="composite title">
            <div class="composite-bar-container">
                <div class="composite-bar">
                    <div class="monaco-action-bar">
                        <ul class="actions-container" role="tablist">
                            <li
                                v-for="container in containers"
                                :key="container.id"
                                class="action-item"
                                :class="{ checked: container.id === appState.activePanelId }"
                                role="tab"
                                :aria-selected="container.id === appState.activePanelId"
                                @click="showPanelContainer(container.id)">
                                <a class="action-label">{{ container.title }}</a>
                                <div class="active-item-indicator"></div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="title-actions">
                <Toolbar :primary="viewActions.inline" :secondary="viewActions.hidden" :max-items="64" aria-label="视图操作" @execute="runViewAction" />
            </div>

            <div class="global-actions">
                <MenuToolbar :menu-id="MenuId.PanelTitle" :max-items="4" aria-label="面板操作" />
            </div>
        </div>

        <div class="content">
            <div class="composite panel">
                <component v-for="view in activeViews" :key="view.id" :is="view.component" v-bind="view.props" />
            </div>
        </div>
    </section>
</template>

<style scoped>
/* .part.panel（对齐 panelpart.css：底部分隔边框取 panel.border，背景取 panel.background） */
.part.panel {
    flex: 0 0 auto;
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--vscode-panel-background);
    color: var(--vscode-foreground);
}

.part.panel.maximized {
    flex: 1 1 auto;
}

/* 分隔条位置：面板顶部之外（尺寸/状态/hover 由 base/sash/Sash.vue 提供） */
.panel-sash {
    top: calc(-1 * var(--vscode-sash-size));
}

/* .composite.title：面板标题栏（高度 35px，顶部 1px 分隔线） */
.composite.title {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    height: var(--vscode-panelHeader-height);
    border-top: 1px solid var(--vscode-panel-border);
}

.composite-bar-container,
.composite-bar {
    display: flex;
}

/* 切换器：文字模式（对齐 paneCompositePart.css 的 .action-item 数值） */
.monaco-action-bar {
    line-height: 27px;
}

.actions-container {
    display: flex;
    align-items: center;
    height: var(--vscode-panelHeader-height);
    margin: 0;
    padding: 0;
    list-style: none;
}

.action-item {
    position: relative;
    display: flex;
    align-items: center;
    height: 100%;
    padding: 0 10px;
    font-size: 11px;
    text-transform: uppercase;
    color: var(--vscode-panelTitle-inactiveForeground);
    cursor: pointer;
}

.action-item:hover,
.action-item.checked {
    color: var(--vscode-panelTitle-activeForeground);
}

.action-label {
    color: inherit;
    white-space: nowrap;
}

/* 选中项下划线：宽 calc(100% - 20px)、高 1px、颜色 panelTitle.activeBorder */
.active-item-indicator {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 0;
    height: 1px;
    pointer-events: none;
}

.action-item.checked .active-item-indicator {
    background: var(--vscode-panelTitle-activeBorder);
}

.action-item:focus {
    outline: none;
}

/* .title-actions：当前视图动作，靠右排列 */
.title-actions {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 2px;
    padding-right: 4px;
}

.global-actions {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    padding-right: 4px;
}

/* .content：面板内容区 */
.content {
    flex: 1 1 auto;
    min-height: 0;
}

.composite.panel {
    height: 100%;
    overflow: hidden;
}
</style>
