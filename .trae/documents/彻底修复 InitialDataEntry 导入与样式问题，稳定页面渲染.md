## 目标
- 消除“Module not found: ../lib/api/auth”错误来源
- 确认并修复所有错误导入路径
- 重启前端开发服务器以清理缓存，确保页面正常渲染

## 步骤
1) 全库检索
- 在 `frontend/pages` 目录内检索字符串 `../lib/api/auth`，定位所有错误引用
- 重点核查：`frontend/pages/setup/InitialDataEntry.tsx` 是否仍存在错误导入

2) 修复导入
- 将所有错误引用统一改为正确路径：
  - 从 `pages/setup/*.tsx` → 使用 `../../lib/api/auth`
  - 从 `pages/auth/*.tsx` → 使用 `../../lib/api/auth`

3) 重启前端
- 停止并重启 Next 开发服务器（3001）以清除 Turbopack 缓存
- 验证路由：`/auth/LoginEntry`、`/Dashboard/Dashboard`、`/setup/InitialDataEntry`

4) 样式确认
- 确认 `_app.tsx` 已加载 `styles/globals.css`，Tailwind 与 PostCSS 配置生效，UI恢复正确主题

## 结果
- 初始数据录入页导入错误不再出现，页面可正常渲染
- 登录入口与首页工作台样式恢复到设计效果