// 命令注册表（对齐 VS Code platform/commands 的 CommandsRegistry）。
//
// 菜单项只引用命令 id，执行时按 id 查找处理函数；菜单系统与具体动作解耦。

const _commands = new Map();

export function registerCommand(id, handler) {
    if (_commands.has(id)) {
        throw new Error(`命令 '${id}' 已注册`);
    }
    _commands.set(id, handler);
    return {
        dispose() {
            _commands.delete(id);
        }
    };
}

export function executeCommand(id, ...args) {
    const handler = _commands.get(id);
    if (!handler) {
        throw new Error(`未找到命令 '${id}'`);
    }
    return handler(...args);
}

export function getCommand(id) {
    return _commands.get(id);
}

export function hasCommand(id) {
    return _commands.has(id);
}
