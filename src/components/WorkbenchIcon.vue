<script setup>
// workbench 图标：统一走 codicon 字体（替代早期手绘 SVG）。
// 保留 name/size 接口，并把少量历史别名映射到 codicon 官方 id。
import { computed } from "vue";
import Codicon from "@/components/Codicon.vue";

const props = defineProps({
    name: { type: String, required: true },
    size: { type: Number, default: 16 }
});

const ALIASES = {
    settings: "settings-gear",
    wrap: "word-wrap",
    minimap: "map",
    chevron: "chevron-down"
};

const iconId = computed(() => ALIASES[props.name] ?? props.name);
</script>

<template>
    <Codicon :name="iconId" :size="size" />
</template>
