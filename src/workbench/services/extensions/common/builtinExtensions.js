// 内置扩展的扫描与登记（对齐 <vscode>/src/vs/workbench/services/extensionManagement/browser/
// builtinExtensionsScannerService.ts:28-95 的 BuiltinExtensionsScannerService）。
//
// 权威从磁盘上的内置扩展目录（`resources/app/extensions`，web 端是打包进产物的清单）
// 逐个读 package.json 并构造 IExtensionDescription（:75 的 isBuiltin: true）；
// 本仓库的扩展随源码打包，没有运行期目录扫描，故清单在构建期静态引入 —— 等价物是
// 「扫描结果」这一份列表，而不是扫描动作本身。
//
// 生成的扩展描述随后由 abstractExtensionService.ts:1160-1171 投递到各扩展点
// （本仓库的等价物是 ExtensionsRegistry.setExtensionDescriptions，见 extensionsRegistry.js）。
//
// 未迁入：
//   - 扩展排序/去重与 extensionDependencies 解析（权威在 extensionDescriptionRegistry.ts:71-137）：
//     本仓库只有一个内置扩展，无依赖关系；
//   - 扩展启用/禁用状态与用户安装扩展（webExtensionsScannerService.ts）：M5 的扩展管理服务。

import { createExtensionDescription } from "@/platform/extensions/common/extensions.js";
import { ExtensionsRegistry } from "@/workbench/services/extensions/common/extensionsRegistry.js";
import pvfManifest from "@/extensions/pvf/package.json";

// 扩展位置：权威是扩展目录的 URI（builtinExtensionsScannerService.ts:74 的 extensionLocation）；
// 本仓库的内置扩展随应用打包、没有磁盘目录，这里构造一个稳定的标识供消息与后续
// 「扩展资源加载」使用（scheme 与本仓库已有的 pvf 业务 scheme 区分开）。
function _builtinExtensionLocation(name) {
    return { scheme: "pvf-builtin", path: `/${name}` };
}

// 内置扩展清单（当前只有 PVF 一份；新增内置扩展在此登记）。
const BUILTIN_MANIFESTS = [pvfManifest];

export const builtinExtensions = BUILTIN_MANIFESTS.map(manifest => createExtensionDescription(manifest, _builtinExtensionLocation(manifest.name), { isBuiltin: true }));

/**
 * 把所有内置扩展描述投递到已注册的扩展点。必须在各扩展点（如 languages）的 handler 注册之后、
 * 依赖这些声明的服务（如语言关联）初始化之前调用一次。
 */
export function registerBuiltinExtensions() {
    ExtensionsRegistry.setExtensionDescriptions(builtinExtensions);
    return builtinExtensions;
}
