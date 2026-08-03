import type { Ref } from 'react'

// `lib/gestures.js` 的类型声明。实现故意留在 `.js`：它 import 的 `aibox/ui` 是宿主随运行时
// 资产提供的模块（import map 解析、无 .d.ts），在 `.ts` 里会变成一条永远消不掉的 TS7016。

export interface RowAction {
  id: string
  title: string
  icon?: string
  role?: 'normal' | 'destructive'
  tint?: 'default' | 'accent' | 'danger'
}

export interface RowActionOverride {
  title?: string | null
  icon?: string | null
  enabled?: boolean | null
  hidden?: boolean | null
}

export function useRowGestures(
  regionId: string,
  config?: {
    contextMenu?: RowAction[]
    leadingSwipe?: RowAction[]
    trailingSwipe?: RowAction[]
    rowOverrides?: (rowId: string) => Record<string, RowActionOverride> | null | undefined
    onAction?: (event: { regionId: string; rowId: string; actionId: string; source: string }) => void
    enabled?: boolean
  },
): {
  /** 宿主是否真的挂上了手势层。false ⇒ 业务**必须**保留自绘的长按/滑动。 */
  rendered: boolean
  available: boolean
  /** 铺到滚动容器上；每一行再铺 `data-row-id`。 */
  regionProps: { ref: Ref<HTMLDivElement>; 'data-region-id': string }
} 
