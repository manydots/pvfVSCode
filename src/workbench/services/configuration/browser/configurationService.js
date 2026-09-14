// 工作台配置服务（对齐 <vscode>/src/vs/workbench/services/configuration/browser/configurationService.ts）。
//
// 迁入的部分与出处：
//   1. 分层取值：默认层 ← ConfigurationRegistry 的 schema.default（configurations.ts:55-77），
//      用户层 ← 用户设置，合并顺序见 platform/configuration/common/configurationModels.ts:1057-1062；
//   2. updateValue 的落点推导与「等于默认值即删除」—— configurationService.ts:343-368（:362-364）；
//   3. 写入后比较旧/新用户层产出变更键 —— configurationModels.ts:945-953
//      compareAndUpdateLocalUserConfiguration；
//   4. 变更事件只在有键变化时发出，source 为 ConfigurationTarget.USER（用户设置重新加载走该分支）
//      —— configurationService.ts:816-828、:1117-1125 triggerConfigurationChange；
//   5. inspect 返回 IConfigurationValue（configuration.ts:83-107）。
//
// 用户设置的落点（§4.2 第 4 类降级，已登记到 docs/vscode-reference.md 第 5 节）：
// 权威把用户设置写在档案目录的 settings.json（platform/userDataProfile/common/userDataProfile.ts:197），
// 本仓库没有文件系统，改为经存储服务存取 —— PROFILE 作用域、USER 目标，键名沿用 settings.json。
// 由于本仓库没有工作区/文件夹层，用户层之上只有内存层（权威还有 workspace/folder 层）。

import { Configuration, ConfigurationChangeEvent, ConfigurationModel, ConfigurationTarget, deepClone, deepEquals, toValuesTree } from "@/platform/configuration/common/configuration.js";
import { configurationRegistry } from "@/platform/configuration/common/configurationRegistry.js";
import { storageService } from "@/platform/storage/browser/storageService.js";
import { StorageScope, StorageTarget } from "@/platform/storage/common/storage.js";

export const USER_SETTINGS_KEY = "settings.json";

export class ConfigurationService {
    constructor() {
        this._configuration = new Configuration();
        this._userSettings = Object.create(null); // 点分键字典，与 settings.json 的等价形态一致
        this._listeners = new Set();
        this._initialized = false;
    }

    // 构建默认层与用户层；必须早于编辑器部件创建与菜单首次求值。
    initialize() {
        this._configuration.updateDefaultConfiguration(this._buildDefaultConfiguration());
        this._userSettings = this._readUserSettings();
        this._configuration.compareAndUpdateLocalUserConfiguration(this._buildUserConfiguration());
        this._initialized = true;
        return this;
    }

    // configurations.ts:55-77：遍历注册表的配置项，把 schema.default 写进默认模型。
    _buildDefaultConfiguration() {
        const model = ConfigurationModel.createEmptyModel();
        const properties = configurationRegistry.getConfigurationProperties();
        for (const key of Object.keys(properties)) {
            model.setValue(key, deepClone(properties[key].default));
        }
        return model;
    }

    _readUserSettings() {
        const stored = storageService.get(USER_SETTINGS_KEY, StorageScope.PROFILE);
        if (typeof stored !== "string" || !stored) return Object.create(null);
        try {
            const parsed = JSON.parse(stored);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : Object.create(null);
        } catch {
            // 设置文档损坏：按「没有用户设置」处理，全部回落到默认值
            return Object.create(null);
        }
    }

    _buildUserConfiguration() {
        const conflictReporter = message => console.error(`Conflict in user settings: ${message}`);
        return new ConfigurationModel(toValuesTree(this._userSettings, conflictReporter), Object.keys(this._userSettings));
    }

    getValue(section) {
        return this._configuration.getValue(section);
    }

    inspect(key) {
        return this._configuration.inspect(key);
    }

    onDidChangeConfiguration(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    // configurationService.ts:343-368
    async updateValue(key, value, target) {
        const resolvedTarget = target ?? ConfigurationTarget.USER;
        let nextValue = value;

        if (target === undefined) {
            // :362-364：没有显式指定目标且值等于默认值时，把用户层里的该设置删除（回到默认）
            if (deepEquals(value, this.inspect(key).defaultValue)) nextValue = undefined;
        }
        if (resolvedTarget !== ConfigurationTarget.USER) {
            throw new Error(`本仓库只支持用户设置（ConfigurationTarget.USER），收到 ${resolvedTarget}`);
        }

        if (nextValue === undefined) {
            if (!(key in this._userSettings)) return;
            delete this._userSettings[key];
        } else {
            if (deepEquals(this._userSettings[key], nextValue)) return;
            this._userSettings[key] = deepClone(nextValue);
        }

        const change = this._configuration.compareAndUpdateLocalUserConfiguration(this._buildUserConfiguration());
        // 权威在此处把设置立刻写进 settings.json（:1041 configurationEditing.writeConfiguration）；
        // 本仓库的存储服务是「攒批落盘」，故写入后立刻 flush 一次，避免刷新/崩溃窗口丢设置。
        storageService.store(USER_SETTINGS_KEY, this._userSettings, StorageScope.PROFILE, StorageTarget.USER);
        storageService.flush();

        // :1117-1125：只在有键变化时发事件
        if (change.keys.length) {
            const event = new ConfigurationChangeEvent(change, ConfigurationTarget.USER);
            for (const listener of this._listeners) listener(event);
        }
    }
}

// 全应用共用一份（本仓库没有 DI 容器，服务以模块单例暴露，与 storageService 等既有服务一致）。
export const configurationService = new ConfigurationService();

// 在应用外壳（App.vue）里调用一次；必须早于编辑器部件创建。
export function initConfigurationService() {
    return configurationService.initialize();
}
