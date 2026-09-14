// 无头核查「配置服务 + config.* 上下文键派生 + 自动换行的按模型临时覆盖」这条链路
// （对齐 <vscode>/src/vs/workbench/services/configuration/browser/configurationService.ts、
// platform/contextkey/browser/contextKeyService.ts 的 ConfigAwareContextValuesContainer、
// workbench/contrib/codeEditor/browser/toggleWordWrap.ts）。
//
// 固定住六类规则：
//   1. 默认层来自注册表：`editor.wordWrap` 默认 'off'、`editor.minimap.enabled` 默认 true
//      （editorOptions.ts:6846-6872、:3478/:3495-3499）；
//   2. 分层合并：用户层（settings.json）覆盖默认层（configurationModels.ts:1057-1062）；
//   3. updateValue 的落点语义：写用户层、等于默认值时删除该设置项（configurationService.ts:362-364）、
//      变更事件只在有键变化时发出且 source 为 USER（:1117-1125）；
//   4. config.* 上下文键：取值编码（number/boolean/string 原样、数组 JSON.stringify，:163-174）、
//      变更时对「该键及其后代」中**已缓存**的键失效并发通知（:134-144）、
//      DEFAULT 变更清空整表（:123-128）；
//   5. 自动换行是**按模型的临时覆盖**而非配置项：切到 'on'/'off' 写 wordWrapOverride2、
//      再切一次回到 'inherit'（toggleWordWrap.ts:78-99、:171-177），勾选态取
//      editorWordWrap（由 wrappingInfo.wrappingColumn 求出，:294-305）；
//   6. 两条 toggle 命令的落点与上下文键来源：源码里不得再出现自造的 wordWrapOn / minimapOn。
//
// 运行：node scripts/check-configuration.mjs
//
// 说明：Node 不认识 Vite 的 `@` 别名，故用 scripts/alias-loader.mjs 挂钩后再载入被测模块；
// 业务代码仍统一使用 `@/...`（AGENTS.md 第 8 条）。
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { fileURLToPath } from "node:url";

register(new URL("alias-loader.mjs", import.meta.url));

const root = fileURLToPath(new URL("../", import.meta.url));

// 最小 localStorage 替身（storageService 单例在导入时读 globalThis.localStorage）。
function createMemoryStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        data,
        getItem: key => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => data.set(key, String(value)),
        document: key => JSON.parse(data.get(key) ?? "{}")
    };
}

const GLOBAL_DOCUMENT = "vscode-web-state-db-global"; // 默认档案与全局共用（storageService.ts:121-133）
const USER_SETTINGS_KEY = "settings.json"; // platform/userDataProfile/common/userDataProfile.ts:197
const MINIMAP_KEY = "editor.minimap.enabled";
const WORD_WRAP_KEY = "editor.wordWrap";
const ARRAY_KEY = "pvfCheck.list";

// 预置用户设置：editor.wordWrap 被用户改成 'on'（缩略图不预置，用来验证默认层）
const storage = createMemoryStorage({
    [GLOBAL_DOCUMENT]: JSON.stringify({ [USER_SETTINGS_KEY]: JSON.stringify({ [WORD_WRAP_KEY]: "on" }) })
});
globalThis.localStorage = storage;
globalThis.window = { addEventListener() {}, removeEventListener() {} };

const cases = [];
function check(name, actual, expected) {
    cases.push({ name, actual, expected });
}

const { ConfigurationTarget, deepEquals } = await import("@/platform/configuration/common/configuration.js");
const { configurationRegistry } = await import("@/platform/configuration/common/configurationRegistry.js");
// 两项真实设置的登记（editor.wordWrap / editor.minimap.enabled）
await import("@/monaco/editorConfiguration.js");
// 额外登记一项数组设置，用于验证「数组值编码为 JSON 字符串」
configurationRegistry.registerConfiguration({
    id: "pvfCheck",
    title: "测试",
    properties: { [ARRAY_KEY]: { type: "array", default: [1, 2], description: "test" } }
});

const { ConfigAwareContextValues } = await import("@/platform/contextkey/browser/configAwareContextValues.js");
const { contextKeys } = await import("@/menu/contextKey.js");
const { ConfigurationService, configurationService, initConfigurationService } = await import("@/workbench/services/configuration/browser/configurationService.js");
const { applyWordWrapState, canToggleWordWrap, CAN_TOGGLE_WORD_WRAP, EDITOR_WORD_WRAP, IS_DOMINATED_BY_LONG_LINES, IS_WORD_WRAP_MINIFIED, readTransientState, refreshWordWrapContextKeys, toggleWordWrap, writeTransientState } = await import("@/workbench/contrib/codeEditor/wordWrapState.js");
const { EditorOption } = await import("monaco-editor/editor/common/standalone/standaloneEnums.js");

// ---------- 1. 启动：默认层 + 用户层 + 上下文键接线 ----------

initConfigurationService();
contextKeys.attachConfigurationService(configurationService);

const notified = [];
contextKeys.onDidChange(key => notified.push(key));

check("默认层：editor.minimap.enabled 默认为 true", configurationService.getValue(MINIMAP_KEY), true);
check("默认层：editor.wordWrap 默认为 off", configurationService.inspect(WORD_WRAP_KEY).defaultValue, "off");
check("用户层覆盖默认层：editor.wordWrap === 'on'", configurationService.getValue(WORD_WRAP_KEY), "on");
check("inspect 同时给默认值与用户值", [configurationService.inspect(WORD_WRAP_KEY).defaultValue, configurationService.inspect(WORD_WRAP_KEY).userValue], ["off", "on"]);

// config.* 派生：值编码与缓存
check("config.* 派生：布尔原样", contextKeys.get(`config.${MINIMAP_KEY}`), true);
check("config.* 派生：字符串原样", contextKeys.get(`config.${WORD_WRAP_KEY}`), "on");
check("config.* 派生：数组 JSON.stringify", contextKeys.get(`config.${ARRAY_KEY}`), "[1,2]");
check("config.* 派生：普通对象原样返回", deepEquals(contextKeys.get("config.editor.minimap"), { enabled: true }), true);
check("非 config.* 的键不走配置派生", contextKeys.get("sidebarVisible"), undefined);

// ---------- 2. updateValue：写用户层、事件、失效与通知 ----------

// 先缓存一个后代键（权威用 findSuperstr 失效「键及其后代」，:134-139）
contextKeys.get(`config.${MINIMAP_KEY}.extra`);
notified.length = 0;

let changeEvent = null;
const off = configurationService.onDidChangeConfiguration(event => { changeEvent = event; });
await configurationService.updateValue(MINIMAP_KEY, false);

check("updateValue 后 getValue 反映新值", configurationService.getValue(MINIMAP_KEY), false);
check("updateValue 后 inspect 的 userValue 为新值", configurationService.inspect(MINIMAP_KEY).userValue, false);
check("变更事件 source 为 USER", changeEvent?.source, ConfigurationTarget.USER);
check("变更事件的 affectedKeys 含该设置", [...(changeEvent?.affectedKeys ?? [])].join("、"), MINIMAP_KEY);
check("affectsConfiguration 命中父段", changeEvent?.affectsConfiguration("editor.minimap"), true);
check("affectsConfiguration 不命中同前缀的相邻段", changeEvent?.affectsConfiguration("editor.mini"), false);
check("config.* 上下文键随配置更新", contextKeys.get(`config.${MINIMAP_KEY}`), false);
check("已缓存的后代键被失效并通知", notified.filter(key => key === `config.${MINIMAP_KEY}.extra`).length, 1);
check("已缓存的键本身被通知", notified.filter(key => key === `config.${MINIMAP_KEY}`).length, 1);

// 未缓存的键不发多余通知（权威只广播已缓存的键，:140-144）
notified.length = 0;
await configurationService.updateValue(WORD_WRAP_KEY, "wordWrapColumn");
check("未缓存的相关键不产生通知", notified.filter(key => key === `config.${ARRAY_KEY}`).length, 0);
check("设置项变化后值可读", contextKeys.get(`config.${WORD_WRAP_KEY}`), "wordWrapColumn");

// 等于默认值 → 从用户层删除（configurationService.ts:362-364）
await configurationService.updateValue(WORD_WRAP_KEY, "off");
check("等于默认值时删除用户设置", configurationService.inspect(WORD_WRAP_KEY).userValue, undefined);
check("删除后回落到默认值", configurationService.getValue(WORD_WRAP_KEY), "off");
off();

// ---------- 3. 落盘与刷新往返 ----------

const settingsDocument = storage.document(GLOBAL_DOCUMENT);
const storedSettings = JSON.parse(settingsDocument[USER_SETTINGS_KEY]);
check("用户设置写在 settings.json 这个键上", Object.keys(settingsDocument).includes(USER_SETTINGS_KEY), true);
check("删除后的设置项不落盘", Object.keys(storedSettings).includes(WORD_WRAP_KEY), false);
check("改动过的设置项落盘", storedSettings[MINIMAP_KEY], false);
check("目标标记写入文档（StorageTarget.USER）", JSON.parse(settingsDocument.__$__targetStorageMarker ?? "{}")[USER_SETTINGS_KEY], 0);

// 新实例重新读回（模拟刷新）
const reloaded = new ConfigurationService().initialize();
check("刷新往返：用户设置被读回", reloaded.getValue(MINIMAP_KEY), false);
check("刷新往返：未设置项回落默认值", reloaded.getValue(WORD_WRAP_KEY), "off");
// 恢复单例的用户层，供后续用例使用
await configurationService.updateValue(MINIMAP_KEY, true);

// ---------- 4. ConfigAwareContextValues 的失效语义（DEFAULT 清全表） ----------

let fakeConfigValue = { "pvfCheck.flag": true };
const fakeService = { getValue: key => fakeConfigValue[key], onDidChangeConfiguration: () => () => {} };
const invalidated = [];
const container = new ConfigAwareContextValues(fakeService, keys => invalidated.push(...keys));
check("容器缓存首值", container.getValue("config.pvfCheck.flag"), true);
container._onDidChangeConfiguration({ source: ConfigurationTarget.DEFAULT, affectedKeys: new Set() });
check("DEFAULT 变更清空整表并对已缓存键发通知", invalidated.join("、"), "config.pvfCheck.flag");
fakeConfigValue = { "pvfCheck.flag": false };
check("清空后重新回读配置", container.getValue("config.pvfCheck.flag"), false);
container.dispose();

// ---------- 5. 自动换行：按模型的临时覆盖 ----------

const modelA = { name: "a" };
const modelB = { name: "b" };
const applied = [];
const wrappingInfos = new Map();
function fakeEditor(model, wrappingInfo) {
    wrappingInfos.set(model, wrappingInfo);
    return {
        getModel: () => model,
        getOption: option => (option === EditorOption.wrappingInfo ? wrappingInfos.get(model) : undefined),
        updateOptions: options => applied.push(options)
    };
}

check("没有编辑器时不可切换", canToggleWordWrap(null), false);
check("没有模型时不可切换", canToggleWordWrap({ getModel: () => null }), false);

refreshWordWrapContextKeys(null);
check("无可切换编辑器时四个键均为 false", [contextKeys.get(CAN_TOGGLE_WORD_WRAP), contextKeys.get(EDITOR_WORD_WRAP), contextKeys.get(IS_WORD_WRAP_MINIFIED), contextKeys.get(IS_DOMINATED_BY_LONG_LINES)].join("、"), "false、false、false、false");

const loaded = fakeEditor(modelA, { wrappingColumn: 80, isWordWrapMinified: false, isDominatedByLongLines: true });
refreshWordWrapContextKeys(loaded);
check("wrappingColumn !== -1 时 editorWordWrap 为 true", contextKeys.get(EDITOR_WORD_WRAP), true);
check("isDominatedByLongLines 进入上下文键", contextKeys.get(IS_DOMINATED_BY_LONG_LINES), true);
check("isWordWrapMinified 进入上下文键", contextKeys.get(IS_WORD_WRAP_MINIFIED), false);

// A 首次切换：当前换行 → 覆盖为 off
applied.length = 0;
toggleWordWrap(loaded);
check("已换行时切换写入 off 覆盖", JSON.stringify(applied.at(-1)), JSON.stringify({ wordWrapOverride2: "off" }));
check("临时状态记在模型上", readTransientState(modelA)?.wordWrapOverride, "off");
// 再次切换：清除覆盖，回到 'inherit'（继承 editor.wordWrap）
toggleWordWrap(loaded);
check("再次切换清除覆盖", readTransientState(modelA), null);
check("清除覆盖写 inherit", JSON.stringify(applied.at(-1)), JSON.stringify({ wordWrapOverride2: "inherit" }));

// B 未换行 → 覆盖为 on；且状态按模型隔离
const unloaded = fakeEditor(modelB, { wrappingColumn: -1, isWordWrapMinified: true, isDominatedByLongLines: false });
toggleWordWrap(unloaded);
check("未换行时切换写入 on 覆盖", JSON.stringify(applied.at(-1)), JSON.stringify({ wordWrapOverride2: "on" }));
check("覆盖状态按模型隔离", [String(readTransientState(modelA)), String(readTransientState(modelB)?.wordWrapOverride)].join("、"), "null、on");

refreshWordWrapContextKeys(unloaded);
check("切换后 editorWordWrap 仍取实际换行状态", contextKeys.get(EDITOR_WORD_WRAP), false);

// 模型切换时按各自的状态施加覆盖（EditorPart 的 onDidChangeModel 触发点）
applied.length = 0;
applyWordWrapState(loaded, modelA);
check("切回 A 时施加 inherit（A 无覆盖）", JSON.stringify(applied.at(-1)), JSON.stringify({ wordWrapOverride2: "inherit" }));
applyWordWrapState(loaded, modelB);
check("切到 B 时施加 B 的 on 覆盖", JSON.stringify(applied.at(-1)), JSON.stringify({ wordWrapOverride2: "on" }));

writeTransientState(modelB, null);
check("清除后不残留状态", readTransientState(modelB), null);

// ---------- 6. 静态不变量 ----------

function readFile(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), "utf8");
}
function walk(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...walk(full));
        else if (entry.name.endsWith(".js")) files.push(full);
    }
    return files;
}

const srcFiles = walk(path.join(root, "src"));
const legacyKeyHits = srcFiles.filter(file => /wordWrapOn|minimapOn/.test(fs.readFileSync(file, "utf8")));
check("源码里不再出现自造上下文键 wordWrapOn / minimapOn", legacyKeyHits.map(file => path.relative(root, file)).join("、"), "");

// when/precondition 只接受表达式：把上下文键「名字」（字符串）直接传给 and/or/not 会在运行期
// 抛 expr.serialize is not a function（not 的 serialize 取自 expr.serialize()）。
// 这里扫全仓，要求 and/or/not 的每个实参要么是 ContextKeyExpr.* 调用，要么是同文件里声明为
// ContextKeyExpr 表达式的常量。
// 扫描前先去掉注释：注释里叙述旧实现（如 `ContextKeyExpr.and(PANEL_VISIBLE, equals("activePanel", 终端))`）
// 不是代码，不能当作违规。
function stripComments(source) {
    let out = "";
    let quote = null;
    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        if (quote) {
            out += char;
            if (char === "\\") out += source[++i] ?? "";
            else if (char === quote) quote = null;
            continue;
        }
        if (char === '"' || char === "'" || char === "`") {
            quote = char;
            out += char;
            continue;
        }
        if (char === "/" && source[i + 1] === "/") {
            while (i < source.length && source[i] !== "\n") i++;
            out += "\n";
            continue;
        }
        if (char === "/" && source[i + 1] === "*") {
            i += 2;
            while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
            i++;
            continue;
        }
        out += char;
    }
    return out;
}

function findInvalidExpressionArgs(source) {
    const declared = new Set();
    for (const match of source.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*ContextKeyExpr\./g)) declared.add(match[1]);

    const invalid = [];
    for (const match of source.matchAll(/ContextKeyExpr\.(and|or|not)\(/g)) {
        // 取参数列表：从 `(` 往后按括号深度配对，再按顶层逗号切分
        let depth = 0;
        let end = match.index + match[0].length;
        for (; end < source.length; end++) {
            const char = source[end];
            if (char === "(") depth++;
            else if (char === ")") {
                if (depth === 0) break;
                depth--;
            }
        }
        const inner = source.slice(match.index + match[0].length, end);
        // 按顶层逗号切分：括号/中括号要计深度，字符串字面量里的逗号不能算分隔符
        let level = 0;
        let quote = null;
        let current = "";
        const args = [];
        for (let i = 0; i < inner.length; i++) {
            const char = inner[i];
            if (quote) {
                current += char;
                if (char === "\\") {
                    current += inner[++i] ?? "";
                } else if (char === quote) quote = null;
                continue;
            }
            if (char === '"' || char === "'" || char === "`") {
                quote = char;
                current += char;
                continue;
            }
            if (char === "(" || char === "[") level++;
            else if (char === ")" || char === "]") level--;
            if (char === "," && level === 0) {
                args.push(current);
                current = "";
            } else current += char;
        }
        args.push(current);

        for (const arg of args) {
            const trimmed = arg.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith("ContextKeyExpr.")) continue;
            if (declared.has(trimmed)) continue;
            invalid.push(`${match[0].slice(0, -1)}(${trimmed})`);
        }
    }
    return invalid;
}

const invalidExpressionArgs = srcFiles.flatMap(file => findInvalidExpressionArgs(stripComments(fs.readFileSync(file, "utf8"))).map(arg => `${path.relative(root, file)} → ${arg}`));
check("and/or/not 的实参都是表达式而非上下文键名", invalidExpressionArgs.join("、"), "");

const appStateSource = readFile("src/menu/appState.js");
check("appState 不再承载 wordWrap / minimap 字段", /(wordWrap|minimap)\s*:/.test(appStateSource), false);

const defaultMenusSource = readFile("src/menu/defaultMenus.js");
check("两条 toggle 命令的注册已移出 defaultMenus.js", /id:\s*"(editor\.action\.toggleWordWrap|editor\.action\.toggleMinimap)"/.test(defaultMenusSource), false);

const minimapSource = readFile("src/workbench/contrib/codeEditor/minimap.contribution.js");
check(
    "缩略图勾选态取 config.editor.minimap.enabled（toggleMinimap.ts:26）",
    /toggled:\s*ContextKeyExpr\.equals\(`config\.\$\{MINIMAP_ENABLED_SETTING\}`,\s*true\)/.test(minimapSource),
    true
);

const wordWrapSource = readFile("src/workbench/contrib/codeEditor/wordWrap.contribution.js");
check("自动换行勾选态取 editorWordWrap（toggleWordWrap.ts:354）", /toggled:\s*ContextKeyExpr\.has\(EDITOR_WORD_WRAP\)/.test(wordWrapSource), true);
check("自动换行要求 canToggleWordWrap（toggleWordWrap.ts:356）", /precondition:\s*ContextKeyExpr\.has\(CAN_TOGGLE_WORD_WRAP\)/.test(wordWrapSource), true);
check("标签栏两条按需条目用裸 appendMenuItem（toggleWordWrap.ts:320-345）", (wordWrapSource.match(/appendMenuItem\(MenuId\.EditorTitle,/g) ?? []).length, 2);
check("两条条目都出现在 navigation 组（工具栏主区）", (wordWrapSource.match(/group:\s*EDITOR_TITLE_GROUP/g) ?? []).length, 2);

let failed = 0;
for (const item of cases) {
    const ok = typeof item.expected === "object" ? deepEquals(item.actual, item.expected) : item.actual === item.expected;
    if (!ok) failed++;
    console.log(`${ok ? "✓" : "✗"} ${item.name}${ok ? "" : `\n    实际: ${JSON.stringify(item.actual)}\n    期望: ${JSON.stringify(item.expected)}`}`);
}

console.log(`\n${cases.length - failed}/${cases.length} 通过`);
process.exit(failed === 0 ? 0 : 1);
