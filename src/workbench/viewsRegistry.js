// 视图容器与视图注册表（对齐 VS Code workbench/common/views.ts 的 ViewsRegistry）。
//
// 活动栏渲染的是位于 Sidebar 位置的视图容器；每个容器下挂若干视图，
// 侧栏只负责把当前容器的视图渲染出来。视图与容器均为声明式注册。

export const ViewContainerLocation = Object.freeze({
    Sidebar: "sidebar",
    Panel: "panel",
    AuxiliaryBar: "auxiliaryBar"
});

const _containers = new Map();

function toContainer(descriptor, location) {
    return {
        id: descriptor.id,
        title: descriptor.title,
        icon: descriptor.icon,
        order: descriptor.order ?? 0,
        location,
        // 容器标题右侧的动作（如资源管理器的新建/刷新/折叠），由贡献模块声明。
        titleActions: descriptor.titleActions ?? [],
        views: []
    };
}

export function registerViewContainer(descriptor, location) {
    if (_containers.has(descriptor.id)) {
        throw new Error(`视图容器 '${descriptor.id}' 已注册`);
    }
    const container = toContainer(descriptor, location);
    _containers.set(container.id, container);
    return container;
}

export function registerViews(views, container) {
    for (const view of views) {
        container.views.push({
            id: view.id,
            name: view.name ?? "",
            order: view.order ?? 0,
            component: view.component,
            // 视图组件的静态属性（对齐 VS Code 视图描述符里由视图自身读取的构造参数）。
            props: view.props ?? {}
        });
    }
    container.views.sort((a, b) => a.order - b.order);
}

export function getViewContainer(id) {
    return _containers.get(id) ?? null;
}

export function getViewContainers(location) {
    return [..._containers.values()].filter(container => container.location === location).sort((a, b) => a.order - b.order);
}

export function getViews(container) {
    return container?.views ?? [];
}
