// 命令注册表（对齐 VS Code platform/commands 的 CommandsRegistry）。
//
// 菜单项只引用命令 id，执行时按 id 查找处理函数；菜单系统与具体动作解耦。

const _commands = new Map();

// metadata 对齐 VS Code CommandsRegistry.registerCommand 的 ICommandMetadata：
// 命令选择器（快速输入的「>」模式）按 metadata.description 显示标题
// （platform/quickinput/browser/commandsQuickAccess.ts:252-256）。
export function registerCommand(id, handler, metadata) {
    if (_commands.has(id)) {
        throw new Error(`命令 '${id}' 已注册`);
    }
    _commands.set(id, { handler, metadata: metadata ?? Object.create(null) });
    return {
        dispose() {
            _commands.delete(id);
        }
    };
}

export function executeCommand(id, ...args) {
    const command = _commands.get(id);
    if (!command) {
        throw new Error(`未找到命令 '${id}'`);
    }
    return command.handler(...args);
}

export function getCommand(id) {
    return _commands.get(id)?.handler;
}

export function hasCommand(id) {
    return _commands.has(id);
}

// 对齐 CommandsRegistry.getCommands()：返回 { id, metadata } 列表，供命令快速输入取数。
export function getCommands() {
    return [..._commands.entries()].map(([id, command]) => ({ id, metadata: command.metadata }));
}
