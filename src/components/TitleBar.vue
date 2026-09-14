<script setup>
// 标题栏部件（对齐 VS Code workbench/browser/parts/titlebar/titlebarPart.ts 与 media/titlebarpart.css）：
//   header.titlebar > div.titlebar-container(.has-center)
//     > div.titlebar-left   （菜单栏）  | div.titlebar-center > div.window-title（标题文本或命令中心）
//     | div.titlebar-right  （右侧动作工具栏）
// 三分栏结构与 .has-center 的比例取值见 titlebarpart.css:75-119，命令中心替换标题文本见
// titlebarPart.ts:611-636（可见时 reset(this.title, commandCenter.element)，否则写 titleContent）。
import { computed } from "vue";
import MenuBar from "@/components/MenuBar.vue";
import MenuToolbar from "@/components/MenuToolbar.vue";
import CommandCenter from "@/workbench/contrib/titlebar/CommandCenter.vue";
import { MenuId } from "@/menu/menuId.js";
import { appState } from "@/menu/appState.js";
import { getActiveEditorInput } from "@/workbench/contrib/editor/editorGroupService.js";

// 窗口标题展示当前激活编辑器名称（对齐 VS Code 标题栏的编辑器标题）。
const activeEditor = computed(() => getActiveEditorInput());

// 命令中心可见性：`!isCompact && config.window.commandCenter !== false`（titlebarPart.ts:898）。
// 本仓库没有 compact 标题栏形态（那是辅助窗口/agents 窗口的形态），故只留配置项这一半。
const commandCenterVisible = computed(() => appState.commandCenter !== false);

// 标题文本 = 命令中心不可见时窗口标题该显示的内容（titlebarPart.ts:613-620）。
const titleText = computed(() => (activeEditor.value ? `${appState.title} — ${activeEditor.value.name}` : appState.title));

// `has-center` 决定中间容器是否参与三等分：`isCommandCenterVisible || title.textContent !== ''`（titlebarPart.ts:980）。
// 本仓库标题文本恒非空，故该容器始终存在（命令中心可见时它承载命令中心）。
const hasCenter = computed(() => commandCenterVisible.value || titleText.value !== "");
</script>

<template>
    <header class="titlebar">
        <div class="titlebar-container" :class="{ 'has-center': hasCenter }">
            <div class="titlebar-left">
                <MenuBar />
            </div>
            <div class="titlebar-center">
                <div class="window-title">
                    <CommandCenter v-if="commandCenterVisible" />
                    <template v-else>{{ titleText }}</template>
                </div>
            </div>
            <div class="titlebar-right">
                <!-- 锚点右对齐：anchorAlignmentProvider: () => AnchorAlignment.RIGHT（titlebarPart.ts:694） -->
                <MenuToolbar :menu-id="MenuId.TitleBar" :anchor-alignment="'right'" aria-label="标题操作" />
            </div>
        </div>
    </header>
</template>

<style scoped>
/* titlebarpart.css:6-11（.part.titlebar）：flex 行 + shadow-md；高度取 titleBar 高度 token
   （titlebarPart.ts:235-236：命令中心可见时为 DEFAULT_CUSTOM_TITLEBAR_HEIGHT = 35，
   见 platform/window/common/window.ts:333），底部分隔线见 titlebarPart.ts:updateStyles 的 titleBorder。 */
.titlebar {
    display: flex;
    flex-direction: row;
    height: var(--vscode-titleBar-height);
    flex: 0 0 auto;
    background: var(--vscode-titleBar-activeBackground);
    color: var(--vscode-titleBar-activeForeground);
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-titleBar-border);
    box-shadow: var(--vscode-shadow-md);
}

/* titlebarpart.css:13-27（.titlebar-container） */
.titlebar-container {
    box-sizing: border-box;
    overflow: hidden;
    flex-shrink: 1;
    flex-grow: 1;
    align-items: center;
    display: flex;
    height: 100%;
    width: 100%;
    user-select: none;
    -webkit-user-select: none;
    /* titlebarpart.css:36-46：web / windows / linux 的容器为 line-height 22px + justify-content: left
       （mac 为 space-between；本仓库无 mac 原生标题栏形态）。行高同时决定菜单栏下拉的锚点底边。 */
    line-height: 22px;
    justify-content: left;
}

/* titlebarpart.css:75-80（left / center / right 三个容器） */
.titlebar-left,
.titlebar-center,
.titlebar-right {
    display: flex;
    height: 100%;
    align-items: center;
}

/* titlebarpart.css:82-105（.has-center 下的三等分：20% / 60% / 20%，中间受 fit-content 限制，
   富余空间按 flex-grow: 2 回流给左右两侧） */
.titlebar-container.has-center > .titlebar-left {
    order: 0;
    width: 20%;
    flex-grow: 2;
    justify-content: flex-start;
}

.titlebar-container.has-center > .titlebar-center {
    order: 1;
    width: 60%;
    max-width: fit-content;
    min-width: 0px;
    margin: 0 10px;
    justify-content: center;
}

.titlebar-container.has-center > .titlebar-right {
    order: 2;
    width: 20%;
    min-width: min-content;
    flex-grow: 2;
    justify-content: flex-end;
}

/* titlebarpart.css:107-122（.window-title）：标题文本与命令中心共同的宿主 */
.window-title {
    flex: 0 1 auto;
    font-size: 12px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    margin-left: auto;
    margin-right: auto;
    cursor: default;
}

/* titlebarpart.css:135-139：标题栏内所有工具栏的条目间距（命令中心的嵌套工具栏同样是 .monaco-toolbar，
   与权威一样一并命中） */
.titlebar-container .monaco-toolbar .actions-container {
    gap: 4px;
}

/* 标题栏动作工具栏（MenuId.TitleBar 的宿主）：对齐 titlebar/media/titlebarpart.css:431-440 的
   .action-toolbar-container { padding-right: 4px } —— 右侧留白来自该容器，而不是标题栏本身。
   MenuToolbar 的根元素会带上本组件的 scoped 属性，故可在此按标题栏子元素限定。 */
.titlebar-right > .menu-toolbar {
    padding-right: 4px;
}
</style>
