// 无头核查「菜单勾选态跟随上下文键」这段纯逻辑。
//
// 为什么需要它：曾出现「切换缩略图菜单状态未同步」——菜单条目的勾选态由
// `toggled` 在解析菜单时对上下文求值（actions.js 的 resolveMenuItem，对齐
// platform/actions/common/actions.ts 的 Action.checked），一旦解析结果被快照住
// （例如已展开的子菜单只在打开时解析一次），后续上下文键变化就不会反映到菜单上。
// 本脚本固定住三条规则：
//   1. 每次解析都重新求值，不缓存（上下文键变化后 checked 必须跟着变）；
//   2. 未声明 toggled 的动作 checked 为 undefined（普通 role=menuitem，无勾选列）；
//   3. 子菜单按「重新解析」拿到新值（MenuPanel 的 props.entries 变化时就地刷新所依赖的前提）；
//   4. 同一命令的多个落点勾选态必须一致 —— 权威里 toggled 是「命令描述符」的字段，
//      registerAction2 用 `{ ...command }` 把它展开进每个落点（platform/actions/common/actions.ts:741-751），
//      勾选态也从 item.command.toggled 求值（menuService.ts:240、actions.ts:621-635）。
//      裸 appendMenuItem 手写的描述符没有该字段，于是同一命令在不同菜单里一个有勾、一个没有
//      （「切换缩略图」在编辑器标签栏「…」溢出菜单里恒不勾选即由此而来）。
//
// 唯一有出处的例外：`editor.action.toggleWordWrap` 在 `MenuId.EditorTitle` 的两条按需条目
// 在权威里就是裸 appendMenuItem（toggleWordWrap.ts:320-345）—— 两条标题不同
// （「为此文件禁用换行」/「为此文件启用换行」）且都不带 toggled（标签栏这处本就不显示勾选列），
// 因此第 4 条规则对这两条不适用，见下面的 RAW_ITEM_ALLOWLIST；其余落点不得裸写。
//
// 运行：node scripts/check-menu-toggle.mjs
//
// 说明：Node 不认识 Vite 的 `@` 别名，故用 scripts/alias-loader.mjs 挂钩后再载入被测模块；
// 业务代码仍统一使用 `@/...`（AGENTS.md 第 8 条）。
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { fileURLToPath } from "node:url";

register(new URL("alias-loader.mjs", import.meta.url));

const root = fileURLToPath(new URL("../", import.meta.url));

const { MenuId } = await import("@/menu/menuId.js");
const { registerAction2, resolveMenuEntries } = await import("@/menu/actions.js");
const { ContextKeyExpr, contextKeys } = await import("@/menu/contextKey.js");

// 用独立的 MenuId，避免与真实菜单注册表互相干扰。
const TestMenu = { id: "TestToggleMenu" };
const TestParentMenu = { id: "TestToggleParentMenu" };
const TestSecondMenu = { id: "TestToggleSecondMenu" };
// 夹具键名与形态都对齐产品：真实动作的 toggled 就是
// `ContextKeyExpr.equals('config.editor.minimap.enabled', true)`（toggleMinimap.ts:26），
// 该键的值由配置服务派生（configAwareContextValues.js）；此处直接 set，以便脱离配置层单测本段机制。
const TEST_TOGGLE_KEY = "config.editor.minimap.enabled";
const MINIMAP_ON = ContextKeyExpr.equals(TEST_TOGGLE_KEY, true);

// 同一动作挂两个菜单：勾选态必须一致（对齐 actions.ts:741-751 把命令描述符展开进每个落点）。
registerAction2({
    id: "test.toggleMinimap",
    title: "切换缩略图",
    toggled: MINIMAP_ON,
    menu: [
        { id: TestMenu, group: "1_layout", order: 1 },
        { id: TestSecondMenu, group: "1_layout", order: 1 }
    ],
    run() {
        contextKeys.set(TEST_TOGGLE_KEY, !contextKeys.get(TEST_TOGGLE_KEY));
    }
});
registerAction2({
    id: "test.noToggleState",
    title: "无勾选态的动作",
    menu: { id: TestMenu, group: "1_layout", order: 2 },
    run() {}
});
// 父菜单里放一个子菜单条目，用来验证「退出子菜单再进入」这条路径的取数。
registerAction2({
    id: "test.openSubmenu",
    title: "布局",
    menu: { id: TestParentMenu, group: "1_layout", order: 1 },
    run() {}
});
const { appendMenuItem } = await import("@/menu/actions.js");
appendMenuItem(TestParentMenu, { title: "布局", submenu: TestMenu, group: "1_layout", order: 1 });

// 与 MenuDropdown 相同的取数方式：解析父菜单 → 取子菜单条目 → 再解析子菜单。
const resolveSubmenu = entry => (entry.submenu ? resolveMenuEntries(entry.submenu, contextKeys) : []);
function resolveChecked() {
    const parent = resolveMenuEntries(TestParentMenu, contextKeys);
    const entry = parent.find(item => item.isSubmenu);
    const children = resolveSubmenu(entry);
    return {
        parentHasSubmenu: !!entry,
        checked: children.find(item => item.commandId === "test.toggleMinimap")?.checked,
        plainChecked: children.find(item => item.commandId === "test.noToggleState")?.checked
    };
}

contextKeys.set(TEST_TOGGLE_KEY, true);
const initial = resolveChecked();

contextKeys.set(TEST_TOGGLE_KEY, false);
const afterKeyChange = resolveChecked();

// 同一命令的第二个落点：与第一个菜单取到的勾选态必须一致。
function checkedIn(menuId) {
    return resolveMenuEntries(menuId, contextKeys).find(item => item.commandId === "test.toggleMinimap")?.checked;
}

// 静态不变量：裸 appendMenuItem 手写的命令描述符不带 toggled，因此不得用它给
// 「声明了 toggled 的命令」加落点 —— 那正是同一命令勾选态不一致的成因。
// 例外见文件头的 RAW_ITEM_ALLOWLIST 说明（`命令 id@菜单 id`）。
const RAW_ITEM_ALLOWLIST = new Set(["editor.action.toggleWordWrap@EditorTitle"]);

function scanToggledActionsAndRawItems() {
    const toggledIds = new Set();
    const toggledMenus = new Map(); // 动作 id → 该动作块里声明到的菜单 id 集合
    const rawCommandIds = [];
    const walk = dir => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name.endsWith(".js")) scan(full);
        }
    };
    const scan = file => {
        const lines = fs.readFileSync(file, "utf8").split("\n");
        let block = null;
        for (const line of lines) {
            if (!block) {
                if (/^\s*registerAction2\(\{/.test(line)) block = { kind: "action", id: null, toggled: false, text: [] };
                else if (/^\s*appendMenuItem\(/.test(line)) {
                    if (/\);\s*$/.test(line)) continue; // 单行调用，无需收集
                    const menu = line.match(/MenuId\.(\w+)/);
                    block = { kind: "raw", id: null, menu: menu ? menu[1] : null, file: path.relative(root, file) };
                }
                continue;
            }
            if (block.kind === "action") {
                block.text.push(line);
                const id = line.match(/^\s*id:\s*"([^"]+)"/);
                if (id && !block.id) block.id = id[1];
                if (/^\s*toggled:/.test(line)) block.toggled = true;
            } else {
                const id = line.match(/command:\s*\{\s*id:\s*"([^"]+)"/);
                if (id && !block.id) block.id = id[1];
            }
            if (/^\s*\}\);/.test(line)) {
                if (block.kind === "action" && block.id) {
                    if (block.toggled) toggledIds.add(block.id);
                    toggledMenus.set(block.id, new Set((block.text.join("\n").match(/MenuId\.(\w+)/g) ?? []).map(name => name.slice("MenuId.".length))));
                }
                if (block.kind === "raw" && block.id) rawCommandIds.push({ id: block.id, menu: block.menu, file: block.file });
                block = null;
            }
        }
    };
    walk(path.join(root, "src"));
    return { toggledIds, toggledMenus, rawCommandIds };
}

const { toggledIds, toggledMenus, rawCommandIds } = scanToggledActionsAndRawItems();
const offenders = rawCommandIds.filter(item => toggledIds.has(item.id) && !RAW_ITEM_ALLOWLIST.has(`${item.id}@${item.menu}`));
// 标签栏里的勾选项（「切换缩略图」）：落点必须由动作自身声明，否则勾选态不随命令描述符走
// （见文件头第 4 条）。「切换自动换行」不在其列：它在标签栏的两条条目是权威的裸 appendMenuItem。
const labelBarPlacements = ["editor.action.toggleMinimap"]
    .filter(id => !toggledMenus.get(id)?.has("EditorTitle"));

// 执行动作本身走的是同一条上下文键链路：run() 改上下文键，菜单重新解析即得到新勾选态。
const action = resolveMenuEntries(TestMenu, contextKeys).find(item => item.commandId === "test.toggleMinimap");
const beforeRun = resolveChecked().checked;
await import("@/menu/commands.js").then(({ executeCommand }) => executeCommand("test.toggleMinimap"));
const afterRun = resolveChecked().checked;

const cases = [
    { name: "父菜单里能取到子菜单条目", actual: initial.parentHasSubmenu, expected: true },
    { name: "配置项为 true 时勾选", actual: initial.checked, expected: true },
    { name: "上下文键变 false 后重新解析即不勾选", actual: afterKeyChange.checked, expected: false },
    { name: "动作项本身带 commandId（可执行）", actual: !!action, expected: true },
    { name: "执行切换动作前的勾选态", actual: beforeRun, expected: false },
    { name: "执行切换动作后勾选态翻转", actual: afterRun, expected: true },
    { name: "未声明 toggled 的动作没有勾选态", actual: afterKeyChange.plainChecked, expected: undefined },
    { name: "同一命令两个落点的勾选态一致", actual: checkedIn(TestMenu) === checkedIn(TestSecondMenu), expected: true },
    {
        name: "没有裸菜单项引用声明了 toggled 的命令（白名单除外）",
        actual: offenders.map(item => `${item.id}@${item.menu}（${item.file}）`).join("、"),
        expected: ""
    },
    {
        name: "白名单只覆盖 wordWrap 在标签栏的两条权威裸条目",
        actual: rawCommandIds.filter(item => item.id === "editor.action.toggleWordWrap" && item.menu === "EditorTitle").length,
        expected: 2
    },
    {
        name: "声明了 toggled 的标签栏溢出项由动作自身声明落点",
        actual: labelBarPlacements.join("、"),
        expected: ""
    }
];

let failed = 0;
for (const item of cases) {
    const ok = item.actual === item.expected;
    if (!ok) failed++;
    console.log(`${ok ? "✓" : "✗"} ${item.name}${ok ? "" : `\n    实际: ${JSON.stringify(item.actual)}\n    期望: ${JSON.stringify(item.expected)}`}`);
}

console.log(`\n${cases.length - failed}/${cases.length} 通过`);
process.exit(failed === 0 ? 0 : 1);
