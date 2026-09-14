// 资源标识（对齐 <vscode>/src/vs/base/common/uri.ts）。
//
// 实现直接复用 monaco 发行包中的同一模块 —— URI 属 VS Code 的 base 层，与编辑器内核同源，
// 不另写一份（门控 §3：复用架构原语，禁止自造平行体系）。monaco 的包导出映射
// （package.json 的 "./*": "./esm/vs/*.js"）让 base 层模块可按源路径引入，本仓库已有同类用法
// （src/monaco/documentSymbols.js、src/workbench/services/language/common/languageAssociations.js）。
//
// 应用代码一律从这里取 URI，以便日后替换实现时不必改动调用点。
export { URI } from "monaco-editor/base/common/uri.js";
