// 本文件由 @aibox/applet-tsbuild 从 packages/aibox-sdk 打出，**请勿手改**。
// 它是生成物，不是这个应用私有的桥胶水——单一真值在 SDK 包里，重新构建即可刷新。
// 重新生成： npm run build --prefix apps/<id>

// ../../packages/aibox-sdk/dist/react/index.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

// ../../packages/aibox-sdk/dist/react/index.js
function useBridgeEvent(namespace, event, handler, enabled = true) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
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
  const [state, setState] = useState(null);
  useEffect(() => {
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
  const select = useCallback((id) => {
    const host = bridge();
    if (!host?.tabs)
      return;
    host.tabs.select(id).then(setState).catch(() => void 0);
  }, []);
  const setBadge = useCallback((id, badge) => {
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
  const [search, setSearch] = useState(null);
  const [event, setEvent] = useState({ query: "", scope: "", submitted: false });
  useEffect(() => {
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
  const setQuery = useCallback((query) => {
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
  const [inset, setInset] = useState(() => ({ height: measure(), animationMs: 250, source: "viewport" }));
  useBridgeEvent("events", "keyboardChanged", (payload) => {
    const next = payload ?? {};
    setInset({
      height: Math.max(0, Math.round(Number(next.height) || 0)),
      animationMs: Math.max(0, Math.round(Number(next.animationMs) || 250)),
      source: "host"
    });
  });
  useEffect(() => {
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
  const initial = useMemo(() => {
    if (typeof window === "undefined")
      return { locale: "en", language: "en" };
    const injected = window.__aiboxEnvironment;
    if (injected?.locale)
      return { locale: injected.locale, language: injected.language || injected.locale };
    const navigatorLanguage = typeof navigator !== "undefined" ? navigator.language : "en";
    return { locale: navigatorLanguage, language: navigatorLanguage };
  }, []);
  const [value, setValue] = useState(initial);
  useBridgeEvent("events", "localeChanged", (payload) => {
    const next = payload ?? {};
    if (!next.locale)
      return;
    setValue({ locale: next.locale, language: next.language || next.locale });
  });
  return value;
}
function useScene() {
  const [state, setState] = useState(null);
  useEffect(() => {
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
  return useMemo(() => available(namespace, method), [namespace, method]);
}
export {
  useCapability,
  useKeyboardInset,
  useLocale,
  useScene,
  useTabs,
  useToolbarSearch
};
