// Node 侧的 `@` 别名解析钩子，仅供 check-*.mjs 这类无头逻辑测试使用。
//
// 业务代码统一使用 `@/...`（AGENTS.md 第 8 条），而 Node 不认识 Vite 的别名，
// 因此测试脚本用 module.register 挂上本钩子后再动态载入被测模块。
// 用法见 scripts/check-quickinput.mjs。
const srcRoot = new URL("../src/", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
    if (specifier === "@" || specifier.startsWith("@/")) {
        return { url: new URL(specifier.slice(2), srcRoot).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
}
