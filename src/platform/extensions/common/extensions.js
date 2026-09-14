// 扩展清单与运行时描述类型（对齐 <vscode>/src/vs/platform/extensions/common/extensions.ts）。
//
// 迁入的部分与出处：
//   1. ExtensionIdentifier：大小写不敏感、可序列化，`extensionId = <publisher>.<name>`
//      —— extensions.ts:398-440；标识符的拼法见权威扫描器产出的 identifier 字段
//      （extensionsScannerService 以 `${publisher}.${name}` 构造）。
//   2. ExtensionIdentifierSet —— :442-469。
//   3. IExtensionManifest / IExtensionDescription 的字段集合
//      —— :307-339（manifest）、:529-545（description）。
//
// 未迁入（按里程碑需要再补，避免留下用不到的空壳）：
//   TargetPlatform 与目标平台推导、localizations、apiProposals、preRelease、
//   isUnderDevelopment、extensionDependencies 解析、extensionKind。
//   `main` / `browser` 两个入口字段已保留 —— 它们是两端宿主唯一的差异点
//   （见 docs/plugin-system-design.md 第 9 节）。

/**
 * 扩展标识符：值统一小写用于比较，保留原始大小写用于展示。
 * 对齐 extensions.ts:398-440。
 */
export class ExtensionIdentifier {
    constructor(value) {
        this._value = String(value).toLowerCase();
        this._originalValue = String(value);
    }

    get value() {
        return this._value;
    }

    toString() {
        return this._originalValue;
    }

    // :404-410：字符串与标识符都可入参，统一转小写键
    static toKey(identifier) {
        return (typeof identifier === "string" ? identifier : identifier.value).toLowerCase();
    }

    // :426-438
    equals(other) {
        return ExtensionIdentifier.toKey(this) === ExtensionIdentifier.toKey(other);
    }
}

// 对齐 extensions.ts:442-469：以 toKey 归一化后存放的集合
export class ExtensionIdentifierSet {
    constructor(identifiers) {
        this._set = new Set();
        if (identifiers) {
            for (const identifier of identifiers) this._set.add(ExtensionIdentifier.toKey(identifier));
        }
    }

    get size() {
        return this._set.size;
    }

    add(identifier) {
        this._set.add(ExtensionIdentifier.toKey(identifier));
        return this;
    }

    has(identifier) {
        return this._set.has(ExtensionIdentifier.toKey(identifier));
    }

    delete(identifier) {
        return this._set.delete(ExtensionIdentifier.toKey(identifier));
    }

    values() {
        return [...this._set];
    }

    [Symbol.iterator]() {
        return this._set[Symbol.iterator]();
    }
}

/**
 * 由清单构造运行时描述（对齐 extensions.ts:529-545 的字段集合）。
 * 权威由扩展扫描器产出同名结构（IExtensionDescription 是 manifest 的超集 + 运行时字段）。
 *
 * @param {object} manifest            清单对象（package.json 的内容）
 * @param {{ scheme: string, path: string, toString(): string }} extensionLocation 扩展根目录 URI
 * @param {{ isBuiltin?: boolean }} [options]
 */
export function createExtensionDescription(manifest, extensionLocation, options = {}) {
    return {
        identifier: new ExtensionIdentifier(`${manifest.publisher}.${manifest.name}`),
        extensionLocation,
        isBuiltin: options.isBuiltin ?? false,
        name: manifest.name,
        publisher: manifest.publisher,
        version: manifest.version,
        displayName: manifest.displayName,
        description: manifest.description,
        main: manifest.main,
        browser: manifest.browser,
        activationEvents: manifest.activationEvents,
        extensionDependencies: manifest.extensionDependencies,
        contributes: manifest.contributes
    };
}
