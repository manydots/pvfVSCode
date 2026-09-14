// 快速打开（quick access）的提供者注册表与输入路由。
//
// 权威来源（microsoft/vscode）：
//   workbench/browser/quickaccess.ts                      QuickAccessProvider 注册（prefix → 提供者）
//   platform/quickinput/common/quickAccess.ts             PickerQuickAccessProvider：onDidChangeValue → _getPicks
//   workbench/contrib/search/browser/anythingQuickAccess.ts:99-113（PREFIX = ''，即默认提供者）
//     :835-872（空查询时返回 helpEntries，条目点击后以该前缀重新打开）
//   platform/quickinput/browser/commandsQuickAccess.ts:51（命令提供者 PREFIX = '>'）
//
// 输入路由：值以某个非空前缀开头时交给该提供者，并从过滤词中去掉前缀 —— 与权威把
// `>` / `@` / `:` / `#` 分派给各自提供者的效果一致（anythingQuickAccess.ts 的前缀委派）。
import { quickInput, setQuickPickItems, showQuickPick } from "@/platform/quickinput/quickInput.js";

const _providers = [];

// provider：{ prefix, placeholder, helpEntries?: [{label, description, prefix}], getPicks(filter, options) }
export function registerQuickAccessProvider(provider) {
    _providers.push(provider);
    return {
        dispose() {
            const index = _providers.indexOf(provider);
            if (index >= 0) _providers.splice(index, 1);
        }
    };
}

export function getQuickAccessProviders() {
    return _providers;
}

// 默认提供者：空前缀（对齐 anythingQuickAccess.ts:101 的 PREFIX = ''）。
function getDefaultProvider() {
    return _providers.find(provider => provider.prefix === "") ?? null;
}

function getProviderByPrefix(prefix) {
    return _providers.find(provider => provider.prefix === prefix) ?? null;
}

// 解析当前输入值应交给哪个提供者，以及去掉前缀后的过滤词。
export function resolveQuickAccessProvider(value) {
    const text = value ?? "";
    for (const provider of _providers) {
        if (provider.prefix && text.startsWith(provider.prefix)) {
            return { provider, filter: text.slice(provider.prefix.length) };
        }
    }
    return { provider: getDefaultProvider(), filter: text };
}

// 当前已打开的快速输入属于哪个提供者（对应 quickAccess.ts 的 visibleQuickAccess.descriptor）。
let _visibleProvider = null;

// 光标选区（对齐 quickAccess.ts:170-186 的 adjustValueSelection）：
// 未要求保留时选中前缀之后的部分（键入即替换过滤词），要求保留时把光标放到末尾。
function valueSelectionFor(provider, preserveValue) {
    const end = quickInput.value.length;
    return preserveValue ? [end, end] : [provider?.prefix?.length ?? 0, end];
}

/**
 * 打开快速打开。
 * @param {string} [prefix] 目标提供者的前缀；缺省用默认（Anything）提供者（对齐 show(value = '')）。
 * @param {object} [options] { preserveValue, providerOptions: { includeHelp, from } }
 */
export function showQuickAccess(prefix, options = {}) {
    // includeHelp 只在调用方显式要求时开启（对齐 anythingQuickAccess.ts:408 的 `if (options.includeHelp)`：
    // Ctrl+P 不传该字段，因此不列出提供者清单；命令中心传 includeHelp: true）。
    const includeHelp = options.providerOptions?.includeHelp === true;
    const providerOptions = { includeHelp, from: options.providerOptions?.from };
    const preserveValue = options.preserveValue === true;
    let value = prefix ?? "";
    const startProvider = prefix ? getProviderByPrefix(prefix) : getDefaultProvider();
    if (!startProvider) return;

    // 同一提供者已打开：只在「新值比前缀更具体」且未要求保留时改写输入值，
    // 其余情况保留用户已输入的内容，仅调整选区（对齐 quickAccess.ts:62-77）。
    if (quickInput.visible && _visibleProvider === startProvider) {
        if (value !== startProvider.prefix && !preserveValue) setQuickPickValue(value);
        quickInput.valueSelection = valueSelectionFor(startProvider, preserveValue);
        return;
    }

    // 换提供者时把已输入的过滤词带过去（对齐 quickAccess.ts:79-91 的 newValueCandidateWithoutPrefix）。
    if (!preserveValue && quickInput.visible && _visibleProvider && _visibleProvider !== startProvider) {
        const carried = quickInput.value.slice(_visibleProvider.prefix.length);
        if (carried) value = `${startProvider.prefix}${carried}`;
    }

    // onDidHide 会把 _visibleProvider 置空：showQuickPick 内部先隐藏旧会话（同步回调），
    // 因此 _visibleProvider 必须在它之后写入，否则会被上一会话的清空回调覆盖。
    showQuickPick({
        value,
        placeholder: startProvider.placeholder,
        // 选区依赖最终写入的值，故在 showQuickPick 之后回填（见函数末尾）。
        onDidChangeValue: input => {
            const { provider, filter } = resolveQuickAccessProvider(input);
            if (!provider) return;
            // 路由到别的提供者时占位符随之切换（对齐 PickerQuickAccessProvider.updatePicker 的
            // picker.placeholder = provider.placeholder）。
            quickInput.placeholder = provider.placeholder;
            const activeId = quickInput.items[quickInput.activeIndex]?.id;
            setQuickPickItems(provider.getPicks(filter, providerOptions), activeId);
        },
        onDidHide: () => {
            _visibleProvider = null;
        }
    });
    _visibleProvider = startProvider;
    quickInput.valueSelection = valueSelectionFor(startProvider, preserveValue);
}
