import { bridge, available } from './bridge'
import { normalizeError } from './errors'

/**
 * 应用级外壳（tabs / toolbar / navigation / scene）。
 *
 * 这几条能力有一个**共同陷阱**：命名空间恒在（容器内建），但当前呈现面可能根本画不出来——
 * card / sheet / drawer 上没有原生 TabBar，fullscreen 上没有导航栏搜索框。宿主用
 * `state.rendered` 如实上报，但裸 API 不会拦着你「以为它画出来了」，于是应用就少了一整块入口。
 *
 * SDK 把它收成 `isRendered()`：**false 就自己画一个页内 segmented / 搜索框**。
 */

export type TabsState = Awaited<ReturnType<typeof aibox.tabs.getState>>
export type ToolbarState = Awaited<ReturnType<typeof aibox.toolbar.getState>>
export type ToolbarSearchState = ToolbarState['search']
export type SceneState = Awaited<ReturnType<typeof aibox.scene.getState>>
export type NavigationState = Awaited<ReturnType<typeof aibox.navigation.getState>>

/** 原生 TabBar 当前是否真的画出来了。false = 自己画页内切换器。 */
export async function tabsAreRendered(): Promise<boolean> {
  const host = bridge()
  if (!host?.tabs) return false
  try {
    const state = await host.tabs.getState()
    return Boolean(state.declared && state.rendered)
  } catch {
    return false
  }
}

/** 导航栏搜索框当前是否真的画出来了。false = 自己画输入框。 */
export async function searchIsRendered(): Promise<boolean> {
  const host = bridge()
  if (!host?.toolbar) return false
  try {
    const state = await host.toolbar.getState()
    return Boolean(state.search?.declared && state.search?.rendered)
  } catch {
    return false
  }
}

/** 读 tabs 状态（不可用返回 null）。 */
export async function tabsState(): Promise<TabsState | null> {
  const host = bridge()
  if (!host?.tabs) return null
  try {
    return await host.tabs.getState()
  } catch {
    return null
  }
}

/** 选中一个 tab（等价用户点击，会触发 changed 事件）。 */
export async function selectTab(id: string): Promise<TabsState | null> {
  const host = bridge()
  if (!host?.tabs) return null
  try {
    return await host.tabs.select(id)
  } catch (error) {
    throw normalizeError(error)
  }
}

/** 给某个 tab 打角标。`null` 清掉。 */
export async function setTabBadge(id: string, badge: string | null): Promise<void> {
  const host = bridge()
  if (!host?.tabs) return
  try {
    await host.tabs.update({ items: { [id]: { badge } } })
  } catch {
    /* 角标是装饰，失败不该影响主流程 */
  }
}

/** 读 scene 状态（呈现面、安全区、外观）。 */
export async function sceneState(): Promise<SceneState | null> {
  const host = bridge()
  if (!host?.scene) return null
  try {
    return await host.scene.getState()
  } catch {
    return null
  }
}

/** 设置导航栏标题。 */
export async function setTitle(title: string): Promise<void> {
  const host = bridge()
  if (!host?.navigation) return
  try {
    await host.navigation.setTitle(title)
  } catch {
    /* 标题是装饰 */
  }
}

/**
 * 关闭确认。有未保存改动时开、保存后关——**别永久开着**，那会让用户每次退出都被拦一下。
 */
export async function setCloseConfirmation(
  enabled: boolean,
  options?: { title?: string; message?: string },
): Promise<void> {
  const host = bridge()
  if (!host?.navigation) return
  try {
    await host.navigation.setCloseConfirmation(enabled ? { enabled: true, ...options } : { enabled: false })
  } catch {
    /* 确认框是增强 */
  }
}

/** 触觉反馈。宿主没有 haptics 时静默忽略（这是纯增强，绝不该因为它抛）。 */
export async function haptic(
  kind: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light',
): Promise<void> {
  if (!available('haptics')) return
  const host = bridge() as unknown as { haptics?: Record<string, (input: unknown) => Promise<unknown>> }
  const ns = host?.haptics
  if (!ns) return
  try {
    if (typeof ns.impact === 'function' && (kind === 'light' || kind === 'medium' || kind === 'heavy')) {
      await ns.impact({ style: kind })
    } else if (typeof ns.notification === 'function') {
      await ns.notification({ type: kind })
    }
  } catch {
    /* 增强路径 */
  }
}
