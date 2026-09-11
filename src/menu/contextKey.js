// 上下文键与 when 表达式（对齐 VS Code platform/contextkey 的极简实现）。
//
// 菜单项的可见性（when）与启用态（precondition）都由表达式对当前上下文求值决定。

class ContextKeyExpression {
    constructor(evaluate, serialize) {
        this._evaluate = evaluate;
        this._serialize = serialize;
    }

    evaluate(context) {
        return this._evaluate(context);
    }

    serialize() {
        return this._serialize;
    }
}

export const ContextKeyExpr = {
    has(key) {
        return new ContextKeyExpression(ctx => !!ctx.get(key), key);
    },
    equals(key, value) {
        return new ContextKeyExpression(ctx => ctx.get(key) === value, `${key} == ${value}`);
    },
    notEquals(key, value) {
        return new ContextKeyExpression(ctx => ctx.get(key) !== value, `${key} != ${value}`);
    },
    not(expr) {
        return new ContextKeyExpression(ctx => !expr.evaluate(ctx), `!(${expr.serialize()})`);
    },
    and(...exprs) {
        return new ContextKeyExpression(ctx => exprs.every(e => e.evaluate(ctx)), exprs.map(e => e.serialize()).join(" && "));
    },
    or(...exprs) {
        return new ContextKeyExpression(ctx => exprs.some(e => e.evaluate(ctx)), exprs.map(e => e.serialize()).join(" || "));
    }
};

// 上下文键服务：保存键值，值变化时通知（菜单打开期间据此重算可见性与启用态）。
export class ContextKeyService {
    constructor() {
        this._values = new Map();
        this._listeners = new Set();
    }

    set(key, value) {
        if (this._values.get(key) === value) return;
        this._values.set(key, value);
        for (const listener of this._listeners) listener(key);
    }

    get(key) {
        return this._values.get(key);
    }

    onDidChange(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }
}

export const contextKeys = new ContextKeyService();
