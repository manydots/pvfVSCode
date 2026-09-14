// 配置注册表（对齐 <vscode>/src/vs/platform/configuration/common/configurationRegistry.ts）。
//
// 迁入的部分与出处：
//   1. registerConfiguration / registerConfigurations 与 properties + allOf 的递归登记
//                                                   —— configurationRegistry.ts:82-87、:806-895；
//   2. 每项 schema 的记录（含 default），getConfigurationProperties
//                                                   —— :918-920；
//   3. 默认层的来源：DefaultConfiguration 遍历 properties，把 schema.default 写进默认模型
//                                                   —— platform/configuration/common/configurations.ts:55-77；
//   4. 键校验：非法键与 `[language]` 覆盖键不作为普通配置项登记 —— :798-812 validateProperty。
//
// 未迁入：policy、experiment/tags、restricted、extensionInfo、schema 生成（JSON Schema）、
// 注销（deregisterConfiguration）与 onDidUpdateConfiguration（本仓库的配置项在模块加载期一次注册完，
// 默认层在 ConfigurationService.initialize() 时一次性构建，无运行期增删）。

const CONFIGURATION_KEY_REGEX = /^[a-zA-Z0-9_.-]+$/;
// 语言/资源级覆盖键（权威 configurationRegistry.ts 的 OVERRIDE_PROPERTY_REGEX）；
// 本仓库没有覆盖层，这类键不登记（登记了也取不到值）。
const OVERRIDE_PROPERTY_REGEX = /^\[(.*)\]$/;

function validateProperty(key, property) {
    if (!property || typeof property !== "object") {
        console.error(`Invalid configuration property ${key}`);
        return true;
    }
    if (!key || !CONFIGURATION_KEY_REGEX.test(key)) {
        console.error(`Invalid configuration key ${key}`);
        return true;
    }
    return false;
}

export class ConfigurationRegistry {
    constructor() {
        this._configurationProperties = Object.create(null);
    }

    // configurationRegistry.ts:82-95
    registerConfiguration(configuration) {
        this._registerProperties(configuration);
        return configuration;
    }

    registerConfigurations(configurations) {
        for (const configuration of configurations) this.registerConfiguration(configuration);
    }

    getConfigurationProperties() {
        return this._configurationProperties;
    }

    // 等价 DefaultConfiguration 构建默认层时用到的「键 → 默认值」视图
    // （configurations.ts:61-76：遍历配置项，取 deepClone(propertySchema.default)）。
    getConfigurationDefaults() {
        const defaults = Object.create(null);
        for (const key of Object.keys(this._configurationProperties)) {
            defaults[key] = this._configurationProperties[key].default;
        }
        return defaults;
    }

    // configurationRegistry.ts:806-895：properties 与 allOf 子节点都登记。
    _registerProperties(configuration) {
        const properties = configuration.properties;
        if (properties) {
            for (const key of Object.keys(properties)) {
                const property = properties[key];
                if (OVERRIDE_PROPERTY_REGEX.test(key)) continue;
                if (validateProperty(key, property)) continue;
                this._configurationProperties[key] = property;
            }
        }
        if (configuration.allOf) {
            for (const node of configuration.allOf) this._registerProperties(node);
        }
    }
}

// 全应用共用一份（与 MenuRegistry / viewsRegistry 等既有注册表一致，模块单例）。
export const configurationRegistry = new ConfigurationRegistry();
