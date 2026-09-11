// 状态栏服务（对齐 VS Code workbench/browser/parts/statusbar/statusbarPart.ts +
// statusbarModel.ts + statusbarItem.ts 的模型与渲染规则）。
//
// 条目由各贡献模块声明式注册：alignment（LEFT/RIGHT）、数值 priority、kind（standard/
// warning/error/prominent/remote/offline）、text（支持 $(codicon) 语法）、command 等。
//
// 排序规则同 statusbarModel.sort：按 primary 优先级降序（数值越大越靠左），同级按注册顺序
// 保持稳定。右侧容器在 DOM 中以 row-reverse 排布（statusbarpart.css），因此右侧条目渲染前
// 需反序（见 statusbarPart.appendStatusbarEntries 的 `.reverse()` 注释）。
import { reactive } from "vue";

export const StatusbarAlignment = Object.freeze({
    LEFT: 0,
    RIGHT: 1
});

// 与 VS Code StatusbarEntryKinds 一致（standard 不产生 kind 类名，见 statusbarItem.ts:193）。
export const STATUS_BAR_ENTRY_KINDS = ["standard", "warning", "error", "prominent", "remote", "offline"];

export const statusbarModel = reactive({ entries: [] });

let _seq = 0;

function normalize(entry) {
    return {
        name: entry.name ?? "",
        text: entry.text ?? "",
        ariaLabel: entry.ariaLabel ?? entry.text ?? "",
        tooltip: entry.tooltip ?? "",
        command: entry.command ?? null,
        kind: entry.kind ?? "standard",
        role: entry.role ?? "button"
    };
}

export function addEntry(entry, id, alignment = StatusbarAlignment.LEFT, priority = 0) {
    const model = reactive({
        id,
        alignment,
        priority,
        // 稳定排序用的注册序号（对齐 statusbarModel 中按插入下标兜底比较）。
        order: _seq++,
        ...normalize(entry)
    });
    statusbarModel.entries.push(model);

    return {
        get id() {
            return id;
        },
        // 仅更新展示字段（对齐 VS Code accessor.update 语义），未提供的字段沿用当前值。
        update(next) {
            Object.assign(model, normalize({ ...model, ...next }));
        },
        dispose() {
            removeEntry(id);
        }
    };
}

export function removeEntry(id) {
    const index = statusbarModel.entries.findIndex(entry => entry.id === id);
    if (index >= 0) statusbarModel.entries.splice(index, 1);
}

// 某个对齐方向上的条目，已按 statusbarModel.sort 的规则排序（高优先级在前）。
export function getEntries(alignment) {
    return statusbarModel.entries.filter(entry => entry.alignment === alignment).sort((a, b) => b.priority - a.priority || a.order - b.order);
}

// 是否带背景色（statusbarItem.ts:185）：显式 kind 之外的条目视为有背景色。
export function hasBackgroundColor(entry) {
    return !!entry.kind && entry.kind !== "standard";
}
