// 布局状态模型（对齐 <vscode>/src/vs/workbench/browser/layout.ts:2829-3245 的
// WorkbenchLayoutStateKey / RuntimeStateKey / InitializationStateKey / LayoutStateKeys / LayoutStateModel）。
//
// 只迁入本仓库存在对应部件的键；权威里 zenMode、辅助栏、活动栏、聚焦编辑器布局等键本仓库没有对应部件，
// 未迁入（面板位置 panel.position / 对齐 panel.alignment 也没有对应 UI，本仓库面板恒在底部居中）。
//
// 两类键的区别（layout.ts:2847-2858）：
//   - RuntimeStateKey：运行期状态，改动即进状态缓存；PROFILE 作用域的会在 setRuntimeValue 里立即写回存储
//     （layout.ts:3195-3205），WORKSPACE 作用域的等 will-save（见下）；
//   - InitializationStateKey：只在 will-save 时采样写回（layout.ts:1721-1735 采样部件实际尺寸）。

import { StorageScope, StorageTarget } from "@/platform/storage/common/storage.js";

// 对齐 LayoutStateModel.STORAGE_PREFIX（layout.ts:2941）：存储里的键名 = 前缀 + 键名，
// 例如 `workbench.sideBar.hidden`。
export const STORAGE_PREFIX = "workbench.";

class WorkbenchLayoutStateKey {
    constructor(name, scope, target, defaultValue) {
        this.name = name;
        this.scope = scope;
        this.target = target;
        this.defaultValue = defaultValue;
    }
}

class RuntimeStateKey extends WorkbenchLayoutStateKey {
    constructor(name, scope, target, defaultValue, zenModeIgnore) {
        super(name, scope, target, defaultValue);
        this.runtime = true;
        // 禅模式下不写回的键（layout.ts:2851）；本仓库还没有禅模式，先按权威声明如实登记，取值暂不起作用。
        this.zenModeIgnore = zenModeIgnore;
    }
}

class InitializationStateKey extends WorkbenchLayoutStateKey {
    constructor(name, scope, target, defaultValue) {
        super(name, scope, target, defaultValue);
        this.runtime = false;
    }
}

// 取值逐条对齐 layout.ts:2878-2909（名称 / 作用域 / 目标 / 默认值）；
// 本仓库 appState 的初值与这些默认值一致：侧栏可见、面板隐藏、状态栏可见、面板未最大化、尺寸 300。
export const LayoutStateKeys = Object.freeze({
    // 部件尺寸
    SIDEBAR_SIZE: new InitializationStateKey("sideBar.size", StorageScope.PROFILE, StorageTarget.MACHINE, 300),
    PANEL_SIZE: new InitializationStateKey("panel.size", StorageScope.PROFILE, StorageTarget.MACHINE, 300),

    // 部件状态
    PANEL_WAS_LAST_MAXIMIZED: new RuntimeStateKey("panel.wasLastMaximized", StorageScope.WORKSPACE, StorageTarget.MACHINE, false),

    // 部件显隐
    SIDEBAR_HIDDEN: new RuntimeStateKey("sideBar.hidden", StorageScope.WORKSPACE, StorageTarget.MACHINE, false),
    PANEL_HIDDEN: new RuntimeStateKey("panel.hidden", StorageScope.WORKSPACE, StorageTarget.MACHINE, true),
    STATUSBAR_HIDDEN: new RuntimeStateKey("statusBar.hidden", StorageScope.WORKSPACE, StorageTarget.MACHINE, false, true)
});

export class LayoutStateModel {
    constructor(storageService) {
        this._storageService = storageService;
        this._stateCache = new Map();
    }

    // 对齐 LayoutStateModel.load（layout.ts:3002-3078）：
    // 先算动态默认值，再读存储，最后给未存过的键填默认值。
    load({ mainContainerWidth, mainContainerHeight }) {
        // 动态默认值：侧栏宽取 min(300, 容器宽 / 4)（layout.ts:3026）；
        // 面板高按面板位置取值，底部（水平）时取 容器高 / 3（layout.ts:3066 的 PANEL_POSITION.defaultValue 分支）。
        LayoutStateKeys.SIDEBAR_SIZE.defaultValue = Math.min(300, mainContainerWidth / 4);
        LayoutStateKeys.PANEL_SIZE.defaultValue = mainContainerHeight / 3;

        for (const key of Object.values(LayoutStateKeys)) {
            const stored = this.loadKeyFromStorage(key);
            if (stored !== undefined) this._stateCache.set(key.name, stored);
        }
        for (const key of Object.values(LayoutStateKeys)) {
            if (this._stateCache.get(key.name) === undefined) this._stateCache.set(key.name, key.defaultValue);
        }
    }

    getInitializationValue(key) {
        return this._stateCache.get(key.name);
    }

    setInitializationValue(key, value) {
        this._stateCache.set(key.name, value);
    }

    getRuntimeValue(key) {
        return this._stateCache.get(key.name);
    }

    setRuntimeValue(key, value) {
        this._stateCache.set(key.name, value);

        // 对齐 layout.ts:3195-3205：PROFILE 作用域的运行时键立即写回存储；
        // 其余（WORKSPACE 作用域）等 will-save 时由 save 统一写。
        if (key.scope === StorageScope.PROFILE) this.saveKeyToStorage(key);
    }

    // 对齐 LayoutStateModel.save（layout.ts:3151-3167）：按作用域决定写哪些键。
    save(workspace, global) {
        for (const key of Object.values(LayoutStateKeys)) {
            if ((workspace && key.scope === StorageScope.WORKSPACE) || (global && key.scope === StorageScope.PROFILE)) {
                this.saveKeyToStorage(key);
            }
        }
    }

    // 对齐 layout.ts:3226-3229
    saveKeyToStorage(key) {
        const value = this._stateCache.get(key.name);
        this._storageService.store(`${STORAGE_PREFIX}${key.name}`, typeof value === "object" ? JSON.stringify(value) : value, key.scope, key.target);
    }

    // 对齐 layout.ts:3231-3244：按默认值的类型解码（boolean 只有 'true' 为真、number 走 parseInt、object 走 JSON）。
    loadKeyFromStorage(key) {
        const value = this._storageService.get(`${STORAGE_PREFIX}${key.name}`, key.scope);
        if (value === undefined) return undefined;

        switch (typeof key.defaultValue) {
            case "boolean":
                return value === "true";
            case "number":
                return parseInt(value);
            case "object":
                return JSON.parse(value);
            default:
                return value;
        }
    }
}
