## 修复方案
- 添加根路径重定向：将 `/` 重定向到 `/auth/LoginEntry`，避免 404。
- 将认证相关页面改造成标准 Next 页面：去掉 props 依赖，改为从 `router.query` 读取参数并使用 `router.push` 导航。

## 具体改动
1) 根路径
- 新增 `frontend/pages/index.tsx`，使用服务端重定向到 `/auth/LoginEntry`。

2) 页面重构
- `auth/LoginPassword.tsx`：从 `router.query.email` 读取邮箱；`返回`→`/auth/LoginEntry`；`忘记密码`→`/auth/ResetPassword`；登录成功→`/Dashboard/Dashboard`。
- `setup/CreateCompany.tsx`：从 `router.query.email` 读取邮箱；提交成功→`/setup/InitialDataEntry`；返回→`/auth/LoginEntry`。
- `auth/ActivateAccount.tsx`：从 `router.query.token` 读取令牌；激活成功→`/Dashboard/Dashboard`。
- `auth/ResetPassword.tsx`：不再依赖 props；提交成功后跳到 `/auth/ResetPasswordSent?email=...`；返回→`/auth/LoginEntry`。
- `auth/ResetPasswordSent.tsx`：从 `router.query.email` 读取邮箱；提供按钮跳转到 `/auth/LoginEntry`（真实流程通过邮件链接进入设置新密码）。
- `auth/SetNewPassword.tsx`：删除 `onSuccess` 调用，仅使用路由跳转回密码页。

## 验证
- 访问 `http://localhost:3001/` 自动进入登录入口。
- 从入口页按四大场景路径逐页联调，确保页面与后端接口连通，无 props 依赖导致的渲染或事件错误。