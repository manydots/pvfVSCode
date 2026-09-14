// 部件尺寸约束与夹取。抽成模块是为了让「拖拽时的夹取」与「启动时恢复已存尺寸的夹取」走同一份规则：
// 权威里这两处都由 grid 保证（每个 view 有 minimumSize / maximumSize，见
// workbench/browser/grid.ts 的 GridView 尺寸约束与 layout.ts:1697-1744 的部件尺寸读写），
// 本仓库没有 grid，于是由组件与恢复路径各夹一次，规则必须同源。
//
// 侧栏：最小宽度 170（sidebarPart.ts:48 SidebarPart.minimumWidth）；
// 最大宽度受同排的活动栏 48（activitybarPart.ts:50 ACTIVITYBAR_WIDTH）
// 与编辑器最小宽度 220（workbench/browser/parts/editor/editor.ts:29 DEFAULT_EDITOR_MIN_DIMENSIONS.width）约束
// —— 对应 grid 把整排 view 撑满容器、各 view 不小于自身 minimumSize 的布局规则
// （sidebarPart.ts:49 maximumWidth = Infinity 由 grid 兜底）；
// 双击复位到 preferredWidth = Math.max(getOptimalWidth(), 300)（sidebarPart.ts:56-69），
// 本仓库没有 getOptimalWidth，取该表达式下限 300。
export const SIDEBAR_MIN_WIDTH = 170;
export const SIDEBAR_PREFERRED_WIDTH = 300;
export const ACTIVITY_BAR_WIDTH = 48;
export const EDITOR_MIN_WIDTH = 220;

export function maxSidebarWidth(containerWidth) {
    return Math.max(SIDEBAR_MIN_WIDTH, containerWidth - ACTIVITY_BAR_WIDTH - EDITOR_MIN_WIDTH);
}

// 存储里读回的尺寸可能损坏（loadKeyFromStorage 走 parseInt，损坏值会得到 NaN），
// 此时退回首选值，避免把布局撑坏。
export function clampSidebarWidth(width, containerWidth) {
    if (!Number.isFinite(width)) return SIDEBAR_PREFERRED_WIDTH;
    return Math.min(maxSidebarWidth(containerWidth), Math.max(SIDEBAR_MIN_WIDTH, width));
}

// 面板：最小高度 77（workbench/browser/parts/panel/panelPart.ts:42 minimumHeight = 77）；
// 最大不超过可用高度，本仓库留出标题栏与编辑器标题的高度（与拖拽实现同源）。
export const PANEL_MIN_HEIGHT = 77;
export const PANEL_MAX_RESERVED_HEIGHT = 64;

export function maxPanelHeight(containerHeight) {
    return Math.max(PANEL_MIN_HEIGHT, containerHeight - PANEL_MAX_RESERVED_HEIGHT);
}

export function clampPanelHeight(height, containerHeight) {
    if (!Number.isFinite(height)) return PANEL_MIN_HEIGHT;
    return Math.min(maxPanelHeight(containerHeight), Math.max(PANEL_MIN_HEIGHT, height));
}
