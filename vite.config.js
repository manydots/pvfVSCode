import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// GitHub Pages 的项目站点挂在子路径下（https://<owner>.github.io/<repo>/），构建时必须把 base
// 设为 /<repo>/，否则 index.html 里的资源引用会指向域名根而 404。参考项目中该值写死为 /launch-helper/；
// 这里改为读取 Actions 注入的 GITHUB_REPOSITORY（owner/repo），避免仓库改名或尚未确定仓库名时写错。
// 用户站点（<owner>.github.io）与本地开发、其它静态托管仍使用根路径 "/"。
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base = !repoName || repoName.endsWith(".github.io") ? "/" : `/${repoName}/`;

export default defineConfig({
    base,
    server: {
        host: "0.0.0.0",
        port: 5173
    },
    plugins: [vue()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url))
        },
        extensions: [".mjs", ".cjs", ".js", ".ts", ".jsx", ".tsx", ".json", ".vue"]
    },
    build: {
        chunkSizeWarningLimit: 4096,
        rollupOptions: {
            output: {
                manualChunks: {
                    monaco: ["monaco-editor"]
                }
            }
        }
    }
});
