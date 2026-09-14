// 无头核查「命令中心标签 / 悬浮提示」这两段纯逻辑。
//
// 为什么需要它：命令中心的圆角框里只有一行文字，它对不对取决于两条来自权威的规则 ——
// 标签取工作区名并把换行显示为 ⏎（commandCenterControl.ts:216-235），提示为
// `Search {workspace} ({kb}) — {windowTitle}`（:254-263）。这两条都在 Node 侧可复现，
// 故用逻辑测试固定住（AGENTS.md 第 5 条允许的验证手段之一）。
//
// 运行：node scripts/check-command-center.mjs
//
// 说明：Node 不认识 Vite 的 `@` 别名，故本脚本用相对 URL 动态载入纯函数模块；
// 业务代码仍统一使用 `@/...`（AGENTS.md 第 8 条）。
const srcRoot = new URL("../src/", import.meta.url);
const { getCommandCenterLabel, getCommandCenterTooltip } = await import(new URL("workbench/contrib/titlebar/commandCenter.js", srcRoot));

const cases = [
    { name: "标签取工作区名", actual: getCommandCenterLabel("pvfVSCode"), expected: "pvfVSCode" },
    { name: "标签把换行显示为 ⏎", actual: getCommandCenterLabel("a\r\nb\nc"), expected: "a\u23CEb\u23CEc" },
    { name: "工作区名为空时回退「搜索」", actual: getCommandCenterLabel(""), expected: "搜索" },
    { name: "无快捷键的提示", actual: getCommandCenterTooltip("pvfVSCode", "pvfVSCode — common.nut", ""), expected: "搜索 pvfVSCode — pvfVSCode — common.nut" },
    { name: "带快捷键的提示", actual: getCommandCenterTooltip("pvfVSCode", "pvfVSCode — common.nut", "Ctrl+P"), expected: "搜索 pvfVSCode (Ctrl+P) — pvfVSCode — common.nut" }
];

let failed = 0;
for (const item of cases) {
    const ok = item.actual === item.expected;
    if (!ok) failed++;
    console.log(`${ok ? "✓" : "✗"} ${item.name}${ok ? "" : `\n    实际: ${JSON.stringify(item.actual)}\n    期望: ${JSON.stringify(item.expected)}`}`);
}

console.log(`\n${cases.length - failed}/${cases.length} 通过`);
process.exit(failed === 0 ? 0 : 1);
