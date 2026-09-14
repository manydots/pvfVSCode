// `config.*` 前缀上下文键的取值容器
// （对齐 <vscode>/src/vs/platform/contextkey/browser/contextKeyService.ts:104-176 的
// ConfigAwareContextValuesContainer）。
//
// 权威语义（逐条对齐，出处见各处注释）：
//   1. 取值：`config.<settingId>` 直接读配置服务的同名设置（:150-176 的 getValue），
//      值按类型编码 —— number / boolean / string 原样，数组 JSON.stringify，其余原样（:163-174）；
//      读到的值进缓存（TernarySearchTree.forConfigKeys），再次求值不再回读配置；
//   2. 失效：配置变更时只处理 `event.affectedKeys`（:131-148）——
//      `ConfigurationTarget.DEFAULT`（新增/移除配置项）清空整表并对**全部已缓存键**发通知（:123-128）；
//      其余目标按 `config.<key>` 失效「该键及其后代」并只对**已缓存**的键发通知（:134-144）——
//      未缓存的键下次取值时自然回读，不发多余通知；
//   3. 缓存分离：本容器与 ContextKeyService 自身的键值表是两份（权威里是父子容器），
//      外部显式 set 的同名键优先（子容器遮蔽父容器）。
//
// 本仓库的简化：权威的 TernarySearchTree.forConfigKeys 在语义上就是「按 `config.` 前缀 + 段边界
// 组织的前缀树」，此处用「前缀 + `.`」的字符串判断等价实现（段边界判断与 forConfigKeys 一致）。

import { ConfigurationTarget } from "@/platform/configuration/common/configuration.js";

export const CONFIG_KEY_PREFIX = "config.";

export class ConfigAwareContextValues {
    constructor(configurationService, onDidInvalidate) {
        this._configurationService = configurationService;
        this._onDidInvalidate = onDidInvalidate;
        this._values = new Map();
        this._listener = configurationService.onDidChangeConfiguration(event => this._onDidChangeConfiguration(event));
    }

    // contextKeyService.ts:121-148
    _onDidChangeConfiguration(event) {
        if (event.source === ConfigurationTarget.DEFAULT) {
            // :123-128 新增/移除配置项 —— 全部已缓存键失效
            const allKeys = [...this._values.keys()];
            this._values.clear();
            this._onDidInvalidate(allKeys);
            return;
        }

        const changedKeys = [];
        for (const configKey of event.affectedKeys) {
            const contextKey = `${CONFIG_KEY_PREFIX}${configKey}`;

            // :134-139 findSuperstr / deleteSuperstr —— 键的后代一并失效
            const descendants = [];
            for (const cached of this._values.keys()) {
                if (cached.startsWith(`${contextKey}.`)) descendants.push(cached);
            }
            if (descendants.length) {
                changedKeys.push(...descendants);
                for (const key of descendants) this._values.delete(key);
            }

            // :141-144 —— 键自身若已缓存也要失效
            if (this._values.has(contextKey)) {
                changedKeys.push(contextKey);
                this._values.delete(contextKey);
            }
        }

        this._onDidInvalidate(changedKeys);
    }

    // contextKeyService.ts:150-176
    getValue(key) {
        if (!key.startsWith(CONFIG_KEY_PREFIX)) return undefined;
        if (this._values.has(key)) return this._values.get(key);

        const configValue = this._configurationService.getValue(key.slice(CONFIG_KEY_PREFIX.length));
        let value;
        switch (typeof configValue) {
            case "number":
            case "boolean":
            case "string":
                value = configValue;
                break;
            default:
                value = Array.isArray(configValue) ? JSON.stringify(configValue) : configValue;
        }

        this._values.set(key, value);
        return value;
    }

    dispose() {
        this._listener?.();
    }
}
