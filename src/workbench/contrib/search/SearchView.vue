<script setup>
// 搜索视图（对齐 VS Code workbench/contrib/search 的 SearchView）：
// 顶部为 findInput 形态的输入框（右侧内嵌三个 codicon 开关），下方为结果列表。
// 检索对当前编辑器内容实际执行（大小写/全词/正则），点击结果在编辑器中定位。
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { getActiveEditor } from "@/menu/editorService.js";
import Codicon from "@/components/Codicon.vue";

const MAX_RESULTS = 2000;

const query = ref("");
const matchCase = ref(false);
const wholeWord = ref(false);
const useRegex = ref(false);
const results = ref([]);
const errorText = ref("");
const capped = ref(false);

let debounceTimer = null;
let contentListener = null;

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPattern() {
    let source = useRegex.value ? query.value : escapeRegExp(query.value);
    if (wholeWord.value) source = `\\b(?:${source})\\b`;
    return new RegExp(source, matchCase.value ? "g" : "gi");
}

function runSearch() {
    errorText.value = "";
    capped.value = false;

    if (!query.value) {
        results.value = [];
        return;
    }

    let pattern;
    try {
        pattern = buildPattern();
    } catch {
        errorText.value = "正则表达式无效";
        results.value = [];
        return;
    }

    const model = getActiveEditor()?.getModel();
    if (!model) {
        results.value = [];
        return;
    }

    const found = [];
    const lineCount = model.getLineCount();
    search: for (let line = 1; line <= lineCount; line++) {
        const text = model.getLineContent(line);
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            if (match[0] === "") {
                pattern.lastIndex++;
                continue;
            }
            found.push({
                lineNumber: line,
                text,
                start: match.index + 1,
                end: match.index + match[0].length + 1
            });
            if (found.length >= MAX_RESULTS) {
                capped.value = true;
                break search;
            }
        }
    }
    results.value = found;
}

function scheduleSearch() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 200);
}

watch([query, matchCase, wholeWord, useRegex], scheduleSearch);

// 打开结果为三元组：[匹配前, 匹配, 匹配后]，供模板高亮。
function segments(result) {
    const start = result.start - 1;
    const end = result.end - 1;
    return [result.text.slice(0, start), result.text.slice(start, end), result.text.slice(end)];
}

function openMatch(result) {
    const editor = getActiveEditor();
    if (!editor) return;
    editor.setSelection({
        startLineNumber: result.lineNumber,
        startColumn: result.start,
        endLineNumber: result.lineNumber,
        endColumn: result.end
    });
    editor.revealLineInCenter(result.lineNumber);
    editor.focus();
}

onMounted(() => {
    const editor = getActiveEditor();
    if (editor) contentListener = editor.onDidChangeModelContent(scheduleSearch);
});

onBeforeUnmount(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    contentListener?.dispose();
});
</script>

<template>
    <div class="search-view">
        <div class="find-input">
            <input v-model="query" class="input" type="text" placeholder="搜索" spellcheck="false" />
            <div class="controls">
                <button type="button" class="toggle" :class="{ checked: matchCase }" title="区分大小写" aria-label="区分大小写" @click="matchCase = !matchCase">
                    <Codicon name="case-sensitive" :size="16" />
                </button>
                <button type="button" class="toggle" :class="{ checked: wholeWord }" title="全字匹配" aria-label="全字匹配" @click="wholeWord = !wholeWord">
                    <Codicon name="whole-word" :size="16" />
                </button>
                <button type="button" class="toggle" :class="{ checked: useRegex }" title="使用正则表达式" aria-label="使用正则表达式" @click="useRegex = !useRegex">
                    <Codicon name="regex" :size="16" />
                </button>
            </div>
        </div>

        <p v-if="errorText" class="search-error">{{ errorText }}</p>
        <p v-else-if="query" class="search-summary">{{ results.length }}{{ capped ? "+" : "" }} 个结果</p>

        <ul class="result-list">
            <li v-for="(result, index) in results" :key="index" class="result-item" @click="openMatch(result)">
                <span class="result-line">{{ result.lineNumber }}</span>
                <span class="result-text">
                    <span>{{ segments(result)[0] }}</span
                    ><mark>{{ segments(result)[1] }}</mark
                    ><span>{{ segments(result)[2] }}</span>
                </span>
            </li>
        </ul>
    </div>
</template>

<style scoped>
.search-view {
    display: flex;
    flex-direction: column;
    padding: 6px 8px 0;
    font-size: 13px;
    color: var(--vscode-sideBar-foreground);
}

/* --- findInput 形态的输入框 --- */
.find-input {
    position: relative;
    flex: 0 0 auto;
}

.input {
    width: 100%;
    height: 26px;
    padding: 3px 66px 3px 6px;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border);
    border-radius: 2px;
    color: var(--vscode-input-foreground);
    font-family: inherit;
    font-size: 13px;
    outline: none;
}

.input::placeholder {
    color: var(--vscode-input-placeholderForeground);
}

.input:focus {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
}

.controls {
    position: absolute;
    top: 0;
    right: 0;
    height: 26px;
    display: flex;
    align-items: center;
    padding-right: 2px;
}

.toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 2px;
    background: transparent;
    color: var(--vscode-input-foreground);
    cursor: default;
}

.toggle:hover {
    background: var(--vscode-toolbar-hoverBackground);
}

.toggle.checked {
    background: var(--vscode-inputOption-activeBackground);
    border-color: var(--vscode-inputOption-activeBorder);
    color: var(--vscode-inputOption-activeForeground);
}

/* --- 结果 ---- */
.search-summary {
    margin: 6px 0 2px;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
}

.search-error {
    margin: 6px 0 2px;
    color: var(--vscode-errorForeground);
    font-size: 12px;
}

.result-list {
    list-style: none;
    margin: 0 -8px;
    padding: 0;
}

.result-item {
    display: flex;
    gap: 8px;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
}

.result-item:hover {
    background: var(--vscode-list-hoverBackground);
}

.result-line {
    flex: 0 0 auto;
    min-width: 26px;
    text-align: right;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
}

.result-text {
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: Menlo, Monaco, "Courier New", monospace;
    font-size: 12px;
}

.result-text mark {
    background: var(--vscode-editor-findMatchHighlightBackground);
    color: inherit;
    border-radius: 2px;
}
</style>
