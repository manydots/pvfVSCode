# VS Code 权威源码对照表（pvfVSCode）

> 本文件是 [`AGENTS.md`](../AGENTS.md) 第 1 条「权威参考」的落地索引：记录每个功能域在
> 只读参考仓库（与本仓库同级的 `vscode` 目录，即 `../vscode`）中的权威实现文件，
> 以及本仓库的对应实现。迁移/修改任何界面或行为前，先在此查到权威文件，再读源码，最后动手。
>
> 路径一律相对本仓库书写。`VS Code <path>` 表示 `<vscode 仓库>/<path>`。

## 0. 使用方式

1. 按下表定位「权威文件」，用编辑器打开该文件读实现（不要凭印象）；
2. 拷贝取值（颜色 token、px 尺寸、类名、DOM 层级、交互分支）到本仓库对应文件；
3. 在改动处代码注释里写出引用来源路径，例如 `// 对齐 workbench/browser/parts/sidebar/sidebarPart.ts:updateStyles`；
4. 逐条走完 `AGENTS.md` 第 3 条的门控检查表与第 4 条的一致性检查规则（7 个维度 + 触发源穷举）；
5. 若权威缺口需要新增依赖或自造 / 降级实现，先按 `AGENTS.md` §4.2 说明并取得确认，再动手。

## 1. 工作台外壳与部件（workbench parts）

| 功能域                               | VS Code 权威文件                                                                                                                             | 本仓库实现                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 整壳布局 / grid                      | `src/vs/workbench/browser/layout.ts`                                                                                                         | `src/App.vue`                                                        |
| 部件通用 CSS（part、elevation 阴影） | `src/vs/workbench/browser/media/part.css`、`src/vs/workbench/browser/media/style.css`                                                        | 各 `*.vue` 的 `<style scoped>`；阴影见 `src/styles/theme.css`        |
| 标题栏                               | `src/vs/workbench/browser/parts/titlebar/titlebarPart.ts`、`media/titlebarpart.css`                                                          | `src/components/TitleBar.vue`                                        |
| 标题栏命令中心                       | `src/vs/workbench/browser/parts/titlebar/commandCenterControl.ts`、`media/titlebarpart.css`（见 4.9）                                        | `src/workbench/contrib/titlebar/CommandCenter.vue`                   |
| 快速输入 / 快速打开浮层              | `src/vs/platform/quickinput/browser/quickInputController.ts`、`quickInput.ts`、`quickInputList.ts`、`media/quickInput.css`（见 4.10）        | `src/base/quickinput/QuickInputWidget.vue`、`src/platform/quickinput/*` |
| 活动栏                               | `src/vs/workbench/browser/parts/activitybar/activitybarPart.ts`、`media/activitybarpart.css`、`media/activityaction.css`                     | `src/components/ActivityBar.vue`                                     |
| 侧栏                                 | `src/vs/workbench/browser/parts/sidebar/sidebarPart.ts`、`media/sidebarpart.css`                                                             | `src/components/Sidebar.vue`                                         |
| 面板（底部）                         | `src/vs/workbench/browser/parts/panel/panelPart.ts`、`src/vs/workbench/browser/parts/paneCompositePart.ts`、`media/paneCompositePart.css`    | `src/workbench/contrib/panel/PanelPart.vue`                          |
| 状态栏                               | `src/vs/workbench/browser/parts/statusbar/statusbarPart.ts`、`statusbarItem.ts`、`media/statusbarpart.css`                                   | `src/workbench/contrib/statusbar/StatusBarPart.vue`                  |
| 编辑器部件 / 标签栏                  | `src/vs/workbench/browser/parts/editor/editorPart.ts`、`editorGroupView.ts`、`multiEditorTabsControl.ts`、`media/multieditortabscontrol.css`；标签底色另见 `workbench/contrib/modernUI/browser/media/tabs.css` + `workbench/common/theme.ts`（见 4.12） | `src/workbench/contrib/editor/EditorPart.vue`、`EditorTabs.vue`      |
| 视图容器/视图注册表                  | `src/vs/workbench/common/views.ts`（`ViewsRegistry`、`ViewContainerLocation`）                                                               | `src/workbench/viewsRegistry.js`、`viewService.js`                   |
| 粘性滚动（滚动时固定当前作用域）     | `src/vs/editor/contrib/stickyScroll/browser/*`                                                                                               | `src/workbench/contrib/editor/EditorPart.vue`（取值见 4.7）          |
| 布局分隔条（sash，拖拽调宽/高）      | `src/vs/base/browser/ui/sash/sash.ts` + `media/sash.css`；消费方 `splitview.ts`、`grid.ts`                                                   | `src/base/sash/Sash.vue`（**唯一**实现，侧栏与面板共用，取值见 4.5） |
| 视图面板（ViewPane）标题与动作       | `src/vs/workbench/browser/parts/views/viewPane.ts`、`viewPaneContainer.ts`                                                                   | `src/components/Sidebar.vue`、各 `contrib/*/…View.vue`               |
| 贡献点注册机制                       | `src/vs/workbench/common/contributions.ts`                                                                                                   | 各 `src/workbench/contrib/*/*.contribution.js`（模块加载期注册）     |
| 存储服务（作用域 / 目标 / 落盘时序） | `src/vs/platform/storage/common/storage.ts`、`src/vs/workbench/services/storage/browser/storageService.ts`（见 4.13）                        | `src/platform/storage/common/storage.js`、`src/platform/storage/browser/storageService.js` |
| 布局状态（尺寸与显隐的持久化）       | `src/vs/workbench/browser/layout.ts` 的 `LayoutStateKeys` / `LayoutStateModel`（见 4.13）                                                    | `src/workbench/browser/layoutStateModel.js`、`src/workbench/browser/layout.js` |
| 部件尺寸约束（最小/最大/夹取）       | `sidebarPart.ts`、`activitybarPart.ts`、`parts/editor/editor.ts`、`parts/panel/panelPart.ts`（见 4.13）                                      | `src/workbench/browser/partDimensions.js`（拖拽与启动恢复共用）      |
| 配置注册表（schema 与默认值）        | `src/vs/platform/configuration/common/configurationRegistry.ts` + `common/configurations.ts`（见 4.14）                                      | `src/platform/configuration/common/configurationRegistry.js`          |
| 配置模型与分层合并                   | `src/vs/platform/configuration/common/configurationModels.ts`、`common/configuration.ts`（见 4.14）                                          | `src/platform/configuration/common/configuration.js`                 |
| 配置服务（读写 / 落点 / 变更事件）   | `src/vs/workbench/services/configuration/browser/configurationService.ts`（见 4.14）                                                        | `src/workbench/services/configuration/browser/configurationService.js` |
| `config.*` 上下文键派生              | `src/vs/platform/contextkey/browser/contextKeyService.ts` 的 `ConfigAwareContextValuesContainer`（见 4.14）                                  | `src/platform/contextkey/browser/configAwareContextValues.js`、`src/menu/contextKey.js` |
| 编辑器设置项登记（wordWrap/minimap） | `src/vs/editor/common/config/editorOptions.ts`（见 4.14）                                                                                    | `src/monaco/editorConfiguration.js`                                   |

## 2. 动作、菜单与工具栏

| 功能域                                                  | VS Code 权威文件                                                                                                                                                                                                                                                                                                 | 本仓库实现                                                                                                                                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MenuId` 定义                                           | `src/vs/platform/actions/common/actions.ts`（`MenuId`，如 `EditorTitle`/`PanelTitle`/`TitleBar`/`LayoutControlMenu`）                                                                                                                                                                                            | `src/menu/menuId.js`                                                                                                                                                                    |
| `Action2` / `registerAction2` / `MenuRegistry`          | `src/vs/platform/actions/common/actions.ts`                                                                                                                                                                                                                                                                      | `src/menu/actions.js`                                                                                                                                                                   |
| 菜单解析（`IMenu.getActions` 分组）                     | `src/vs/platform/actions/common/menuService.ts`                                                                                                                                                                                                                                                                  | `src/menu/actions.js` 的 `getMenuActions`                                                                                                                                               |
| 菜单项 → 视图项（label/checked/keybinding/子菜单）      | `src/vs/platform/actions/browser/menuEntryActionViewItem.ts`（`MenuEntryActionViewItem`、`SubmenuEntryActionViewItem`、`createActionViewItem`）                                                                                                                                                                  | `src/menu/actions.js` 的 `resolveMenuItem`/`resolveMenuEntries`、`src/base/menu/MenuPanel.vue`                                                                                          |
| 菜单填充策略（primary/secondary 分组、`navigation` 组） | `src/vs/platform/actions/browser/menuEntryActionViewItem.ts` 的 `fillInActionBarActions` / `fillInActions`                                                                                                                                                                                                       | `src/menu/menuToolbar.js` 的 `getToolbarActions`                                                                                                                                        |
| 菜单栏（Menubar）                                       | `src/vs/base/browser/ui/menu/menubar.ts` + `menubar.css`、`src/vs/platform/actions/browser/menubarControl.ts`                                                                                                                                                                                                    | `src/components/MenuBar.vue`                                                                                                                                                            |
| 菜单栏顶级项（`MenubarMainMenu` 的 title/order）        | `src/vs/workbench/browser/parts/titlebar/menubar.contribution.ts`（File 1 / Edit 2 / Selection 3 / View 4 / Go 5 / **Terminal 7** / Help 8 / Preferences 9）                                                                                                                                                     | `src/menu/defaultMenus.js` 的 `addMenubarItem`（文件 1 / 编辑 2 / 选择 3 / 视图 4 / 转到 5 / **终端 7** / 帮助 9，未裁剪 Preferences）                                                  |
| 「终端」菜单（`MenubarTerminalMenu`）内容               | `src/vs/workbench/contrib/terminal/browser/terminalMenus.ts`（组 `1_create`/`3_run`/`5_manage`/`7_configure`）+ `contrib/tasks/browser/task.contribution.ts`                                                                                                                                                     | `src/workbench/contrib/panel/panel.contribution.js`（本仓库为面板控制入口，见第 5 节偏差）                                                                                              |
| 视图容器「打开/切换」命令的生成与**勾选态**             | `src/vs/workbench/services/views/browser/viewsService.ts` 的 `registerOpenViewContainerAction`（`openCommandActionDescriptor` 类型见 `src/vs/workbench/common/views.ts:53-59`，**只有 id/title/mnemonicTitle/order/keybindings，没有 toggled**；生成的 Action2 描述符 `viewsService.ts:407-425` 同样无 toggled） | `src/workbench/contrib/panel/panel.contribution.js`（`切换终端` **不声明 toggled**）、`src/workbench/contrib/explorer/explorer.contribution.js` 等容器项（自造了勾选态，见第 5 节偏差） |
| 菜单 widget（下拉/上下文菜单本体）                      | `src/vs/base/browser/ui/menu/menu.ts`（DOM + `getMenuWidgetCSS` 生成全部样式）                                                                                                                                                                                                                                   | `src/base/menu/MenuPanel.vue`（**唯一**菜单渲染实现）                                                                                                                                   |
| 菜单默认样式（选中/边框色来源）                         | `src/vs/platform/theme/browser/defaultStyles.ts` 的 `defaultMenuStyles`                                                                                                                                                                                                                                          | `src/base/menu/MenuPanel.vue` 注释与取值                                                                                                                                                |
| 上下文菜单宿主与定位                                    | `src/vs/platform/contextview/browser/contextMenuHandler.ts`、`contextViewService.ts`、`src/vs/base/browser/ui/contextview/contextview.ts`、`src/vs/base/common/layout.ts`（`layout2d`）                                                                                                                          | `src/base/menu/MenuPanel.vue` 的锚点/子菜单定位、`src/base/toolbar/Toolbar.vue`（溢出锚点）                                                                                             |
| 工具栏（含「…」溢出）                                   | `src/vs/base/browser/ui/toolbar/toolbar.ts`（`ToolBar`、`ToggleMenuAction`）、`src/vs/base/browser/ui/dropdown/dropdown.ts`（`DropdownMenu.show`）、`dropdownActionViewItem.ts`（`DropdownMenuActionViewItem`）                                                                                                  | `src/base/toolbar/Toolbar.vue`                                                                                                                                                          |
| 工具栏动作视图                                          | `src/vs/base/browser/ui/actionbar/actionViewItems.ts`（`ActionViewItem`）、`src/vs/base/browser/ui/dropdown/dropdownActionViewItem.ts`（`DropdownMenuActionViewItem`）                                                                                                                                           | `src/base/toolbar/ActionView.vue`                                                                                                                                                       |
| workbench 工具栏（MenuId → Toolbar）                    | `src/vs/platform/actions/browser/toolbar.ts`                                                                                                                                                                                                                                                                     | `src/components/MenuToolbar.vue`                                                                                                                                                        |
| MenuId → 下拉菜单宿主                                   | `src/vs/platform/actions/browser/menubarControl.ts` 等                                                                                                                                                                                                                                                           | `src/components/MenuDropdown.vue`                                                                                                                                                       |
| 快捷键服务                                              | `src/vs/platform/keybinding/common/keybindingRegistry.ts`、`keybindingResolver.ts`                                                                                                                                                                                                                               | `src/menu/keybindingService.js`                                                                                                                                                         |
| 命令面板落点（`MenuId.CommandPalette`）                 | `src/vs/platform/actions/common/actions.ts:754-755`（`registerAction2` 在 `f1` 为真时自动追加菜单项，`when` 取 `precondition`）                                                                                                                                                                                  | `src/menu/actions.js` 的 `registerAction2`（自动挂载，见 4.10）                                                                                                                          |
| 快速打开（quick access）提供者与前缀路由                | `src/vs/workbench/browser/quickaccess.ts`、`src/vs/platform/quickinput/common/quickAccess.ts`、`contrib/search/browser/anythingQuickAccess.ts`、`platform/quickinput/browser/commandsQuickAccess.ts`                                                                                                             | `src/platform/quickinput/quickAccess.js`、`src/workbench/browser/quickaccess/anythingQuickAccess.js`、`src/workbench/contrib/quickaccess/browser/commandsQuickAccess.js`                  |
| 快速输入命令与键位                                      | `src/vs/workbench/browser/actions/quickAccessActions.ts`、`src/vs/platform/quickinput/browser/quickInputActions.ts`                                                                                                                                                                                              | `src/menu/quickInput.contribution.js`                                                                                                                                                   |
| 语言显示名（状态栏「编辑器语言」条目）                   | `src/vs/editor/common/services/languageService.ts:64-66` 的 `getLanguageName` → `languagesRegistry.js` 的 `bestName = aliases[0] || id`（扩展在 `package.json` 的 `contributes.languages[].aliases` 声明显示名，如 `Plain Text` / `JSON` / `Squirrel`）                                                             | `src/monaco/languageNames.js` 的 `getLanguageName`；Squirrel 的 `aliases: ["Squirrel"]` 由内置扩展清单 `src/extensions/pvf/package.json` 的 `contributes.languages[].aliases` 声明                                                                                |

## 3. 主题与设计 token

| 内容                                                                                                            | VS Code 权威文件                                                                                                        | 本仓库实现                               |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 默认深色主题取值（Dark 2026）                                                                                   | `extensions/theme-defaults/themes/2026-dark.json`（include 链：`dark_modern.json` → `dark_plus.json` → `dark_vs.json`） | `src/styles/theme.css` 顶部注释 + 各变量 |
| 编辑器语法着色（tokenColors → monaco `rules`）                                                                  | 同一条 include 链的 `tokenColors`（组装语义见 `src/vs/workbench/services/themes/common/colorThemeData.ts:103-152`、`:782-787`） | `src/monaco/themeTokens.js`（由 `scripts/check-syntax-colors.mjs --write` 生成）+ `src/monaco/theme.js` 的 `PVF_DARK_THEME`（见 4.15） |
| 工作台颜色 token（`panel.*`、`statusBar.*`、`sideBar.*`、`activityBar.*`、`titleBar.*`、`editorGroupHeader.*`） | `src/vs/workbench/common/theme.ts`                                                                                      | `src/styles/theme.css`                   |
| 菜单颜色 token（`menu.*`）                                                                                      | `src/vs/platform/theme/common/colors/menuColors.ts`                                                                     | `src/styles/theme.css`                   |
| 列表/树颜色 token                                                                                               | `src/vs/platform/theme/common/colors/listColors.ts`                                                                     | `src/styles/theme.css`                   |
| 编辑器 widget / toolbar / actionBar token                                                                       | `src/vs/platform/theme/common/colors/editorColors.ts`                                                                   | `src/styles/theme.css`                   |
| 基础色（`foreground`/`focusBorder`/`contrastBorder`/`widget.border`）                                           | `src/vs/platform/theme/common/colors/baseColors.ts`                                                                     | `src/styles/theme.css`                   |
| 尺寸 token（`cornerRadius.*`、`strokeThickness`、spacing ramp）                                                 | `src/vs/platform/theme/common/sizes/baseSizes.ts`                                                                       | `src/styles/theme.css`                   |
| 立面阴影（`--vscode-shadow-sm/md/lg/xl`）                                                                       | `src/vs/workbench/browser/media/style.css`                                                                              | `src/styles/theme.css`                   |

**高对比度专用 token 故意不定义**：`--vscode-contrastActiveBorder`、`--vscode-list-focusAndSelectionOutline`、
`--vscode-list-activeSelectionIconForeground`、`--vscode-list-inactiveSelectionIconForeground`、
`--vscode-editor-rangeHighlightBorder` 这几个颜色的 `registerColor` 默认值在 **dark 下为 `null`**
（`baseColors.ts:45`、`listColors.ts:29/41/53`、`editorColorRegistry.ts:18`），主题服务因此不注入这些变量；
权威照样输出引用它们的 CSS 规则（`defaultStyles.ts:184-185` 的 `asCssVariable` 产出 `var(...)` 字符串、
`listWidget.ts:977-1007` 照样拼出规则），靠变量缺失让整条声明按无效值丢弃 —— 深色主题下这些描边本就不存在。
本仓库照此办理：组件照常写 `var(--vscode-…)`，`theme.css` **不定义**它们，`scripts/check-theme-tokens.mjs`
的 `nullByDesign` 列表同时禁止「补齐」（补了会凭空长出高对比度描边，反而偏离权威）。

## 4. 关键取值速查（已核对源码）

### 4.1 部件分隔线（默认 modern-ui = false 时的行为）

`modern-ui` 默认 `false`（`src/vs/workbench/browser/workbench.contribution.ts` 的 `[LayoutSettings.MODERN_UI].default = false`），
因此以下 1px 分隔线全部生效；`titleBar`/`activityBar` 的阴影同样生效。

| 部件   | 规则                                                                                                                                 | 来源                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 标题栏 | `border-bottom: 1px solid titleBar.border`；另有 `box-shadow: var(--vscode-shadow-md)`                                               | `titlebarPart.ts:updateStyles`（`titleBorder`）、`media/titlebarpart.css:10`          |
| 活动栏 | 左侧布局时 `border-right: 1px solid activityBar.border`（`.bordered::before`）；侧栏隐藏时额外 `box-shadow: var(--vscode-shadow-md)` | `activitybarPart.ts:updateStyles`（`bordered` 类）、`media/activitybarpart.css:11-33` |
| 侧栏   | 左侧布局时 `border-right: 1px solid sideBar.border`                                                                                  | `sidebarPart.ts:updateStyles`                                                         |
| 状态栏 | `statusBar.border` 填充顶部 1px（`.status-border-top::after`，聚焦时让位给焦点描边）                                                 | `statusbarPart.ts:updateStyles`、`media/statusbarpart.css:31`                         |
| 面板   | `border-top: 1px solid panel.border`                                                                                                 | `panelPart.ts` / `media/paneCompositePart.css`                                        |
| 标签栏 | `editorGroupHeader.tabsBorder` 生成底部 1px（`.tabs-border-bottom::after`）                                                          | `multiEditorTabsControl.ts:redraw`、`media/multieditortabscontrol.css:53`             |

Dark 2026 取值：`activityBar.border` / `sideBar.border` / `titleBar.border` / `statusBar.border` / `panel.border` / `editorGroupHeader.tabsBorder` 均为 `#2A2B2C`（`extensions/theme-defaults/themes/2026-dark.json`）。

### 4.2 菜单 widget（下拉、上下文菜单、工具栏「…」溢出面板共用）

来源：`src/vs/base/browser/ui/menu/menu.ts` 的 `getMenuWidgetCSS` + `MenuItemActionViewItem.render`。

```
容器  .monaco-menu
      font-size: 13px; min-width: 160px;
      border-radius: var(--vscode-cornerRadius-large);   /* 8px，baseSizes.ts cornerRadius.large */
      border: var(--vscode-strokeThickness) solid menu.border;
      背景 menu.background / 前景 menu.foreground（defaultStyles.ts:defaultMenuStyles 以内联样式施加）
      box-shadow: var(--vscode-shadow-lg)（.context-view.monaco-menu-container）

列表  .monaco-action-bar.vertical { padding: 4px 0 }
条目  li.action-item > a.action-menu-item
      display: flex; align-items: center; height: 24px;
      margin: 0 4px; border-radius: var(--vscode-cornerRadius-medium);   /* 6px */
      > span.menu-item-check   （勾选列，width: 2em，未勾选 visibility: hidden；字形 = codicon menu-selection / check）
      > span.action-label      （padding: 0 2em，font-size: inherit）
      > span.keybinding        （text-align: right，opacity: .7，padding: 0 2em）
      > span.submenu-indicator （codicon menu-submenu / chevron-right，font-size: 60%）
分隔线  .action-label.separator { height: 0; border-bottom: 1px solid menu.separatorBackground; margin: 5px 0 }
容器焦点 .context-view.monaco-menu-container { outline: 0; border: none }（menu.ts:1251-1258），
        且容器内一切 :focus（含 .monaco-action-bar.vertical）{ outline: 0 }（menu.ts:1262-1266）：
        容器是 `tabindex="-1"` 的聚焦落点（Menu 渲染后立即 menu.focus()），不抑制就会画出
        浏览器默认焦点环（白 + 蓝双色 outline）
选中态  背景 = list.hoverBackground，前景 = list.hoverForeground（defaultStyles.ts 的
        selectionBackgroundColor/selectionForegroundColor 取 list.hover*，**不是** menu.selection*）
键盘焦点 额外 1px 描边 menu.selectionBorder（`applyStyle` + `.action-menu-item:focus:not(:focus-visible)` 抑制指针态）
禁用   color: var(--vscode-disabledForeground)；keybinding/submenu-indicator opacity: .4
```

> **同名样式冲突提示（已核实）**：`monaco-editor@0.56.0` 的
> `esm/vs/base/browser/ui/menu/menu.js` 内联了同一份 menu.css，但**只在实例化 monaco 自己的
> `Menu` widget 时才注入**（`createStyleSheet()` 调用点在 menu.js:202-206 的 `Menu` 构造函数内；
> 编辑器里要等首次弹出右键菜单才会走到）。本仓库菜单是自研 `MenuPanel.vue`、不实例化该 widget，
> 因此**不能假设这份注入表存在** —— 菜单的全部规则（含上面这条容器 `outline: 0`）必须由本仓库写全。
> 若注入表已存在，本仓库刻意复用的 `.monaco-menu`、`.monaco-action-bar.vertical`、`.action-item`、
> `.menu-item-check` 等类名会一并命中它，且 `.monaco-menu .monaco-action-bar.vertical .menu-item-check`
> 这类选择器（0,3,0～0,4,0）比 scoped 的 `.menu-item-check[data-v-*]`（0,2,0）更具体 ——
> 排查菜单勾选/高亮/描边异常时两份表都要看。

两条容易搞错的语义（均已核对源码）：

- **普通菜单项没有条目图标**。`menu.ts:Menu.doGetActionViewItem` 只在 `action instanceof Separator`
  时传 `icon: true`，普通项 `icon: false`，因此 `a.action-label` 上不会加 codicon 类；
  一个菜单项只由「勾选列 + 文字 + 快捷键 + 子菜单箭头」构成（菜单区不带图标的工具栏按钮如
  「切换自动换行」在菜单里也只是文字）。
- **只有声明了 `toggled` 的动作才有勾选态**。此时 `Action.checked` 为 `undefined`，
  菜单项是普通 `role="menuitem"`；声明了 `toggled` 的才是 `role="menuitemcheckbox"`，
  且勾选列的宽度（2em）始终保留，仅靠可见性切换。
- **`toggled` 属于「命令描述符」而不是「菜单项」**，所以同一命令的每个落点都必须由动作自己的
  `menu` 数组产生。`registerAction2` 把动作描述符解构为 `{ f1, menu, keybinding, ...command }`
  再展开进每个落点（`platform/actions/common/actions.ts:741-751`：
  `MenuRegistry.appendMenuItem(item.id, { command: { ...command, precondition }, ...item })`），
  勾选态也从命令描述符求值（`menuService.ts:236-242` 读 `item.command.toggled`；
  `actions.ts:617-637` 的 `MenuItemAction.checked`）。手写描述符的
  `MenuRegistry.appendMenuItem` 不带这份元数据（本仓库 `src/menu/actions.js:18` 的 `appendMenuItem` 即该形态，
  调用方自己写 `command: { id, title, icon }`），该落点就会丢掉勾选态。已实测的现场：「切换缩略图」
  在编辑器标签栏「…」溢出菜单里恒不勾选，而「视图」菜单里勾选态正常 —— 根因就是那处落点用裸
  `appendMenuItem` 重写了描述符，现改为写在各自动作的 `menu` 数组（`defaultMenus.js:261`、`:278`）。
- **打开菜单不自动选中首项**：`contextMenuHandler.ts:128` 用 `menu.focus(!!delegate.autoSelectFirstItem)`，
  工具栏溢出的下拉没有传 `autoSelectFirstItem`，故首项高亮要等指针 hover 或方向键。

验证：`npm run check:menu-toggle`（勾选态每次解析都重新对上下文求值而不缓存 —— 上下文键翻转后
重新解析即得新勾选态、执行命令后勾选态翻转、未声明 `toggled` 的动作 `checked` 为 `undefined`、
子菜单重新解析取到新值、同一命令两个落点的勾选态一致，外加两条静态不变量「没有裸菜单项引用
声明了 `toggled` 的命令」与「标签栏溢出菜单的这两项由动作自身声明落点」，扫描 `src/**/*.js`
并列出违规的 `命令 id（文件）`）。
菜单浮层的 `outline: 0` 抑制规则见上方代码块的「容器焦点」条目。

### 4.3 菜单/上下文浮层定位

| 场景         | 规则                                                                                                                                             | 来源                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 浮层相对锚点 | 默认 `anchorAlignment = LEFT`、`anchorPosition = BELOW`：**左边缘对齐锚点左边缘、顶边贴锚点底边（无间隙）**；空间不足时翻转（右对齐 / 移到上方） | `src/vs/base/common/layout.ts:layout2d` + `contextview.ts:doLayout`             |
| 子菜单       | 贴在条目右边缘（`entry.right`，因条目 `margin: 0 4px` 实际比父菜单右边界内缩 4px），顶边与条目对齐；右侧放不下翻到左侧；超出视口再垂直收敛       | `menu.ts:calculateSubmenuMenuLayout`、`SubmenuMenuActionViewItem.createSubmenu` |
| 关闭时机     | 点击浮层外、窗口 blur、Escape（`onDidCancel`）、执行动作后；关闭后焦点回到打开前的元素                                                           | `contextMenuHandler.ts`、`menu.ts`                                              |
| 键盘导航     | Up/Down（跳过 disabled 与分隔线）、Home/End、Right/Enter 进子菜单、Left 退回、Enter/Space 执行                                                   | `menu.ts`、`actionbar.ts:updateFocus`                                           |

### 4.4 工具栏溢出（「…」）

溢出链路：`ToolBar` 把放不下的动作与 secondary 动作交给 `ToggleMenuAction`（`toolbar.toggle.more`），
该动作由 `DropdownMenuActionViewItem` 渲染成按钮，点击后 `DropdownMenu.show()` 调
`showContextMenu`，最终仍由**同一个菜单 widget**（`Menu`）渲染 —— 所以工具栏溢出菜单与
菜单栏下拉、右键菜单的 DOM/取值完全一致，不允许自绘一套条目列表。

| 项       | 规则                                                                                                                                                                                                               | 来源                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 触发     | 存在 secondary 动作，或主区动作放不下时，末尾插入 `ToggleMenuAction`（id `toolbar.toggle.more`，label「More Actions...」，图标 `toolBarMore` = `ellipsis`）                                                        | `toolbar.ts:setActions`、`toolbar.ts:730`                                              |
| 按钮     | 带 `role="button"` / `aria-haspopup="true"` / `aria-expanded`；菜单显示期间只给 `.monaco-dropdown` 加 `active` 类，而 `dropdown.css` 没有对应样式，**按钮不会出现选中背景**（`ToggleMenuAction` 未声明 `checked`） | `dropdownActionViewItem.ts:setAriaLabelAttributes`、`dropdown.ts:show`、`dropdown.css` |
| 开关     | 在 label 的 **MOUSE_DOWN** 上切换（不是 click）：显示中则 hide，否则 show                                                                                                                                          | `dropdown.ts` 构造函数的 MOUSE_DOWN / Tap 分支                                         |
| 锚点     | 锚到按钮元素本身（`getAnchor` 未提供，默认取 `.monaco-dropdown`），`anchorAlignment = LEFT`、`anchorPosition = BELOW`                                                                                              | `dropdown.ts:show`、`contextMenuHandler.ts:56`                                         |
| 面板     | **复用菜单 widget**（`DropdownMenuActionViewItem` + `isMenu: true` → `Menu`），不是自绘按钮列表                                                                                                                    | `toolbar.ts`、`contextMenuHandler.ts`                                                  |
| 条目内容 | 勾选列 + 纯文字 + 快捷键（右对齐）+ 子菜单箭头（无条目图标，见 4.2）；分隔线来自菜单分组                                                                                                                           | `menu.ts`、`menuEntryActionViewItem.ts:fillInActionBarActions`                         |
| 溢出判定 | 按容器实测宽度响应式收缩（`ResizeObserver`），不是固定条数上限                                                                                                                                                     | `toolbar.ts` 的 `responsiveBehavior` 分支                                              |

### 4.5 布局分隔条（sash）

侧栏右边界与面板顶部的拖拽条是**同一个组件** `src/base/sash/Sash.vue`（对齐
`src/vs/base/browser/ui/sash/sash.ts` + `media/sash.css`）。位置由宿主给（上游是
grid/splitview 通过 layoutProvider 算绝对坐标，`sash.ts:664-674`），组件只管尺寸、状态与交互。

```
DOM    .monaco-sash + .vertical/.horizontal + 状态类
       hover / active / disabled / minimum / maximum（sash.ts:289-291、446-447、497-503、549、600）
尺寸   width/height = --vscode-sash-size（4px），:root 见 sash.css:6-9
高亮   :before 铺满，宽/高 = --vscode-sash-hover-size（4px），居中于分隔条（sash.css:105-131）；
       .hover / .active 时 background = --vscode-sash-hoverBorder（= focusBorder，miscColors.ts）
光标   竖向 ew-resize（mac col-resize）、横向 ns-resize（mac row-resize）；
       到 minimum 换 e-resize / s-resize，到 maximum 换 w-resize / n-resize（sash.ts:559-574 + sash.css:21-43）
hover  进入后延迟 300ms 才加 .hover；拖拽中取消延迟立即加（sash.ts:154 globalHoverDelay、629-640）
拖拽   按下加 .active，并用动态样式表把光标锁到全局 `* { cursor: X !important }`，
       结束时移除（sash.ts:549-577、595-608）；上游用 pointer capture，本仓库挂 window 等价
双击   .reset：grid 对相邻 view 调 resizeToPreferredSize（grid.ts:714-744）
```

| 部件     | 约束                                                                 | 来源                                                                                                                                                                                                                                          |
| -------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 侧栏宽度 | 最小 170；上界 = 容器宽 − 活动栏 48 − 编辑器最小宽 220；双击复位 300 | `sidebarPart.ts:48`（`minimumWidth = 170`）、`activitybarPart.ts:50`（`ACTIVITYBAR_WIDTH = 48`）、`editor.ts:29`（`DEFAULT_EDITOR_MIN_DIMENSIONS = Dimension(220, 70)`）、`sidebarPart.ts:56-69`（`preferredWidth = max(optimalWidth, 300)`） |
| 面板高度 | 最小 77，最大 = 视口高 − 64                                          | `panelPart.ts` 的 `minimumHeight`；上界为本仓库近似（对齐 grid 撑满容器的效果）                                                                                                                                                               |

### 4.6 菜单 / 菜单栏主题 token（注册默认值 + 2026-dark）

来源：`platform/theme/common/colors/menuColors.ts`（`menu.*`）、`listColors.ts`（`list.hover*`，菜单选中态的真正来源）、`workbench/common/theme.ts`（`menubar.*`）、`baseColors.ts`（`disabledForeground`）；主题取值 `extensions/theme-defaults/themes/2026-dark.json`（VS Code 当前默认深色主题的覆盖层）。
消费方：`platform/theme/browser/defaultStyles.ts:242-255` 的 `defaultMenuStyles`（菜单 widget 以内联样式施加）与 `workbench/browser/parts/titlebar/media/menubarControl.css:26,46`。

本仓库不为这些 token 派生新值：`src/styles/theme.css` 直接写 2026-dark 的取值（下表第三列即该文件里的值），菜单部件只引用 `--vscode-*` 变量。

**为什么 theme.css 必须「定义齐全」**：monaco 的主题注入被限定在 `.monaco-editor, .monaco-diff-editor,
.monaco-component`（发行包 `standaloneThemeService.js:_updateThemeOrColorMap` 生成的就是带这三个选择器的规则），
所以标题栏、命令中心、快速输入、菜单这些**工作台部件**拿不到 monaco 注入的 token，只能由 `theme.css` 提供。
而 `var(--vscode-x)` 在 `x` 未定义时**整条声明按无效丢弃**（`var()` 只有给了回退值才有兜底），
表现就是「背景变透明、当前项没有高亮底色、圆角与阴影消失」这类**静默**错乱 —— 不会报错，只是长得不对。
因此新增任何 `var(--vscode-*)` 之前，先把 token 写进 `theme.css`；
`npm run check:theme`（`scripts/check-theme-tokens.mjs`）扫描 `src/**` 的全部引用并与该文件的定义比对，
少一个即失败。

| token                       | 权威注册默认值（file:line）                                                                 | 2026-dark（= 本仓库 theme.css）               |
| --------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------- |
| menu.background             | `dropdown.background`（`inputColors.ts:94`，dark `#3C3C3C`）                                | `#202122`（:166）                             |
| menu.foreground             | `dropdown.foreground`（`inputColors.ts:102`，dark `#F0F0F0`）                               | `#bfbfbf`（:167）                             |
| menu.border                 | dark/light 为 `null`，hc = `contrastBorder`（`menuColors.ts:17`）                           | `#2a2b2c`（:168）                             |
| menu.separatorBackground    | `transparent(foreground, 0.2)`（`menuColors.ts:41`）                                        | `#2a2b2c`（:169）                             |
| menu.selectionBackground    | `list.activeSelectionBackground`（`menuColors.ts:33` → `listColors.ts:33`，dark `#04395E`） | `#3994bc26`（:170），选中态实际不取它，见 4.2 |
| menu.selectionForeground    | `list.activeSelectionForeground`（`menuColors.ts:29` → `listColors.ts:37`，dark `#FFFFFF`） | `#bfbfbf`（:171）                             |
| menu.selectionBorder        | dark/light 为 `null`，hc = `activeContrastBorder`（`menuColors.ts:37`）                     | `#3994bc`（:173）                             |
| menubar.selectionBackground | `toolbar.hoverBackground`（`workbench/common/theme.ts:806-812`）                            | `#242526`（:97）                              |
| menubar.selectionForeground | `titleBar.activeForeground`（`theme.ts:804`）                                               | `#bfbfbf`（:96）                              |
| list.hoverBackground        | dark `#2A2D2E`（`listColors.ts:65`）                                                        | `#ffffff14`（:56）                            |
| list.hoverForeground        | `null`（`listColors.ts:69`，回退 `list.foreground`）                                        | `#bfbfbf`（:57）                              |
| disabledForeground          | dark `#CCCCCC80`（`baseColors.ts:21-23`）                                                   | `#555555`（:21）                              |

键位与渲染细节见 4.2；菜单选中态取 `list.hover*`（`defaultStyles.ts:247-248`），**不是** `menu.selection*`。

### 4.7 粘性滚动（滚动时固定「当前作用域」）

来源与落点：权威 `src/vs/editor/contrib/stickyScroll/browser/` 的 `stickyScrollController.ts`（控制器与渲染时机，`_readConfiguration` :453）、`stickyScrollProvider.ts`（候选行遍历）、`stickyScrollModelProvider.ts`（取数层）、`stickyScrollWidget.ts`（部件）、`stickyScrollActions.ts`（命令/菜单）、`stickyScroll.css`。
本仓库不改写该部件：它由 npm `monaco-editor@0.56.0` 的 contribution 全量带入（`esm/vs/editor/contrib/stickyScroll/browser/*`），本仓库只负责「注册符号提供者 + 钉住取值」两件事（落点 `src/workbench/contrib/editor/EditorPart.vue:32-39`）。

| 项               | 取值                                                                                                                                                                                                                                     | 权威                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| enabled          | true                                                                                                                                                                                                                                     | `editor/common/config/editorOptions.ts:3190`                  |
| maxLineCount     | 5                                                                                                                                                                                                                                        | 同上                                                          |
| defaultModel     | `outlineModel`                                                                                                                                                                                                                           | 同上                                                          |
| scrollWithEditor | true（**只**影响水平滚动时部件的偏移，不决定显隐；说明见 `editorOptions.ts:3212-3215`）                                                                                                                                                  | 同上                                                          |
| 行数上限         | `min(_maxStickyLines, maxLineCount)`；`_maxStickyLines = round(可视行数 × 0.25)`                                                                                                                                                         | `stickyScrollController.ts:615`、`:540-545`（`_onDidResize`） |
| 候选行判据       | `endLineNumber > startLineNumber + 1 && range.startLineNumber <= endLineNumber + 1 && startLineNumber - 1 <= range.endLineNumber && startLineNumber !== lastLine && textModel.isValidRange(Range(startLineNumber, 1, endLineNumber, 1))` | `stickyScrollProvider.ts:205-219`                             |
| 显示判据         | `topOfElement > topOfBeginningLine && topOfElement <= bottomOfEndLine`（作用域首行已滚出视口顶、末行仍在视口内）                                                                                                                         | `stickyScrollController.ts:631`                               |
| 取数层回退       | `case` 依次 push（fall through）：outlineModel → foldingProviderModel → indentationModel；`update()` 返回第一个 VALID（`isModelValid` = `children.size > 0`）                                                                            | `stickyScrollModelProvider.ts:61-68`、`:88-110`、`:44`        |

触发源穷举（AGENTS.md §4.4，权威 `grep -n "onDid[A-Z]" src/vs/editor/contrib/stickyScroll/browser/*.ts`）：

| 权威触发源                                                                        | 结论                                                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `stickyScrollController.ts:464` `onDidScrollChange`（`scrollTopChanged`）→ 重渲染 | 已迁移（monaco 发行包内 contribution，本仓库未改动）                |
| `:470` `onDidLayoutChange` → `_onDidResize()`（重算 `_maxStickyLines`）           | 已迁移（同上）                                                      |
| `:471` `onDidChangeModelTokens` → `_onTokensChange()`                             | 已迁移（同上）                                                      |
| `:472` 候选提供者 `onDidChangeStickyScroll`                                       | 已迁移（同上）                                                      |
| `:482` `onDidChangeCursorPosition`（仅 `lineNumbers` 为 relative 时）             | 已迁移（同上）                                                      |
| `:101` `onDidChangeLineHeight`、`:109` `onDidChangeFont`                          | 已迁移（同上）                                                      |
| `stickyScrollProvider.ts:97` `onDidChangeModel` → `update()`                      | 已迁移（同上）                                                      |
| `:103` `onDidChangeHiddenAreas` → `update()`                                      | 已迁移（同上）                                                      |
| `:104` `onDidChangeModelContent`（`RunOnceScheduler` 50ms，见 `:78`）             | 已迁移（同上）                                                      |
| `:105` `documentSymbolProvider.onDidChange` → `update()`                          | 已迁移；提供者由本仓库内置扩展 `src/extensions/pvf/browser/pvfExtension.js` 的 `activate()` 注册          |
| `:80` `onDidChangeConfiguration` → `readConfiguration()`                          | 已迁移（同上）                                                      |
| `stickyScrollModelProvider.ts:396` `foldingRangeProvider.onDidChange`             | 不适用：默认 `outlineModel` 层先命中即返回（`:88-110`），该层不执行 |
| `stickyScrollModelProvider.ts:49` `Delayer(300)`（合并连续更新）                  | 已迁移（同上）                                                      |

「这个部件的什么变化会让它更新？」→ 编辑器垂直滚动（`scrollTopChanged`）、布局变化、token 变化、模型/语言/内容变化、`documentSymbolProvider` 变化。
本仓库需要保证的只有两点：① 注册 `DocumentSymbolProvider`（`src/extensions/pvf/browser/pvfExtension.js` 的 `activate()`）；② `stickyScroll` 取值与权威默认一致（`src/workbench/contrib/editor/EditorPart.vue:32-39`）。

上下文键：`EditorContextKeys.stickyScrollVisible`（`stickyScrollController.ts:124` 绑定，`_updateState()` 按 `startLineNumbers.length > 0` 置位）；本仓库未使用该键。

验证：`npm run build`（产物含 stickyScroll contribution）；`npm run check:outline`（outline 层顶层元素 17 → `isModelValid` 为真；各函数跨行数满足候选行判据 `endLineNumber > startLineNumber + 1`）。
未迁移：命令与菜单落点（见 §5）。

### 4.8 面包屑的触发源（滚动不更新面包屑 —— 与权威一致）

来源与落点：权威 `workbench/contrib/codeEditor/browser/outline/documentSymbolsOutline.ts`（取数源
`DocumentSymbolBreadcrumbsSource`）、`workbench/browser/parts/editor/breadcrumbsControl.ts`（部件与命令）、
`workbench/browser/parts/editor/breadcrumbsModel.ts`（条目组装）。
本仓库：`src/workbench/contrib/editor/EditorBreadcrumbs.vue`（触发源与渲染）、
`src/workbench/contrib/editor/breadcrumbs.js`（条目组装与命令）、
`src/monaco/documentSymbols.js`（outline → 符号链）、`src/monaco/outlinePath.js`（`collectPath` 纯函数）。

触发源穷举（AGENTS.md §4.4，权威 `grep -n "onDid[A-Z]" src/vs/workbench/contrib/codeEditor/browser/outline/documentSymbolsOutline.ts`）：

| 权威触发源                                         | 结论                                                                                                                                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `:192` `onDidChangeModel` → `_createOutline()`     | 已迁移：`EditorBreadcrumbs.vue` 的 `watch(() => editorGroup.activeId, …, { immediate: true })`（打开 / 切换编辑器立即取一次）                                                  |
| `:193` `onDidChangeModelLanguage` → `_createOutline()` | 已迁移：`watch(() => getActiveEditorInput()?.languageId, () => refreshSymbols())`（语言由 `editorGroupService.js` 的 `model.onDidChangeLanguage` 写回条目，立即刷新、不防抖） |
| `:198-204` `onDidChangeModelContent` → `TimeoutTimer`（防抖值 = `_outlineModelService.getDebounceValue(model)`） | 已迁移：`editorGroupService.js` 在 `model.onDidChangeContent` 里递增 `entry.contentVersion`，组件按 `contentVersion` 防抖 350ms 重取。防抖值取该 provider 的下限 350ms（见第 5 节） |
| `:191` `documentSymbolProvider.onDidChange`        | 不适用：本仓库的 `.nut` 提供者在启动时一次性注册（`src/extensions/pvf/browser/pvfExtension.js` 的 `activate()`），不存在运行时插拔                                    |
| `:364-371` `onDidChangeCursorPosition` → `TimeoutTimer` 150ms → `_breadcrumbsDataSource.update(model, position)` | 已迁移：`watch` 光标行列，150ms 防抖后 `refreshSymbols()`                                                                                     |
| `:324-327` `onDidChangeMarker` → `_applyMarkersToOutline()` | 不适用：本仓库没有 problems/marker 服务（符号不叠加诊断标记），`OutlineConfigKeys.problemsEnabled` 亦未实现                             |
| `:330-362` `onDidChangeConfiguration`（`outline.*` / `breadcrumbs.icons`） | 不适用：本仓库没有 `outline.*` 与 `breadcrumbs.icons` 设置项（图标恒按 codicon 输出）                                                  |
| 无滚动订阅（决定性证据见下方「取数源只有一条输入通道」） | 权威的面包屑跟随光标；「向下滚动时看到当前作用域」由粘性滚动（§4.7）承担      |

**取数源只有一条输入通道（滚动不可能改变符号段）**：`_breadcrumbsDataSource.update(model, position)` 在权威仓库里
只有 3 个调用点，**全部传光标位置** —— `documentSymbolsOutline.ts:406`（`_setOutlineModel`，position 取自 `:398`
的 `this._editor.getPosition()`）、`:348`（`breadcrumbs.*` 配置变化）、`:367`（`onDidChangeCursorPosition` 经 150ms 防抖）；
而 `DocumentSymbolBreadcrumbsSource.getBreadcrumbElements()`（`:48-50`）只返回缓存的 `_breadcrumbs`，
**没有第四条路能改它**。佐证：`grep -rn "onDidScrollChange\|onDidChangeScrollTop\|getVisibleRanges"` 在
`workbench/browser/parts/editor/breadcrumbs*.ts` 与 `documentSymbolsOutline.ts` 里零匹配；
`breadcrumbs.ts:126-195` 的配置清单（`showFiles` / `showModules` / `showNamespaces` 等）也没有滚动相关项。

「这个部件的什么变化会让它更新？」→ 切换/打开编辑器（`:192`）、语言变化（`:193`）、模型内容变化（`:198-204`，350ms）、
光标位置变化（`:364-371`，150ms）—— 四者都在 `EditorBreadcrumbs.vue` 里落到具体 `watch`。
取数侧的前提是 `OutlineModelService.getOrCreate` 按 `textModel.getVersionId()` 校验缓存
（`node_modules/monaco-editor/esm/vs/editor/contrib/documentSymbols/browser/outlineModel.js:218`），
版本变化即重建 outline；`npm run check:outline` 第 4 项专门验证这一点（内容变化后符号链必须跟着变）。

启动态（曾被误判为「点击后才显示符号段」）：符号段取的是**光标所在符号**，不是「文件里的第一个符号」。
默认预览文件 `samples/common.nut` 的光标在 1 行（顶层语句，不属于任何符号），所以启动时只有文件名段；
把光标移入函数体（如 8-17 行的 `requestBuy`）即出现该段 —— 与 VS Code 一致。
`check:outline` 相应断言 8 / 10 行取到 `requestBuy`、1 行取空。

结论：**滚动不更新面包屑是权威行为，不是偏差**；不做「面包屑随滚动更新」的改动（AGENTS.md §4.4 规则 5：禁止反向迁就需求）。
「面包屑**最后一级**跟随滚动 / 视口」这一诉求在权威里没有对应物（AGENTS.md §3：权威没有的行为不得自造），
不要再按缺陷返工 —— 判定方法：在 VS Code 里打开同一文件，光标置于第 8 行 `requestBuy` 内后用滚轮滚到文件末尾，
面包屑会停在 `samples > common.nut > requestBuy` 不变，不会切到视口位置所在的函数。
验证：`npm run check:outline`（符号取数链路 + 内容变化失效 + 四个触发源的静态断言）。

**文件段规则（本仓库无工作区 → 完整路径到文件系统根）**

权威 `breadcrumbsModel.ts:130-177` 的 `_initFilePathInfo` 有四条分支，本仓库落到其中的「无工作区无家目录」组合：

| 权威分支                                                                 | 本仓库落点                                                                                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `:132-137` `untitled` / `data` 协议的资源 → 无文件段                      | 已迁移：`breadcrumbsModel.js` 的 `NO_FILE_PATH_SCHEMES`                                                                                                                        |
| `:145-156` 自资源向上走 `dirname`，遇工作区文件夹（`:147` 前半）或家目录（`:147` 后半）即停；最内层是 `FILE`、其余 `FOLDER`；`path === '/'` 或路径不再缩短即停 | 已迁移：`computeFileElements`。本仓库**没有工作区概念**（恒等价 `EMPTY`，见第 5 节「侧栏在空白窗口下的默认显隐」一项的说明）也没有家目录概念，故不传 `workspaceFolder` / `home`，走 `samples › common.nut` 这样的完整路径 |
| `:158-164` 家目录标签段（`ROOT_FOLDER` + 逐段 `FOLDER`）                  | 不适用：本仓库无家目录概念（`getUriHome` 无对应实现）                                                                                                                          |
| `:166-175` 工作区根段（仅 `WorkbenchState.WORKSPACE`，且 `folderCount > 1` 或资源即工作区根时才加） | 不适用：本仓库恒为 `EMPTY`（见上）                                                                                                                                             |

`breadcrumbs.filePath` / `breadcrumbs.symbolPath` 的 `on` / `off` / `last` 裁减（`:104-108`、`:110-121`）
本仓库固定按默认值 `'on'` 处理（未登记这两项设置，见第 5 节）。

**picker（点击条目 → 下拉）的触发源穷举（AGENTS.md §4.4）**

权威文件：`workbench/browser/parts/editor/breadcrumbsControl.ts`（部件与命令）、
`workbench/browser/parts/editor/breadcrumbsPicker.ts`（浮层基类、文件树、符号树）、
`base/browser/ui/contextview/contextview.ts`（宿主与 `layout2d`）。
本仓库：`src/workbench/contrib/editor/breadcrumbsControl.js`（打开/关闭/跳转）、
`breadcrumbsPicker.js`（浮层状态机与取值）、`BreadcrumbsPicker.vue`（渲染与键盘）。

| 权威触发源                                                                     | 结论                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `breadcrumbsControl.ts:655` `picker.onWillPickElement` → `hideContextView({source,didPick:true})` | 已迁移：`breadcrumbsPicker.js` 的 `openRow` 在跳转/打开后 `hidePicker({didPick:true})`（带 `didPick` 时不还原视图状态），组件 `watch(visible)` 随后调 `notifyBreadcrumbsPickerBlur`                                                                              |
| `:656` `PixelRatio.onDidChange` → 隐藏浮层                                     | 已迁移：`breadcrumbsControl.js` 的 `watchPixelRatio` / `hidePickerByZoom`（用 `matchMedia('(resolution: <dpr>dppx)')` 逐值重注册，等价 `base/browser/pixelRatio.ts` 的逐值监听；打开时建立、关闭时销毁）。与失焦路径的差别：不设置 ignore-once（权威只由 `:660` 设置） |
| `:658-662` `dom.trackFocus(parent).onDidBlur` → 记 ignore-once 并隐藏           | 已迁移：`BreadcrumbsPicker.vue` 的 `onFocusOut` → `breadcrumbsControl.js` 的 `notifyBreadcrumbsPickerBlur`（`ignoreOnceKey` 即 `_breadcrumbsPickerIgnoreOnceItem`，:609）                                                                                        |
| `:334` `widget.onDidChangeFocus` → `_updateCkBreadcrumbsActive`                 | 已迁移：`EditorBreadcrumbs.vue` 的 `onFocusIn` / `onFocusOut` 与 `setFocusedBreadcrumb`，统一走 `updateBreadcrumbsActive()`（`breadcrumbsActive = DOM 聚焦 ∥ 浮层显示`，:724-728）                                                                                |
| `:490-491` `model.onDidUpdate`、`_cfShowIcons.onDidChange` → 重建条目           | 已迁移：`breadcrumbs.js` 的 `breadcrumbModel`（`EditorBreadcrumbs.vue` 的 items 计算属性消费）；`breadcrumbs.icons` 设置项未登记（第 5 节），图标恒输出                                                                                                          |
| `:507-508` `_cfTitleScrollbarSizing` / `_cfTitleScrollbarVisibility` → 横向滚动条尺寸与可见性 | 已迁移（降级）：本仓库条目行用原生横向滚动（第 5 节），没有 `DomScrollableElement` 的 size/visibility 配置                                                                                        |
| `breadcrumbsPicker.ts:106` `tree.onDidOpen` → `_revealElement`，未 reveal 时不关闭 | 已迁移：`openRow`（符号恒跳转并关闭；文件 picker 点目录返回 `false` → 浮层保持）                                                                                                                |
| `:113` `tree.onDidChangeFocus` → `_previewElement(elements[0])`（预览的唯一触发源） | 已迁移：`focusRow`（`previewSymbol`；文件 picker 的 `_previewElement` 返回 `Disposable.None` → 不预览）                                                                                          |
| `:116` `tree.onDidChangeContentHeight` → `_layout()`                            | 已迁移：`recomputeRows()` 在行集合每次变化后重算 `treeHeight` / `totalHeight` / `top`                                                                                                            |
| `:304-305` `config.onDidChange` / `workspaceService.onDidChangeWorkspaceFolders`（文件 picker 的 `files.exclude` 过滤器） | 已登记偏差：本仓库没有工作区与 `files.exclude` 的排除规则（第 5 节）                                                                                                                             |
| `:368` `themeService.onDidFileIconThemeChange` → 切换 `align-icons-and-twisties` / `hide-arrows` | 已迁移（简化）：`fileIconThemeTraits` 在模块加载时算一次（本仓库只有一个内建主题，运行期不换主题），组件按它推导这两个类                                                                        |

「这个部件的什么变化会让它更新？」→ 打开/关闭由 `breadcrumbsControl.js` 的 `openPicker`（:90-143）与
`notifyBreadcrumbsPickerBlur`（:154-164）驱动；行集合与高度由 `breadcrumbsPicker.js` 的 `recomputeRows`
（:231-245）在「折叠切换 / 打开时的 reveal / 输入定位」后重算；竖直落点由 `layoutPickerPosition`（:376-383）
在行数或视口变化后重算；预览由 `focusRow`（:399-412）在焦点变化时重建。

验证：`npm run check:breadcrumbs`（文件段的四条分支取值 + picker 的几何公式 / 高度分配 / 竖直落点 /
文件图标主题特征位 / 像素比监听 / 列表状态选择器，共 45 项断言）。

### 4.9 标题栏命令中心

来源与落点：权威 `workbench/browser/parts/titlebar/commandCenterControl.ts`（部件 `CommandCenterControl`:31-90、
自定义视图项 `CommandCenterCenterViewItem`:93-264、菜单项注册 :266-271）、
`media/titlebarpart.css:135-250`（全部取值）、`titlebarPart.ts:611-636`（可见时用命令中心**替换**标题文本）、
`:898`（`isCommandCenterVisible = !isCompact && config.window.commandCenter !== false`）、
`:235-236` + `platform/window/common/window.ts:333`（可见时标题栏高 35，否则 30）、
`workbench/browser/workbench.contribution.ts:902-908`（`window.commandCenter` 默认 true）、
`workbench/browser/actions/quickAccessActions.ts:156-165`（`workbench.action.quickOpenWithModes`）。
本仓库：`src/workbench/contrib/titlebar/CommandCenter.vue`（渲染）、`commandCenter.contribution.js`（菜单/动作）、
`commandCenter.js`（标签/提示纯函数，`npm run check:command-center` 覆盖）；容器与标题替换在
`src/components/TitleBar.vue`；可见性状态是 `src/menu/appState.js` 的 `commandCenter`。

DOM 逐层对应（`li.action-item` 由工具栏创建；因为权威的自定义视图项把**容器本身**当元素
（`BaseActionViewItem.render` 的 `this.element = container`），所以命令中心一侧不出现 `.action-label` 与图标）：

```
div.command-center                                             commandCenterControl.ts:38-46
  div.monaco-toolbar > div.monaco-action-bar > ul.actions-container[role=toolbar]
                                                               :48-62（MenuId.CommandCenter 的 MenuWorkbenchToolBar）
    li.action-item.command-center-center                        :113-116（multiple = 内层动作数 > 1）
      div.monaco-toolbar > div.monaco-action-bar > ul.actions-container
                                                               :135-141（每个分组一个嵌套 WorkbenchToolBar）
        li.action-item.command-center-quick-pick[role=button][aria-description]
          span.search-icon（仅非紧凑模式） + span.search-label   :160-193（紧凑模式只渲染 search-label）
      span.codicon.codicon-circle-small-filled（分组间 spacer）  :243-250（内联 padding 0 8px / height 100% / opacity .5）
```

七个维度（AGENTS.md §4.1）：

1. **DOM**：见上；`.monaco-toolbar` / `.monaco-action-bar` / `.actions-container` / `.action-item` 的样式来自
   monaco-editor 发行的 `toolbar.css` / `actionbar.css`（与权威同源，已核对产物中的 `.actions-container{display:flex;
margin:0 auto;…}`、`.action-item{display:block;…}`），本仓库不重写这些通用规则。
2. **取值**：`.command-center{z-index:2500; -webkit-app-region:no-drag}`（`titlebarpart.css:141-144`）；
   `.command-center-center{height:22px; width:38vw; max-width:600px; margin:0 6px;
border:1px solid --vscode-commandCenter-border; border-radius:--vscode-cornerRadius-medium;
background-color:--vscode-commandCenter-background; color:--vscode-commandCenter-foreground}`（`:168-181`）；
   `.command-center-quick-pick{margin:auto; max-width:600px}`（`:182-188`）；
   `.search-icon{font-size:14px; opacity:.8; margin:auto 3px}`（`:190-195`）；`.compact-mode{margin:auto auto auto 0;
padding-left:8px; flex:1}`（`:207-211`）；标题栏内 `.monaco-toolbar .actions-container{gap:4px}`（`:135-139`）。
   颜色 token 见下表。
3. **状态**：hover 是纯 CSS（`titlebarpart.css:243-248`：`commandCenter.activeForeground/activeBackground/activeBorder`）；
   本仓库没有 `inactive`（窗口失焦）态，故 `:238-241` 的 `titleBar-inactiveForeground` + `commandCenter-inactiveBorder`
   未引入。勾选态：中心项未声明 `toggled`，菜单项不是复选项 —— 与权威一致（该子菜单项无 toggled）。
4. **交互行为**：点击圆角框（含框内空白）执行其承载的动作（权威 `BaseActionViewItem` 在容器上挂 CLICK，action
   取 `workbench.action.quickOpenWithModes`，`:109`）；框内条目的点击被 `stopPropagation` 吃掉，不重复触发
   （本仓库用 `@click.stop`）。该动作打开快速输入浮层（见 4.10）。**没有** `openCommandActionDescriptor`/`toggled`
   之类的自造状态。
5. **定位**：命令中心自身由 `.titlebar-center`（60% 宽、`max-width:fit-content`、`margin:0 10px`、
   `justify-content:center`）+ `.window-title{margin:auto}` 水平居中，`align-items:center` 垂直居中
   （`titlebarpart.css:82-122`）；它打开的快速输入浮层定位见 4.10。
6. **复用**：只有一份命令中心实现；动作与菜单落点全部走 `MenuRegistry`/`registerAction2`，渲染复用
   `ActionView`（外层普通动作）与 MenuPanel 家族（本组件不渲染菜单）。标签/提示是纯函数，可 Node 侧验证。
7. **顶部菜单栏落点**：命令中心是标题栏部件，不在 `MenuId.MenubarMainMenu` 挂任何条目 —— 不涉及 §4.1 规则 7。

命令中心颜色 token（注册 `workbench/common/theme.ts:818-872`；2026-dark `extensions/theme-defaults/themes/2026-dark.json:103-107,257`）：

| token                          | 权威注册默认值                                                      | 2026-dark（= 本仓库 theme.css） |
| ------------------------------ | ------------------------------------------------------------------- | ------------------------------- |
| commandCenter.foreground       | `titleBar.activeForeground`（`theme.ts:819-824`）                   | `#bfbfbf`                       |
| commandCenter.activeForeground | `menubar.selectionForeground`（`theme.ts:825-830`）                 | `#bfbfbf`                       |
| commandCenter.background       | dark `white.transparent(.05)`（`theme.ts:832-837`）                 | `#191a1b`                       |
| commandCenter.activeBackground | dark `white.transparent(.08)`（`theme.ts:838-843`）                 | `#ffffff0f`                     |
| commandCenter.border           | `transparent(titleBar.activeForeground, .20)`（`theme.ts:845-849`） | `#2e3031`                       |
| commandCenter.activeBorder     | `transparent(titleBar.activeForeground, .30)`（`theme.ts:850-854`） | `#333536`                       |

文本规则（`commandCenterControl.ts`）：标签 = 工作区名（自定义 `window.title` → 整条窗口标题；`showTabs === 'none'`
→ 文件名；空则回退 "Search"），再把换行替换为 `⏎`（`:216-235`）；提示 = `Search {workspace} ({快捷键}) — {窗口标题}`，
查不到快捷键时省略括号段（`:254-263`，`quickOpenWithModes` 在权威里**没有**默认快捷键，故实际渲染无括号段）。
紧凑模式判定（`:166-174`）：`chat.agentsControl.enabled` 默认 `'compact'`（`chat/browser/chat.shared.contribution.ts:451`）
且 AI 未强制关闭 → 紧凑（不渲染 search-icon）；本仓库无 chat/agents 贡献，该配置读不到值同样落进紧凑分支。

触发源穷举（AGENTS.md §4.4，权威 `grep -n "onDid\|\.on\(" commandCenterControl.ts`）：

| 权威触发源                                                                       | 结论                                                                             |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `:121`、`:198` `windowTitle.onDidChange` → 刷新悬浮提示与 `search-label` 文本    | 已迁移：标签/提示是 `computed`，随 `appState.title` 与活动编辑器响应式重算       |
| `:204-209` `editorGroupService.onDidChangeEditorPartOptions`（仅 showTabs 变化） | 不适用：本仓库没有 `workbench.editor.showTabs` 设置（恒为标签页模式）            |
| `:64-78` `quickInputService.onShow/onHide` + `alignment` → `.hide` 类切显隐      | 已迁移：`CommandCenter.vue` 订阅 `quickInput.visible`，浮层可见时给命令中心加 `.hide`（本仓库的快速输入见 4.10） |
| `:166-174` 配置读取（`chat.agentsControl.enabled`、AI 开关）→ 紧凑模式与图标显隐 | 不适用：本仓库无该配置，取值等价于默认的紧凑分支，已按紧凑渲染                   |
| 菜单注册表/上下文键变化 → 重算条目与可用性                                       | 已迁移：`CommandCenter.vue` 订阅 `contextKeys.onDidChange` 重算 `getMenuActions` |

「这个部件的什么变化会让它更新？」→ 窗口标题（工作区名或活动编辑器）变化 → 框内文字与提示；
菜单注册表或上下文键变化 → 条目与可用性；窗口尺寸变化 → 由 `width: 38vw` 与 flex 布局自动收敛（无 JS）；
快速输入显示/隐藏 → 命令中心加/去 `.hide`（`:64-82`）。
验证：`npm run build`（产物含命令中心 DOM/样式与 `workbench.action.quickOpenWithModes`，见静态检查）、
`npm run check:command-center`（标签/提示纯函数 5 项）、`npm run check:quickinput`（点击链路）、
`npm run check:theme`（命令中心与浮层引用的 `--vscode-*` 均在 `theme.css` 有定义）。
未迁移：后退/前进与分享按钮、命令中心开关命令、外层子菜单项（均见第 5 节）。

### 4.10 快速输入 / 快速打开（命令中心、Ctrl+P、Ctrl+Shift+P 的浮层）

来源与落点：权威 `platform/quickinput/browser/quickInputController.ts`（浮层控制器与 DOM）、
`quickInput.ts`（QuickPick 状态）、`quickInputList.ts`（列表项 DOM）、`media/quickInput.css`（全部取值）、
`platform/theme/common/colors/quickpickColors.ts`（颜色 token）、
`workbench/browser/quickaccess.ts`（`inQuickOpen` 上下文键）、
`workbench/browser/actions/quickAccessActions.ts`（命令与键位）、
`workbench/contrib/search/browser/anythingQuickAccess.ts`（空前缀默认提供者）、
`platform/quickinput/browser/commandsQuickAccess.ts`（`>` 命令提供者）。
本仓库：`src/platform/quickinput/quickInput.js`（状态机与接受/隐藏语义）、`quickAccess.js`（提供者注册与前缀路由）、
`src/base/quickinput/QuickInputWidget.vue`（浮层渲染与定位）、
`src/workbench/contrib/quickaccess/browser/commandsQuickAccess.js`（`>`；命令表取自
`MenuId.CommandPalette` 菜单，而该菜单由 `registerAction2` 按 `actions.ts:754-755` 自动挂载）、
`src/workbench/browser/quickaccess/anythingQuickAccess.js`（`''`）、
`src/menu/quickInput.contribution.js`（命令与键位注册）。

DOM 逐层对应（`quickInputController.ts:164-254` + `quickInputList.ts:347-397`）：

```
div.quick-input-widget.show-file-icons[tabindex=-1]           quickInputController.ts:164（容器）
  div.quick-input-titlebar                                    :169-188（标题栏动作条；未迁移，见第 5 节）
  div.quick-input-header                                      :188
    div.quick-input-description                               :204（未迁移）
    div.quick-input-and-message                               :205
      div.quick-input-filter                                  :206
        div.quick-input-box > .monaco-inputbox > .ibwrapper > input.input
                                                              :208-209（QuickInputBox）
        div.quick-input-visible-count[aria-live]              :211-214（未迁移）
        div.quick-input-count > span.monaco-count-badge       :216-219
      div#<id>message.quick-input-message                     :235
  div.quick-input-list
    div.monaco-list > div.monaco-scrollable-element > div.monaco-list-rows[role=listbox]
      div.monaco-list-row[data-index][role=option]
        div.quick-input-list-entry
          span.quick-input-list-separator | label.quick-input-list-label
            span.quick-input-list-icon + div.quick-input-list-rows
              div.quick-input-list-row（.monaco-icon-label > .label-name + .quick-input-list-entry-keybinding）
              div.quick-input-list-row > span.quick-input-list-label-meta
```

七个维度（AGENTS.md §4.1）：

1. **DOM**：见上；行采用与 list widget 相同的「绝对定位行容器」结构（`list.css:23-39`：`.monaco-list-rows`
   相对、`.monaco-list-row` 绝对 + `top = index * 行高`），行高 22。
   `list.css:23-27` 的 `.monaco-list-rows{height:100%}` 只是兜底，**真实滚动高度必须由 JS 按内容高度写入**
   （`listView.js:140` `contentHeight = rangeMap.size`、`:427-429` 把 `contentHeight` 写进
   `rowsContainer.style.height`）；否则行容器恒等于可视高，滚动容器的 `scrollHeight === clientHeight`，
   列表完全滚不动（既滚不了也够不到可视区之外的条目）—— 本仓库由 `rowsStyle`
   （`items.length * ROW_HEIGHT`）显式写行容器高度。
2. **取值**：`width = min(容器宽 * 0.62, 600)`（`quickInputController.ts:946` + `:67` 的 `MAX_WIDTH = 600`）、
   列表高 `= 容器高 * 0.4`（`:949`）、`left = round(容器宽 * 0.5 - width / 2)`（`:1004`）、
   `top = 6`（`workbench/browser/layout.ts:264-270`：命令中心可见时 `quickPickTop = 6`，即浮层覆盖标题栏）；
   圆角 `cornerRadius-xLarge`、阴影 `shadow-xl`、`border: 1px solid --vscode-widget-border`、`z-index: 2550`
   （`quickInput.css:6-14`）；内边距与列表行取值逐条见 `QuickInputWidget.vue` 的注释（`quickInput.css:130-353`）。
   颜色只取 token：`quickInput.background/foreground`、`widget.border`、
   `quickInputList.focusBackground/focusForeground/focusIconForeground`、`list.hoverBackground`、
   `descriptionForeground`（分组标题，`quickInput.css:348-353`，**不是** `pickerGroup.foreground`）、
   `keybindingLabel.background/foreground/border/bottomBorder` + `widget.shadow`（快捷键胶囊，
   `keybindingLabel.ts:78/164-174` 由 `defaultKeybindingLabelStyles` 的 `asCssVariable` 内联）。
   这些 token 必须在本仓库的 `src/styles/theme.css` 里定义齐全：浮层是**工作台部件**，
   而 monaco 的主题注入被限定在 `.monaco-editor, .monaco-diff-editor, .monaco-component`
   （发行包 `standaloneThemeService.js:_updateThemeOrColorMap`）之下，浮层拿不到；
   且 `var(--vscode-x)` 在 `x` 未定义时**整条声明按无效丢弃**（没有回退值），
   缺 `quickInput.background` 会让浮层背景退化成透明、缺 `quickInputList.focus*` 会让当前项
   没有高亮底色 —— 即曾经出现的「样式错乱」。取值来自 2026-dark.json:234-241（quickInput*）
   与 `platform/theme/common/colors/quickpickColors.ts` 的 `registerColor` 默认值。
   守卫脚本：`npm run check:theme`（扫描 `src` 全部 `var(--vscode-*)` 与 theme.css 定义比对）。
3. **状态**：列表行 `focused`（活动项）= `quickInputList.focus*`；非活动行 hover = `list.hoverBackground`；
   分隔行不可选中、无 hover 底色（对齐 Separator 不进 `activeItems`）；输入框为 `.monaco-inputbox.idle`
   （焦点态由 monaco 的 inputbox 样式承担）。
4. **交互行为**：输入即时过滤（`onDidChangeValue` → `getPicks`，对齐 `PickerQuickAccessProvider`）；
   `↑/↓`（不环绕）、`PageUp/PageDown`（步长 = 可见行数）、`Ctrl+Home/Ctrl+End`、`Enter` 接受、`Esc` 关闭、
   失焦关闭（`ignoreFocusOut` 默认 false）；接受后先执行条目自身的 accept，再关闭并把焦点还给先前元素
   （`quickInputController.ts` 的 `previouslyFocusedElement.focus()`）；`@` / `:` / `#` 三个前缀未迁移（第 5 节）。
   **滚轮**：列表建为 `alwaysConsumeMouseWheel: true`（`quickInputList.ts:807`），滚轮由列表自身消费、
   只滚动列表（不改变活动项），滚到两端也不外溢给下层编辑器 —— 本仓库由 `@wheel="onWheel"`
   （`preventDefault()` + `scrollTop += deltaY`）承担。
   **打开时的输入值与选区**（`quickAccess.ts:59-107` 的 `doShowOrPick` + `:170-186` 的 `adjustValueSelection`，
   签名是 `show(value = '')`）：
   1）新开一次不带上一次的输入（`Ctrl+P` / `Ctrl+Shift+P` 重开都是空输入，`preserveValue` **不是**「记住输入」，
   而是「已打开时不改写 + 光标置末尾」）；2）同一提供者已打开时保留用户已输入的内容，只重算选区；
   3）未 `preserveValue` 时选中前缀之后的过滤词（键入即替换），`preserveValue` 时光标落到末尾；
   4）换提供者时把已输入的过滤词接到新前缀后带过去（`quickAccess.ts:79-91`）。
5. **定位**：无锚点分支（`controller.anchor` 为空）→ 顶部居中 + `top = 6`（见第 2 项）；锚点分支
   （`anchorPosition: 'overlay'` / 下拉框上方）未迁移。
6. **复用**：只有一份浮层实现（`QuickInputWidget.vue`），命令中心、`Ctrl+P`、`Ctrl+Shift+P` 共用同一控制器与同一份渲染；
   命令提供者的命令表来自 `MenuId.CommandPalette` 菜单（由 `registerAction2` 自动挂载，见 §2 表），
   与菜单栏/工具栏同源 —— 不为命令面板另建一份命令清单。
   面板内容因此也自动排除了内部命令：`quickInput.*` 与 `workbench.action.closeQuickOpen` 在
   `quickInput.contribution.js` 里标了 `f1: false`（权威用 `KeybindingsRegistry` 注册这些命令，
   本来就不进命令面板）；菜单与命令面板的快捷键列只显示**首选**键位
   （`getKeybindingLabel` 取首条规则，对齐 `keybindingService.lookupKeybinding`），
   故 `Ctrl+Shift+P` 不会显示成「Ctrl+Shift+P / F1」。
7. **顶部菜单栏落点**：浮层本身不挂菜单栏；但打开它的 `workbench.action.showCommands` 有落点 ——
   「视图」菜单首组首项「命令面板…」（`MenuId.MenubarViewMenu` / group `1_open` / order 1，
   对齐 `quickAccess.contribution.ts:55-62`）。该命令在权威里还有三处落点，本仓库的取舍见第 5 节。

触发源穷举（AGENTS.md §4.4，权威 `grep -n "onDid\|addEventListener" quickInputController.ts quickInput.ts`）：

| 权威触发源                                                       | 结论                                                                                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `quickInputController.ts` `onDidShow/onDidHide`                   | 已迁移：`quickInput.js` 的 `showQuickPick/hideQuickPick` 改 `quickInput.visible`，组件据此显隐并挪焦点   |
| `quickInput.ts` `onDidChangeValue`（输入框）                       | 已迁移：`setQuickPickValue` → 会话 `onDidChangeValue` → 提供者 `getPicks`                                 |
| `quickInput.ts` `onDidAccept` / `onDidTriggerButton` / `onDidCustom` | 部分迁移：`acceptQuickPick` 覆盖接受；自定义按钮未迁移（第 5 节）                                       |
| `quickInputController.ts` 的失焦处理（`ignoreFocusOut` 默认 false） | 已迁移：部件的 `@focusout` → `notifyQuickPickFocusOut()`                                                 |
| `list` 的 `onDidChangeFocus`（键盘上下）                           | 已迁移：`focusQuickPick(mode)` + 键位注册（`quickInput.contribution.js`）                                 |
| `quickInputController.ts:1010-1045` 容器尺寸/布局变化               | 已迁移：部件监听 `window.resize` 重新测量（对齐 `layout(dimension, quickPickTop)`）                       |
| 提供者的 `onDidChangeValue` / 异步重算（`FastAndSlowPicks`）        | 不适用：本仓库两个提供者都是同步返回（内置文件 + 已打开编辑器 + 命令表），没有慢查询与 busy 态            |

「这个部件的什么变化会让它更新？」→ 输入值变化（`setQuickPickValue`）、活动项变化（键盘 / 悬停）、
会话显隐（`showQuickPick` / `hideQuickPick`）、窗口尺寸变化（`resize`）、上下文键变化（命令面板的 `when` 求值，
经 `getMenuActions(MenuId.CommandPalette, contextKeys)`）。
验证：`npm run check:quickinput`（50 项：前缀路由、命令面板取数与 `f1: false` / `precondition` 过滤、
模糊与 id 全等匹配、重复标签的 description、接受后执行与历史排序 / 分隔线、帮助项跳转、失焦隐藏、
打开时的输入值与光标选区（`preserveValue` 语义）、换提供者的过滤词带入，快捷键列只取首选键位，
以及命令中心接线、`.hide`、`quickOpen` 的 prefix 参数 / `Ctrl+E`、内部命令的 `f1: false`、
视图菜单命令面板落点的静态断言，行容器高度按内容高度写入、滚轮由列表消费、
浮层颜色 token 齐备且分组标题取 `descriptionForeground` 的静态断言）；
`npm run check:theme`（`src` 内所有 `var(--vscode-*)` 都能在 theme.css 找到定义）。
未迁移清单见第 5 节。

### 4.11 编辑器重排时机（部件尺寸变化时缩略图不闪烁）

权威由布局驱动重排：sash 拖动的回调里就调用 `grid.layout()`（`base/browser/ui/grid/grid.ts` 的
`onDidSashChange`），一路到 `workbench/browser/parts/editor/editorPart.ts` 的 `layout()` →
`editorGroupView.layout()` → `codeEditorWidget.layout(dimension)`；**权威 workbench 不使用**
monaco 的 `editor.automaticLayout`（它是给独立使用 monaco 的调用方的便利选项）。

monaco 发行包里这两条路径的时机差异（`esm/vs/editor/`）：

- **`layout()`**（`browser/widget/codeEditor/codeEditorWidget.js:1079-1084`）：先同步
  `_configuration.observeContainer(dimension)` 测量，再**立即 `this.render()`** ——
  缩略图 canvas 在 `_applyLayout` 里被改写 `width/height`（改写即清空画布，
  `browser/viewParts/minimap/minimap.js:1082-1093`），清空与重绘落在**同一调用栈、同一帧**。
- **`automaticLayout`**（`browser/config/elementSizeObserver.js`）：走 `ResizeObserver`，
  回调在渲染帧的 layout 阶段**之后**触发 —— 本帧 paint 时画布是刚被清空的空白，
  重绘要等下一帧编辑器 render loop，持续拖拽时缩略图逐帧空白。

本仓库落地（`workbench/contrib/editor/EditorPart.vue`）：尺寸相关的 `appState` 变化后用
`flush: "post"` 的 watcher 同步调用 `pane.layout()`（此时 DOM 已更新、仍在同一任务内）；
`automaticLayout` 保留作兜底 —— 同步 layout 已把尺寸写入 `ElementSizeObserver`，
它随后测量到相同值不会再触发重排。

**触发源穷举（「什么变化会让编辑器重排」）**：

| 触发源                                                                   | 结论                                                                   |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `appState.sidebarWidth` / `sidebarVisible`（拖拽侧栏、切换侧栏）         | 已迁移：EditorPart.vue 的尺寸 watcher（`flush: "post"`）               |
| `appState.panelHeight` / `panelVisible` / `panelMaximized`（拖拽面板等） | 已迁移：同上                                                           |
| `appState.statusBarVisible`（状态栏显隐改变主区高度）                    | 已迁移：同上                                                           |
| 窗口尺寸变化 / 标签栏与面包屑高度变化                                    | 兜底：monaco `automaticLayout` 的 ResizeObserver（非高频，不表现为闪烁） |
| 字体加载                                                                 | 不适用：使用系统等宽字体族，无 webfont 驱动的尺寸变化                  |

### 4.12 编辑器标签：激活（选中）标签的淡色底

来源与落点：权威 `workbench/contrib/modernUI/browser/media/tabs.css`（现代标签外观，全部规则由 `.modern-ui-tabs` 门控）、
`workbench/common/theme.ts`（`modernTab.*` / `modernEditorTab.*` token 的 registerColor 默认值）、
`workbench/services/themes/browser/modernTabColorCustomizations.ts`（把 token 映射为 `--modern-ui-editor-tab-*` 变量）。
本仓库：`src/workbench/contrib/editor/EditorTabs.vue`（`.tab.active`）、`src/styles/theme.css`（`--vscode-modernEditorTab-activeBackground`）。

为什么是这一处：classic 标签样式下**激活标签不带淡色底** —— `multieditortabscontrol.css:141/144`（聚焦组）与 `:155/158`（非聚焦组）
的 `.tab.active` 只有 `tab.activeBackground`（= `editorBackground`，`theme.ts:32`）与 `:171-172` 一层近乎不可见的阴影；
`.tab.selected:not(.active)`（`:162`）才取 `tab.selectedBackground`，而按 `editorGroupModel.ts` 的 `selection = [active, ...inactiveSelected]`，
激活标签同时带 `.active` 会被 `:not(.active)` 排除。带淡色底的「选中文件」来自现代标签样式（`tabs.css:311-316`）。

| 项                 | 取值                                                                                                                                                                                     | 权威                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 激活标签底色 token | `modernEditorTab.activeBackground`                                                                                                                                                       | `theme.ts:717`                                               |
| 默认值链           | `modernEditorTab.activeBackground` → `modernTab.activeBackground` → `listInactiveSelectionBackground`                                                                                    | `theme.ts:717` → `:707`                                      |
| 本仓库取值         | `#2C2D2E`（2026-dark 的 `list.inactiveSelectionBackground`；主题未自定义 `modernTab.*` / `modernEditorTab.*` / `tab.activeBackground`，故保持该默认值）                                   | `2026-dark.json:59`、`modernTabColorCustomizations.ts:19-27` |
| 消费方式           | `--modern-ui-editor-tab-active-background: var(--vscode-modernEditorTab-activeBackground)`，由 `.tab.active > .tab-fill` 取用                                                            | `tabs.css:21`、`:311-316`                                    |
| 非激活标签         | `modernEditorTab.inactiveBackground` = `Color.transparent`（不覆盖标签栏底色）                                                                                                           | `theme.ts:723`、`tabs.css:285-288`                           |
| 标签栏底色         | `editorGroupHeader.tabsBackground` = `#202122`；现代样式下 `.title.tabs` 反而改为 `transparent`                                                                                          | `2026-dark.json:208`、`tabs.css:57-59`                       |

取值修正（本轮随该项一并校正）：`theme.css` 原先把 `editorGroupHeader-tabsBackground` 与 `tab-inactiveBackground`
写成 `#191a1b` —— 那是 `tab.unfocusedInactiveBackground`（`2026-dark.json:206`）的值；现按 `2026-dark.json:197,208`
改为 `#202122`，与激活标签的 `#2c2d2e` 保持与权威相同的对比度（Dark Modern 下为 `#2B2B2B` / `#37373D`，同样相差 12）。

触发源穷举（AGENTS.md §4.4，权威 `grep -n "onDid[A-Z]\|addEventListener\|observe(" src/vs/workbench/browser/parts/editor/*.ts src/vs/workbench/contrib/modernUI/browser/modernUI.contribution.ts`）：

| 权威触发源                                                                                        | 结论                                                                                                                     |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `editorGroupView.ts:1326` `titleControl.openEditor`（激活编辑器切换）、`:599`/`:846` `openEditors` | 已迁移：`EditorTabs.vue:86` 的 `:class="{ active: editor.id === editorGroup.activeId }"` 随激活态重算                        |
| `editorGroupView.ts:867` `updateEditorDirty`、`:884` `updateEditorLabel`、`:894` `updateEditorSelections` | 已迁移：`editor.dirty` / `editor.name` 由 `editorGroupService.js` 写回条目（标签的 `.dirty` 类与标题）                    |
| `editorGroupView.ts:832` `updateOptions`（`workbench.editor.showTabs` / `tabHeight` / 固定标签独立一行，`:836-847`） | 不适用：本仓库固定标签页模式，无这些设置项                                                                               |
| `editorGroupView.ts:975-979` `titleControl.setActive(isActive)` → 容器 `.active` / `.inactive`（组焦点决定 `unfocused*` 底色变体） | 已登记偏差：单编辑器组、不区分焦点，未实现 `tab.unfocused*` / `modernEditorTab.unfocused*`（第 5 节）                     |
| `editorGroupView.ts:1136/1163/1168/1170` pin / move / stick / unstick                              | 已迁移：`editorGroupService.js` 的固定与移动（固定态影响 `.tab-label.italic`）                                            |
| `multiEditorTabsControl.ts:183` `tabResourceLabels.onDidChangeDecorations`（资源装饰 → 重绘标签）   | 不适用：本仓库没有标签装饰（problems / SCM 徽章）服务                                                                     |
| `multiEditorTabsControl.ts:193` `hostService.onDidChangeFocus`                                      | 不适用：同上，无组焦点状态                                                                                                |
| `modernUI.contribution.ts:149` `onDidChangeConfiguration`（`workbench.experimental.modernUI` → 加/去 `.modern-ui-tabs` 类） | 已登记偏差：本仓库无该设置项，标签底色固定取现代值而布局仍为 classic（第 5 节）                                          |
| `modernUI.contribution.ts:164` `onDidAddContainer`（新容器补类）                                     | 不适用：单窗口单容器                                                                                                      |
| `modernTabColorCustomizations.ts:39` `registerThemingParticipant`（主题变化 → 重注入 `--modern-ui-editor-tab-*`） | 不适用：本仓库只有一份静态主题（`styles/theme.css`），无运行时切换主题                                                    |

「这个部件的什么变化会让它更新？」→ 激活编辑器切换（`editorGroupView.ts:1326` → `EditorTabs.vue:86` 的 `:class` 绑定）、
标签集合变化（`:599` / `:846` → `v-for="editor in editorGroup.editors"`）、脏态与标题变化（`:867` / `:884`）。
底色本身不随时间变化：它由静态 token 决定（`EditorTabs.vue:184` 引用 `styles/theme.css:103` 的
`--vscode-modernEditorTab-activeBackground`），不订阅任何事件。

验证：本项为纯 CSS 取值，Node 侧无法断言渲染结果（AGENTS.md §5 禁止启动浏览器），故只做静态核对：
`grep -n "modernEditorTab-activeBackground" src/workbench/contrib/editor/EditorTabs.vue src/styles/theme.css`
（CSS 变量定义与消费成对出现），以及 `npm run build` 通过。
未迁移：`.tab-fill` 元素、现代标签行高 24px（`tabs.css:57-60`）、圆角与透明上下描边（`tabs.css:103-113`、`:311-316`）——见第 5 节。

### 4.13 布局状态持久化（部件尺寸与显隐）

来源与落点：权威 `workbench/browser/layout.ts`（`LayoutStateKeys` `:2879-2909`、`LayoutStateModel` `:2939-3245`）、
`platform/storage/common/storage.ts`（作用域 / 目标 / 落盘时序）、`workbench/services/storage/browser/storageService.ts`（浏览器落盘）、
`platform/workspace/common/workspace.ts`（空白窗口的工作区 id）。
本仓库：`src/platform/storage/common/storage.js`、`src/platform/storage/browser/storageService.js`、
`src/workbench/browser/layoutStateModel.js`、`src/workbench/browser/layout.js`、`src/workbench/browser/partDimensions.js`；
接入点 `src/App.vue:15-19`（`initLayoutState()` 必须早于 `:22-44` 那次 `immediate` 的上下文键同步，
否则菜单勾选态会停在贡献点注册时写入的内存初值）。

两个状态类型与用途（`layout.ts:2847-2858`）：

- `InitializationStateKey`（`layoutStateModel.js:36-41`）：只在 will-save 时采样写回，即部件尺寸；
- `RuntimeStateKey`（`:27-34`）：改动即进状态缓存，PROFILE 作用域的在 `setRuntimeValue` 里立即落盘（`layout.ts:3195-3205`），
  WORKSPACE 作用域等 will-save。

迁入的六个键（存储名 = `workbench.` + name，`STORAGE_PREFIX` 见 `layout.ts:2941`）：

| 键（name）               | 作用域    | 目标    | 默认值                            | 权威                          |
| ------------------------ | --------- | ------- | --------------------------------- | ----------------------------- |
| `sideBar.size`           | PROFILE   | MACHINE | 300（动态：`min(300, 宽/4)`）     | `layout.ts:2879`、`:3026`     |
| `panel.size`             | PROFILE   | MACHINE | 300（动态：`高/3`）               | `layout.ts:2881`、`:3066`     |
| `panel.wasLastMaximized` | WORKSPACE | MACHINE | false                             | `layout.ts:2886`              |
| `sideBar.hidden`         | WORKSPACE | MACHINE | false                             | `layout.ts:2905`              |
| `panel.hidden`           | WORKSPACE | MACHINE | true（面板默认隐藏）              | `layout.ts:2907`              |
| `statusBar.hidden`       | WORKSPACE | MACHINE | false                             | `layout.ts:2909`              |

落盘的两份文档（权威每个「库」一份 `ItemTable`，本仓库用 localStorage 的键模拟库）：

| 文档名                          | 覆盖作用域                | 权威出处                                                                |
| ------------------------------- | ------------------------- | ----------------------------------------------------------------------- |
| `vscode-web-state-db-global`    | APPLICATION + PROFILE     | `storageService.ts:121-133`（默认档案的档案级存储与全局存储共用同一个库） |
| `vscode-web-state-db-empty-window` | WORKSPACE              | `storageService.ts:345`、`workspace.ts:156`（空白窗口的工作区 id）       |

目标映射表 `__$__targetStorageMarker` 与数据存在同一份文档里（`storage.ts:313-324`、`:535-553`），
值是一段 JSON 字符串（键 → `StorageTarget`），不是嵌套对象。

时序（**这个顺序不能反**）：`store()` 只写内存并标记文档为 dirty（`storage.js:74-85`）→
`flush()` **先** fire `onWillSaveState`、**再**把 dirty 文档落盘（`storage.js:100-104`，对齐 `storage.ts:614-641`）→
布局在 will-save 回调里把部件当前尺寸采样进初始化键，随后 `save(true, true)` 一次写下 WORKSPACE 与 PROFILE 两个作用域
（`layout.js:46-52`，对齐 `layout.ts:1721-1743`）。颠倒会让刷新前最后一次拖拽丢失。

触发源穷举（AGENTS.md §4.4，权威 `grep -n "onDid[A-Z]\|addEventListener\|observe(" src/vs/workbench/browser/layout.ts src/vs/platform/storage/common/storage.ts`）：

| 权威触发源                                                                                       | 结论                                                                                                                     |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `layout.ts:1688` `part.onDidVisibilityChange` → `setSideBarHidden` / `setPanelHidden`（`:1697-1701`） | 已迁移：`layout.js:57-64` 的 appState 显隐 watcher → `setRuntimeValue`（本仓库没有 grid，显隐由 appState 驱动）             |
| `layout.ts:1953` `setSideBarHidden` 的 `setRuntimeValue(SIDEBAR_HIDDEN, hidden)`                  | 已迁移：同上                                                                                                             |
| `layout.ts:1631` `setStatusBarHidden` 的 `setRuntimeValue(STATUSBAR_HIDDEN, hidden)`              | 已迁移：同上                                                                                                             |
| `layout.ts:2099` `setPanelHidden` 的 `setRuntimeValue(PANEL_HIDDEN, hidden)`                      | 已迁移：同上                                                                                                             |
| `layout.ts:2155-2162` 面板由隐到显 / 由显到隐时的最大化处理                                        | 已迁移：`layout.js:75-92`（隐藏记下、重新显示按 `'preserve'` 切过去）                                                     |
| `layout.ts:2276` `setPanelMaximized` 的 `setRuntimeValue(PANEL_WAS_LAST_MAXIMIZED, maximize)`      | 已迁移：同上（`maximizedChanged` 分支）                                                                                  |
| `layout.ts:1721-1743` `storageService.onWillSaveState`（采样部件尺寸 + `save(true, true)`）        | 已迁移：`layout.js:46-52`（采样的是 appState 里的尺寸，本仓库没有 grid 可测）                                             |
| `storage.ts:614-641` flush 的「先 onWillSaveState、后写盘」                                        | 已迁移：`storage.js:100-104`（由 `check:layout-state` 的时序断言固定）                                                    |
| `layout.ts:742-763` `stateModel.onDidChangeState` → `setStatusBarHidden` / `setSideBarPosition` 等 | 不适用：本仓库 `appState` 是唯一状态源，订阅方向是 appState → 状态模型；再反向订阅会形成回环                              |
| `layout.ts:3081-3093` `storageService.onDidChangeValue`（PROFILE + USER 目标的跨窗口同步）          | 已登记偏差：无跨窗口广播（第 5 节）                                                                                      |
| `layout.ts:2970` `configurationService.onDidChangeConfiguration`（legacy 设置回写状态）             | 不适用：本仓库没有 `workbench.sideBar.visible` / `statusBar.visible` 之类的 legacy 设置项                                 |
| `layout.ts:1697` 显隐变化后的 `handleContainerDidLayout` / `:1766` grid.layout                          | 不适用：本仓库没有 grid，尺寸由 CSS flex 与 appState 决定                                                                 |

收尾自查 —— 「这个部件的什么变化会让它更新？」：

- 拖拽侧栏宽 → `Sidebar.vue:48` 的 `clampSidebarWidth` 写入 `appState.sidebarWidth`；落盘在 will-save 采样（`layout.js:48`）；
- 拖拽面板高 → `PanelPart.vue:67` 的 `clampPanelHeight`；落盘同上（`layout.js:49`）；
- 侧栏 / 面板 / 状态栏显隐变化 → `layout.js:57-64`（WORKSPACE 作用域，等 will-save）；
- 面板最大化 / 隐藏 / 重新显示 → `layout.js:75-92`；
- 周期性落盘 → `storage.js:131-134`（间隔 5s，`BrowserStorageService.BROWSER_DEFAULT_FLUSH_INTERVAL`，`storageService.ts:20`）；
- 窗口关闭 → `storageService.js:51` 的 `beforeunload` → `close()` → `flush(SHUTDOWN)`（对齐 `web.main.ts:610` 的 onWillShutdown）；
- 启动读取 → `layoutStateModel.js:67-80` 的 `load`（对齐 `layout.ts:3002-3078`：先算动态默认值、再读存储、最后给未存过的键填默认值）→
  `layout.js:36-42` 落到 appState。

取值容错：存储里的字符串按默认值类型解码（boolean 只有 `'true'` 为真、number 走 `parseInt`、object 走 `JSON.parse`，
`layoutStateModel.js:118-132` 对齐 `layout.ts:3231-3244`）；`parseInt` 得到的 `NaN` 由 `clampSidebarWidth` / `clampPanelHeight`
回落到首选值（`partDimensions.js:24-27`、`:38-41`）；损坏的文档按「没存过」处理（`storageService.js:63-68`）。

未迁入的键与已知取舍见第 5 节。`wordWrap` / `minimap` 不在布局状态里 —— 它们是配置项与编辑器临时状态，
见 4.14。

验证（AGENTS.md §5 允许的手段）：`npm run check:layout-state`（35 项：默认值与动态默认值、落盘时序含
「onWillSaveState 先于写盘」、刷新往返、`initLayoutState()` 端到端恢复、损坏文档容错与尺寸夹取；
脚本伪造 `localStorage` 与 `window` 后动态 import 纯逻辑模块）；`npm run build` 通过，产物含
`vscode-web-state-db-`、`workbench.sideBar.size`、`workbench.panel.wasLastMaximized` 等字面量。

### 4.14 配置服务与两条编辑器开关（自动换行 / 缩略图）

来源与落点：权威 `platform/configuration/common/configurationRegistry.ts`（配置项登记）、
`common/configurationModels.ts` + `common/configuration.ts`（层次模型与取值）、
`common/configurations.ts` 的 `DefaultConfiguration`（默认层）、
`workbench/services/configuration/browser/configurationService.ts`（读写、落点、变更事件）、
`platform/contextkey/browser/contextKeyService.ts:104-176` 的 `ConfigAwareContextValuesContainer`（`config.*` 派生）、
`workbench/contrib/codeEditor/browser/toggleMinimap.ts` 与 `toggleWordWrap.ts`（两条开关命令）。
本仓库：`src/platform/configuration/common/configuration.js`、`configurationRegistry.js`、
`src/workbench/services/configuration/browser/configurationService.js`、
`src/platform/contextkey/browser/configAwareContextValues.js`、`src/monaco/editorConfiguration.js`、
`src/workbench/contrib/codeEditor/{wordWrapState.js,wordWrap.contribution.js,minimap.contribution.js}`；
接入点 `src/main.js:33-34`（`initConfigurationService()` + `contextKeys.attachConfigurationService(...)`，
必须早于挂载：`editor.minimap.enabled` 决定缩略图初值、`editor.wordWrap` 决定换行初值）。

分层（`configuration.js:284-335`）：默认层 ← 注册表的 `schema.default`（`configurations.ts:55-77`）→
用户层 ← `settings.json` → 内存层；合并顺序对齐 `configurationModels.ts:1057-1062`。
本仓库没有 policy / application / workspace / folder 层，也没有语言级覆盖（`[language]` 段），见第 5 节。

迁入的两项设置（本仓库按需登记 —— 权威把整个 editor 段数百项都登记进来）：

| 设置项                   | 类型    | 默认值 | 权威出处                                        |
| ------------------------ | ------- | ------ | ----------------------------------------------- |
| `editor.wordWrap`        | string  | `off`  | `editorOptions.ts:6846-6872`（enum off/on/wordWrapColumn/bounded） |
| `editor.minimap.enabled` | boolean | `true` | `editorOptions.ts:3478`、`:3495-3499`           |

两条开关的**状态源不同**（这是本小节的核心，也是「两个菜单里状态不一致」那类问题的正解）：

| 命令                            | 状态源                                                                  | 是否持久化 | 权威                        |
| ------------------------------- | ----------------------------------------------------------------------- | ---------- | --------------------------- |
| `editor.action.toggleMinimap`   | 配置项 `editor.minimap.enabled`；菜单 `toggled` 取 `config.editor.minimap.enabled == true` | 是（进设置） | `toggleMinimap.ts:26`、`:35-39` |
| `editor.action.toggleWordWrap`  | 上下文键 `editorWordWrap`（由活动编辑器**实际**是否换行求出）+ `canToggleWordWrap` | 否（按模型临时覆盖） | `toggleWordWrap.ts:32`、`:294-305`、`:354-356` |

自动换行的「按模型临时覆盖」语义（`wordWrapState.js` 逐条对齐）：

1. 切换结果不写配置，而是给**当前模型**记一份覆盖状态 `{ wordWrapOverride: 'on' | 'off' }`
   （`toggleWordWrap.ts:44-54`、`:78-99`）；本仓库用 `WeakMap` 以模型对象为键（`:30`），模型销毁即消失；
2. 覆盖落到编辑器的是 `wordWrapOverride2`，优先级 `wordWrapOverride2 > wordWrapOverride1 > wordWrap`
   （`editorOptions.ts:1204-1206` = `:2922-2924`）；清除覆盖写 `'inherit'`，回到设置值
   （`toggleWordWrap.ts:171-177`、`wordWrapState.js:51-55`）；
3. 已有覆盖时再切一次是**清除**（不是取反），因此 `'inherit'` 是回不到「上一次的覆盖值」的；
4. 标签栏的两条条目按 `isDominatedByLongLines` / `isWordWrapMinified` 出现，两条标题不同
   （「为此文件禁用换行」/「为此文件启用换行」）、**都不带 toggled**，用裸 `appendMenuItem` 手写
   （`toggleWordWrap.ts:320-345`、`wordWrap.contribution.js:61-73`）；
5. 该命令**不出现在命令面板**：权威的 `ToggleWordWrapAction` 是 `EditorAction` 且没有声明
   `MenuId.CommandPalette` 的 `menuOpts`（`editorExtensions.ts:100-135` 只在声明了 `menuOpts` 时注册菜单项），
   故本仓库 `f1: false`（`wordWrap.contribution.js:39`）。

`config.*` 上下文键派生（`configAwareContextValues.js`，对齐 `contextKeyService.ts:104-176`）：

- 取值：`config.<settingId>` 直接读配置；编码为 number / boolean / string 原样、数组 `JSON.stringify`、
  其余原样（`:150-176`）；读到的值进缓存，再次求值不回读配置；
- 失效：只处理 `event.affectedKeys`；`ConfigurationTarget.DEFAULT` 清空整表并对**全部已缓存键**发通知（`:123-128`）；
  其余目标对 `config.<key>` 失效「**该键及其后代**」中**已缓存**的键并只对这些键发通知（`:134-144`）——
  未缓存的键下次取值时自然回读，不发多余通知；
- 接线：`ContextKeyService.get()` 先查自身键值表再落到容器（`contextKey.js:71-74`，等价权威的
  子容器遮蔽父容器），容器失效时按变更键逐个 `_notify`（`contextKey.js:57-62`、`:81-83`），
  菜单（`MenuDropdown.vue:18`、`MenuToolbar.vue:25`）据此重新解析。

触发源穷举（AGENTS.md §4.4，权威 `grep -n "onDid[A-Z]\|addEventListener\|onDidChangeConfiguration\|observe("` 于上述四个权威文件）：

| 权威触发源                                                                                          | 结论                                                                                                                       |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `toggleWordWrap.ts:116-131` `editor.onDidChangeConfiguration`（`wrappingInfo` 变化）                 | 已迁移：`EditorPart.vue:75-81`（刷新 `isWordWrapMinified`/`isDominatedByLongLines` 等键；非自触发时重新施加覆盖）           |
| `toggleWordWrap.ts:134` `editor.onDidChangeModel`                                                    | 已迁移：`EditorPart.vue:83-90`（施加该模型的覆盖 + 刷新上下文键）                                                            |
| `toggleWordWrap.ts:138` `codeEditorService.onDidChangeTransientModelProperty`                        | 已迁移（等价实现）：本仓库没有该服务，切换是唯一写入方，故 `wordWrap.contribution.js:52-53` 由命令直接驱动「应用 + 刷新」     |
| `toggleWordWrap.ts:245-249` window `focus` / `blur`（capture）                                       | 已迁移：`EditorPart.vue:93-100`                                                                                            |
| `toggleWordWrap.ts:254` `editorService.onDidActiveEditorChange` → `_updateActiveEditorPane`          | 已迁移（退化）：本仓库只有一个编辑器组/部件，等价于部件自身的 `onDidChangeModel`（`EditorPart.vue:83`）                      |
| `toggleWordWrap.ts:260` `activeEditorPane.onDidChangeControl` → `_update`                            | 不适用：本仓库只有一个 Monaco 部件，不存在「编辑器控件被替换」的情形                                                        |
| `toggleMinimap.ts:35-39` 命令 `run` 里 `configurationService.updateValue`                            | 已迁移：`minimap.contribution.js:38-42`；设置落地到部件见 `EditorPart.vue:105-114`                                          |
| `contextKeyService.ts:121-148` `configurationService.onDidChangeConfiguration` → 失效 + 通知         | 已迁移：`configAwareContextValues.js:28`、`:32-63`（由 `check:configuration` 的失效/通知断言固定）                          |
| `configurationService.ts:1117-1125` 只在有键变化时发事件（source = USER）                            | 已迁移：`configurationService.js:109-113`                                                                                  |
| `configurationService.ts:1041` 写完立刻写 settings.json                                              | 已登记偏差：本仓库的存储是攒批落盘，写入后立刻 `flush()` 一次（`configurationService.js:106-107`）                            |

收尾自查 —— 「什么变化会让这些开关更新？」：

- 缩略图开关被点击 → `minimap.contribution.js:39-41` 写配置 → `configurationService.js:103-113` 重建用户层并发事件 →
  （a）`config.*` 缓存失效并通知（`configAwareContextValues.js:32-63`）→ 菜单重新解析勾选态；
  （b）`EditorPart.vue:105-107` 把 `minimap.enabled` 落到部件 → 缩略图显隐即时变化；
- 自动换行开关被点击（菜单 / Alt+Z 之外的路径）→ `wordWrap.contribution.js:47-55` 写模型临时状态 →
  `wordWrapState.js:58-70` 施加 `wordWrapOverride2` → `EditorPart.vue:75-81` 的 `wrappingInfo` 变化 →
  刷新 `editorWordWrap` 等键 → 菜单勾选态与标签栏两条条目随之更新；
- 切换标签（模型变了）→ `EditorPart.vue:83-90`：施加新模型的覆盖（没有覆盖则回到 `editor.wordWrap`）并刷新上下文键；
- 窗口失焦/获焦 → `EditorPart.vue:93-100`：重算 `canToggleWordWrap` / `editorWordWrap`
  （对应权威 tracker 的 focus/blur，:245-249）；
- 设置被外部改写（本仓库暂无设置编辑器，由 `settings.json` 恢复路径触发）→
  `EditorPart.vue:105-114` 落 `editor.wordWrap` / `editor.minimap.enabled` 到部件，
  有覆盖的模型由 `wrappingInfo` 监听重新施加覆盖。

验证（AGENTS.md §5 允许的手段）：`npm run check:configuration`（56 项：默认层与用户层取值、`inspect` 各层、
`config.*` 的取值编码与缓存、失效/通知的段边界与「只通知已缓存键」、等于默认值即删除、刷新往返、
落盘键名与 `StorageTarget.USER` 目标标记、`canToggleWordWrap` 与四个上下文键、按模型隔离的临时覆盖、
以及「源码里不再出现 wordWrapOn/minimapOn」「and/or/not 的实参必须是表达式」等静态不变量）；
`npm run check:menu-toggle`（11 项，含 wordWrap 在标签栏两条权威裸条目的白名单断言）；
`npm run build` 通过。

### 4.15 编辑器语法着色（token 颜色 = 主题链的 tokenColors）

来源：`extensions/theme-defaults/themes/` 的 include 链（`2026-dark.json` → `dark_modern.json` → `dark_plus.json` → `dark_vs.json`）
的 `tokenColors`，组装语义见 `src/vs/workbench/services/themes/common/colorThemeData.ts:103-152`（默认规则只取
`editor.foreground` / `editor.background` 那一条，其余空 `scope` 条目一律忽略）与 `:782-787`（被包含主题的规则排在前）。

**为什么本仓库要在代码里存一份**：VS Code 从主题扩展的 JSON 读 `tokenColors`，而 npm 的 `monaco-editor` 发行包只内置旧版
`vs` / `vs-dark` 规则（`editor/standalone/common/themes.js` 的 `vs_dark`），没有这条链的等价物。`PVF_DARK_THEME` 以
`vs-dark` 为 `base` 且 `inherit: true`，monaco 会把内置规则排在前面（`standaloneThemeService.js:118-147` 的
`get tokenTheme()`：先取 `getBuiltinRules(base)`（`:173-181`），再补 `editor.foreground` / `editor.background` 那条默认规则，
最后接主题自己的 `rules`）—— 不显式补全，语法颜色就会静默停留在 Dark+（关键字蓝 `#569cd6`、函数与变量没有颜色标记）。

```
规则来源  src/monaco/themeTokens.js（由 scripts/check-syntax-colors.mjs --write 生成，禁止手改）
          展开数：dark_vs 50 条 → 85；dark_plus 15 条 → 84；dark_modern 0 条 → 0；2026-dark 53 条 → 91
                 合计 260 条，顺序即优先级（同一 token 后者覆盖前者）
          + 尾部 41 条覆盖：内置 vs_dark 有、主题链没有的 token（`delimiter`、`tag`、`number`、`variable.parameter`…），
            取值 = 主题链对这些 token 的实际解析结果（多数是主题链的交付色 `editor.foreground` #BBBEBF）
          + 产品覆盖 4 条（本仓库产品决定，见第 5 节）：NUT 字符串 2 条 #CE9178；
            注释 2 条 #6A9955（`comment.pvf` / `comment.squirrel`，2026-dark 的 comment 是灰 #8B949E）
主题定义  src/monaco/theme.js 的 PVF_DARK_THEME = { base: "vs-dark", inherit: true, rules, colors }
          colors 13 项逐条对照 2026-dark.json（editor.background #121314、editor.foreground #BBBEBF、
          editorLineNumber.foreground #858889、editor.selectionBackground #276782dd 等，含八位 alpha）
解析语义  monaco 的 ThemeTrieElement（tokenization.js）：按点号逐段下行、取**最深命中**的节点；
          同一 token 的规则按插入顺序覆盖（`insert` → `acceptOverwrite` 只覆盖非 NotSet 的字段）；
          `fontStyle: ""` 在 parseTokenTheme 里等于 FontStyle.None（显式清除）
```

Dark 2026 链下 .nut / PVF 文本的实际取值（`scripts/check-syntax-colors.mjs` 逐条钉住）：

| 词 / 位置            | 作用域（token 名）                    | 取值        |
| -------------------- | ------------------------------------- | ----------- |
| `if` `else` `for` `while` `switch` `try` `break` `continue` `return` `resume` `yield` 等 | `keyword.control.*` | `#C586C0` 粉 |
| `function` `constructor` `local` `const` | `keyword.control`（见第 5 节该条）  | `#C586C0` 粉 |
| `class` `enum`       | `storage.type.class` / `.enum`        | `#FF7B72`   |
| `static`             | `storage.modifier`                    | `#569CD6`   |
| `in` `instanceof` `typeof` `delete` `extends` `clone` | `keyword.operator.expression.*` | `#569CD6` |
| 被调用 / 定义的函数名 | `support.function`                    | `#DCDCAA` 淡黄 |
| 全局变量（函数体外） | `variable`                            | `#FFA657`   |
| 形参、函数体内局部量 | `variable.parameter.function` / `variable.other.readwrite` | `#C9D1D9` |
| 全大写常量名         | `variable.other.constant`             | `#79C0FF`   |
| 字符串（NUT / Squirrel） | `string.quoted.double` / `.single`（token 名带 `.squirrel` 段） | `#CE9178` —— **不取主题链**，Dark Modern / Dark+ 的 `string` 色，本仓库的语言级覆盖（见第 5 节） |
| 字符串（其它语言，如 JS） | `string.quoted.double.js` 等          | `#A5D6FF`（2026-dark 的 `string`，= 编辑器里的 `mtk18`） |
| 注释（PVF 文本 / NUT） | `comment.pvf` / `comment.squirrel`   | `#6A9955` —— **不取主题链**，Dark Modern / Dark+ 的 `comment` 色（VS Code 经典注释绿），本仓库的语言级覆盖（见第 5 节） |
| 注释（其它语言，如 JS / Markdown） | `comment.js`、`punctuation.definition.comment.*` | `#8B949E`（2026-dark 的 `comment`） |
| 数字 / 转义          | `constant.numeric` / `constant.character.escape` | `#B5CEA8` / `#D7BA7D` |

两种**行注释**（`// xxx` 与 `#PVF_File` 这类 `#` 开头的行）在编辑器里的落点，三处解析者必须一致：

```
PVF 文本（.lst / .dat / .str / .aic / .ani / .etc / .stk）——
  词法   src/extensions/pvf/browser/pvfText.js 的 root：[ /#.*$/, "comment" ] 与 [ /\/\/.*$/, "comment" ]
  写回   src/utils/pvfTool.js 的 encodeTokenText（token 起始位置的 `#` / `//` 跳到行尾）
         src/utils/pvfToolTw.js 的 encodeTwToken（TW 归档同一条规则）
  校验   src/utils/pvfValidator.js 的 validatePvfText（同样在 token 起始位置 break 掉本行）
NUT（Squirrel）——
  词法   src/extensions/pvf/browser/squirrel.js 的 whitespace 状态：`//`、`/* */`（Squirrel 规范）+
         `#`（PVF 明文导出的需要，见第 5 节）；token 名 → comment.squirrel
  符号   src/extensions/pvf/browser/squirrelSymbols.js 的 stripLiterals 按这两种行注释截断
         （注释里的大括号不计入块范围配平，注释行也不产生符号；断言在 check:outline 的 4b 节）
  说明   规范外的 `#` 规则只为 `#PVF_File` 这类导出头存在；`.nut` 明文导出走
         pvfToolTw.js:1414-1416 的原样写回，不经 token 编码，因此不存在「显示为注释、写回成数据」的问题
```

`a//b` 这类「token 中间的 `//`」不是注释：PVF 文本的裸串规则把它整体吃掉（与 `encodeTokenText` 的裸串
读取一致）；Squirrel 侧不要求前置空白，`a//b` 就是注释（与 JS / Squirrel 的真实语义一致）。两条都有断言钉住。

`a#b` 这类「紧贴前一个 token 的 `#`」两侧**不一致，且不打算对齐**：词法把 `#b` 当注释（`#` 不在裸串字符集里，
Monarch 逐段前进必然在 `#` 处重新匹配规则），写回端把 `a#b` 当一个 token。对齐需要把 `#` 从裸串字符集里
去掉或加进停用集，那会让「原本是一个 token 的数据」在保存时被拆掉（数据保全优先于显示一致）；差异只出现在
真实 PVF 数据里不存在的位置（token 之间恒有空白或反引号包裹）。

触发源（门控 §4.4 —— 「这个部件的什么变化会让它更新？」）：

- **运行期没有触发源**：主题在 `src/monaco/setup.js` 启动时 `defineTheme("pvf-dark", PVF_DARK_THEME)` 注册一次，
  全应用不存在切换主题的入口，因此下列 monaco 内部链路在本仓库不会被触发（结论：不适用）：
  `standaloneThemeService.setTheme` → `_updateThemeOrColorMap`（`:320-350`）→ `TokenizationRegistry.setColorMap`
  （`editor/common/tokenizationRegistry.js:74-80`，发 `changedColorMap: true`）→ `onDidColorThemeChange` →
  `viewModelImpl.js:94-97`（`ViewThemeChangedEvent`）、`minimapTokensColorTracker.js:25`、`decorationsOverviewRuler.js:182`；
  权威同一条链见 `src/vs/editor/common/viewModel/viewModelImpl.ts:165`。
- **唯一的更新路径是构建期**：改 `scripts/check-syntax-colors.mjs` 的语料/断言、`PRODUCT_OVERRIDE_RULES`
  （NUT 字符串与注释的覆盖取值，见 `NUT_STRING_RULES` / `COMMENT_RULES`）或主题链版本后，
  `npm run check:syntax-colors -- --write` 重新生成 `src/monaco/themeTokens.js` → 重新构建。
- 语法侧的变化（改词法规则）由 `squirrel.js` 的 `tokenPostfix: ".squirrel"` 决定 token 名，与主题规则解耦。

验证（AGENTS.md §5 允许的手段）：`npm run check:syntax-colors`
（A 段：参考仓库在时重新展开主题链，与 `themeTokens.js` 逐条比对，并可 `--write` 重新生成；
B 段：`base` / `inherit` / `rules` / `colors` 出处；C 段：用 monaco 真实 tokenizer 跑语料，**逐个 token** 断言
`PVF_DARK_THEME` 与主题链的解析结果完全一致（含字形样式；`PRODUCT_OVERRIDE_RULES` 里的 4 个 token
—— NUT 字符串 2 个 + 注释 2 个 —— 属显式覆盖，不在此列，改为断言「没有泄漏到其它语言」）；
D 段：用户可见取值，含
「`function` / `local` 与 `return` 严格同色」「全局变量与函数体内变量不同色」
「NUT 字符串 `#CE9178` 而其它语言的字符串仍是 `#A5D6FF`」
「PVF / NUT 的注释是 `#6A9955` 而其它语言的注释仍是 `#8B949E`」
「四种行注释写法（`//`、`#PVF_File` × 两种语言）都命中各自的 comment token」，并有
「`a//b` 在 PVF 文本里不是注释、在 Squirrel 里是注释」两条边界断言；
E 段：31 个保留字 + 3 个字面量 + 2 个编译期常量逐个落到具体作用域；F 段：静态断言）。
另有 `npm run check:token-comments`：写回两端（`encodeTokenText` / `encodeTwToken`）与 `validatePvfText`
的同规则断言 —— 注释整行 / 行尾都被跳过、token 内部的 `//` 与 `#` 仍是数据（不丢数据）、
正常 token 的编码不受影响。
`npm run build` 通过。

## 5. 已自查记录的偏差（需要时按上表补齐）

| 偏差                                                                     | 现状                                                                                                                                                                                                                                                                                                                                         | 权威行为                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 工具栏溢出判定                                                           | 用 `maxItems` 条数上限（`EditorTabs` 传 9、`PanelPart` 传 64）                                                                                                                                                                                                                                                                               | 按容器宽度响应式（`toolbar.ts` + `ResizeObserver`）                                                                                                                                                                                                                                                                                                             |
| 溢出菜单开关时机                                                         | 在按钮 click 上切换                                                                                                                                                                                                                                                                                                                          | 在 label 的 MOUSE_DOWN 上切换（`dropdown.ts`）                                                                                                                                                                                                                                                                                                                  |
| 子菜单垂直定位                                                           | 顶边对齐条目 + 水平翻转 + 垂直视口收敛，未复刻 `calculateSubmenuMenuLayout` 的全部垂直翻转分支（超高子菜单向上展开等）                                                                                                                                                                                                                       | `menu.ts:calculateSubmenuMenuLayout`                                                                                                                                                                                                                                                                                                                            |
| 空子菜单                                                                 | 解析出 0 条时不展开、无提示                                                                                                                                                                                                                                                                                                                  | 渲染禁用的 `EmptySubmenuAction`（label「(empty)」，`base/common/actions.ts`）                                                                                                                                                                                                                                                                                   |
| 工具栏子菜单按钮                                                         | 主区按钮内显示一个 `chevron`，整块可点                                                                                                                                                                                                                                                                                                       | split button：主动作 + 独立的 `chevron-down` 下拉区（`SubmenuEntryActionViewItem`、`dropdown.css` 的 `.monaco-dropdown-with-primary`）                                                                                                                                                                                                                          |
| 主区子菜单锚点                                                           | 锚在工具栏（`.menu-toolbar`）右下角                                                                                                                                                                                                                                                                                                          | 锚在该按钮元素上（`dropdown.ts:getAnchor` 默认 `.monaco-dropdown`）                                                                                                                                                                                                                                                                                             |
| 菜单字形                                                                 | 使用 `check` / `chevron-right`（codicon 子集）                                                                                                                                                                                                                                                                                               | `menu-selection` / `menu-submenu` 在 monaco 中即由这两个字形派生（`codicon.js:18-19`），等价                                                                                                                                                                                                                                                                    |
| `modern-ui` / floating panels                                            | 未实现（固定为 classic 布局）                                                                                                                                                                                                                                                                                                                | `LayoutSettings.MODERN_UI`（默认 false，与当前一致）                                                                                                                                                                                                                                                                                                            |
| 激活标签的淡色底（现代标签样式）                                          | 采用现代标签的激活底色：`EditorTabs.vue` 的 `.tab.active` 取 `--vscode-modernEditorTab-activeBackground`（2026-dark 下 = `listInactiveSelectionBackground` `#2c2d2e`，见 4.12），但**未**采用 `.tab-fill` 元素、现代标签行高 24px、圆角与透明上下描边，布局仍为 classic；也没有 `workbench.experimental.modernUI` 开关（恒为「现代底色 + classic 布局」的混合） | `workbench.experimental.modernUI` 为 false 时激活标签**没有**淡色底（`multieditortabscontrol.css:141-158`，底色取 `tab.activeBackground` = 编辑器底色）；为 true 时 `.modern-ui-tabs` 生效，激活标签由 `.tab-fill` 取 `modernEditorTab.activeBackground`，且行高 24px、圆角 `cornerRadius-small`、上下描边透明（`tabs.css:57-60`、`:103-113`、`:311-316`；`modernUI.contribution.ts:149`） |
| `workbench.shadows` 设置                                                 | 未实现（恒显示阴影）                                                                                                                                                                                                                                                                                                                         | `src/vs/workbench/browser/media/style.css` 的 `.no-shadows`                                                                                                                                                                                                                                                                                                     |
| 「终端」菜单的内容                                                       | 按产品要求作为底部面板控制入口：`切换面板`（`workbench.action.togglePanel`，Ctrl+J，`1_layout` 组）+ `切换终端`（`workbench.action.terminal.toggleTerminal`，Ctrl+`，`3_terminal`组）。两项在顶部菜单栏**只挂「终端」**（曾同时挂`MenubarViewMenu`，已按「顶部菜单栏同一功能不得跨菜单重复」移除）；`切换面板`另保留`LayoutControlMenu` 落点 | `menubar.contribution.ts` 只贡献顶级项 title/order=7；菜单内容由 `terminalMenus.ts`（New Terminal / Split Terminal / Run Active File…）与 `task.contribution.ts`（Run Task…）填充，**不含面板显示/隐藏**；`Toggle Panel` 在 VS Code 中挂 `MenuId.MenubarAppearanceMenu`（`2_workbench_layout` order 5）与 `LayoutControlMenuSubmenu`（`panelActions.ts:30-70`） |
| 「切换终端」的勾选态                                                     | **已修正**：不再声明 `toggled`，菜单项为 `role="menuitem"`、无勾选框（只有 `切换面板` 反映 `panelVisible`）。旧实现写成 `and(panelVisible, activePanel==终端)`，条件蕴含 `panelVisible`，导致面板停在终端时两项必然同时打勾                                                                                                                  | `terminal.contribution.ts:124-132` 的 `openCommandActionDescriptor` 经 `viewsService.ts:401-470` 生成动作，**不带 `toggled`**；`OpenCommandActionDescriptor`（`common/views.ts:53-59`）也没有该字段。故 VS Code 中该命令在菜单里没有勾选框                                                                                                                      |
| 侧栏 sash 的 `snap` 收起                                                 | 未实现：向左拖过 170 只钳制在 170（`minimum` 状态、光标换 `e-resize`），不会收起侧栏                                                                                                                                                                                                                                                         | `sidebarPart.ts:52` 的 `snap = true` 经 `grid.ts:714-744` 语义把侧栏拖到最小宽以下即隐藏该 part                                                                                                                                                                                                                                                                 |
| 侧栏隐藏时的 sash                                                        | 无拖拽条：sash 挂在侧栏内部（`Sidebar.vue` 的 `.sidebar-sash`），`sidebarVisible=false` 时 `v-show` 一并隐藏                                                                                                                                                                                                                                 | 上游 sash 属于 grid，是活动栏与编辑器之间的独立节点，侧栏隐藏后仍可向右拖出侧栏                                                                                                                                                                                                                                                                                 |
| sash 双击复位的目标宽                                                    | 复位到 300（`preferredWidth` 的下限常量）                                                                                                                                                                                                                                                                                                    | `getOptimalWidth` 由视图内容实测得出，复位目标是 `max(optimalWidth, 300)`；本仓库无内容实测，取该下限                                                                                                                                                                                                                                                           |
| 面板 sash 的最大高                                                       | 上界 = `window.innerHeight - 64`（本仓库近似，为标题栏+标签栏留位）                                                                                                                                                                                                                                                                          | grid 按容器剩余空间计算，无固定常量                                                                                                                                                                                                                                                                                                                             |
| 侧栏宽度与主题                                                           | 侧栏宽由 `appState.sidebarWidth` 状态驱动（初始 300），不写进主题 CSS                                                                                                                                                                                                                                                                        | 部件尺寸由 grid 布局器设定，主题 JSON 里没有 `sideBar.width` 之类的 token；曾存在的 `--vscode-sideBar-width` 为自造，已删除                                                                                                                                                                                                                                     |
| 容器的菜单勾选态（`资源管理器`/`搜索`/`源代码管理`/`运行和调试`/`扩展`） | 自造 `toggled: and(sidebarVisible, activeViewContainer==<容器 id>)`（`src/workbench/contrib/explorer/explorer.contribution.js:70` 等 5 处），使「视图」菜单能显示活动容器                                                                                                                                                                    | 容器「打开/切换」命令同样由 `registerOpenViewContainerAction` 生成，**无 `toggled`**，VS Code 的「视图」菜单里这些项**没有勾选框**（活动容器由活动栏的指示条表达）。属同类自造状态，待产品决定后统一处理                                                                                                                                                        |
| 容器命令的 `precondition`                                                | 未实现                                                                                                                                                                                                                                                                                                                                       | `viewsService.ts:422` 用 `ContextKeyExpr.has('viewContainer.<id>.enabled')` 做启用判定；本仓库没有该上下文键，故无法复刻（加空键会把菜单项永久隐藏，故暂缺）                                                                                                                                                                                                    |
| 「切换终端」的收起判据                                                   | `appState.panelVisible && activePanelId === 终端`（缺焦点维度）                                                                                                                                                                                                                                                                              | `viewsService.ts:445-449` 为 `isViewContainerVisible(终端) && hasFocus(Parts.PANEL_PART)`。差别：面板可见、停在终端、焦点在编辑器时，VS Code 走「聚焦终端」，本仓库直接收起面板。焦点数据已在 `appState.panelFocused`（`PanelPart.vue:78-84`），只差同步进 `contextKeys` 并用于判据                                                                             |
| 粘性滚动的命令与菜单落点                                                 | 部件本身已按权威默认取值启用（见 4.7），但相关命令未挂进本仓库菜单注册表：外观菜单里没有「切换粘性滚动」，粘性行的右键菜单与键盘命令（聚焦、上下选择、跳到该行）也没有条目。部件渲染不受影响，只缺菜单/命令入口。                                                                                                                            | `stickyScrollActions.ts:22-39`（`editor.action.toggleStickyScroll` → `MenuId.CommandPalette`、`MenuId.MenubarAppearanceMenu` group `4_editor` order 3、`MenuId.StickyScrollContext`）、`:61-141`（`focusStickyScroll` 与 `selectNextStickyScrollLine` / `selectPreviousStickyScrollLine` / `goToFocusedStickyScrollLine` / `selectEditor`）                     |
| 面包屑的 picker（点击条目 → 下拉） | **已迁移**（见 4.8 的触发源表）：文件 picker 与符号 picker 的 DOM、几何取值（宽度 = `min(innerWidth-8, max(240, (innerWidth-8)/4.17))`、`maxHeight = min(innerHeight*0.7, 300)`、箭头 8px 与溢出左移）、竖直翻转、文件图标主题类名、折叠默认值（符号 picker 全折叠 / 文件 picker 全展开）、预览（焦点即预览）、选中跳转（符号 → `reveal` 落 `selectionRange` 起点、文件 → 打开该文件；目录不关闭浮层）、键盘（上下 / Home / End / PageUp / PageDown / 左右展开折叠 / 回车 / 空格 / 输入定位）、失焦与像素比变化关闭、`breadcrumbsActive = DOM 聚焦 ∥ 浮层显示`、ignore-once，均按权威实现。落点：`breadcrumbsControl.js`、`breadcrumbsPicker.js`、`BreadcrumbsPicker.vue` | `breadcrumbsControl.ts:641-760`（打开、几何、onHide）、`breadcrumbsPicker.ts:44-160`（DOM 与 `_layout`）、`:345-440`（文件树）、`:463-517`（符号树）、`contextview.ts:324-366`（`layout2d` 落点）、`listCommands.ts` / `abstractTree.ts` / `listWidget.js`（键盘与鼠标语义） |
| picker 未迁移的次要部分 | 未迁移：① 条目行的 `DomScrollableElement` 横向滚动（本仓库用原生横向滚动条，条目过长时「末段贴住右边缘」的算法未复刻）；② 文件 picker 的 `files.exclude` 过滤器与 `onDidChangeWorkspaceFolders`（本仓库无工作区与 `files.exclude` 消费者）；③ 符号 picker 的问题标记徽标（`_renderMarkerInfo`；本仓库无 marker 服务，`--outline-element-color` 恒未定义）；④ 树的行内拖放（dnd）与 find 过滤控件；⑤ 快捷键的 `weight` 与 `listFocus` 上下文键 —— `*WithPicker`（Ctrl/Alt+左右）与 `revealFocusedFromTreeAside`（Ctrl+Enter）改由浮层自身的 keydown 处理（语义一致、落点不同，见 `breadcrumbs.contribution.js` 的裁剪说明）；⑥ 运行期切换文件图标主题（本仓库只有一个内建 Seti 主题，`fileIconThemeTraits` 在模块加载时算一次） | `base/browser/ui/breadcrumbs/breadcrumbsWidget.ts`（横向滚动的 `DomScrollableElement`，行内滚动容器）、`breadcrumbsPicker.ts:250-320`（`FileFilter` 的 `files.exclude` 与工作区变化订阅）、`documentSymbolsTree.ts:245-290`（marker 徽标）、`abstractTree.ts` 的 dnd 控制器、`breadcrumbsControl.ts:975-1013` 与 `:1058-1078`（两组命令的 `weight` / `listFocus`）、`breadcrumbsPicker.ts:368`（`onDidFileIconThemeChange`） |
| 面包屑的路径与开关设置 | 未登记：`breadcrumbs.filePath`、`breadcrumbs.symbolPath`（`breadcrumbs.configuration.js` 固定按默认值 `'on'` 处理 —— 恒为整条文件路径 + 全部符号段）、`breadcrumbs.symbolPathSeparator`（无 `copyPath` 命令故无消费者）；`breadcrumbs.enabled` / `breadcrumbs.icons` / `breadcrumbs.showEditorType` 同样未登记（面包屑恒显示、图标恒输出、编辑器类型下拉未迁移）；`breadcrumbs.useQuickPick`（默认 false）的分支未迁移 | `breadcrumbs.ts:130-186`（各设置声明）、`breadcrumbs.ts:70`（`useQuickPick`）、`breadcrumbsModel.ts:104-121`（`on` / `off` / `last` 的裁减规则）、`breadcrumbsControl.ts:633-638`（`useQuickPick` 为真时改用快速输入） |
| 面包屑命令的两处未迁移 | ① `breadcrumbs.toggle`（面包屑总开关，配置为 `breadcrumbs.enabled`）未迁移；② `breadcrumbs.copyPath`（命令面板 + 编辑器标题上下文菜单项）未迁移 —— 依赖剪贴板服务与 `symbolPathSeparator`。其余 8 条（`focusAndSelect` / `focus` / `focusNext` / `focusPrevious` / `selectFocused` / `revealFocused` / `selectEditor` 等）已按权威迁移（`breadcrumbs.contribution.js`） | `breadcrumbsControl.ts:832-878`（`breadcrumbs.toggle`）、`:1101-1140`（`breadcrumbs.copyPath`：`MenuId.EditorTitleContext` 的 `1_cutcopypaste` 组、order 100、`f1: true`） |
| 面包屑不随滚动更新（非偏差）                                             | 符号段在四类事件后重算：切换 / 打开编辑器（立即）、语言变化（立即）、模型内容变化（350ms 防抖）、光标位置变化（150ms 防抖），落点见 `EditorBreadcrumbs.vue` 的四个 `watch`；滚动时保持不动，与权威相同。曾把「向下滚动时要匹配当前函数」当作面包屑的缺陷，权威的做法是由粘性滚动承担滚动时的作用域显示（见 4.7）。内容变化一项曾缺失（编辑后符号段不更新），已按 `documentSymbolsOutline.ts:198-204` 补齐。 | `documentSymbolsOutline.ts:192/193/198-204/364-371` 四类订阅；该文件没有任何滚动订阅（`:330-362` 的配置刷新同样不含滚动）                                                                                                                                                                                                                                       |
| 命令中心的「快速打开」                                                   | **已实现**：点击圆角框执行 `workbench.action.quickOpenWithModes` → `showQuickAccess(undefined, { preserveValue, providerOptions: { includeHelp, from: 'commandCenter' } })`，弹出快速输入浮层（`Ctrl+P` / `Ctrl+Shift+P` / `F1` 同一实现，见 4.10）。浮层可见时命令中心加 `.hide`（`commandCenterControl.ts:64-82`）。曾为占位实现（只改状态栏文本），已修复。                                                                                                            | `commandCenterControl.ts:109`、`:160-210` 的视图项点击后走 `workbench.action.quickOpenWithModes`（`quickAccessActions.ts:156-185`）→ `IQuickInputService.quickAccess.show()`，弹出 quick pick 浮层                                                                                                                                                              |
| 命令行 / 快速输入的匹配与排序                                            | 简化：标签按「每词子序列命中」计分（连续命中加权）、命令 id 全等命中；排序为最近使用 → 标签字典序；标签重复时以命令 id 作 description；分隔线按「首项在历史中才插『最近使用』」就地插入。**未实现** TF-IDF「相似命令」、`suggestedCommandIds` 的「常用命令」分组、`commandAlias` 别名匹配与高亮片段（`highlights`）。                                                                                        | `commandsQuickAccess.ts:91-150`（`WORD_FILTER` 模糊高亮 + 命令 id 全等 + `filter.length >= 3` 时 TF-IDF，阈值 `TFIDF_THRESHOLD`、上限 `TFIDF_MAX_RESULTS`）、`:151-209`（排序含 tf-idf 与 SuggestedCommandIds 分支）、`:213-248`（三类分隔线）                                                                                                                    |
| 命令历史（最近使用）                                                     | 仅本次会话内存（模块级数组，接受命令时前插）；无持久化、无「最近使用」条目的「移除」按钮与「配置快捷键」齿轮按钮（浮层尚无条目按钮支持）。                                                                                                                                                                                                    | `commandsQuickAccess.ts:385-500`：`CommandsHistory` 经 `IStorageService` 存 `PROFILE` 作用域（`PREF_KEY_CACHE` / `PREF_KEY_COUNTER`），长度由 `workbench.commandPalette.history` 控制；`:285-293` 给历史项追加 `Codicon.close` 按钮                                                                                                                                  |
| quick access 前缀                                                        | 只实现 `''`（文件）与 `>`（命令）两个提供者；`@`（编辑器符号）、`:`（跳转到行）、`#`（工作区符号）未迁移 —— 输入这些前缀会退回默认提供者并按字面搜索文件名，与权威的分派行为不同。                                                                                                                                                              | `workbench/browser/quickaccess.ts` 的 `registerQuickAccessProvider`：`@` → `GotoSymbolQuickAccessProvider`、`:` → `GotoLineQuickAccessProvider`、`#` → `GotoSymbolQuickAccessProvider(WORKSPACE)`；`anythingQuickAccess.ts:284-348` 还会在 `@` 存在时把符号结果并入默认列表 |
| 文件提供者的取数来源                                                     | 已打开的编辑器 + 内建文件（`@/builtInFiles.js`：`src/samples/*` 全量构建期内联 + 欢迎页），同步返回。样本清单用 `import.meta.glob("@/samples/*", '?raw')` 在构建期展开，新增样本文件无需改代码即出现在「内置文件」分组。**未实现**工作区文件索引与按名称搜索、`FastAndSlowPicks` 的异步补充结果、`file:line:column` 范围语法、`@` 符号并入、`~` / 绝对路径等 `extractRangeFromFilter` 语法。                                                                                                          | `anythingQuickAccess.ts:284-360`（范围语法与 `@` 合并）、`fileQueryBuilder.ts`（TF-IDF + `IRemoteFileSystemService` 的快速/慢速两段结果）、`:1002-1060`（已打开编辑器与文件结果的合并顺序）                                                                                                      |
| TW 字符串表样本无语言                                                     | `@/samples/stringtable.bin` 按纯文本打开（扩展名 `.bin` 不挂任何语言）—— 它是 TW 归档专用的字符串表可读视图（`索引>文本`），不由 `CONTENT_DECODERS` 产生，本仓库也没有对应语言；其余样本（`.nut`/`.lst`/`.stk`）都有语言与词法。                                                                                                                                                                                            | 无对应实现（`stringtable.bin` 的 `索引>文本` 视图是本项目自有领域的展示形态，VS Code 侧无同类概念；PVF 域按 `pvfToolTw.js:413-424` 生成该视图）                                                                                                                                                                                                                |
| 快速输入部件的未迁移部分                                                 | 未渲染 / 未实现：`.quick-input-titlebar`（标题与左右动作条）、`.quick-input-description`、`.quick-input-visible-count`（读屏用可见条数）、OK / Custom 按钮、进度条（`busy` 只存状态未渲染）、多选（`canSelectMany` 与条目复选框）、quick tree、锚点定位（`controller.anchor` / `anchorPosition: 'overlay'`）、`Ctrl+数字` 快速跳转、`Tab` 把焦点移到列表、`quickNavigate` 模式。浮层尺寸取窗口尺寸而非 `activeContainerDimension`（本仓库工作台铺满窗口，两者等价）。 | `quickInputController.ts:164-254`（标题栏、按钮、进度条）、`:960-995`（锚点定位分支）、`quickInputList.ts`（复选框与树）、`quickInputActions.ts:102-125`（`quickNavigate` 与 `quickInput.*` 命令全集）、`quickInput.ts`（`canSelectMany` / `busy` / `quickNavigate`）                                                                |
| 命令面板的菜单落点                                                       | 只挂「视图」菜单首组首项「命令面板…」（`MenuId.MenubarViewMenu` / group `1_open` / order 1，`menu/quickInput.contribution.js` 用 `appendMenuItem` 单独声明菜单项标题，因为 `registerAction2` 的 menu 描述符恒取动作标题）。权威另有三处：`MenubarHelpMenu`（`1_welcome` order 2「显示所有命令」）、`GlobalActivity`（`1_command` order 1）、`EditorContext`（`z_commands` order 1，`when: editorSimpleInput` 取反）。前一处的省略依据门控 §4.1 第 7 条「顶部菜单栏同一命令只挂一处」；后两处在本仓库没有宿主（`menuId.js:33` 声明了 `EditorContext` 但无渲染方，活动栏「…」未迁移）。 | `quickAccess.contribution.ts:55-62`（视图菜单）、`:64-71`（帮助菜单）、`:91-98`（`GlobalActivity`）、`:100-108`（`EditorContext`）                                                                                                                                                                                                                              |
| 快捷键的平台维度                                                         | 只按 `ctrlKey` / `shiftKey` / `altKey` 组键（`keybindingService.js:41-48`），没有 Cmd（`metaKey`）与 VS Code 的 `secondary` / `mac` / `win` / `linux` 覆盖字段；`workbench.action.quickOpen` 因此把 `Ctrl+E` 登记成第二条规则，而 mac 的 `Cmd+P`（无 secondary）无法表达。                                                                                                                                                     | `quickAccessActions.ts:25-29` 的 `globalQuickAccessKeybinding`（primary Ctrl/Cmd+P、secondary Ctrl/Cmd+E、`mac` 覆盖）；`platform/keybinding/common/keybindingsRegistry.ts` 按 `IsMac` / `IsWindows` / `IsLinux` 上下文键解析平台变体                                                                                                                            |
| 「视图」菜单的分组                                                       | 把权威的「外观」子菜单（`MenubarAppearanceMenu`）中的项平铺进视图菜单，组名用 `1_layout`；缩放三项（`editor.action.fontZoom*`）用自造组名 `2_zoom`（权威的 fontZoom 动作没有菜单落点）。组名按字典序排序，于是权威排在视图菜单首组的 `1_open`（命令面板…）在本仓库排在这些项之后。                                                                                                                                            | `layoutActions.ts:278`（组 `2_appearance` + `MenubarAppearanceMenu` 子菜单）、`editor.contribution.ts:801-808`（同组 order 2）；`quickAccess.contribution.ts:55-62` 的 `1_open` 是视图菜单首组                                                                                                                                                                      |
| 面包屑「内容变化」的防抖值                                               | 固定 350ms（`EditorBreadcrumbs.vue` 的 `SYMBOL_CONTENT_DEBOUNCE`）。                                                                                                                                                                                                                                                                          | `documentSymbolsOutline.ts:199-203` 取 `_outlineModelService.getDebounceValue(model)`，即该 provider 的实测耗时（monaco 发行包 `outlineModel.js:205` 的 `{ min: 350 }` 是它的下限）；该 API 未从 monaco 发行包导出，故取该下限                                                                                                                               |
| 面包屑符号段的初始态                                                     | 光标被用户移动过之前，符号段恒显示「outline 自身」条目（`…`），即「默认未选中任何符号」；光标一旦移动（`onDidChangeCursorPosition` 触发，`setModel` 不发该事件）即按当前光标取链。动机：全局变量符号（`X <- 值`，range 为声明行自身）会包含初始光标 (1,1)，若按权威「打开即按当前光标计算」，打开样本就显示 `DEBUG` 段，与「默认未选中」的交互预期相悖。 | 权威打开编辑器即按当前光标计算符号链（`documentSymbolsOutline.ts` 的 `_setOutlineModel` → `breadcrumbsDataSource.update(model, position)`），光标落在符号声明行时首段就显示该符号，无「初始未选中」概念                                                                                                                                                         |
| 命令中心的后退/前进与分享按钮                                            | 未迁移：`MenuId.CommandCenter` 的 actions-container 里只有中心项，没有后退 / 前进（`workbench.action.navigateBack` / `navigateForward`）与分享按钮（前者依赖本仓库没有的 `IHistoryService` 导航历史，后者依赖分享贡献点）。因此中心框命中 `:only-child` 规则（`margin-left: 0`），左侧不留 6px。                                             | `editorActions.ts:1487`、`:1522` 把后退/前进挂到 `MenuId.CommandCenter`（order 1 / 2，when `config.workbench.navigationControl.enabled`，默认 true）；`share/share.contribution.ts:101` 挂分享（order 3）。有它们时中心框不再是 `:only-child`，左外边距为 6px                                                                                                   |
| 命令中心的开关命令                                                       | 未迁移：`appState.commandCenter` 恒为 true（命令中心恒可见、不可关）。本仓库没有标题栏右键菜单 —— `MenuId.TitleBarContext` 在 `menuId.js:48` 声明但无宿主，`MenuId.TitleBarTitleContext` 未声明；布局控制菜单里也没有该项（权威同样不放这里）。                                                                                              | `titlebarActions.ts:41-64` 的 `ToggleCommandCenter`（id `toggle.window.commandCenter`，`toggled: ContextKeyExpr.equals('config.window.commandCenter', true)`）挂在 `MenuId.TitleBarContext` 与 `MenuId.TitleBarTitleContext` 的 `2_config` 组                                                                                                                   |
| 命令中心外层工具栏的子菜单项                                             | 未渲染：`MenuId.CommandCenter` 里除中心项外的动作只走普通动作项（`ActionView`），子菜单项会被跳过。当前注册表只有中心项，无实际影响。                                                                                                                                                                                                        | `commandCenterControl.ts:58-60` 对非中心动作走 `createActionViewItem`，子菜单项渲染成 `SubmenuEntryActionViewItem`（split button + 下拉）                                                                                                                                                                                                                       |
| 悬浮提示（全局）                                                         | 用原生 `title` 属性（`ActionView.vue`，以及命令中心快捷项的 `title` + `aria-description`），没有延迟、富文本与自定位能力。                                                                                                                                                                                                                   | `IHoverService.setupManagedHover` + `hoverDelegate`（命令中心见 `commandCenterControl.ts:118`、`:164`、`:195`）渲染自定义 hover 部件；`aria-description` 一项本仓库与权威相同                                                                                                                                                                                   |
| 「切换自动换行」「切换缩略图」的勾选态来源                               | **已实现**（见 4.14）：缩略图取配置项 `editor.minimap.enabled`（菜单 `toggled` 为 `config.editor.minimap.enabled == true`，`minimap.contribution.js:25`）；自动换行取 `editorWordWrap` + `precondition: canToggleWordWrap`（`wordWrap.contribution.js:36-37`），状态按模型临时存放（`wordWrapState.js:30`）。自造的 `wordWrapOn` / `minimapOn` 已删除，`appState.js` 不再有这两个字段。                                                        | 缩略图：`toggleMinimap.ts:26` 用 `ContextKeyExpr.equals('config.editor.minimap.enabled', true)`；`config.*` 前缀的上下文键由 `platform/contextkey/browser/contextKeyService.ts:105-175` 的 `ConfigAwareContextValuesContainer` 从 `IConfigurationService` 派生（`getValue('config.<settingId>')` 直接读配置值，`onDidChangeConfiguration` 时失效缓存并 fire 变更），动作 `run` 里改的也是配置项（`toggleMinimap.ts:38-39` 的 `configurationService.updateValue`），勾选态即配置值本身。自动换行：`toggleWordWrap.ts:32` 的 `EDITOR_WORD_WRAP = new RawContextKey('editorWordWrap', false)`，由编辑器贡献 `ToggleWordWrapController`（`:260` 的 `bindTo`）按编辑器实际选项写入，菜单侧 `:354` 取 `toggled: EDITOR_WORD_WRAP`、`:356` 另加 `precondition: CAN_TOGGLE_WORD_WRAP`；因存在「临时按模型覆盖」的语义，权威此处同样用专用上下文键而非 `config.*` |
| 「切换自动换行」「切换缩略图」的菜单落点                                 | 自动换行：视图菜单 `6_editor` / order 1（权威落点）+ 标题栏布局控制菜单 `1_layout`（本仓库保留）+ 标签栏 `navigation` 组两条按需条目（权威落点，`wordWrap.contribution.js:34-42`、`:61-73`）；缩略图：视图菜单 `1_layout` / order 3 + 布局控制菜单 + 标签栏 `9_other` 组三项均由动作自身声明（`minimap.contribution.js:26-30`）。自动换行已从标签栏「…」溢出菜单移出（改为按需出现在工具栏主区）                                                                        | 权威的 `MenuId.LayoutControlMenu` 只放布局开关与「自定义布局…」：`layoutActions.ts:355,374`（侧栏/面板/活动栏/辅助栏/状态栏/全屏/禅模式，并带 `config.workbench.layoutControl.type` 的 when）、`panelActions.ts:322`、`layoutActions.ts:1439-1456`（`workbench.action.customizeLayout`）。`toggleMinimap` 只挂 `MenuId.MenubarAppearanceMenu`（`toggleMinimap.ts:27-31`，group `4_editor`、order 1）；`toggleWordWrap` 挂 `MenuId.MenubarViewMenu` 的 `6_editor` 组（`toggleWordWrap.ts:350-359`）与 `MenuId.EditorTitle`（`:320,333`），两者都不在 LayoutControlMenu |
| 用户设置的落点                                                             | 经存储服务写 `settings.json` 这个键（`configurationService.js:106-107`）：PROFILE 作用域、`StorageTarget.USER`，与布局状态共用 `vscode-web-state-db-global` 文档。                                                                                                       | 写在档案目录里的 `settings.json` 文件（`platform/userDataProfile/common/userDataProfile.ts:197`），由 `ConfigurationEditing` 落盘（`configurationService.ts:1041`）                                                                                                                          |
| 配置层次                                                                   | 只有「默认 → 用户 → 内存」三层（`configuration.js:284-335`），且运行期不使用内存层；`updateValue` 只支持 `ConfigurationTarget.USER`，其他目标抛错（`configurationService.js:91-93`）。                                                                                       | `default → policy → application → user → workspace → folder → memory` 七层（`configurationModels.ts:1057-1062`），并按 profile 细分 application/user；`updateValue` 支持全部目标（`configurationService.ts:343-368`）                                                                        |
| 无语言/资源级设置覆盖                                                      | 未实现：`[language]` / `[file]` 覆盖段与 `overrideIdentifier` 均未迁入（`configuration.js` 文件头已声明），`ConfigurationModel.inspect` 也只返回 `value`。                                                                                                                | `ConfigurationModelParser` 解析覆盖段，`inspect` 返回 `overrideIdentifiers` 等（`configurationModels.ts:29-313`、`:97-120`）                                                                                                                                                              |
| 设置项登记范围                                                             | 只登记本仓库会读写的两项（`editor.wordWrap` / `editor.minimap.enabled`，`editorConfiguration.js:14-30`），其余编辑器选项仍由 `EditorPart.vue` 直接传给 monaco，因此不能从 `settings.json` 配置。                                                                        | 整个 editor 段数百项都在 `editorOptions.ts` 里带 schema 与默认值（如 `:3478`、`:6846`）                                                                                                                                                                                                  |
| `canToggleWordWrap` 的判定分支                                             | 只判「有没有编辑器与模型」（`wordWrapState.js:45-48`）。略去两个分支：`editor.isSimpleWidget`、内联 diff 左侧编辑器。                                                                                                                                                     | `toggleWordWrap.ts:213-240`：`isSimpleWidget` → false；`inDiffEditor` 且是 inline diff 的左侧编辑器 → false；否则要求有 model                                                                                                                                                            |
| 标签栏「为此文件启用换行」的 when 少一个子句                                | `and(isDominatedByLongLines, !isWordWrapMinified)`（`wordWrap.contribution.js:72`）。                                                                                                                                                                                    | `and(inDiffEditor.negate(), isDominatedByLongLines, !isWordWrapMinified)`（`toggleWordWrap.ts:333-345`）；本仓库没有 diff 编辑器，`inDiffEditor` 恒假、`negate()` 恒真                                                                                                                     |
| 配置变更事件的 DEFAULT 分支                                                | 已实现但当前无触发路径：默认层只在 `initialize()` 时构建一次（`configurationService.js:34-40`），运行期不新增/移除配置项，故不会发出 `source = DEFAULT` 的事件；`config.*` 的清表分支由 `check:configuration` 直接调用容器方法固定。                                          | 扩展/内置插件可运行期注册配置项，`ConfigurationRegistry` 的 `onDidUpdateConfiguration` 触发默认层重建与 `ConfigurationTarget.DEFAULT` 事件（`configurationRegistry.ts:918-920`）                                                                                                          |
| 布局与视图状态的持久化范围                                                 | **已实现**（见 4.13）：`sidebarWidth` / `sidebarVisible` / `panelHeight` / `panelVisible` / `panelMaximized`（仅「记住」，启动不恢复）/ `statusBarVisible` 六项经 `IStorageService` 等价物落盘，刷新后恢复。仍只在内存的两项：`activeViewContainerId`、`activePanelId`（不属 `LayoutStateKeys`，权威由 `PANE_COMPOSITE_*` / views service 各自持久化，本仓库未迁移）；`wordWrap` / `minimap` 属配置层，待第二步。 | 布局状态经 `IStorageService` 存取（`workbench/browser/layout.ts` 的 `RuntimeStateKey` / `InitializationStateKey`，如 `sideBar.hidden`、`sideBar.size`、`panel.hidden`、`panel.size`、`panel.wasLastMaximized`、`statusBar.hidden`）；`editor.wordWrap` / `editor.minimap.enabled` 属配置，存用户 `settings.json`，不由 storage 管 |
| 存储落盘介质降级为 localStorage                                             | 每个「库」对应 localStorage 里的一份 JSON 文档（键名与 `__$__targetStorageMarker` 原样保留）：`vscode-web-state-db-global`（APPLICATION + PROFILE）、`vscode-web-state-db-empty-window`（WORKSPACE）。无跨窗口广播（`onDidChangeValue` 未迁移），同一浏览器多标签页各自持有内存副本、互不同步。                                                                                            | IndexedDB，库名 `vscode-web-state-db-<id>`、对象仓储 `ItemTable`（`workbench/services/storage/browser/storageService.ts:373-374`、`:393`）；写入异步，故每 5s 定期 flush（`:20`）。跨窗口同步由 `BroadcastDataChannel` 承担（`platform/storage/common/storage.ts:3081` 起的 `onDidChangeValue` 消费方见 `workbench/browser/layout.ts:3081-3093`） |
| 无档案与多工作区概念                                                       | PROFILE 作用域与 APPLICATION 恒共用 `vscode-web-state-db-global`；WORKSPACE 作用域恒用空白窗口 id（`vscode-web-state-db-empty-window`），因此本仓库只有一个工作区槽位。                                                                                                                                                                                       | `storageService.ts:121-133` 只有「使用默认档案」时才与全局库同库，命名档案另有库名；工作区 id 取自打开的文件夹/工作区文件（`workspace.ts:156`、`:179`），不同文件夹各自一份状态          |
| 未迁入的 `LayoutStateKeys` 家族                                            | 只迁入六个键（见 4.13）。未迁入：`zenMode.*`、`auxiliaryBar.*`、`activityBar.hidden`、`editor.hidden`、`mainEditor.centered`、`sideBar.position`、`panel.position`、`panel.alignment`、`panel.lastNonMaximizedHeight/Width`、`auxiliaryBar.lastNonMaximizedVisibility`、`auxiliaryBar.empty` —— 本仓库没有对应部件或 UI（面板恒在底部居中、无禅模式/辅助栏/活动栏隐藏/多组编辑器）。                                                                                              | `layout.ts:2879-2909` 的完整键表；`panel.position` / `panel.alignment` 也来自 legacy 设置（`layout.ts:2970` 的配置回写） |
| 侧栏在「空白窗口」下的默认显隐                                             | 保持可见：`sideBar.hidden` 默认值恒为 false（`layoutStateModel.js:54`）。                                                                                                                                                                                                                                                                                     | `layout.ts:3027` 把默认值设为 `workbenchState === EMPTY \|\| auxiliaryBarForceMaximized`；本仓库无工作区概念（恒等价于 EMPTY），严格照抄会让侧栏默认隐藏、界面看不到资源管理器，故保留可见 —— 属有意偏离 |
| 窗口尺寸变化后不重算已存尺寸                                               | 恢复与拖拽时各按 `partDimensions.js` 夹取一次；窗口缩小到已存宽度放不下时不再重算（`layout.js:38`、`:40`）。                                                                                                                                                                                                                                                   | 尺寸由 grid 在每次 layout 时按容器尺寸约束（`layout.ts:1766` 的 `workbenchGrid.layout(width, height)`；`:3124-3127` 只在新工作区且窗口偏小时改写侧栏默认值） |
| 隐藏面板时未先取消最大化                                                   | 直接改 `appState.panelVisible`，`panelMaximized` 保持原值。                                                                                                                                                                                                                                                                                                  | `layout.ts:2113-2115`：隐藏最大化中的面板前先 `toggleMaximizedPanel()`，以免与编辑器的显隐互相覆盖（fixes #281772）。本仓库因「最大化 / 还原面板」两个动作只挂在面板标题栏，面板隐藏时不可达，无可见差异 |

| 未声明 `contributes.languages[].configuration`                            | PVF 扩展的 `package.json` 不声明该字段，`language-configuration.json` 的等价内容由扩展在 `activate()` 里调 `monaco.languages.setLanguageConfiguration(id, extractValidConfig(id, config))` 注册（`src/extensions/pvf/browser/pvfExtension.js`）。不声明的原因：M1 没有 `languageConfigurationExtensionPoint` 的消费方（懒加载注册器未迁入），声明了也不会生效 —— 宁可少声明也不写无效声明 | `src/vs/workbench/contrib/codeEditor/common/languageConfigurationExtensionPoint.ts:89-130`（priority 50 的 lazy 注册器，按需读扩展目录里的 `configuration` 文件并 `setLanguageConfiguration`）、`:54-56`（`configuration` 路径相对扩展目录解析） |
| 语言配置需自行归一化（序列化形态 → 内部形态）                             | **已修正**：扩展写的配置是**序列化形态**（`autoClosingPairs: [["{","}"]]` 这类二元组，即 `language-configuration.json` 的形态），而 monaco 的 `setLanguageConfiguration` 要求**内部形态**（`{open,close,notIn?}` 对象，见 `monaco.d.ts:7285`/`:7291`）。初版把序列化形态直接传了过去，打开任意 Squirrel / PVF 文本编辑器即崩：`TypeError: Cannot read properties of undefined (reading 'charAt')`（monaco 的 `AutoClosingPairs` 无条件读 `pair.open.charAt(0)`，二元组的 `open` 为 undefined）。现由 `src/workbench/contrib/codeEditor/common/languageConfigurationExtensionPoint.js` 的 `extractValidConfig` 完成归一化与逐项校验（非法项 `console.warn` 后丢弃），由 `scripts/check-language-configuration.mjs` 固定住（含「喂给崩溃现场那两个类不抛错」的回归断言） | 权威在 `LanguageConfigurationFileHandler.extractValidConfig` 里做同一件事（`:380-435`），逐项校验函数 `_extractValidCommentRule` `:151`、`_extractValidBrackets` `:201`、`_extractValidAutoClosingPairs` `:227`、`_extractValidSurroundingPairs` `:272`、`_extractValidColorizedBracketPairs` `:303`、`_extractValidOnEnterRules` `:326`、`_parseRegex` `:442`、`_mapIndentationRules` `:472` |
| 语言配置注册优先级 50 → 100                                                | 归一化后经 monaco 公开 API `setLanguageConfiguration` 注册，优先级被固定为 100（`monaco-editor/esm/vs/editor/standalone/browser/standaloneLanguages.js:81-89`）。每个语言只有一份语言配置，故该差异不可观察 | 扩展点注册为 priority 50（`languageConfigurationExtensionPoint.ts:437-440`），与用户级覆盖（`LanguageConfigurationService` 的 default 100）分层 |
| `language-configuration.json` 的 JSON schema 未注册                        | 未迁移：本仓库没有 `jsonContributionRegistry`（`src/platform/` 下无该模块），也没有「写 `language-configuration.json` 时拿 IntelliSense」的场景，故 schema（含默认值里写二元组的示例）未登记 | `languageConfigurationExtensionPoint.ts:496+`（`schemaId = 'vscode://schemas/language-configuration'`，挂进 `jsonContributionRegistry`） |
| 未声明 `contributes.grammars`                                             | PVF 扩展只贡献 Monarch 词法，注册点在 `activate()`（`monaco.languages.setMonarchTokensProvider`）。`contributes.grammars` 通道在 M5 引入 `vscode-textmate`/`vscode-oniguruma` 前不可用（见设计方案第 12 节第 3 项），故清单里不出现该字段                                                                                        | `src/vs/workbench/services/textMate/common/TMGrammars.ts:13-53`（`contributes.grammars` schema：`language`/`scopeName`/`path`/`injectTo`/`embeddedLanguages`/`tokenTypes`）；解析实现 `textMateService.ts:227-260`（`.tmLanguage` → `IRawGrammar`） |
| 内置扩展清单来自构建期静态引入，无目录扫描                                | `src/workbench/services/extensions/common/builtinExtensions.js:19` 直接 `import pvfManifest from "@/extensions/pvf/package.json"`；扩展位置只是个稳定标识（`{ scheme: "pvf-builtin", path: "/pvf" }`），磁盘上没有对应目录。`ExtensionsRegistry.setExtensionDescriptions` 投递的是「扫描结果」这份列表，而非扫描动作                                                                        | `builtinExtensionsScannerService.ts:28-95` 遍历 `<resources>/extensions` 逐个读 `package.json` 构造 `IExtensionDescription`（`:75` 的 `isBuiltin: true`），`:74` 的 `extensionLocation` 是真实目录 URI |
| `activate()` 在进程内直接调用，无宿主隔离                                 | `src/workbench/contrib/pvf/browser/pvf.contribution.js` 的 `activatePvfExtension()` 直接调扩展的 `activate({ subscriptions })`，失败时 try/catch 收起副作用；扩展代码与工作台同线程、同全局（M3 前无 Web Worker 宿主）                                                                                     | `extensions/browser/webWorkerExtensionHost.ts:133 / :254`（sandbox iframe + MessagePort 三方握手）；扩展崩溃或死循环不会拖住工作台主线程 |
| 直接 import monaco 发行包的私有路径                                        | `@/workbench/services/language/common/languageAssociations.js` 等导入 `monaco-editor/editor/common/services/languagesAssociations.js` 这类非公开入口。`monaco-editor@0.56.0` 的 exports map 含 `"./*": "./esm/vs/*.js"`（`node_modules/monaco-editor/package.json`），Vite 与 Node 都能解析；公开 API 只导出 `getLanguageIds`/`registerPlatformLanguageAssociation`/`clearPlatformLanguageAssociations`，用户层匹配器不可达，这是自建用户层的唯一理由 | 权威源码内部按自身 module id 互相 import（如 `languagesAssociations.ts:6-8`），无 exports map 约束；本仓库的写法依赖 monaco 包的发包约定，升级 monaco 主版本时需复查 |
| `@/utils/encoding.js` encode 侧对 euc-kr / cp949 静默回退 UTF-8              | **已修正**：编码统一走 `@vscode/iconv-lite-umd`，编码名不受支持时 `encodeText` 抛错，不再静默按 UTF-8 写出（曾属数据损坏风险）；三份手工单字节码表（`gbkEncoder.js` / `big5Encoder.js` / `euckrEncoder.js`）与自带的 GBK 查表一并删除，`gbkCode` 改由 iconv 查表（BMP 汉字范围内与旧表仅 PUA 区 8 处差异，均落在乱码恢复逻辑的前导字节门控之外，行为不变）                                                                                                            | `src/vs/workbench/services/textfile/browser/textFileService.ts:819-832`（`getPreferredWriteEncoding`：写盘按 `SUPPORTED_ENCODINGS` 校验，不做静默换编码，编码不支持即失败） |
| 编码检测存在两份实现                                                        | **已修正**：检测收敛到 `@/workbench/services/textfile/common/encoding.js` 的 `detectEncodingFromBuffer`（BOM → 零字节 → jschardet）。`@/utils/pvfTool.js`、`@/utils/pvfToolTw.js` 不再自带检测（前者那个转发包装函数已删除，只 re-export 收敛后的实现），`@/utils/encoding.js` 的 `detectEncoding` 退化为门面（候选集与名字映射在 `@/utils/pvfEncoding.js`）                                                                                          | `src/vs/workbench/services/textfile/browser/textFileService.ts:834-886`（决策链）+ `common/encoding.ts:440-508`（检测：BOM → 零字节启发式 → jschardet）、`:27-30`（512 / 512×8 / 512×128 三个阈值） |
| 无流式编解码路径                                                            | `@/workbench/services/textfile/common/encoding.js` 一次拿到完整 `Uint8Array`，探测与编解码同步完成，因此 `detectEncodingFromBuffer` 在 `autoGuessEncoding` 为真时也同步返回（权威返回 Promise），`acceptTextOnly` / `DecodeStreamError` 的「二进制即失败」语义改由调用方按 `seemsBinary` 自行处理（M2a 尚无文件读取路径，暂无消费方）                                                                                                              | `encoding.ts:119-215` 的 `toDecodeStream`（攒够 `MIN_BYTES_FOR_DETECTION` 字节再探测）、`:217-264` 的 `toEncodeReadable`；`detectEncodingFromBuffer` 只是其中的探测步骤（`:440-508`） |
| iconv / jschardet 为静态 import                                             | 两者随主 chunk 打入（`dist/assets/index-*.js` 909 kB / gzip 384 kB，其中 iconv-lite-umd 291 kB、jschardet 334 kB，合计 raw 625 kB / gzip 295 kB）；换来 `decodeText` / `encodeText` 保持同步签名，PVF 域的同步调用点无需改动。桌面端（M4）同样是这个包，无需换实现                                                                                                                  | `encoding.ts:88`、`:221`、`:262` 用 `importAMDNodeModule` 懒加载（web 版按需取 CDN/AMD 模块，Node 版走 require），主 chunk 不含这两个包 |
| 无编码覆盖注册表                                                            | 权威 `ResourceEncodingRegistry` 的三类固定覆盖（用户数据目录、工作区 `.vscode`、`WORKSPACE_EXTENSION`）在本仓库都没有对应路径，故决策输入 `IEncodingInput.encodingOverride` 无产出方（参数保留以对齐优先级）；`files.encoding` / `files.autoGuessEncoding` / `files.candidateGuessEncodings` 三项目前也无法在 `[language]` 段被覆盖（与「无语言/资源级设置覆盖」同一项，`files.contribution.js` 因此不登记 `scope`）                                     | `textFileService.ts:802-823` 的 `getDefaultEncodingOverrides` / `:886-900` 的 `getEncodingOverride`；`files.contribution.ts:190-215` 的 scope 为 `ConfigurationScope.LANGUAGE_OVERRIDABLE` |
| PVF 归档编码的候选集与名字映射                                              | `@/utils/pvfEncoding.js` 把候选集固定为 `["gb2312","cp950","euckr","utf8"]`，并做 `gb2312→gbk` / `cp950→big5` / `euckr→euc-kr` 的名字映射。这是 PVF 域的取值（机制本身即权威的 `files.candidateGuessEncodings`，旧实现自带的「三候选 fatal 试探」已删除）；取值来自 PVF 归档实测：GBK 文本被判为 GB2312、Big5 文本被判为 CP950，故编码侧再映射回 GBK / Big5                                                                              | 权威默认候选为空表（`files.contribution.ts:203-215` 的 `default: []`，实际取值由用户配置）；`JSCHARDET_TO_ICONV_ENCODINGS`（`encoding.ts:360-363`）只有 `ibm866→cp866`、`big5→cp950` 两条映射，无 PVF 域取值 |
| TW 归档的编码探测未收敛                                                     | `@/utils/pvfToolTw.js` 的 `_twDetectEncoding` 仍是自带的「Big5 优先」启发式，未改走 `detectEncodingFromBuffer`（无 TW 归档样本可验证，避免未经证实的回归；`@/utils/pvfTool.js` 对应的那份重复实现已删除）。TW 归档的编码名写入 `twEncoding`，与编辑器侧的 `files.encoding` 是两套（归档级 vs 文件级）                                                                          | 权威只有一处检测实现（`encoding.ts:440-508`），全部消费方共用 |
| 编辑器输入无编码读写接口                                                    | `editorGroupService.js` 的 `entry.encoding` 只在创建输入时按 `getUnvalidatedEncoding(input.encoding, ...)` 定下（对应 `textFileService.ts:319-322` 的 `getEncoding`：模型编码优先、否则按 `files.encoding` 回落），没有 `IEncodingSupport` 的 `getEncoding` / `setEncoding` 这一对接口，因此无法在运行期改编码并重新解码；重解码还需要「按原字节重读」的读取路径（M2b：`IFileService` + `pvf:` provider）                                            | `textEditorInput.ts`（`AbstractTextEditorInput.getEncoding`）/ `textResourceEditorInput.ts` / `untitledTextEditorInput.ts` 实现 `IEncodingSupport`；`editorStatus.ts:69-71` 的 `EncodingMode.Decode` / `Encode` |
| 状态栏「选择编码」未接入                                                    | 条目 `status.editor.encoding` 已按权威用 `SUPPORTED_ENCODINGS[encoding].labelShort` 显示（`editorStatus.ts:900-906`），但**不绑定命令**：`workbench.action.editor.changeEncoding` 的两步快速选择器（保存时用新编码 / 用新编码重新打开）需要上面那条读取路径，属 M2b                                                                                                                    | `editorStatus.ts:1434`（动作 id）、`:1445-1560`（两步 quick pick：Save with Encoding / Reopen with Encoding，列表按 `order` 排序、当前编码置顶、Reopen 过滤 `encodeOnly` 项、脏编辑器先确认回滚） |
| 语法着色的 tokenColors 需在代码里存一份                                     | **已记录并解决**（见 4.15）：`src/monaco/themeTokens.js` 保存主题链 `tokenColors` 的展开结果（260 条 + 41 条尾部覆盖），由 `scripts/check-syntax-colors.mjs --write` 生成；该脚本在参考仓库存在时逐条比对展开结果，运行期不依赖 `../vscode`。初版 `PVF_DARK_THEME` 的 `rules` 为空，语法颜色静默停留在内置 Dark+（关键字 `#569CD6`、函数与变量无颜色标记）                                                                                                                                                                          | VS Code 从主题扩展 JSON 读 `tokenColors` 并组装（`colorThemeData.ts:103-152`、`:782-787`），不存在「内置兜底规则」这一层；monaco 发行包只提供 `vs` / `vs-dark` 的内置规则（`editor/standalone/common/themes.js`） |
| `inherit: true` 会残留内置 Dark+ 的 token 颜色                              | **已记录并解决**：`themeTokens.js` 末尾 41 条覆盖（`delimiter`、`tag`、`number`、`metatag.*`、`attribute.value.*` …）把「内置 vs_dark 有、主题链没有」的 token 钉回主题链的解析结果（多数是 `editor.foreground` `#BBBEBF`）；`check:syntax-colors` 的 A 段用探针集合（两条来源 token 的点号前缀闭包）断言「残留颜色已全部消除」                                                                                                                                                                                                                                                                                | 权威不存在该问题（其规则集就是主题链本身）。保留 `inherit: true` 的理由是继续复用内置 `vs_dark.colors` 里的编辑器部件兜底色（`vs_dark.colors` 仅 6 项），改 `inherit: false` 会静默改变 `editorIndentGuide.*` 等解析结果 |
| Squirrel 的声明关键字用 `keyword.control`（粉）而非 JS 语法的 `storage.type.*` | `function` / `constructor` / `local` / `const` 记为 `keyword.control` → `#C586C0`，与 `return`（`keyword.control.flow`）严格同色（`src/extensions/pvf/browser/squirrel.js` 的 `WORD_SCOPES`，含「后跟参数表」的 `functionSignature` 分支）；`class` / `enum` 仍是 `storage.type.class` / `.enum` → `#FF7B72`，`static` 仍是 `storage.modifier` → `#569CD6`。属产品决定：「关键字统一粉」；作用域名本身两处权威都用过（主题链 `dark_plus.json:76` 的 `keyword.control` → `#C586C0`；JS 语法 `JavaScript.tmLanguage.json:159-161` 用它标注非控制流关键字 `package`）                                                                                                                                                | JS 语法把 `function` / `var` / `let` / `const` 记作 `storage.type.function.js` / `storage.type.js`；2026-dark 给 `storage.type` 的取值是 `#FF7B72`（`2026-dark.json:379-384`）。**Squirrel 无权威语法**（VS Code 不含 Squirrel 支持），「词 → 作用域」的映射是本仓库自定，故不构成对权威行为的偏离 |
| 全局变量与函数体内变量分色                                                  | 函数体外（含 `::x` 根表访问）→ `variable` → `#FFA657`；形参 → `variable.parameter.function`、函数体内局部量 → `variable.other.readwrite` → 均为 `#C9D1D9`。取值都来自主题链；`nameRules(variableScope)` 一份实现（`squirrel.js:107-124`），只有末条规则的作用域按「函数体外 / 函数体内」参数化；词法上靠 `functionSignature` → `functionParams` → `functionBodyExpect` → `functionBody` 四态（`squirrel.js:158-186`，`switchTo` 替换栈顶、嵌套 `{` 压栈 / `}` 弹栈）实现                                                                                                                                                    | **VS Code 不做此区分**：JS 语法对全局变量与函数体内局部量都用 `variable.other.readwrite.js`，主题链中没有任何规则能区分二者（`tokenClassificationRegistry.ts:545-573` 的 `variable` 探测作用域也只有 `variable.other.readwrite`）。属本仓库自定，产品要求「全局 / 函数体变量颜色要区分」 |
| NUT（Squirrel）字符串颜色取 Dark+ 的 `#CE9178`（不跟随 2026-dark 的 `string`） | `string.quoted.double.squirrel` / `string.quoted.single.squirrel` → `#CE9178`（用户给的截图色）。取值出处 `<vscode>/extensions/theme-defaults/themes/dark_vs.json` 的 `string` —— `dark_plus.json:4`、`dark_modern.json:4` 逐级 include 它，即 VS Code Dark Modern 里字符串的实际渲染值。实现：`scripts/check-syntax-colors.mjs` 的 `NUT_STRING_RULES`（两条语言级覆盖之一）→ 生成到 `src/monaco/themeTokens.js` 末尾。token 名必须写全（monaco 的主题匹配沿点号逐段下行、要求**连续前缀**，`string.squirrel` 这种跳段写法不命中），因此只作用于 NUT：JS 等其它语言的 `string` 仍是 `#A5D6FF`。属产品决定（产品要求「NUT 字符串用截图中的颜色」） | 2026-dark 链里 `string` → `#A5D6FF`（`2026-dark.json` 的 tokenColors，本仓库编辑器主题 `PVF_DARK_THEME` 即该链的展开）；Dark+ / Dark Modern 的 `string` 才是 `#CE9178`。**Squirrel 无权威语法**（VS Code 不含 Squirrel 支持），「词 → 作用域」的映射是本仓库自定，故不构成对权威语法行为的偏离，仅为主题取值的产品决定 |
| Squirrel 词法本身无权威实现                                                | 词法与语言配置在 `activate()` 里以代码注册（`squirrel.js` 的 Monarch 定义 + `squirrelLanguageConfiguration`），作用域名逐条选自 JS 语法与主题链，且只允许出现「两边出现过」的名字，见该文件头部注释与 `check:syntax-colors` 的 C 段                                                                                                                                                                                                                                                                                     | VS Code 核心不含 Squirrel 支持，权威只提供「扩展贡献语言」这一机制（对照 `extensions/lua/package.json` 的 `contributes.languages` + `contributes.grammars` + `language-configuration.json` 三件套）；`contributes.grammars` 通道待 M5 引入 `vscode-textmate` / `vscode-oniguruma`（见设计方案第 12 节） |
| 注释颜色取 Dark+ 的 `#6A9955`（不跟随 2026-dark 的灰 `#8B949E`）           | `comment.pvf` / `comment.squirrel` → `#6A9955`（用户要求的「VS Code 绿色」）。取值出处 `<vscode>/extensions/theme-defaults/themes/dark_vs.json:80-84` 的 `comment` —— Dark Modern / Dark+ 的注释就是它。实现：`scripts/check-syntax-colors.mjs` 的 `COMMENT_RULES`（与 `NUT_STRING_RULES` 一起构成 `PRODUCT_OVERRIDE_RULES`）→ 生成到 `src/monaco/themeTokens.js` 末尾。token 名带语言段，因此只作用于 PVF 文本与 NUT：其它语言（JS / Markdown 等）的 `comment`、`punctuation.definition.comment` 仍是 `#8B949E` | 2026-dark 链里 `comment` / `punctuation.definition.comment` / `string.comment` → `#8B949E`（`2026-dark.json:300-306`，本仓库编辑器主题 `PVF_DARK_THEME` 即该链的展开），VS Code 现默认注释是灰的；绿色是 Dark+ / Dark Modern 的取值。属产品决定（产品要求「注释用 VS Code 的绿色高亮」） |
| PVF 文本的行注释支持 `//`（编码器与校验器同步扩展）                        | `pvfText.js` 的 root 增 `[ /\/\/.*$/, "comment" ]`（`#` 原本就有）；写回侧 `pvfTool.js` 的 `encodeTokenText` 与 `pvfToolTw.js` 的 `encodeTwToken` 同步在 **token 起始位置**跳过 `//` 到行尾，`pvfValidator.js` 的 `validatePvfText` 同样 break 掉本行。三处保持同一条规则，避免「显示为注释、写回编码成数据」的静默损坏；`a//b` 这类 token 中间的 `//` 不是注释（裸串规则整体吃掉），有断言钉住                                    | 无权威行为：PVF 归档格式与 pvfUtility 导出文本都是本项目自有领域，VS Code 没有对应格式。原实现只认 `#`（`encodeTokenText` 的注释说明），`//` 是产品要求补上的等价写法（「`// xxx` 解析为注释」） |
| Squirrel 词法新增 `#` 行注释（规范外）                                      | `squirrel.js` 的 `whitespace` 状态增 `[ /#.*$/, "comment" ]`（`//` 与 `/* */` 来自 Squirrel 规范）。存在理由：pvfUtility 导出的 `.nut` 明文以 `#PVF_File` 开头（`pvfToolTw.js:997-1000`、`:751-759`），以 `.nut` 打开时走这套词法；不加则 `#PVF_File` 被标成「`#` 无作用域 + `PVF_File` 全局变量」。`.nut` 明文导出由 `pvfToolTw.js:1414-1416` 原样写回，不经 token 编码，故不存在「注释被编码成数据」的问题。符号解析（`squirrelSymbols.js` 的 `stripLiterals`）同步把 `#` 当作行注释截断，否则注释里的大括号会被当成块边界 | 无权威行为：Squirrel 规范只有 `//` 与 `/* */` 两种注释，`#` 不是注释符。属产品要求（「`#PVF_File` 解析为注释」）+ PVF 明文导出的格式事实，故为规范外扩展 |

## 6. 语言识别 / 编码 / 格式化 / 插件系统

> 本节是第四批迁移（设计方案见 [`plugin-system-design.md`](plugin-system-design.md)）的对照索引。
> 这四个功能域的偏差同样登记到第 5 节。

### 6.1 文件类型识别（资源 → languageId）

| 功能域                       | VS Code 权威文件                                                                                                                                                                                        | 本仓库实现                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 语言声明字段                 | `src/vs/editor/common/languages/language.ts:13-25`（`ILanguageExtensionPoint`：`id`/`extensions`/`filenames`/`filenamePatterns`/`firstLine`/`aliases`/`mimetypes`/`configuration`/`icon`）                | `src/workbench/services/language/common/languageService.js` 的 languages 贡献点校验 + `monaco.languages.register`      |
| 语言注册与合并               | `src/vs/editor/common/services/languagesRegistry.ts:111-176`（内置 + 动态声明按 `id` 合并；带 `configuration` 的条目 `extensions` unshift 到最前）、`:132-147`（`_mimeTypesMap`/`_lowercaseNameMap`）        | 同源：monaco 发行包的 `editor/common/services/languagesRegistry.js`（`monaco.languages.register` 即入口）              |
| **识别优先级（核心）**       | `src/vs/editor/common/services/languagesAssociations.ts:139-189`：① 用户 `files.associations` → ② 平台注册 → ③ `firstLine` 兜底；`:191-243` 内部 `filename` 精确 > 最长 `filenamePatterns` > 最长 `extensions`，倒序遍历（后注册优先） | 平台层与首行兜底**直接复用 monaco**（`editor/common/services/languagesAssociations.js` 与权威逐行相同）；仅用户层自建：`getLanguageIdForResource` + `registerConfiguredLanguageAssociation`（`src/workbench/services/language/common/languageAssociations.js`） |
| `files.associations` 配置    | `src/vs/workbench/contrib/files/browser/files.contribution.ts:183-190`（schema）；消费方 `src/vs/workbench/services/language/common/languageService.ts:294-317`（`updateMime`：清空重建 + `getMimeType(langId) \|\| text/x-<langId>`）                | `src/workbench/contrib/files/browser/files.contribution.js`（schema，配置键常量在 `@/platform/files/common/files.js`）+ `languageService.js` 的 `updateConfiguredLanguageAssociations`（`:138-160`，清空重建用户层） |
| 首行文本截断长度             | `src/vs/editor/common/model.ts:1508` 的 `FIRST_LINE_DETECTION_LENGTH_LIMIT = 1000`；使用处 `workbench/common/editor/textEditorModel.ts:186-197`                                                          | `languageAssociations.js` 的 `FIRST_LINE_DETECTION_LENGTH_LIMIT`（`:32`）与 `getFirstLineText`（`:145-150`，取第 1 行并截断）；调用点 `languageService.js` 的 `getOrCreateLanguageId`（`:71-78`，用 `model.getLineContent(1)`） |
| 关联变化后重解析已打开模型   | `src/vs/workbench/services/textfile/common/textFileEditorModel.ts:199-209`（`onDidChangeFilesAssociation` → `model.setLanguage`）                                                                        | `languageService.js` 的 `applyLanguageToOpenModels`（遍历 `monaco.editor.getModels()` → `setModelLanguage`，跳过 `untitled` scheme；显式语言经 `_preferredLanguageIds` WeakMap 记录、不被重算覆盖） |
| `onLanguage:<id>` 激活事件   | `src/vs/workbench/services/language/common/languageService.ts:115-121`（`activationEventsGenerator`）+ `:287-291`（`onDidRequestRichLanguageFeatures` → `activateByEvent`）                              | `languageService.js` 的 contributions 注册（`ExtensionPoint` 挂 `activationEventsGenerator`）与 `platform/extensionManagement/common/implicitActivationEvents.js`；M1 的消费方是 PVF 扩展 manifest 里的 `onLanguage:squirrel` 等四条 |
| **语言配置的两种形态**       | `src/vs/workbench/contrib/codeEditor/common/languageConfigurationExtensionPoint.ts`：`ILanguageConfiguration`（序列化形态，`:57-72`，`autoClosingPairs`/`surroundingPairs` 允许二元组）→ `LanguageConfigurationFileHandler.extractValidConfig`（`:380-435` 归一化 + 逐项校验）→ `_handleConfig`（`:437-440`，priority 50 注册）→ 内部形态 `ExplicitLanguageConfiguration`（`editor/common/languages/languageConfiguration.ts`，`autoClosingPairs` 必须 `{open,close,notIn?}`、`surroundingPairs` 必须 `{open,close}`，只有 `brackets`/`colorizedBracketPairs` 仍是二元组） | `src/workbench/contrib/codeEditor/common/languageConfigurationExtensionPoint.js` 的 `extractValidConfig`（逐项对齐 `:151-494`，含 `_extractValid*` / `_parseRegex` / `_mapIndentationRules`）；调用点 `src/extensions/pvf/browser/pvfExtension.js` 的两处注册（squirrel、pvf-text 三语言）；内部形态的消费端是 monaco 同源实现（`languageConfiguration.js:111-137` 的 `AutoClosingPairs`、`supports/characterPair.js:11-28`） |
| 语言配置的触发源             | 权威：`_loadConfigurationsForMode` 由 `onDidRequestBasicLanguageFeatures` 驱动（`:104-108`，即按语言首次使用时加载）、`onDidChange` 时按 `configFiles` 哈希重载（`:110-116`）。对权威文件执行门控 §4.4 的订阅点穷举（`grep -n "onDid[A-Z]\|addEventListener\|onDidChangeConfiguration\|observe("`）只有这两条命中                                   | **不适用**：本仓库由扩展在 `activate()` 里同步注册一次（清单 `configuration` 通道未接通），既没有「按语言懒加载」也没有「语言配置变化重载」这两个触发源；差异登记在第 5 节 |

### 6.2 编码

| 功能域               | VS Code 权威文件                                                                                                                                                                                                                                                                                                            | 本仓库实现                                                                                                                                                                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 编码枚举与 BOM       | `src/vs/workbench/services/textfile/common/encoding.ts:12-25`（`UTF8`/`UTF8_with_bom`/`UTF16be`/`UTF16le`、`UTF8_BOM`/`UTF16le_BOM`/`UTF16be_BOM`）、`:512-781`（`SUPPORTED_ENCODINGS` 49 项）、`:783-793`（`GUESSABLE_ENCODINGS` 由该表派生）                                                                                              | `@/workbench/services/textfile/common/encoding.js`：`UTF8`/`UTF8_with_bom`/`UTF16be`/`UTF16le` 与三个 BOM 常量逐行对应；`SUPPORTED_ENCODINGS` 49 项逐行照抄（`labelLong`/`labelShort`/`order`/`encodeOnly`/`alias`/`guessableName`），`GUESSABLE_ENCODINGS` 按同样方式从表派生                                                                                             |
| 打开时编码决策链     | `src/vs/workbench/services/textfile/browser/textFileService.ts:834-886`（`getPreferredReadEncoding`：显式 option > 检测值 > `files.encoding`；`utf8bom` 未检出 BOM 时降 `utf8`；`encodingExists` 校验失败回退 UTF-8）、`:819-832`（写盘强制 BOM）                                                                                  | 同文件的 `getPreferredReadEncoding` / `getPreferredWriteEncoding` / `getValidatedEncoding` / `getUnvalidatedEncoding`（逐行对应 `:826-886`，抽成纯函数）；输入经 `@/workbench/services/textfile/browser/encodingInput.js` 从 `textResourceConfigurationService` 取值；端到端入口 `resolveReadEncoding`（探测 + 决策两步合成，对应 `:302-317` + `:336-340`） |
| 编码检测             | `encoding.ts:280-315`（BOM 探测）、`:440-508`（BOM → 零字节启发式判 UTF-16/二进制 → jschardet 猜测）、`:27-30`（512/512×8/512×128 三个阈值）、`:317-389`（jschardet 包装：`IGNORE_ENCODINGS`、`candidateGuessEncodings` 经 `GUESSABLE_ENCODINGS` 映射、异常吞掉返回 null）                                                            | 同文件的 `detectEncodingByBOMFromBuffer` / `detectEncodingFromBuffer` / `guessEncodingByBuffer` / `toJschardetEncoding` / `toIconvLiteEncoding`（同步整块版本，见第 5 节「无流式编解码路径」）                                                                                                                                              |
| 编解码依赖           | 权威 `package.json:122` `@vscode/iconv-lite-umd@0.7.1`、`:152` `jschardet@3.1.4`（纯 JS，web 与 Node 同一份；权威用 `importAMDNodeModule` 懒加载）                                                                                                                                                                                | 同版本依赖，`encodingCodec`（`decode` / `encode` / `exists`；`toNodeEncoding` 把 `utf8bom` 归一为 `utf8`，BOM 由 `addBOM` 决定）+ `guessEncodingByBuffer`；静态 import（体积见第 5 节）                                                                                                                                                     |
| 编码配置项           | `files.contribution.ts:190-215`（`files.encoding` scope `LANGUAGE_OVERRIDABLE` 默认 `utf8`、`files.autoGuessEncoding` 默认 false、`files.candidateGuessEncodings` 默认空表）                                                                                                                                                    | `@/workbench/contrib/files/browser/files.contribution.js` 三项逐字照抄（`enum` 取 `SUPPORTED_ENCODINGS` 的 key、`enumDescriptions`/`enumItemLabels` 取 `labelLong`、候选表 `enum` 取 `GUESSABLE_ENCODINGS`）；`scope` 未登记（第 5 节「无编码覆盖注册表」）；配置键常量在 `@/platform/files/common/files.js`                                    |
| 状态栏编码条目与动作 | `src/vs/workbench/browser/parts/editor/editorStatus.ts:543-558`（entry `status.editor.encoding`）、`:887-908`（`onEncodingChange`：raw id 查 `SUPPORTED_ENCODINGS` 取 `labelShort`，查不到用原值）、`:1434`（`workbench.action.editor.changeEncoding`）、`:1445-1560`（两步 quick pick 数据与排序）                                | 条目在 `@/workbench/contrib/statusbar/statusbar.contribution.js`（`status.editor.encoding`，`:80-86` 按 `labelShort` 映射，与 `:900-906` 一致）；编辑器输入的编码在 `@/workbench/contrib/editor/editorGroupService.js` 的 `_createEntry` 里按 `getUnvalidatedEncoding` 定下（对应 `textFileService.ts:319-322` 的 `getEncoding`）；**快速选择器（`changeEncoding`）尚未接入**，见第 5 节 |
| PVF 域入口           | 无对应实现（PVF 归档格式与 sTrA 字符串表是本项目自有领域）                                                                                                                                                                                                                                                                        | `@/utils/encoding.js` 的 `detectEncoding` 用权威的 `detectEncodingFromBuffer` + `@/utils/pvfEncoding.js` 的候选集（`gb2312`/`cp950`/`euckr`/`utf8`）与名字映射；`decodeText`/`encodeText`/`decodeUtf16LE`/`encodeUtf16LE` 是 `encodingCodec` 的门面；`.str`/`.lst` 的韩文乱码恢复（CP437 / GBK 双重转码还原）是 PVF 域特有逻辑，权威无对应实现 |
| 单测                 | 权威 `src/vs/workbench/services/textfile/test/node/encoding/encoding.test.ts`（`detectEncodingByBOMFromBuffer` / `detectEncodingFromBuffer` 的用例）、`test/browser/textFileService.test.ts`（决策链经由真实文件服务，无独立纯函数用例）                                                                                          | `npm run check:encoding-oracle`（`scripts/check-encoding-oracle.mjs`：BOM / 零字节 / 猜测 / 决策链 / 编码表 / 往返 / PVF 域档案共 74 项断言）                                                                                                                                                                                        |

### 6.3 格式化

| 功能域                    | VS Code 权威文件                                                                                                                                                                       | 本仓库实现                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 三个 provider 接口        | `src/vs/editor/common/languages.ts:1813-1872`；`FormattingOptions` 仅 `tabSize`/`insertSpaces`（`:1799-1808`）                                                                            | monaco 公开 API（`monaco.d.ts:7098/7103/7108`）+ `src/workbench/contrib/format/` |
| 格式化动作                | `src/vs/editor/contrib/format/browser/formatActions.ts:216`（`editor.action.formatDocument`，Shift+Alt+F）、`:250`（`editor.action.formatSelection`，Ctrl+K Ctrl+F）                      | monaco 内置动作，直接复用                                                      |
| provider 收集与冲突选择   | `src/vs/editor/contrib/format/browser/format.ts:35-70`（range provider 包装成 synthetic 全文档 formatter + 按 `extensionId` 去重）、`:86-105`（`FormattingConflicts.select`）             | M3                                                                            |
| `editor.defaultFormatter` | `src/vs/workbench/contrib/format/browser/formatActionsMultiple.ts:41`（配置名）、`:139-223`（`_analyzeFormatter` / `_selectFormatter` / `_pickAndPersistDefaultFormatter`）、`:360-437`（With... 动作） | M3                                                                            |
| formatOnSave              | `src/vs/workbench/contrib/codeEditor/browser/saveParticipants.ts:216-271`（注册 `:458`）；配置 `files.contribution.ts:391-414`（`editor.formatOnSaveMode` = file/modifications/modificationsIfAvailable） | M3                                                                            |
| 保存参与者调度            | `src/vs/workbench/services/textfile/common/textFileSaveParticipant.ts:34-92`（ordinal 排序、undo stop、`CancellationError` 取消）；写盘点 `textFileEditorModel.ts:853-893`（参与者 `:880` → 写盘 `:937`）                    | M3                                                                            |
| 无 formatters 贡献点      | `src/vs/platform/extensions/common/extensions.ts:214-249` 的 `IExtensionContributions` 里**没有** `formatters`；格式化器一律运行时注册                                                                  | 一致：不自造该贡献点（M3 由内置扩展在 activate 里注册）                            |

### 6.4 插件 / 扩展系统

| 功能域                 | VS Code 权威文件                                                                                                                                                                          | 本仓库实现                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 扩展清单类型           | `src/vs/platform/extensions/common/extensions.ts:307-542`（`main`/`browser`/`activationEvents`/`extensionDependencies`/`contributes`）、`:398`（`ExtensionIdentifier`、大小写不敏感）、`:346`（`TargetPlatform.WEB`） | `src/extensions/*/package.json`（内置扩展清单）                               |
| 贡献点基础设施         | `src/vs/workbench/services/extensions/common/extensionsRegistry.ts:23-159`（`ExtensionMessageCollector` / `IExtensionPointUser` / `ExtensionPoint` / `ExtensionPointUserDelta`）、`:675-700`（`registerExtensionPoint`：去重 + 挂隐式激活事件生成器 + 注册 JSON schema） | `src/workbench/services/extensions/common/extensionsRegistry.js`              |
| 隐式激活事件           | `src/vs/platform/extensionManagement/common/implicitActivationEvents.ts:14-85`（`register` + `readActivationEvents`：`main`/`browser` 都缺则返回空；`onUri` → `onUri:<id>`；按贡献点生成器展开） | `src/platform/extensionManagement/common/implicitActivationEvents.js`         |
| `languages` 贡献点     | `src/vs/workbench/services/language/common/languageService.ts:40-122`（schema）、`:237-275`（handler：校验 → 相对 `configuration`/`icon` 转绝对 URI → `setDynamicLanguages`）                | `src/workbench/services/language/common/languageService.js`                   |
| 宿主抽象               | `src/vs/workbench/services/extensions/common/extensions.ts:122`（`IExtensionHost.start(): Promise<IMessagePassingProtocol>`）、`:412`（`IExtensionService.activateByEvent`）、`extensionHostKind.ts:9-13`（LocalProcess/LocalWebWorker/Remote） | M3                                                                          |
| 浏览器宿主             | `src/vs/workbench/services/extensions/browser/extensionService.ts:46/242-253/360`；`browser/webWorkerExtensionHost.ts:46/133/141/254`（sandbox iframe + MessagePort + 三方握手）              | M3（省 iframe，见第 5 节）                                                    |
| 桌面宿主               | `src/vs/workbench/services/extensions/electron-browser/nativeExtensionService.ts:62/567-578/769`；`localProcessExtensionHost.ts:95/208/231`                                               | M4                                                                          |
| 两端唯一差异           | `src/vs/workbench/api/worker/extHostExtensionService.ts:55-57`（取 `browser` 入口）、`:59-127`（`fetch` + `new Function` 加载）、`:129-131`（不支持 ESM）；`api/node/extHostExtensionService.ts:184-186`（取 `main` 入口）、`:188-216`（`import()`/`require()`） | 扩展产物统一 CJS（见第 5 节）                                                  |
| RPC 与桥接范式         | `src/vs/workbench/services/extensions/common/rpcProtocol.ts:115`；`api/common/extHost.protocol.ts:4046`（`MainContext`）/`:4136`（`ExtHostContext`）；`extHostDocuments.ts:19` ↔ `mainThreadDocuments.ts:126`、`extHostLanguageFeatures.ts:2484-2510` ↔ `mainThreadLanguageFeatures.ts:452-480`、`extHostFileSystem.ts:132` ↔ `mainThreadFileSystem.ts:42` | M3                                                                          |
| 文件系统 scheme 路由   | `src/vs/platform/files/common/files.ts:28/51/678`（`registerProvider`/`IFileSystemProvider`）、`common/fileService.ts:52/90`（`Map<scheme, provider>`）、`abstractExtensionService.ts:130-134`（`onFileSystem:<scheme>` → 激活）                                     | M2b                                                                         |
