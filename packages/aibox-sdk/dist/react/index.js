import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bridge, available } from '../bridge';
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
// --- 触摸手势原语 -----------------------------------------------------------
// **做横扫分页 / 左滑露操作 / 下拉刷新一律用这些，不要自己接 `onTouch*`。**
// 理由不是风格：`touchcancel` 只有原生手势抢走触摸时才发，纯 Web 环境测不出来，
// 手搓必漏（2026-08-06 实测两个应用两种错法）。详见 `./gestures` 文件头。
export { createDragGesture, createLongPress, createSwipePager, defaultSwipeThreshold, useDragGesture, useLongPress, useSwipePager, } from './gestures';
/** 订阅一个 `aibox.<ns>.on(event, …)`，组件卸载自动退订。 */
function useBridgeEvent(namespace, event, handler, enabled = true) {
    const latest = useRef(handler);
    latest.current = handler;
    useEffect(() => {
        if (!enabled)
            return undefined;
        const host = bridge();
        const ns = host?.[namespace];
        if (!ns || typeof ns.on !== 'function')
            return undefined;
        let unsubscribe;
        try {
            unsubscribe = ns.on(event, (payload) => latest.current(payload));
        }
        catch {
            return undefined;
        }
        return () => {
            if (typeof unsubscribe === 'function') {
                try {
                    unsubscribe();
                }
                catch { /* 退订失败不该影响卸载 */ }
            }
        };
    }, [namespace, event, enabled]);
}
/** 原生 TabBar 的状态。`rendered === false` 时**必须**自己画页内切换器。 */
export function useTabs() {
    const [state, setState] = useState(null);
    useEffect(() => {
        let cancelled = false;
        const host = bridge();
        if (!host?.tabs)
            return undefined;
        host.tabs.getState().then((next) => { if (!cancelled)
            setState(next); }).catch(() => undefined);
        return () => { cancelled = true; };
    }, []);
    useBridgeEvent('tabs', 'changed', (payload) => setState(payload));
    const select = useCallback((id) => {
        const host = bridge();
        if (!host?.tabs)
            return;
        host.tabs.select(id).then(setState).catch(() => undefined);
    }, []);
    const setBadge = useCallback((id, badge) => {
        const host = bridge();
        if (!host?.tabs)
            return;
        host.tabs.update({ items: { [id]: { badge } } }).then(setState).catch(() => undefined);
    }, []);
    return {
        state,
        selected: state?.selected ?? null,
        rendered: Boolean(state?.declared && state?.rendered),
        select,
        setBadge,
    };
}
/** 导航栏搜索。`rendered === false`（如 fullscreen 面）时自己画输入框。 */
export function useToolbarSearch() {
    const [search, setSearch] = useState(null);
    const [event, setEvent] = useState({ query: '', scope: '', submitted: false });
    useEffect(() => {
        let cancelled = false;
        const host = bridge();
        if (!host?.toolbar)
            return undefined;
        host.toolbar.getState()
            .then((next) => {
            if (cancelled)
                return;
            setSearch(next.search ?? null);
            setEvent({ query: next.search?.query ?? '', scope: next.search?.scope ?? '', submitted: false });
        })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, []);
    useBridgeEvent('toolbar', 'searchChanged', (payload) => {
        const next = (payload ?? {});
        setEvent({ query: next.query ?? '', scope: next.scope ?? '', submitted: Boolean(next.submitted) });
    });
    const setQuery = useCallback((query) => {
        setEvent((previous) => ({ ...previous, query }));
        const host = bridge();
        if (!host?.toolbar)
            return;
        host.toolbar.setSearch({ query }).then(setSearch).catch(() => undefined);
    }, []);
    return {
        query: event.query,
        scope: event.scope,
        submitted: event.submitted,
        rendered: Boolean(search?.declared && search?.rendered),
        search,
        setQuery,
    };
}
/**
 * 软键盘遮挡高度（CSS px）。
 *
 * 优先用宿主 `keyboardChanged` 事件（准，含动画时长），没有就退回 `visualViewport` 推算。
 * 用法：给底部输入条加 `paddingBottom: inset.height`，别用固定值。
 */
export function useKeyboardInset() {
    const measure = () => {
        if (typeof window === 'undefined')
            return 0;
        const viewport = window.visualViewport;
        if (!viewport)
            return 0;
        const covered = (window.innerHeight || 0) - (viewport.height + viewport.offsetTop);
        return covered > 1 ? Math.round(covered) : 0;
    };
    const [inset, setInset] = useState(() => ({ height: measure(), animationMs: 250, source: 'viewport' }));
    useBridgeEvent('events', 'keyboardChanged', (payload) => {
        const next = (payload ?? {});
        setInset({
            height: Math.max(0, Math.round(Number(next.height) || 0)),
            animationMs: Math.max(0, Math.round(Number(next.animationMs) || 250)),
            source: 'host',
        });
    });
    useEffect(() => {
        if (typeof window === 'undefined')
            return undefined;
        const viewport = window.visualViewport;
        if (!viewport)
            return undefined;
        const update = () => setInset((previous) => {
            if (previous.source === 'host')
                return previous;
            const height = measure();
            return previous.height === height ? previous : { height, animationMs: previous.animationMs, source: 'viewport' };
        });
        viewport.addEventListener('resize', update);
        viewport.addEventListener('scroll', update);
        update();
        return () => {
            viewport.removeEventListener('resize', update);
            viewport.removeEventListener('scroll', update);
        };
    }, []);
    return inset;
}
/**
 * 宿主生效语言。**首帧就有值**（`window.__aiboxEnvironment` 由宿主在 documentStart 注入），
 * 所以不会出现「先渲染成英文再闪成中文」。用户在 App 内改语言会经 `localeChanged` 推下来。
 */
export function useLocale() {
    const initial = useMemo(() => {
        if (typeof window === 'undefined')
            return { locale: 'en', language: 'en' };
        const injected = window.__aiboxEnvironment;
        if (injected?.locale)
            return { locale: injected.locale, language: injected.language || injected.locale };
        const navigatorLanguage = typeof navigator !== 'undefined' ? navigator.language : 'en';
        return { locale: navigatorLanguage, language: navigatorLanguage };
    }, []);
    const [value, setValue] = useState(initial);
    useBridgeEvent('events', 'localeChanged', (payload) => {
        const next = (payload ?? {});
        if (!next.locale)
            return;
        setValue({ locale: next.locale, language: next.language || next.locale });
    });
    return value;
}
/** 呈现面状态（surface / safeArea / 明暗）。布局别写死高度，读这里。 */
export function useScene() {
    const [state, setState] = useState(null);
    useEffect(() => {
        let cancelled = false;
        const host = bridge();
        if (!host?.scene)
            return undefined;
        host.scene.getState().then((next) => { if (!cancelled)
            setState(next); }).catch(() => undefined);
        return () => { cancelled = true; };
    }, []);
    useBridgeEvent('scene', 'changed', (payload) => setState(payload));
    return state;
}
/**
 * 某条能力是否可用。**同步判据**（命名空间注册与否），可以直接写进 render：
 * `const hasMusic = useCapability('music'); if (!hasMusic) return null`
 */
export function useCapability(namespace, method) {
    return useMemo(() => available(namespace, method), [namespace, method]);
}
