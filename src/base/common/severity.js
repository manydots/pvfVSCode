// 严重级别（对齐 <vscode>/src/vs/base/common/severity.ts:8-13）。
//
// 只迁入枚举本身：权威还有 fromValue / toString 两个辅助函数，
// 本仓库暂无消费方（扩展诊断消息目前只按级别写日志）。
export const Severity = Object.freeze({
    Ignore: 0,
    Info: 1,
    Warning: 2,
    Error: 3
});
