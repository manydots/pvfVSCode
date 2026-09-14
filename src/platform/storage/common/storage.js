// 存储服务的平台层（对齐 <vscode>/src/vs/platform/storage/common/storage.ts，只保留裁剪客户端用到的子集）。
//
// 迁入的部分与出处：
//   1. 作用域 / 目标两个枚举            —— storage.ts:228-249、:252-263；
//   2. 目标映射表（哪些键是「用户级」、哪些是「机器级」）与数据存在同一份文档里
//                                       —— storage.ts:313-324 loadKeyTargets、:535-553 updateKeyTarget；
//   3. 取值编码与「重复值不写」          —— base/parts/storage/common/storage.ts:264-292
//      （object/array → JSON.stringify，其余 String(value)，undefined / null 视为删除）；
//      写入先只进内存 + 待写集合，flush 时才落盘（同文件 :283-292 的 pendingInserts 语义）。
//   4. flush 的顺序：**先** fire onWillSaveState 再落盘 —— storage.ts:614-641。
//      这个顺序不能反：布局要靠该事件在写盘前把最新部件尺寸采样进状态模型
//      （workbench/browser/layout.ts:1721-1744 先 setInitializationValue 再 save），
//      颠倒会丢掉刷新前最后一次拖拽。
//
// 未迁入：optimize / switch / log / onDidChangeValue / onDidChangeTarget / isNew /
// 跨窗口广播（BroadcastDataChannel）—— 本仓库布局状态用不到。
//
// 本基类只存内存，等价于权威的 InMemoryStorageService（storage.ts:739 起）；
// 浏览器落盘由 platform/storage/browser/storageService.js 覆盖 readDocument / writeDocument 实现。

export const StorageScope = Object.freeze({
    APPLICATION_SHARED: -2,
    APPLICATION: -1,
    PROFILE: 0,
    WORKSPACE: 1
});

export const StorageTarget = Object.freeze({
    USER: 0,
    MACHINE: 1
});

export const WillSaveStateReason = Object.freeze({
    NONE: 0,
    SHUTDOWN: 1
});

// storage.ts:16-17
export const TARGET_KEY = "__$__targetStorageMarker";

export const STORAGE_SCOPES = Object.freeze([StorageScope.APPLICATION_SHARED, StorageScope.APPLICATION, StorageScope.PROFILE, StorageScope.WORKSPACE]);

export class AbstractStorageService {
    // 对齐 storage.ts:330；浏览器实现覆盖为 5s（workbench/services/storage/browser/storageService.ts:20）
    static DEFAULT_FLUSH_INTERVAL = 60 * 1000;

    constructor({ flushInterval = AbstractStorageService.DEFAULT_FLUSH_INTERVAL } = {}) {
        this._flushInterval = flushInterval;
        this._documents = new Map(); // 文档 id → { items: Map<key, string>, targets }
        this._dirtyDocuments = new Set();
        this._willSaveStateListeners = new Set();
        this._flushTimer = null;
    }

    // 对齐 BrowserStorageService.initialize（workbench/services/storage/browser/storageService.ts:74-83）：
    // 预读各作用域，并安排周期性落盘。周期性落盘的理由见 storage.ts:390-398 ——
    // 浏览器没有可靠的长卸载时序，只能定期把状态写下去，降低崩溃/重启丢状态的概率。
    initialize() {
        for (const scope of STORAGE_SCOPES) this.itemsFor(scope);
        this.scheduleFlush();
        return this;
    }

    get(key, scope, fallbackValue) {
        const value = this.itemsFor(scope).get(key);
        return value === undefined ? fallbackValue : value;
    }

    store(key, value, scope, target) {
        if (value === undefined || value === null) return this.remove(key, scope);

        // 编码对齐 base/parts/storage/common/storage.ts:275
        const encoded = typeof value === "object" ? JSON.stringify(value) : String(value);
        const items = this.itemsFor(scope);
        if (items.get(key) === encoded) return; // 重复值不写、不落盘（:278-281）

        items.set(key, encoded);
        this._dirtyDocuments.add(this.documentIdFor(scope));
        if (target !== undefined) this.updateKeyTarget(key, scope, target);
    }

    remove(key, scope) {
        const items = this.itemsFor(scope);
        if (!items.delete(key)) return;
        this.updateKeyTarget(key, scope, undefined);
        this._dirtyDocuments.add(this.documentIdFor(scope));
    }

    // 监听方在落盘前补齐要写入的数据；返回取消订阅函数。
    onWillSaveState(listener) {
        this._willSaveStateListeners.add(listener);
        return () => this._willSaveStateListeners.delete(listener);
    }

    flush(reason = WillSaveStateReason.NONE) {
        // 顺序对齐 storage.ts:614-617：先让监听方写数据，再统一落盘。
        for (const listener of this._willSaveStateListeners) listener({ reason });
        this.persistDirtyDocuments();
    }

    // 对齐 web.main.ts:610 —— 工作台关闭（onWillShutdown）时 flush(SHUTDOWN)。
    close() {
        this.flush(WillSaveStateReason.SHUTDOWN);
    }

    dispose() {
        if (this._flushTimer) clearInterval(this._flushTimer);
        this._flushTimer = null;
    }

    // ------- 子类扩展点：作用域 → 落盘文档 id，以及文档的读写 -------

    // 本基类（等价 InMemoryStorageService）按作用域各自一份内存文档。
    documentIdFor(scope) {
        return String(scope);
    }

    readDocument(documentId) {
        return undefined;
    }

    writeDocument(documentId, document) {}

    // ------- 内部 -------

    scheduleFlush() {
        if (this._flushTimer || !this._flushInterval) return;
        this._flushTimer = setInterval(() => this.flush(WillSaveStateReason.NONE), this._flushInterval);
    }

    itemsFor(scope) {
        return this.documentFor(this.documentIdFor(scope)).items;
    }

    targetsFor(scope) {
        return this.documentFor(this.documentIdFor(scope)).targets;
    }

    documentFor(documentId) {
        let document = this._documents.get(documentId);
        if (!document) {
            const items = new Map(Object.entries(this.readDocument(documentId) ?? {}));
            document = { items, targets: loadKeyTargets(items) };
            this._documents.set(documentId, document);
        }
        return document;
    }

    // 对齐 storage.ts:535-553：目标与数据存在同一份文档里（键为 TARGET_KEY）。
    updateKeyTarget(key, scope, target) {
        const targets = this.targetsFor(scope);
        const current = targets[key];
        if (target === undefined ? typeof current !== "number" : current === target) return;

        if (target === undefined) delete targets[key];
        else targets[key] = target;

        this.itemsFor(scope).set(TARGET_KEY, JSON.stringify(targets));
        this._dirtyDocuments.add(this.documentIdFor(scope));
    }

    persistDirtyDocuments() {
        for (const documentId of this._dirtyDocuments) {
            this.writeDocument(documentId, Object.fromEntries(this.documentFor(documentId).items));
        }
        this._dirtyDocuments.clear();
    }
}

// 对齐 storage.ts:313-324：目标映射表是文档里的一个普通条目，损坏时按空表处理。
function loadKeyTargets(items) {
    const raw = items.get(TARGET_KEY);
    if (raw) {
        try {
            return JSON.parse(raw);
        } catch {
            // 容错：解析失败按空表处理（storage.ts:318-320）
        }
    }
    return Object.create(null);
}
