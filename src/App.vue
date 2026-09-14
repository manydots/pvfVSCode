<script setup>
// 工作台外壳（对齐 VS Code workbench/browser/layout.ts 的部件编排）：
//   标题栏 / 主体（活动栏 + 侧栏 + 主区[编辑器 + 面板]）/ 状态栏。
// 编辑器与面板部件各自负责所辖 Registry 的渲染，外壳只做布局与上下文键同步。
import { watch } from "vue";
import TitleBar from "@/components/TitleBar.vue";
import ActivityBar from "@/components/ActivityBar.vue";
import Sidebar from "@/components/Sidebar.vue";
import EditorPart from "@/workbench/contrib/editor/EditorPart.vue";
import PanelPart from "@/workbench/contrib/panel/PanelPart.vue";
import StatusBarPart from "@/workbench/contrib/statusbar/StatusBarPart.vue";
import QuickInputWidget from "@/base/quickinput/QuickInputWidget.vue";
import BreadcrumbsPicker from "@/workbench/contrib/editor/BreadcrumbsPicker.vue";
import { appState } from "@/menu/appState.js";
import { contextKeys } from "@/menu/contextKey.js";
import { initLayoutState } from "@/workbench/browser/layout.js";

// 布局状态（侧栏显隐/宽度、面板显隐/高度、面板最大化、状态栏显隐）持久化：
// 必须在下面的上下文键同步之前执行 —— 恢复出来的值要参与首次上下文键同步。
initLayoutState();

// 视图状态变化时同步上下文键，使菜单勾选态、面板/状态栏显隐与界面一致。
// 自动换行 / 缩略图不在此列：前者由编辑器部件刷新 editorWordWrap 等键，
// 后者是 config.editor.minimap.enabled 的派生键（配置服务变更时自动失效并通知）。
watch(
    () => [appState.sidebarVisible, appState.activeViewContainerId, appState.panelVisible, appState.panelMaximized, appState.activePanelId, appState.statusBarVisible],
    ([sidebarVisible, activeViewContainerId, panelVisible, panelMaximized, activePanelId, statusBarVisible]) => {
        contextKeys.set("sidebarVisible", sidebarVisible);
        contextKeys.set("activeViewContainer", activeViewContainerId);
        contextKeys.set("panelVisible", panelVisible);
        contextKeys.set("panelMaximized", panelMaximized);
        contextKeys.set("activePanel", activePanelId);
        contextKeys.set("statusBarVisible", statusBarVisible);
    },
    { immediate: true }
);
</script>

<template>
    <div class="workbench">
        <TitleBar />

        <div class="body">
            <ActivityBar />
            <Sidebar />

            <main class="editor-area">
                <EditorPart />
                <PanelPart />
            </main>
        </div>

        <StatusBarPart />

        <!-- 快速输入浮层：常驻 DOM、按状态显隐（对齐 quickInputController.ts:164-166 的
             `.quick-input-widget` 由 controller 创建并 display 切换） -->
        <QuickInputWidget />

        <!-- 面包屑选择器浮层：由上下文视图服务承担同一份 DOM（contextview.ts 的 `.context-view`），
             本仓库由该组件渲染（偏差登记在 docs/vscode-reference.md 第 5 节） -->
        <BreadcrumbsPicker />
    </div>
</template>

<style scoped>
.workbench {
    display: flex;
    flex-direction: column;
    height: 100%;
    /* 快速输入浮层的包含块：权威相对主容器（窗口）定位，见 workbench/browser/layout.ts 的
       activeContainerDimension / quickPickTop。 */
    position: relative;
}

.body {
    flex: 1 1 auto;
    display: flex;
    min-height: 0;
}

/* 主区：编辑器在上、面板在下（对齐 VS Code grid 的单列布局） */
.editor-area {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: var(--vscode-editor-background);
}
</style>
