// 状态栏贡献（对齐 VS Code 的注册划分：
//   - workbench/browser/parts/editor/editorStatus.ts：编辑器状态条目
//   - workbench/contrib/markers/browser/markers.contribution.ts：问题计数条目
//   - workbench/browser/actions/layoutActions.ts：ToggleStatusbarVisibilityAction
//   - 扩展贡献的状态条目（登录 / Go Live / Prettier）按截图迁移为等价条目）。
import { watch } from "vue";
import { MenuId } from "@/menu/menuId.js";
import { registerAction2 } from "@/menu/actions.js";
import { ContextKeyExpr, contextKeys } from "@/menu/contextKey.js";
import { appState, setStatus } from "@/menu/appState.js";
import { monaco } from "@/monaco/setup.js";
import { getLanguageName } from "@/monaco/languageNames.js";
import { getActiveEditorInput, getEditorIcon, getModel } from "@/workbench/contrib/editor/editorGroupService.js";
import { SUPPORTED_ENCODINGS } from "@/workbench/services/textfile/common/encoding.js";
import { StatusbarAlignment, addEntry } from "@/workbench/contrib/statusbar/statusbarService.js";
import { showPanelContainer } from "@/workbench/viewService.js";
import { OUTPUT_CONTAINER_ID, PROBLEMS_CONTAINER_ID } from "@/workbench/contrib/panel/panel.contribution.js";

// 语言显示名取自语言注册表（getLanguageName，对齐 editorStatus.ts 的用法），
// 不再维护本地「id → 名称」映射表 —— 见 monaco/languageNames.js。

const RIGHT = StatusbarAlignment.RIGHT;
const LEFT = StatusbarAlignment.LEFT;

// ---------------- 左侧：客户端状态与问题计数 ----------------
const statusMessageEntry = addEntry({ name: "客户端状态", text: appState.statusText, tooltip: appState.statusText }, "pvfVSCode.statusMessage", LEFT, 100);

// 问题计数（markers.contribution.ts:615-684）：$(error) N  $(warning) M，点击切换问题面板。
// 标记服务尚未接入，计数恒为 0；注册即显示条目（与 VS Code 无问题时仍显示 0/0 的行为一致）。
addEntry(
    {
        name: "问题",
        text: "$(error) 0  $(warning) 0",
        ariaLabel: "错误: 0，警告: 0",
        tooltip: "错误: 0，警告: 0",
        command: "workbench.actions.view.toggleProblems"
    },
    "status.problems",
    LEFT,
    50
);

// ---------------- 右侧：编辑器状态（editorStatus.ts，优先级取源码数值） ----------------
// 缩进 / 编码 / 语言模式的快速选择器尚未接入，因此对应条目不绑定命令（VS Code 中绑定的是
// changeEditorIndentation / changeEncoding / changeLanguageMode）；无命令的条目在状态栏中
// 无 hover 反馈，与 VS Code 对无命令条目的处理一致。
const selectionEntry = addEntry({ name: "编辑器选择", tooltip: "转到行/列…", command: "workbench.action.gotoLine" }, "status.editor.selection", RIGHT, 100.5);
const indentationEntry = addEntry({ name: "编辑器缩进", tooltip: "选择缩进" }, "status.editor.indentation", RIGHT, 100.4);
const encodingEntry = addEntry({ name: "编辑器编码", tooltip: "选择编码" }, "status.editor.encoding", RIGHT, 100.3);
const eolEntry = addEntry({ name: "编辑器行尾序列", tooltip: "选择行尾序列", command: "workbench.action.editor.changeEOL" }, "status.editor.eol", RIGHT, 100.2);
const languageEntry = addEntry({ name: "编辑器语言", tooltip: "选择语言模式" }, "status.editor.mode", RIGHT, 100.1);

// 扩展条目（对齐截图中的 登录 / Go Live / Prettier；优先级低于编辑器条目，排在右侧）。
addEntry({ name: "账户", text: "$(account) 登录", ariaLabel: "登录", tooltip: "登录以同步设置", command: "pvf.signIn" }, "status.accounts", RIGHT, 100);
addEntry({ name: "Live Server", text: "$(radio-tower) Go Live", ariaLabel: "Go Live", tooltip: "启动 Live Server", command: "extension.liveServer.goOnline" }, "status.liveServer", RIGHT, 1);
addEntry({ name: "Prettier", text: "$(check) Prettier", ariaLabel: "Prettier", tooltip: "Prettier 状态", command: "prettier.openOutput" }, "status.prettier", RIGHT, 0);

// 编辑器状态条目随激活编辑器（光标 / 选区 / 缩进 / 行尾 / 语言）变化而更新
// （对齐 editorStatus.ts updateStatusBar 的触发时机）。
function updateEditorEntries() {
    const active = getActiveEditorInput();
    if (!active) {
        selectionEntry.update({ text: "" });
        indentationEntry.update({ text: "" });
        encodingEntry.update({ text: "" });
        eolEntry.update({ text: "" });
        languageEntry.update({ text: "" });
        return;
    }

    // 单选：`行 X, 列 Y`；有选中内容时追加已选字符数
    //（对齐 editorStatus.ts:338-341 的 nlsSingleSelection / nlsSingleSelectionRange）。
    const { lineNumber, column } = active.cursor;
    const selectionText = active.selectionLength > 0 ? `行 ${lineNumber}, 列 ${column}（已选择 ${active.selectionLength} 个字符）` : `行 ${lineNumber}, 列 ${column}`;
    selectionEntry.update({ text: selectionText, ariaLabel: selectionText, tooltip: "转到行/列…", command: "workbench.action.gotoLine" });

    // 缩进（editorStatus.ts:801-807）：插入空格时显示 `空格: N`，否则显示 `制表符: N`。
    const indentationText = active.insertSpaces ? `空格: ${active.tabSize}` : `制表符: ${active.tabSize}`;
    indentationEntry.update({ text: indentationText, ariaLabel: indentationText });

    // 编码（editorStatus.ts:900-906）：先按 raw id 查 SUPPORTED_ENCODINGS 取 labelShort，
    // 查不到才原样显示 —— 与权威的 `encodingInfo ? labelShort : rawEncoding` 一致。
    const rawEncoding = active.encoding;
    const encodingInfo = typeof rawEncoding === "string" ? SUPPORTED_ENCODINGS[rawEncoding] : undefined;
    const encodingText = encodingInfo ? encodingInfo.labelShort : rawEncoding;
    encodingEntry.update({ text: encodingText, ariaLabel: encodingText });

    // 行尾序列（editorStatus.ts:342-343 的 nlsEOLLF / nlsEOLCRLF）。
    const eolText = active.eol === "\r\n" ? "CRLF" : "LF";
    eolEntry.update({ text: eolText, ariaLabel: eolText });

    // 语言模式：图标 + 名称（截图中的 `{ } JSON` 形式，名称取自语言注册表、
    // 图标取自编辑器语言图标映射）。
    const languageName = getLanguageName(active.languageId);
    const languageText = `$(${getEditorIcon(active)}) ${languageName}`;
    languageEntry.update({ text: languageText, ariaLabel: languageName, tooltip: "选择语言模式" });
}

watch(
    () => {
        const active = getActiveEditorInput();
        if (!active) return null;
        return [active.id, active.languageId, active.encoding, active.eol, active.insertSpaces, active.tabSize, active.cursor.lineNumber, active.cursor.column, active.selectionLength];
    },
    updateEditorEntries,
    { immediate: true }
);

watch(
    () => appState.statusText,
    text => statusMessageEntry.update({ text, tooltip: text })
);

// ---------------- 命令 ----------------
// 更改行尾序列：Monaco 的 pushEOL 支持撤销（对齐 VS Code changeEOL 命令的实现方式，
// 见 workbench/browser/parts/editor/editorStatus.ts 的 EOL 处理）。
registerAction2({
    id: "workbench.action.editor.changeEOL",
    title: "更改行尾序列",
    run() {
        const active = getActiveEditorInput();
        const model = active ? getModel(active.id) : null;
        if (!model) return;
        const next = model.getEOL() === "\r\n" ? monaco.editor.EndOfLineSequence.LF : monaco.editor.EndOfLineSequence.CRLF;
        model.pushEOL(next);
        setStatus(next === monaco.editor.EndOfLineSequence.CRLF ? "行尾序列已切换为 CRLF" : "行尾序列已切换为 LF");
    }
});

// 问题计数条目：切换问题面板（对齐 markers.contribution.ts 的
// workbench.actions.view.toggleProblems —— 面板可见且已停在问题视图时收起）。
registerAction2({
    id: "workbench.actions.view.toggleProblems",
    title: "切换问题面板",
    run() {
        if (appState.panelVisible && appState.activePanelId === PROBLEMS_CONTAINER_ID) {
            appState.panelVisible = false;
            return;
        }
        showPanelContainer(PROBLEMS_CONTAINER_ID);
    }
});

// 账户/扩展条目：能力尚未接入，点击后给出明确说明（与 pvf.* 归档命令的处理方式一致）。
registerAction2({
    id: "pvf.signIn",
    title: "登录",
    run() {
        setStatus("账户登录能力尚未接入");
    }
});

registerAction2({
    id: "extension.liveServer.goOnline",
    title: "Go Live",
    run() {
        setStatus("Live Server 扩展尚未接入");
    }
});

registerAction2({
    id: "prettier.openOutput",
    title: "Prettier: 显示输出",
    run() {
        showPanelContainer(OUTPUT_CONTAINER_ID);
        setStatus("已打开输出面板（Prettier 通道）");
    }
});

// 状态栏显示/隐藏（对齐 layoutActions.ts ToggleStatusbarVisibilityAction）。
registerAction2({
    id: "workbench.action.toggleStatusbarVisibility",
    title: "切换状态栏可见性",
    toggled: ContextKeyExpr.has("statusBarVisible"),
    menu: [
        { id: MenuId.MenubarViewMenu, group: "1_layout", order: 5 },
        { id: MenuId.LayoutControlMenu, group: "1_layout", order: 5 }
    ],
    run() {
        appState.statusBarVisible = !appState.statusBarVisible;
        setStatus(appState.statusBarVisible ? "已显示状态栏" : "已隐藏状态栏");
    }
});

// 初始化状态栏相关上下文键（与 appState 初值一致）。
contextKeys.set("statusBarVisible", appState.statusBarVisible);
