## 结论
- 你给的方案可行：为前端单独配置 `tsconfig.json` 的 `baseUrl` 与 `paths`，统一使用 `@/` 别名，能彻底避免相对路径错误与缓存误读导致的 “Module not found”。
- 当前错误仍指向 `../lib/api/auth`，说明开发服务器使用了旧缓存或仍有个别文件未改。统一切换到别名可一并解决。

## 修改项
1) 新增 `frontend/tsconfig.json`
- 按你给的内容创建，关键点：
  - `baseUrl: '.'`
  - `paths`: `@/*`, `@/components/*`, `@/lib/*`, `@/pages/*`
  - 其余编译选项与 include/exclude 按你的示例配置

2) 将所有 `../../lib/api/auth` / `../lib/api/auth` 改为别名 `@/lib/api/auth`
- 涉及文件：
  - `frontend/pages/setup/InitialDataEntry.tsx`（`completeAccountBook`）
  - `frontend/pages/setup/CreateCompany.tsx`（`registerCompany`）
  - `frontend/pages/auth/LoginPassword.tsx`（`login`）
  - `frontend/pages/auth/ActivateAccount.tsx`（`activateInfo`, `activate`）
  - `frontend/pages/auth/ResetPassword.tsx`（`resetRequest`）
  - `frontend/pages/auth/SetNewPassword.tsx`（`resetVerify`, `resetConfirm`）
  - `frontend/components/RouteGuard.tsx`（`me`）

3) （可选优化）在 `frontend/next.config.js` 设置 `turbopack.root` 指向 `frontend`
- 目的：去除 Next 的 root 警告，避免工作区根推断到项目根引起路径扫描偏差
- 示例：
```js
module.exports = {
  experimental: { turbopack: { root: __dirname } },
  async rewrites() { return [{ source: '/api/:path*', destination: 'http://localhost:3000/api/:path*' }] },
};
```

4) 重启前端开发服务器
- 停止现有 dev → 重启 `npx next dev -p 3001`
- 必要时清理 `.next` 缓存后再启动（Windows 下可用 PowerShell 删除 `.next` 目录）

## 验证
- `http://localhost:3001/auth/LoginEntry` 正常渲染且无 “Module not found”
- `http://localhost:3001/setup/InitialDataEntry` 能正常加载（不再指向 `../lib/api/auth`）
- 登录完 `http://localhost:3001/Dashboard/Dashboard` 正常，且样式已恢复（Tailwind + 全局主题变量生效）

## 备注
- `frontend/lib/api/auth.ts` 已存在并导出所有方法，别名切换不会影响其使用。
- 此方案符合 Next 官方对 “Module not found” 的解决思路：统一并准确的路径解析，配合服务重启以清除旧缓存。