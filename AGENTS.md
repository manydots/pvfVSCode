# 门控文件（GATE）— pvfVSCode

> 本文件是本仓库的最高优先级约束。任何在本仓库内工作的人或智能体，在动手改动前必须先逐条满足本门控条件。
> 本文件与其它文档冲突时，以本文件为准。

## 0. 项目定位

把 VS Code 的功能「迁入」一个裁剪客户端（应用名 pvfVSCode），并在此基础上实现 PVF 归档的解析与编辑。
编辑器内核使用 npm 包 `monaco-editor@0.56.0`，不依赖也不修改 VS Code 仓库本身。

## 1. 权威参考（唯一）

- 权威参考仓库：**https://github.com/microsoft/vscode**
- 本地只读镜像：与本仓库 `vscodeCut` **同级**的 `vscode` 目录（即相对路径 `../vscode`）。
- 迁移任何 VS Code 功能前，必须先在上述仓库中定位到权威实现文件，并以该源码为准，禁止凭印象臆造样式、行为或结构。
- 代码注释中给出来源路径，例如：
  `// 对齐 workbench/contrib/explorer/browser/explorerViewlet.ts`

## 2. 禁止修改参考仓库

- `vscode` 仓库仅作只读参考，禁止写入、格式化或提交。
- 不得通过 patch VS Code 源码来获得任何能力；能力缺口用 npm `monaco-editor` 或本仓库代码补齐。

## 3. 必须与 VS Code 设计模式一致（硬门控）

必须复用 VS Code 的架构原语，禁止自造平行体系：

| 领域 | 必须使用 |
| --- | --- |
| 贡献点与注册表 | Contribution + Registry（`viewsRegistry` / `MenuRegistry` / `commands`） |
| 菜单与动作 | `MenuId` + `MenuRegistry.appendMenuItem` + `registerAction2`(Action2) + `ContextKeyExpr`(when / precondition / toggled) |
| 视图 | `ViewsRegistry.registerViewContainer` / `registerViews`，`ViewContainerLocation` |
| 主题 | 只使用 `--vscode-<token>` CSS 变量，取值来自 VS Code 主题 JSON 或 `registerColor` 默认值，禁止硬编码颜色 |
| 图标 | codicon 字体，类名 `codicon codicon-<id>` |
| 目录结构 | 对齐 `workbench/contrib/<feature>/{browser,common}` 的划分 |

**每次改动的门控检查表（全部通过才可提交/收尾）：**

1. 已定位并在注释中引用权威源文件路径；
2. 颜色、尺寸、hover/选中/聚焦等交互态取值来自源码，而非近似；
3. 未引入与 VS Code 设计模式相悖的自造抽象；
4. 优先复用已有 Registry / Service，而非绕过或另起一套；
5. 违反以上任一条即视为门控失败，必须返工。

## 4. 功能一致性检查规则（硬门控，必须严格遵守）

> 起因：曾出现「活动栏/标题栏/侧栏没有分隔线」「工具栏『…』溢出弹窗与 VS Code 不一致」
> 这类问题，根因是只对齐了大致外观、没有逐项对照权威实现的功能行为。以下规则用于杜绝复发。

**权威索引**：功能域 → 权威源码文件 → 本仓库实现的对照表在
[`docs/vscode-reference.md`](docs/vscode-reference.md)，关键 token、尺寸、定位算法已在该文件第 4 节摘录。
**改任何界面或行为前，先查该文件，再读被引用的源码，禁止凭记忆或「相似实现」推断。**

### 4.1 每个界面功能必须逐项核对的 7 个维度

对每一处涉及界面的改动，必须给出下列 7 项的对照结论（取自权威源码，落在注释或本次说明里）：

1. **DOM 结构 / 层级**：容器、列表、条目的嵌套与类名（如菜单必须是
   `容器 > 列表 > 条目 > 勾选列 + 标签 + 快捷键 + 子菜单箭头`）。
2. **取值**：颜色只允许 `--vscode-<token>`，且 token 名与默认值都能在主题 JSON 或
   `registerColor` 默认值中找到；px 尺寸（高度、内边距、外边距、圆角、字号、边框宽度）必须有源码出处。
3. **状态**：hover / active / focus / disabled / checked / selected 各自的表现
   （背景、前景、描边、透明度）必须分开对照，不得用一个 hover 色糊过去。
   特别注意：菜单选中态取 `list.hover*`（见 `defaultStyles.ts` 的 `defaultMenuStyles`），
   **不是** `menu.selection*`。
   勾选态（`checked` / `role="menuitemcheckbox"`）**只能来自权威源码声明过的 `toggled`**；
   权威实现里没有 `toggled` 的命令（例如视图容器的 `openCommandActionDescriptor`，
   见 `docs/vscode-reference.md` 第 2 节）**禁止自造勾选条件** —— 否则会出现两个条目
   共用一个勾选态这类问题（「切换面板」与「切换终端」曾如此）。
4. **交互行为**：鼠标（点击、右键、hover 展开、中键、点击外部关闭）、键盘
   （上下 / Home / End / Enter / Esc / 左右方向键）、焦点管理（关闭后焦点回到触发元素）
   必须与 VS Code 对应实现逐条比对。
5. **定位**：浮层的锚点、对齐方式（`layout2d` 的 `anchorAlignment` / `anchorPosition`）、
   间隙、溢出翻转规则必须与 `contextview.ts` / `calculateSubmenuMenuLayout` 一致。
6. **复用**：同一语义的组件只允许一份实现。菜单渲染（菜单栏下拉、上下文菜单、工具栏溢出）
   统一走 `src/base/menu/MenuPanel.vue`；不得为某一处单独 fork 一套样式或结构。
7. **顶部菜单栏唯一落点**：同一个命令在**顶部菜单栏**（`MenuId.MenubarMainMenu` 的各顶级菜单）里
   只允许出现一次；跨顶级菜单重复（如「终端」与「视图」各挂一份「切换面板」）视为门控失败。
   工具栏/标题栏下拉（如 `LayoutControlMenu` 与 `MenubarViewMenu` 同时挂 `Toggle Panel`）
   与 VS Code 一致地重复，不在此限 —— 判定前先查 `docs/vscode-reference.md` 第 2 节的落点对照表。

### 4.2 强制流程

1. 先在 `docs/vscode-reference.md` 找到权威文件并**实际打开阅读**，不读源码不许动手；
2. 改动处注释写出来源（文件 + 函数 / 选择器）；
3. 逐条填写 4.1 的 7 个维度，任一项给不出源码出处即视为未完成，不得进入下一步；
4. 出现新的权威文件或新摘录的取值，**必须回写** `docs/vscode-reference.md`，保持索引可用；
5. 验证仅限 `npm run build`、Node 逻辑测试、dev server 状态码、静态检查（见第 5 条），
   不得以「看起来差不多」作为验收依据。

### 4.3 已知偏差必须登记

凡暂时无法对齐 VS Code 的行为，必须写入 `docs/vscode-reference.md` 第 5 节「已自查记录的偏差」，
写明现状与权威行为；禁止静默偏离。

## 5. 禁止启动浏览器

- 禁止以任何方式启动浏览器进行验证：Chrome / Chromium / 无头浏览器 / Playwright / Puppeteer / 截图工具等。
- 允许的验证手段仅限：
  - `npm run build`；
  - Node 逻辑测试（纯 JS 模块单测）；
  - dev server 的 HTTP 状态码检查；
  - 静态检查（`grep`、类型检查、产物检查）。

## 6. 语言

- 思考过程与面向用户的说明使用中文。

## 7. 工程约定

- 未经明确要求不执行 `git commit` / `git push`。
- 依赖安装统一使用：
  `npm install --cache <自定义缓存目录> --no-audit --no-fund`
  （默认全局 npm 缓存目录权限属于 root，直接安装会 EACCES，故需显式指定可写的缓存目录）。
- PVF 归档解析与编辑等业务功能，待裁剪外壳确认可稳定启动后再实现。

## 8. 路径规范：禁止绝对路径，模块导入统一用 `@` 别名

- 本文件以及仓库内的文档、代码注释、脚本中，一律不得出现绝对路径地址（例如以用户主目录、系统临时目录、Windows 盘符开头的一类写法）。
- **模块导入一律使用 `@` 别名**：`@` 指向 `src`（已在 `vite.config.js` 的 `resolve.alias` 中配置），例如 `import { MenuId } from "@/menu/menuId.js"`。
  - 禁止深层相对路径（`../../`、`../../../` 这类）；同级文件也写 `@/...`，全仓保持统一。
  - 不得再新增相对模块导入；改动旧文件时顺手改为 `@/...`。
- **例外**：CSS 文件内部的 `@import` 与 `url()` 属于同目录资源引用（如 `./theme.css`、`./codicon.ttf`），保持相对路径。
- 引用仓库外的只读参考代码时，使用相对本仓库的路径（如 `../vscode`），或占位符（如 `<vscode 仓库>`、`<缓存目录>`）。
- 命令示例、构建配置、测试脚本里的路径同样遵循本规则。
- 新增或改动内容前自查一次：出现绝对路径或深层相对导入，必须先改掉再继续。
