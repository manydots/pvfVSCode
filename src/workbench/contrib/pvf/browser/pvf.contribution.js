// PVF 内置扩展的激活（M1：进程内直接调用）。
//
// 权威的激活链路是：扩展服务按激活事件找到扩展 → 在扩展宿主（web 端 Web Worker /
// 桌面端 Node 进程）里加载 `main` / `browser` 指向的模块并调用 `activate` —— 见
// <vscode>/src/vs/workbench/services/extensions/common/abstractExtensionService.ts:1185-1250
// 与 extensionHostManager.ts 的加载分支。本仓库 M1 还没有扩展宿主，激活退化为「启动时
// 进程内调用一次」，激活事件因此暂不参与（清单里的 activationEvents 由 M3 消费）。
//
// 该模块与清单的对应关系：src/extensions/pvf/package.json 的 `browser` 字段指向
// ./browser/pvfExtension.js，本模块就是「按该字段加载并 activate」这一步在本仓库的等价物。
//
// 激活失败不致命：与权威一致，单个扩展激活抛错不阻断工作台启动，只记录错误
// （abstractExtensionService.ts:1260-1290 的 _activateExtensions 逐扩展捕获）。
import { activate as activatePvf } from "@/extensions/pvf/browser/pvfExtension.js";

/**
 * 激活 PVF 内置扩展。必须在语言注册之后调用（语言配置与词法提供者要挂到已注册的语言 id 上，
 * 见 extensions/pvf/browser/pvfExtension.js 文件头）。
 */
export function activatePvfExtension() {
    const subscriptions = [];
    try {
        activatePvf({ subscriptions });
    } catch (error) {
        console.error("[pvf-vscode.pvf]: 扩展激活失败", error);
        for (const subscription of subscriptions) subscription.dispose();
    }
    return subscriptions;
}
