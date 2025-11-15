## 目标
- 启动后端 API（已有实现）
- 启动前端 Next 开发服务器，访问页面并调试 UI（含 `components/ui/*`）
- 前端将 `/api/*` 请求代理到后端，保持现有相对路径调用

## 步骤
1) 后端启动
- 在项目根安装开发依赖：`ts-node`、`typescript`、`@types/node`
- 运行服务：`npx ts-node backend/server.ts`（监听 3000）

2) 前端启动
- 在 `frontend/` 安装 `next` 与 `@types/node`
- 添加 `frontend/next.config.js`：配置 `rewrites` 将 `/api/:path*` 代理到 `http://localhost:3000/api/:path*`
- 启动开发服务器：`npx next dev -p 3001`

3) 访问与调试
- 打开 `http://localhost:3001/auth/LoginEntry`（入口页，可验证邮箱分流）
- 打开 `http://localhost:3001/Dashboard/Dashboard`（已接入 RouteGuard）
- 组件调试：页面内已广泛使用 `components/ui/*`，可直接在上述页面验证；若需要独立演示 `alert-dialog`，我可加一个临时页面引用该组件用于演示交互

## 说明
- 端口分配：后端 3000、前端 3001；前端通过 `rewrites` 使用相对路径 `/api/*` 调用后端
- 登录与邀请激活、重置密码、账套完成均已连通后端；先调通 `LoginEntry` 与 `Dashboard` 再逐页联调
- 若遇到 Next 页面 props 依赖（例如某些页仍使用 props 接收邮箱或 token），将按需在页面内改为从 `router.query` 读取以便路由直达