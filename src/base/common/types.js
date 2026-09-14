// 通用类型判定（对齐 <vscode>/src/vs/base/common/types.ts:11-45）。
//
// 与 uri.js 同策：base 层判定函数直接复用 monaco 发行包中的同一模块，不另写一份
// （门控 §3：复用架构原语，禁止自造平行体系）。注意 monaco 的 isObject 与直觉不同 ——
// 它排除 Array / RegExp / Date（types.ts:33-42），语言配置归一化依赖这一点区分
// 「二元组」与「对象」，见 @/workbench/contrib/codeEditor/common/languageConfigurationExtensionPoint.js。
//
// 应用代码一律从这里取判定函数，以便日后替换实现时不必改动调用点。
export { isObject, isString } from "monaco-editor/base/common/types.js";
