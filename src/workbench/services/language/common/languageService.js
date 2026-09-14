// 工作台语言服务（对齐 <vscode>/src/vs/workbench/services/language/common/languageService.ts
// 的 WorkbenchLanguageService）。
//
// 迁入的部分与出处：
//   1. `languages` 扩展点（含 activationEventsGenerator：声明了 configuration 的语言
//      自动产生 `onLanguage:<id>`）—— languageService.ts:40-122 的 :115-121；
//   2. handler：校验清单里的语言声明 → 登记进 monaco 的语言注册表
//      —— :237-275（校验 → allValidLanguages → setDynamicLanguages），
//      其中 setDynamicLanguages 的等价物是 monaco 的 `languages.register`
//      （ModesRegistry.registerLanguage → editor/common/services/languagesRegistry.js:66-73
//      重建语言表与平台关联队列）；
//   3. `files.associations` 用户层的清空重建 —— :294-317 的 updateMime；
//   4. 配置变化重算 —— :278-285；语言表变化后重算 —— :285-287（权威等扩展注册完成，
//      本仓库的扩展在启动时一次装齐，故在 setHandler 回调里直接重算）；
//   5. 关联变化后重解析已打开的文件型模型 ——
//      workbench/services/textfile/common/textFileEditorModel.ts:199-209
//      （只对文件型模型生效：untitled 模型不响应 files.associations 变化）。
//
// 未迁入（各给出理由或归口）：
//   - `onLanguage:<id>` 触发的扩展激活（:287-291）：需要扩展宿主，M3；
//   - `whenInstalledExtensionsRegistered` 的等待：需要扩展扫描完成事件，M3；
//   - 语言表渲染器（:124-235，扩展详情页的表格）与 `getLanguageName`（已有
//     `@/monaco/languageNames.js`）不在此重复实现（门控 §4.1 第 6 条：同一语义只允许一份实现）；
//   - `configuration` 字段指向的 language-configuration.json 的**文件读取**：权威由
//     workbench/contrib/codeEditor/common/languageConfigurationExtensionPoint.ts:89-130 懒加载并
//     以 priority 50 注册。本仓库 M1 还没有扩展资源加载（M3 随扩展宿主引入），
//     故清单里声明 `configuration` 只会得到一条提示，语言配置由扩展入口模块直接调
//     `monaco.languages.setLanguageConfiguration` 提供（已登记到 docs/vscode-reference.md 第 5 节）。

import { monaco } from "@/monaco/setup.js";
import { FILES_ASSOCIATIONS_CONFIG } from "@/platform/files/common/files.js";
import { configurationService } from "@/workbench/services/configuration/browser/configurationService.js";
import {
    FIRST_LINE_DETECTION_LENGTH_LIMIT,
    PLAINTEXT_LANGUAGE_ID,
    clearConfiguredLanguageAssociations,
    registerConfiguredLanguageAssociation,
    resolveLanguageId
} from "@/workbench/services/language/common/languageAssociations.js";
import { ExtensionsRegistry } from "@/workbench/services/extensions/common/extensionsRegistry.js";

// 输入显式指定的语言（对齐 textFileEditorModel.ts:116 的 preferredLanguageId —— 权威把它存在
// 文本编辑器模型上，本仓库的等价物是「monaco 模型 → 语言 id」的弱映射，由
// editorGroupService 在创建输入时写入）。弱映射使模型释放后条目自动消失。
const _preferredLanguageIds = new WeakMap();

/**
 * 记录某个模型被显式指定的语言；此后 files.associations 变化不再改写它
 * （对齐 textEditorModel.ts:204-213 的 getOrCreateLanguage：显式语言优先于路径识别）。
 * @param {object} model
 * @param {string} languageId
 */
export function setPreferredLanguageId(model, languageId) {
    if (languageId) _preferredLanguageIds.set(model, languageId);
}

// 已注册语言 id 集合（对齐 editor/common/services/languageService.ts:121-128
// 的 isRegisteredLanguageId 判定）。语言表在启动时一次装齐，调用方每次解析取一份即可。
export function getRegisteredLanguageIds() {
    const ids = new Set();
    for (const language of monaco.languages.getLanguages()) ids.add(language.id);
    return ids;
}

/**
 * 求某个已打开模型当前应使用的语言（关联表变化后的重算入口）。
 * @param {object} model monaco ITextModel
 * @param {Set<string>} registeredIds getRegisteredLanguageIds() 的结果
 * @returns {string}
 */
export function getOrCreateLanguageId(model, registeredIds) {
    // 首行只取前 1000 字符（textEditorModel.ts:186-197 的 getFirstLineText）
    const firstLine = model.getLineContent(1).substring(0, FIRST_LINE_DETECTION_LENGTH_LIMIT);
    return resolveLanguageId(model.uri, _preferredLanguageIds.get(model), firstLine, registeredIds);
}

const _onDidChangeLanguageListeners = new Set();

// 语言表或用户关联表变化时触发（对齐 :294-317 末尾的 _onDidChange）
export function onDidChangeLanguage(listener) {
    _onDidChangeLanguageListeners.add(listener);
    return () => _onDidChangeLanguageListeners.delete(listener);
}

function _fireDidChangeLanguage() {
    for (const listener of _onDidChangeLanguageListeners) listener();
}

// :40-122：扩展点声明 + 隐式激活事件生成器
const _languagesExtPoint = ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: "languages",
    activationEventsGenerator: function* (languageContributions) {
        for (const languageContribution of languageContributions) {
            if (languageContribution.id && languageContribution.configuration) {
                yield `onLanguage:${languageContribution.id}`;
            }
        }
    }
});

// :237-275：校验并登记
_languagesExtPoint.setHandler(extensions => {
    const allValidLanguages = [];

    for (const extension of extensions) {
        if (!Array.isArray(extension.value)) {
            extension.collector.error(`Invalid \`contributes.${_languagesExtPoint.name}\`. Expected an array.`);
            continue;
        }
        for (const raw of extension.value) {
            if (!_isValidLanguageExtensionPoint(raw, extension.collector)) continue;
            allValidLanguages.push({
                id: raw.id,
                extensions: raw.extensions,
                filenames: raw.filenames,
                filenamePatterns: raw.filenamePatterns,
                firstLine: raw.firstLine,
                aliases: raw.aliases,
                mimetypes: raw.mimetypes
            });
        }
    }

    _registerLanguages(allValidLanguages);
    updateConfiguredLanguageAssociations();
});

// monaco 的 `languages.register` 即 editor 侧语言注册表的入口；重复 id 会按
// languagesRegistry.js:101-114 的 _mergeLanguage 合并（权威 languagesRegistry.ts:154-176 同源），
// 因此这里逐条注册即可，不需要自己去重。
function _registerLanguages(languages) {
    for (const language of languages) {
        monaco.languages.register(language);
    }
}

// :294-317：用户层「清空 → 按配置重建 → 重算已打开模型 → 发语言变化事件」
export function updateConfiguredLanguageAssociations() {
    clearConfiguredLanguageAssociations();

    const associations = configurationService.getValue(FILES_ASSOCIATIONS_CONFIG);
    if (associations && typeof associations === "object") {
        for (const pattern of Object.keys(associations)) {
            const languageId = associations[pattern];
            if (typeof languageId !== "string") {
                // 与权威同一处告警（fixes microsoft/vscode#147284）
                console.warn(`Ignoring configured 'files.associations' for '${pattern}' because its type is not a string but '${typeof languageId}'`);
                continue;
            }
            registerConfiguredLanguageAssociation({ id: languageId, filepattern: pattern });
        }
    }

    applyLanguageToOpenModels();
    _fireDidChangeLanguage();
}

// 关联表变化后重解析已打开的文件型模型
// （对齐 textFileEditorModel.ts:199-209 的 onDidChangeFilesAssociation）。
// untitled 模型不在重算范围内：权威只有 TextFileEditorModel 订阅该变化，
// 无标题模型保留用户手动选择的语言模式。
export function applyLanguageToOpenModels() {
    const registeredIds = getRegisteredLanguageIds();
    for (const model of monaco.editor.getModels()) {
        if (model.uri?.scheme === "untitled") continue;
        const languageId = getOrCreateLanguageId(model, registeredIds);
        if (model.getLanguageId() !== languageId) {
            monaco.editor.setModelLanguage(model, languageId);
        }
    }
}

// 在应用外壳里调用一次；必须在配置服务初始化之后（要读 files.associations 的默认层与用户层）
export function initLanguageService() {
    configurationService.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration(FILES_ASSOCIATIONS_CONFIG)) {
            updateConfiguredLanguageAssociations();
        }
    });
    updateConfiguredLanguageAssociations();
    return { onDidChangeLanguage };
}

// :322-328
function _isUndefinedOrStringArray(value) {
    if (typeof value === "undefined") return true;
    if (!Array.isArray(value)) return false;
    return value.every(item => typeof item === "string");
}

// :330-370：逐字段校验清单里的语言声明。
// 注意：权威同样**不校验** `filenamePatterns`（此处刻意保持一致，不自行加严）。
function _isValidLanguageExtensionPoint(value, collector) {
    if (!value) {
        collector.error(`Empty value for \`contributes.${_languagesExtPoint.name}\``);
        return false;
    }
    if (typeof value.id !== "string") {
        collector.error("property `id` is mandatory and must be of type `string`");
        return false;
    }
    if (!_isUndefinedOrStringArray(value.extensions)) {
        collector.error("property `extensions` can be omitted and must be of type `string[]`");
        return false;
    }
    if (!_isUndefinedOrStringArray(value.filenames)) {
        collector.error("property `filenames` can be omitted and must be of type `string[]`");
        return false;
    }
    if (typeof value.firstLine !== "undefined" && typeof value.firstLine !== "string") {
        collector.error("property `firstLine` can be omitted and must be of type `string`");
        return false;
    }
    if (typeof value.configuration !== "undefined") {
        if (typeof value.configuration !== "string") {
            collector.error("property `configuration` can be omitted and must be of type `string`");
            return false;
        }
        // 文件形式的语言配置尚未接入（见文件头说明）
        collector.info("property `configuration` is not loaded yet: register the language configuration programmatically instead");
    }
    if (!_isUndefinedOrStringArray(value.aliases)) {
        collector.error("property `aliases` can be omitted and must be of type `string[]`");
        return false;
    }
    if (!_isUndefinedOrStringArray(value.mimetypes)) {
        collector.error("property `mimetypes` can be omitted and must be of type `string[]`");
        return false;
    }
    if (typeof value.icon !== "undefined") {
        if (typeof value.icon !== "object" || typeof value.icon.light !== "string" || typeof value.icon.dark !== "string") {
            collector.error("property `icon` can be omitted and must be of type `object` with properties `light` and `dark` of type `string`");
            return false;
        }
    }
    return true;
}
