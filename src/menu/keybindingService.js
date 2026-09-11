// 快捷键服务（对齐 VS Code platform/keybinding/common/keybindingService.ts +
// platform/keybinding/common/keybindingsRegistry.ts 的注册与分发语义）。
//
// 按键串格式与 VS Code 一致：修饰键 + 主键，如 "Ctrl+J"；和弦以空格分隔两段，如 "Ctrl+K W"。
// 分发规则：
//   1. 事件已被消费时不再处理（defaultPrevented；Monaco 处理按键时会 preventDefault 并
//      stopPropagation，因此焦点在编辑器内时其原生快捷键不会走到这里）；
//   2. 命中规则的 when 子句与命令作用域后执行命令；
//   3. 和弦首段若同时存在更长的和弦规则，则等待第二段；3 秒未继续则按首段规则执行。
import { getKeybindingRules } from "@/menu/actions.js";
import { contextKeys } from "@/menu/contextKey.js";
import { executeCommand, getCommand } from "@/menu/commands.js";

// 仅修饰键的 keydown 不作为主键（VS Code 亦不把修饰键本身当作按键串）。
const MODIFIER_ONLY = new Set(["Control", "Shift", "Alt", "Meta", "CapsLock", "NumLock", "ScrollLock", "Dead", "Unidentified"]);

// 和弦等待时长（VS Code 默认 5s，这里取 3s 以更快回落到首段命令）。
const CHORD_TIMEOUT = 3000;

// 部分标点在按下 Shift 后 event.key 会变成另一个字符（如 Shift+\ 得到 "|"），
// 因此额外按 event.code 生成候选按键串（VS Code 内部同样基于 keyCode 判定）。
const CODE_KEYS = {
    Backslash: "\\",
    Slash: "/",
    Comma: ",",
    Period: ".",
    Semicolon: ";",
    Quote: "'",
    BracketLeft: "[",
    BracketRight: "]",
    Minus: "-",
    Equal: "=",
    Backquote: "`",
    Space: "Space"
};

let _pendingChord = null;
let _pendingCommandId = null;
let _pendingTimer = null;

function modifierParts(event) {
    // 修饰键顺序固定为 Ctrl、Shift、Alt（与注册表内按键串的书写顺序一致）。
    const parts = [];
    if (event.ctrlKey) parts.push("Ctrl");
    if (event.shiftKey) parts.push("Shift");
    if (event.altKey) parts.push("Alt");
    return parts;
}

function keyFromEvent(event) {
    const key = event.key;
    if (!key || MODIFIER_ONLY.has(key)) return null;
    if (key === "Spacebar") return "Space";
    return key.length === 1 ? key.toUpperCase() : key;
}

function keyFromCode(event) {
    const code = event.code;
    if (!code) return null;
    if (CODE_KEYS[code]) return CODE_KEYS[code];
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    return null;
}

// 返回事件对应的候选按键串（通常 1 个，含 Shift 的标点可能 2 个）。
export function normalizeKeyStrokes(event) {
    const modifiers = modifierParts(event);
    const strokes = [];
    for (const key of [keyFromEvent(event), keyFromCode(event)]) {
        if (!key) continue;
        const stroke = [...modifiers, key].join("+");
        if (!strokes.includes(stroke)) strokes.push(stroke);
    }
    return strokes;
}

function resetChord() {
    if (_pendingTimer) clearTimeout(_pendingTimer);
    _pendingChord = null;
    _pendingCommandId = null;
    _pendingTimer = null;
}

// 命令作用域：编辑器命令要求 editorFocus（等价于 VS Code 编辑器命令的 when: editorFocus），
// 避免焦点在侧栏输入框等位置时被编辑器快捷键抢占原生行为。
function isCommandInScope(commandId) {
    const handler = getCommand(commandId);
    if (!handler) return false;
    return !handler.editorScoped || !!contextKeys.get("editorFocus");
}

function matchStroke(strokes, rules) {
    for (const stroke of strokes) {
        const candidate = _pendingChord ? `${_pendingChord} ${stroke}` : stroke;
        const exact = rules.find(rule => rule.chord === candidate && isCommandInScope(rule.commandId));
        const longer = rules.some(rule => rule.chord.startsWith(`${candidate} `));
        if (exact || longer) return { candidate, exact, longer };
    }
    return null;
}

export function handleKeyDown(event) {
    if (event.defaultPrevented) return;
    if (event.key === "Escape" && _pendingChord) {
        resetChord();
        return;
    }

    const strokes = normalizeKeyStrokes(event);
    if (!strokes.length) return;

    const rules = getKeybindingRules().filter(rule => !rule.when || rule.when.evaluate(contextKeys));
    const match = matchStroke(strokes, rules);
    if (!match) {
        // 组合未命中：结束进行中的和弦。
        if (_pendingChord) resetChord();
        return;
    }

    event.preventDefault();
    if (match.longer) {
        // 等待和弦的下一段；若首段本身也已命中则先记住，超时后执行。
        if (_pendingTimer) clearTimeout(_pendingTimer);
        _pendingChord = match.candidate;
        _pendingCommandId = match.exact?.commandId ?? null;
        _pendingTimer = setTimeout(() => {
            const commandId = _pendingCommandId;
            resetChord();
            if (commandId) executeCommand(commandId);
        }, CHORD_TIMEOUT);
        return;
    }

    resetChord();
    executeCommand(match.exact.commandId);
}

// 安装全局按键监听；焦点在编辑器内时 Monaco 会 stopPropagation，因此原生快捷键不会重复触发。
export function startKeybindingDispatch(target = document) {
    target.addEventListener("keydown", handleKeyDown);
    return () => target.removeEventListener("keydown", handleKeyDown);
}
