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
import { appState } from "@/menu/appState.js";
import { contextKeys } from "@/menu/contextKey.js";

// 视图状态变化时同步上下文键，使菜单勾选态、面板/状态栏显隐与界面一致。
watch(
    () => [
        appState.sidebarVisible,
        appState.wordWrap,
        appState.minimap,
        appState.activeViewContainerId,
        appState.panelVisible,
        appState.panelMaximized,
        appState.activePanelId,
        appState.statusBarVisible
    ],
    ([sidebarVisible, wordWrap, minimap, activeViewContainerId, panelVisible, panelMaximized, activePanelId, statusBarVisible]) => {
        contextKeys.set("sidebarVisible", sidebarVisible);
        contextKeys.set("wordWrapOn", wordWrap);
        contextKeys.set("minimapOn", minimap);
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
    </div>
</template>

<style scoped>
.workbench {
    display: flex;
    flex-direction: column;
    height: 100%;
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
