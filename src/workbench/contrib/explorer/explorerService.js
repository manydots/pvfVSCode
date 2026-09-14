// 资源管理器服务（对齐 <vscode>/src/vs/workbench/contrib/files/browser/explorerService.ts
// 中本仓库消费得到的那部分：roots / findClosest / 取数与打开所需的输入映射）。
//
// 工作区形态：单文件夹（WorkbenchState.FOLDER）。权威在这种形态下把 roots[0] 交给树
// （explorerView.ts:848-853：`let input = roots[0]`，只有多文件夹工作区才把 roots 数组交给树），
// 而 AsyncDataTree.setInput 把输入元素当作**不可见的内部根**（asyncDataTree.ts:783
// `this.root.element = input`），根自身不渲染、它的子节点即顶层行。因此本仓库的
// samples 文件夹不会出现成一行，5 个样本文件就是 5 行顶层条目 —— 与 VS Code 打开
// 单个文件夹工程时看到的一致。
//
// 取数来源：本仓库没有工作区、文件服务与搜索服务，样本在构建期内联（src/builtInFiles.js，
// 该偏差已登记在 docs/vscode-reference.md 第 5 节），这里把它组织成 ExplorerItem 树。
import { URI } from "@/base/common/uri.js";
import { SAMPLE_FILES } from "@/builtInFiles.js";
import { ExplorerModel, ExplorerItem } from "@/workbench/contrib/explorer/explorerModel.js";
import { getEditorInput } from "@/workbench/contrib/editor/editorGroupService.js";
import { getFirstLineText, resolveLanguageId } from "@/workbench/services/language/common/languageAssociations.js";
import { getRegisteredLanguageIds } from "@/workbench/services/language/common/languageService.js";

// 与 builtInFiles.js 的样本路径同前缀，故条目的 resource 与内置输入的 resource 逐字相同
// （findClosest 与「取出可打开的输入」都按它匹配）。
const SAMPLE_DIRECTORY = "samples";

// 内置输入按资源索引：资源的身份就是打开用的输入（builtInFiles.js 的 sampleFile 结构）。
const INPUT_BY_RESOURCE = new Map(SAMPLE_FILES.map(file => [file.resource.toString(), file]));

function createModel() {
    // 根文件夹：单文件夹工作区的那个文件夹（对齐 explorerModel.ts:36-40：
    // 每个工作区文件夹一个 isRoot 的 ExplorerItem）。
    const root = new ExplorerItem({ resource: URI.file(SAMPLE_DIRECTORY), name: SAMPLE_DIRECTORY, isDirectory: true });
    for (const file of SAMPLE_FILES) {
        root.addChild(new ExplorerItem({ resource: file.resource, name: file.name }));
    }
    return new ExplorerModel([root]);
}

export const explorerModel = createModel();

// 树的输入（explorerView.ts:849 的 roots[0]）。
export const explorerRoot = explorerModel.roots[0] ?? null;

// explorerModel.ts:71-81 的 findClosest：资源 → 树里的条目。
export function findClosest(resource) {
    return resource ? explorerModel.findClosest(resource) : null;
}

// 取出该资源可打开的编辑器输入；非内置资源返回 null。
export function getBuiltInInput(resource) {
    return resource ? INPUT_BY_RESOURCE.get(resource.toString()) ?? null : null;
}

// 条目的语言 id（图标类名与打开后的语言都取它）。
// 对齐 getIconClasses.ts:92-125 的 detectLanguageId：先问已打开的模型（模型的语言可能被用户
// 改过），没有模型再按路径 + 首行猜（languageService.guessLanguageIdByFilepathOrFirstLine）。
export function getItemLanguageId(item) {
    const input = getBuiltInInput(item.resource);
    const open = input ? getEditorInput(input.id) : null;
    if (open) return open.languageId;

    const firstLine = getFirstLineText(input?.content ?? "");
    return resolveLanguageId(item.resource, undefined, firstLine, getRegisteredLanguageIds());
}
