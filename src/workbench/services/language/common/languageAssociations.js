// 资源 → languageId 的识别入口：在 monaco 的平台关联队列之上补「用户配置层」。
//
// 权威是三步（<vscode>/src/vs/editor/common/services/languagesAssociations.ts:139-189）：
//   ① 用户 `files.associations`（getAssociationByPath + userRegisteredAssociations）
//   ② 平台注册（各语言的 extensions / filenames / filenamePatterns）
//   ③ 首行正则兜底（getAssociationByFirstline）
// 其中 ②③ 在 <vscode>/src/vs/editor/common/services/languagesAssociations.ts 与
// monaco 发行包的 editor/common/services/languagesAssociations.js **逐行相同**（同一源码），
// 但 monaco 只导出 getLanguageIds / registerPlatformLanguageAssociation /
// clearPlatformLanguageAssociations —— 缺的正是 ①（用户层）。
// 因此这里只实现 ①，②③ 直接调 monaco，不重写：
//   平台队列由 monaco 自己的 editor/common/services/languagesRegistry.js:140-162
//   在 `monaco.languages.register` 时填充（:66-73 每次重建前 clearPlatformLanguageAssociations）。
//
// 组合顺序与权威等价：用户层只可能带 filepattern（注册形态见 languageService.js，
// 对齐 <vscode>/src/vs/workbench/services/language/common/languageService.ts:310-312），
// 永远不会带 firstline，故「用户层 path 命中 → 否则交给 monaco 的 ②③」与权威三步顺序一致。

import { getLanguageIds } from "monaco-editor/editor/common/services/languagesAssociations.js";
import { PLAINTEXT_LANGUAGE_ID } from "monaco-editor/editor/common/languages/modesRegistry.js";
import { parse } from "monaco-editor/base/common/glob.js";
import { basename, posix } from "monaco-editor/base/common/path.js";

// 未识别语言：monaco 的 getLanguageIds 在无路径命中、首行也未命中时返回该值
// （languagesAssociations.js:81-121 的 `{ id: 'unknown' }`，monaco 未导出该常量）
const UNKNOWN_LANGUAGE_ID = "unknown";

export { PLAINTEXT_LANGUAGE_ID };

// <vscode>/src/vs/editor/common/model.ts:1508 的 FIRST_LINE_DETECTION_LENGTH_LIMIT：
// 首行检测只取前 1000 个字符（使用处 workbench/common/editor/textEditorModel.ts:186-197）
export const FIRST_LINE_DETECTION_LENGTH_LIMIT = 1000;

// 用户层关联表（对齐 languagesAssociations.js 的 userRegisteredAssociations）
const _configuredAssociations = [];

/**
 * 登记一条用户关联（对齐 languagesAssociations.ts:48-50 的 registerConfiguredLanguageAssociation
 * 与 :89-101 的条目构造：pattern 编译为忽略大小写的匹配器，含路径分隔符才匹配整条路径，
 * 否则只匹配文件名）。
 * @param {{ id: string, filepattern: string }} association
 */
export function registerConfiguredLanguageAssociation({ id, filepattern }) {
    _configuredAssociations.push({
        id,
        filepattern,
        filepatternParsed: parse(filepattern, { ignoreCase: true }),
        filepatternOnPath: filepattern.indexOf(posix.sep) >= 0
    });
}

// 对齐 languagesAssociations.ts:44-46：配置变化时清空重建
export function clearConfiguredLanguageAssociations() {
    _configuredAssociations.length = 0;
}

/**
 * 资源 → languageId。未识别时回落 `plaintext`（monaco 的 createModel 在语言为空时同样回落它，
 * 见 standaloneEditor.js 的 createModel 分支）。
 * @param {{ scheme?: string, path?: string, fsPath?: string } | null | undefined} resource
 * @param {string} [firstLine]
 * @returns {string}
 */
export function getLanguageIdForResource(resource, firstLine) {
    const configuredId = _getConfiguredLanguageId(resource);
    if (configuredId) return configuredId;

    const ids = getLanguageIds(resource ?? null, firstLine);
    const id = ids[0];
    return !id || id === UNKNOWN_LANGUAGE_ID ? PLAINTEXT_LANGUAGE_ID : id;
}

/**
 * 求一个输入应使用的语言 id —— 识别结果再叠加两条权威规则：
 *   - workbench/common/editor/textEditorModel.ts:204-213 的 getOrCreateLanguage：
 *     显式语言（非 plaintext）优先于「资源路径 + 首行」识别；
 *   - editor/common/services/languageService.ts:121-128 的 _createAndGetLanguageIdentifier：
 *     语言 id 未知或未注册时回落 plaintext（如 files.associations 里写了不存在的语言）。
 * 保持纯函数（registeredIds 由调用方给出），使其可在 Node 里逐条固定决策表。
 * @param {{ scheme?: string, path?: string, fsPath?: string } | undefined} resource 输入资源，可缺省
 * @param {string | undefined} preferredLanguageId 输入显式指定的语言
 * @param {string} firstLine 资源路径未命中时的首行兜底文本
 * @param {Set<string>} registeredIds 已注册的语言 id 集合
 * @returns {string}
 */
export function resolveLanguageId(resource, preferredLanguageId, firstLine, registeredIds) {
    let languageId;
    if (preferredLanguageId && preferredLanguageId !== PLAINTEXT_LANGUAGE_ID) {
        languageId = preferredLanguageId;
    } else if (resource) {
        languageId = getLanguageIdForResource(resource, firstLine);
    } else {
        // 没有资源时无路径可识别，只能用显式语言（含 plaintext）
        languageId = preferredLanguageId;
    }
    return !languageId || !registeredIds.has(languageId) ? PLAINTEXT_LANGUAGE_ID : languageId;
}

// 路径推导对齐 languagesAssociations.ts:140-159 的 scheme 分支，但只保留本仓库存在的 scheme：
//   file → fsPath（本地/桌面端的磁盘路径）
//   其它（pvf / untitled 等）→ resource.path，与权威的 default 分支一致
// 权威还有 data:（取 metadata label）与 vscode-notebook-cell（不参与识别）两个分支，
// 本仓库没有这两种资源（见 docs/vscode-reference.md 第 5 节）。
function _pathOfResource(resource) {
    if (!resource) return undefined;
    if (resource.scheme === "file") return resource.fsPath;
    return resource.path;
}

function _getConfiguredLanguageId(resource) {
    const path = _pathOfResource(resource);
    if (!path) return null;

    const lowerPath = path.toLowerCase();
    const filename = basename(lowerPath);
    const association = _getAssociationByPath(lowerPath, filename);
    return association ? association.id : null;
}

// 对齐 languagesAssociations.ts:191-243 的 getAssociationByPath：用户层只会带 filepattern，
// 故只保留 pattern 分支，并保留其中两条规则 ——
//   1. 倒序遍历（后注册的优先，fixes microsoft/vscode#20074）；
//   2. 最长 pattern 胜出。
function _getAssociationByPath(path, filename) {
    let patternMatch = null;
    for (let i = _configuredAssociations.length - 1; i >= 0; i--) {
        const association = _configuredAssociations[i];
        if (!patternMatch || association.filepattern.length > patternMatch.filepattern.length) {
            // 含路径分隔符的 pattern 匹配整条路径，否则只匹配文件名
            const target = association.filepatternOnPath ? path : filename;
            if (association.filepatternParsed(target)) {
                patternMatch = association;
            }
        }
    }
    return patternMatch;
}

/**
 * 识别用的首行文本（对齐 <vscode>/src/vs/workbench/common/editor/textEditorModel.ts:186-197
 * 的 getFirstLineText：取第一行并截断到 1000 字符）。
 * @param {string} content
 * @returns {string}
 */
export function getFirstLineText(content) {
    if (!content) return "";
    const end = content.search(/\r?\n/);
    const line = end < 0 ? content : content.slice(0, end);
    return line.length > FIRST_LINE_DETECTION_LENGTH_LIMIT ? line.slice(0, FIRST_LINE_DETECTION_LENGTH_LIMIT) : line;
}
