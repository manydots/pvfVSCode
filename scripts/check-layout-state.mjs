// 无头核查「布局状态持久化」这条链路（对齐 <vscode>/src/vs/workbench/browser/layout.ts 的状态模型
// 与 <vscode>/src/vs/platform/storage/common/storage.ts 的存储语义）。
//
// 固定住四类规则：
//   1. 键名与作用域：存储里的键是 `workbench.<name>`（LayoutStateModel.STORAGE_PREFIX，layout.ts:2941），
//      `sideBar.size` / `panel.size` 在 PROFILE 作用域、显隐与最大化在 WORKSPACE 作用域（layout.ts:2878-2909）；
//      浏览器实现里默认档案与全局存储共用 `vscode-web-state-db-global`，
//      空白窗口的工作区存储是 `vscode-web-state-db-empty-window`（storageService.ts:121-133、workspace.ts:156）。
//   2. 写入时序：store 只标记待写，flush 时才落盘，且 flush 先 fire onWillSaveState 再写
//      （platform/storage/common/storage.ts:614-617）—— 布局要在这一步采样部件尺寸。
//   3. 恢复：读回的值进 appState；面板最大化不在启动时恢复，只在面板重新显示时按
//      workbench.panel.opensMaximized 的默认值 'preserve' 切过去（layout.ts:2155-2162、:2279-2288）。
//   4. 夹取与容错：越界或损坏的尺寸回落到合法区间，损坏的存储文档回落到默认值
//      （workbench/browser/partDimensions.js，取值出处见该文件）。
//
// 运行：node scripts/check-layout-state.mjs
//
// 说明：Node 不认识 Vite 的 `@` 别名，故用 scripts/alias-loader.mjs 挂钩后再载入被测模块；
// 业务代码仍统一使用 `@/...`（AGENTS.md 第 8 条）。
import { register } from "node:module";
import { nextTick } from "vue";

register(new URL("alias-loader.mjs", import.meta.url));

const WORKSPACE_DOCUMENT = "vscode-web-state-db-empty-window";
const GLOBAL_DOCUMENT = "vscode-web-state-db-global";
const TARGET_KEY = "__$__targetStorageMarker";

// 最小 localStorage 替身（只需要 getItem / setItem）。
function createMemoryStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        data,
        getItem: key => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => data.set(key, String(value)),
        document: key => JSON.parse(data.get(key) ?? "{}")
    };
}

const cases = [];
function check(name, actual, expected) {
    cases.push({ name, actual, expected });
}
function reloadModel() {
    const model = new LayoutStateModel(storageService);
    model.load({ mainContainerWidth: 800, mainContainerHeight: 600 });
    return model;
}

// 伪造浏览器环境后再载入模块：storageService 单例在导入时读取 globalThis.localStorage。
const storage = createMemoryStorage();
globalThis.localStorage = storage;
globalThis.window = { innerWidth: 800, innerHeight: 600, addEventListener() {} };

const { appState } = await import("@/menu/appState.js");
const { BrowserStorageService, storageService } = await import("@/platform/storage/browser/storageService.js");
const { initLayoutState } = await import("@/workbench/browser/layout.js");
const { LayoutStateModel, LayoutStateKeys } = await import("@/workbench/browser/layoutStateModel.js");
const { clampPanelHeight, clampSidebarWidth } = await import("@/workbench/browser/partDimensions.js");

// ---------------------------------------------------------------------------
// 1. 模型：空存储时取权威默认值，尺寸默认值是动态算出来的（layout.ts:3026、:3066）
// ---------------------------------------------------------------------------
{
    const model = reloadModel();

    check("空存储：侧栏默认可见", model.getRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN), false);
    check("空存储：面板默认隐藏", model.getRuntimeValue(LayoutStateKeys.PANEL_HIDDEN), true);
    check("空存储：状态栏默认可见", model.getRuntimeValue(LayoutStateKeys.STATUSBAR_HIDDEN), false);
    check("空存储：面板默认未最大化", model.getRuntimeValue(LayoutStateKeys.PANEL_WAS_LAST_MAXIMIZED), false);
    check("侧栏宽默认 min(300, 容器宽/4)", model.getInitializationValue(LayoutStateKeys.SIDEBAR_SIZE), 200);
    check("面板高默认 容器高/3", model.getInitializationValue(LayoutStateKeys.PANEL_SIZE), 200);
}

// ---------------------------------------------------------------------------
// 2. 写入与落盘时序：store 只标记待写；flush 时先 fire onWillSaveState 再写文档
// ---------------------------------------------------------------------------
{
    const model = reloadModel();
    model.setRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN, true);
    model.save(true, true);

    check("未 flush 前不落盘", storage.getItem(WORKSPACE_DOCUMENT), null);

    let documentDuringWillSave = null;
    storageService.onWillSaveState(() => {
        documentDuringWillSave = storage.getItem(WORKSPACE_DOCUMENT);
    });
    storageService.flush();

    check("flush 时 onWillSaveState 先于落盘触发", documentDuringWillSave, null);
    check("WORKSPACE 键落进空白窗口文档", storage.document(WORKSPACE_DOCUMENT)["workbench.sideBar.hidden"], "true");
    check("PROFILE 键与全局存储同库", storage.document(GLOBAL_DOCUMENT)["workbench.sideBar.size"], "200");
    // save(true, true) 会写该作用域的全部键，目标映射表随之记录每个键的 StorageTarget（MACHINE = 1）。
    // 映射表本身是文档里的一个条目，值是 JSON 字符串（storage.ts:535-553）。
    check(
        "WORKSPACE 文档的目标映射表",
        Object.keys(JSON.parse(storage.document(WORKSPACE_DOCUMENT)[TARGET_KEY])).sort().join(","),
        [
            "workbench.panel.hidden",
            "workbench.panel.wasLastMaximized",
            "workbench.sideBar.hidden",
            "workbench.statusBar.hidden"
        ].sort().join(",")
    );
    check(
        "PROFILE 文档的目标映射表",
        Object.keys(JSON.parse(storage.document(GLOBAL_DOCUMENT)[TARGET_KEY])).sort().join(","),
        ["workbench.panel.size", "workbench.sideBar.size"].sort().join(",")
    );
}

// ---------------------------------------------------------------------------
// 3. 刷新往返：重新 load（等价于刷新后重新读）能取回上次写入的值
// ---------------------------------------------------------------------------
{
    check("刷新后读回侧栏隐藏", reloadModel().getRuntimeValue(LayoutStateKeys.SIDEBAR_HIDDEN), true);

    // 模拟 will-save：布局把部件当前尺寸采样进初始化键后整体落盘（layout.ts:1721-1744）
    const model = reloadModel();
    model.setInitializationValue(LayoutStateKeys.SIDEBAR_SIZE, 260);
    model.setRuntimeValue(LayoutStateKeys.PANEL_WAS_LAST_MAXIMIZED, true);
    model.save(true, true);
    storageService.flush();

    const reloaded = reloadModel();
    check("刷新后读回侧栏宽度", reloaded.getInitializationValue(LayoutStateKeys.SIDEBAR_SIZE), 260);
    check("刷新后读回面板最大化标志", reloaded.getRuntimeValue(LayoutStateKeys.PANEL_WAS_LAST_MAXIMIZED), true);
    check("尺寸以字符串存放", storage.document(GLOBAL_DOCUMENT)["workbench.sideBar.size"], "260");
}

// ---------------------------------------------------------------------------
// 4. 端到端：initLayoutState() 把存储里的值恢复进 appState，并把运行期变化写回
// ---------------------------------------------------------------------------
{
    storage.data.clear(); // 清空后重新预置文档（等价于上次会话留下的状态）
    storage.data.set(
        WORKSPACE_DOCUMENT,
        JSON.stringify({
            "workbench.sideBar.hidden": "true",
            "workbench.panel.hidden": "true",
            "workbench.panel.wasLastMaximized": "true"
        })
    );
    // 尺寸是 PROFILE 作用域，与全局存储同库（storageService.ts:121-133）
    storage.data.set(GLOBAL_DOCUMENT, JSON.stringify({ "workbench.sideBar.size": "260", "workbench.panel.size": "240" }));
    storageService._documents.clear(); // 让单例按新文档重新装载

    const stateModel = initLayoutState();

    check("启动恢复：侧栏隐藏", appState.sidebarVisible, false);
    check("启动恢复：侧栏宽度", appState.sidebarWidth, 260);
    check("启动恢复：面板隐藏", appState.panelVisible, false);
    check("启动恢复：面板高度", appState.panelHeight, 240);
    check("启动恢复：状态栏可见", appState.statusBarVisible, true);
    check("启动不恢复面板最大化（只在显示时切，layout.ts:2155-2158）", appState.panelMaximized, false);

    // 重新显示面板：按 workbench.panel.opensMaximized 默认值 'preserve' 恢复到上次的最大化状态
    appState.panelVisible = true;
    await nextTick();
    check("重新显示面板时恢复上次最大化状态", appState.panelMaximized, true);

    // 用户还原面板大小：标志跟着变（layout.ts:2276）。
    // WORKSPACE 作用域的运行时键只在 will-save 时落盘，所以这里读状态模型而不是存储。
    appState.panelMaximized = false;
    await nextTick();
    check("还原面板后标志变 false", stateModel.getRuntimeValue(LayoutStateKeys.PANEL_WAS_LAST_MAXIMIZED), false);

    // 隐藏面板 → 记下隐藏前的状态（layout.ts:2159-2162）；will-save 落盘
    appState.panelVisible = false;
    await nextTick();
    storageService.flush();
    check("隐藏面板写入 panel.hidden", storage.document(WORKSPACE_DOCUMENT)["workbench.panel.hidden"], "true");
    check("隐藏面板写入上次最大化状态", storage.document(WORKSPACE_DOCUMENT)["workbench.panel.wasLastMaximized"], "false");
    check("will-save 采样侧栏宽度", storage.document(GLOBAL_DOCUMENT)["workbench.sideBar.size"], "260");
    check("will-save 采样面板高度", storage.document(GLOBAL_DOCUMENT)["workbench.panel.size"], "240");
}

// ---------------------------------------------------------------------------
// 5. 容错与夹取
// ---------------------------------------------------------------------------
{
    // 存储文档损坏：浏览器实现按「没有存过」处理，模型回落到默认值（不抛错）
    const corrupt = createMemoryStorage({ [WORKSPACE_DOCUMENT]: "{ 坏掉的 JSON" });
    const corruptService = new BrowserStorageService({ storage: corrupt, flushInterval: 0 });
    corruptService.initialize();
    const model = new LayoutStateModel(corruptService);
    model.load({ mainContainerWidth: 800, mainContainerHeight: 600 });

    check("文档损坏时回落到默认值", model.getRuntimeValue(LayoutStateKeys.PANEL_HIDDEN), true);
    check("文档损坏时尺寸回落动态默认值", model.getInitializationValue(LayoutStateKeys.SIDEBAR_SIZE), 200);
    corruptService.dispose();

    check("尺寸损坏（NaN）回落首选值", clampSidebarWidth(Number.NaN, 800), 300);
    check("侧栏宽下限 170", clampSidebarWidth(2, 800), 170);
    check("侧栏宽上限 = 容器宽 - 活动栏 - 编辑器最小宽", clampSidebarWidth(5000, 800), 532);
    check("面板高下限 77", clampPanelHeight(5, 600), 77);
    check("面板高上限 = 容器高 - 64", clampPanelHeight(5000, 600), 536);
}

storageService.dispose();

let failed = 0;
for (const item of cases) {
    const ok = item.actual === item.expected;
    if (!ok) failed++;
    console.log(`${ok ? "✓" : "✗"} ${item.name}${ok ? "" : `\n    实际: ${JSON.stringify(item.actual)}\n    期望: ${JSON.stringify(item.expected)}`}`);
}

console.log(`\n${cases.length - failed}/${cases.length} 通过`);
process.exit(failed === 0 ? 0 : 1);
