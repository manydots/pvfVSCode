// 配置系统的平台层（对齐 <vscode>/src/vs/platform/configuration/common/configuration.ts 与
// common/configurationModels.ts，只保留裁剪客户端用到的子集）。
//
// 迁入的部分与出处：
//   1. ConfigurationTarget 枚举与字符串化        —— configuration.ts:40-61；
//   2. 点分路径取值 / 建树 / 摘除                —— configuration.ts:319-336
//      getConfigurationValue、:239-247 toValuesTree、:249-284 addToValueTree、:285-316 removeFromValueTree；
//   3. ConfigurationModel（contents 树 + keys 点分键两份视图）
//                                                —— configurationModels.ts:29-313（getValue :93、inspect :97、
//      setValue/removeValue :269-295、merge :156-190）；
//   4. 分层合并顺序「默认 → 用户 → 内存」        —— configurationModels.ts:1057-1062
//      getWorkspaceConsolidatedConfiguration（权威还有 policy/application/workspace/folder 层，本仓库没有）；
//   5. 变更事件与键比较                          —— configurationModels.ts:1215-1270 ConfigurationChangeEvent、
//      :1272-1337 compare/compareConfigurationContents、:945-953 compareAndUpdateLocalUserConfiguration。
//
// 未迁入：语言与资源级覆盖（`[language]` 覆盖段与 overrideIdentifier）、policy 层、
// profile 的 application/user 细分、ConfigurationModelParser 的 JSON 文本解析
// （本仓库的用户层直接以对象存储，用 toValuesTree 建树）、ConfigurationInspectValue 的全部分层字段。

// configuration.ts:40-49
export const ConfigurationTarget = Object.freeze({
    APPLICATION: 1,
    USER: 2,
    USER_LOCAL: 3,
    USER_REMOTE: 4,
    WORKSPACE: 5,
    WORKSPACE_FOLDER: 6,
    DEFAULT: 7,
    MEMORY: 8
});

// configuration.ts:50-61
export function ConfigurationTargetToString(target) {
    switch (target) {
        case ConfigurationTarget.APPLICATION:
            return "APPLICATION";
        case ConfigurationTarget.USER:
            return "USER";
        case ConfigurationTarget.USER_LOCAL:
            return "USER_LOCAL";
        case ConfigurationTarget.USER_REMOTE:
            return "USER_REMOTE";
        case ConfigurationTarget.WORKSPACE:
            return "WORKSPACE";
        case ConfigurationTarget.WORKSPACE_FOLDER:
            return "WORKSPACE_FOLDER";
        case ConfigurationTarget.DEFAULT:
            return "DEFAULT";
        case ConfigurationTarget.MEMORY:
            return "MEMORY";
        default:
            return String(target);
    }
}

// configuration.ts:319-336
export function getConfigurationValue(config, settingPath, defaultValue) {
    const accessSetting = (target, path) => {
        let current = target;
        for (const component of path) {
            if (typeof current !== "object" || current === null) return undefined;
            current = current[component];
        }
        return current;
    };

    const result = accessSetting(config, settingPath.split("."));
    return typeof result === "undefined" ? defaultValue : result;
}

// configuration.ts:249-284：把点分键写进对象树；中途遇到非对象即报告冲突并跳过该键。
export function addToValueTree(settingsTreeRoot, key, value, conflictReporter) {
    const segments = key.split(".");
    const last = segments.pop();

    let current = settingsTreeRoot;
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const existing = current[segment];
        switch (typeof existing) {
            case "undefined":
                current[segment] = Object.create(null);
                break;
            case "object":
                if (existing === null) {
                    conflictReporter(`Ignoring ${key} as ${segments.slice(0, i + 1).join(".")} is null`);
                    return;
                }
                break;
            default:
                conflictReporter(`Ignoring ${key} as ${segments.slice(0, i + 1).join(".")} is ${JSON.stringify(existing)}`);
                return;
        }
        current = current[segment];
    }

    if (typeof current === "object" && current !== null) {
        current[last] = value;
    } else {
        conflictReporter(`Ignoring ${key} as ${segments.join(".")} is ${JSON.stringify(current)}`);
    }
}

// configuration.ts:285-316
export function removeFromValueTree(valueTree, key) {
    doRemoveFromValueTree(valueTree, key.split("."));
}

function doRemoveFromValueTree(valueTree, segments) {
    if (!valueTree) return;

    const first = segments.shift();
    if (segments.length === 0) {
        delete valueTree[first];
        return;
    }

    if (Object.keys(valueTree).indexOf(first) !== -1) {
        const value = valueTree[first];
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            doRemoveFromValueTree(value, segments);
            if (Object.keys(value).length === 0) delete valueTree[first];
        }
    }
}

// configuration.ts:239-247：点分键字典 → 嵌套对象树。
export function toValuesTree(properties, conflictReporter) {
    const root = Object.create(null);
    for (const key in properties) {
        addToValueTree(root, key, properties[key], conflictReporter);
    }
    return root;
}

export function deepClone(value) {
    if (Array.isArray(value)) return value.map(deepClone);
    if (typeof value === "object" && value !== null) {
        const result = Object.create(null);
        for (const key of Object.keys(value)) result[key] = deepClone(value[key]);
        return result;
    }
    return value;
}

// 等价于 base/common/objects.ts 的 objects.deepEquals（本仓库只用到基本类型、数组与普通对象）。
export function deepEquals(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((item, index) => deepEquals(item, b[index]));
    }
    if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        return aKeys.length === bKeys.length && aKeys.every(key => bKeys.includes(key) && deepEquals(a[key], b[key]));
    }
    return false;
}

// configurationModels.ts:29-313 的子集：一份配置层的「内容树 + 点分键」。
export class ConfigurationModel {
    static createEmptyModel() {
        return new ConfigurationModel(Object.create(null), []);
    }

    constructor(contents, keys) {
        this._contents = contents ?? Object.create(null);
        this._keys = keys ?? [];
    }

    get contents() {
        return this._contents;
    }

    get keys() {
        const result = [];
        for (const key of this._keys) {
            if (result.indexOf(key) === -1) result.push(key);
        }
        return result;
    }

    isEmpty() {
        return this._keys.length === 0 && Object.keys(this._contents).length === 0;
    }

    // configurationModels.ts:93-95
    getValue(section) {
        return section ? getConfigurationValue(this.contents, section) : this.contents;
    }

    // configurationModels.ts:97-120 的简化：本仓库没有语言覆盖，inspect 只返回 value。
    inspect(section) {
        const value = this.getValue(section);
        return { value };
    }

    // configurationModels.ts:269-295
    setValue(key, value) {
        const conflictReporter = message => console.error(`Conflict in configuration: ${message}`);
        addToValueTree(this._contents, key, value, conflictReporter);
        if (this._keys.indexOf(key) === -1) this._keys.push(key);
    }

    removeValue(key) {
        const index = this._keys.indexOf(key);
        if (index === -1) return;
        this._keys.splice(index, 1);
        removeFromValueTree(this._contents, key);
    }

    // configurationModels.ts:156-190：后合并者覆盖先者；键取并集。
    merge(...others) {
        const contents = deepClone(this.contents);
        const keys = [...this.keys];
        for (const other of others) {
            if (!other || other.isEmpty()) continue;
            mergeInto(contents, other.contents);
            for (const key of other.keys) {
                if (keys.indexOf(key) === -1) keys.push(key);
            }
        }
        return new ConfigurationModel(contents, keys);
    }
}

// configuration.ts:337-350 的简化：递归覆盖同名字段。
function mergeInto(base, add) {
    for (const key of Object.keys(add)) {
        if (key === "__proto__") continue;
        const baseValue = base[key];
        const addValue = add[key];
        if (typeof baseValue === "object" && baseValue !== null && !Array.isArray(baseValue) && typeof addValue === "object" && addValue !== null && !Array.isArray(addValue)) {
            mergeInto(baseValue, addValue);
        } else {
            base[key] = deepClone(addValue);
        }
    }
}

// configurationModels.ts:1272-1337
function compareConfigurationContents(to, from) {
    const added = to ? (from ? to.keys.filter(key => from.keys.indexOf(key) === -1) : [...to.keys]) : [];
    const removed = from ? (to ? from.keys.filter(key => to.keys.indexOf(key) === -1) : [...from.keys]) : [];
    const updated = [];
    if (to && from) {
        for (const key of from.keys) {
            if (to.keys.indexOf(key) !== -1) {
                if (!deepEquals(getConfigurationValue(from.contents, key), getConfigurationValue(to.contents, key))) updated.push(key);
            }
        }
    }
    return { added, removed, updated };
}

function compare(from, to) {
    const { added, removed, updated } = compareConfigurationContents(to, from);
    return { added, removed, updated };
}

// configurationModels.ts:1215-1270 的简化：没有语言覆盖，故 overrides 恒为空。
export class ConfigurationChangeEvent {
    constructor(change, source) {
        this.change = change;
        this.source = source;
        this.affectedKeys = new Set(change.keys);
        this._affectsConfigStr = "\n" + change.keys.join("\n") + "\n";
    }

    // 权威按「段边界」匹配：`config.editor` 命中 `config.editor.minimap`，但不命中 `config.editorX`。
    affectsConfiguration(section) {
        const needle = "\n" + section;
        const index = this._affectsConfigStr.indexOf(needle);
        if (index < 0) return false;
        const position = index + needle.length;
        if (position >= this._affectsConfigStr.length) return false;
        const code = this._affectsConfigStr.charCodeAt(position);
        return code === "\n".charCodeAt(0) || code === ".".charCodeAt(0);
    }
}

// configurationModels.ts:764-1080 的子集：默认 → 用户 → 内存三层（权威另有 policy/application/
// workspace/folder 四层，本仓库没有对应来源）。
export class Configuration {
    constructor({ defaultConfiguration, userConfiguration, memoryConfiguration } = {}) {
        this._defaultConfiguration = defaultConfiguration ?? ConfigurationModel.createEmptyModel();
        this._userConfiguration = userConfiguration ?? ConfigurationModel.createEmptyModel();
        this._memoryConfiguration = memoryConfiguration ?? ConfigurationModel.createEmptyModel();
        this._consolidated = null;
    }

    // configurationModels.ts:1057-1062
    getConsolidatedConfiguration() {
        if (!this._consolidated) {
            this._consolidated = this._defaultConfiguration.merge(this._userConfiguration, this._memoryConfiguration);
        }
        return this._consolidated;
    }

    getValue(section) {
        return this.getConsolidatedConfiguration().getValue(section);
    }

    // configurationModels.ts:811-900 的简化：value 取合并结果，default/user 取各层。
    inspect(key) {
        const defaultValue = this._defaultConfiguration.getValue(key);
        const userValue = this._userConfiguration.getValue(key);
        const memoryValue = this._memoryConfiguration.getValue(key);
        const value = this.getConsolidatedConfiguration().getValue(key);
        return {
            defaultValue,
            userValue,
            memoryValue,
            value,
            default: defaultValue === undefined ? undefined : { value: defaultValue },
            user: userValue === undefined ? undefined : { value: userValue },
            memory: memoryValue === undefined ? undefined : { value: memoryValue }
        };
    }

    // configurationModels.ts:945-953：比较旧/新用户层得到变更键，再替换该层。
    compareAndUpdateLocalUserConfiguration(user) {
        const { added, removed, updated } = compare(this._userConfiguration, user);
        const keys = [...added, ...updated, ...removed];
        if (keys.length) {
            this._userConfiguration = user;
            this._consolidated = null;
        }
        return { keys, overrides: [] };
    }

    updateDefaultConfiguration(defaults) {
        this._defaultConfiguration = defaults;
        this._consolidated = null;
    }
}
