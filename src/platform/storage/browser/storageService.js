// 浏览器存储实现（对齐 <vscode>/src/vs/workbench/services/storage/browser/storageService.ts 的
// BrowserStorageService）。
//
// 权威做法：IndexedDB 按「库」组织，库名 `vscode-web-state-db-<id>`、对象仓储 `ItemTable`
// （storageService.ts:373-374、:393）；默认档案的档案级存储与全局存储共用同一个库
// （:121-133 isProfileUsingDefaultStorage 分支），空白窗口（没有打开任何文件夹）的工作区 id
// 取 `empty-window`（platform/workspace/common/workspace.ts:156、:179）；
// 写入是异步的，故每 5s 定期 flush（:20 BROWSER_DEFAULT_FLUSH_INTERVAL，
// 原因见 platform/storage/common/storage.ts:390-398）。
//
// 本仓库是纯前端裁剪客户端、没有档案与多工作区概念，故降级为 localStorage：
// 每个库里一份 JSON 文档，文档内容就是权威的 ItemTable（键名与 TARGET_KEY 原样保留）。
// 这是 §4.2 第 4 类「权威实现需降级」的偏差，已登记到 docs/vscode-reference.md 第 5 节。

import { AbstractStorageService, StorageScope } from "@/platform/storage/common/storage.js";

export class BrowserStorageService extends AbstractStorageService {
    // 对齐 storageService.ts:20
    static BROWSER_DEFAULT_FLUSH_INTERVAL = 5 * 1000;
    // 对齐 storageService.ts:373
    static STORAGE_DATABASE_PREFIX = "vscode-web-state-db-";

    constructor({ storage, flushInterval = BrowserStorageService.BROWSER_DEFAULT_FLUSH_INTERVAL } = {}) {
        super({ flushInterval });
        // 非浏览器环境（Node 单测）没有 localStorage：退化为纯内存，读写文档为空操作。
        this._storage = storage ?? globalThis.localStorage ?? null;
    }

    // 作用域 → 库 id（对齐 storageService.ts:345、:349、:121-133 与 workspace.ts:156）
    static documentIdForScope(scope) {
        const prefix = BrowserStorageService.STORAGE_DATABASE_PREFIX;
        switch (scope) {
            case StorageScope.APPLICATION:
                return `${prefix}global`;
            case StorageScope.APPLICATION_SHARED:
                return `${prefix}global-shared`;
            case StorageScope.PROFILE:
                // 默认档案与全局存储同库（storageService.ts:121-133）
                return `${prefix}global`;
            case StorageScope.WORKSPACE:
                // 空白窗口的工作区 id（workspace.ts:156 UNKNOWN_EMPTY_WINDOW_WORKSPACE）
                return `${prefix}empty-window`;
            default:
                throw new Error(`未知的存储作用域: ${scope}`);
        }
    }

    initialize() {
        super.initialize();
        // 对齐 web.main.ts:610 —— 工作台关闭时 close()（flush(SHUTDOWN)）；浏览器里对应 beforeunload。
        globalThis.window?.addEventListener("beforeunload", () => this.close());
        return this;
    }

    documentIdFor(scope) {
        return BrowserStorageService.documentIdForScope(scope);
    }

    readDocument(documentId) {
        if (!this._storage) return undefined;
        const raw = this._storage.getItem(documentId);
        if (!raw) return undefined;
        try {
            return JSON.parse(raw);
        } catch {
            // 文档损坏：按「没有存过」处理，让状态模型回落到默认值
            return undefined;
        }
    }

    writeDocument(documentId, document) {
        this._storage?.setItem(documentId, JSON.stringify(document));
    }
}

// 全应用共用一份（本仓库没有 DI 容器，服务以模块单例暴露，与 viewService 等既有服务一致）。
export const storageService = new BrowserStorageService();
