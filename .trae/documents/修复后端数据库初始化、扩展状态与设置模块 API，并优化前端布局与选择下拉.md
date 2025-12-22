## 后端修复与扩展

* 修复数据库初始化：移除每次请求中的 `await initDb()`，仅在服务启动前调用一次，避免并发覆盖写入。

* 统一端口：将后端监听改为 3000，以匹配前端代理配置（前端 `rewrites` 指向 3000）。

* 扩展公司状态：在 `Company` 增加 `has_initial_balances`。

* 新增数据集合：`AccountBook`、`InitialBalance`、`Subject`、`FundAccount`、`AuxiliaryType`、`AuxiliaryItem`，并加入 `DbData` 与 `defaultData`。

* 扩展 GET `/api/user/me`：返回 `has_account_book`、`has_initial_balances`，并附加 `has_subjects_configured` 与 `has_fund_accounts`。

* 新增设置 API：

  * 科目：GET/POST `/api/settings/subjects`（公司隔离、编码去重）

  * 资金账户：GET/POST `/api/settings/fund-accounts`（公司隔离）

  * 辅助核算：GET/POST `/api/settings/auxiliary-types`，GET `/api/settings/auxiliary-items?typeId=...`（公司隔离）

* 初始化流程 API：

  * 创建账套：POST `/api/settings/account-books`（成功后置 `has_account_book=true`）

  * 试算平衡：POST `/api/settings/initial-data/trial-balance`（持久化并计算差额）

  * 初始化完成：POST `/api/settings/initialization/complete`（置 `has_initial_balances=true`）

## 前端优化

* MainLayout：右侧内容区添加 `min-h-screen flex flex-col`，`main` 添加 `flex-1`，确保布局填满并美观。

* AccountBookModal：年份下拉 `SelectContent` 添加 `max-h-60 overflow-y-auto`，确保可滚动选择。

* 保持 RouteGuard 分流：无账套 → `/settings/account-books`，其余按 checklist 流程。

## 验证与注意

* 所有受保护 API 路由使用会话解析，并按 `companyId` 过滤数据。

* 前端代理到 3000，服务端启动前进行一次 `initDb()`。

* 完整检查：注册→创建账套→退出再登录，状态持久；设置清单动态显示；期初试算与完成后解锁。

