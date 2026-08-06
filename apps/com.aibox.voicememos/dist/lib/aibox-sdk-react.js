// 本文件由 @aibox/applet-tsbuild 从 packages/aibox-sdk 打出，**请勿手改**。
// 它是生成物，不是这个应用私有的桥胶水——单一真值在 SDK 包里，重新构建即可刷新。
// 重新生成： npm run build --prefix apps/<id>

// ../../packages/aibox-sdk/dist/react/index.js
import { useCallback as useCallback2, useEffect as useEffect2, useMemo as useMemo2, useRef as useRef2, useState as useState2 } from "react";

// ../../packages/aibox-sdk/dist/bridge.js
function bridge() {
  try {
    return typeof window !== "undefined" ? window.aibox : void 0;
  } catch {
    return void 0;
  }
}
function available(name, method) {
  const host = bridge();
  const ns = host?.[name];
  if (!ns || typeof ns !== "object")
    return false;
  if (!method)
    return true;
  return typeof ns[method] === "function";
}

// ../../packages/aibox-sdk/dist/react/gestures.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
function createDragGesture(options) {
  const lockMode = options.lock ?? "axis";
  const slop = options.lockSlop ?? 6;
  const preventWhenLocked = options.preventDefaultWhenLocked ?? true;
  const singleTouch = options.singleTouchOnly ?? true;
  let active = false;
  let locked = false;
  let resolved = false;
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let dy = 0;
  function reset() {
    active = false;
    locked = false;
    resolved = false;
    startX = 0;
    startY = 0;
    dx = 0;
    dy = 0;
  }
  function sample() {
    return { dx, dy, locked };
  }
  function onTouchStart(event) {
    if (singleTouch && event.touches.length !== 1)
      return;
    if (options.canStart && !options.canStart())
      return;
    const touch = event.touches[0];
    if (!touch)
      return;
    active = true;
    locked = lockMode === "none";
    resolved = lockMode === "none";
    startX = touch.clientX;
    startY = touch.clientY;
    dx = 0;
    dy = 0;
    options.onStart?.();
  }
  function onTouchMove(event) {
    if (!active)
      return;
    const touch = event.touches[0];
    if (!touch)
      return;
    dx = touch.clientX - startX;
    dy = touch.clientY - startY;
    if (!resolved) {
      if (Math.abs(dx) < slop && Math.abs(dy) < slop)
        return;
      resolved = true;
      locked = options.axis === "x" ? Math.abs(dx) > Math.abs(dy) : Math.abs(dy) > Math.abs(dx);
    }
    if (!locked)
      return;
    if (preventWhenLocked && event.cancelable)
      event.preventDefault?.();
    options.onDrag?.(sample());
  }
  function onTouchEnd() {
    if (!active)
      return;
    const finished = sample();
    const wasLocked = locked;
    reset();
    if (wasLocked)
      options.onEnd?.(finished);
  }
  function onTouchCancel() {
    if (!active)
      return;
    const aborted = sample();
    reset();
    options.onCancel?.(aborted);
  }
  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    isActive: () => active,
    isLocked: () => locked
  };
}
function createLongPress(options) {
  const delay = options.delayMs ?? 480;
  const slop = options.moveSlop ?? 8;
  const timers = options.timers ?? {
    set: (run, ms) => setTimeout(run, ms),
    clear: (handle2) => {
      clearTimeout(handle2);
    }
  };
  let handle = null;
  let active = false;
  let fired = false;
  let moved = false;
  let touched = false;
  let x = 0;
  let y = 0;
  function clearTimer() {
    if (handle !== null) {
      timers.clear(handle);
      handle = null;
    }
  }
  return {
    onTouchStart(event) {
      const touch = event.touches[0];
      if (!touch)
        return;
      x = touch.clientX;
      y = touch.clientY;
      active = true;
      fired = false;
      moved = false;
      touched = true;
      clearTimer();
      handle = timers.set(() => {
        handle = null;
        fired = true;
        options.onLongPress();
      }, delay);
    },
    onTouchMove(event) {
      if (!active)
        return;
      const touch = event.touches[0];
      if (!touch)
        return;
      if (Math.abs(touch.clientX - x) > slop || Math.abs(touch.clientY - y) > slop) {
        moved = true;
        clearTimer();
      }
    },
    onTouchEnd() {
      if (!active)
        return;
      active = false;
      clearTimer();
      if (!fired && !moved)
        options.onTap?.();
    },
    // 触摸被原生手势抢走：整串作废。**不能只清计时器**——那样虽然碰巧不会发 tap
    //（cancel 之后不会再来 touchend），但状态没复位，靠的是运气而不是契约。
    onTouchCancel() {
      active = false;
      fired = false;
      moved = false;
      clearTimer();
    },
    onContextMenu(event) {
      event.preventDefault?.();
    },
    onClick() {
      if (touched)
        return;
      options.onTap?.();
    },
    dispose: clearTimer
  };
}
function defaultSwipeThreshold(width) {
  return Math.max(48, width * 0.22);
}
function createSwipePager(options) {
  const rubber = options.rubberBand ?? 0.28;
  const duration = options.durationMs ?? 220;
  const schedule = options.schedule ?? ((run, ms) => {
    setTimeout(run, ms);
  });
  let offset = 0;
  let animating = false;
  let dragging = false;
  let pending = null;
  let gestureWidth = 1;
  function publish() {
    options.render({ offset, animating, dragging });
  }
  function thresholdFor(width) {
    const value = options.threshold ?? defaultSwipeThreshold;
    return typeof value === "function" ? value(width) : value;
  }
  function settle(next, direction) {
    if (next === options.index()) {
      animating = true;
      offset = 0;
      publish();
      schedule(() => {
        animating = false;
        publish();
      }, duration);
      return;
    }
    pending = next;
    animating = true;
    offset = -direction * (options.width() || 1);
    publish();
    schedule(() => {
      animating = false;
      offset = 0;
      const target = pending;
      pending = null;
      publish();
      if (target !== null)
        options.commit(target);
    }, duration);
  }
  const gesture = createDragGesture({
    axis: "x",
    lockSlop: options.lockSlop ?? 6,
    canStart: () => !animating,
    onStart: () => {
      gestureWidth = options.width() || 1;
    },
    onDrag: ({ dx }) => {
      const index = options.index();
      const count = options.count();
      const atStart = index === 0 && dx > 0;
      const atEnd = index === count - 1 && dx < 0;
      offset = atStart || atEnd ? dx * rubber : dx;
      dragging = true;
      publish();
    },
    onEnd: () => {
      const index = options.index();
      const count = options.count();
      const threshold = thresholdFor(gestureWidth);
      dragging = false;
      let next = index;
      if (offset <= -threshold && index < count - 1)
        next = index + 1;
      else if (offset >= threshold && index > 0)
        next = index - 1;
      settle(next, next > index ? 1 : next < index ? -1 : 0);
    },
    // 放弃：回弹到本页。`settle(当前页, 0)` 走的就是上面那条回弹分支——不 commit。
    onCancel: ({ locked }) => {
      dragging = false;
      if (locked)
        settle(options.index(), 0);
      else
        publish();
    }
  });
  return {
    onTouchStart: gesture.onTouchStart,
    onTouchMove: gesture.onTouchMove,
    onTouchEnd: gesture.onTouchEnd,
    onTouchCancel: gesture.onTouchCancel,
    slideTo(next) {
      const index = options.index();
      if (next === index || next < 0 || next >= options.count())
        return;
      settle(next, next > index ? 1 : -1);
    },
    view: () => ({ offset, animating, dragging }),
    isActive: () => gesture.isActive(),
    isAnimating: () => animating
  };
}
function useDragGesture(options) {
  const latest = useRef(options);
  latest.current = options;
  const [dragging, setDragging] = useState(false);
  const { axis, lock, lockSlop, preventDefaultWhenLocked, singleTouchOnly } = options;
  const core = useMemo(() => createDragGesture({
    axis,
    lock,
    lockSlop,
    preventDefaultWhenLocked,
    singleTouchOnly,
    canStart: () => latest.current.canStart?.() ?? true,
    onStart: () => latest.current.onStart?.(),
    onDrag: (s) => {
      setDragging(true);
      latest.current.onDrag?.(s);
    },
    onEnd: (s) => {
      setDragging(false);
      latest.current.onEnd?.(s);
    },
    onCancel: (s) => {
      setDragging(false);
      latest.current.onCancel?.(s);
    }
  }), [axis, lock, lockSlop, preventDefaultWhenLocked, singleTouchOnly]);
  const handlers = useMemo(() => ({
    onTouchStart: core.onTouchStart,
    onTouchMove: core.onTouchMove,
    onTouchEnd: core.onTouchEnd,
    onTouchCancel: core.onTouchCancel
  }), [core]);
  return { handlers, dragging };
}
function useLongPress(options) {
  const latest = useRef(options);
  latest.current = options;
  const { delayMs, moveSlop } = options;
  const core = useMemo(() => createLongPress({
    delayMs,
    moveSlop,
    onLongPress: () => latest.current.onLongPress(),
    onTap: () => latest.current.onTap?.()
  }), [delayMs, moveSlop]);
  useEffect(() => () => core.dispose(), [core]);
  return useMemo(() => ({
    onTouchStart: core.onTouchStart,
    onTouchMove: core.onTouchMove,
    onTouchEnd: core.onTouchEnd,
    onTouchCancel: core.onTouchCancel,
    onContextMenu: core.onContextMenu,
    onClick: core.onClick
  }), [core]);
}
function useSwipePager(options) {
  const controlled = options.index !== void 0;
  const [internalIndex, setInternalIndex] = useState(options.defaultIndex ?? 0);
  const index = controlled ? options.index : internalIndex;
  const [view, setView] = useState({ offset: 0, animating: false, dragging: false });
  const nodeRef = useRef(null);
  const latest = useRef({ ...options, controlled, index });
  latest.current = { ...options, controlled, index };
  const { rubberBand, durationMs, lockSlop } = options;
  const core = useMemo(() => createSwipePager({
    count: () => latest.current.count,
    index: () => latest.current.index,
    width: () => nodeRef.current?.clientWidth || 1,
    commit: (next) => {
      if (!latest.current.controlled)
        setInternalIndex(next);
      latest.current.onIndexChange?.(next);
    },
    render: setView,
    // 恒是函数，身份稳定：调用方传字面量还是内联箭头都不会让核心重建。
    threshold: (width) => {
      const value = latest.current.threshold ?? defaultSwipeThreshold;
      return typeof value === "function" ? value(width) : value;
    },
    rubberBand,
    durationMs,
    lockSlop
  }), [rubberBand, durationMs, lockSlop]);
  const ref = useCallback((node) => {
    nodeRef.current = node;
  }, []);
  const containerProps = useMemo(() => ({
    ref,
    onTouchStart: core.onTouchStart,
    onTouchMove: core.onTouchMove,
    onTouchEnd: core.onTouchEnd,
    onTouchCancel: core.onTouchCancel
  }), [core, ref]);
  const duration = durationMs ?? 220;
  const trackStyle = useMemo(() => ({
    transform: `translate3d(calc(-100% / 3 + ${view.offset}px), 0, 0)`,
    transition: view.animating ? `transform ${duration}ms cubic-bezier(0.42, 0, 0.58, 1)` : "none"
  }), [view.offset, view.animating, duration]);
  return {
    index,
    offset: view.offset,
    animating: view.animating,
    dragging: view.dragging,
    containerProps,
    trackStyle,
    slideTo: core.slideTo
  };
}

// ../../packages/aibox-sdk/dist/react/index.js
function useBridgeEvent(namespace, event, handler, enabled = true) {
  const latest = useRef2(handler);
  latest.current = handler;
  useEffect2(() => {
    if (!enabled)
      return void 0;
    const host = bridge();
    const ns = host?.[namespace];
    if (!ns || typeof ns.on !== "function")
      return void 0;
    let unsubscribe;
    try {
      unsubscribe = ns.on(event, (payload) => latest.current(payload));
    } catch {
      return void 0;
    }
    return () => {
      if (typeof unsubscribe === "function") {
        try {
          unsubscribe();
        } catch {
        }
      }
    };
  }, [namespace, event, enabled]);
}
function useTabs() {
  const [state, setState] = useState2(null);
  useEffect2(() => {
    let cancelled = false;
    const host = bridge();
    if (!host?.tabs)
      return void 0;
    host.tabs.getState().then((next) => {
      if (!cancelled)
        setState(next);
    }).catch(() => void 0);
    return () => {
      cancelled = true;
    };
  }, []);
  useBridgeEvent("tabs", "changed", (payload) => setState(payload));
  const select = useCallback2((id) => {
    const host = bridge();
    if (!host?.tabs)
      return;
    host.tabs.select(id).then(setState).catch(() => void 0);
  }, []);
  const setBadge = useCallback2((id, badge) => {
    const host = bridge();
    if (!host?.tabs)
      return;
    host.tabs.update({ items: { [id]: { badge } } }).then(setState).catch(() => void 0);
  }, []);
  return {
    state,
    selected: state?.selected ?? null,
    rendered: Boolean(state?.declared && state?.rendered),
    select,
    setBadge
  };
}
function useToolbarSearch() {
  const [search, setSearch] = useState2(null);
  const [event, setEvent] = useState2({ query: "", scope: "", submitted: false });
  useEffect2(() => {
    let cancelled = false;
    const host = bridge();
    if (!host?.toolbar)
      return void 0;
    host.toolbar.getState().then((next) => {
      if (cancelled)
        return;
      setSearch(next.search ?? null);
      setEvent({ query: next.search?.query ?? "", scope: next.search?.scope ?? "", submitted: false });
    }).catch(() => void 0);
    return () => {
      cancelled = true;
    };
  }, []);
  useBridgeEvent("toolbar", "searchChanged", (payload) => {
    const next = payload ?? {};
    setEvent({ query: next.query ?? "", scope: next.scope ?? "", submitted: Boolean(next.submitted) });
  });
  const setQuery = useCallback2((query) => {
    setEvent((previous) => ({ ...previous, query }));
    const host = bridge();
    if (!host?.toolbar)
      return;
    host.toolbar.setSearch({ query }).then(setSearch).catch(() => void 0);
  }, []);
  return {
    query: event.query,
    scope: event.scope,
    submitted: event.submitted,
    rendered: Boolean(search?.declared && search?.rendered),
    search,
    setQuery
  };
}
function useKeyboardInset() {
  const measure = () => {
    if (typeof window === "undefined")
      return 0;
    const viewport = window.visualViewport;
    if (!viewport)
      return 0;
    const covered = (window.innerHeight || 0) - (viewport.height + viewport.offsetTop);
    return covered > 1 ? Math.round(covered) : 0;
  };
  const [inset, setInset] = useState2(() => ({ height: measure(), animationMs: 250, source: "viewport" }));
  useBridgeEvent("events", "keyboardChanged", (payload) => {
    const next = payload ?? {};
    setInset({
      height: Math.max(0, Math.round(Number(next.height) || 0)),
      animationMs: Math.max(0, Math.round(Number(next.animationMs) || 250)),
      source: "host"
    });
  });
  useEffect2(() => {
    if (typeof window === "undefined")
      return void 0;
    const viewport = window.visualViewport;
    if (!viewport)
      return void 0;
    const update = () => setInset((previous) => {
      if (previous.source === "host")
        return previous;
      const height = measure();
      return previous.height === height ? previous : { height, animationMs: previous.animationMs, source: "viewport" };
    });
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    update();
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}
function useLocale() {
  const initial = useMemo2(() => {
    if (typeof window === "undefined")
      return { locale: "en", language: "en" };
    const injected = window.__aiboxEnvironment;
    if (injected?.locale)
      return { locale: injected.locale, language: injected.language || injected.locale };
    const navigatorLanguage = typeof navigator !== "undefined" ? navigator.language : "en";
    return { locale: navigatorLanguage, language: navigatorLanguage };
  }, []);
  const [value, setValue] = useState2(initial);
  useBridgeEvent("events", "localeChanged", (payload) => {
    const next = payload ?? {};
    if (!next.locale)
      return;
    setValue({ locale: next.locale, language: next.language || next.locale });
  });
  return value;
}
function useScene() {
  const [state, setState] = useState2(null);
  useEffect2(() => {
    let cancelled = false;
    const host = bridge();
    if (!host?.scene)
      return void 0;
    host.scene.getState().then((next) => {
      if (!cancelled)
        setState(next);
    }).catch(() => void 0);
    return () => {
      cancelled = true;
    };
  }, []);
  useBridgeEvent("scene", "changed", (payload) => setState(payload));
  return state;
}
function useCapability(namespace, method) {
  return useMemo2(() => available(namespace, method), [namespace, method]);
}
export {
  createDragGesture,
  createLongPress,
  createSwipePager,
  defaultSwipeThreshold,
  useCapability,
  useDragGesture,
  useKeyboardInset,
  useLocale,
  useLongPress,
  useScene,
  useSwipePager,
  useTabs,
  useToolbarSearch
};
