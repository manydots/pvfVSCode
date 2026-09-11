<script setup>
// codicon 图标（VS Code 官方图标字体）。
// 字形规则见 src/monaco/codicon/codicon-glyphs.css，码位与 monaco 的 codiconsLibrary 一致。
const props = defineProps({
    name: { type: String, required: true },
    size: { type: Number, default: 16 }
});
</script>

<template>
    <span class="codicon" :class="`codicon-${props.name}`" :style="{ fontSize: `${props.size}px` }" aria-hidden="true"></span>
</template>
