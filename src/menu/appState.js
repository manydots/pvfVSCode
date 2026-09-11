// 客户端视图状态（响应式）：菜单命令与界面组件共享。
import { reactive } from "vue";

export const appState = reactive({
    sidebarVisible: true,
    // 侧栏宽度（对齐 sidebarPart.ts:56-69：preferredWidth = max(optimalWidth, 300)，
    // 之后由 grid/sash 拖拽改写。本仓库存在 appState，拖拽与双击复位见 components/Sidebar.vue）
    sidebarWidth: 300,
    wordWrap: false,
    minimap: true,
    statusText: "就绪",
    title: "pvfVSCode",
    activeViewContainerId: "workbench.view.explorer",
    // 底部面板（对齐 VS Code layout.ts 的 panel.hidden / panel.size / panel.maximized 状态）
    panelVisible: false,
    panelHeight: 300,
    panelMaximized: false,
    activePanelId: "workbench.panel.markers",
    panelFocused: false,
    // 状态栏（对齐 VS Code layout.ts 的 statusBar.hidden / workbench.statusBar.visible）
    statusBarVisible: true,
    statusBarFocused: false
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
