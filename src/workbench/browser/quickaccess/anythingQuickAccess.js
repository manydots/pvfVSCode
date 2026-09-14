// 文件快速输入（Anything provider，空前缀 —— 默认提供者）。
//
// 权威来源（microsoft/vscode）：
//   workbench/contrib/search/browser/anythingQuickAccess.ts:101        PREFIX = ''
//   workbench/contrib/search/browser/anythingQuickAccess.ts:835-872     空查询时的 helpEntries（前缀清单）
//   workbench/contrib/search/browser/quickAccess.contribution.ts:21     占位符文案
//   workbench/contrib/search/browser/anythingQuickAccess.ts             空查询返回「最近打开的编辑器」历史
//
// 裁剪（登记在 docs/vscode-reference.md 第 5 节）：本仓库没有工作区与文件搜索服务
// （权威经 ISearchService 搜索全部工作区文件），文件条目因此只来自「已打开的编辑器 + 内置文件」；
// 另未迁移 `@`（编辑器符号）、`:`（跳转行）、`#`（工作区符号）三个前缀。
import { registerQuickAccessProvider, showQuickAccess } from "@/platform/quickinput/quickAccess.js";
import { BUILT_IN_FILES } from "@/builtInFiles.js";
import { activateEditor, editorGroup, openEditor } from "@/workbench/contrib/editor/editorGroupService.js";
import { getKeybindingLabel } from "@/menu/actions.js";
import { COMMANDS_QUICK_ACCESS_PREFIX } from "@/workbench/contrib/quickaccess/browser/commandsQuickAccess.js";

// 命令提供者的 helpEntry 绑定的命令（quickAccess.contribution.ts:47 的 commandId）。
const SHOW_ALL_COMMANDS_ID = "workbench.action.showCommands";

// 资源路径 = 输入 id 去掉协议前缀（file:samples/common.nut → samples/common.nut）。
function resourcePath(id) {
    const index = String(id).indexOf(":");
    return index >= 0 ? String(id).slice(index + 1) : String(id);
}

// 内置文件条目：条目 id 即编辑器输入 id（打开后由 openEditor 按 id 去重，已是打开状态则激活）。
function openFilePick(file) {
    return {
        id: file.id,
        label: file.name,
        description: resourcePath(file.id),
        icon: "file",
        accept() {
            openEditor(file);
        }
    };
}

// 已打开的编辑器条目：接受即激活（对应权威「最近打开的编辑器」历史项，anythingQuickAccess.ts:408-409）。
function toFilePick(editor) {
    return {
        id: editor.id,
        label: editor.name,
        description: resourcePath(editor.id),
        icon: "file",
        accept() {
            activateEditor(editor.id);
        }
    };
}

// 过滤：空格分词，每个词都要出现在名称或路径中（不区分大小写）。
function matches(file, terms) {
    if (!terms.length) return true;
    const name = file.name.toLowerCase();
    const path = resourcePath(file.id).toLowerCase();
    return terms.every(term => name.includes(term) || path.includes(term));
}

export function registerAnythingQuickAccess() {
    registerQuickAccessProvider({
        prefix: "",
        placeholder: "按名称搜索文件。",
        getPicks(filter, options) {
            const terms = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
            const picks = [];

            if (!terms.length) {
                // 空查询：最近打开的编辑器 + 内置文件 +（includeHelp 时）帮助项
                // （对齐 anythingQuickAccess.ts:408-409 空 filter 追加 getHelpPicks，:829-830 有过滤词时不出帮助项）。
                if (editorGroup.editors.length) {
                    picks.push({ id: "separator:recentlyOpened", kind: -1, label: "最近打开的编辑器" });
                    picks.push(...editorGroup.editors.map(toFilePick));
                }
                const closedBuiltIns = BUILT_IN_FILES.filter(file => !editorGroup.editors.some(editor => editor.id === file.id));
                if (closedBuiltIns.length) {
                    picks.push({ id: "separator:builtIn", kind: -1, label: "内置文件" });
                    picks.push(...closedBuiltIns.map(openFilePick));
                }
                if (options?.includeHelp) {
                    picks.push({ id: "separator:help", kind: -1, label: "帮助" });
                    picks.push(helpPick());
                }
                return picks;
            }

            const candidates = [
                ...editorGroup.editors.map(editor => ({ id: editor.id, name: editor.name, editor })),
                ...BUILT_IN_FILES.filter(file => !editorGroup.editors.some(editor => editor.id === file.id))
            ].filter(file => matches(file, terms));

            for (const file of candidates) {
                picks.push(file.editor ? toFilePick(file.editor) : openFilePick(file));
            }
            return picks;
        }
    });
}

// helpEntries：列出可用的提供者前缀（对齐 anythingQuickAccess.ts:829-872 的 getHelpPicks）：
// 只在无过滤词时出现；label 取 commandCenterLabel ?? description、description 取提供者前缀、
// keybinding 取该 helpEntry 的 commandId 对应快捷键；accept 即以该前缀再次 quickAccess.show
// （`preserveValue: true` + 透传 providerOptions），由控制器替换当前会话。
function helpPick() {
    return {
        id: `help:${COMMANDS_QUICK_ACCESS_PREFIX}`,
        label: "显示并运行命令",
        description: COMMANDS_QUICK_ACCESS_PREFIX,
        keybinding: getKeybindingLabel(SHOW_ALL_COMMANDS_ID),
        accept() {
            showQuickAccess(COMMANDS_QUICK_ACCESS_PREFIX, {
                preserveValue: true,
                providerOptions: { includeHelp: true, from: "commandCenter" }
            });
        }
    };
}
