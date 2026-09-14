// 语言配置的「序列化形态 → 编辑器内部形态」归一化。
// 对齐 <vscode>/src/vs/workbench/contrib/codeEditor/common/languageConfigurationExtensionPoint.ts:151-494
// 的 LanguageConfigurationFileHandler 静态部分（extractValidConfig 及其辅助函数）。
//
// 为什么必须单独有这一层：语言配置在权威里有两种形态，二者不是同一个类型 ——
//   1. **序列化形态** ILanguageConfiguration（权威 :57-72）：`autoClosingPairs` / `surroundingPairs`
//      的每一项允许是 `[open, close]` 二元组 **或** 对象。这是 language-configuration.json
//      文件里能写的内容（同文件 :496 起的 JSON schema 就是为它定义的，默认值即二元组）。
//   2. **内部形态** ExplicitLanguageConfiguration：`autoClosingPairs` 每项必须是
//      `{ open, close, notIn? }` 对象、`surroundingPairs` 每项必须是 `{ open, close }`，
//      只有 `brackets` / `colorizedBracketPairs` 仍是二元组（monaco 同源声明见
//      monaco.d.ts:7285 / :7291 / :7296）。
// 权威在 `extractValidConfig` 里完成归一化与逐项校验（非法项 console.warn 后丢弃），
// 随后 `_handleConfig`（:437-440）才 `_languageConfigurationService.register(languageId, richEditConfig, 50)`。
//
// 本仓库的扩展目前以代码注册同一份「序列化形态」配置（contributes.languages[].configuration
// 通道未接通，见 docs/vscode-reference.md 第 5 节），因此必须自己走这一步归一化：
// monaco 的 AutoClosingPairs（monaco-editor/esm/vs/editor/common/languages/languageConfiguration.js:116-124）
// 无条件读 `pair.open.charAt(0)`，二元组会被当成对象读取并抛
// `TypeError: Cannot read properties of undefined (reading 'charAt')` —— 曾实际发生。
//
// 与权威的差异（已在 docs/vscode-reference.md 第 5 节登记）：
// - 只移植 `extractValidConfig` 与其辅助函数；文件读取 `_readConfigFile`（:131-149）、
//   `onDidRequestBasicLanguageFeatures` 驱动的懒加载（:100-118）与 JSON schema 注册（:496+）
//   在本仓库没有消费方，未迁移；
// - 注册优先级：权威为 50（扩展点注册），本仓库经 monaco 公开 API
//   `setLanguageConfiguration` 注册，其优先级固定为 100
//   （monaco-editor/esm/vs/editor/standalone/browser/standaloneLanguages.js:81-89）。
//   每个语言只有一份语言配置，故该差异不可观察。
import { isObject, isString } from "@/base/common/types.js";
// IndentAction 与权威同源（权威从 editor/common/languages/languageConfiguration.ts 引入）：
// 序列化形态写 'none'/'indent'/'indentOutdent'/'outdent'，内部形态要求数值枚举。
import { IndentAction } from "monaco-editor/editor/common/languages/languageConfiguration.js";

// 对齐权威 :73-83：两项均为「长度恰为 2 的字符串数组」
function isStringArr(something) {
    if (!Array.isArray(something)) {
        return false;
    }
    for (let i = 0, len = something.length; i < len; i++) {
        if (!isString(something[i])) {
            return false;
        }
    }
    return true;
}

function isCharacterPair(something) {
    return isStringArr(something) && something.length === 2;
}

// 权威 :151-192：comments.lineComment 允许字符串或 `{ comment, noIndent }`；blockComment 必须是二元组
function extractValidCommentRule(languageId, configuration) {
    const source = configuration.comments;
    if (typeof source === "undefined") {
        return undefined;
    }
    if (!isObject(source)) {
        console.warn(`[${languageId}]: language configuration: expected \`comments\` to be an object.`);
        return undefined;
    }

    let result = undefined;
    if (typeof source.lineComment !== "undefined") {
        if (typeof source.lineComment === "string") {
            result = result || {};
            result.lineComment = source.lineComment;
        } else if (isObject(source.lineComment)) {
            const lineCommentObj = source.lineComment;
            if (typeof lineCommentObj.comment === "string") {
                result = result || {};
                result.lineComment = {
                    comment: lineCommentObj.comment,
                    noIndent: lineCommentObj.noIndent
                };
            } else {
                console.warn(`[${languageId}]: language configuration: expected \`comments.lineComment.comment\` to be a string.`);
            }
        } else {
            console.warn(`[${languageId}]: language configuration: expected \`comments.lineComment\` to be a string or an object with comment property.`);
        }
    }
    if (typeof source.blockComment !== "undefined") {
        if (!isCharacterPair(source.blockComment)) {
            console.warn(`[${languageId}]: language configuration: expected \`comments.blockComment\` to be an array of two strings.`);
        } else {
            result = result || {};
            result.blockComment = source.blockComment;
        }
    }
    return result;
}

// 权威 :194-221：brackets 仍是二元组数组（内部形态也如此），只做逐项校验
function extractValidBrackets(languageId, configuration) {
    const source = configuration.brackets;
    if (typeof source === "undefined") {
        return undefined;
    }
    if (!Array.isArray(source)) {
        console.warn(`[${languageId}]: language configuration: expected \`brackets\` to be an array.`);
        return undefined;
    }

    let result = undefined;
    for (let i = 0, len = source.length; i < len; i++) {
        const pair = source[i];
        if (!isCharacterPair(pair)) {
            console.warn(`[${languageId}]: language configuration: expected \`brackets[${i}]\` to be an array of two strings.`);
            continue;
        }

        result = result || [];
        result.push(pair);
    }
    return result;
}

// 权威 :223-270：**二元组 → { open, close }**（本次崩溃的修复点）
function extractValidAutoClosingPairs(languageId, configuration) {
    const source = configuration.autoClosingPairs;
    if (typeof source === "undefined") {
        return undefined;
    }
    if (!Array.isArray(source)) {
        console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs\` to be an array.`);
        return undefined;
    }

    let result = undefined;
    for (let i = 0, len = source.length; i < len; i++) {
        const pair = source[i];
        if (Array.isArray(pair)) {
            if (!isCharacterPair(pair)) {
                console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}]\` to be an array of two strings or an object.`);
                continue;
            }
            result = result || [];
            result.push({ open: pair[0], close: pair[1] });
        } else {
            if (!isObject(pair)) {
                console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}]\` to be an array of two strings or an object.`);
                continue;
            }
            if (typeof pair.open !== "string") {
                console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}].open\` to be a string.`);
                continue;
            }
            if (typeof pair.close !== "string") {
                console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}].close\` to be a string.`);
                continue;
            }
            if (typeof pair.notIn !== "undefined") {
                if (!isStringArr(pair.notIn)) {
                    console.warn(`[${languageId}]: language configuration: expected \`autoClosingPairs[${i}].notIn\` to be a string array.`);
                    continue;
                }
            }
            result = result || [];
            result.push({ open: pair.open, close: pair.close, notIn: pair.notIn });
        }
    }
    return result;
}

// 权威 :272-301：同样二元组 → { open, close }，但**不**接受 notIn（内部形态也不带）
function extractValidSurroundingPairs(languageId, configuration) {
    const source = configuration.surroundingPairs;
    if (typeof source === "undefined") {
        return undefined;
    }
    if (!Array.isArray(source)) {
        console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs\` to be an array.`);
        return undefined;
    }

    let result = undefined;
    for (let i = 0, len = source.length; i < len; i++) {
        const pair = source[i];
        if (Array.isArray(pair)) {
            if (!isCharacterPair(pair)) {
                console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs[${i}]\` to be an array of two strings or an object.`);
                continue;
            }
            result = result || [];
            result.push({ open: pair[0], close: pair[1] });
        } else {
            if (!isObject(pair)) {
                console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs[${i}]\` to be an array of two strings or an object.`);
                continue;
            }
            if (typeof pair.open !== "string") {
                console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs[${i}].open\` to be a string.`);
                continue;
            }
            if (typeof pair.close !== "string") {
                console.warn(`[${languageId}]: language configuration: expected \`surroundingPairs[${i}].close\` to be a string.`);
                continue;
            }
            result = result || [];
            result.push({ open: pair.open, close: pair.close });
        }
    }
    return result;
}

// 权威 :303-325：字段存在即返回数组（全项非法时是 `[]`，不是 undefined —— 照实移植）
function extractValidColorizedBracketPairs(languageId, configuration) {
    const source = configuration.colorizedBracketPairs;
    if (typeof source === "undefined") {
        return undefined;
    }
    if (!Array.isArray(source)) {
        console.warn(`[${languageId}]: language configuration: expected \`colorizedBracketPairs\` to be an array.`);
        return undefined;
    }

    const result = [];
    for (let i = 0, len = source.length; i < len; i++) {
        const pair = source[i];
        if (!isCharacterPair(pair)) {
            console.warn(`[${languageId}]: language configuration: expected \`colorizedBracketPairs[${i}]\` to be an array of two strings.`);
            continue;
        }
        result.push([pair[0], pair[1]]);
    }
    return result;
}

// 权威 :327-378：action.indent 的四个字符串映射到 IndentAction，beforeText 必填
function extractValidOnEnterRules(languageId, configuration) {
    const source = configuration.onEnterRules;
    if (typeof source === "undefined") {
        return undefined;
    }
    if (!Array.isArray(source)) {
        console.warn(`[${languageId}]: language configuration: expected \`onEnterRules\` to be an array.`);
        return undefined;
    }

    let result = undefined;
    for (let i = 0, len = source.length; i < len; i++) {
        const onEnterRule = source[i];
        if (!isObject(onEnterRule)) {
            console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}]\` to be an object.`);
            continue;
        }
        if (!isObject(onEnterRule.action)) {
            console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}].action\` to be an object.`);
            continue;
        }
        let indentAction;
        if (onEnterRule.action.indent === "none") {
            indentAction = IndentAction.None;
        } else if (onEnterRule.action.indent === "indent") {
            indentAction = IndentAction.Indent;
        } else if (onEnterRule.action.indent === "indentOutdent") {
            indentAction = IndentAction.IndentOutdent;
        } else if (onEnterRule.action.indent === "outdent") {
            indentAction = IndentAction.Outdent;
        } else {
            console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}].action.indent\` to be 'none', 'indent', 'indentOutdent' or 'outdent'.`);
            continue;
        }
        const action = { indentAction };
        if (onEnterRule.action.appendText) {
            if (typeof onEnterRule.action.appendText === "string") {
                action.appendText = onEnterRule.action.appendText;
            } else {
                console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}].action.appendText\` to be undefined or a string.`);
            }
        }
        if (onEnterRule.action.removeText) {
            if (typeof onEnterRule.action.removeText === "number") {
                action.removeText = onEnterRule.action.removeText;
            } else {
                console.warn(`[${languageId}]: language configuration: expected \`onEnterRules[${i}].action.removeText\` to be undefined or a number.`);
            }
        }
        const beforeText = parseRegex(languageId, `onEnterRules[${i}].beforeText`, onEnterRule.beforeText);
        if (!beforeText) {
            continue;
        }
        const resultingOnEnterRule = { beforeText, action };
        if (onEnterRule.afterText) {
            const afterText = parseRegex(languageId, `onEnterRules[${i}].afterText`, onEnterRule.afterText);
            if (afterText) {
                resultingOnEnterRule.afterText = afterText;
            }
        }
        if (onEnterRule.previousLineText) {
            const previousLineText = parseRegex(languageId, `onEnterRules[${i}].previousLineText`, onEnterRule.previousLineText);
            if (previousLineText) {
                resultingOnEnterRule.previousLineText = previousLineText;
            }
        }
        result = result || [];
        result.push(resultingOnEnterRule);
    }

    return result;
}

// 权威 :442-470：字符串 → RegExp(pattern, '')；对象 → RegExp(pattern, flags)
function parseRegex(languageId, confPath, value) {
    if (typeof value === "string") {
        try {
            return new RegExp(value, "");
        } catch (err) {
            console.warn(`[${languageId}]: Invalid regular expression in \`${confPath}\`: `, err);
            return undefined;
        }
    }
    if (isObject(value)) {
        if (typeof value.pattern !== "string") {
            console.warn(`[${languageId}]: language configuration: expected \`${confPath}.pattern\` to be a string.`);
            return undefined;
        }
        if (typeof value.flags !== "undefined" && typeof value.flags !== "string") {
            console.warn(`[${languageId}]: language configuration: expected \`${confPath}.flags\` to be a string.`);
            return undefined;
        }
        try {
            return new RegExp(value.pattern, value.flags);
        } catch (err) {
            console.warn(`[${languageId}]: Invalid regular expression in \`${confPath}\`: `, err);
            return undefined;
        }
    }
    console.warn(`[${languageId}]: language configuration: expected \`${confPath}\` to be a string or an object.`);
    return undefined;
}

// 权威 :472-494：increaseIndentPattern / decreaseIndentPattern 均解析成功才算有效；
// 另两项可选，解析失败时该字段为 undefined（与权威一致，不剔除整条规则）
function mapIndentationRules(languageId, indentationRules) {
    const increaseIndentPattern = parseRegex(languageId, `indentationRules.increaseIndentPattern`, indentationRules.increaseIndentPattern);
    if (!increaseIndentPattern) {
        return undefined;
    }
    const decreaseIndentPattern = parseRegex(languageId, `indentationRules.decreaseIndentPattern`, indentationRules.decreaseIndentPattern);
    if (!decreaseIndentPattern) {
        return undefined;
    }

    const result = {
        increaseIndentPattern: increaseIndentPattern,
        decreaseIndentPattern: decreaseIndentPattern
    };

    if (indentationRules.indentNextLinePattern) {
        result.indentNextLinePattern = parseRegex(languageId, `indentationRules.indentNextLinePattern`, indentationRules.indentNextLinePattern);
    }
    if (indentationRules.unIndentedLinePattern) {
        result.unIndentedLinePattern = parseRegex(languageId, `indentationRules.unIndentedLinePattern`, indentationRules.unIndentedLinePattern);
    }

    return result;
}

/**
 * 把序列化形态的语言配置归一化为 monaco `setLanguageConfiguration` 要求的内部形态。
 * 对齐权威 :380-435 的 `LanguageConfigurationFileHandler.extractValidConfig`。
 *
 * @param {string} languageId 仅用于 console.warn 前缀（与权威一致）
 * @param {object} configuration 序列化形态（language-configuration.json 的内容形态）
 * @returns {object} 内部形态 ExplicitLanguageConfiguration
 */
export function extractValidConfig(languageId, configuration) {
    const comments = extractValidCommentRule(languageId, configuration);
    const brackets = extractValidBrackets(languageId, configuration);
    const autoClosingPairs = extractValidAutoClosingPairs(languageId, configuration);
    const surroundingPairs = extractValidSurroundingPairs(languageId, configuration);
    const colorizedBracketPairs = extractValidColorizedBracketPairs(languageId, configuration);
    const autoCloseBefore = typeof configuration.autoCloseBefore === "string" ? configuration.autoCloseBefore : undefined;
    const wordPattern = configuration.wordPattern ? parseRegex(languageId, `wordPattern`, configuration.wordPattern) : undefined;
    const indentationRules = configuration.indentationRules ? mapIndentationRules(languageId, configuration.indentationRules) : undefined;
    let folding = undefined;
    if (configuration.folding) {
        const rawMarkers = configuration.folding.markers;
        const startMarker = rawMarkers && rawMarkers.start ? parseRegex(languageId, `folding.markers.start`, rawMarkers.start) : undefined;
        const endMarker = rawMarkers && rawMarkers.end ? parseRegex(languageId, `folding.markers.end`, rawMarkers.end) : undefined;
        const markers = startMarker && endMarker ? { start: startMarker, end: endMarker } : undefined;
        folding = {
            offSide: configuration.folding.offSide,
            markers
        };
    }
    const onEnterRules = extractValidOnEnterRules(languageId, configuration);

    return {
        comments,
        brackets,
        wordPattern,
        indentationRules,
        onEnterRules,
        autoClosingPairs,
        surroundingPairs,
        colorizedBracketPairs,
        autoCloseBefore,
        folding,
        __electricCharacterSupport: undefined
    };
}
