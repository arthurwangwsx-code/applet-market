import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 哔哩哔哩（com.aibox.bilibili）—— 用 B 站 Web API + 原生外壳复刻移动端观感。
//
// 根职责：主题注入 → 接宿主底部 Tab（**声明在 manifest.scene.tabBar，不自绘**）
// → 用原生页栈推详情页 → 渲染当前 Tab。
//
// ## 这个应用为什么不是「套壳网页」
//
// 容器根本不允许套壳：WebView 只放行 `applet://`，也不能 iframe。所以每一屏都是原生外壳 + 自绘内容：
//  · 底部 Tab / 转场 —— 宿主的真原生控件；
//  · 长列表 —— `aibox/ui` 的虚拟列表（排行榜一次 100 条带封面，全量渲染必掉帧）；
//  · 长按菜单 —— 真 `UIContextMenuInteraction`（`useListGestures` 把行矩形喂给宿主）；
//  · 封面 —— `applet://image/` 走宿主两级图片缓存，不是裸 `<img>`（CSP 会拦）；
//  · 播放 —— 遥控宿主 AVPlayer，拿到全屏、画中画、锁屏卡片、后台播放。
import React from 'react';
import { useSubpageStack } from 'aibox/ui';
import FeedPage from './components/FeedPage.js';
import SearchPage from './components/SearchPage.js';
import MinePage from './components/MinePage.js';
import DetailPage from './components/DetailPage.js';
import { THEME_CSS, C } from './components/theme.js';
import { registerActions } from './lib/actions.js';
// 对外提供的 3 个 AI 动作（search / trending / play）。**模块求值期就注册**：
// 无头执行时页面不挂载任何组件，等 React 副作用就来不及了。
registerActions();
const bridge = () => (typeof window !== 'undefined' ? window.aibox : undefined);
/** 主题：CSS 变量注入 + 跟随系统深浅色。 */
function useTheme() {
    React.useEffect(() => {
        if (!document.getElementById('__bl_css__')) {
            const style = document.createElement('style');
            style.id = '__bl_css__';
            style.textContent = THEME_CSS;
            document.head.appendChild(style);
        }
        const query = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
        const apply = () => {
            document.documentElement.setAttribute('data-prefers-color-scheme', query && query.matches ? 'dark' : 'light');
        };
        apply();
        query?.addEventListener?.('change', apply);
        return () => query?.removeEventListener?.('change', apply);
    }, []);
}
const TABS = [
    { id: 'feed', label: '首页' },
    { id: 'search', label: '搜索' },
    { id: 'mine', label: '我的' },
];
function isTabID(value) {
    return TABS.some((item) => item.id === value);
}
/**
 * 底部 Tab。身份在 manifest 里声明（宿主渲染真原生 TabBar），这里只接选中事件。
 *
 * 宿主没渲染出来时（surface 不支持 / 老宿主）回落到自绘条——**永远不能只有原生一条路**，
 * 否则在不支持的表面上整个应用就没法切页了。
 */
function useTabs(initial, resetSubpages) {
    const [tab, setTab] = React.useState(initial);
    const [native, setNative] = React.useState(false);
    // `resetSubpages` 由 useSubpageStack 提供且当前实现稳定，但这里仍经 ref 取最新值：
    // 订阅原生事件不该因为调用方闭包身份变化而反复解绑/重绑。
    const resetSubpagesRef = React.useRef(resetSubpages);
    resetSubpagesRef.current = resetSubpages;
    const applySelection = React.useCallback((id) => {
        // 根 Tab 与子页栈不能同时生效。先清栈再换根页，避免出现「我的已选中，画面仍是详情页」。
        resetSubpagesRef.current();
        setTab(id);
    }, []);
    React.useEffect(() => {
        const api = bridge();
        if (!api?.tabs)
            return undefined;
        let off;
        (async () => {
            try {
                const state = await api.tabs.getState?.();
                setNative(!!state?.rendered);
                if (state?.selected && isTabID(state.selected))
                    applySelection(state.selected);
            }
            catch {
                setNative(false);
            }
            try {
                // 事件名是 'changed'，回调收的是整个 State（不是 {id}）——
                // `rendered` 也在里面，所以呈现表面变化（page → sheet）时自绘条能跟着切回来。
                off = api.tabs.on?.('changed', (state) => {
                    if (state?.selected && isTabID(state.selected))
                        applySelection(state.selected);
                    setNative(!!state?.rendered);
                });
            }
            catch {
                /* 没有事件面就只靠自绘条 */
            }
        })();
        return () => {
            try {
                off?.();
            }
            catch {
                /* 已卸载 */
            }
        };
    }, [applySelection]);
    const select = React.useCallback((id) => {
        applySelection(id);
        // 桥方法回的是 **Promise**，同步 try/catch 抓不住它的 rejection——那会变成
        // 「Unhandled promise rejection」污染 console。桥在能力不可用时是 reject 而不是 throw
        // （无头运行、sheet/card 表面上 tabs 都会拒），所以 `.catch` 是必需的，不是防御性冗余。
        try {
            bridge()
                ?.tabs?.select?.(id)
                ?.catch?.(() => { });
        }
        catch {
            /* 连命名空间都没有 */
        }
    }, [applySelection]);
    return { tab, native, select };
}
/** 自绘底部条 —— 只在宿主没渲染原生 TabBar 时出现。 */
function FallbackTabBar({ value, onChange }) {
    return (_jsx("div", { style: {
            display: 'flex',
            borderTop: `1px solid ${C.line}`,
            background: C.bg,
            paddingBottom: 'env(safe-area-inset-bottom)',
            flexShrink: 0,
        }, children: TABS.map((item) => (_jsx("button", { type: "button", onClick: () => onChange(item.id), style: {
                flex: 1,
                border: 'none',
                background: 'transparent',
                padding: '10px 0',
                fontSize: 12,
                color: value === item.id ? C.brand : C.faint,
                fontWeight: value === item.id ? 600 : 400,
            }, children: item.label }, item.id))) }));
}
export default function App() {
    useTheme();
    // 详情页走原生页栈：推入动画、边缘返回手势、顶栏标题全由宿主给。
    const stack = useSubpageStack({
        pathFor: (route) => `#/video/${route.bvid}`,
        titleFor: (route) => route.title || '视频',
    });
    const tabs = useTabs('feed', stack.reset);
    const openVideo = React.useCallback((video) => {
        stack.push({ bvid: video.bvid, title: video.title });
    }, [stack]);
    let body;
    if (stack.route) {
        body = _jsx(DetailPage, { bvid: stack.route.bvid, onOpen: openVideo });
    }
    else if (tabs.tab === 'search') {
        body = _jsx(SearchPage, { onOpen: openVideo });
    }
    else if (tabs.tab === 'mine') {
        body = _jsx(MinePage, { onOpen: openVideo });
    }
    else {
        body = _jsx(FeedPage, { onOpen: openVideo });
    }
    return (_jsxs("div", { style: {
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: C.bg,
            color: C.text,
            overflow: 'hidden',
        }, children: [_jsx("div", { style: { flex: 1, minHeight: 0 }, children: body }), !tabs.native ? _jsx(FallbackTabBar, { value: tabs.tab, onChange: tabs.select }) : null] }));
}
