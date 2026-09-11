// 编辑器功能贡献（对齐 VS Code workbench/browser/parts/editor/editorActions.ts +
// editorCommands.ts 的注册划分）：命令实现、菜单落点与快捷键都在此声明。
import { MenuId } from "@/menu/menuId.js";
import { appendMenuItem, registerAction2 } from "@/menu/actions.js";
import { ContextKeyExpr, contextKeys } from "@/menu/contextKey.js";
import { setStatus } from "@/menu/appState.js";
import {
    activateEditor,
    closeAllEditors,
    closeEditor,
    closeOtherEditors,
    closeSavedEditors,
    editorGroup,
    getActiveEditorInput,
    getEditorInput,
    openUntitledEditor,
    saveEditor,
    togglePinned
} from "@/workbench/contrib/editor/editorGroupService.js";

// 标签右键菜单作用于被点击的标签（editorContextId 在打开菜单前写入），
// 命令自身调用时则回退到当前激活编辑器。
function contextTargetId() {
    return contextKeys.get("editorContextId") ?? editorGroup.activeId;
}

registerAction2({
    id: "workbench.action.files.newUntitledFile",
    title: "新建文件",
    keybinding: { primary: "Ctrl+N" },
    menu: { id: MenuId.MenubarFileMenu, group: "1_new", order: 1 },
    run() {
        openUntitledEditor();
        setStatus("已新建空白文件");
    }
});

registerAction2({
    id: "workbench.action.files.save",
    title: "保存",
    menu: { id: MenuId.MenubarFileMenu, group: "2_save", order: 0 },
    run() {
        const active = getActiveEditorInput();
        if (!active) return;
        saveEditor(active.id);
        setStatus(`已保存 ${active.name}`);
    }
});

registerAction2({
    id: "workbench.action.closeActiveEditor",
    title: "关闭编辑器",
    keybinding: { primary: "Ctrl+W" },
    // 编辑器作用域（对齐 VS Code 关闭编辑器命令的 when: editorFocus）。
    editorScoped: true,
    menu: { id: MenuId.MenubarFileMenu, group: "3_close", order: 1 },
    run() {
        const id = contextTargetId();
        if (id) closeEditor(id);
    }
});

registerAction2({
    id: "workbench.action.closeOtherEditors",
    title: "关闭其他编辑器",
    menu: [
        { id: MenuId.MenubarFileMenu, group: "3_close", order: 2 },
        { id: MenuId.EditorTitleContext, group: "1_close", order: 1 }
    ],
    run() {
        const id = contextTargetId();
        if (id) closeOtherEditors(id);
    }
});

registerAction2({
    id: "workbench.action.closeAllEditors",
    title: "关闭所有编辑器",
    keybinding: { primary: "Ctrl+K W" },
    editorScoped: true,
    menu: [
        { id: MenuId.MenubarFileMenu, group: "3_close", order: 3 },
        { id: MenuId.EditorTitleContext, group: "1_close", order: 2 },
        { id: MenuId.EditorTitle, group: "9_close", order: 1, icon: "close-all" }
    ],
    run() {
        closeAllEditors();
    }
});

registerAction2({
    id: "workbench.action.closeSavedEditors",
    title: "关闭已保存的编辑器",
    menu: { id: MenuId.MenubarFileMenu, group: "3_close", order: 4 },
    run() {
        closeSavedEditors();
    }
});

// 固定/取消固定：VS Code 用同一动作的 toggled 语义，这里按上下文键拆成两条动作，
// 用 menu.when 控制只显示其中一条（precondition 只会置灰，不会隐藏）。
registerAction2({
    id: "workbench.action.pinEditor",
    title: "固定",
    menu: {
        id: MenuId.EditorTitleContext,
        group: "2_pin",
        order: 1,
        when: ContextKeyExpr.not(ContextKeyExpr.has("editorIsPinned"))
    },
    run() {
        const id = contextTargetId();
        if (id) togglePinned(id);
    }
});

registerAction2({
    id: "workbench.action.unpinEditor",
    title: "取消固定",
    menu: {
        id: MenuId.EditorTitleContext,
        group: "2_pin",
        order: 1,
        when: ContextKeyExpr.has("editorIsPinned")
    },
    run() {
        const id = contextTargetId();
        if (id) togglePinned(id);
    }
});

function stepEditor(delta) {
    return () => {
        const index = editorGroup.editors.findIndex(editor => editor.id === editorGroup.activeId);
        if (index < 0) return;
        const next = (index + delta + editorGroup.editors.length) % editorGroup.editors.length;
        activateEditor(editorGroup.editors[next].id);
    };
}

registerAction2({
    id: "workbench.action.nextEditor",
    title: "下一个编辑器",
    keybinding: { primary: "Ctrl+PageDown" },
    editorScoped: true,
    run: stepEditor(1)
});

registerAction2({
    id: "workbench.action.previousEditor",
    title: "上一个编辑器",
    keybinding: { primary: "Ctrl+PageUp" },
    editorScoped: true,
    run: stepEditor(-1)
});

// 关闭标签右键菜单项：图标与分组对齐 VS Code MenuId.EditorTitleContext。
appendMenuItem(MenuId.EditorTitleContext, {
    command: { id: "workbench.action.closeActiveEditor", title: "关闭", icon: "close" },
    group: "1_close",
    order: 0
});

// 标签栏右侧「…」溢出菜单（非 navigation 组自动进入溢出面板）；
// 复用 defaultMenus 中已注册的命令，因此快捷键提示无需重复声明。
appendMenuItem(MenuId.EditorTitle, {
    command: { id: "editor.action.toggleWordWrap", title: "切换自动换行", icon: "word-wrap" },
    group: "9_other",
    order: 1
});
appendMenuItem(MenuId.EditorTitle, {
    command: { id: "editor.action.toggleMinimap", title: "切换缩略图", icon: "map" },
    group: "9_other",
    order: 2
});
appendMenuItem(MenuId.EditorTitle, {
    command: { id: "editor.action.formatDocument", title: "格式化文档", icon: "symbol-file" },
    group: "9_other",
    order: 3
});
