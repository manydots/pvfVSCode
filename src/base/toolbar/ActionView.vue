<script setup>
// 单个工具栏动作视图（对齐 VS Code base/browser/ui/actionbar/actionViewItems.ts 的 ActionViewItem）：
// 渲染图标按钮（无图标时退回文字），支持禁用、勾选、快捷键提示与子菜单指示。
// 菜单类动作（工具栏「…」溢出、子菜单本体）不在本组件渲染 —— 那属于菜单 widget，
// 见 src/base/menu/MenuPanel.vue（对齐 menu.ts）。
import { computed } from "vue";
import WorkbenchIcon from "@/components/WorkbenchIcon.vue";

const props = defineProps({
    action: { type: Object, required: true }
});
const emit = defineEmits(["execute"]);

const title = computed(() => {
    const action = props.action;
    return action.keybinding ? `${action.tooltip} (${action.keybinding})` : action.tooltip;
});

const showIcon = computed(() => !!props.action.icon);
const showLabel = computed(() => !props.action.icon);

function onClick(event) {
    if (!props.action.enabled) return;
    emit("execute", event);
}
</script>

<template>
    <button type="button" class="action-view" :class="{ disabled: !action.enabled, checked: action.checked }" :title="title" :aria-pressed="action.checked ? 'true' : undefined" @click="onClick">
        <WorkbenchIcon v-if="showIcon" :name="action.icon" :size="16" class="action-icon" />
        <span v-if="showLabel" class="action-label">{{ action.label }}</span>
        <WorkbenchIcon v-if="action.submenu" name="chevron" :size="12" class="action-chevron" />
    </button>
</template>

<style scoped>
.action-view {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 22px;
    padding: 3px;
    border: none;
    border-radius: var(--vscode-cornerRadius-medium);
    background: transparent;
    color: inherit;
    font-size: 12px;
    cursor: default;
}

.action-view:hover:not(.disabled) {
    background: var(--vscode-toolbar-hoverBackground);
}

.action-view.checked {
    background: var(--vscode-actionBar-toggledBackground);
}

.action-view.disabled {
    color: var(--vscode-disabledForeground);
    opacity: 0.6;
}

.action-icon {
    flex: 0 0 auto;
}

.action-label {
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.action-chevron {
    flex: 0 0 auto;
    opacity: 0.7;
}
</style>
