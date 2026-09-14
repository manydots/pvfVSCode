// 文件相关的平台常量（对齐 <vscode>/src/vs/platform/files/common/files.ts）。
//
// M1 只迁入语言识别需要的 FILES_ASSOCIATIONS_CONFIG；M2 追加编码决策链需要的三个键；
// 资源管理器的文件图标类名按 FileKind 分叉（getIconClasses.ts:27-43），故再迁入 FileKind 枚举。
// 文件服务的其余部分（IFileService / IFileSystemProvider / FileType）随 M2b 的文件服务落地，
// 见 docs/plugin-system-design.md 第 12 节。
//
// 注：权威对编码三项用字面量（textFileService.ts:852、:873、:311 等），只有 associations 有常量；
// 本仓库每项都有两处消费（schema 注册 + 消费方），故统一提取常量，避免字面量分叉。

// files.ts:1516
export const FILES_ASSOCIATIONS_CONFIG = "files.associations";
// files.contribution.ts:190-215（权威用字面量，消费方 textFileService.ts:873）
export const FILES_ENCODING_CONFIG = "files.encoding";
export const FILES_AUTO_GUESS_ENCODING_CONFIG = "files.autoGuessEncoding";
export const FILES_CANDIDATE_GUESS_ENCODINGS_CONFIG = "files.candidateGuessEncodings";

// files.ts:1557-1561
export const FileKind = Object.freeze({
    FILE: 0,
    FOLDER: 1,
    ROOT_FOLDER: 2
});
