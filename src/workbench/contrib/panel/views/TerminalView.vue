<script setup>
// 终端面板视图（对齐 VS Code workbench/contrib/terminal 的 TerminalView 外观）。
// 终端服务（pty）尚未接入，此处渲染只读的提示行与说明，占位终端内容区。
</script>

<template>
    <div class="terminal-view">
        <div class="terminal-body">
            <div class="terminal-line">
                <span class="terminal-prompt">pvfVSCode</span>
                <span class="terminal-cwd">工作区</span>
                <span class="terminal-caret">%</span>
            </div>
            <p class="terminal-hint">终端进程尚未接入：终端服务可用后，此处启动交互式 shell 会话。</p>
        </div>
    </div>
</template>

<style scoped>
.terminal-view {
    height: 100%;
    background: var(--vscode-panel-background);
}

.terminal-body {
    height: 100%;
    padding: 4px 8px;
    overflow: auto;
    font-family: Menlo, Monaco, "Courier New", monospace;
    font-size: 13px;
    line-height: 1.4;
    color: var(--vscode-editor-foreground);
}

.terminal-line + .terminal-line {
    margin-top: 2px;
}

.terminal-prompt {
    color: var(--vscode-editor-foreground);
}

.terminal-cwd {
    margin-left: 6px;
    color: var(--vscode-descriptionForeground);
}

.terminal-caret {
    margin-left: 6px;
}

.terminal-hint {
    margin: 4px 0 0;
    color: var(--vscode-descriptionForeground);
}
</style>
