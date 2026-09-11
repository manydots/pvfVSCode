import { createApp } from "vue";
import App from "@/App.vue";
import "@/styles/app.css";
import "@/monaco/setup.js";
import "@/menu/defaultMenus.js";
import "@/menu/titleBarActions.js";
import "@/workbench/contrib/editor/editor.contribution.js";
import "@/workbench/contrib/explorer/explorer.contribution.js";
import "@/workbench/contrib/search/search.contribution.js";
import "@/workbench/contrib/scm/scm.contribution.js";
import "@/workbench/contrib/debug/debug.contribution.js";
import "@/workbench/contrib/extensions/extensions.contribution.js";
import "@/workbench/contrib/panel/panel.contribution.js";
import "@/workbench/contrib/statusbar/statusbar.contribution.js";
import { executeCommand } from "@/menu/commands.js";
import { startKeybindingDispatch } from "@/menu/keybindingService.js";

// 安装全局快捷键分发（Ctrl+J 切换面板、Ctrl+W 关闭编辑器等，见各 *.contribution.js 的 keybinding）。
startKeybindingDispatch();

// 启动时打开默认预览文件（内置示例脚本）：复用已注册的 pvf.openDefaultPreview，
// 与「帮助 > 欢迎」共用同一个 openEditor 打开路径，不另建启动专用通道。
executeCommand("pvf.openDefaultPreview");

createApp(App).mount("#app");
