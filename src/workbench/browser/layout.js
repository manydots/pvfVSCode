// 工作台外壳的布局状态绑定（对齐 <vscode>/src/vs/workbench/browser/layout.ts 中布局状态那部分）：
//   启动    —— stateModel.load() 后把值落到 appState（权威里 Layout 构造时 load，部件随后按取到的状态创建）；
//   运行期  —— 部件显隐 / 面板最大化变化写回状态模型（layout.ts:1697-1706 的部件可见性回调、:2096-2162）；
//   will-save —— 先采样部件实际尺寸，再整体落盘（layout.ts:1721-1744，顺序见 platform/storage/common/storage.ts:614-617）；
//   关闭    —— storageService.close()（workbench/browser/web.main.ts:610 的 onWillShutdown）。
//
// 本仓库没有 grid：部件尺寸直接存在 appState（Sidebar.vue / PanelPart.vue 的拖拽改写它），
// 因此 will-save 采样的是 appState 里的尺寸，而不是 grid 的视图尺寸。

import { watch } from "vue";
import { appState } from "@/menu/appState.js";
import { storageService } from "@/platform/storage/browser/storageService.js";
import { LayoutStateKeys, LayoutStateModel } from "@/workbench/browser/layoutStateModel.js";
import { clampPanelHeight, clampSidebarWidth } from "@/workbench/browser/partDimensions.js";

// 在应用外壳（App.vue）里调用一次；必须早于读取这些状态的订阅方，否则订阅方拿到的是默认值。
export function initLayoutState() {
    storageService.initialize();

    const stateModel = new LayoutStateModel(storageService);
    stateModel.load({
        mainContainerWidth: window.innerWidth,
        mainContainerHeight: window.innerHeight
    });

    applyLayoutState(stateModel);
    registerWillSave(stateModel);
    bindLayoutState(stateModel);

    return stateModel;
}

// 把状态模型的值落到 appState（对齐 Layout 按 stateModel 的取值创建各部件）。
// 注意 `panelMaximized` 不在恢复之列：权威启动时并不恢复「面板最大化」，只记住
// PANEL_WAS_LAST_MAXIMIZED，等面板下次被显示时再按它切过去（layout.ts:2155-2158）。
function applyLayoutState(stateModel) {
    appState.sidebarVisible = !stateModel.getRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN);
    appState.sidebarWidth = clampSidebarWidth(stateModel.getInitializationValue(LayoutStateKeys.SIDEBAR_SIZE), window.innerWidth);
    appState.panelVisible = !stateModel.getRuntimeValue(LayoutStateKeys.PANEL_HIDDEN);
    appState.panelHeight = clampPanelHeight(stateModel.getInitializationValue(LayoutStateKeys.PANEL_SIZE), window.innerHeight);
    appState.statusBarVisible = !stateModel.getRuntimeValue(LayoutStateKeys.STATUSBAR_HIDDEN);
}

// 对齐 layout.ts:1721-1744：在 will-save 里把部件当前尺寸采样进初始化键，随后 save(true, true)
// 把 WORKSPACE 与 PROFILE 两个作用域的键一起写下去。
function registerWillSave(stateModel) {
    storageService.onWillSaveState(() => {
        stateModel.setInitializationValue(LayoutStateKeys.SIDEBAR_SIZE, appState.sidebarWidth);
        stateModel.setInitializationValue(LayoutStateKeys.PANEL_SIZE, appState.panelHeight);
        stateModel.save(true, true);
    });
}

function bindLayoutState(stateModel) {
    // 部件显隐：权威在部件可见性变化时调用 setSideBarHidden / setPanelHidden / setStatusBarHidden
    // （layout.ts:1697-1706、:1626-1631），这里按其结果写入状态模型。
    watch(
        () => [appState.sidebarVisible, appState.panelVisible, appState.statusBarVisible],
        ([sidebarVisible, panelVisible, statusBarVisible]) => {
            stateModel.setRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN, !sidebarVisible);
            stateModel.setRuntimeValue(LayoutStateKeys.PANEL_HIDDEN, !panelVisible);
            stateModel.setRuntimeValue(LayoutStateKeys.STATUSBAR_HIDDEN, !statusBarVisible);
        }
    );

    // 面板最大化：PANEL_WAS_LAST_MAXIMIZED 只记「上次是否最大化」，
    // 重新显示面板时按 workbench.panel.opensMaximized 的默认值 'preserve'（= REMEMBER_LAST）恢复
    // （layout.ts:2155-2162、:2279-2288；设置默认值见 workbench/browser/workbench.contribution.ts:607）。
    let panelWasLastMaximized = stateModel.getRuntimeValue(LayoutStateKeys.PANEL_WAS_LAST_MAXIMIZED);
    const setPanelWasLastMaximized = value => {
        panelWasLastMaximized = value;
        stateModel.setRuntimeValue(LayoutStateKeys.PANEL_WAS_LAST_MAXIMIZED, value);
    };

    watch(
        () => [appState.panelVisible, appState.panelMaximized],
        ([panelVisible, panelMaximized], [prevPanelVisible, prevPanelMaximized]) => {
            const maximizedChanged = panelMaximized !== prevPanelMaximized;

            // 用户点「最大化 / 还原面板」：记下新状态（layout.ts:2276 setPanelMaximized 的写法）
            if (maximizedChanged) setPanelWasLastMaximized(panelMaximized);

            if (panelVisible !== prevPanelVisible && !panelVisible) {
                // 隐藏面板：记下隐藏前的最大化状态（layout.ts:2159-2162 取的是取消最大化之前的 isPanelMaximized）
                setPanelWasLastMaximized(panelMaximized);
            } else if (panelVisible !== prevPanelVisible && !maximizedChanged && panelMaximized !== panelWasLastMaximized) {
                // 重新显示面板：与记住的状态不一致就切过去（layout.ts:2155-2158）。
                // 若本次同时显式改了最大化状态（「最大化面板」会连带把面板设为可见），以用户意图为准。
                appState.panelMaximized = panelWasLastMaximized;
            }
        }
    );
}
