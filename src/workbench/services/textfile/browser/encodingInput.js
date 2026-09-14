// 编码决策输入（对齐 browser/textFileService.ts 的取值来源）。
//
// 权威把「读配置 + 查编码覆盖」放在服务里：
//   - textFileService.ts:809-816 的 getDefaultEncodingOverrides（用户数据目录 / .vscode 等固定覆盖）
//   - textFileService.ts:866-877 的 getUnvalidatedEncodingForResource（override → preferred → 配置）
//   - textFileService.ts:307-318 的 doGetDecodedStream（autoGuessEncoding / candidateGuessEncodings 取配置）
// 本仓库的决策链是纯函数（@/workbench/services/textfile/common/encoding.js），
// 取值留在浏览器层由本模块完成，两边一一对应。
//
// 权威的编码覆盖以「用户数据目录 / 工作区 .vscode 下的 VS Code 自有文件」为对象，
// 本仓库没有这些路径（无用户数据目录、无 .vscode 目录），故 encodingOverride 现无产出方；
// 与 docs/vscode-reference.md 第 5 节「无语言/资源级设置覆盖」是同一项。
import { textResourceConfigurationService } from "@/workbench/services/configuration/browser/textResourceConfigurationService.js";
import { FILES_ENCODING_CONFIG, FILES_AUTO_GUESS_ENCODING_CONFIG, FILES_CANDIDATE_GUESS_ENCODINGS_CONFIG } from "@/platform/files/common/files.js";

/**
 * 组装编码决策输入（IEncodingInput，见 common/encoding.js）。
 * @param {object|undefined} resource
 * @param {string} [encodingOverride] 语言/资源级覆盖；暂无产出方，保留参数以对齐权威优先级
 * @returns {{ configEncoding: any, configAutoGuessEncoding: any, candidateGuessEncodings: any, encodingOverride: string|undefined }}
 */
export function createEncodingInput(resource, encodingOverride) {
    return {
        configEncoding: textResourceConfigurationService.getValue(resource, FILES_ENCODING_CONFIG),
        configAutoGuessEncoding: textResourceConfigurationService.getValue(resource, FILES_AUTO_GUESS_ENCODING_CONFIG),
        candidateGuessEncodings: textResourceConfigurationService.getValue(resource, FILES_CANDIDATE_GUESS_ENCODINGS_CONFIG),
        encodingOverride
    };
}
