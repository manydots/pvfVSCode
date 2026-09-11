<script setup>
// 视图空状态（对齐 VS Code 各视图的空状态渲染，例如 MarkersView 的
// "尚未在工作区中检测到问题"、PortsView 的 "未转发任何端口"、
// SCMViewPane 无仓库时的 "尚未打开文件夹"）。
// 面板与侧栏的特性视图共用此组件，避免各自维护一份空状态样式。
import Codicon from "@/components/Codicon.vue";

defineProps({
    icon: { type: String, default: "info" },
    message: { type: String, required: true },
    hint: { type: String, default: "" }
});
</script>

<template>
    <div class="empty-view">
        <Codicon :name="icon" :size="16" class="empty-view-icon" />
        <p class="empty-view-message">{{ message }}</p>
        <p v-if="hint" class="empty-view-hint">{{ hint }}</p>
    </div>
</template>

<style scoped>
.empty-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100%;
    padding: 16px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}

.empty-view-icon {
    opacity: 0.6;
}

.empty-view-message {
    margin: 0;
    font-size: 13px;
}

.empty-view-hint {
    margin: 0;
    font-size: 12px;
    opacity: 0.8;
}
</style>
