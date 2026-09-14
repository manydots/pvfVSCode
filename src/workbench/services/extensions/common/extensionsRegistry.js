// 扩展点基础设施（对齐
// <vscode>/src/vs/workbench/services/extensions/common/extensionsRegistry.ts:23-159 与 :675-700）。
//
// 作用：扩展清单里的 `contributes.<扩展点>` 声明，在「扫描期」就被翻译成各全局注册表里的条目 ——
// 不需要扩展被激活，也不需要扩展宿主。这是「静态贡献层」的全部机制
// （见 docs/plugin-system-design.md 第 8.1 节）。
//
// 迁入的部分与出处：
//   1. ExtensionMessageCollector（error / warn / info → 带扩展 id 与扩展点名的消息）—— :23-59；
//   2. IExtensionPointUser 与 ExtensionPointUserDelta.compute（按扩展 id 求 added / removed）—— :61-103；
//   3. ExtensionPoint（setHandler / acceptUsers / _handle：未齐备时不触发；handler 抛错不中断）—— :105-159；
//   4. ExtensionsRegistryImpl.registerExtensionPoint：扩展点去重、登记隐式激活事件生成器 —— :675-690；
//      聚合用户并投递到扩展点 —— abstractExtensionService.ts:1232-1239 的 _handleExtensionPoint。
//
// 未迁入（各给出理由）：
//   - JSON schema 注册（权威 :685 把 `contributes.<扩展点>` 的 schema 挂进 Extensions.JSONContribution）：
//     本仓库的扩展清单是仓库内文件、由构建期保证，没有用户侧的清单 IntelliSense/校验场景；
//     接入第三方扩展安装时（M5）再补。
//   - `deps`（扩展点依赖排序，如 grammars 依赖 languages）与 `canHandleResolver`：
//     本仓库暂无相互依赖的扩展点（唯一使用方 languages 不依赖别人），
//     `deps` 在权威里仅用于「先解析依赖点」的顺序保证 —— 无依赖即无差异。
//   - `onlyResolverExtensionPoints` 的增量处理（abstractExtensionService.ts:1150-1169 的
//     affectedExtensionPoints）：那是「只重算受影响的扩展点」的性能优化，不是行为差异。

import { Severity } from "@/base/common/severity.js";
import { ExtensionIdentifierSet } from "@/platform/extensions/common/extensions.js";
import { ImplicitActivationEvents } from "@/platform/extensionManagement/common/implicitActivationEvents.js";

// :23-59
export class ExtensionMessageCollector {
    constructor(messageHandler, extension, extensionPointId) {
        this._messageHandler = messageHandler;
        this._extension = extension;
        this._extensionPointId = extensionPointId;
    }

    _msg(type, message) {
        this._messageHandler({
            type,
            message,
            extensionId: this._extension.identifier,
            extensionPointId: this._extensionPointId
        });
    }

    error(message) {
        this._msg(Severity.Error, message);
    }

    warn(message) {
        this._msg(Severity.Warning, message);
    }

    info(message) {
        this._msg(Severity.Info, message);
    }
}

// :70-103
export class ExtensionPointUserDelta {
    static _toSet(users) {
        const result = new ExtensionIdentifierSet();
        for (const user of users) result.add(user.description.identifier);
        return result;
    }

    static compute(previous, current) {
        if (!previous || !previous.length) {
            return new ExtensionPointUserDelta(current, []);
        }
        if (!current || !current.length) {
            return new ExtensionPointUserDelta([], previous);
        }

        const previousSet = ExtensionPointUserDelta._toSet(previous);
        const currentSet = ExtensionPointUserDelta._toSet(current);

        const added = current.filter(user => !previousSet.has(user.description.identifier));
        const removed = previous.filter(user => !currentSet.has(user.description.identifier));

        return new ExtensionPointUserDelta(added, removed);
    }

    constructor(added, removed) {
        this.added = added;
        this.removed = removed;
    }
}

// :105-159
export class ExtensionPoint {
    constructor(name, defaultExtensionKind, canHandleResolver) {
        this.name = name;
        this.defaultExtensionKind = defaultExtensionKind;
        this.canHandleResolver = canHandleResolver;
        this._handler = null;
        this._users = null;
        this._delta = null;
    }

    setHandler(handler) {
        if (this._handler !== null) {
            throw new Error("Handler already set!");
        }
        this._handler = handler;
        this._handle();

        return {
            dispose: () => {
                this._handler = null;
            }
        };
    }

    acceptUsers(users) {
        this._delta = ExtensionPointUserDelta.compute(this._users, users);
        this._users = users;
        this._handle();
    }

    _handle() {
        if (this._handler === null || this._users === null || this._delta === null) {
            return;
        }
        try {
            this._handler(this._users, this._delta);
        } catch (err) {
            console.error(`Failed to handle extension point '${this.name}'`, err);
        }
    }
}

// :671-700
export class ExtensionsRegistryImpl {
    constructor() {
        this._extensionPoints = new Map();
    }

    registerExtensionPoint(desc) {
        if (this._extensionPoints.has(desc.extensionPoint)) {
            throw new Error("Duplicate extension point: " + desc.extensionPoint);
        }
        const result = new ExtensionPoint(desc.extensionPoint, desc.defaultExtensionKind, desc.canHandleResolver);
        this._extensionPoints.set(desc.extensionPoint, result);
        if (desc.activationEventsGenerator) {
            ImplicitActivationEvents.register(desc.extensionPoint, desc.activationEventsGenerator);
        }
        return result;
    }

    getExtensionPoints() {
        return Array.from(this._extensionPoints.values());
    }

    // 把所有已知扩展描述投递到各扩展点（对齐 abstractExtensionService.ts:1232-1239）。
    // 权威在这里还做了「只重算受影响的扩展点」与消息分级上报；本仓库的扩展在启动时一次装齐，
    // 故整体重算一次即可（扩展装、卸时的增量重算属 M5 的扩展管理服务）。
    setExtensionDescriptions(descriptions) {
        for (const extensionPoint of this._extensionPoints.values()) {
            const users = [];
            for (const description of descriptions) {
                if (description.contributes && Object.prototype.hasOwnProperty.call(description.contributes, extensionPoint.name)) {
                    users.push({
                        description,
                        value: description.contributes[extensionPoint.name],
                        collector: new ExtensionMessageCollector(handleExtensionPointMessage, description, extensionPoint.name)
                    });
                }
            }
            extensionPoint.acceptUsers(users);
        }
    }
}

// 对齐 abstractExtensionService.ts:1188-1229 的消息落点：本仓库没有通知服务与遥测，
// 按级别写入控制台，字符串格式与权威一致（`[<扩展 id>]: <消息>`）。
function handleExtensionPointMessage(msg) {
    const text = `[${msg.extensionId.value}]: ${msg.message}`;
    if (msg.type === Severity.Error) console.error(text);
    else if (msg.type === Severity.Warning) console.warn(text);
    else console.info(text);
}

// 全应用共用一份（与 configurationRegistry / viewsRegistry 一致，模块单例）
export const ExtensionsRegistry = new ExtensionsRegistryImpl();
