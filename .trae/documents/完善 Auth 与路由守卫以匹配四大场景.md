## 结论与修正确认
- 纰漏1（场景一自动登录）成立：`POST /api/auth/register-company` 必须在成功后直接生成 JWT 并通过 httpOnly Cookie 返回，前端无需再调用 `/api/auth/login`。
- 纰漏2（Invitations 表不完整）成立：需明确存储目标邮箱、公司、角色、管理员标记、邀请人、状态与过期时间等字段，保证激活页能自动回显。
- 纰漏3（密码锁定后端缺失）成立：需在 Users 表新增 `failedAttempts`、`lockedUntil`，并在 `/api/auth/login` 中执行锁定策略与返回锁定信息。

## 后端实现（lowdb + express）
- 路由与会话
  - `POST /api/auth/check-email`（已存在）
  - `POST /api/auth/login`
    - 校验密码（`bcryptjs`）与用户锁定态；
    - 错误：`failedAttempts++`；当 `failedAttempts >= 5` → `lockedUntil=now+15min`，返回 401 `{ locked: true, lockedUntil }`；
    - 成功：重置 `failedAttempts=0`，生成 JWT（含 `userId, companyId, role`），写入 `httpOnly` Cookie。
  - `POST /api/auth/logout`：清除 Cookie。
  - `GET /api/user/me`：返回 `user, company, has_account_book`。
- 场景一：创建公司
  - `POST /api/auth/register-company`
    - 业务：邮箱唯一→创建 `Company{ has_account_book=false }` 与 `User{ role: Owner|Admin, status: Active }`；
    - 自动登录：立即生成 JWT 写入 `httpOnly` Cookie，无需再调用 `/api/auth/login`；返回 `user, company`。
- 场景三：邀请与激活
  - 数据模型：`Invitations`
    - `id, token, email, companyId, role, isAdmin, invitedBy, status(pending|activated|expired), expiresAt, createdAt`
  - `POST /api/invitations/send`：创建邀请并“发送邮件”（开发环境写日志/stub）。
  - `GET /api/auth/activate?token=...`：校验并返回 `{ email, companyName, role, isAdmin }`。
  - `POST /api/auth/activate`：入参 `token, name, password` → 设置密码与 `status=Active`；自动登录（JWT Cookie），返回 `user, company`。
- 场景四：忘记密码
  - `POST /api/auth/reset-request`：固定返回“邮件已发送”；存在用户则生成 `PasswordReset{ token, userId, expiresAt }`；加入限流（如同一 IP 5 分钟最多 3 次）。
  - `GET /api/auth/reset-verify?token=...`：校验并返回 `{ email }`。
  - `POST /api/auth/reset-confirm`：入参 `token, newPassword` → 更新密码、失效令牌；返回成功后由前端跳至“输入密码”页。
- 账套完成
  - `POST /api/company/account-book/complete`：鉴权后置 `company.has_account_book=true`。
- 数据层统一
  - Users：新增 `failedAttempts: number`、`lockedUntil: ISOString|null`；其余字段沿用 `backend/database.ts:5-25`。
  - Companies：`id, name, has_account_book`。
  - Invitations/PasswordReset：如上所述新增集合。

## 前端接入
- 统一客户端 `frontend/lib/api/auth.ts`：封装所有调用与错误处理。
- LoginEntry：沿用 `frontend/pages/auth/LoginEntry.tsx:31-51` 的分流。
- LoginPassword：用真实 `/api/auth/login` 替换 `frontend/pages/auth/LoginPassword.tsx:33-55` 的 `setTimeout`；根据返回的 `{ locked, lockedUntil }` 展示锁定文案。
- CreateCompany：用 `/api/auth/register-company` 替换 `frontend/pages/setup/CreateCompany.tsx:60-71`；成功后自动登录并进入“逻辑中枢”。
- ActivateAccount：`useEffect` 先调 `/api/auth/activate` 校验；提交调 `/api/auth/activate` 完成激活与自动登录。
- ResetPassword/SetNewPassword：分别接入 `/api/auth/reset-request`、`/api/auth/reset-verify` 与 `/api/auth/reset-confirm`；成功后回到“输入密码”页。

## 路由守卫（统一出口）
- 位置选择：采用独立组件 `frontend/components/RouteGuard.tsx`，在 `MainLayout.tsx` 中调用，模块化清晰；
- 行为：登录或进入系统后调用 `GET /api/user/me` → `has_account_book=false` 强制到 `setup/InitialDataEntry` 并弹窗；`true` 则到 `Dashboard/Dashboard`。

## 安全与一致性
- 密码规则：前后端一致（≥8 位、字母+数字）。
- 令牌：随机生成、含过期、一次性消费。
- Cookie：`httpOnly`，生产 `secure` 与 `sameSite=Lax`。
- 限流：`reset-request` 加入最小限流；可扩展到 `login`。

## 验收对照
- 场景一：注册后自动登录→守卫因 `has_account_book=false` 进入初始化。
- 场景二：密码错误 5 次后锁定 15 分钟；正确登录进入首页。
- 场景三：邀请链接校验→自动回显邮箱与角色→激活后自动登录进入首页。
- 场景四：请求重置固定成功→设置新密码→返回“输入密码”用新密码登录。

## 实施顺序
1) 扩展数据层（Users 字段、Invitations/PasswordReset 集合）。
2) 新增 `server` 与完整路由；接入 JWT Cookie。
3) 前端替换页面的模拟逻辑为真实 API；
4) 实施 `RouteGuard` 并在 `MainLayout` 调用；
5) 联调与验收。