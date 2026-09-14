<script setup>
// 标题栏命令中心（对齐 VS Code workbench/browser/parts/titlebar/commandCenterControl.ts）。
//
// DOM 与权威逐层对应（类名取自权威；`.monaco-toolbar` / `.monaco-action-bar` / `.actions-container` /
// `.action-item` 的样式由 monaco-editor 发行的 toolbar.css / actionbar.css 提供，与权威同源）：
//   div.command-center                                                :38-46（CommandCenterControl.element）
//     > div.monaco-toolbar > div.monaco-action-bar > ul.actions-container
//                                                                     :48-62（MenuId.CommandCenter 的 MenuWorkbenchToolBar）
//       > li.action-item.command-center-center                        :113-116（CommandCenterCenterViewItem 的容器）
//         > div.monaco-toolbar > div.monaco-action-bar > ul.actions-container
//                                                                     :135-141（每个分组一个嵌套 WorkbenchToolBar）
//           > li.action-item.command-center-quick-pick                :160-193（CommandCenterQuickPickItem）
//             > span.search-icon（仅非紧凑模式）+ span.search-label
//         > span.codicon.codicon-circle-small-filled                  :243-250（分组之间的 spacer）
//
// 外层工具栏里除中心项以外的动作按普通动作项渲染（权威的 createActionViewItem 分支，:58-60；本仓库当前
// 只注册了中心项，见 commandCenter.contribution.js），子菜单项的分支未实现（登记在 docs/vscode-reference.md 第 5 节）。
import { computed, onBeforeUnmount, ref } from "vue";
import { MenuId } from "@/menu/menuId.js";
import { getMenuActions, resolveMenuItem } from "@/menu/actions.js";
import { contextKeys } from "@/menu/contextKey.js";
import { executeCommand } from "@/menu/commands.js";
import { appState } from "@/menu/appState.js";
import { getActiveEditorInput } from "@/workbench/contrib/editor/editorGroupService.js";
import { getCommandCenterLabel, getCommandCenterTooltip } from "@/workbench/contrib/titlebar/commandCenter.js";
import { quickInput } from "@/platform/quickinput/quickInput.js";
import ActionView from "@/base/toolbar/ActionView.vue";

// 中心框里承担「快速打开」的动作 id（权威 `CommandCenterCenterViewItem._quickOpenCommandId`，:95）。
const QUICK_OPEN_ID = "workbench.action.quickOpenWithModes";

// 紧凑模式（权威 :166-174）：search-icon 只在非紧凑模式下渲染，紧凑时整行左对齐、只留标签。
// 权威判定 `!forcedHidden && (agentsControl === true || undefined || 'compact')`，而
// chat.agentsControl.enabled 的默认值就是 'compact'（chat/browser/chat.shared.contribution.ts:451）；
// 本仓库没有 chat / agents 贡献，该配置读不到值（undefined）同样落进紧凑分支 —— 故恒为紧凑。
// 不引入该设置，只保留权威的两条渲染分支（非紧凑分支由该常量翻转即可启用）。
const isCompactMode = true;

// 上下文键变化时重算动作（可用性、勾选态等）。
const version = ref(0);
const off = contextKeys.onDidChange(() => {
    version.value++;
});
onBeforeUnmount(off);

// —— 外层：MenuId.CommandCenter ——
// 权威给该工具栏设了 primaryGroup: () => true（:51-53），即所有分组都留在主区、不进「…」溢出菜单，
// 故这里直接把分组展平成一条动作列表。
const outerItems = computed(() => {
    void version.value;
    return getMenuActions(MenuId.CommandCenter, contextKeys).flatMap(([, items]) => items);
});

// 中心项 = 子菜单指向 MenuId.CommandCenterCenter 的那一项（权威 actionViewItemProvider 的判定，:56-57）。
const centerItem = computed(() => outerItems.value.find(item => item.submenu?.id === MenuId.CommandCenterCenter.id) ?? null);

const plainActions = computed(() => outerItems.value.filter(item => item !== centerItem.value && !item.submenu).map(item => resolveMenuItem(item, contextKeys)));

// —— 内层：MenuId.CommandCenterCenter，每个分组一个嵌套工具栏 ——
const groups = computed(() => {
    void version.value;
    return getMenuActions(MenuId.CommandCenterCenter, contextKeys).map(([group, items]) => ({
        group,
        actions: items.map(item => resolveMenuItem(item, contextKeys))
    }));
});

// multiple：权威按 `_submenu.actions.length > 1` 定（:116），即内层分组数大于 1 时中心框改左对齐并加内边距。
const multiple = computed(() => groups.value.length > 1);

// 快捷项承载的动作：权威取 id 为 quickOpenWithModes 的动作，找不到时退回该子菜单的首个动作（:109）。
const quickPick = computed(() => {
    const actions = groups.value.flatMap(group => group.actions);
    return actions.find(action => action.commandId === QUICK_OPEN_ID) ?? actions[0] ?? null;
});

// —— 标签与提示 ——
const workspaceName = computed(() => appState.title);
// 窗口标题 = 命令中心不可见时标题栏中间会显示的那串文本（权威取 WindowTitle.value）。
const windowTitle = computed(() => {
    const editor = getActiveEditorInput();
    return editor ? `${appState.title} — ${editor.name}` : appState.title;
});
const label = computed(() => getCommandCenterLabel(workspaceName.value));
const tooltip = computed(() => getCommandCenterTooltip(workspaceName.value, windowTitle.value, quickPick.value?.keybinding ?? ""));

// 中心框自身的点击也执行快速打开：权威的 BaseActionViewItem 在容器上挂 CLICK，其 action 即 quickOpenWithModes
// （:109）；框内条目的点击在权威里被 stopPropagation 吃掉，故内层条目都带 .stop。
function runQuickPick() {
    if (quickPick.value?.enabled && quickPick.value.commandId) executeCommand(quickPick.value.commandId);
}

function runCommand(action) {
    if (action.enabled && action.commandId) executeCommand(action.commandId);
}

// 快速输入显示时隐藏命令中心（对齐 commandCenterControl.ts:64-82 的 _setVisibility）：
// 权威在 quickInputService.onShow 里按 alignment 判定，alignment 的初值为 'top'
// （quickInputService.ts:30），'top' 表示浮层覆盖标题栏，此时给命令中心加 .hide
// （titlebarpart.css:146-148 → visibility: hidden）。本仓库不改变 alignment，故等价于 visible。
const hidden = computed(() => quickInput.visible);
</script>

<template>
    <div class="command-center" :class="{ hide: hidden }">
        <div class="monaco-toolbar">
            <div class="monaco-action-bar">
                <ul class="actions-container" role="toolbar">
                    <li v-for="action in plainActions" :key="action.commandId" class="action-item">
                        <ActionView :action="action" @execute="runCommand(action)" />
                    </li>

                    <li v-if="centerItem" class="action-item command-center-center" :class="{ multiple }" @click="runQuickPick">
                        <template v-for="(group, index) in groups" :key="group.group">
                            <!-- 分组间的 spacer：权威用 renderIcon(Codicon.circleSmallFilled) 并以内联样式定尺寸（:243-250） -->
                            <span v-if="index > 0" class="codicon codicon-circle-small-filled" style="padding: 0 8px; height: 100%; opacity: 0.5" aria-hidden="true"></span>

                            <div class="monaco-toolbar">
                                <div class="monaco-action-bar">
                                    <ul class="actions-container" role="toolbar">
                                        <template v-for="action in group.actions" :key="action.commandId ?? action.label">
                                            <li
                                                v-if="action.commandId === QUICK_OPEN_ID"
                                                class="action-item command-center-quick-pick"
                                                :class="{ 'compact-mode': isCompactMode }"
                                                role="button"
                                                :aria-description="tooltip"
                                                :title="tooltip"
                                                @click.stop="runQuickPick">
                                                <span v-if="!isCompactMode" class="codicon codicon-search search-icon" aria-hidden="true"></span>
                                                <span class="search-label">{{ label }}</span>
                                            </li>
                                            <li v-else class="action-item" @click.stop>
                                                <ActionView :action="action" @execute="runCommand(action)" />
                                            </li>
                                        </template>
                                    </ul>
                                </div>
                            </div>
                        </template>
                    </li>
                </ul>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 取值全部来自 workbench/browser/parts/titlebar/media/titlebarpart.css 的 .command-center 段落（:135-250）。
   权威选择器带 `… > .titlebar-center > .window-title >` 前缀，本仓库由 TitleBar.vue 保证命令中心就渲染在
   .window-title 之内（对齐 titlebarPart.ts:611-636 的 reset(this.title, commandCenter.element)），前缀在此冗余。 */
.command-center {
    /* :141-144（z-index 与 no-drag） */
    z-index: 2500;
    -webkit-app-region: no-drag;
}

/* :146-148：快速输入（alignment 为 'top'）显示时隐藏命令中心，避免浮层压在标题栏上时两边文字重叠 */
.command-center.hide {
    visibility: hidden;
}

/* :154-166：外层工具栏条目的前景色取 titleBar.activeForeground（中心框自身另有 commandCenter.* 覆盖） */
.command-center > .monaco-toolbar > .monaco-action-bar > .actions-container > .action-item > .action-view {
    color: var(--vscode-titleBar-activeForeground);
}

/* :168-181：中心圆角框 */
.command-center .action-item.command-center-center {
    display: flex;
    align-items: stretch;
    color: var(--vscode-commandCenter-foreground);
    background-color: var(--vscode-commandCenter-background);
    border: 1px solid var(--vscode-commandCenter-border);
    overflow: hidden;
    margin: 0 6px;
    border-radius: var(--vscode-cornerRadius-medium);
    height: 22px;
    width: 38vw;
    max-width: 600px;
}

/* :225-228：中心框里有多个动作（多分组）时左对齐并加 12px 内边距 */
.command-center .action-item.command-center-center.multiple {
    justify-content: flex-start;
    padding: 0 12px;
}

/* :234-236：只有命令中心一个动作项（本仓库没有后退 / 前进 / 分享按钮）时左外边距归零 */
.command-center .action-item.command-center-center:only-child {
    margin-left: 0;
}

/* :243-248：hover 态取值 */
.command-center .action-item.command-center-center:hover {
    color: var(--vscode-commandCenter-activeForeground);
    background-color: var(--vscode-commandCenter-activeBackground);
    border-color: var(--vscode-commandCenter-activeBorder);
}

/* :182-188：快捷项 */
.command-center .action-item.command-center-center .action-item.command-center-quick-pick {
    display: flex;
    justify-content: start;
    overflow: hidden;
    margin: auto;
    max-width: 600px;
}

/* :190-195：搜索图标（仅非紧凑模式渲染） */
.command-center .action-item.command-center-center .action-item.command-center-quick-pick .search-icon {
    font-size: 14px;
    opacity: 0.8;
    margin: auto 3px;
    color: var(--vscode-commandCenter-foreground);
}

/* :201-204：标签（单行截断；white-space 继承自 .window-title 的 nowrap） */
.command-center .action-item.command-center-center .action-item.command-center-quick-pick .search-label {
    overflow: hidden;
    text-overflow: ellipsis;
}

/* :206-211：紧凑模式 —— 左对齐、无图标、撑满整行 */
.command-center .action-item.command-center-center .action-item.command-center-quick-pick.compact-mode {
    margin: auto auto auto 0;
    padding-left: 8px;
    flex: 1;
}

/* :213-222：紧凑模式下内层工具栏与列表撑满（:has 选择器与权威一致） */
.command-center .action-item.command-center-center:has(.compact-mode) > .monaco-toolbar {
    flex: 1;
}

.command-center .action-item.command-center-center:has(.compact-mode) > .monaco-toolbar > .monaco-action-bar {
    width: 100%;
}

.command-center .action-item.command-center-center:has(.compact-mode) > .monaco-toolbar > .monaco-action-bar > .actions-container {
    margin: 0;
}
</style>
