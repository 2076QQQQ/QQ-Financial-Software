## 问题定位
- 会计科目页的表格完全空白，排查组件 `frontend/components/ui/table.tsx` 发现：
  - `Table` 返回 `<table {...props} />` 自闭合标签，未渲染 `props.children`。
  - `TableHeader/TableBody/TableRow/TableHead/TableCell/TableFooter/TableCaption` 同样使用自闭合标签，导致所有传入的 `<TableRow>`、`<TableHead>`、`<TableCell>` 内容被丢弃。
- 这正是导致“表格头和内容都不显示”的根因。

## 修复方案
- 将所有自闭合标签改为标准开闭标签，并渲染 `children`：
  - `Table`: `<table className=... {...props}>{props.children}</table>`
  - `TableHeader`: `<thead className=... {...props}>{props.children}</thead>`
  - `TableBody`: `<tbody className=... {...props}>{props.children}</tbody>`
  - `TableRow`: `<tr className=... {...props}>{props.children}</tr>`
  - `TableHead`: `<th className=... {...props}>{props.children}</th>`
  - `TableCell`: `<td className=... {...props}>{props.children}</td>`
  - `TableFooter`/`TableCaption` 同理。

## 验证
- 打开 `/settings/subjects`，应显示内置科目列表和五大类别中的数据。
- 其他使用该 `Table` 的页面（账套列表、资金账户、期初数据）也恢复正常渲染。

## 变更文件
- 仅修改：`frontend/components/ui/table.tsx`（无新增文件）。

请确认，我将立即应用修复并验证页面恢复。