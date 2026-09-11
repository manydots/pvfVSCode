<script setup>
// 分隔条（对齐 VS Code base/browser/ui/sash/sash.ts + media/sash.css）。
//
// 类名刻意沿用上游：.monaco-sash + .vertical/.horizontal + 状态类
// hover / active / disabled / minimum / maximum（sash.ts:289-291 的 state setter、
// sash.ts:446-447 的 mac 类、sash.ts:497-503 的朝向类、sash.ts:549/600 的 active）。
// 位置由宿主决定（上游是 grid/splitview 通过 layoutProvider 算的绝对坐标，sash.ts:664-674），
// 因此把 left/top/right 交给使用方，组件只负责尺寸、状态与交互。
//
// 交互对齐：
//   hover 延迟 300ms 才高亮（sash.ts:154 globalHoverDelay = 300，sash.ts:629-640）；
//   按下立即 active、拖动期间丢弃 hover 延迟（sash.ts:630-632）；
//   拖动时用动态样式表锁定全局光标，并按 minimum/maximum 换成单向光标（sash.ts:553-578）；
//   双击触发 reset（sash.ts:459-470 的双击判定，消费方见 grid.ts:714 onDidSashReset）。
import { onBeforeUnmount, ref, watch } from "vue";

const props = defineProps({
    // "vertical"（竖向分隔条，左右拖动）| "horizontal"（横向，上下拖动）
    orientation: { type: String, default: "vertical" },
    // "enabled" | "minimum" | "maximum" | "disabled"（对齐 sash.ts:118-145 的 SashState）
    state: { type: String, default: "enabled" }
});
const emit = defineEmits(["start", "change", "end", "reset"]);

// sash.ts:154
const HOVER_DELAY = 300;
// sash.ts:14 + 446-447：mac 上加 mac 类，sash.css:21-35 据此换用 col-resize / row-resize
const IS_MAC = typeof navigator !== "undefined" && /Mac/i.test(`${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`);

const root = ref(null);
const hovered = ref(false);
const dragging = ref(false);

let hoverTimer = null;
let cursorStyle = null;
let dragStart = null;

// sash.ts:559-574：拖拽中的光标随 min/max 换向
function cursorFor() {
    const vertical = props.orientation === "vertical";
    if (props.state === "minimum") return vertical ? "e-resize" : "s-resize";
    if (props.state === "maximum") return vertical ? "w-resize" : "n-resize";
    if (vertical) return IS_MAC ? "col-resize" : "ew-resize";
    return IS_MAC ? "row-resize" : "ns-resize";
}

function lockCursor() {
    const doc = root.value?.ownerDocument;
    const host = doc?.head ?? doc?.documentElement;
    if (!doc || !host) return;
    cursorStyle = doc.createElement("style");
    cursorStyle.textContent = `* { cursor: ${cursorFor()} !important; }`;
    host.appendChild(cursorStyle);
}

function unlockCursor() {
    cursorStyle?.parentNode?.removeChild(cursorStyle);
    cursorStyle = null;
}

// 拖到 min/max 后光标要立刻换向，等价于 sash.ts:584-586 订阅 onDidEnablementChange
watch(
    () => props.state,
    () => {
        if (dragging.value && cursorStyle) cursorStyle.textContent = `* { cursor: ${cursorFor()} !important; }`;
    }
);

function onPointerEnter() {
    if (dragging.value) {
        clearTimeout(hoverTimer);
        hovered.value = true;
        return;
    }
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => (hovered.value = true), HOVER_DELAY);
}

function onPointerLeave() {
    clearTimeout(hoverTimer);
    hovered.value = false;
}

function onPointerDown(event) {
    if (props.state === "disabled") return;
    event.preventDefault?.();
    clearTimeout(hoverTimer);
    dragging.value = true;
    hovered.value = true;
    dragStart = {
        startX: event.pageX ?? event.clientX,
        startY: event.pageY ?? event.clientY,
        altKey: !!event.altKey
    };
    lockCursor();
    emit("start", { ...dragStart, currentX: dragStart.startX, currentY: dragStart.startY });
    // 上游用 pointer capture（sash.ts:610-611 的 pointerEventFactory）；
    // 这里挂 window 等价，指针离开分隔条后仍继续跟随。
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
}

function onPointerMove(event) {
    if (!dragStart) return;
    emit("change", {
        ...dragStart,
        currentX: event.pageX ?? event.clientX,
        currentY: event.pageY ?? event.clientY
    });
}

function onPointerUp() {
    if (!dragStart) return;
    dragStart = null;
    dragging.value = false;
    unlockCursor();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    emit("end");
}

function onDoubleClick() {
    if (props.state === "disabled") return;
    emit("reset");
}

onBeforeUnmount(() => {
    clearTimeout(hoverTimer);
    unlockCursor();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
});
</script>

<template>
    <div
        ref="root"
        class="monaco-sash"
        :class="[orientation, state === 'enabled' ? null : state, { mac: IS_MAC, hover: hovered, active: dragging }]"
        @pointerenter="onPointerEnter"
        @pointerleave="onPointerLeave"
        @pointerdown="onPointerDown"
        @dblclick="onDoubleClick"></div>
</template>

<style scoped>
/* 取值逐条来自 sash.css（括注行号），选择器特异性顺序也与上游一致：
   mac 朝向光标 < minimum/maximum 单向光标 < 默认双向光标。 */
.monaco-sash {
    position: absolute;
    z-index: 35; /* sash.css:13 */
    touch-action: none;
}

.monaco-sash.disabled {
    pointer-events: none;
    cursor: default !important;
}

.monaco-sash.vertical {
    top: 0;
    width: var(--vscode-sash-size);
    height: 100%;
    cursor: ew-resize;
}

.monaco-sash.horizontal {
    left: 0;
    width: 100%;
    height: var(--vscode-sash-size);
    cursor: ns-resize;
}

.monaco-sash.mac.vertical {
    cursor: col-resize; /* sash.css:21-23 */
}

.monaco-sash.mac.horizontal {
    cursor: row-resize; /* sash.css:33-35 */
}

.monaco-sash.vertical.minimum {
    cursor: e-resize;
}

.monaco-sash.vertical.maximum {
    cursor: w-resize;
}

.monaco-sash.horizontal.minimum {
    cursor: s-resize;
}

.monaco-sash.horizontal.maximum {
    cursor: n-resize;
}

/* 高亮画在 ::before 上（sash.css:105-131）：4px 竖向/横向条，居中于分隔条 */
.monaco-sash::before {
    content: "";
    pointer-events: none;
    position: absolute;
    width: 100%;
    height: 100%;
    background: transparent;
}

.monaco-sash.vertical::before {
    width: var(--vscode-sash-hover-size);
    left: calc(50% - (var(--vscode-sash-hover-size) / 2));
}

.monaco-sash.horizontal::before {
    height: var(--vscode-sash-hover-size);
    top: calc(50% - (var(--vscode-sash-hover-size) / 2));
}

.monaco-sash.hover::before,
.monaco-sash.active::before {
    background: var(--vscode-sash-hoverBorder);
}
</style>
