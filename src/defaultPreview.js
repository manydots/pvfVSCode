// 启动时的默认预览文件（编辑器输入）。
//
// 素材是仓库内的示例脚本（Squirrel，.nut），用 `?raw` 在构建期内联：启动路径保持同步，
// 没有网络请求与失败分支。后续接入 PVF 归档解析后，这里换成「从归档解出某个文件的内容」，
// editorGroupService.openEditor 的输入结构不变。
import commonNut from "@/samples/common.nut?raw";

// 编辑器输入结构见 editorGroupService._createEntry。
// id 用 `file:` 前缀表示文件型输入，与新建文件用的 `untitled:` 前缀同构。
export const DEFAULT_PREVIEW_FILE = {
    id: "file:samples/common.nut",
    name: "common.nut",
    // Monaco 内置语言中没有 Squirrel：用 plaintext，避免按 C/C++ 解析出错误的高亮与校验；
    // 接入 Squirrel 语言（Monarch）后改为对应 languageId。
    languageId: "plaintext",
    content: commonNut,
    // 固定标签（非斜体的临时预览态）：启动默认输入不应被后续打开的文件顶掉。
    pinned: true
};
