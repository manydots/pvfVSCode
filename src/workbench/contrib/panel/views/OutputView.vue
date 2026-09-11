<script setup>
// 输出面板视图（对齐 VS Code workbench/contrib/output 的 OutputView）：
// 顶部为输出通道下拉框，下面为只读输出区。通道接入前输出区为空。
import { ref } from "vue";

const channel = ref("tasks");
const channels = [
    { id: "tasks", label: "任务" },
    { id: "pvf", label: "PVF 归档" }
];
</script>

<template>
    <div class="output-view">
        <div class="output-header">
            <select v-model="channel" class="channel-select" aria-label="输出通道">
                <option v-for="item in channels" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>
        </div>
        <div class="output-body">
            <p class="output-empty">当前通道暂无输出。</p>
        </div>
    </div>
</template>

<style scoped>
.output-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--vscode-panel-background);
}

/* .pane-header：输出通道选择器（对齐 outputView 的 .monaco-select-box 位置） */
.output-header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    padding: 4px 8px;
}

.channel-select {
    width: 240px;
    height: 22px;
    padding: 0 4px;
    border: 1px solid var(--vscode-dropdown-border);
    border-radius: 2px;
    background: var(--vscode-dropdown-background);
    color: var(--vscode-dropdown-foreground);
    font-family: inherit;
    font-size: 13px;
}

.channel-select:focus {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
}

.output-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: 0 8px;
}

.output-empty {
    margin: 0;
    color: var(--vscode-descriptionForeground);
    font-size: 13px;
}
</style>
