## 问题定位
- WelcomeModal 当前以页面内容的样式出现，而非覆盖层弹窗；控制台曾提示 Function components cannot be given refs，说明对话组件栈的 ref 传递不规范会导致 Overlay/Content无法正常挂载与定位。
- 账套页（AccountBookList）内渲染 WelcomeModal 是正确的用法，但应通过 Dialog 的 Portal 在页面顶部覆盖显示，不应“接在页面下面”。
- 侧边栏与顶部导航由 MainLayout 包裹非公共页面；若路由或包装条件异常，会出现无侧栏的简化布局。
- 控制台的权限策略提示（加速度计/设备方向）来自浏览器策略，不影响页面功能。

## 修复方案
1) 对话组件规范化
- 使用具备 React.forwardRef 的对话栈（DialogOverlay/Content/Header/Footer/Title/Description 统一 forwardRef），确保 Radix 的克隆元素正确传递 ref。
- 保持 Overlay/Content 使用 Portal 挂载，样式含 `fixed` 与 `z-50`，Header 维持 `z-40`，保证覆盖关系。

2) WelcomeModal 显示条件
- 在 AccountBookList 中根据真实用户状态控制：通过 `/api/user/me` 判断 `company.has_account_book`；仅当为 false 时 `showWelcome = true`。
- 移除默认始终 `true` 的显示，将首屏弹窗与“首次使用”逻辑绑定到后端状态，避免误显示。

3) 页面布局一致性
- 确认 `_app.tsx` 的 `publicPages` 不含 `/settings/account-books`；确保该页面由 `MainLayout` 包裹，侧边栏与顶部栏稳定呈现。
- 路由统一使用小写：`/settings/account-books`；别名文件 `pages/settings/account-books.tsx` 保持导出自 `AccountBookList`。

4) 视图增强（对齐你的期望图）
- 表格列保持：企业名称、启用期间、会计准则、纳税性质、凭证审核、启用状态、操作；凭证审核以 `review_enabled` 显示徽章；启用状态先固定为“已启用”。
- 企业名称列通过 `/api/user/me` 的 `companyName` 填充。

## 验证步骤
- 启动前后端后，访问 `/settings/account-books`：
  - 首次无账套：弹窗覆盖显示，背景变暗，不推挤页面；关闭后不再出现。
  - 已有账套：弹窗不显示；侧边栏与顶部栏始终存在。
- 使用 React DevTools 检查 WelcomeModal：
  - Overlay/Content 节点位于 Portal（document.body）下；Overlay 样式包含 `fixed` 与 `z-50`。
- 权限策略与第三方 Cookie 的浏览器提示无需处理，它们不影响渲染。

## 具体改动
- AccountBookList：
  - 初始化 `showWelcome` 改为根据 `/api/user/me` 结果计算；移除默认 `true`。
  - 从 `me()` 读取 `companyName`，用于表格“企业名称”。
- Dialog 组件（如仍存在旧实现）：
  - 将 Overlay/Content/Header/Footer/Title/Description 统一改为 forwardRef 包装；保留 Portal 与样式。

我将按以上方案修改、重启并逐项验证，确保 WelcomeModal 以弹窗覆盖显示且账套页布局与交互恢复正常。请确认后我立即执行。