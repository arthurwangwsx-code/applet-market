// 记账 —— AiBox 小应用。
// 运行时：React 18 + antd-mobile v5（离线内置）。只导出 default，宿主外壳负责挂载。

import React from 'react'
import { Button, List } from 'antd-mobile'

export default function App() {
  const [count, setCount] = React.useState(0)
  return (
    <div style={{ padding: 16 }}>
      <List header="记账">
        <List.Item extra={count}>点击次数</List.Item>
      </List>
      <Button block color="primary" style={{ marginTop: 16 }} onClick={() => setCount((n) => n + 1)}>
        点我
      </Button>
    </div>
  )
}
