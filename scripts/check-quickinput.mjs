// 无头核查「快速输入（命令中心 / Ctrl+P）」的取数与接受链路。
//
// 为什么需要它：命令中心与 Ctrl+P 共用同一条链路 ——
//   showQuickAccess(prefix) → 路由到提供者 → getPicks(filter) → 条目 accept → executeCommand。
// 这条链路断掉时界面表现就是「点击命令中心毫无反应」，而它完全由纯逻辑构成、可在 Node 侧复现，
// 所以用逻辑测试固定住（AGENTS.md 第 5 条允许的验证手段之一）。
//
// 运行：node scripts/check-quickinput.mjs
//
// 说明：被测模块用的是 Vite 的 `@` 别名，Node 不认识，故先挂 scripts/alias-loader.mjs
// 再用相对 URL 动态载入；业务代码仍统一使用 `@/...`（AGENTS.md 第 8 条）。
import { register } from "node:module";
import { readFileSync } from "node:fs";

register(new URL("./alias-loader.mjs", import.meta.url));

const srcRoot = new URL("../src/", import.meta.url);
const readSource = relativePath => readFileSync(new URL(relativePath, srcRoot), "utf8");
const { registerAction2, getKeybindingLabel } = await import(new URL("menu/actions.js", srcRoot));
const { contextKeys } = await import(new URL("menu/contextKey.js", srcRoot));
const { ContextKeyExpr } = await import(new URL("menu/contextKey.js", srcRoot));
const { getQuickAccessProviders, resolveQuickAccessProvider, showQuickAccess, registerQuickAccessProvider } = await import(new URL("platform/quickinput/quickAccess.js", srcRoot));
const { registerCommandsQuickAccess, COMMANDS_QUICK_ACCESS_PREFIX } = await import(new URL("workbench/contrib/quickaccess/browser/commandsQuickAccess.js", srcRoot));
const { quickInput, acceptQuickPick, hideQuickPick, isQuickPickVisible, notifyQuickPickFocusOut, setQuickPickActiveIndex, setQuickPickValue, QuickPickItemKind } = await import(new URL("platform/quickinput/quickInput.js", srcRoot));

let failed = 0;
const check = (name, condition, detail) => {
    if (!condition) failed++;
    console.log(`${condition ? "✓" : "✗"} ${name}${condition ? "" : `\n    ${detail ?? ""}`}`);
};

// ── 被测环境的动作表：与真实贡献点同形（registerAction2 会同时登记命令与命令面板落点）──
const executed = [];
registerAction2({ id: "workbench.action.openSettings", title: "打开设置", run: () => executed.push("openSettings") });
registerAction2({ id: "workbench.action.togglePanel", title: "切换面板", run: () => executed.push("togglePanel") });
registerAction2({ id: "editor.action.formatDocument", title: "格式化文档", run: () => executed.push("formatDocument") });
// f1: false 的动作不应出现在命令面板（actions.ts:754 的 f1 分支）。
registerAction2({ id: "internal.hiddenAction", title: "内部动作", f1: false, run: () => executed.push("hiddenAction") });
// 带 precondition 的动作：上下文键不成立时从命令面板消失（when 取 precondition，actions.ts:755）。
registerAction2({ id: "editor.action.reveal", title: "显示编辑器", precondition: ContextKeyExpr.has("editorFocus"), run: () => executed.push("reveal") });
// 标签重复的两个动作：命令 id 会作为 description 显示（commandsQuickAccess.ts:139-149）。
registerAction2({ id: "dup.first", title: "同名命令", run: () => executed.push("dupFirst") });
registerAction2({ id: "dup.second", title: "同名命令", run: () => executed.push("dupSecond") });

registerCommandsQuickAccess();

// 默认（文件）提供者：真实的 anythingQuickAccess 依赖 monaco，无法在 Node 侧载入，
// 故此处用同形的替身验证路由契约，真实实现由下面的静态断言覆盖。
const defaultProvider = {
    prefix: "",
    placeholder: "按名称搜索文件。",
    getPicks: () => []
};
registerQuickAccessProvider(defaultProvider);

// 1) 提供者注册表：命令提供者的前缀必须与权威一致（commandsQuickAccess.ts:51 PREFIX = '>'）。
const commandsProvider = getQuickAccessProviders().find(provider => provider.prefix === COMMANDS_QUICK_ACCESS_PREFIX);
check("命令提供者以前缀 '>' 注册", Boolean(commandsProvider), `已注册前缀：${getQuickAccessProviders().map(p => JSON.stringify(p.prefix)).join(", ")}`);

// 2) 路由：输入值以 '>' 开头交给命令提供者并剥掉前缀，其余交给默认提供者。
const routed = resolveQuickAccessProvider(">切换");
check("'>' 前缀路由到命令提供者并剥掉前缀", routed.provider === commandsProvider && routed.filter === "切换", `provider.prefix=${JSON.stringify(routed.provider?.prefix)} filter=${JSON.stringify(routed.filter)}`);
const plain = resolveQuickAccessProvider("common");
check("无前缀输入走默认提供者且过滤词原样", plain.provider === defaultProvider && plain.filter === "common", `provider.prefix=${JSON.stringify(plain.provider?.prefix)} filter=${JSON.stringify(plain.filter)}`);

// 3) 打开命令中心（showQuickAccess('>') 即命令中心 / Ctrl+Shift+P 的入口）。
const itemLabels = () => quickInput.items.map(item => item.label);
showQuickAccess(COMMANDS_QUICK_ACCESS_PREFIX, { providerOptions: { includeHelp: true, from: "commandCenter" } });
check("命令中心打开后浮层可见", isQuickPickVisible() && quickInput.visible);
check("占位符取自提供者", quickInput.placeholder === commandsProvider.placeholder, `实际：${JSON.stringify(quickInput.placeholder)}`);
check("空查询列出命令面板动作", itemLabels().includes("切换面板") && itemLabels().includes("打开设置"), `条目：${JSON.stringify(itemLabels())}`);
check("f1: false 的动作不进命令面板", !itemLabels().includes("内部动作"), `条目：${JSON.stringify(itemLabels())}`);
check("无历史时不出现分组分隔线", quickInput.items.every(item => item.kind !== QuickPickItemKind.Separator), `条目：${JSON.stringify(itemLabels())}`);
check("首个活动项是可选中条目（非分隔线）", quickInput.items[quickInput.activeIndex]?.kind !== QuickPickItemKind.Separator);

// 4) 过滤：模糊词匹配标签；命令 id 全等也能命中（对齐 commandsQuickAccess.ts:91-150 的两条分支）。
setQuickPickValue(">面板");
check("输入 '>面板' 后过滤出「切换面板」", itemLabels().length === 1 && itemLabels()[0] === "切换面板", `条目：${JSON.stringify(itemLabels())}`);
setQuickPickValue(">workbench.action.openSettings");
check("输入完整命令 id 也能命中（标签是中文也不影响）", itemLabels().includes("打开设置"), `条目：${JSON.stringify(itemLabels())}`);

// precondition（when 取 precondition，actions.ts:755）：上下文键不成立时该命令不在命令面板里。
setQuickPickValue(">显示编辑器");
check("precondition 不成立时命令不出现", !itemLabels().includes("显示编辑器"), `条目：${JSON.stringify(itemLabels())}`);
contextKeys.set("editorFocus", true);
setQuickPickValue(">显示");
check("precondition 成立后命令出现", itemLabels().includes("显示编辑器"), `条目：${JSON.stringify(itemLabels())}`);
contextKeys.set("editorFocus", undefined);

// 标签重复的命令显示命令 id 作为 description（对齐 :139-149）。
setQuickPickValue(">同名");
const duplicated = quickInput.items.filter(item => item.label === "同名命令");
check("标签重复时以命令 id 作 description", duplicated.length === 2 && duplicated.every(item => item.description.startsWith("dup.")), `条目：${JSON.stringify(duplicated.map(i => [i.label, i.description]))}`);

// 5) 接受活动项：执行命令并关闭浮层。
setQuickPickValue(">面板");
acceptQuickPick();
check("接受后执行了对应命令", executed.join(",") === "togglePanel", `已执行：${JSON.stringify(executed)}`);
check("接受后浮层关闭", !isQuickPickVisible());

// 5b) 接受过的命令排在最前并带「最近使用」分隔线（对齐 :151-248）。
showQuickAccess(COMMANDS_QUICK_ACCESS_PREFIX);
check("最近使用的命令排在首位", quickInput.items[quickInput.activeIndex]?.label === "切换面板", `首项：${JSON.stringify(quickInput.items[0])}`);
check("首项在历史中时插入「最近使用」分隔线", quickInput.items[0]?.label === "最近使用", `条目：${JSON.stringify(itemLabels())}`);
check("历史项之后插入「其他命令」分隔线", itemLabels().indexOf("其他命令") > 0, `条目：${JSON.stringify(itemLabels())}`);

// 6) 帮助项：accept 期间打开新的快速输入，这次接受不能再关闭新浮层
//    （对齐 anythingQuickAccess.ts:844-848 的 accept → quickAccess.show(prefix, { preserveValue: true })）。
defaultProvider.getPicks = () => [
    {
        id: `help:${COMMANDS_QUICK_ACCESS_PREFIX}`,
        label: "显示并运行命令",
        description: COMMANDS_QUICK_ACCESS_PREFIX,
        accept() {
            showQuickAccess(COMMANDS_QUICK_ACCESS_PREFIX, { preserveValue: true, providerOptions: { includeHelp: true, from: "commandCenter" } });
        }
    }
];
showQuickAccess(undefined, { providerOptions: { includeHelp: true, from: "commandCenter" } });
setQuickPickActiveIndex(0);
acceptQuickPick();
check("帮助项跳转后浮层保留并切到命令提供者", isQuickPickVisible() && quickInput.placeholder === commandsProvider.placeholder, `visible=${isQuickPickVisible()} placeholder=${JSON.stringify(quickInput.placeholder)}`);
check("帮助项跳转后输入值为命令前缀（preserveValue）", quickInput.value === COMMANDS_QUICK_ACCESS_PREFIX, `value=${JSON.stringify(quickInput.value)}`);
hideQuickPick();

// 6b) Ctrl+P 不传 includeHelp：默认提供者不应收到帮助项（对齐 anythingQuickAccess.ts:408 的判真分支）。
defaultProvider.getPicks = (filter, options) => [{ id: "options", label: JSON.stringify(options ?? null) }];
showQuickAccess(undefined);
check("Ctrl+P 不请求帮助项", quickInput.items[0]?.label === "{}" || quickInput.items[0]?.label === '{"includeHelp":false}', `providerOptions=${quickInput.items[0]?.label}`);
hideQuickPick();
showQuickAccess(undefined, { providerOptions: { includeHelp: true, from: "commandCenter" } });
check("命令中心请求帮助项", quickInput.items[0]?.label === '{"includeHelp":true,"from":"commandCenter"}', `providerOptions=${quickInput.items[0]?.label}`);
hideQuickPick();

// 6c) 打开时的输入值与光标选区（对齐 quickAccess.ts:59-107 的 doShowOrPick 与 :170-186 的
//     adjustValueSelection）——preserveValue 不是「记住上次输入」，而是「已打开时不改写 + 光标置末尾」。
defaultProvider.getPicks = () => [{ id: "only", label: "唯一项" }];
showQuickAccess(undefined);
setQuickPickValue("common");
hideQuickPick();
showQuickAccess(undefined);
check("重开不保留上次输入（show(value = '')）", quickInput.value === "", `value=${JSON.stringify(quickInput.value)}`);

showQuickAccess(COMMANDS_QUICK_ACCESS_PREFIX);
setQuickPickValue(`${COMMANDS_QUICK_ACCESS_PREFIX}面板`);
showQuickAccess(COMMANDS_QUICK_ACCESS_PREFIX);
check("同一提供者已打开时保留用户输入", quickInput.value === `${COMMANDS_QUICK_ACCESS_PREFIX}面板`, `value=${JSON.stringify(quickInput.value)}`);
check("未 preserveValue 时选中前缀之后的过滤词", JSON.stringify(quickInput.valueSelection) === "[1,3]", `selection=${JSON.stringify(quickInput.valueSelection)}`);
showQuickAccess(COMMANDS_QUICK_ACCESS_PREFIX, { preserveValue: true });
check("preserveValue 时光标置末尾且不改写输入值", JSON.stringify(quickInput.valueSelection) === "[3,3]" && quickInput.value === `${COMMANDS_QUICK_ACCESS_PREFIX}面板`, `selection=${JSON.stringify(quickInput.valueSelection)} value=${JSON.stringify(quickInput.value)}`);
hideQuickPick();

// 6d) 换提供者时把已输入的过滤词带过去（对齐 quickAccess.ts:79-91），preserveValue 时则不带。
showQuickAccess(undefined);
setQuickPickValue("common");
showQuickAccess(COMMANDS_QUICK_ACCESS_PREFIX);
check("换提供者时带入过滤词", quickInput.value === ">common", `value=${JSON.stringify(quickInput.value)}`);
hideQuickPick();

// 7) 失焦隐藏（ignoreFocusOut 默认 false）。
showQuickAccess(COMMANDS_QUICK_ACCESS_PREFIX);
notifyQuickPickFocusOut();
check("失焦后浮层隐藏", !isQuickPickVisible());

// 8) 静态断言：以下三处依赖 monaco / Vue 单文件组件，Node 侧无法载入渲染，
//    故改为核对源码里的接线与权威取值（AGENTS.md 第 5 条允许的静态检查）。
const commandCenter = readSource("workbench/contrib/titlebar/commandCenter.contribution.js");
check("命令中心 run() 走 showQuickAccess", /run\s*\([\s\S]*?showQuickAccess\(/.test(commandCenter), "命令中心点击没有接到快速打开");

const commandCenterView = readSource("workbench/contrib/titlebar/CommandCenter.vue");
check("快速输入显示时命令中心加 .hide", /:class="\{ hide: hidden \}"/.test(commandCenterView) && /quickInput\.visible/.test(commandCenterView), "浮层压住标题栏时命令中心未隐藏（commandCenterControl.ts:64-82）");

const mainSource = readSource("main.js");
check("main.js 载入快速输入贡献点", mainSource.includes('"@/menu/quickInput.contribution.js"'));

// 快速打开的命令与键位、菜单落点（quickAccessActions.ts:25-29 / :125-153、
// quickAccess.contribution.ts:55-62）——该文件依赖 monaco，Node 侧只能静态核对。
const quickInputContribution = readSource("menu/quickInput.contribution.js");
check(
    "quickOpen 按权威接收 prefix 参数并据此决定 preserveValue",
    /typeof prefix === "string" \? prefix : undefined/.test(quickInputContribution) && /preserveValue: typeof prefix === "string"/.test(quickInputContribution),
    "quickOpen 未按 quickAccessActions.ts:151 传 prefix / preserveValue"
);
check("quickOpen 另绑 Ctrl+E（globalQuickAccessKeybinding 的 secondary）", quickInputContribution.includes('"Ctrl+E"'), "缺少 quickAccessActions.ts:27 的 secondary 键位");
check(
    "命令面板挂在视图菜单 1_open 组首项",
    /MenuId\.MenubarViewMenu[\s\S]{0,160}group: "1_open"[\s\S]{0,40}order: 1/.test(quickInputContribution),
    "缺少 quickAccess.contribution.ts:55-62 的菜单落点"
);
check("菜单项标题取自权威写法（命令面板…）", quickInputContribution.includes("命令面板…"), "菜单项标题与权威不一致");
check(
    "动作标题取权威写法（转到文件… / 显示所有命令）",
    quickInputContribution.includes('title: "转到文件…"') && quickInputContribution.includes('title: "显示所有命令"'),
    "quickOpen 应为 Go to File...（转到文件…），showCommands 应为 Show All Commands（显示所有命令）"
);

// 内部快速输入命令不得进命令面板（权威用 KeybindingsRegistry 注册，不进 MenuId.CommandPalette）。
const actionBlock = id => {
    const start = quickInputContribution.indexOf(`id: "${id}"`);
    if (start < 0) return null;
    return quickInputContribution.slice(start, quickInputContribution.indexOf("});", start));
};
const internalIds = [
    "quickInput.accept",
    "workbench.action.closeQuickOpen",
    "quickInput.next",
    "quickInput.previous",
    "quickInput.pageNext",
    "quickInput.pagePrevious",
    "quickInput.first",
    "quickInput.last"
];
check(
    "内部快速输入命令不挂命令面板（f1: false）",
    internalIds.every(id => actionBlock(id)?.includes("f1: false")),
    internalIds.filter(id => !actionBlock(id)?.includes("f1: false")).join(", ") + " 未标 f1: false"
);
check(
    "用户可请求的命令仍进命令面板",
    ["workbench.action.quickOpen", "workbench.action.showCommands"].every(id => {
        const block = actionBlock(id);
        return block && !block.includes("f1: false");
    }),
    "quickOpen / showCommands 被误标为 f1: false"
);

// 快捷键列只显示首选键位（权威 keybindingService.lookupKeybinding 返回单条）。
registerAction2({ id: "kb.dual", title: "双键位", keybinding: [{ primary: "Ctrl+X" }, { primary: "Ctrl+Y" }], run: () => {} });
check("快捷键列只取首选键位", getKeybindingLabel("kb.dual") === "Ctrl+X", `label=${JSON.stringify(getKeybindingLabel("kb.dual"))}`);
registerAction2({ id: "kb.chord", title: "和弦", keybinding: { primary: ["Ctrl+K", "Ctrl+W"] }, run: () => {} });
check("和弦键位以 / 连接", getKeybindingLabel("kb.chord") === "Ctrl+K / Ctrl+W", `label=${JSON.stringify(getKeybindingLabel("kb.chord"))}`);

const appSource = readSource("App.vue");
check("工作台外壳渲染快速输入浮层", appSource.includes("<QuickInputWidget"));

const widget = readSource("base/quickinput/QuickInputWidget.vue");
check("浮层输入框驱动 setQuickPickValue", widget.includes("setQuickPickValue("), "输入框没有回写值，过滤不会生效");
check("浮层条目点击走 acceptQuickPick", widget.includes("acceptQuickPick()"), "条目点击未接到接受动作");

// 列表滚动（曾整段失效：行绝对定位、行容器恒为 100%，scrollHeight 恒等于 clientHeight）：
//   行容器高度必须按内容高度写入（listView.js:140/427-429），滚轮必须由列表消费
//   （quickInputList.ts:807 的 alwaysConsumeMouseWheel）。
check(
    "行容器高度按内容高度写入",
    /rowsStyle\s*=\s*computed\([\s\S]{0,240}?items\.length \* ROW_HEIGHT/.test(widget) && /:style="rowsStyle"/.test(widget),
    "行容器高度未按条目数写入，列表 scrollHeight 等于 clientHeight，完全滚不动"
);
check(
    "滚轮由列表消费（preventDefault + scrollTop）",
    /@wheel="onWheel"/.test(widget) && /function onWheel\(event\)[\s\S]{0,240}?event\.preventDefault\(\)[\s\S]{0,240}?scrollTop \+= event\.deltaY/.test(widget),
    "缺少 quickInputList.ts:807 的滚轮消费，列表滚不动或滚动外溢给下层编辑器"
);

// 取值：浮层与列表项的颜色 token 必须齐备。`var(--vscode-x)` 在 x 未定义时整条声明无效，
// 缺 token 的表现就是「背景透明 + 当前项没有高亮」——即曾经的「样式错乱」。
// token 是否存在由 scripts/check-theme-tokens.mjs 兜底，这里只锁住组件确实引用了它们。
check(
    "浮层背景与当前项高亮取 quickInput / quickInputList token",
    ["--vscode-quickInput-background", "--vscode-quickInputList-focusBackground", "--vscode-quickInputList-focusForeground"].every(token => widget.includes(`var(${token})`)),
    "浮层缺少 quickInput / quickInputList 颜色 token，浮层会退化成透明、当前项无底色"
);
check(
    "分组标题取 descriptionForeground（quickInput.css:348-353）",
    /\.quick-input-list-separator[\s\S]{0,200}?color: var\(--vscode-descriptionForeground\)/.test(widget) && !widget.includes("pickerGroup-foreground"),
    "分组标题误用 pickerGroup token，与 quickInput.css:348-353 不一致"
);

// 文件提供者的权威取值（anythingQuickAccess.ts:101 PREFIX = ''）与帮助项跳转。
const anything = readSource("workbench/browser/quickaccess/anythingQuickAccess.js");
check("默认提供者前缀为空且占位符对齐权威", anything.includes('prefix: ""') && anything.includes('"按名称搜索文件。"'), "默认提供者前缀 / 占位符与权威不一致");
check("帮助项以命令前缀重新打开（help pick）", anything.includes("showQuickAccess(COMMANDS_QUICK_ACCESS_PREFIX"), "帮助项 '>' 无法跳到命令提供者");

console.log(`\n${failed === 0 ? "OK" : `FAIL 共 ${failed} 项`} 快速输入取数与接受链路`);
process.exit(failed === 0 ? 0 : 1);
