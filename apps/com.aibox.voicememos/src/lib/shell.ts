// 宿主外壳里**还没有框架归宿**的两件：顶栏标题写入与**悬浮层**（`aibox.overlay`）。
//
// ## 2026-08-03：`useSubpageStack` 已上架，本文件不再自持一份
// 系统页栈那一半（`historyDepth` / `hostPush` 的排序屏障 / 深度对齐的 popstate 处理）曾在这里
// 抄了一份，与音乐 `lib/subpages.js` 逐条同源 —— 它现在住在 `aibox/ui`，调用方直接
// `import { useSubpageStack } from 'aibox/ui'`。**不要再往这里加第二份。**
//
// 留在本地的两件与它们的去向：
//  · `setNavigationTitle` —— 属于 host 门面（音乐的 `lib/host.js` 里也有一份），
//    等 host 门面那条线统一时一起上架，不在页栈这一轮里。
//  · `useOverlay` —— `aibox.overlay` 的接线口，目前只有本应用与音乐在用；
//    理财 / 记账接进来时就该抬进 `aibox/ui`（判据同页栈：出现第二个抄写者即上架）。

import { useCallback, useEffect, useRef, useState } from 'react'

type Bridge = Record<string, any> | undefined

const bridge = (): Bridge => (typeof window !== 'undefined' ? (window as any).aibox : undefined)

// MARK: - 顶栏标题

function hostNavigation(): any {
  const api = bridge()
  return (api && api.navigation) || null
}

/** 顶栏标题。宿主画了顶栏时**页面不要自绘**，标题由这里写进宿主的标题栈。 */
export function setNavigationTitle(title: string): void {
  const nav = hostNavigation()
  if (!nav || typeof nav.setTitle !== 'function') return
  try {
    const result = nav.setTitle(title)
    if (result && typeof result.catch === 'function') result.catch(() => {})
  } catch { /* 标题是装饰 */ }
}

// MARK: - 悬浮层（`aibox.overlay`）

export interface OverlayItemPatch {
  title?: string | null
  subtitle?: string | null
  progress?: number | null
  active?: boolean | null
  enabled?: boolean | null
  hidden?: boolean | null
  controls?: Record<string, { active?: boolean | null; enabled?: boolean | null; hidden?: boolean | null }>
}

/**
 * 悬浮层：**常驻控制层**（录音键、播放条），宿主把它和底栏叠进同一个 `safeAreaInset`，
 * 自下而上是 底栏 → bar → button，并从可见区里扣掉自己的高度。
 *
 * `rendered === false`（card/sheet/drawer 形态、声明越界、宿主太老）时业务**必须**把控件
 * 放回自己的内容流 —— 这条降级路径永远不能删。
 */
export function useOverlay(onInvoke: (event: { id: string; controlId?: string }) => void): {
  rendered: boolean
  update: (items: Record<string, OverlayItemPatch>) => void
} {
  const [rendered, setRendered] = useState(false)
  const handler = useRef(onInvoke)
  handler.current = onInvoke

  useEffect(() => {
    const api = bridge()
    const overlay = api && api.overlay
    if (!overlay || typeof overlay.getState !== 'function') return undefined
    let cancelled = false
    const offs: Array<() => void> = []

    overlay.getState()
      .then((state: any) => { if (!cancelled) setRendered(!!(state && state.rendered)) })
      .catch(() => undefined)

    if (typeof overlay.on === 'function') {
      try {
        offs.push(overlay.on('invoke', (event: any) => handler.current(event || {})))
      } catch { /* 宿主未实现事件订阅 */ }
      try {
        // `rendered` 会**在挂载之后翻转**（形态切换、控制器重建都会重发 changed）。
        // 只判断启动那一刻，自绘控件就会永远缺席或永远多一份。
        offs.push(overlay.on('changed', (state: any) => {
          if (!cancelled) setRendered(!!(state && state.rendered))
        }))
      } catch { /* 同上 */ }
    }

    return () => {
      cancelled = true
      offs.forEach((off) => { try { if (typeof off === 'function') off() } catch { /* 忽略 */ } })
    }
  }, [])

  const update = useCallback((items: Record<string, OverlayItemPatch>) => {
    const api = bridge()
    const overlay = api && api.overlay
    if (!overlay || typeof overlay.update !== 'function') return
    try {
      const result = overlay.update({ items })
      if (result && typeof result.catch === 'function') result.catch(() => {})
    } catch { /* 展示态更新失败不该影响业务 */ }
  }, [])

  return { rendered, update }
}
