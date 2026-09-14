import { createApp } from "vue";
import App from "@/App.vue";
import "@/styles/app.css";
import "@/monaco/setup.js";
import "@/menu/defaultMenus.js";
import "@/menu/titleBarActions.js";
import "@/menu/quickInput.contribution.js";
import "@/monaco/editorConfiguration.js";
import "@/workbench/contrib/codeEditor/browser/outline/outline.configuration.js";
import "@/workbench/contrib/editor/breadcrumbs.configuration.js";
import "@/workbench/contrib/files/browser/files.contribution.js";
import "@/workbench/contrib/titlebar/commandCenter.contribution.js";
import "@/workbench/contrib/codeEditor/wordWrap.contribution.js";
import "@/workbench/contrib/codeEditor/minimap.contribution.js";
import "@/workbench/contrib/editor/editor.contribution.js";
import "@/workbench/contrib/editor/breadcrumbs.contribution.js";
import "@/workbench/contrib/explorer/explorer.contribution.js";
import "@/workbench/contrib/search/search.contribution.js";
import "@/workbench/contrib/scm/scm.contribution.js";
import "@/workbench/contrib/debug/debug.contribution.js";
import "@/workbench/contrib/extensions/extensions.contribution.js";
import "@/workbench/contrib/panel/panel.contribution.js";
import "@/workbench/contrib/statusbar/statusbar.contribution.js";
import { executeCommand } from "@/menu/commands.js";
import { contextKeys } from "@/menu/contextKey.js";
import { startKeybindingDispatch } from "@/menu/keybindingService.js";
import { configurationService, initConfigurationService } from "@/workbench/services/configuration/browser/configurationService.js";
import { registerBuiltinExtensions } from "@/workbench/services/extensions/common/builtinExtensions.js";
import { initLanguageService } from "@/workbench/services/language/common/languageService.js";
import { activatePvfExtension } from "@/workbench/contrib/pvf/browser/pvf.contribution.js";
import { applyFileIconTheme } from "@/workbench/services/themes/fileIconTheme.js";

// 配置服务：读回默认层（ConfigurationRegistry 的 schema.default）与用户层（settings.json），
// 并把它接到上下文键服务上，使 `config.*` 上下文键可用（对齐工作台启动时创建
// IConfigurationService 并注入 ContextKeyService，见 workbench.ts 与 contextKeyService.ts:104-176）。
// 必须早于编辑器部件创建与菜单首次求值：editor.minimap.enabled 决定缩略图初值、
// editor.wordWrap 决定换行初值，两者都取自这里。
initConfigurationService();
contextKeys.attachConfigurationService(configurationService);

// 安装全局快捷键分发（Ctrl+J 切换面板、Ctrl+W 关闭编辑器等，见各 *.contribution.js 的 keybinding）。
startKeybindingDispatch();

// 扩展装配三步，顺序即依赖顺序（对齐启动时「扫描内置扩展 → 投递扩展点 → 激活扩展」）：
//   1) 把内置扩展清单投递到扩展点 —— languages 扩展点在这里把语言登记进 monaco；
//   2) 初始化语言服务 —— 叠加 files.associations 用户层并重算已打开模型；
//   3) 激活 PVF 扩展 —— 词法 / 语言配置 / 文档符号要挂到已注册的语言 id 上。
registerBuiltinExtensions();
initLanguageService();
activatePvfExtension();

// 注入文件图标主题样式表（Seti）：条目只需带 file-icon 类，图标由 ::before 渲染。
applyFileIconTheme();

// 启动时打开默认预览文件（内置示例脚本）：复用已注册的 pvf.openDefaultPreview，
// 与「帮助 > 欢迎」共用同一个 openEditor 打开路径，不另建启动专用通道。
executeCommand("pvf.openDefaultPreview");

createApp(App).mount("#app");
