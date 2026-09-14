// 资源级配置读取（对齐 <vscode>/src/vs/editor/common/services/textResourceConfigurationService.ts:15-120
// 的 TextResourceConfigurationService 与接口 :32-77）。
//
// 权威的 getValue(resource, section) 先按资源取语言 id，再以 `{ resource, overrideIdentifier }`
// 查询配置服务（:83-94），从而命中 `[language]` 覆盖段。本仓库的差异：
//   - 配置服务只有「默认 → 用户 → 内存」三层、无覆盖段，也不接受 `{ resource, overrideIdentifier }`
//     选项（configuration.js 文件头已声明）→ 取值等价于全局配置值；
//   - `resource` 参数保留（与权威同签名），语言覆盖段迁入后在此处补齐，调用方无需改动。
// 该差异与 docs/vscode-reference.md 第 5 节「无语言/资源级设置覆盖」是同一项。
//
// 权威把该服务放在 editor 层（编辑器进程也要用）；本仓库配置服务在工作台层，且当前唯一消费方
// 是工作台侧的编码决策，故就近放在配置服务旁，避免 editor 层反向依赖 workbench。
import { configurationService } from "@/workbench/services/configuration/browser/configurationService.js";

export const textResourceConfigurationService = {
    // textResourceConfigurationService.ts:83-89
    getValue(resource, section) {
        return configurationService.getValue(section);
    }
};
