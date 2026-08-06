/**
 * 触摸手势原语：横扫分页（`useSwipePager`）与轴锁拖拽（`useDragGesture`）。
 *
 * ## 这个文件为什么存在
 *
 * 2026-08-06 实测：市场里两个应用各自手搓了横扫/滑动手势，**两个都把 `touchcancel` 处理错了，
 * 而且错法相反**——
 *
 *  · 资讯 `Pager.jsx`：`onTouchCancel={onTouchEnd}`，于是 cancel 走完阈值判定并 settle，
 *    **提交了一次用户没打算做的翻页**；
 *  · 理财 `primitives.jsx` 的 `SwipeRow` / `PullRefresh`：**根本没接 cancel**，
 *    `active` 永不复位、`startX` 停在旧值，行卡在半开位，下一次无关触摸接着上一次的基准继续拖。
 *
 * 根因不是粗心，是**缺少可供性**：SDK 没有任何分页 / 拖拽原语，想做只能手搓；而 `touchcancel`
 * 在纯 Web 环境几乎不会触发（只有原生识别器抢走触摸时才发），**在浏览器里写、在浏览器里测，
 * 永远测不出来**。谁写都会漏。
 *
 * 所以本文件的唯一职责，是把下面这条契约写死在一个地方：
 *
 *   **`touchcancel` = 放弃（abort）：复位状态、回弹、绝不提交，且永远不与 `touchend` 共用处理器。**
 *
 * ## 为什么核心是「无 React」的工厂函数
 *
 * `createDragGesture` / `createSwipePager` 不 import react，返回的就是四个普通函数。
 * 这不是洁癖，是**让上面那条契约可被证明**：Node 里没有 DOM 也没有渲染器，但可以把这四个函数
 * 挂到真的 `EventTarget` 上、`dispatchEvent` 一个真的合成 `touchcancel` 进去，断言「abort 分支
 * 跑到了且没有翻页」。React 那层只是把同一批函数摊成 JSX 属性——测的和用的是同一份代码。
 * 证据见 `packages/aibox-sdk/tests/gestures.test.mjs`。
 */
/** 一根手指。只用得到坐标。 */
export interface TouchPointLike {
    readonly clientX: number;
    readonly clientY: number;
}
/** 触摸事件。`touches` 是「当前还在屏幕上的手指」，`touchend`/`touchcancel` 时可能为空。 */
export interface TouchEventLike {
    readonly touches: ArrayLike<TouchPointLike>;
    readonly cancelable?: boolean;
    preventDefault?(): void;
}
/** 一次拖拽的采样。`dx`/`dy` 是相对**手势起点**的位移，不是相对上一帧。 */
export interface DragSample {
    readonly dx: number;
    readonly dy: number;
    /** 方向锁是否已经落在主轴上。`onDrag` / `onEnd` 里恒为 true。 */
    readonly locked: boolean;
}
/** 挂到元素上的四个处理器。**`onTouchCancel` 永远是独立的一个函数**，见文件头契约。 */
export interface DragGestureHandlers {
    onTouchStart(event: TouchEventLike): void;
    onTouchMove(event: TouchEventLike): void;
    onTouchEnd(event?: TouchEventLike): void;
    onTouchCancel(event?: TouchEventLike): void;
}
export type DragAxis = 'x' | 'y';
/**
 * 方向锁模式。
 *
 * · `'axis'`（默认）：位移达到 `lockSlop` 后按 `|dx|` vs `|dy|` 判主轴，判成副轴则**整串放弃**
 *   （不再回调、`touchend` 也不提交）。**锁定前绝不 `preventDefault`**，否则页面滚不动。
 * · `'none'`：不判方向，`touchstart` 即视为锁定。给「只看主轴、不与横向竞争」的场景用
 *   （下拉刷新就是：它本来就只读 `dy`，加方向锁会改变既有观感）。
 */
export type DragLockMode = 'axis' | 'none';
export interface DragGestureOptions {
    /** 主轴。 */
    axis: DragAxis;
    /** 方向锁模式，默认 `'axis'`。 */
    lock?: DragLockMode;
    /** 方向锁阈值（px），默认 6。`lock: 'none'` 时无意义。 */
    lockSlop?: number;
    /** 锁定成功后是否 `preventDefault`，默认 true。 */
    preventDefaultWhenLocked?: boolean;
    /**
     * 只认单指，默认 true。
     *
     * 不加这条时，第二根手指落下会再发一次 `touchstart`，把手势的起点**重置成新坐标**，
     * 于是内容瞬移一段。资讯的分页器本来就有这条守卫，这里把它升成所有手势的默认。
     */
    singleTouchOnly?: boolean;
    /** 手势能否开始（例：下拉刷新要求 `scrollTop === 0`；分页器要求不在切页动画中）。 */
    canStart?(): boolean;
    /** 手势开始（尚未判方向）。用来抓基准值，例如「当前偏移量」。 */
    onStart?(): void;
    /** 锁定成功后每次移动。 */
    onDrag?(sample: DragSample): void;
    /** 手指正常抬起。**这是唯一允许提交的回调。** 方向锁落在副轴时不会触发。 */
    onEnd?(sample: DragSample): void;
    /**
     * 触摸被抢走（`touchcancel`）：原生手势接管了这串触摸。
     *
     * 语义是**放弃**——回到手势开始前的样子。这里不该做任何「提交」：用户的意图是那个
     * 原生手势，不是你这个手势。
     */
    onCancel?(sample: DragSample): void;
}
/** 手势核心：四个处理器 + 两个只读探针。 */
export interface DragGestureCore extends DragGestureHandlers {
    /** 手势是否正在进行。 */
    isActive(): boolean;
    /** 方向锁是否已落在主轴上。 */
    isLocked(): boolean;
}
/**
 * 造一个轴锁拖拽手势。返回的四个处理器可以直接摊进 JSX，也可以 `addEventListener` 挂到真元素上。
 */
export declare function createDragGesture(options: DragGestureOptions): DragGestureCore;
export interface LongPressOptions {
    onLongPress(): void;
    /** 轻点。触摸设备走 `touchend`，鼠标 / 辅助技术走 `click`。 */
    onTap?(): void;
    /** 长按判定时长 ms，默认 480。 */
    delayMs?: number;
    /** 手指走过多少 px 就不再算点击，默认 8。 */
    moveSlop?: number;
    /** 定时器。测试可注入手动时钟。 */
    timers?: {
        set(run: () => void, ms: number): unknown;
        clear(handle: unknown): void;
    };
}
export interface LongPressHandlers {
    onTouchStart(event: TouchEventLike): void;
    onTouchMove(event: TouchEventLike): void;
    onTouchEnd(event?: TouchEventLike): void;
    onTouchCancel(event?: TouchEventLike): void;
    onContextMenu(event: {
        preventDefault?(): void;
    }): void;
    onClick(event?: unknown): void;
}
export interface LongPressCore extends LongPressHandlers {
    /** 卸载时调用：把还没触发的长按计时器掐掉。 */
    dispose(): void;
}
/** 造一个长按 / 点击手势。 */
export declare function createLongPress(options: LongPressOptions): LongPressCore;
/** 分页器对外可见的视觉状态。 */
export interface SwipePagerView {
    /** 当前位移（px）。手指拖动中是实时位移，切页动画中是目标位移，静止时为 0。 */
    offset: number;
    /** 是否在切页 / 回弹动画中。 */
    animating: boolean;
    /** 是否有手指正在横向拖动。 */
    dragging: boolean;
}
export type SwipeThreshold = number | ((width: number) => number);
/** 默认翻页阈值：`max(48, 容器宽 × 0.22)`。与迁移前两个应用手搓的那份逐字一致。 */
export declare function defaultSwipeThreshold(width: number): number;
export interface SwipePagerCoreOptions {
    /** 总页数（读取式：受控方随时可能改）。 */
    count(): number;
    /** 当前页码。 */
    index(): number;
    /** 容器宽度（px）。阈值与切页位移都按它算。 */
    width(): number;
    /** 真正翻页。**只有正常抬手过阈值、或 `slideTo` 才会走到这里。** */
    commit(next: number): void;
    /** 视觉状态变了。 */
    render(view: SwipePagerView): void;
    /** 翻页阈值，默认 `defaultSwipeThreshold`。 */
    threshold?: SwipeThreshold;
    /** 首 / 末页橡皮筋阻尼系数，默认 0.28（滑出去只走 28%，不会露出空白屏）。 */
    rubberBand?: number;
    /** 切页动画时长 ms，默认 220。 */
    durationMs?: number;
    /** 方向锁阈值 px，默认 6。 */
    lockSlop?: number;
    /** 定时器。测试注入手动时钟，生产走 `setTimeout`。 */
    schedule?(run: () => void, ms: number): void;
}
export interface SwipePagerCore extends DragGestureHandlers {
    /** 程序化切页（chip / 分段控件点一下）。越界与「切到当前页」都是空操作。 */
    slideTo(next: number): void;
    view(): SwipePagerView;
    isActive(): boolean;
    isAnimating(): boolean;
}
/**
 * 造一个横扫分页器。
 *
 * 只负责**手势 → 页码**这段状态机；三屏轨道怎么画、CSS 类名叫什么由调用方决定
 * （`useSwipePager` 会给出配套的 `trackStyle`）。
 */
export declare function createSwipePager(options: SwipePagerCoreOptions): SwipePagerCore;
export interface UseDragGestureResult {
    /** 摊进 JSX：`<div {...handlers} />`。 */
    handlers: DragGestureHandlers;
    /** 是否有手指正在拖（已锁定到主轴）。用来在拖动中关掉 CSS transition。 */
    dragging: boolean;
}
/**
 * 轴锁拖拽的 React 绑定。左滑露出操作、下拉刷新这类「拖到哪儿松手看结果」的手势用它。
 *
 * 回调走 ref 转发，所以 `handlers` 身份稳定、不会因为父组件重渲染而重建手势。
 * 只有 `axis` / `lock` / `lockSlop` / `preventDefaultWhenLocked` / `singleTouchOnly`
 * 这几个**结构性**选项变化时才重建（它们在实践中都是字面量）。
 */
export declare function useDragGesture(options: DragGestureOptions): UseDragGestureResult;
/**
 * 长按 + 轻点。摊进 JSX：`<div {...press} />`。
 *
 * ```jsx
 * const press = useLongPress({ onLongPress: () => setMenu(true), onTap: () => open(item) })
 * ```
 *
 * 比手搓多的两条：`touchcancel` 是显式作废（不是「碰巧不会发 tap」），
 * 以及卸载时掐掉还没触发的计时器（否则长按会在组件没了之后才回调）。
 */
export declare function useLongPress(options: LongPressOptions): LongPressHandlers;
export interface UseSwipePagerOptions {
    /** 总页数。 */
    count: number;
    /** **受控**：外部持有页码。给了这个就应当同时给 `onIndexChange`。 */
    index?: number;
    /** **非受控**：初始页码，默认 0。 */
    defaultIndex?: number;
    /** 翻页落地时回调。受控用法里由它写回外部 state。 */
    onIndexChange?(index: number): void;
    /** 翻页阈值，默认 `max(48, 容器宽 × 0.22)`。 */
    threshold?: SwipeThreshold;
    /** 首 / 末页橡皮筋阻尼，默认 0.28。 */
    rubberBand?: number;
    /** 切页动画时长 ms，默认 220。 */
    durationMs?: number;
    /** 方向锁阈值 px，默认 6。 */
    lockSlop?: number;
}
export interface SwipePagerBinding {
    /** 当前页码（受控时等于传进来的 `index`）。 */
    index: number;
    offset: number;
    animating: boolean;
    dragging: boolean;
    /** 摊到滚动容器上：`<div {...pager.containerProps} />`。含量宽用的 `ref`。 */
    containerProps: DragGestureHandlers & {
        ref(node: HTMLElement | null): void;
    };
    /**
     * 三屏轨道的行内样式（轨道宽 300%、每屏 `calc(100% / 3)`）。
     * 布局用**自身百分比**而不是写死 33.3333%：后者每屏差出的亚像素会随页码累积成可见错位。
     */
    trackStyle: {
        transform: string;
        transition: string;
    };
    /** 程序化切页。chip / 分段控件点击走它，才能和横扫共用同一条动画。 */
    slideTo(next: number): void;
}
/**
 * 横扫分页（对应原生 `TabView(.page)`）。
 *
 * 受控：
 * ```jsx
 * const pager = useSwipePager({ count: 3, index, onIndexChange: setIndex })
 * ```
 * 非受控：
 * ```jsx
 * const pager = useSwipePager({ count: 3, defaultIndex: 0 })
 * ```
 * 两种用法下 `pager.index` 都是权威页码，照着它渲染 `index - 1 / index / index + 1` 三屏即可。
 *
 * **不要再自己接 `onTouchStart` / `onTouchCancel`**——`containerProps` 里那四个处理器已经把
 * 方向锁与「cancel = 放弃」定死了，再挂一层就又是两份实现。
 */
export declare function useSwipePager(options: UseSwipePagerOptions): SwipePagerBinding;
//# sourceMappingURL=gestures.d.ts.map