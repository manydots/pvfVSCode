// 文件名比较器（对齐 <vscode>/src/vs/base/common/comparers.ts:11-32、:52-60、:197-215）。
//
// 资源管理器的默认排序（explorer.sortOrder 的 'default'）走 compareFileNamesDefault
// （workbench/contrib/files/browser/views/explorerViewer.ts:1487 选函数、:1561 调用）。
// 与 String.prototype.localeCompare 的区别在这里：用带 numeric 的 Intl.Collator，
// 使 `file2` 排在 `file10` 之前；collator 判等时再按长度消歧（`foo1` 与 `foo01`）。
//
// 权威用 Lazy 包一层（comparers.ts:11-17），模块级常量与之等价。
// 权威的 safeIntl.Collator（date.ts:306-314）只在 locales 不被支持时退回默认 locale；
// 这里始终传 undefined locale，无退化分支可走，故直接构造。

const intlFileNameCollatorNumeric = new Intl.Collator(undefined, { numeric: true });

// comparers.ts:13-19 的 intlFileNameCollatorBaseNumeric：numeric + sensitivity 'base'
// （忽略大小写、重音与变音符），collatorIsNumeric 取 resolvedOptions().numeric。
const intlFileNameCollatorBaseNumeric = (() => {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    return { collator, collatorIsNumeric: collator.resolvedOptions().numeric };
})();

// comparers.ts:40-51
/**
 * 完整文件名的比较（不区分文件名与扩展名，大小写、重音不敏感）。
 * 面包屑的文件选择器排序用这个（breadcrumbsPicker.ts:330-343 的 FileSorter）。
 * @param {string | null | undefined} one
 * @param {string | null | undefined} other
 * @returns {number}
 */
export function compareFileNames(one, other) {
    const a = one || "";
    const b = other || "";
    const result = intlFileNameCollatorBaseNumeric.collator.compare(a, b);

    // numeric 比较下 `foo1` 与 `foo01` 等价，按 unicode 比较消歧。
    if (intlFileNameCollatorBaseNumeric.collatorIsNumeric && result === 0 && a !== b) {
        return a < b ? -1 : 1;
    }

    return result;
}

// comparers.ts:197-215
function compareAndDisambiguateByLength(collator, one, other) {
    const result = collator.compare(one, other);
    if (result !== 0) return result;

    // numeric 比较下 `foo1` 与 `foo01` 等价，按更短的在前消歧。
    if (one.length !== other.length) return one.length < other.length ? -1 : 1;

    return 0;
}

/**
 * 完整文件名的比较（不区分文件名与扩展名，不按大小写分组）。
 * @param {string | null | undefined} one
 * @param {string | null | undefined} other
 * @returns {number}
 */
export function compareFileNamesDefault(one, other) {
    return compareAndDisambiguateByLength(intlFileNameCollatorNumeric, one || "", other || "");
}
