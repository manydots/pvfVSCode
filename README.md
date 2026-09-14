# pvfVSCode

VS Code Monaco编辑器

## 已迁移的功能

- workbench 布局：标题栏 / 活动栏 / 侧栏 / 编辑器区（标签页）/ 底部面板 / 状态栏（`src/App.vue`）
- Monaco 编辑器内核：编辑、查找、折叠、多光标、括号匹配等，自定义深色主题 `pvf-dark`
- 语法着色：NUT（Squirrel）与 PVF 文本（`.lst` / `.dat` / `.str` / `.aic` / `.ani` / `.etc` / `.stk`）的词法高亮，token 颜色取 VS Code 深色主题链的 `tokenColors`（`docs/vscode-reference.md` 4.15）；`// xxx` 与 `#PVF_File` 两种行注释都按注释着色（VS Code 经典注释绿 `#6A9955` —— 2026-dark 主题的注释是灰的，这一条与 NUT 字符串颜色同属产品决定，见第 5 节）
- 菜单栏与下拉菜单、命令注册与执行、全局快捷键分发
- 视图容器：侧栏（资源管理器 / 搜索）与底部面板（输出 / 终端）的容器注册、显示与切换
- 文件图标主题：Seti 彩色图标（资源管理器的「打开的编辑器」与编辑器标签按文件名 / 扩展名 / 语言显示）
- 编辑器面包屑：标签栏下方显示「文件路径段 + 当前函数/类段」，支持点击定位与键盘聚焦（`Ctrl+Shift+.` / `Ctrl+Shift+;` / ←→）。符号段跟随**光标**（150ms 防抖）——与 VS Code 一致（`documentSymbolsOutline.ts:364-371` 不订阅滚动）
- 标题栏命令中心：标题栏中间显示命令中心圆角框（紧凑模式：工作区名 + 悬停变亮），实现 `window.commandCenter` 默认开启的替换标题文本行为。点击后的快速打开浮层尚未迁移（只提示），见 `docs/vscode-reference.md` 4.9 与第 5 节
- 粘性滚动：滚动代码区时在代码区顶部固定「当前作用域」行，即「滚动时看当前函数」的那处显示（VS Code 默认取值 `enabled / maxLineCount 5 / outlineModel / scrollWithEditor`，落在 `EditorPart.vue`；对照表见 `docs/vscode-reference.md` 4.7）
- 可拖拽布局：侧栏右边界与面板顶部共用分隔条组件 `src/base/sash/Sash.vue`
- 启动默认打开内置样本（`src/samples/common.nut`）；`src/samples/` 下的样本在构建期整体内联，经「快速打开（Ctrl+P）→ 内置文件」或侧栏「打开的编辑器」切换

## 项目结构

```text
vscodeCut/
├── .github/workflows/deploy.yml   自动发布：main 分支推送即构建并部署到 GitHub Pages
├── AGENTS.md                      门控文件（最高优先级约束，与其它文档冲突时以它为准）
├── README.md                      本文件
├── docs/
│   └── vscode-reference.md        VS Code 权威源码对照表 + 已自查记录的偏差
├── index.html                     入口 HTML（挂载 #app，引入 main.js 模块）
├── package.json                   依赖与 npm 脚本
├── vite.config.js                 构建配置；`@` → `src` 别名在这里定义
├── jsconfig.json                  编辑器用的路径提示（`@/*` → `src/*`）
└── src/
    ├── main.js                    应用入口：启动快捷键分发、打开默认预览、挂载 App
    ├── App.vue                    workbench 整壳布局（对齐 VS Code grid 的部件划分）
    ├── builtInFiles.js            内置文件清单（src/samples/* 构建期内联 + 欢迎页）：快速打开与启动默认预览的取数来源
    ├── base/                      跨功能复用的基础 UI 原语（对齐 base/browser/ui）
    │   ├── sash/Sash.vue          布局分隔条（拖拽调宽/高），侧栏与面板共用
    │   ├── menu/MenuPanel.vue     菜单 widget 面板
    │   ├── toolbar/               工具栏与条目视图（Toolbar.vue、ActionView.vue）
    │   └── views/EmptyView.vue    空视图占位
    ├── components/                外壳部件
    │   ├── TitleBar.vue           标题栏
    │   ├── ActivityBar.vue        活动栏
    │   ├── Sidebar.vue            侧栏（承载可拖拽分隔条，见 base/sash/Sash.vue）
    │   ├── MenuBar.vue            菜单栏
    │   ├── MenuDropdown.vue       下拉菜单
    │   ├── MenuToolbar.vue        菜单工具栏
    │   ├── Codicon.vue            codicon 图标
    │   └── WorkbenchIcon.vue      workbench 图标（统一走 codicon 字体）
    ├── menu/                      菜单与命令基础机制（对齐 platform/actions 等）
    │   ├── menuId.js              菜单标识（MenuId）
    │   ├── actions.js             菜单注册表与动作注册（MenuRegistry / Action2）
    │   ├── commands.js            命令注册表（CommandsRegistry）
    │   ├── contextKey.js          上下文键与 when 表达式
    │   ├── keybindingService.js   快捷键注册与分发
    │   ├── appState.js            响应式视图状态（菜单命令与组件共享）
    │   ├── defaultMenus.js        默认菜单与命令注册
    │   ├── titleBarActions.js     标题栏工具栏动作
    │   ├── menuToolbar.js         菜单 → 工具栏动作适配
    │   └── editorService.js       活动编辑器服务（与 Monaco 交互的入口）
    ├── monaco/                    Monaco 内核初始化（setup.js）、Squirrel 符号提供者（squirrel.js / squirrelSymbols.js）、
    │                             大纲取数（documentSymbols.js / outlinePath.js）与 codicon 字体
    ├── styles/                    theme.css（--vscode-* 主题 token）、app.css
    ├── samples/                   内置样本（构建期内联）：common.nut（Squirrel）、n_string.lst（.lst 列表）、
    │                              690017000.stk 与 2011_championship_pack_at_ft.stk（.stk token 流）、
    │                              stringtable.bin（TW 字符串表可读视图）
    ├── utils/                     PVF 归档库与编码工具
    │   ├── pvfTool.js             PVF 归档解析 / 编辑 / 重建 / 保存（PvfArchive）
    │   ├── pvfToolTw.js           繁体 TW PVF 归档（独立层，API 对齐 PvfArchive 子集）
    │   ├── pvfCodec.js            加解密、压缩解压、二进制读写原语
    │   ├── pvfValidator.js        PVF 脚本语法格式检查
    │   ├── encoding.js            编码识别与互转（UTF-8 / GBK / BIG5 / EUC-KR 等）
    │   ├── gbkEncoder.js          Unicode → GBK 映射
    │   ├── big5Encoder.js         Unicode → Big5 映射
    │   └── euckrEncoder.js        Unicode → EUC-KR / CP949 映射
    └── workbench/
        ├── viewsRegistry.js       视图容器 / 视图注册表
        ├── viewService.js         视图容器的显示与切换
        ├── services/themes/       文件图标主题（fileIconTheme.js + seti/ 主题数据与字体）
        └── contrib/               各功能域，一个 feature 一个目录
            ├── titlebar/          标题栏命令中心（CommandCenter.vue、commandCenter.contribution.js、commandCenter.js）
            ├── editor/            编辑器部件、标签页与面包屑（EditorPart.vue、EditorTabs.vue、EditorBreadcrumbs.vue）
            ├── explorer/          资源管理器
            ├── search/            搜索
            ├── scm/               源代码管理（界面复用 base/views/EmptyView.vue）
            ├── debug/             运行和调试（界面复用 base/views/EmptyView.vue）
            ├── extensions/        扩展（界面复用 base/views/EmptyView.vue）
            ├── panel/             底部面板（PanelPart.vue、views/OutputView.vue、views/TerminalView.vue；问题 / 调试控制台 / 端口复用 base/views/EmptyView.vue）
            └── statusbar/         状态栏（StatusBarPart.vue、statusbarService.js）
```

## 部署

推送到 `main` 后，GitHub Actions（`.github/workflows/deploy.yml`）自动完成 `yarn install --frozen-lockfile` → `yarn build`，并把 `dist/` 作为 Pages 产物发布；也可在 Actions 页手动触发（`workflow_dispatch`）
