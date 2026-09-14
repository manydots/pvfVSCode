// 内置文件清单 —— 不经过工作区 / 文件服务就能打开的编辑器输入（样本文件 + 欢迎页），
// 以及启动时要打开的那一个。
//
// 为什么需要这份清单：权威的文件快速打开把「已打开的编辑器」与「工作区文件搜索结果」合并
// （<vscode>/src/vs/workbench/contrib/search/browser/anythingQuickAccess.ts:284-360、
// :1002-1060 的合并顺序），后者来自 ISearchService 的工作区文件索引。本仓库没有工作区、
// 文件服务与搜索服务，取数来源即这份清单（偏差登记在 docs/vscode-reference.md 第 5 节）。
//
// 样本清单不写死条目：用 `import.meta.glob` 在**构建期**展开 src/samples/ 目录（Vite 内置能力，
// 不进运行期，与 builtinExtensions.js「构建期静态引入」的做法一致），因此往 src/samples/ 里
// 丢一个新样本文件就自动出现在「快速打开 → 内置文件」里，不需要改代码。
// 素材是「PVF 归档内文件解码后的文本形态」，扩展名决定语言（见下方注释），当前有：
//   common.nut                            Squirrel 脚本（.nut）
//   n_string.lst                          .lst 列表（decodeLst 的「数字 `路径`」逐行形态）
//   690017000.stk                         .stk token 流（decodeToken：`[标签]` + 反引号串 + 数字）
//   2011_championship_pack_at_ft.stk      同上，带 UTF-8 BOM 的一份
//   stringtable.bin                       TW 归档字符串表视图（`索引>文本` 逐行）
// 用 `?raw` 内联原始文本：打开路径保持同步，没有网络请求与失败分支。后续接入 PVF 归档解析后，
// 这里换成「从归档解出某个文件的内容」，editorGroupService.openEditor 的输入结构不变
// （只把 resource 的 scheme 换成归档 provider 的）。
//
// 语言不写死：由 resource 的扩展名经语言服务识别（识别链见
// src/workbench/services/language/common/languageAssociations.js，语言声明来自内置扩展
// src/extensions/pvf/package.json 的 contributes.languages）。
import { URI } from "@/base/common/uri.js";
import { WELCOME_TEXT } from "@/welcome.js";
import { UTF8_with_bom } from "@/workbench/services/textfile/common/encoding.js";

// 样本目录与内联方式。键是匹配到的文件路径（别名写法下形态由 Vite 决定），
// 故下面只从键里取文件名，资源路径另行拼接 —— 与键的形态解耦。
const SAMPLE_DIRECTORY = "samples";
const SAMPLE_MODULES = import.meta.glob("@/samples/*", { query: "?raw", import: "default", eager: true });

// 启动时打开的样本（对齐 VS Code 启动恢复编辑器输入的语义）：没有编辑器持久化，
// 固定打开这份 Squirrel 脚本 —— 启动即可看到词法高亮与面包屑符号段。
const DEFAULT_PREVIEW_NAME = "common.nut";

// UTF-8 BOM（U+FEFF）前缀。对齐 encoding.ts:280-315 的 BOM 探测判据；
// monaco 建模型时会把它摘出来单独记在 buffer.BOM 上（pieceTreeTextBufferBuilder.js:71-72）。
const BOM_CHARACTER = "\uFEFF";

// 编辑器输入结构见 editorGroupService._createEntry；id 用 `file:` 前缀表示文件型输入，
// 与新建文件用的 `untitled:` 前缀同构。
function sampleFile(name, content) {
    const path = `${SAMPLE_DIRECTORY}/${name}`;
    return {
        id: `file:${path}`,
        name,
        resource: URI.file(path),
        content,
        // 文本编码：内联素材没有文件服务跑读盘决策链（textFileService.ts:834-886），
        // 这里按同一判据预置 —— 带 BOM 的素材记 UTF-8 with BOM；未带的留给 files.encoding 回落。
        encoding: content.startsWith(BOM_CHARACTER) ? UTF8_with_bom : undefined,
        // 固定标签（非斜体的临时预览态）：内置文件不应被后续打开的文件顶掉。
        pinned: true
    };
}

// 样本文件清单：可被「快速打开（Ctrl+P）」与「打开的编辑器」列表切换。
// 键序即目录内的字典序，故展示顺序稳定。
export const SAMPLE_FILES = Object.keys(SAMPLE_MODULES)
    .sort()
    .map(key => sampleFile(key.slice(key.lastIndexOf("/") + 1), SAMPLE_MODULES[key]));

// 欢迎页：不是文件（没有 resource），语言只能显式给出 —— 与「资源缺失时按显式语言」的
// 识别规则一致（workbench/common/editor/textEditorModel.ts:204-213）。
export const WELCOME_FILE = {
    id: "welcome",
    name: "欢迎",
    languageId: "plaintext",
    content: WELCOME_TEXT,
    pinned: true
};

// 内置文件全集（清单里同时给出 welcome 的取数来源与构建期素材）。
export const BUILT_IN_FILES = [...SAMPLE_FILES, WELCOME_FILE];

// 启动时打开的输入；样本被移走时退回清单第一项（不至于打不开任何编辑器）。
export const DEFAULT_PREVIEW_FILE = SAMPLE_FILES.find(file => file.name === DEFAULT_PREVIEW_NAME) ?? SAMPLE_FILES[0];
