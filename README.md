# pvfVSCode

把 VS Code 的功能「迁入」一个裁剪客户端，再在此基础上实现 PVF 归档的解析与编辑。编辑器内核使用 npm 包 `monaco-editor@0.56.0`，不依赖也不修改 VS Code 仓库本身。

## 已实现的基础库

| 库             | 内容                                                                                          | 位置                                                                          |
| -------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| PVF 归档库     | 解析、解密、解码、编辑、重建、保存；覆盖 original / Guard / protected_nkpi / 繁体 TW 四种包头 | `src/utils/pvfTool.js`、`pvfToolTw.js`、`pvfCodec.js`                         |
| 编码库         | UTF-8 / GBK / BIG5 / EUC-KR（CP949）识别与互转                                                | `src/utils/encoding.js`、`gbkEncoder.js`、`big5Encoder.js`、`euckrEncoder.js` |
| 脚本校验       | PVF 脚本语法格式检查                                                                          | `src/utils/pvfValidator.js`                                                   |
| 基础 UI 原语   | 菜单面板、工具栏、空视图、布局分隔条（对齐 `base/browser/ui`）                                | `src/base/`                                                                   |
| 菜单与命令机制 | `MenuId`、`MenuRegistry` / `Action2`、`CommandsRegistry`、`ContextKeyExpr`、快捷键分发        | `src/menu/`                                                                   |
| 视图注册表     | 视图容器与视图注册、容器的显示与切换                                                          | `src/workbench/viewsRegistry.js`、`viewService.js`                            |

> PVF 库尚未接入界面：「打开 PVF 归档…」「保存 PVF 归档」的 `precondition` 是 context key `pvfArchiveSupport`，当前无处置真，两个命令不可用。

## 已迁移的功能

- workbench 布局：标题栏 / 活动栏 / 侧栏 / 编辑器区（标签页）/ 底部面板 / 状态栏（`src/App.vue`）
- Monaco 编辑器内核：编辑、查找、折叠、多光标、括号匹配等，自定义深色主题 `pvf-dark`
- 菜单栏与下拉菜单、命令注册与执行、全局快捷键分发
- 视图容器：侧栏（资源管理器 / 搜索 / 源代码管理 / 调试 / 扩展）、底部面板（问题 / 输出 / 调试控制台 / 终端 / 端口）
- 可拖拽布局：侧栏右边界与面板顶部共用分隔条组件 `src/base/sash/Sash.vue`
- 启动默认打开内置示例脚本（`src/samples/common.nut`）

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
    ├── monaco/                    Monaco 内核初始化（setup.js）与 codicon 字体
    ├── styles/                    theme.css（--vscode-* 主题 token）、app.css
    ├── samples/common.nut         启动时的默认预览素材（构建期内联）
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
        └── contrib/               各功能域，一个 feature 一个目录
            ├── editor/            编辑器部件与标签页（EditorPart.vue、EditorTabs.vue）
            ├── explorer/          资源管理器
            ├── search/            搜索
            ├── scm/               源代码管理（界面复用 base/views/EmptyView.vue）
            ├── debug/             调试（界面复用 base/views/EmptyView.vue）
            ├── extensions/        扩展（界面复用 base/views/EmptyView.vue）
            ├── panel/             底部面板（PanelPart.vue、views/OutputView.vue、views/TerminalView.vue）
            └── statusbar/         状态栏（StatusBarPart.vue、statusbarService.js）
```

## 部署

推送到 `main` 后，GitHub Actions（`.github/workflows/deploy.yml`）自动完成 `yarn install --frozen-lockfile` → `yarn build`，并把 `dist/` 作为 Pages 产物发布；也可在 Actions 页手动触发（`workflow_dispatch`）。

- **首次启用**：仓库 Settings → Pages → Source 选择 **GitHub Actions**，之后访问 `https://<用户名>.github.io/<仓库名>/`。
- **子路径**：Pages 项目站点挂在 `/<仓库名>/` 下，构建时 `vite.config.js` 依据 Actions 注入的 `GITHUB_REPOSITORY` 自动把 `base` 设为 `/<仓库名>/`，因此无需在配置里写死仓库名；本地开发与用户站点（`<用户名>.github.io`）仍为根路径。
- **本地构建**：`yarn build`，产物在 `dist/`。
