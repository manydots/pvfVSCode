# 插件系统设计方案（文件类型 / 编码 / 识别 / 高亮 / 格式化）

> 状态：**设计稿**。第 11 节的 **M0 / M1 / M2a 已落地**（落地位置见第 11、15 节），
> M2b 及其后仍是设计。落地时每一步都要走
> [`AGENTS.md`](../AGENTS.md) 第 3 条门控检查表与第 4 条一致性检查规则。
>
> 权威参考：只读镜像 `../vscode`（VS Code 1.139.0）。下文 `VS Code <path>:<line>` 均指该仓库。
> 本仓库现状文件用 `@/...` 形式书写。

## 0. 结论

1. **五件事收敛成同一范式**：文件访问、文件类型识别、编码决策、语法高亮、格式化，
   全部实现为「**注册表 + 决策链**」，而不是在业务层各写各的 `if/else`。
   这是本方案「合理」与否的唯一判据，也是当前仓库最需要纠正的地方 ——
   设计时 `@/utils/pvfTool.js` 自带 `detectEncoding`、`@/utils/encoding.js` 自带三候选试探与手工码表，
   属于平行体系；M2a 已把这些上收（重复检测删除、手工码表改用 `iconv-lite`）。
2. **扩展系统分两层，与权威一致**：
   - **静态贡献层**（manifest 扫描期进 registry，不需要扩展运行）：`contributes.languages`、
     `contributes.grammars`、`contributes.configuration`、`contributes.commands`/`menus`；
   - **运行时能力层**（扩展 `activate` 后经 RPC 注册）：格式化 provider、语义 token、自定义文件系统 provider。
3. **枢纽是文件系统抽象**：引入 `IFileService` 的 scheme 路由 + `IFileSystemProvider`，
   PVF 归档 = `pvf:` scheme 的 provider。两端只换 provider 实现，打开/识别/编码/保存链路完全共用。
4. **网页端与 Electron 用同一份 ExtHost**，只换宿主实现（Web Worker ↔ Node 进程）与扩展入口字段
   （`browser` ↔ `main`）；这是权威两端唯一的实质差异。
5. **四个依赖 / 自造能力决策必须先取得确认**（见第 12 节），未确认前不动 `package.json`。
   第 1、2 项（`iconv-lite-umd` / `jschardet`）已确认并在 M2a 安装；第 3 项待 M5 评估，
   第 4 项的自建部分按里程碑分批落地。

## 1. 权威依据（已逐条读源码核对）

| 子系统 | 权威文件 | 关键结论 |
| --- | --- | --- |
| 语言声明字段 | `src/vs/editor/common/languages/language.ts:13-25` | `ILanguageExtensionPoint`：`id`/`extensions`/`filenames`/`filenamePatterns`/`firstLine`/`aliases`/`mimetypes`/`configuration` |
| 语言注册合并 | `src/vs/editor/common/services/languagesRegistry.ts:111-176` | 内置（`ModesRegistry`）+ 扩展动态声明按 `id` 合并；`_mergeLanguage` 中带 `configuration` 的条目 `extensions` 被 unshift 到最前 |
| **识别优先级** | `src/vs/editor/common/services/languagesAssociations.ts:139-243` | 用户 `files.associations` > 平台注册 > `firstLine` 兜底；内部 `filename` 精确 > 最长 `filenamePatterns` > 最长 `extensions`；倒序遍历（后注册优先） |
| 首行匹配 | `languagesAssociations.ts:245-268` | 去 UTF-8 BOM 后正则 match；首行文本截断 1000 字符（`src/vs/editor/common/model.ts:1508`） |
| `files.associations` | `src/vs/workbench/contrib/files/browser/files.contribution.ts:183-190`；消费方 `src/vs/workbench/services/language/common/languageService.ts:294-317` | 含路径分隔符则匹配整条路径，否则只匹配文件名；作为 user 层覆盖平台层 |
| 编码枚举 | `src/vs/workbench/services/textfile/common/encoding.ts:512-781` | `SUPPORTED_ENCODINGS` 49 项（`labelLong`/`labelShort`/`order`/`encodeOnly`/`guessableName`）；BOM 常量 `:23-25` |
| **打开时编码决策** | `src/vs/workbench/services/textfile/browser/textFileService.ts:834-886` | 顺序是 **BOM/零字节探测 → 自动猜测 → 显式 option.encoding → `files.encoding` 配置**（不是「配置优先」），最后 `encodingExists` 校验并回退 UTF-8 |
| 写盘编码 | 同上 `:819-832` | UTF-16/带 BOM 编码强制写 BOM |
| 编码配置 | `files.contribution.ts:190-215` | `files.encoding`（`scope: LANGUAGE_OVERRIDABLE`，默认 `utf8`）、`files.autoGuessEncoding`（默认 `false`）、`files.candidateGuessEncodings` |
| 编码实现依赖 | 权威 `package.json:122 / :152` | `@vscode/iconv-lite-umd@0.7.1`（编解码）+ `jschardet@3.1.4`（猜测）。**web 与 Node 共用同一份**，web 端并不依赖浏览器原生 legacy 编码支持 |
| 状态栏编码条目 | `src/vs/workbench/browser/parts/editor/editorStatus.ts:543-558` | entry id `status.editor.encoding`，点击 → `workbench.action.editor.changeEncoding`（`:1434`），quick pick 数据来自 `SUPPORTED_ENCODINGS` + 实时猜测（`:1502-1551`） |
| 格式化 provider | `src/vs/editor/common/languages.ts:1813-1872` | 三个接口 + `FormattingOptions` 仅 `tabSize`/`insertSpaces`（`:1799-1808`） |
| 格式化动作 | `src/vs/editor/contrib/format/browser/formatActions.ts:216 / :250` | `editor.action.formatDocument`（Shift+Alt+F）、`editor.action.formatSelection`（Ctrl+K Ctrl+F） |
| provider 收集与选择 | `src/vs/editor/contrib/format/browser/format.ts:35-105` | range provider 会包装成 synthetic 全文档 formatter；`FormattingConflicts.select` 无 selector 时返回 undefined |
| `editor.defaultFormatter` | `src/vs/workbench/contrib/format/browser/formatActionsMultiple.ts:41 / :139-223` | 读取带 `overrideIdentifier: languageId`；多 provider 冲突时 `_selectFormatter` 走 Explicit/Silent 两分支 |
| formatOnSave | `src/vs/workbench/contrib/codeEditor/browser/saveParticipants.ts:216-271`（注册 `:458`）；配置 `files.contribution.ts:391-414` | 是 `ITextFileSaveParticipant`；`SaveReason.AUTO` 直接跳过；`formatOnSaveMode` = `file`/`modifications`/`modificationsIfAvailable` |
| 参与者调度时序 | `src/vs/workbench/services/textfile/common/textFileSaveParticipant.ts:34-92`；写盘点 `textFileEditorModel.ts:853-893`（参与者 `:880`，写盘 `:937`） | 按 `ordinal` 排序、前后各插 undo stop、抛 `CancellationError` 取消整个 save |
| formatters 贡献点 | `src/vs/platform/extensions/common/extensions.ts:214-249` | **不存在** `contributes.formatters` —— 格式化器一律运行时注册 |
| 扩展 manifest | `src/vs/platform/extensions/common/extensions.ts:307-542` | `main`（Node 入口）/`browser`（Web 入口）/`activationEvents`/`extensionDependencies`/`contributes` |
| 扩展点基础设施 | `src/vs/workbench/services/extensions/common/extensionsRegistry.ts:675-700`、`:23-159` | `registerExtensionPoint` + `ExtensionPoint` + `ExtensionMessageCollector`；注册时自动挂隐式激活事件生成器 |
| 隐式激活事件 | `src/vs/platform/extensionManagement/common/implicitActivationEvents.ts:14 / :49-84` | `contributes.languages` 声明 `configuration` 时自动生成 `onLanguage:<id>` |
| 宿主抽象 | `src/vs/workbench/services/extensions/common/extensions.ts:122`；`extensionHostKind.ts:9-13` | `IExtensionHost.start(): Promise<IMessagePassingProtocol>`；kind = LocalProcess / LocalWebWorker / Remote |
| 浏览器宿主 | `src/vs/workbench/services/extensions/browser/extensionService.ts:46 / :242-253 / :360`；`browser/webWorkerExtensionHost.ts:46 / :133 / :254` | 工厂按 kind 建宿主；Web Worker 宿主经 sandbox iframe + `MessagePort` 建协议，三方握手 `Ready`/`Initialized` |
| 桌面宿主 | `src/vs/workbench/services/extensions/electron-browser/nativeExtensionService.ts:62 / :567-578 / :769`；`localProcessExtensionHost.ts:95 / :208 / :231` | Node 进程宿主（`VSCODE_ESM_ENTRYPOINT`）；桌面端同样能跑 `LocalWebWorker` 宿主 |
| 两端唯一差异 | `src/vs/workbench/api/worker/extHostExtensionService.ts:55-57 / :59-127`、`src/vs/workbench/api/node/extHostExtensionService.ts:184-186 / :188-216` | 入口字段 `browser` vs `main`；加载方式 `fetch` + `new Function`（**worker 不支持 ESM**，`:129-131`）vs `import()`/`require()` |
| RPC | `src/vs/workbench/services/extensions/common/rpcProtocol.ts:115`；`api/common/extHost.protocol.ts:4046 / :4136` | `MainContext` / `ExtHostContext` 代理标识 |
| 桥接范式 | `api/common/extHostDocuments.ts:19` ↔ `api/browser/mainThreadDocuments.ts:126`；`extHostLanguageFeatures.ts:2484-2510` ↔ `mainThreadLanguageFeatures.ts:452-480`；`extHostFileSystem.ts:132` ↔ `mainThreadFileSystem.ts:42` | 均以「数字 handle + `$register…`」注册 |
| 文件系统 | `src/vs/platform/files/common/files.ts:28 / :51 / :678`；`common/fileService.ts:52 / :90` | `registerProvider(scheme, provider)`，scheme 路由就是一个 Map；`onFileSystem:<scheme>` 触发扩展激活（`abstractExtensionService.ts:130-134`） |

### 1.1 monaco-editor 0.56 的能力边界（决定哪些必须自建）

| 能力 | monaco 现状 | 结论 |
| --- | --- | --- |
| `monaco.languages.register` | 有，`esm/vs/editor/standalone/browser/standaloneLanguages.js:24-28` → `ModesRegistry.registerLanguage` | 直接复用，识别算法与权威同源 |
| `files.associations` 用户层 | **无**（`languagesAssociations.js` 只导出 `getLanguageIds` / `registerPlatformLanguageAssociation` / `clearPlatformLanguageAssociations`，用户层注册入口未导出） | 只补用户层；平台层与首行兜底直接复用 monaco 同一份实现 |
| `getLanguages()[].name` | 无 `name` 字段，只有 `aliases` | 现有 `@/monaco/languageNames.js` 已按 `aliases[0]` 处理，正确 |
| TextMate 语法 | **从不支持**（只有 Monarch / 手写 tokenizer） | v1 用 Monarch；TextMate 需新增依赖（第 12 节） |
| 模型编码 | `ITextModel` 无任何 encoding API（`monaco.d.ts:1309 / :2301`） | 编码必须在 workbench 层，不能在模型层 |
| 格式化 provider | 有（`monaco.d.ts:7098 / :7103 / :7108`），但描述符**无 `extensionId`**（`:8485-8491`） | 注册时自己包一层带 `extensionId` 的描述符 |
| formatter 选择 | `FormattingConflicts` 被硬编码为永远选 `formatter[0]`（`esm/vs/editor/editor.api.js:19`） | 自建选择协议 + quick pick |
| formatOnSave / save participants | **完全没有** | 自建保存参与者管线 |
| `formatDocument.multiple/.none`、`formatChanges` | 不存在（属 workbench 层） | 自建 |

## 2. 总体架构

```
                     ┌──────────────── 静态贡献层（扫描期，无扩展进程） ────────────────┐
  manifest.json  ──► │ ExtensionsRegistry.registerExtensionPoint                      │
                     │   ├ languages  ──► LanguageRegistry（id/aliases/后缀/首行）     │
                     │   ├ grammars   ──► GrammarRegistry（scopeName → grammar URI）  │
                     │   ├ configuration ─► configurationRegistry（默认值）           │
                     │   └ commands/menus ─► actions / MenuRegistry                   │
                     └───────────────────────────────────────────────────────────────┘
                                          │
  ┌──── 运行时能力层（扩展 activate 后，经 RPC 注册；两端同一份 ExtHost） ────────────┐
  │ ExtHost  ⇄ RPCProtocol ⇄ MainThread                                            │
  │   ExtHostLanguageFeatures → MainThreadLanguageFeatures → FormattingRegistry     │
  │   ExtHostFileSystem       → MainThreadFileSystem       → IFileService(scheme)   │
  │   ExtHostDocuments        → MainThreadDocuments        → Monaco ITextModel      │
  └────────────────────────────────────────────────────────────────────────────────┘
                                          │
  ┌──── 内核决策链（本仓库要写的主体，纯函数优先，可单测） ─────────────────────────┐
  │ 资源 URI ─► 语言关联匹配器 ─► languageId                                        │
  │ 字节流   ─► EncodingOracle  ─► { encoding, hasBOM }  ─► IEncodingCodec(iconv)   │
  │ 资源 URI ─► IFileService.getProvider(scheme) ─► IFileSystemProvider             │
  │ 语法     ─► Monarch / (TextMate) ─► Monaco TokenizationRegistry                 │
  └────────────────────────────────────────────────────────────────────────────────┘
```

**为什么是这个形状**：权威把「声明」与「能力」分开，是因为声明必须能被扫描而无需执行扩展代码；
裁剪客户端同样需要这一点 —— PVF 业务（内置扩展）声明了 `.lst`/`.nut` 之后，用户打开归档文件时
内核已经知道该怎么识别与着色，而不需要先把 PVF 扩展跑起来。

## 3. 文件：FileService 与 scheme 路由（枢纽）

对齐 `VS Code src/vs/platform/files/common/files.ts:28 / :51 / :678` 与 `common/fileService.ts:52 / :90`。

- `IFileSystemProvider` 保留五个必需方法：`stat` / `readdir` / `readFile` / `writeFile` / `watch`，
  能力声明用 `capabilities`（`FileSystemProviderCapabilities`），与权威一致；
- `FileService.registerProvider(scheme, provider)` 用 `Map<scheme, provider>` 路由，
  重复注册报错（同权威 `:53`）；读取前先 `activateProvider(scheme)` 并广播
  `onWillActivateFileSystemProvider`，由扩展服务转成 `activateByEvent('onFileSystem:' + scheme)`
  （对齐 `abstractExtensionService.ts:130-134`）。

scheme 规划：

| scheme | provider 实现 | 阶段 |
| --- | --- | --- |
| `file:`（web） | 浏览器 provider：只读走 `fetch`，读写走 File System Access API（不可用时降级为只读） | M2b |
| `file:`（electron） | Node provider：`fs.promises` + `chokidar`/`fs.watch` | M4 |
| `pvf:` | **PVF 归档 provider**：包装现有 `PvfArchive`（`@/utils/pvfTool.js`）的 `_parseFileTable`/`decodeContent`/`encodeContent`/`setFileContent` 等 | M2b |
| `untitled:` | 内存 provider（无 provider，仅模型层，对齐权威） | M2b |

关键取舍：**PVF 归档不做成「先解包到临时目录再用 file: 打开」**。理由是权威的编辑链
（`ITextFileService` → 模型 → 保存参与者 → 写回）只认 URI + provider，解包方案会引入
「临时文件与归档的双向同步」这个权威不存在的概念（违背门控 §3）。走 provider 则
「保存 = `writeFile` → `setFileContent` → 归档内存态变更」，与普通文件同构。

## 4. 文件类型识别

### 4.1 结构（M1 已落地，实现在此为准）

实现文件（三份，职责不重叠）：

| 文件 | 职责 |
| --- | --- |
| `@/workbench/services/language/common/languageAssociations.js` | **纯函数**：用户层关联表 + 三步合成的决策函数。零 monaco 运行时依赖（只 import `languagesAssociations.js` / `glob.js` / `path.js` / `modesRegistry.js` 四个纯模块），可跑 Node 单测 |
| `@/workbench/services/language/common/languageService.js` | `languages` 扩展点（校验 + `monaco.languages.register`）、`files.associations` 配置订阅与重算、`preferredLanguageId` 弱映射 |
| `@/workbench/contrib/files/browser/files.contribution.js` | `files.associations` 的设置项 schema（`id: 'files'`） |

**关键决策：只补用户层，不重写匹配算法。**

权威是三步（`languagesAssociations.ts:139-189`）：① 用户层 `files.associations`
（`getAssociationByPath` + `userRegisteredAssociations`）→ ② 平台层（各语言的
`extensions` / `filenames` / `filenamePatterns`）→ ③ `firstLine` 兜底。

其中 ②③ 在 `<vscode>` 与 monaco 发行包里是**同一份源码**（逐行相同），monaco 已经导出
`getLanguageIds` 用它们；而 `registerConfiguredLanguageAssociation` 这个用户层入口
**没有被导出**。所以正确做法是：

- ②③ **直接调 `getLanguageIds(resource, firstLine)`**，不重写 —— 重写等于自造平行体系（门控 §3）；
- ① 自己实现（`registerConfiguredLanguageAssociation` / `clearConfiguredLanguageAssociations`
  / `_getAssociationByPath`），逐条对齐 `:89-101`、`:191-243`：用户项只带 `filepattern`
  （注册形态见 `languageService.ts:310-312`），命中规则为「含 `/` 匹配整条路径，否则匹配
  basename」「倒序遍历（后注册优先，fixes microsoft/vscode#20074）」「最长 pattern 胜出」。

合成顺序与权威等价：用户层永远不带 `firstline`，所以「用户层 path 命中 → 否则交给 monaco 的 ②③」
就是权威的三步顺序。

**路径推导**（`_pathOfResource`）：`file` → `fsPath`，其余（`pvf` / `untitled`）→ `resource.path`，
与权威 `:140-159` 的 default 分支一致；权威另有 `data:` 与 `vscode-notebook-cell` 两个分支，
本仓库没有这两种资源（已登记偏差）。

**落语言的两条附加规则**（都取自权威，不是自造）：

1. `resolveLanguageId(resource, preferredLanguageId, firstLine, registeredIds)` ——
   显式语言（非 `plaintext`）优先于路径识别（`textEditorModel.ts:204-213`），
   且识别到的语言未注册时回落 `plaintext`（`editor/common/services/languageService.ts:121-128`
   的 `_createAndGetLanguageIdentifier`）。第 2 条是必需的：`files.associations` 里写错语言 id
   时权威显示 plaintext，而不是一个不存在的语言。
2. `preferredLanguageId` 的存在形态：权威存在 `TextFileEditorModel` 上（`:116`），
   本仓库的等价物是「monaco 模型 → 语言 id」的 `WeakMap`（`languageService.js`），
   由 `editorGroupService._createEntry` 在输入带显式语言或没有资源时写入。模型释放后条目自动消失。

**注册入口的时序是硬约束**：`monaco.languages.setLanguageConfiguration` 对未注册的语言
**直接抛错**（`standaloneLanguages.js:81-88` 的 `Cannot set configuration for unknown language`），
所以启动顺序必须是「投递内置扩展清单（→ `monaco.languages.register`）→ 初始化语言服务 → 激活扩展」，
见 `src/main.js` 的扩展装配三步。

**注册入口的形态也是硬约束**：`setLanguageConfiguration` 只接受**编辑器内部形态**
（`autoClosingPairs` / `surroundingPairs` 为 `{ open, close }` 对象），而扩展里写的是
**序列化形态**（`language-configuration.json` 允许的二元组），中间必须过
`extractValidConfig` 归一化 —— 少了它会在打开编辑器时抛
`Cannot read properties of undefined (reading 'charAt')`（monaco 的 `AutoClosingPairs`
无条件读 `pair.open.charAt(0)`）。细节与回归护栏见第 13 节 6a 与
`check:language-configuration`。

语言由**扩展清单**声明（`contributes.languages`），不由核心代码硬编码 —— 与权威一致：
VS Code 核心不含 Squirrel，各语言支持来自扩展（对照 `<vscode>/extensions/lua/package.json`）。

### 4.2 触发源（门控 §4.4 要求）

对权威文件执行 `grep -n "onDid[A-Z]\|addEventListener\|onDidChangeConfiguration\|observe("`
后逐条给出结论。

| 触发源 | 权威出处 | 结论 |
| --- | --- | --- |
| `files.associations` 配置变化 | `workbench/services/language/common/languageService.ts:278-283` | **已迁移**：`languageService.js` 的 `initLanguageService()` → `configurationService.onDidChangeConfiguration`，仅在 `affectsConfiguration("files.associations")` 时重算 |
| 已安装扩展注册完成 | 同上 `:284-286` 的 `whenInstalledExtensionsRegistered().then(updateMime)` | **不适用**（暂时）：本仓库的扩展在启动时一次装齐，`registerBuiltinExtensions()` 的调用点即「注册完成」；M3 引入扩展宿主后改为订阅该事件 |
| 语言被请求时激活扩展 | 同上 `:287-291` 的 `onDidRequestRichLanguageFeatures` → `activateByEvent('onLanguage:<id>')` | **已登记偏差**（第 13 节第 9 条）：需要扩展宿主，M3 实现；M1 的 `activationEvents` 只声明未被消费 |
| 语言表变化事件 | 同上 `:316` 的 `_onDidChange.fire()` | **不适用**：权威的消费方是语言表渲染器（扩展详情页，`:124-235`）；本仓库没有该界面。`files.associations` 变化后的下游通知由 `updateConfiguredLanguageAssociations()` 末尾的 `onDidChangeLanguage` 承担 |
| 关联变化后重解析已打开模型 | `workbench/services/textfile/common/textFileEditorModel.ts:199-209` 的 `onDidChangeFilesAssociation` | **已迁移**：`languageService.js` 的 `applyLanguageToOpenModels()`，逐模型 `monaco.editor.setModelLanguage`；跳过 `untitled`（权威只有 `TextFileEditorModel` 订阅该变化，无标题模型保留用户选定的语言模式） |
| 匹配算法内部 | `editor/common/services/languagesAssociations.ts`、`workbench/services/extensions/common/extensionsRegistry.ts` | **无事件**（两文件 `grep onDid` 为空），无需触发源清单 |
| 模型的 `onDidChangeLanguage` | 模型自身事件 | **已迁移**（既有）：`editorGroupService.js` 的 `model.onDidChangeLanguage` → `entry.languageId`，状态栏语言条目由它派生 |

**这个部件的什么变化会让它更新？**（把语言模式条目改错的典型原因，逐条落到 `文件:行号`）

1. `files.associations` 配置变化 → `languageService.js:initLanguageService` 的配置订阅 →
   `updateConfiguredLanguageAssociations`（`languageService.js`）→ `applyLanguageToOpenModels` →
   `monaco.editor.setModelLanguage` → `model.onDidChangeLanguage`（`editorGroupService.js`）
   → `entry.languageId` → 状态栏 `status.editor.mode`。
2. 打开新文件 → `editorGroupService._createEntry` → `resolveLanguageId`（显式语言 > 路径识别，
   未注册回落 plaintext）。
3. 用户显式切换语言模式 → 目前只有「登记偏好语言」的通路（`setPreferredLanguageId`），
   切换动作本身随 M2b 的 `workbench.action.editor.changeLanguageMode` 落地（快速输入浮层已具备）。

## 5. 编码

### 5.1 决策链（对齐权威语义，注意顺序）

决策链是纯函数（`@/workbench/services/textfile/common/encoding.js`），
按权威的四个方法逐条对应拆成 `getUnvalidatedEncoding` / `getValidatedEncoding` /
`getPreferredReadEncoding` / `getPreferredWriteEncoding`，外加两步合成的 `resolveReadEncoding`。
权威的 `resource` 参数只为两件事存在 —— 读 `files.*` 配置、查编码覆盖 —— 两者都已外移，
故纯函数不再收 `resource`，改收已解析好的 `IEncodingInput`：

```
IEncodingInput = {
  configEncoding,            // files.encoding（按资源解析后的值）
  configAutoGuessEncoding,   // files.autoGuessEncoding
  candidateGuessEncodings,   // files.candidateGuessEncodings
  encodingOverride           // 语言/资源级覆盖（权威 ResourceEncodingRegistry）
}
```

取值在浏览器层完成：`@/workbench/services/textfile/browser/encodingInput.js`（`createEncodingInput`）。
语义逐条对齐 `browser/textFileService.ts:826-886`：

```
1. BOM / 零字节探测（detectEncodingFromBuffer）
2. 自动猜测（仅当 option.autoGuessEncoding 或 files.autoGuessEncoding 为真）
3. encodingOverride > option.encoding > 探测结果 > files.encoding
4. encodingExists 校验，不认识则回退 utf8
5. BOM 语义：detected=utf8bom 且最终为 utf8 → 保留 utf8bom（防丢 BOM）；
   utf16be / utf16le / utf8bom 三种编码的 hasBOM 恒为 true（写出时强制带 BOM）
```

注：`files.encoding` 的语言级 override（第 3 步配置项的 `[language]` 段）未迁入，
`encodingOverride` 目前无产出方 —— 与「无语言/资源级设置覆盖」是同一项，已登记偏差。

**PVF 归档编码的接入方式**：归档级 `strEncoding` 作为 **`preferredEncoding`**（等价于
`option.encoding`，即「显式指定」）传入，优先级最高 —— 这样「打开归档内文件用归档编码」
不需要新语义，直接复用权威的「显式 option > 配置」规则。**不新增**「归档编码」这一自造概念。
归档自己的编码探测（sTrA 字符串表）复用同一个 `detectEncodingFromBuffer`，
候选集与名字映射在 `@/utils/pvfEncoding.js`（见第 13 节）。

### 5.2 编解码实现（M2a 已落地）

- 收敛为 `encodingCodec`：`decode(bytes, enc)` / `encode(text, enc, { addBOM })` / `exists(enc)`，
  实现层两端相同（权威即如此，web 不依赖浏览器原生 legacy 编码支持）；`utf8bom` 在编解码名上
  归一为 `utf8`，BOM 由 `addBOM` 决定（对齐 `toNodeEncoding` + `hasBOM`）。
- 已修复：`@/utils/encoding.js` 对 `euc-kr`/`cp949` 的 **encode 静默回退 UTF-8**
  （数据损坏风险），现在编码名不受支持即抛错；三份手工单字节码表与自带 GBK 查表已删除。
- 已收敛：`@/utils/pvfTool.js` 与 `@/utils/pvfToolTw.js` 不再自带检测，
  `@/utils/encoding.js` 的 `detectEncoding` 只是门面（门控 §4.1 第 6 条「同一语义只允许一份实现」）。

### 5.3 状态栏与动作

- entry id `status.editor.encoding`（对齐 `editorStatus.ts:543-558`），显示 `labelShort`（M2a 已落地，
  取值映射对齐 `:900-906`）；
- 动作 `workbench.action.editor.changeEncoding`（对齐 `:1434`），quick pick 两个条目
  `Save with Encoding` / `Reopen with Encoding`，列表来自 `SUPPORTED_ENCODINGS` 按 `order` 排序、
  当前配置置顶、Reopen 过滤 `encodeOnly`（对齐 `:1512-1551`）—— **属 M2b**：
  它需要 `ITextFileService` 的「按原字节重读」路径，M2a 尚无文件服务。

## 6. 代码高亮

三档，按阶段启用：

| 档位 | 注册方式 | 依赖 | 阶段 |
| --- | --- | --- | --- |
| **Monarch** | `monaco.languages.setMonarchTokensProvider(id, def)` | 无 | M1 |
| **TextMate** | `contributes.grammars`（`scopeName`/`path`/`injectTo`/`embeddedLanguages`）+ `vscode-textmate` + `vscode-oniguruma` | 两个新依赖 + `.wasm` 静态资源 | M5（需确认） |
| **Semantic tokens** | `monaco.languages.registerDocumentSemanticTokensProvider` | 语言服务 | 暂不做 |

TextMate 的关键设计点：解析在**主线程**（权威 `TMGrammarFactory` 在渲染进程，
`src/vs/workbench/services/textMate/common/TMGrammarFactory.ts:115-143`），
所以 `contributes.grammars` 是静态贡献点 —— 扫描期建 `language → scopeName → grammar URI` 索引，
`onLanguage:` 激活时才 `fetch` grammar 文件。第三方扩展贡献 tmLanguage 因此「零运行时代码」。

PVF 语言 v1 用 Monarch，由内置 PVF 扩展声明。语言 id 与扩展名的对应关系取自
`@/utils/pvfTool.js` 的 `CONTENT_DECODERS`（`:129-132`，解码器按「归档内 dataType + 扩展名」选）：

| 语言 id | 扩展名 | 对应解码形态 | 词法来源 |
| --- | --- | --- | --- |
| `squirrel` | `.nut` | Squirrel 脚本源码（`.nut` 也存在 dataType=3 的 UTF-16 形态） | Squirrel 语言规范；仓库内对照样本 `@/samples/common.nut` |
| `pvf-list` | `.lst` | `decodeLst`（「数字 + 反引号串」逐行） | `pvfTool.js` 的 `decodeLst:751-800` / `encodeTokenText:1303-1384`；对照样本 `@/samples/n_string.lst` |
| `pvf-dat` | `.dat` | `decodeDat`（定长数字记录表，探测失败回退 `decodeToken`） | 同上 |
| `pvf-token` | `.str` `.aic` `.ani` `.etc` `.stk` | `decodeToken` / `decodeTokenIndented`（通用 token 流） | 同上；对照样本 `@/samples/690017000.stk`、`@/samples/2011_championship_pack_at_ft.stk` |

`.stk` 属 `CONTENT_DECODERS` 里 dataType=1 未登记的后缀，走该 dataType 的默认方法 `decodeToken`
（TW 归档的 `.stk` 同样走 token 流，见 `pvfToolTw.js:1002-1005` 的分派），故并入 `pvf-token`。
`stringtable.bin` 是 TW 归档专用的字符串表可读视图（`索引>文本`，`pvfToolTw.js:413-424`），
不由 `CONTENT_DECODERS` 产生、也没有对应语言，故按纯文本打开（登记在
[`vscode-reference.md`](vscode-reference.md) 第 5 节）。

样本文件本身（`@/samples/*`）在构建期由 `@/builtInFiles.js` 用 `import.meta.glob(..., '?raw')`
整体内联，作为「快速打开（Ctrl+P）→ 内置文件」的取数来源；新增样本文件不需要改代码。

三种 PVF 文本形态（`pvf-list` / `pvf-dat` / `pvf-token`）**共用一份 Monarch 词法与语言配置**
（`src/extensions/pvf/browser/pvfText.js`）—— 它们的区别只在「用哪个 decoder」，
与高亮无关（门控 §4.1 第 6 条：同一语义只允许一份实现）。
两种行注释（`// xxx` 与 `#PVF_File` 这类 `#` 开头的行）在同一份词法里等价；写回
（`encodeTokenText` / `encodeTwToken`）与校验（`validatePvfText`）两端保持同一规则，
注释颜色取 VS Code 经典的注释绿 `#6A9955` —— 见 [`vscode-reference.md`](vscode-reference.md)
第 4.15 节与第 5 节。

注意 M1 的清单只声明 `contributes.languages` 的 `id`/`extensions`/`aliases`/`mimetypes`：
`configuration`（language-configuration.json 文件加载）与 `grammars`（TextMate）两条通道
尚未接通，声明了也不会被消费，故不声明；等价能力改由扩展的 `activate()` 以代码注册
（`monaco.languages.setLanguageConfiguration` / `setMonarchTokensProvider`），
待 M3 / M5 接通后再切回清单声明。走代码注册时，扩展里写的仍是**序列化形态**的配置
（与 `language-configuration.json` 同形），必须经 `extractValidConfig` 转成编辑器内部形态
再传入（`src/extensions/pvf/browser/pvfExtension.js`），否则 `autoClosingPairs` 的二元组会在
monaco 里崩掉 —— 见第 13 节 6a。差异见第 13 节。

## 7. 格式化

### 7.1 直接映射 monaco 的部分

`registerDocumentFormattingEditProvider` / `…RangeFormatting…` / `…OnTypeFormatting…`
三个注册入口，编辑器动作 `editor.action.formatDocument`（Shift+Alt+F）与
`editor.action.formatSelection`（Ctrl+K Ctrl+F）均已由 monaco 内置，直接用。

### 7.2 必须自建的工作台部分（monaco 缺口）

| 能力 | 权威出处 | 自建落点 |
| --- | --- | --- |
| `editor.defaultFormatter` 读写（带 resource + language override） | `formatActionsMultiple.ts:41 / :139-223` | `@/workbench/contrib/format/browser/defaultFormatter.js` |
| formatter 选择协议（替换 monaco 硬编码 `formatter[0]`） | `format.ts:86-105` 的 `FormattingConflicts` | 同上；因 `setFormatterSelector` 未公开，需在 monaco 之外自己选定后调用 `formatDocument` 前替换 provider 顺序 / 自建执行函数 |
| `Format Document With...` / `none` 动作 | `formatActionsMultiple.ts:360-437`、`formatActionsNone.ts:19-67` | `@/workbench/contrib/format/browser/formatActionsMultiple.js` |
| provider 的 `extensionId` 身份 | monaco 描述符无此字段 | 注册时包一层 `{ ...provider, extensionId }`；去重与 synthetic 包装对齐 `format.ts:35-70` |
| save participants 管线（ordinal 排序、undo stop、取消） | `textFileSaveParticipant.ts:34-92` | `@/workbench/services/textfile/common/textFileSaveParticipant.js` |
| formatOnSave / formatOnSaveMode | `saveParticipants.ts:216-271` | `@/workbench/contrib/codeEditor/browser/saveParticipants.js` |
| `trimTrailingWhitespace` / `insertFinalNewline` / `trimFinalNewlines` | `saveParticipants.ts:39-214` | 同上（**不塞进** monaco 的 `FormattingOptions`，权威也不塞） |
| `Format Modified Lines` | `formatModified.ts:51-82` | 需 diff 能力，暂不做（登记偏差） |

### 7.3 格式化器与插件的关系

权威**没有** `contributes.formatters` 贡献点，格式化器一律由扩展在 `activate` 里调 API 注册。
**本方案不自造该贡献点**（自造会引入与权威相悖的平行体系）。PVF 的 `.lst` 缩进/对齐格式化器
（可包装现有 `PvfScriptIndenter`，`@/utils/pvfTool.js:80`）作为内置扩展的运行时注册，
正好打通「运行时能力层」这条链路。

## 8. 插件系统本体

### 8.1 静态贡献层（M1，无扩展宿主）

M1 已落地的文件：

| 文件 | 职责 |
| --- | --- |
| `@/platform/extensions/common/extensions.js` | 清单/描述类型：`ExtensionIdentifier`、`ExtensionIdentifierSet`、`createExtensionDescription`（对齐 `platform/extensions/common/extensions.ts:307-542`），只保留本仓库需要的字段 |
| `@/platform/extensionManagement/common/implicitActivationEvents.js` | 隐式激活事件（`contributes.languages[].configuration` → `onLanguage:<id>`，对齐 `implicitActivationEvents.ts:14-85`） |
| `@/workbench/services/extensions/common/extensionsRegistry.js` | `registerExtensionPoint` / `ExtensionPoint` / `ExtensionMessageCollector`（对齐 `:675-700`、`:23-159`），含「注册即挂隐式激活事件生成器」与 `setExtensionDescriptions`（对齐 `abstractExtensionService.ts:1227-1239` 的 `_handleExtensionPoint`） |
| `@/workbench/services/extensions/common/builtinExtensions.js` | 内置扩展清单的静态引入与投递（对齐 `builtinExtensionsScannerService.ts:28-95`；没有运行期目录扫描，清单即扫描结果） |
| `@/extensions/pvf/{package.json,browser/*}` | 内置扩展本体：清单 + 词法/语言配置/符号提供者的 `activate()` |

贡献点登记原则：**清单只声明当前里程碑真的会消费的字段**。声明了却没有消费方的字段
是静默失效（门控 §4.4 禁止静默偏离），因此 `contributes.languages[].configuration` 与
`contributes.grammars` 在 M3 / M5 接通加载通道之前不出现在清单里，等价能力由 `activate()` 以代码注册。

- 后续贡献点：`configuration`、`commands`、`menus`（复用仓库已有 `@/menu/actions.js`
  与 `@/platform/configuration/common/configurationRegistry.js`）—— 各自随其消费方落地。
- 扩展清单来源（web 阶段）：内置扩展用 **构建期内联的 manifest 数组**
  （`builtinExtensions.js`），用户扩展后续从 IndexedDB / URL 加载（M5）。
- 激活（M1）：**进程内直接调用 `activate`**（`@/workbench/contrib/pvf/browser/pvf.contribution.js`），
  激活事件暂不参与；清单里的 `activationEvents` 由 M3 消费。这是「激活链路」的退化形态，
  不是新概念 —— 该模块就是清单 `browser` 字段所指模块的加载与调用点。

### 8.2 运行时能力层（M3）

- `IExtensionHost`（`IExtensionService` 共用的宿主抽象，对齐 `services/extensions/common/extensions.ts:122`）
  - **web**：`WebWorkerExtensionHost`，对齐 `browser/webWorkerExtensionHost.ts:133 / :254`；
    **省掉 sandbox iframe**（Vite 可直接产出 worker 入口），登记偏差；
  - **electron**（M4）：`LocalProcessExtensionHost`，对齐 `localProcessExtensionHost.ts:208 / :231`。
- `RPCProtocol` + `MainContext`/`ExtHostContext` 代理标识（对齐 `rpcProtocol.ts:115`、`extHost.protocol.ts:4046 / :4136`）。
- MVP 四个 customer：`Documents`、`LanguageFeatures`、`FileSystem`、`ExtensionService`
  （桥接范式对齐 `extHostDocuments.ts:19` ↔ `mainThreadDocuments.ts:126` 等三对）。
- 激活：`ExtensionDescriptionRegistry` 的 `_activationMap`（`extensionDescriptionRegistry.ts:71-89`）
  + `ExtensionsActivator.activateByEvent`（`extHostExtensionActivator.ts:166 / :217`）+ 去重。
  首批支持事件：`onLanguage:<id>`、`onCommand:<id>`、`onFileSystem:<scheme>`、`onStartupFinished`、`*`。
- `ExtensionContext` 冻结对象（对齐 `extHostExtensionService.ts:501 / :527`），
  `globalState`/`workspaceState` 复用仓库已有 `@/platform/storage/*`。

### 8.3 扩展产物格式（两端统一的关键决策）

权威 Node 宿主支持 ESM/CJS（`node/extHostExtensionService.ts:188-216`），
但 Web Worker 宿主**明确不支持 ESM**（`worker/extHostExtensionService.ts:129-131`），
加载方式是 `fetch(source)` + `new Function('module','exports','require', source)`（`:59-127`）。

**决策：扩展产物统一为 CJS 单文件 bundle**，两端同一份产物。
代价是 Electron 端也不支持 ESM 扩展 —— 这是 web 端约束倒逼的一致化，需登记偏差。
好处是「同一个 `.vsix`/扩展包在两端行为完全一致」，且不需要维护两套加载器。

### 8.4 扩展代码的获取

| 阶段 | web | electron |
| --- | --- | --- |
| 内置扩展 | 构建期内联（`?raw` / manifest 数组） | 随包 `extensions/` 目录扫描 |
| 用户扩展 | IndexedDB 或 URL fetch（后续） | 磁盘目录扫描（对齐 `cachedExtensionScanner`） |

## 9. 浏览器 → Electron 兼容策略

| 层 | web | electron | 是否共用 |
| --- | --- | --- | --- |
| ExtHost API / RPC 协议 / 扩展产物 | 同 | 同 | ✅ 完全共用 |
| 宿主实现 | `WebWorkerExtensionHost` | `LocalProcessExtensionHost` | ❌ 仅此不同 |
| 扩展入口字段 | `browser` | `main` | ❌ 由 manifest 同时声明 |
| 编码 oracle / codec | iconv-lite-umd（纯 JS） | 同 | ✅ |
| `file:` provider | File System Access / fetch | Node `fs` | ❌ |
| `pvf:` provider | 同 | 同 | ✅（纯 JS 解析，无平台依赖） |
| 语言识别 / 高亮 / 格式化 | 同 | 同 | ✅ |

**结论**：两端差异被收敛到「宿主实现 + `file:` provider + 入口字段」三处，
其余全部共用。这正是权威的结构，照搬即可，不要自造 `if (isWeb)` 分支。

## 10. 目录结构（对齐 `workbench/contrib/<feature>/{browser,common}`）

```
src/base/common/types.js                                       类型判定（复用 monaco 同源 isObject/isString）
src/platform/files/common/files.js                        FILES_ASSOCIATIONS_CONFIG 等平台常量
src/platform/extensions/common/extensions.js              manifest / description 类型
src/platform/extensionManagement/common/implicitActivationEvents.js  隐式激活事件
src/workbench/services/extensions/common/extensionsRegistry.js   ExtensionPoint / 贡献点注册
src/workbench/services/extensions/common/builtinExtensions.js   内置扩展清单投递
src/workbench/services/extensions/common/extensions.js           IExtensionService / IExtensionHost（M3）
src/workbench/services/extensions/browser/webWorkerExtensionHost.js            （M3）
src/workbench/services/extensions/electron-browser/localProcessExtensionHost.js （M4）
src/workbench/services/extensions/common/rpcProtocol.js                        （M3）
src/workbench/api/common/extHost*.js / src/workbench/api/browser/mainThread*.js （M3）
src/workbench/services/language/common/languageAssociations.js  资源 → languageId（纯函数）
src/workbench/services/language/common/languageService.js       languages 贡献点 + 关联重算
src/workbench/contrib/files/browser/files.contribution.js       files 段设置项
src/workbench/contrib/codeEditor/common/languageConfigurationExtensionPoint.js
                                序列化语言配置 → 编辑器内部形态的归一化（extractValidConfig，M1 修正）
src/workbench/services/textfile/common/encoding.js         编解码 + 探测 + 决策链（纯函数，M2a 已落地）
src/workbench/services/textfile/browser/encodingInput.js   编码决策输入（读 files.* 配置，M2a 已落地）
src/workbench/services/configuration/browser/textResourceConfigurationService.js  按资源读配置（M2a 已落地）
src/workbench/contrib/statusbar/statusbar.contribution.js  status.editor.encoding 条目（M2a 已落地）
src/workbench/services/textfile/common/textFileService.js  读写 / 脏状态 / 编码（M2b）
src/workbench/services/textfile/common/textFileSaveParticipant.js              （M3）
src/workbench/services/textfile/browser/browserTextFileService.js              （M2b）
src/workbench/services/textfile/electron-browser/nativeTextFileService.js      （M4）
src/workbench/contrib/format/browser/{defaultFormatter.js,formatActionsMultiple.js} （M3）
src/workbench/contrib/codeEditor/browser/saveParticipants.js                   （M3）
src/workbench/contrib/pvf/browser/pvfFileSystemProvider.js     PVF 归档 provider（M2b）
src/workbench/contrib/pvf/browser/pvf.contribution.js          PVF 内置扩展的激活入口
src/extensions/pvf/package.json                                内置扩展清单
src/extensions/pvf/browser/{pvfExtension.js,squirrel.js,pvfText.js,squirrelSymbols.js}
src/utils/pvfEncoding.js                                       PVF 归档编码档案：候选集 + 名字映射（纯取值，M2a 已落地）
```

内置扩展的代码放在 `src/extensions/<name>/`（对齐 `<vscode>/extensions/<name>/` 的布局），
`{browser,common}` 的划分规则用于 `src/workbench/contrib/<feature>/`。
扩展代码由扩展自己拥有，工作台侧只保留贡献点与激活入口 —— 与权威一致：
核心不含 Squirrel 支持，一切语言能力都来自扩展。

现有 `@/utils/encoding.js` 的编码检测已按第 5.2 节上收（M2a）；
`@/utils/pvfTool.js` 的文件树构建（`buildFileTree`）属 M2b 的 provider 范畴，届时一并处理。

## 11. 分阶段落地

| 里程碑 | 内容 | 对应门控 |
| --- | --- | --- |
| **M0** | 补 `docs/vscode-reference.md` 的 4 组对照（语言识别 / 编码 / 格式化 / 扩展系统）；本方案第 12 节取得确认 | §1、§4.2 |
| **M1** | 静态贡献层：manifest + ExtensionPoint + `languages` 贡献点 + `files.associations`；资源 → languageId 的完整决策链（显式语言 > 用户层 > 平台层 > 首行 > plaintext）；PVF 内置扩展声明 `squirrel`/`pvf-list`/`pvf-dat`/`pvf-token` 与 Monarch 语法；语言配置的序列化形态 → 内部形态归一化（`extractValidConfig`，见第 13 节 6a） | §2、§3、§4.1/4.2/4.4 |
| **M2a** | 编码核心：`@vscode/iconv-lite-umd` + `jschardet` 依赖；`@/workbench/services/textfile/common/encoding.js`（编解码 + 探测 + 决策链，纯函数）；`@/workbench/services/textfile/browser/encodingInput.js`（配置取值）；三项 `files.*` 配置项；PVF 域收敛（删两份重复检测与手工码表、encode 不再静默回退）；状态栏编码条目按 `labelShort` 显示；`check:encoding-oracle` 单测 | §4.1 七维、§4.3 偏差登记、§4.4 触发源 |
| **M2b** | 文件层：`IFileService` scheme 路由 + `IFileSystemProvider`；`pvf:` provider（包装 `PvfArchive`）；`ITextFileService`（读 / 写 / 编码）/`EncodingOracle` 的真实消费方；状态栏 `changeEncoding` 动作（两步快速选择器） | §4.1 七维、§4.3 偏差登记 |
| **M3** | 运行时能力层：Web Worker 宿主 + RPC + 4 customer + 激活事件；formatter provider 桥接；defaultFormatter 选择 + `Format Document With...`；save participants（formatOnSave/trim/newline） | §4.4 触发源穷举 |
| **M4** | Electron：Node 进程宿主 + `file:` Node provider + 本地扩展目录扫描；ExtHost / 协议 / 扩展产物零改动 | §4.2 |
| **M5** | （可选，需确认）TextMate 语法通道；本地 vsix 安装 + 扩展视图列表 | §4.2 |

每个里程碑收尾必须回答门控 §4.4 第 4 条：「**这个部件的什么变化会让它更新？**」
答案落到具体 `文件:行号`。

## 12. 待确认项（门控 §4.2，未确认前不动 `package.json`）

| # | 事项 | 补哪个权威能力缺口 | 不加的后果 / 备选 |
| --- | --- | --- | --- |
| 1 | ~~新增依赖 `@vscode/iconv-lite-umd@0.7.1`~~（**已确认，M2a 已安装**，权威 `package.json:122` 同款） | `encoding.ts:82-264` 的全编码编解码；**encode 侧**是当前最大缺口（euc-kr 静默回退 UTF-8 = 数据损坏风险） | 备选：继续自写码表（原有 gbk/big5），euc-kr/日文/其余 46 种编码无法覆盖；体积约为 iconv 的 1/5 但覆盖窄、易错 |
| 2 | ~~新增依赖 `jschardet@3.1.4`~~（**已确认，M2a 已安装**，权威 `package.json:152` 同款） | `encoding.ts:322-358` 的 `guessEncodingByBuffer`，即 `files.autoGuessEncoding` | 备选：原三候选 fatal 试探（已删除），仅覆盖 utf-8/gbk/big5，识别率显著更低 |
| 3 | 新增依赖 `vscode-textmate` + `vscode-oniguruma` + `.wasm` 静态资源 | `contributes.grammars` 的 tmLanguage 高亮通道（monaco 从不支持） | 备选：v1 只用 Monarch（零依赖），扩展只能贡献 Monarch 语法 —— 建议先走这条，M5 再评估 |
| 4 | 自造能力（权威有、monaco 无，需按等价语义重建）：`IFileService`/`IFileSystemProvider`、`ITextFileService`、save participants、`editor.defaultFormatter` 选择协议、扩展宿主 + RPC、状态栏编码条目 | 见第 1.1 节 monaco 能力边界表 | 无备选，属于必须自建；差异部分逐条登记到第 13 节 |

影响面（体积 / 许可，均为 M2a 实测）：iconv-lite-umd 291 KB、jschardet 334 KB，合计 raw 625 KB /
gzip 约 295 KB，两者都是 MIT 纯 JS，静态 import 进主 chunk（见第 13 节第 11 条）；
oniguruma 为 WASM，约 400 KB，且有 CSP 与 `fetch` 路径要求。三项都只影响构建产物体积，不影响运行期架构。

## 13. 需登记到 `docs/vscode-reference.md` 第 5 节的偏差

扩展宿主与运行时（M3 起）：

1. 扩展宿主 web 端**省掉 sandbox iframe**（权威 `webWorkerExtensionHost.ts:141`）；
2. 扩展产物统一 CJS，**Electron 端不支持 ESM 扩展**（权威 `node/extHostExtensionService.ts:188-224` 支持）；
3. **无扩展市场 / proposed API / remote / language pack / debug adapter / notebook**；
4. 清单的 `engines.vscode` 与 proposed API 校验未迁移（本仓库没有 API 版本协商场景）。

高亮与语言配置（M1 已发生的偏差）：

5. v1 **无 TextMate**，只有 Monarch；`contributes.grammars` 通道在 M5 前不可用；
6. `contributes.languages[].configuration`（`language-configuration.json` 文件加载，
   权威 `codeEditor/common/languageConfigurationExtensionPoint.ts:89-130`，priority 50）
   在 M1 改由扩展 `activate()` 调 `monaco.languages.setLanguageConfiguration` 注册 ——
   取值语义等价，差异是「声明位置」与「懒加载时机」（权威按语言首次使用时加载文件，
   本仓库启动即注册）。接通扩展资源加载（M3）后切回清单声明。
6a. **新增（已修正）**：因为走的是 `activate()` 代码注册而非文件加载，权威在
   `extractValidConfig`（`:380-435`）里做的「**序列化形态 → 编辑器内部形态**」归一化必须自己做。
   初版漏了这一步：配置里的 `autoClosingPairs: [["{","}"]]` 是序列化形态（合法），
   但 monaco 的 `setLanguageConfiguration` 要求 `{ open, close, notIn? }` 对象，于是
   `AutoClosingPairs` 读 `pair.open.charAt(0)` 抛
   `TypeError: Cannot read properties of undefined (reading 'charAt')`，打开任意 Squirrel /
   PVF 文本编辑器即崩。现落在
   `@/workbench/contrib/codeEditor/common/languageConfigurationExtensionPoint.js`
   （逐项对齐 `:151-494`，含非法项丢弃告警；JSON schema 部分因本仓库无
   `jsonContributionRegistry` 未迁），护栏 `check:language-configuration`。
   另两处差异：注册优先级 50 → 100（monaco 公开 API 固定值，每语言单注册不可观察）、
   `language-configuration.json` 的 JSON schema 未注册（无消费者）。
7. 语言清单的 JSON schema 校验未迁移（权威把 `contributes.<扩展点>` 的 schema 挂进
   扩展清单的 IntelliSense），因此清单字段写错时只有 `ExtensionMessageCollector` 的校验兜底；
8. 扩展点 `deps` / `canHandleResolver` 未迁移（权威 `extensionsRegistry.ts:675-700`）——
   本仓库暂无相互依赖的扩展点。

文件与编码（M2a 已修复，保留条目记录收敛过程）：

9. ~~`@/utils/encoding.js` 现有 encode 回退 UTF-8 的行为（euc-kr / cp949 保存会损坏数据）~~
   → 已修复：编码名不受支持即抛错（`encodeText`），手工码表已删；
10. ~~`PvfArchive` 的自带 `detectEncoding` 在 M2 上收前，与统一 oracle 并存（临时偏差）~~
    → 已收敛：`@/utils/pvfTool.js` / `@/utils/pvfToolTw.js` 的重复检测已删除，统一走
    `detectEncodingFromBuffer`（回归护栏见 `check:encoding-oracle` 第 8 节）；
11. **新增**：iconv / jschardet 为静态 import（权威 `importAMDNodeModule` 懒加载），
    主 chunk 增约 625 KB（gzip 295 KB）—— 换来 PVF 域同步调用点零改动；
12. **新增**：无流式编解码路径（权威 `toDecodeStream` / `toEncodeReadable` 未迁），
    整块 buffer 同步探测，`acceptTextOnly` / `DecodeStreamError` 语义由调用方按 `seemsBinary` 处理；
13. **新增**：无编码覆盖注册表（`ResourceEncodingRegistry` 的三类固定覆盖无对应路径），
    `IEncodingInput.encodingOverride` 无产出方；三项 `files.*` 编码配置因无 `[language]` 覆盖段而不登记 `scope`；
14. **新增**：PVF 归档的候选集与名字映射（`@/utils/pvfEncoding.js`）是 PVF 域取值，
    权威默认候选为空表；TW 归档的 `_twDetectEncoding` 仍为自带的 Big5 优先启发式，未收敛；
15. **新增**：编辑器输入无 `IEncodingSupport` 的 `getEncoding`/`setEncoding` 对，
    运行期不能改编码重解码；状态栏「选择编码」因此暂不绑定命令（M2b 一并落地）。

格式化与保存（M3）：

16. v1 无 `Format Modified Lines`（`formatModified.ts:51-82` 的 dirty diff 依赖未迁移）。

M1 已实现但形态不同的两条（供 M3 收敛）：

17. 内置扩展的激活是**进程内直接调用**（`@/workbench/contrib/pvf/browser/pvf.contribution.js`），
    不经扩展宿主、不消费 `activationEvents`（权威 `abstractExtensionService.ts:1185-1250`）；
18. monaco 的私有路径导入（`monaco-editor/editor/common/...`、`monaco-editor/base/common/...`）：
    这是复用权威同源实现的必要手段，仓库内既有用法（`wordWrapState.js`、`documentSymbols.js`），
    风险是 monaco 升级可能改路径 —— 由 `check:language-associations` 的断言兜住行为差异，路径失效则构建期即报错。

## 14. 验证方式（门控 §5 允许的手段）

- `npm run build`；
- **Node 纯函数单测**（`scripts/check-*.mjs` 已有模式）：
  - `check:language-associations` —— 逐条固定识别决策表：
    平台层（扩展名 / 文件名精确 / 最长 pattern / 大小写）用 monaco 的真实实现断言，
    用户层（覆盖平台层 / path pattern 的 `**` 语义 / 最长 pattern / 后注册优先 / 清空回落）
    断言本仓库实现；另有显式语言优先、未注册语言回落 plaintext、首行兜底与截断；
  - `check:encoding-oracle`（M2a 已落地，74 项断言）—— 分节覆盖：
    ① BOM 探测（UTF-8 / UTF-16 LE / UTF-16 BE / 无 BOM / 空缓冲）；
    ② 零字节启发式（无 BOM 的 UTF-16、二进制、纯 ASCII）；
    ③ jschardet 猜测（简中→gb2312、繁中→cp950、韩文→euckr、未知候选名不抛错、ascii 结果被忽略、
    候选表限定后不越界）；
    ④ 决策链（override > option > 探测 > 配置 > utf8、未知编码回退、utf8bom 的降级与保留、hasBOM 强制）；
    ⑤ 读文件端到端（探测 + 决策）；⑥ 编码表形状（49 项 / order 1..49 / 20 项可猜测 /
    guessableName 均能被 jschardet 接受 / 每项都能被 iconv 编码）；
    ⑦ `decode(encode(text))` 往返（UTF-8 / UTF-8+BOM / GBK / Big5 / EUC-KR / Windows 1252 / UTF-16LE+BOM / UTF-16BE+BOM）；
    ⑧ PVF 域档案（候选集 → 编码名映射 → 解码原文，含 ASCII 归档回落 utf8）；
  - `check:language-configuration`（M1 修正，51 项断言）—— 分三节：
    A 归一化规则（二元组 → `{open,close}`、对象形式与 `notIn` 保留、非法项逐项丢弃并告警、
    缺失字段为 undefined、`colorizedBracketPairs` 全非法时为 `[]`、`comments.lineComment` 三形态、
    `wordPattern`/`indentationRules`/`folding` 的正则与成对判定、`onEnterRules` 的
    `IndentAction` 映射与必填项）；
    B 真实扩展配置（`pvfText` / `squirrel`）—— 归一化只改形状不改取值、每条 `open`/`close`
    均为非空字符串、**喂给崩溃栈里的 `AutoClosingPairs` / `StandardAutoClosingPairConditional`
    不抛错**（回归断言）；
    C 静态断言 —— `pvfExtension.js` 的 2 处 `setLanguageConfiguration` 都必须经 `extractValidConfig`；
- dev server HTTP 状态码检查（含按模块请求验证 Vite 转换无解析错误）；
- 静态检查：`grep` 确认无硬编码颜色、无深层相对导入、无重复实现，以及构建产物里存在预期的词法定义。
- **禁止**启动浏览器 / 无头浏览器 / 截图工具。

## 15. 下一步

**M2a 已完成**（第 12 节已确认的两项依赖 + 编码核心 + PVF 域收敛 + 状态栏显示）：

1. `@vscode/iconv-lite-umd@0.7.1`、`jschardet@3.1.4` 已入 `dependencies`（权威同款同版本）；
2. `@/workbench/services/textfile/common/encoding.js`：`encodingCodec`、BOM 探测、
   零字节启发式、jschardet 猜测、`detectEncodingFromBuffer`、四个决策函数、
   `resolveReadEncoding`、`SUPPORTED_ENCODINGS`（49 项）与 `GUESSABLE_ENCODINGS`；
3. `@/workbench/services/textfile/browser/encodingInput.js`：从 `textResourceConfigurationService`
   组装 `IEncodingInput`；三项 `files.*` 配置项登记在 `files.contribution.js`；
4. PVF 域收敛：`@/utils/encoding.js` 只留门面 + 韩文乱码恢复，候选集/映射移到
   `@/utils/pvfEncoding.js`，手工码表与两份重复检测已删除，encode 不再静默回退；
5. `check:encoding-oracle`（74 项）+ 状态栏 `status.editor.encoding` 按 `labelShort` 显示。

**下一步 M2b**（需要读取路径，尚不能只靠现有代码完成）：

1. `IFileService` 的 scheme 路由 + `IFileSystemProvider`（对齐 `platform/files/common/files.ts:28/51/678`
   与 `common/fileService.ts:52/90` 的 `Map<scheme, provider>`）；
2. `pvf:` provider：包装 `PvfArchive` / `PvfArchiveTw`，按归档内路径返回字节，
   同时把归档级 `strEncoding` 作为 `preferredEncoding` 传给编码决策链（第 5.1 节）；
3. `ITextFileService`：`getEncoding(resource)` / 按编码读字节 / 按编码写回（含 `hasBOM`），
   接上编辑器输入的 `encoding` 与「按原字节重读」路径；
4. 状态栏 `workbench.action.editor.changeEncoding`：两步快速选择器
   （Save with Encoding / Reopen with Encoding，列表按 `order` 排序、当前编码置顶、
   Reopen 过滤 `encodeOnly`、脏编辑器先确认回滚）。

当前可复跑的验证命令（含 M1 的语言配置归一化修正）：

```
npm run check:language-configuration    # 语言配置归一化 + 崩溃回归（51 项）
npm run check:encoding-oracle           # 编码决策链 + 编解码往返 + PVF 域档案（74 项）
npm run check:language-associations     # 识别决策表
npm run check:outline                   # 符号取数链路（含 Squirrel 符号解析，文件已移至扩展目录）
npm run build
```
