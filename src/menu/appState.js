// 客户端视图状态（响应式）：菜单命令与界面组件共享。
import { reactive } from "vue";

export const appState = reactive({
    sidebarVisible: true,
    // 侧栏宽度（对齐 sidebarPart.ts:56-69：preferredWidth = max(optimalWidth, 300)，
    // 之后由 grid/sash 拖拽改写。本仓库存在 appState，拖拽与双击复位见 components/Sidebar.vue）
    sidebarWidth: 300,
    // 注意：`editor.wordWrap` / `editor.minimap.enabled` 不在此处 —— 它们是配置项，
    // 由配置服务承载（对齐 VS Code：缩略图是配置、自动换行是按模型的临时覆盖，
    // 见 workbench/contrib/codeEditor/browser/toggleMinimap.ts 与 toggleWordWrap.ts）。
    statusText: "就绪",
    title: "pvfVSCode",
    // 命令中心是否可见（对齐 VS Code window.commandCenter，默认 true：workbench.contribution.ts:902-908；
    // 可见性判定见 titlebar/titlebarPart.ts:898 的 isCommandCenterVisible）。
    // 本仓库没有标题栏右键菜单，「样式 > 命令中心」开关因此无人改写该值（偏差见 docs/vscode-reference.md 第 5 节）。
    commandCenter: true,
    activeViewContainerId: "workbench.view.explorer",
    // 底部面板（对齐 VS Code layout.ts 的 panel.hidden / panel.size / panel.maximized 状态）
    panelVisible: false,
    panelHeight: 300,
    panelMaximized: false,
    activePanelId: "workbench.panel.markers",
    panelFocused: false,
    // 状态栏（对齐 VS Code layout.ts 的 statusBar.hidden / workbench.statusBar.visible）
    statusBarVisible: true,
    statusBarFocused: false,
    // 编辑器面包屑的聚焦 / 选中项下标（-1 表示无）：
    // 对齐 breadcrumbsWidget.ts 的 _focusedItemIdx / _selectedItemIdx（:219、:293），
    // 由命令（breadcrumbs.focus*）与组件共享，见 workbench/contrib/editor/EditorBreadcrumbs.vue。
    breadcrumbsFocusedIndex: -1,
    breadcrumbsSelectedIndex: -1
});

let _statusTimer = null;
export function setStatus(text, timeout = 4000) {
    appState.statusText = text;
    if (_statusTimer) clearTimeout(_statusTimer);
    if (timeout) {
        _statusTimer = setTimeout(() => {
            appState.statusText = "就绪";
            _statusTimer = null;
        }, timeout);
    }
}
