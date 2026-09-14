// 语言 id → 显示名。
//
// 对齐 editor/common/services/languageService.ts:64-66 的 getLanguageName：显示名就是语言注册表
// 里的 name，由 editor/common/services/languagesRegistry.js 的 bestName 规则求出 ——
// `name = aliases[0] || languageId`。注册侧的 aliases 与扩展在 package.json 的
// `contributes.languages[].aliases` 同义（monaco 内建语言见
// editor/common/languages/modesRegistry.js:45-49 与 esm/vs/languages/definitions/<lang>/register.js）。
//
// 注意：monaco 的 `languages.getLanguages()` 回传的是注册描述本身
// （standalone/browser/standaloneLanguages.js:32-36 直接返回 ModesRegistry 的 desc 数组，
// **没有 name 字段**），所以这里按同一条 bestName 规则取 aliases[0]。
// 显示名因此与 VS Code 一致（Plain Text / JSON / JavaScript / TypeScript / Markdown，
// 以及内置扩展 extensions/pvf 注册的 Squirrel），不再需要消费侧自建映射表。
import { monaco } from "@/monaco/setup.js";

const _names = new Map();

export function getLanguageName(languageId) {
    if (_names.has(languageId)) return _names.get(languageId);
    const aliases = monaco.languages.getLanguages().find(language => language.id === languageId)?.aliases;
    const name = (Array.isArray(aliases) ? aliases[0] : null) || languageId;
    _names.set(languageId, name);
    return name;
}
