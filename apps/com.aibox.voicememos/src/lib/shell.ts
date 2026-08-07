// 宿主外壳里**还没有框架归宿**的两件：顶栏标题写入与**悬浮层**（`aibox.overlay`）。
//
// ## 2026-08-03：`useSubpageStack` 已上架，本文件不再自持一份
// 系统页栈那一半（`historyDepth` / `hostPush` 的排序屏障 / 深度对齐的 popstate 处理）曾在这里
// 抄了一份，与音乐 `lib/subpages.js` 逐条同源 —— 它现在住在 `aibox/ui`，调用方直接
// `import { useSubpageStack } from 'aibox/ui'`。**不要再往这里加第二份。**
//
// 留在本地的三件与它们的去向：
//  · `setNavigationTitle` —— 属于 host 门面（音乐的 `lib/host.js` 里也有一份），
//    等 host 门面那条线统一时一起上架，不在页栈这一轮里。
//  · `useOverlay` —— `aibox.overlay` 的接线口，目前只有本应用与音乐在用；
//    理财 / 记账接进来时就该抬进 `aibox/ui`（判据同页栈：出现第二个抄写者即上架）。
//  · `useHostMenu` / `useHostChrome` —— 系统 ⋯ 菜单与「宿主画没画顶栏」，判据同上。

import { useCallback, useEffect, useRef, useState } from 'react'
import { bridge } from '@aibox/applet-sdk'

// MARK: - 顶栏标题

function hostNavigation() {
  return bridge()?.navigation ?? null
}

/** 顶栏标题。宿主画了顶栏时**页面不要自绘**，标题由这里写进宿主的标题栈。 */
export function setNavigationTitle(title: string): void {
  const nav = hostNavigation()
  if (!nav || typeof nav.setTitle !== 'function') return
  try {
    const result = nav.setTitle(title)
    if (result && typeof result.catch === 'function') result.catch(() => {})
  } catch {
    /* 标题是装饰 */
  }
}

// MARK: - 宿主顶栏

/**
 * 宿主此刻画没画导航栏（标题 + 返回/关闭出口 + ⋯ 菜单）。**页面据此决定要不要自绘顶栏。**
 *
 * ⚠️ 别再拿 `toolbar.getState().rendered` 猜这件事 —— 那个字段问的是「**你声明的**顶栏按钮画了没」，
 * 没声明 `scene.toolbar` 就恒 false。本应用就是这么判的，于是真机上出现两条标题栏叠在一起、
 * 第二条还带一个孤零零的 `‹`（2026-08-04 反馈）。真值是 `navigation.getState().hostChrome`。
 *
 * 宿主太老（没有该字段）时回落 `transition === 'native'`：它只能答「子页栈归不归宿主」，
 * 对本应用（`subpages: true`）恰好同解，但它**不是**通用答案，别把这条回落当主路径。
 */
export function useHostChrome(): boolean {
  const [chrome, setChrome] = useState(false)

  useEffect(() => {
    const nav = hostNavigation()
    if (!nav || typeof nav.getState !== 'function') return undefined
    let cancelled = false
    const read = () => {
      nav
        .getState()
        .then((state) => {
          if (cancelled || !state) return
          setChrome(typeof state.hostChrome === 'boolean' ? state.hostChrome : state.transition === 'native')
        })
        .catch(() => undefined)
    }
    read()
    // 形态切换（sheet ↔ page ↔ fullscreen）会改变它，宿主在 `scene.changed` 上报形态时重读一次。
    const scene = bridge()?.scene
    let off: (() => void) | undefined
    if (scene && typeof scene.on === 'function') {
      try {
        off = scene.on('changed', read)
      } catch {
        /* 宿主未实现事件订阅 */
      }
    }
    return () => {
      cancelled = true
      try {
        off?.()
      } catch {
        /* 忽略 */
      }
    }
  }, [])

  return chrome
}

// MARK: - 系统 ⋯ 菜单（`aibox.menu`）

export interface MenuItemPatch {
  title?: string | null
  icon?: string | null
  enabled?: boolean | null
  hidden?: boolean | null
}

/**
 * 系统 ⋯ 菜单：manifest `scene.menu` 是静态声明门，页面只能改**展示态**（title / icon / enabled / hidden）。
 *
 * 没有 `actionID` 的菜单项点击后发 `menu.invoke` 事件回到这里 —— 于是「打开一个面板」这类
 * **纯 UI 动作**不必伪装成一条 headless Action（它也表达不了页面内渲染）。
 *
 * `declared === false`（宿主太老 / 没声明 menu）时业务**必须**保留自绘 action sheet 那条路径。
 */
export function useHostMenu(onInvoke: (id: string) => void): {
  declared: boolean
  update: (items: Record<string, MenuItemPatch>) => void
} {
  const [declared, setDeclared] = useState(false)
  const handler = useRef(onInvoke)
  handler.current = onInvoke

  useEffect(() => {
    const menu = bridge()?.menu
    if (!menu || typeof menu.getState !== 'function') return undefined
    let cancelled = false
    const offs: Array<() => void> = []

    menu
      .getState()
      .then((state) => {
        if (!cancelled) setDeclared(state.declared)
      })
      .catch(() => undefined)

    if (typeof menu.on === 'function') {
      try {
        offs.push(menu.on('invoke', (event) => handler.current(event.id)))
      } catch {
        /* 宿主未实现 menu.invoke —— declared 仍可能为 true，故业务侧的降级路径不能删 */
      }
    }

    return () => {
      cancelled = true
      offs.forEach((off) => {
        try {
          if (typeof off === 'function') off()
        } catch {
          /* 忽略 */
        }
      })
    }
  }, [])

  const update = useCallback((items: Record<string, MenuItemPatch>) => {
    const menu = bridge()?.menu
    if (!menu || typeof menu.update !== 'function') return
    try {
      const result = menu.update({ items })
      if (result && typeof result.catch === 'function') result.catch(() => {})
    } catch {
      /* 展示态更新失败不该影响业务 */
    }
  }, [])

  return { declared, update }
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

    overlay
      .getState()
      .then((state) => {
        if (!cancelled) setRendered(state.rendered)
      })
      .catch(() => undefined)

    if (typeof overlay.on === 'function') {
      try {
        offs.push(overlay.on('invoke', (event) => handler.current(event)))
      } catch {
        /* 宿主未实现事件订阅 */
      }
      try {
        // `rendered` 会**在挂载之后翻转**（形态切换、控制器重建都会重发 changed）。
        // 只判断启动那一刻，自绘控件就会永远缺席或永远多一份。
        offs.push(
          overlay.on('changed', (state) => {
            if (!cancelled) setRendered(state.rendered)
          }),
        )
      } catch {
        /* 同上 */
      }
    }

    return () => {
      cancelled = true
      offs.forEach((off) => {
        try {
          if (typeof off === 'function') off()
        } catch {
          /* 忽略 */
        }
      })
    }
  }, [])

  const update = useCallback((items: Record<string, OverlayItemPatch>) => {
    const api = bridge()
    const overlay = api && api.overlay
    if (!overlay || typeof overlay.update !== 'function') return
    try {
      const result = overlay.update({ items })
      if (result && typeof result.catch === 'function') result.catch(() => {})
    } catch {
      /* 展示态更新失败不该影响业务 */
    }
  }, [])

  return { rendered, update }
}
