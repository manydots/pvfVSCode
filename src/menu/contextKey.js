// 上下文键与 when 表达式（对齐 VS Code platform/contextkey 的极简实现）。
//
// 菜单项的可见性（when）与启用态（precondition）都由表达式对当前上下文求值决定。

import { ConfigAwareContextValues } from "@/platform/contextkey/browser/configAwareContextValues.js";

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
//
// `config.*` 前缀的键不在此表内，而由配置服务派生（对齐 contextKeyService.ts:104-176 的
// ConfigAwareContextValuesContainer；权威把它作为服务的父容器，本仓库在 get 里分流）。
// 显式 set 的同名键仍优先 —— 权威里子容器的值遮蔽父容器。
export class ContextKeyService {
    constructor() {
        this._values = new Map();
        this._listeners = new Set();
        this._configValues = null;
    }

    // 注入配置服务（对齐工作台创建 ContextKeyService 时注入 IConfigurationService）。
    // 必须在编辑器部件创建与菜单首次求值之前调用，见 main.js。
    attachConfigurationService(configurationService) {
        this._configValues?.dispose();
        this._configValues = new ConfigAwareContextValues(configurationService, keys => {
            for (const key of keys) this._notify(key);
        });
        return this._configValues;
    }

    set(key, value) {
        if (this._values.get(key) === value) return;
        this._values.set(key, value);
        this._notify(key);
    }

    get(key) {
        if (this._values.has(key)) return this._values.get(key);
        return this._configValues?.getValue(key);
    }

    onDidChange(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    _notify(key) {
        for (const listener of this._listeners) listener(key);
    }
}

export const contextKeys = new ContextKeyService();
