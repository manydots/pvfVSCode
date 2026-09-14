// PVF 内置扩展的激活入口（对齐 VS Code 扩展的 `activate(context)` 契约）。
//
// 激活做的事：把清单里声明的语言补上「清单表达不了」的三类注册 ——
//   1. 词法（Monarch）→ monaco.languages.setMonarchTokensProvider
//      （清单里的等价物是 contributes.grammars 指向的 TextMate 语法，M5 引入 vscode-textmate 后切换）；
//   2. 语言配置 → monaco.languages.setLanguageConfiguration
//      （清单里的等价物是 contributes.languages[].configuration 指向的 language-configuration.json，
//       需要扩展资源加载，M3 扩展宿主落地后切换）；
//      注册前必须经 extractValidConfig 归一化：扩展里写的是「序列化形态」（二元组），
//      monaco 要求内部形态（对象），见 languageConfigurationExtensionPoint.js 文件头。
//   3. 语言特性提供者（文档符号）→ monaco.languages.registerDocumentSymbolProvider
//      （清单里的等价物是 vscode.languages.registerDocumentSymbolProvider，属运行时能力层，M3）。
// 因此 M1 的清单只声明语言本身（id / extensions / aliases / mimetypes），上述三项在 activate 里
// 以代码注册。切换时机与差异见 docs/vscode-reference.md 第 5 节、docs/plugin-system-design.md 第 12 节。
//
// 为什么 M1 能直接调用 activate：M1 还没有扩展宿主，激活由
// src/workbench/contrib/pvf/browser/pvf.contribution.js 在启动时进程内调用；
// 激活事件（清单的 activationEvents）与按语言懒激活属 M3。
import { monaco } from "@/monaco/setup.js";
import { extractValidConfig } from "@/workbench/contrib/codeEditor/common/languageConfigurationExtensionPoint.js";
import { pvfTextLanguageConfiguration, pvfTextLanguageDefinition } from "@/extensions/pvf/browser/pvfText.js";
import { squirrelLanguageConfiguration, squirrelLanguageDefinition } from "@/extensions/pvf/browser/squirrel.js";
import { parseSquirrelSymbols, toDocumentSymbols } from "@/extensions/pvf/browser/squirrelSymbols.js";

// 清单 src/extensions/pvf/package.json 里 pvfTextLanguageDefinition 覆盖的语言 id；
// 三者的语言形态相同，共用同一份词法与语言配置（见 pvfText.js 文件头）。
const PVF_TEXT_LANGUAGE_IDS = ["pvf-list", "pvf-dat", "pvf-token"];

/**
 * @param {{ subscriptions: { dispose(): void }[] }} context 扩展上下文（对齐 VS Code 的
 *   ExtensionContext：本仓库只用到 subscriptions，其余字段随扩展宿主在 M3 引入）。
 */
export function activate(context) {
    // Squirrel：词法 + 语言配置 + 文档符号（面包屑符号段与粘性滚动的 outline 层由它取数）
    context.subscriptions.push(monaco.languages.setMonarchTokensProvider("squirrel", squirrelLanguageDefinition));
    context.subscriptions.push(monaco.languages.setLanguageConfiguration("squirrel", extractValidConfig("squirrel", squirrelLanguageConfiguration)));
    context.subscriptions.push(
        monaco.languages.registerDocumentSymbolProvider("squirrel", {
            provideDocumentSymbols(model) {
                return toDocumentSymbols(parseSquirrelSymbols(model.getValue().split(/\r?\n/)), monaco.languages.SymbolKind);
            }
        })
    );

    for (const languageId of PVF_TEXT_LANGUAGE_IDS) {
        context.subscriptions.push(monaco.languages.setMonarchTokensProvider(languageId, pvfTextLanguageDefinition));
        context.subscriptions.push(monaco.languages.setLanguageConfiguration(languageId, extractValidConfig(languageId, pvfTextLanguageConfiguration)));
    }
}

// 对齐 VS Code 的可选 `deactivate()`：宿主撤销该扩展的全部贡献时调用
// （M1 是进程内激活，activate 的返回订阅由调用方持有；此处的签名先与契约对齐）。
export function deactivate() {}
