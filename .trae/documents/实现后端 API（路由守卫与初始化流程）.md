## 可行性结论
- 你的 API 设计可行，按低耦合的资源边界划分：鉴权、公司状态、账套、期初数据与初始化完成。后端以 lowdb 存储，使用会话 cookie 识别当前用户与公司。

## 数据结构扩展
- 在 `backend/database.ts` 增加：
  - `AccountBook{ id, companyId, name, period_start, review_enabled, createdAt }`
  - `InitialBalance{ id, companyId, subjectCode, subjectName, category, direction, debitBalance, creditBalance }`
  - `Company{ ..., has_account_book: boolean, has_initial_balances: boolean }`（现有公司增加 `has_initial_balances`）

## 路由实现
- 文件：`backend/server.ts`
- 会话：沿用现有 cookie 会话解析 `userId/companyId`

- GET `/api/user/me`
  - 返回 `{ has_account_book, has_initial_balances }`（从公司记录）

- POST `/api/auth/check-email`
  - 已有，保留

- POST `/api/auth/login`
  - 已有，保留；成功后写入会话 cookie

- POST `/api/auth/register`
  - 等价别名：保留 `/api/auth/register-company` 并新增 `/api/auth/register`
  - 入参：`{ email, name, companyName, password }`
  - 创建公司：`has_account_book=false, has_initial_balances=false`
  - 创建用户并自动登录（生成会话 cookie）

- POST `/api/settings/account-books`
  - 入参：`{ name, period_start, review_enabled }`
  - 创建 `AccountBook` 记录并将公司 `has_account_book=true`

- POST `/api/settings/initial-data/trial-balance`
  - 入参：科目期初余额数组 `[{ subjectCode, subjectName, category, direction, debitBalance, creditBalance }]`
  - 计算：资产合计与负债+权益合计差额；持久化为公司维度的 `InitialBalance` 集合
  - 返回：`{ success, difference }`

- POST `/api/settings/initialization/complete`
  - 将公司 `has_initial_balances=true`

## 行为对齐
- RouteGuard：使用 `/api/user/me` 判断 `has_account_book/has_initial_balances`
- 登录后分流：无账套→账套管理；账套已建但未完成初始化→首页显示设置清单；完成后→正常工作台

## 交付文件
- `backend/database.ts`：扩展 schema 并默认字段
- `backend/server.ts`：新增与调整上述路由

## 验证
- 场景一注册后自动登录，`has_account_book=false/has_initial_balances=false`
- 账套保存后 `has_account_book=true`
- 试算平衡返回差额为 0 时可继续完成初始化；完成后 `has_initial_balances=true`

## 下一步
- 我将直接在 `backend/` 实现以上数据结构与路由，保持无外部依赖变更，仅使用现有 lowdb 与 cookie 会话。