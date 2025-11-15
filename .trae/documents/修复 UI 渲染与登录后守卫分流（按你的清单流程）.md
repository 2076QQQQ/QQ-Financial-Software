## 修复 categoryName 导致的 UI 报错
- 位置：`frontend/lib/mockData.ts` 的 `getCashFlowByCategory` 与 `getYearCashFlow`
- 改动：
  - 方案 A（最小改动）：在分组前做类型守卫，`if (!entry.categoryName) return;`（或默认 "未分类"）
  - 方案 B（更稳妥）：改为按 `categoryId` 分组，汇总后再通过类别表映射到 `categoryName`，避免名称缺失或变更导致的统计错误
- 位置：`frontend/pages/accounting/CashJournal.tsx`
  - 保证在修改 `categoryId` 时同步写入非空的 `categoryName`；新增行选择类别时也写入两者；避免上游数据产生 `undefined`

## 登录后的守卫分流（不直接跳到期初录入）
- 修改守卫逻辑：
  - 从 `RouteGuard` 中移除“has_account_book=false → InitialDataEntry”的跳转
  - 改为：登录后请求 `/api/user/me`；若 `company.has_account_book=false` → 重定向到 `系统设置/账套管理` 页面（路径 `/settings/account-books`）
- UI 锁定与欢迎弹窗：
  - 在主界面加载时，侧边栏所有业务菜单禁用，仅允许进入“系统设置”分组
  - 自动高亮“系统设置 → 账套管理”，右侧内容区加载“账套管理列表”
  - 弹出不可关闭的 Modal（`components/ui/alert-dialog.tsx`）欢迎提示，仅提供“立即创建账套”按钮
  - 点击后自动触发“新增账套”弹窗（`/settings/account-books` 页面右上角的新增按钮），填写并保存
- 完成账套后：
  - 后端置 `has_account_book=true`（`POST /api/company/account-book/complete` 已实现）
  - 重定向到首页工作台 `/Dashboard/Dashboard`，显示“设置清单（Checklist）”而非常规工作台

## 设置清单（首页工作台替换）
- 清单内容：
  - 1) 创建账套（自动勾选）
  - 2) 设置会计科目 → 路由到 `/settings/subjects`
  - 3) 添加资金账户 → 路由到 `/settings/fund-accounts`
  - 4) 录入期初数据 → 路由到 `/settings/initial-data`
- 在清单完成前，侧边栏继续禁用其他业务菜单；完成后全部解锁（后端标记 `has_initial_balances=true` 及相关状态）

## 具体文件改动点（非代码，只列出位置与动作）
- `frontend/lib/mockData.ts`：增加类型守卫或改为按 `categoryId` 分组
- `frontend/pages/accounting/CashJournal.tsx`：更新/新增类别时保证 `categoryName` 同步写入
- `frontend/components/RouteGuard.tsx`：更新分流逻辑为 `/settings/account-books` 并实现 UI 锁定状态（通过全局状态或 Context）
- `frontend/pages/settings/account-books/index.tsx`：实现列表、右上角“新增”弹窗与保存；欢迎弹窗调用“新增”
- `frontend/pages/Dashboard/Dashboard.tsx`：在 `has_account_book=true` 且初始化未完成时，展示 `SetupWizard` 清单替代工作台

## 验证
- 老用户登录（有账套）：直接进入首页工作台
- 新公司老板登录：进入“系统设置/账套管理” → 欢迎弹窗 → 新增账套 → 自动登录状态保持 → 返回首页展示“设置清单”
- 现金流报表与分类分组：不再出现 `categoryName` 为 `undefined` 导致的渲染错误

## 备注
- 若你同意“按 `categoryId` 分组”的更稳方案，我将一起完成映射逻辑；否则先做最小改动的类型守卫以尽快恢复 UI。