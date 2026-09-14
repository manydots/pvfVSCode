// files 段的配置项登记（对齐 <vscode>/src/vs/workbench/contrib/files/browser/files.contribution.ts:147-386
// 的 registerConfiguration({ id: 'files', order: 9, ... })）。
//
// 本文件目前登记语言识别需要的 `files.associations`（权威 :183-190）与编码决策链需要的
// `files.encoding` / `files.autoGuessEncoding` / `files.candidateGuessEncodings`（权威 :190-215）。
// files 段其余配置项各自随其消费方落地（files.exclude 随资源管理器过滤、files.eol 随行尾序列服务）。
// 描述文本取权威原文（本仓库尚未迁入 nls 本地化，界面文案保持英文原文以免与权威取值分叉）。
//
// 三项编码设置的 scope 均为 ConfigurationScope.LANGUAGE_OVERRIDABLE（权威 configurationRegistry.ts:208，
// 枚举值 6）；本仓库未迁入 `[language]` 覆盖段，scope 无消费方，故不登记该字段（见第 5 节同名偏差）。
import { configurationRegistry } from "@/platform/configuration/common/configurationRegistry.js";
import { FILES_ASSOCIATIONS_CONFIG, FILES_ENCODING_CONFIG, FILES_AUTO_GUESS_ENCODING_CONFIG, FILES_CANDIDATE_GUESS_ENCODINGS_CONFIG } from "@/platform/files/common/files.js";
import { SUPPORTED_ENCODINGS, GUESSABLE_ENCODINGS } from "@/workbench/services/textfile/common/encoding.js";

configurationRegistry.registerConfiguration({
    id: "files",
    order: 9,
    title: "Files",
    properties: {
        [FILES_ASSOCIATIONS_CONFIG]: {
            type: "object",
            markdownDescription:
                'Configure [glob patterns](https://aka.ms/vscode-glob-patterns) of file associations to languages (for example `"*.extension": "html"`). Patterns will match on the absolute path of a file if they contain a path separator and will match on the name of the file otherwise. These have precedence over the default associations of the languages installed.',
            additionalProperties: {
                type: "string"
            }
        },
        [FILES_ENCODING_CONFIG]: {
            type: "string",
            enum: Object.keys(SUPPORTED_ENCODINGS),
            default: "utf8",
            description: "The default character set encoding to use when reading and writing files. This setting can also be configured per language.",
            enumDescriptions: Object.keys(SUPPORTED_ENCODINGS).map(key => SUPPORTED_ENCODINGS[key].labelLong),
            enumItemLabels: Object.keys(SUPPORTED_ENCODINGS).map(key => SUPPORTED_ENCODINGS[key].labelLong)
        },
        [FILES_AUTO_GUESS_ENCODING_CONFIG]: {
            type: "boolean",
            default: false,
            // 权威原文：`#files.encoding#` 是 nls 的配置链接语法，本仓库无 nls，改为反引号包裹的设置名。
            markdownDescription:
                "When enabled, the editor will attempt to guess the character set encoding when opening files. This setting can also be configured per language. Note, this setting is not respected by text search. Only `files.encoding` is respected."
        },
        [FILES_CANDIDATE_GUESS_ENCODINGS_CONFIG]: {
            type: "array",
            items: {
                type: "string",
                enum: Object.keys(GUESSABLE_ENCODINGS),
                enumDescriptions: Object.keys(GUESSABLE_ENCODINGS).map(key => GUESSABLE_ENCODINGS[key].labelLong)
            },
            default: [],
            markdownDescription: "List of character set encodings that the editor should attempt to guess in the order they are listed. In case it cannot be determined, `files.encoding` is respected"
        }
    }
});
