// 隐式激活事件（对齐
// <vscode>/src/vs/platform/extensionManagement/common/implicitActivationEvents.ts:14-85）。
//
// 作用：静态贡献点（如 languages）在注册时会顺带登记一个「生成器」，
// 把 `contributes` 里的声明翻译成激活事件（languages 贡献点生成 `onLanguage:<id>`，
// 见 <vscode>/src/vs/workbench/services/language/common/languageService.ts:115-121）。
// 这样扩展不必把 `activationEvents` 写全 —— 声明了 grammar/language 就够了。
//
// 迁入的部分与出处：
//   1. register / readActivationEvents / createActivationEventsMap 与 WeakMap 缓存 —— :19-47；
//   2. `main` 与 `browser` 都缺时返回空 —— :50-52（没有入口的扩展永远不会被激活）；
//   3. `onUri` → `onUri:<扩展 id>` 的特例 —— :56-61；
//   4. 贡献值非数组时包一层再喂给生成器，生成器抛错只上报不中断 —— :74-81。
//
// 未迁入：权威注释里说明该表「只有渲染进程能看到全部生成器」，本仓库只有渲染进程，无差异。

import { ExtensionIdentifier } from "@/platform/extensions/common/extensions.js";

export class ImplicitActivationEventsImpl {
    constructor() {
        this._generators = new Map(); // extensionPointName -> generator
        this._cache = new WeakMap(); // IExtensionDescription -> string[]
    }

    // :19-21
    register(extensionPointName, generator) {
        this._generators.set(extensionPointName, generator);
    }

    // :27-32
    readActivationEvents(extensionDescription) {
        if (!this._cache.has(extensionDescription)) {
            this._cache.set(extensionDescription, this._readActivationEvents(extensionDescription));
        }
        return this._cache.get(extensionDescription);
    }

    // :38-47
    createActivationEventsMap(extensionDescriptions) {
        const result = Object.create(null);
        for (const extensionDescription of extensionDescriptions) {
            const activationEvents = this.readActivationEvents(extensionDescription);
            if (activationEvents.length > 0) {
                result[ExtensionIdentifier.toKey(extensionDescription.identifier)] = activationEvents;
            }
        }
        return result;
    }

    // :49-84
    _readActivationEvents(desc) {
        if (typeof desc.main === "undefined" && typeof desc.browser === "undefined") {
            return [];
        }

        const activationEvents = Array.isArray(desc.activationEvents) ? desc.activationEvents.slice(0) : [];

        for (let i = 0; i < activationEvents.length; i++) {
            if (activationEvents[i] === "onUri") {
                activationEvents[i] = `onUri:${ExtensionIdentifier.toKey(desc.identifier)}`;
            }
        }

        if (!desc.contributes) {
            return activationEvents;
        }

        for (const extensionPointName of Object.keys(desc.contributes)) {
            const generator = this._generators.get(extensionPointName);
            if (!generator) continue;
            const contribution = desc.contributes[extensionPointName];
            const contributions = Array.isArray(contribution) ? contribution : [contribution];
            try {
                activationEvents.push(...generator(contributions));
            } catch (err) {
                console.error(`Failed to generate implicit activation events for '${extensionPointName}'`, err);
            }
        }

        return activationEvents;
    }
}

// 全应用共用一份（与 ConfigurationRegistry / 各 Registry 一致，模块单例）
export const ImplicitActivationEvents = new ImplicitActivationEventsImpl();
