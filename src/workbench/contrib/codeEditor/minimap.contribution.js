// 缩略图的开关动作（对齐 <vscode>/src/vs/workbench/contrib/codeEditor/browser/toggleMinimap.ts）。
//
// 与「切换自动换行」的关键区别：缩略图**是配置项**，勾选态即 `config.editor.minimap.enabled` 的值
// （toggleMinimap.ts:26），run 里改的也是该配置项（:35-39），因此勾选态可持久化、
// 且不受「按模型临时覆盖」影响。
//
// 菜单落点：权威只挂 `MenuId.MenubarAppearanceMenu` 的 `4_editor` 组、order 1（:27-31）；
// 本仓库没有「外观」顶级菜单，故落在「视图」菜单（group `1_layout`、order 3），
// 另加标题栏布局控制菜单与编辑器标签栏「…」溢出菜单两处本仓库既有落点 ——
// 见 docs/vscode-reference.md 第 5 节。
// 三处都写在动作的 menu 里（而不是裸 appendMenuItem）：toggled 属于命令描述符，
// registerAction2 会把它展开进每个落点（platform/actions/common/actions.ts:741-751），
// 这样三处的勾选态必然一致。
import { registerAction2 } from "@/menu/actions.js";
import { MenuId } from "@/menu/menuId.js";
import { ContextKeyExpr } from "@/menu/contextKey.js";
import { setStatus } from "@/menu/appState.js";
import { configurationService } from "@/workbench/services/configuration/browser/configurationService.js";

// 权威该命令不带 icon（菜单项为纯文字，见 MenuPanel.vue 的注释），此处也不声明。
export const MINIMAP_ENABLED_SETTING = "editor.minimap.enabled";

registerAction2({
    id: "editor.action.toggleMinimap",
    title: "切换缩略图",
    // toggleMinimap.ts:26：勾选态直接取配置值（config.* 上下文键由配置服务派生，
    // 见 platform/contextkey/browser/configAwareContextValues.js）
    toggled: ContextKeyExpr.equals(`config.${MINIMAP_ENABLED_SETTING}`, true),
    menu: [
        { id: MenuId.MenubarViewMenu, group: "1_layout", order: 3 },
        { id: MenuId.LayoutControlMenu, group: "1_layout", order: 3 },
        { id: MenuId.EditorTitle, group: "9_other", order: 2 }
    ],
    // toggleMinimap.ts:35-39：取反后写回配置（等于默认值时配置服务会删除该设置项）
    async run() {
        const nextValue = !configurationService.getValue(MINIMAP_ENABLED_SETTING);
        await configurationService.updateValue(MINIMAP_ENABLED_SETTING, nextValue);
        setStatus(nextValue ? "已显示缩略图" : "已隐藏缩略图");
    }
});
