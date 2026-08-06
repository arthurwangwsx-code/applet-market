import type { SceneState, TabsState, ToolbarSearchState } from '../shell';
/**
 * React hooks。
 *
 * 每个 hook 都遵守同一条纪律：**宿主没有这条能力时返回一个诚实的「不可用」状态，而不是抛**。
 * 组件据此决定「渲染原生入口」还是「渲染页内替代」，这正是 `rendered` 字段存在的意义。
 *
 * 所有 hook 都在 unmount 时退订（桥的 `on()` 返回 unsubscribe 函数），避免 applet 在
 * sheet/drawer 里反复开合时越积越多的订阅。
 *
 * 触摸手势原语（`useSwipePager` / `useDragGesture`）在 `./gestures`，从这里一并导出。
 */
export { createDragGesture, createLongPress, createSwipePager, defaultSwipeThreshold, useDragGesture, useLongPress, useSwipePager, } from './gestures';
export type { DragAxis, DragGestureCore, DragGestureHandlers, DragGestureOptions, DragLockMode, DragSample, LongPressCore, LongPressHandlers, LongPressOptions, SwipePagerBinding, SwipePagerCore, SwipePagerCoreOptions, SwipePagerView, SwipeThreshold, TouchEventLike, TouchPointLike, UseDragGestureResult, UseSwipePagerOptions, } from './gestures';
/** 原生 TabBar 的状态。`rendered === false` 时**必须**自己画页内切换器。 */
export declare function useTabs(): {
    state: TabsState | null;
    /** 当前选中 tab id（宿主没画出来时也有意义：它仍是权威的选中态）。 */
    selected: string | null;
    /** 原生 TabBar 是否真的画出来了。 */
    rendered: boolean;
    select: (id: string) => void;
    setBadge: (id: string, badge: string | null) => void;
};
/** 导航栏搜索。`rendered === false`（如 fullscreen 面）时自己画输入框。 */
export declare function useToolbarSearch(): {
    query: string;
    scope: string;
    /** 用户是否按了「搜索」（submitted）而不只是在输入。 */
    submitted: boolean;
    rendered: boolean;
    search: ToolbarSearchState | null;
    /** 程序化改查询串（例如从别处点进来带一个关键词）。 */
    setQuery: (query: string) => void;
};
/**
 * 软键盘遮挡高度（CSS px）。
 *
 * 优先用宿主 `keyboardChanged` 事件（准，含动画时长），没有就退回 `visualViewport` 推算。
 * 用法：给底部输入条加 `paddingBottom: inset.height`，别用固定值。
 */
export declare function useKeyboardInset(): {
    height: number;
    animationMs: number;
    source: 'host' | 'viewport';
};
/**
 * 宿主生效语言。**首帧就有值**（`window.__aiboxEnvironment` 由宿主在 documentStart 注入），
 * 所以不会出现「先渲染成英文再闪成中文」。用户在 App 内改语言会经 `localeChanged` 推下来。
 */
export declare function useLocale(): {
    locale: string;
    language: string;
};
/** 呈现面状态（surface / safeArea / 明暗）。布局别写死高度，读这里。 */
export declare function useScene(): SceneState | null;
/**
 * 某条能力是否可用。**同步判据**（命名空间注册与否），可以直接写进 render：
 * `const hasMusic = useCapability('music'); if (!hasMusic) return null`
 */
export declare function useCapability(namespace: string, method?: string): boolean;
//# sourceMappingURL=index.d.ts.map