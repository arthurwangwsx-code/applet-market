//
//  aibox-ui.d.ts
//  `aibox/ui`（宿主随运行时资产提供的框架级 UI 原语）的类型声明。
//
//  ## 为什么类型住在这里
//  `aibox/ui` 不是 npm 包 —— 它是 `applet://localhost/runtime/aibox-ui.mjs`，构建时 external、
//  运行时由 import map 解析（见 `lib/runtime-modules.mjs`）。于是 TS 工程 `import ... from 'aibox/ui'`
//  会撞上 TS7016「找不到声明文件」。
//
//  在这份声明存在之前，唯一的绕法是「把实现留在 .js 里 + 各写一份 .d.ts」——
//  语音备忘录的 `lib/gestures.d.ts` 就是这么来的。**那正是本轮要根治的复制病**：
//  框架资产没有类型 ⇒ 每个 TS 应用各写一份 ⇒ 第 N 个应用抄第 N 份。
//
//  `tsconfig.base.json` 用 `paths` 把 `'aibox/ui'` 指到本文件，所以任何继承预设的工程开箱可用，
//  **应用侧一个字节都不用写**。
//
//  ## 真值与漂移
//  实现的真值在主仓库 `WebAssets/applet-runtime/src/aibox-ui/`（`aibox-ui-bundle.js` 是导出面）。
//  本文件是它的**类型侧镜像**，手工维护：改了那边的导出面，这里要跟着改。
//  判断有没有漂：`grep -o "export{[^}]*}" Resources/Runtime/aibox-ui.mjs` 对一遍导出名即可。
//
//  对应资产版本：aibox-ui 1.2.0
//

declare module 'aibox/ui' {
  import type { CSSProperties, ReactNode, Ref } from 'react'

  // ──────────────────────────────────────────────────────────────────────────
  // 行手势（§3.1）
  // ──────────────────────────────────────────────────────────────────────────

  /** 上下文菜单项 / 滑动操作项。`id` 是身份，运行时覆盖只能改显示态、不能改身份。 */
  export interface RowAction {
    id: string
    title: string
    icon?: string
    role?: 'normal' | 'destructive'
    tint?: 'default' | 'accent' | 'danger'
  }

  /** 逐行的**展示态**覆盖（某行不能删除时把该项隐藏）。不能新增 id，不能改 role/tint。 */
  export interface RowActionOverride {
    title?: string | null
    icon?: string | null
    enabled?: boolean | null
    hidden?: boolean | null
  }

  export interface RowGestureEvent {
    regionId: string
    rowId: string
    actionId: string
    source: 'contextMenu' | 'swipe'
  }

  export interface RowGestureConfig {
    contextMenu?: RowAction[]
    leadingSwipe?: RowAction[]
    trailingSwipe?: RowAction[]
    rowOverrides?: (rowId: string) => Record<string, RowActionOverride> | null | undefined
    onAction?: (event: RowGestureEvent) => void
    enabled?: boolean
  }

  /** `rect` = `getBoundingClientRect()` 原样：CSS 点、视口坐标系，**不乘 dpr、不加 scrollTop**。 */
  export interface VisibleRow {
    id: string
    rect: [number, number, number, number]
  }

  /**
   * 原生行手势接线口 —— **虚拟列表**用。把 `onVisibleRowsChange` 原样交给 `<VirtualList />`。
   *
   * `rendered === false` ⇒ 业务**必须**保留自绘的长按/滑动（聊天内联卡等形态没有手势层）。
   */
  export function useListGestures(
    regionId: string,
    config?: RowGestureConfig,
  ): {
    rendered: boolean
    available: boolean
    onVisibleRowsChange: (rows: VisibleRow[]) => void
  }

  /**
   * 原生行手势接线口 —— **非虚拟列表**用（内部按 rAF + 心跳自扫 `[data-row-id]` 上报矩形）。
   *
   * 接法两步：`regionProps` 铺到滚动容器，`data-row-id` 铺到每一行。
   * `rendered === false` ⇒ 同上，必须保留自绘降级。
   */
  export function useRowGestures(
    regionId: string,
    config?: RowGestureConfig,
  ): {
    rendered: boolean
    available: boolean
    regionProps: { ref: Ref<HTMLDivElement>; 'data-region-id': string }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 系统页栈
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 路由栈 ↔ 宿主原生 `UINavigationController` 栈的镜像。
   *
   * 需要 manifest 声明 `presentation.subpages: true`。不接的后果不是「返回没动画」，
   * 而是最左缘左滑**直接退出整个小应用**（宿主看到的 `webDepth` 恒为 0）。
   *
   * `pathFor` / `titleFor` 都可省：省略时回落 `#/<route.name>` 与无标题。
   */
  export function useSubpageStack<Route = unknown>(options?: {
    pathFor?: (route: Route) => string
    titleFor?: (route: Route) => string | null | undefined
  }): {
    stack: Route[]
    route: Route | null
    push: (route: Route) => void
    back: () => void
    reset: () => void
  }

  /**
   * 宿主是否真的装了原生页栈。
   * `'native'` ⇒ 宿主已经在画顶栏，子页**不要自画**，否则真机上是两条栏两个标题。
   */
  export function subpageTransition(): Promise<'native' | 'web'>

  /** 宿主写在 `history.state.__aiboxDepth` 上的深度。null = 桥不在 ⇒ 回落纯内存栈。 */
  export function historyDepth(): number | null

  // ──────────────────────────────────────────────────────────────────────────
  // 键盘（§3.4）
  // ──────────────────────────────────────────────────────────────────────────

  /** 键盘遮挡高度（CSS 像素）+ 系统动画时长。直接拿 `height` 当 bottom inset 用。 */
  export function useKeyboardInset(): {
    height: number
    animationMs: number
    source: 'host' | 'viewport' | 'none'
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 图片（§3.3）
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * 把远端图片 URL 换成走宿主两级缓存的 `applet://` URL。纯字符串拼接，可在 render 里随便调。
   * `width` = **CSS 像素**的显示宽度，**不要自己乘 devicePixelRatio**（宿主侧施加屏幕倍率）。
   * 非 http(s) 输入原样返回，所以业务侧可以无脑全用它。
   */
  export function imageURL(url: string, options?: { width?: number }): string

  /** 命名空间别名：`ui.image.url(...)`。 */
  export const image: { url: typeof imageURL }

  // ──────────────────────────────────────────────────────────────────────────
  // SF Symbol（§3.5）
  // ──────────────────────────────────────────────────────────────────────────

  /** SF Symbol 字重档，与 `UIImage.SymbolWeight` 一一对应。 */
  export type SymbolWeight =
    | 'ultralight' | 'thin' | 'light' | 'regular' | 'medium'
    | 'semibold' | 'bold' | 'heavy' | 'black'

  export interface SymbolOptions {
    /** 字号（**CSS 点**，1…256），默认 17。**不要自己乘 devicePixelRatio**。 */
    size?: number
    weight?: SymbolWeight
    scale?: 'small' | 'medium' | 'large'
    /** 十六进制色（`#RGB` / `#RRGGBB` / `#AARRGGBB`，`#` 可省）。PNG 不会跟随深浅色，**必须显式给**。 */
    color?: string
  }

  /**
   * 把一个 SF Symbol 名换成宿主渲染的 PNG URL，可直接放进 `<img src>`。
   *
   * 这是页面画**真** SF Symbol 的唯一通道 —— WebView 里没有那套字体，各应用自抄的
   * emoji 近似表（`mic → 🎙`）与宿主外壳的单色符号是两套图标语言，观感对不上。
   * 名字非法时返回空串；符号在系统里不存在时宿主回 404（DevTools 可见），**不静默画占位块**。
   */
  export function symbolURL(name: string, options?: SymbolOptions): string

  /** 命名空间别名：`ui.symbol.url(...)`。 */
  export const symbol: { url: typeof symbolURL }

  // ──────────────────────────────────────────────────────────────────────────
  // 虚拟长列表（§3.2）
  // ──────────────────────────────────────────────────────────────────────────

  export interface VirtualListHandle {
    scrollToIndex(index: number, options?: { align?: 'start' | 'center' | 'end'; behavior?: ScrollBehavior }): void
    scrollToTop(options?: { behavior?: ScrollBehavior }): void
    scrollToOffset(top: number, options?: { behavior?: ScrollBehavior }): void
    getVisibleRange(): { start: number; end: number }
    getScrollElement(): HTMLElement | null
  }

  export interface VirtualListProps<Item = unknown> {
    items: Item[]
    renderRow: (item: Item, index: number) => ReactNode
    keyExtractor?: (item: Item, index: number) => string
    /** 首屏用的行高估计值（实测高度回填后自动收敛）。 */
    estimatedRowHeight?: number
    overscan?: number
    overscanPx?: number
    header?: ReactNode
    footer?: ReactNode
    empty?: ReactNode
    onEndReached?: () => void
    endReachedThreshold?: number
    /** 直接接 `useListGestures().onVisibleRowsChange`。 */
    onVisibleRowsChange?: (rows: VisibleRow[]) => void
    onScroll?: (event: Event) => void
    /** 给一个稳定 key 即可跨页面往返恢复滚动位置（sessionStorage）。 */
    restoreKey?: string
    /** 与 `useListGestures(regionId)` 对应，宿主据此把手势层叠到正确的区域上。 */
    regionId?: string
    className?: string
    style?: CSSProperties
    rowStyle?: CSSProperties
    ref?: Ref<VirtualListHandle>
  }

  export function VirtualList<Item = unknown>(props: VirtualListProps<Item>): JSX.Element

  /** 资产版本号，排障时确认页面拿到的是哪一版。 */
  export const version: string
}
