// 文件图标主题：按文件名 / 扩展名 / 语言 id 给出文件名旁的彩色图标。
//
// 对齐 VS Code：
//   - workbench/services/themes/browser/fileIconThemeData.ts:262-451 的样式表生成
//     （选择器前缀 .show-file-icons、按 icon definition 合并选择器、@font-face 与字号默认值）；
//   - editor/common/services/getIconClasses.ts:27-84 的类名规则
//     （file-icon + <name>-name-file-icon + name-file-icon + 各段 <ext>-ext-file-icon + ext-file-icon
//     + <languageId>-lang-file-icon，优先级由选择器链长度决定）；
//   - editor/common/services/getIconClasses.ts:125 与 fileIconThemeData.ts:503 的转义
//     （空白转 `/`，进 CSS 选择器前再按类名转义）。
//
// 主题数据取自 extensions/theme-seti（vs-seti-icon-theme.json + seti.woff + ThirdPartyNotices.txt，
// 见同目录），与本仓库的深色主题配套。裁剪：只生成 `.show-file-icons` 下的配色，
// 权威对 light 段另生成 `.vs` 限定符的规则（fileIconThemeData.ts:386），本仓库无亮色主题故未实现，
// 已登记在 docs/vscode-reference.md 第 5 节。
import iconThemeDocument from "@/workbench/services/themes/seti/vs-seti-icon-theme.json";
import setiFontUrl from "@/workbench/services/themes/seti/seti.woff?url";
import { FileKind } from "@/platform/files/common/files.js";

// 权威只对十六进制色值生效（fileIconThemeData.ts:432 的 fontColorRegex）。
const FONT_COLOR_REGEX = /^#[0-9a-fA-F]{3,8}$/;

// 对齐 getIconClasses.ts:125：HTML 类名不能含空白，用 `/` 代替（文件名里不会出现 `/`）。
function selectorEscape(str) {
    return str.replace(/[\s]/g, "/");
}

// 对齐 fileIconThemeData.ts:503 的 classSelectorPart：类名进入选择器前按 CSS 标识符转义
// （扩展名映射里的 `.`，如 `css.map`）。
function classSelectorPart(str) {
    return CSS.escape(selectorEscape(str));
}

// 对齐 fileIconThemeData.ts:493-501：映射键可带父目录（`folder/name`），
// 父目录作为 `<parent>-name-dir-icon` 段落进选择器。
function handleParentFolder(key, selectors) {
    const lastIndexOfSlash = key.lastIndexOf("/");
    if (lastIndexOfSlash >= 0) {
        selectors.push(`.${classSelectorPart(key.substring(0, lastIndexOfSlash))}-name-dir-icon`);
        return key.substring(lastIndexOfSlash + 1);
    }
    return key;
}

function buildStyleSheet(doc) {
    const qualifier = ".show-file-icons";
    const selectorByDefinitionId = new Map();
    const addSelector = (selector, definitionId) => {
        const selectors = selectorByDefinitionId.get(definitionId);
        if (selectors) selectors.push(selector);
        else selectorByDefinitionId.set(definitionId, [selector]);
    };

    if (doc.file) addSelector(`${qualifier} .file-icon::before`, doc.file);

    const languageIds = doc.languageIds;
    if (languageIds) {
        // 对齐 fileIconThemeData.ts:337-339：jsonc 未给定时复用 json 的图标。
        if (!languageIds.jsonc && languageIds.json) languageIds.jsonc = languageIds.json;
        for (const languageId in languageIds) {
            addSelector(`${qualifier} .${classSelectorPart(languageId)}-lang-file-icon.file-icon::before`, languageIds[languageId]);
        }
    }

    const fileExtensions = doc.fileExtensions;
    if (fileExtensions) {
        for (const key in fileExtensions) {
            const selectors = [];
            const name = handleParentFolder(key.toLowerCase(), selectors);
            const segments = name.split(".");
            if (segments.length) {
                // 每段后缀各出一个类（`tar.gz` → `.tar.gz-ext-file-icon.gz-ext-file-icon`），
                // 末尾补 `.ext-file-icon` 提升扩展名映射的权重（fileIconThemeData.ts:352-358）。
                for (let i = 0; i < segments.length; i++) {
                    selectors.push(`.${classSelectorPart(segments.slice(i).join("."))}-ext-file-icon`);
                }
                selectors.push(".ext-file-icon");
            }
            addSelector(`${qualifier} ${selectors.join("")}.file-icon::before`, fileExtensions[key]);
        }
    }

    const fileNames = doc.fileNames;
    if (fileNames) {
        for (const key in fileNames) {
            const selectors = [];
            const fileName = handleParentFolder(key.toLowerCase(), selectors);
            selectors.push(`.${classSelectorPart(fileName)}-name-file-icon`);
            selectors.push(".name-file-icon"); // 提升文件名映射的权重
            const segments = fileName.split(".");
            if (segments.length) {
                for (let i = 1; i < segments.length; i++) {
                    selectors.push(`.${classSelectorPart(segments.slice(i).join("."))}-ext-file-icon`);
                }
                selectors.push(".ext-file-icon");
            }
            addSelector(`${qualifier} ${selectors.join("")}.file-icon::before`, fileNames[key]);
        }
    }

    const rules = [];
    const fonts = doc.fonts;
    if (Array.isArray(fonts) && fonts.length) {
        const font = fonts[0];
        // 字体源在主题 JSON 里是相对路径（./seti.woff）；本仓库只内置这一个字体，
        // 直接取打包后的资源 URL（构建期由 Vite 处理）。
        rules.push(`@font-face { src: url("${setiFontUrl}") format("woff"); font-family: "${font.id}"; font-weight: ${font.weight}; font-style: ${font.style}; font-display: block; }`);
        rules.push(`${qualifier} .file-icon::before, ${qualifier} .folder-icon::before, ${qualifier} .rootfolder-icon::before { font-family: "${font.id}"; font-size: ${font.size}; }`);
    }

    for (const [definitionId, selectors] of selectorByDefinitionId) {
        const definition = doc.iconDefinitions[definitionId];
        if (!definition) continue;
        const body = [];
        if (definition.fontColor && FONT_COLOR_REGEX.test(definition.fontColor)) body.push(`color: ${definition.fontColor};`);
        if (definition.fontCharacter) body.push(`content: "${definition.fontCharacter}";`);
        if (body.length) rules.push(`${selectors.join(", ")} { ${body.join(" ")} }`);
    }

    return rules.join("\n");
}

let styleElement;

// 文件图标主题的三个特征位（IFileIconTheme 的 hasFileIcons / hasFolderIcons / hidesExplorerArrows，
// 见 workbench/services/themes/common/fileIconThemeSchema.ts 的 doc 字段；消费方见
// browser/parts/editor/breadcrumbsPicker.ts:357-364 与 views.css:8-16 的 align-icons-and-twisties / hide-arrows）。
// 本仓库只有一个内建主题（Seti），特征位在模块加载时算一次，不随运行期变化。
export const fileIconThemeTraits = Object.freeze({
    hasFileIcons: Boolean(iconThemeDocument.file),
    // Seti 没有文件夹图标：folder / folderNames / folderNamesExpanded 均未定义
    hasFolderIcons: Boolean(iconThemeDocument.folder || iconThemeDocument.folderNames || iconThemeDocument.folderNamesExpanded),
    hidesExplorerArrows: iconThemeDocument.hidesExplorerArrows === true
});

// 注入图标主题样式表（对齐 FileIconThemeData.createStyleSheet + apply 的样式注入时机）。
// DOM 侧只需要给条目加 file-icon 与各类名，并在行容器上加 show-file-icons（见各视图）。
export function applyFileIconTheme() {
    if (styleElement) return;
    styleElement = document.createElement("style");
    styleElement.id = "pvf-file-icon-theme";
    styleElement.textContent = buildStyleSheet(iconThemeDocument);
    document.head.appendChild(styleElement);
}

// 对齐 getIconClasses.ts:27-84（本仓库没有 model 服务与语言服务，故语言 id 由调用方按
// 「已打开模型 → 路径/首行识别」给出，见 explorerService.getItemLanguageId）。
export function getFileIconClasses(name, languageId, fileKind = FileKind.FILE) {
    // getIconClasses.ts:27-43：根文件夹 / 文件夹 / 文件三类各有自己的基类与名称段；
    // 文件夹不追加语言段（getIconClasses.ts:76-83 的语言分支只在 Files 分支里）。
    const escapedName = selectorEscape((name ?? "").toLowerCase());
    if (fileKind === FileKind.ROOT_FOLDER) return ["rootfolder-icon", `${escapedName}-root-name-folder-icon`];
    if (fileKind === FileKind.FOLDER) return ["folder-icon", `${escapedName}-name-folder-icon`];

    const classes = ["file-icon"];
    if (name) {
        classes.push(`${escapedName}-name-file-icon`);
        classes.push("name-file-icon"); // 提升文件名映射的权重
        // 超长文件名不再展开扩展名组合（getIconClasses.ts:65-73 的 255 上限）。
        if (escapedName.length <= 255) {
            const dotSegments = escapedName.split(".");
            for (let i = 1; i < dotSegments.length; i++) {
                classes.push(`${dotSegments.slice(i).join(".")}-ext-file-icon`);
            }
        }
        classes.push("ext-file-icon"); // 提升扩展名映射的权重
    }
    if (languageId) classes.push(`${selectorEscape(languageId)}-lang-file-icon`);
    return classes;
}
