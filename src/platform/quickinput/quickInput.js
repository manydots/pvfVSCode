// 快速输入（Quick Pick）的状态与交互，单例控制器。
//
// 权威来源（microsoft/vscode）：
//   platform/quickinput/browser/quickInputController.ts   浮层控制器：同一时刻只有一个 current、
//     隐藏后把焦点交回先前元素（hide() 里的 previouslyFocusedElement.focus()）、
//     失焦即隐藏（ignoreFocusOut 默认 false）
//   platform/quickinput/browser/quickInput.ts             QuickPick 的 items / activeItems / accept / focus
//   platform/quickinput/common/quickInput.ts              QuickInputHideReason、QuickPickItemKind、
//     QuickPickFocus 枚举
//   platform/quickinput/browser/quickInputActions.ts:102-125  quickInput.* 键盘命令 → QuickPickFocus
//   workbench/browser/quickaccess.ts:20-22                inQuickPickContext = ContextKeyExpr.has('inQuickOpen')
//
// 裁剪（登记在 docs/vscode-reference.md 第 5 节）：无多选（canSelectMany）、无 quick tree、
// 无 quick input 标题栏动作与自定义按钮。
import { reactive } from "vue";
import { contextKeys } from "@/menu/contextKey.js";

// 对齐 platform/quickinput/common/quickInput.ts 的 QuickInputHideReason。
export const QuickInputHideReason = {
    Gesture: 1,
    Blur: 2,
    Other: 3
};

// 对齐 platform/quickinput/common/quickInput.ts 的 QuickPickItemKind.Separator = -1。
export const QuickPickItemKind = {
    Separator: -1,
    Default: 0
};

// 对齐 quickInput.ts 的 QuickPickFocus（quickInputActions.ts:103-125 逐条对应）。
export const QuickPickFocus = {
    Next: 0,
    Previous: 1,
    First: 2,
    Last: 3,
    NextPage: 4,
    PreviousPage: 5,
    NextSeparator: 6,
    PreviousSeparator: 7
};

// 快速输入是否拥有焦点 / 可见（对齐 platform/quickinput/common/quickInput.ts 的上下文键）。
export const QUICK_INPUT_FOCUS_KEY = "quickInputFocus";
export const QUICK_INPUT_TYPE_KEY = "quickInputType";
// 对齐 workbench/browser/quickaccess.ts:20 的 inQuickOpen：快速打开（quick access）专属上下文键。
export const IN_QUICK_OPEN_KEY = "inQuickOpen";

export const quickInput = reactive({
    visible: false,
    // 当前输入值（对齐 IQuickPick.value / filterValue）
    value: "",
    // 打开时的光标选区 [start, end]；null 表示不指定（对齐 IQuickPick.valueSelection，
    // 取值规则见 quickAccess.ts:170-186 的 adjustValueSelection）。
    valueSelection: null,
    placeholder: "",
    title: "",
    // 条目列表：{ id, label, description, detail, keybinding, icon, kind, ... }
    items: [],
    // 单选语义下的活动项下标（对齐 IQuickPick.activeItems 只取首项的用法）；-1 表示无。
    activeIndex: -1,
    busy: false,
    validationMessage: "",
    // 列表可见行数：由部件布局时写入，供 PageUp / PageDown 使用
    // （对齐 listWidget.js 的 pageDown：renderHeight / rowHeight）。
    visibleCount: 8
});

// 当前会话（对应 controller.currentQuickInput）；同一时刻只有一个。
let _session = null;

export function getActiveQuickPickItem() {
    return quickInput.items[quickInput.activeIndex] ?? null;
}

// 可选中的条目（分隔线不可选中）：对齐 QuickPick 把 Separator 排除在 activeItems 之外。
function isPickable(item) {
    return item && item.kind !== QuickPickItemKind.Separator;
}

function firstPickableIndex() {
    return quickInput.items.findIndex(isPickable);
}

function lastPickableIndex() {
    for (let index = quickInput.items.length - 1; index >= 0; index--) {
        if (isPickable(quickInput.items[index])) return index;
    }
    return -1;
}

// 在给定方向上找下一个可选中项；不环绕（对齐 listWidget 的 focusNext / focusPrevious）。
function nextPickableIndex(from, direction) {
    for (let index = from + direction; index >= 0 && index < quickInput.items.length; index += direction) {
        if (isPickable(quickInput.items[index])) return index;
    }
    return from;
}

function updateContextKeys(active) {
    contextKeys.set(QUICK_INPUT_FOCUS_KEY, active);
    contextKeys.set(QUICK_INPUT_TYPE_KEY, active ? "quickPick" : undefined);
}

/**
 * 打开快速输入。options：{ value, placeholder, title, busy, onDidChangeValue, onDidAccept, onDidHide }。
 * 对齐 controller.create()/open()：新会话替换旧会话，并记住先前焦点元素以便关闭后归还。
 */
export function showQuickPick(options = {}) {
    if (quickInput.visible) hideQuickPick(QuickInputHideReason.Other);

    _session = {
        onDidChangeValue: options.onDidChangeValue,
        onDidAccept: options.onDidAccept,
        onDidHide: options.onDidHide,
        previouslyFocusedElement: typeof document !== "undefined" ? document.activeElement : null
    };

    quickInput.value = options.value ?? "";
    quickInput.valueSelection = options.valueSelection ?? null;
    quickInput.placeholder = options.placeholder ?? "";
    quickInput.title = options.title ?? "";
    quickInput.items = [];
    quickInput.activeIndex = -1;
    quickInput.busy = !!options.busy;
    quickInput.validationMessage = "";
    quickInput.visible = true;
    updateContextKeys(true);

    // 对齐 QuickPick 打开时按初始 value 取一次条目。
    _session.onDidChangeValue?.(quickInput.value, { source: "open" });
}

/**
 * 更新条目列表。active 项优先保持在原条目上（按 id 匹配），否则取第一个可选中项
 * （对齐 QuickPick._setItems + update() 对 activeItems 的处理）。
 */
export function setQuickPickItems(items, previousActiveId) {
    quickInput.items = items;
    const keep = previousActiveId ? items.findIndex(item => item.id === previousActiveId && isPickable(item)) : -1;
    quickInput.activeIndex = keep >= 0 ? keep : firstPickableIndex();
}

export function setQuickPickBusy(busy) {
    quickInput.busy = busy;
}

export function setQuickPickValidationMessage(message) {
    quickInput.validationMessage = message ?? "";
}

// 输入值变化（由输入框驱动）；对齐 QuickPick.value setter → onDidChangeValue。
export function setQuickPickValue(value) {
    // 用户改写输入值后不再保留打开时的选区（对齐 QuickInputBox 在用户输入后自行维护选区）。
    quickInput.valueSelection = null;
    quickInput.value = value;
    _session?.onDidChangeValue?.(value, { source: "input" });
}

// 键盘导航：对齐 QuickPick.focus(focus) 的逐个分支（quickInputActions.ts:102-125 的命令入口）。
export function focusQuickPick(mode) {
    if (!quickInput.visible) return;
    const current = quickInput.activeIndex;
    switch (mode) {
        case QuickPickFocus.Next:
            quickInput.activeIndex = nextPickableIndex(current, 1);
            break;
        case QuickPickFocus.Previous:
            quickInput.activeIndex = nextPickableIndex(current < 0 ? 0 : current, -1);
            break;
        case QuickPickFocus.First:
            quickInput.activeIndex = firstPickableIndex();
            break;
        case QuickPickFocus.Last:
            quickInput.activeIndex = lastPickableIndex();
            break;
        case QuickPickFocus.NextPage:
            quickInput.activeIndex = pageIndex(current, quickInput.visibleCount);
            break;
        case QuickPickFocus.PreviousPage:
            quickInput.activeIndex = pageIndex(current, -quickInput.visibleCount);
            break;
        default:
            break;
    }
}

// 翻页：以可见行数为步长移动到目标位置附近最近的条目。
function pageIndex(from, delta) {
    const target = Math.min(Math.max((from < 0 ? 0 : from) + delta, 0), quickInput.items.length - 1);
    for (let index = target; index >= 0 && index < quickInput.items.length; index += delta >= 0 ? -1 : 1) {
        if (isPickable(quickInput.items[index])) return index;
    }
    return from;
}

// 直接把活动项定到某个下标（鼠标 hover / 点击用；对齐 list 的 setFocus）。
export function setQuickPickActiveIndex(index) {
    if (isPickable(quickInput.items[index])) quickInput.activeIndex = index;
}

/**
 * 接受当前活动项：先执行条目自身的 accept（打开文件 / 执行命令 / 跳到另一个提供者），
 * 再触发会话级 onDidAccept，最后关闭浮层（对齐 QuickPick 的 onDidAccept → 调用方 hide）。
 * 条目的 accept 期间若又打开了新的快速输入（帮助项跳转，见 anythingQuickAccess.ts:844-848
 * 的 accept → quickAccess.show），当前会话已被替换，此时不再关闭新浮层。
 */
export function acceptQuickPick() {
    if (!quickInput.visible) return;
    const item = getActiveQuickPickItem();
    if (!item || item.disabled) return;
    const session = _session;
    item.accept?.();
    session?.onDidAccept?.(item);
    if (_session === session) hideQuickPick(QuickInputHideReason.Gesture);
}

// 关闭快速输入并归还焦点（对齐 controller.hide() 的 previouslyFocusedElement.focus()）。
export function hideQuickPick(reason = QuickInputHideReason.Other) {
    if (!quickInput.visible && !_session) return;
    const session = _session;
    _session = null;
    quickInput.visible = false;
    quickInput.valueSelection = null;
    quickInput.items = [];
    quickInput.activeIndex = -1;
    quickInput.busy = false;
    quickInput.validationMessage = "";
    updateContextKeys(false);
    session?.onDidHide?.(reason);
    // 焦点归还：仅在隐藏原因不是失焦时执行，避免与浏览器自身的焦点转移打架
    // （对齐 controller.hide() 中 ignoreFocusOut 为 false 时不抢回焦点的分支）。
    if (reason !== QuickInputHideReason.Blur) {
        session?.previouslyFocusedElement?.focus?.();
    }
}

export function isQuickPickVisible() {
    return quickInput.visible;
}

// 点击组件外部（含点击编辑器）时关闭：对齐 QuickInput.ignoreFocusOut 默认 false 的失焦隐藏。
export function notifyQuickPickFocusOut() {
    if (quickInput.visible) hideQuickPick(QuickInputHideReason.Blur);
}
