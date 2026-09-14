// 资源管理器条目模型（对齐 <vscode>/src/vs/workbench/contrib/files/common/explorerModel.ts
// 的 ExplorerModel 与 ExplorerItem）。
//
// 权威的 ExplorerItem 是「文件系统的一层缓存」：字段与能力里有软链接、mtime、文件嵌套
// （nestedChildren）、过滤（isExcluded）、只读判定（isReadonly），子节点要靠 IFileService
// 异步解析（fetchChildren → fileService.resolve）。其中本仓库真正消费的只有树渲染与取数用到的那部分：
//   resource / name / isDirectory / parent / children / isRoot / root / getId / find
// 未迁入的部分连同原因登记在 docs/vscode-reference.md 第 5 节。

export class ExplorerItem {
    /**
     * @param {{ resource: import("@/base/common/uri.js").URI, name?: string, isDirectory?: boolean, parent?: ExplorerItem, mtime?: number }} options
     */
    constructor({ resource, name, isDirectory = false, parent, mtime } = {}) {
        this.resource = resource;
        // 对齐 explorerModel.ts:161-163：默认取路径末段（basenameOrAuthority）。
        this.name = name ?? basename(resource);
        this._isDirectory = isDirectory;
        this._parent = parent;
        this._mtime = mtime;
        // 对齐 explorerModel.ts:181-183 的 `@memoize get children(): Map<string, ExplorerItem>`。
        this.children = new Map();
    }

    // explorerModel.ts:149-151
    get isDirectory() {
        return this._isDirectory;
    }

    get mtime() {
        return this._mtime;
    }

    // explorerModel.ts:169-171
    get parent() {
        return this._parent;
    }

    // explorerModel.ts:173-179
    get root() {
        return this._parent ? this._parent.root : this;
    }

    // explorerModel.ts:206-208
    get isRoot() {
        return !this._parent;
    }

    // explorerModel.ts:192-200：根资源 + 条目的资源组成身份。
    // 权威在「被标记为过滤结果」时追加 '::findFilterResult' 后缀；本仓库没有过滤（第 5 节已登记）。
    getId() {
        return `${this.root.resource.toString()}::${this.resource.toString()}`;
    }

    // explorerModel.ts:299-306
    addChild(child) {
        child._parent = this;
        this.children.set(child.name, child);
    }

    removeChild(child) {
        if (this.children.get(child.name) === child) this.children.delete(child.name);
    }

    /**
     * 对齐 explorerModel.ts:462-520 的 find：从自身起按资源路径逐段下钻。
     *
     * 权威的比较带「大小写敏感与否」分支（:465-467 问 fileService.hasCapability(PathCaseSensitive)），
     * 本仓库没有文件服务，故按资源字符串精确匹配 —— 清单是构建期固定的、资源两两不同，
     * 行为等价；差异登记在 docs/vscode-reference.md 第 5 节。
     * @param {import("@/base/common/uri.js").URI} resource
     * @returns {ExplorerItem | null}
     */
    find(resource) {
        if (this.resource.toString() === resource.toString()) return this;
        for (const child of this.children.values()) {
            const found = child.find(resource);
            if (found) return found;
        }
        return null;
    }

    // explorerModel.ts:202-204
    toString() {
        return `ExplorerItem: ${this.name}`;
    }
}

export class ExplorerModel {
    /**
     * 对齐 ExplorerModel 的 roots（explorerModel.ts:24-45）：工作区文件夹各自一个根。
     * 本仓库是「单文件夹」——一个根，故根条目在树里不渲染（见 explorerService.js 的注释）。
     * @param {ExplorerItem[]} roots
     */
    constructor(roots) {
        this.roots = roots;
    }

    // explorerModel.ts:52-64 的 findAll，作用于单一根。
    findAll(resource) {
        return this.roots.map(root => root.find(resource)).filter(item => !!item);
    }

    // explorerModel.ts:71-81 的 findClosest。权威凭工作区上下文把资源映射到某个根，
    // 本仓库只有一个根，故等价于「在第一个根里找」。
    findClosest(resource) {
        const root = this.roots.find(candidate => candidate.find(resource));
        return root ? root.find(resource) : null;
    }
}

// 对齐 base/common/resources.ts 的 basenameOrAuthority：https://host/x → host，无路径段时用 authority。
function basename(resource) {
    if (!resource) return "";
    const path = resource.path ?? "";
    const lastSlash = path.lastIndexOf("/");
    if (lastSlash >= 0 && lastSlash < path.length - 1) return path.slice(lastSlash + 1);
    return resource.authority || path;
}
