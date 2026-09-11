<script setup>
// 活动栏（对齐 VS Code workbench/browser/parts/activitybar）：
// 上半部分渲染 Sidebar 位置的视图容器，下半部分为「账户 / 管理」等全局动作。
// 尺寸与配色照搬 activityaction.css / activitybarpart.css：宽 48px、条目 48×48、图标 24px，
// 选中项左侧 2px 全高指示条（activityBar.activeBorder）。
import { getViewContainers, ViewContainerLocation } from "@/workbench/viewsRegistry.js";
import { focusViewContainer } from "@/workbench/viewService.js";
import { appState, setStatus } from "@/menu/appState.js";
import { executeCommand } from "@/menu/commands.js";
import WorkbenchIcon from "@/components/WorkbenchIcon.vue";

const containers = getViewContainers(ViewContainerLocation.Sidebar);

function isActive(container) {
    return appState.sidebarVisible && appState.activeViewContainerId === container.id;
}

function openSettings() {
    executeCommand("workbench.action.openSettings");
}

function openAccount() {
    setStatus("账户功能将在后续接入");
}
</script>

<template>
    <nav class="activitybar" :class="{ 'no-sidebar': !appState.sidebarVisible }">
        <div class="content">
            <div class="composite-bar">
                <button
                    v-for="container in containers"
                    :key="container.id"
                    type="button"
                    class="action-item"
                    :class="{ checked: isActive(container) }"
                    :title="container.title"
                    :aria-label="container.title"
                    @click="focusViewContainer(container.id)">
                    <span class="action-label">
                        <WorkbenchIcon :name="container.icon" :size="24" />
                    </span>
                </button>
            </div>

            <div class="composite-bar bottom">
                <button type="button" class="action-item" title="账户" aria-label="账户" @click="openAccount">
                    <span class="action-label">
                        <WorkbenchIcon name="account" :size="24" />
                    </span>
                </button>
                <button type="button" class="action-item" title="管理" aria-label="管理" @click="openSettings">
                    <span class="action-label">
                        <WorkbenchIcon name="settings-gear" :size="24" />
                    </span>
                </button>
            </div>
        </div>
    </nav>
</template>

<style scoped>
.activitybar {
    flex: 0 0 var(--vscode-activityBar-width);
    width: var(--vscode-activityBar-width);
    background: var(--vscode-activityBar-background);
    /* 右侧分隔线（对齐 activitybarPart.ts:updateStyles 的 bordered 类 —— 取到
       activityBar.border 即加 .bordered，再由 activitybarpart.css:30 画 1px 右描边） */
    border-right: 1px solid var(--vscode-activityBar-border);
}

/* 侧栏隐藏时活动栏紧贴主区，改以阴影分隔（对齐 activitybarpart.css:11 的
   `.monaco-workbench.nosidebar .part.activitybar`） */
.activitybar.no-sidebar {
    box-shadow: var(--vscode-shadow-md);
}

.activitybar > .content {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.action-item {
    position: relative;
    display: block;
    width: var(--vscode-activityBar-itemSize);
    height: var(--vscode-activityBar-itemSize);
    padding: 0;
    border: none;
    background: transparent;
    color: var(--vscode-activityBar-inactiveForeground);
    cursor: default;
    outline: none;
}

.action-item .action-label {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
}

.action-item:hover .action-label,
.action-item.checked .action-label {
    color: var(--vscode-activityBar-foreground);
}

/* 选中指示条：左侧 2px、全高（activityaction.css 的 .active-item-indicator） */
.action-item.checked::before {
    content: "";
    position: absolute;
    z-index: 1;
    top: 0;
    left: 0;
    height: 100%;
    width: 0;
    border-left: 2px solid var(--vscode-activityBar-activeBorder);
}
</style>
