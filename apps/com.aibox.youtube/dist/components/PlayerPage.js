import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 播放页：解析 → 选清晰度 → 交给宿主播放器。
//
// ## 这一页的核心是「只列能播的」
//
// `resolve` 回来的每条格式带一个 `playable`。它为假的原因是**这个构建里没编入分离流合成后端**——
// YouTube 的高清全是 dash（音视频两条 URL），没有那个后端就播不了。
//
// 所以这里**过滤掉不可播的**，而不是列出来让用户点了黑屏。同时，如果过滤后一条都不剩，
// 明确告诉用户原因，而不是显示一个空列表。
import React from 'react';
import { EmptyState, PrimaryButton, Spinner } from './primitives.js';
import VideoCard from './VideoCard.js';
import { C, RADIUS, SPACE } from './theme.js';
import * as innertube from '../lib/innertube.js';
import { capabilities, closeStage, copyText, haptic, imageURL, loadPref, onVideoProgress, openInBrowser, openStage, play, resolve, savePref, share, toast, } from '../lib/host.js';
import { formatDuration, qualityLabel } from '../lib/format.js';
import { loadSettings } from '../lib/settings.js';
import { errorMessage } from '../lib/types.js';
const PROGRESS_KEY = 'watch-progress';
const HISTORY_KEY = 'watch-history';
export default function PlayerPage({ video, onOpen }) {
    const [state, setState] = React.useState('resolving');
    const [media, setMedia] = React.useState(null);
    const [error, setError] = React.useState('');
    // `null` = 还没探测出来。**别用 true 当初值**：那会让页面先显示「能播」再跳成「不能播」。
    const [caps, setCaps] = React.useState(null);
    // 舞台开着时视频由**宿主**画在页面顶部，页面自己那块封面就该让位——
    // 否则会同时看到「上面在放的视频」和「下面一张静止封面」。
    const [stageOn, setStageOn] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [progress, setProgress] = React.useState(null);
    const [related, setRelated] = React.useState([]);
    const pending = React.useRef(null);
    React.useEffect(() => {
        let alive = true;
        setState('resolving');
        capabilities().then((c) => {
            if (alive)
                setCaps(c);
        });
        resolve(video.url)
            .then((r) => {
            if (!alive)
                return;
            setMedia(r);
            setState('ready');
            // 写进历史。读-改-写要合并，不能整表覆盖。
            loadPref(HISTORY_KEY, [])
                .then((list) => {
                const rest = list.filter((item) => item.id !== video.id);
                savePref(HISTORY_KEY, [{ ...video, at: Date.now() }, ...rest].slice(0, 50));
            })
                .catch(() => { });
        })
            .catch((err) => {
            if (!alive)
                return;
            setError(errorMessage(err));
            setState('error');
        });
        // 「相关」用标题里的关键词再搜一次——InnerTube 的 related 需要额外 token，
        // 用搜索近似是诚实且够用的做法（列表里明说是「相似视频」而不是「相关推荐」）。
        const keyword = (String(video.title || '').split(/[|｜\-–—[\]【】]/)[0] ?? '').trim().slice(0, 20);
        if (keyword) {
            innertube
                .search(keyword)
                .then((list) => {
                if (alive)
                    setRelated(list.filter((v) => v.id !== video.id).slice(0, 12));
            })
                .catch(() => { });
        }
        return () => {
            alive = false;
        };
    }, [video.id, video.url]);
    React.useEffect(() => {
        let lastWhole = -1;
        const off = onVideoProgress((snapshot) => {
            if (!snapshot?.mine)
                return;
            if (snapshot.currentTime > 5 && snapshot.duration > 0) {
                const ratio = snapshot.currentTime / snapshot.duration;
                pending.current = { key: video.id, value: ratio > 0.95 ? 0 : Math.floor(snapshot.currentTime) };
            }
            // 按整秒去重：事件是 2Hz，而这一页下面挂着十几条相似视频，每秒重渲两次全是白烧
            // （播放时用户其实在原生全屏播放器里）。
            const whole = Math.floor(snapshot.currentTime);
            if (whole === lastWhole)
                return;
            lastWhole = whole;
            setProgress(snapshot);
        });
        return off;
    }, [video.id]);
    React.useEffect(() => () => {
        const p = pending.current;
        if (!p)
            return;
        loadPref(PROGRESS_KEY, {})
            .then((all) => savePref(PROGRESS_KEY, { ...all, [p.key]: p.value }))
            .catch(() => { });
    }, []);
    const playable = React.useMemo(() => (media?.formats || []).filter((format) => format.playable !== false), [media]);
    const firstPlayable = playable[0];
    // 离开这一页就收起视频区（不停播——转画中画或后台听声都可能是用户想要的）。
    React.useEffect(() => () => {
        closeStage();
    }, []);
    const start = React.useCallback(async (formatID) => {
        if (busy)
            return;
        setBusy(true);
        haptic('medium');
        try {
            // **先开舞台再播**：舞台开着时宿主把播放器嵌在页面顶部（保持竖屏、内容照常滚），
            // 否则会接管整屏并转横屏。开舞台幂等，重复调只更新参数。
            // 每次起播都重读偏好：用户可能刚在「我的」里改过，不该等重进页面才生效。
            const stage = await openStage(await loadSettings());
            setStageOn(!!stage?.rendered);
            const saved = await loadPref(PROGRESS_KEY, {});
            await play({
                sourceURL: video.url,
                formatID,
                resumeFrom: Number(saved?.[video.id]) || 0,
            });
        }
        catch (err) {
            toast(`播放失败：${errorMessage(err)}`);
        }
        finally {
            setBusy(false);
        }
    }, [busy, video.url, video.id]);
    if (state === 'resolving')
        return _jsx(Spinner, { label: "\u89E3\u6790\u4E2D" });
    if (state === 'error') {
        // 三种失败的排查方向完全不同，别混成一句话（同 B 站那次 noBridge/noEngine 的教训）。
        let detail = error;
        if (caps?.reason === 'noBridge') {
            detail = '这个 App 版本还没有视频桥（aibox.video）。需要重新构建安装 App 本体，换小应用版本没用。';
        }
        else if (caps && !caps.resolve) {
            detail = '这个 App 构建没有编入媒体解析能力（MODULE_VIDEODOWNLOAD），解析不了 YouTube。';
        }
        return (_jsx(EmptyState, { title: "\u89E3\u6790\u4E0D\u4E86\u8FD9\u4E2A\u89C6\u9891", detail: detail, actionLabel: "\u7528\u6D4F\u89C8\u5668\u6253\u5F00", onAction: () => openInBrowser(video.url) }));
    }
    return (_jsxs("div", { className: "yt-scroll", style: { height: '100%', overflowY: 'auto', background: C.bg }, children: [stageOn ? null : (_jsxs("div", { onClick: () => {
                    if (firstPlayable)
                        start(firstPlayable.id);
                }, style: {
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '16 / 9',
                    background: C.surface,
                    overflow: 'hidden',
                }, children: [video.cover ? (_jsx("img", { src: imageURL(video.cover, 400), alt: "", style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } })) : null, _jsx("div", { style: {
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(0,0,0,0.25)',
                        }, children: _jsx("div", { style: {
                                width: 58,
                                height: 58,
                                borderRadius: 29,
                                background: 'rgba(0,0,0,0.55)',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 24,
                            }, children: busy ? '···' : '▶' }) }), progress?.mine && progress.duration > 0 ? (_jsx("div", { style: {
                            position: 'absolute',
                            left: 0,
                            bottom: 0,
                            height: 3,
                            width: `${Math.min(100, (progress.currentTime / progress.duration) * 100)}%`,
                            background: C.brand,
                        } })) : null] })), _jsxs("div", { style: { padding: SPACE.s4 }, children: [_jsx("div", { style: { fontSize: 17, fontWeight: 600, color: C.text, lineHeight: 1.4 }, children: media?.title || video.title }), _jsx("div", { style: { fontSize: 12, color: C.faint, marginTop: SPACE.s2 }, children: [media?.uploader || video.author, video.viewLabel, video.published].filter(Boolean).join(' · ') }), playable.length ? (_jsxs("div", { style: { marginTop: SPACE.s4 }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: SPACE.s2 }, children: "\u6E05\u6670\u5EA6" }), _jsx("div", { className: "yt-scroll", style: { display: 'flex', gap: SPACE.s2, overflowX: 'auto' }, children: playable.map((f) => (_jsxs("button", { type: "button", onClick: () => start(f.id), disabled: busy, style: {
                                        flexShrink: 0,
                                        border: 'none',
                                        borderRadius: RADIUS.lg,
                                        padding: `6px ${SPACE.s3}px`,
                                        fontSize: 13,
                                        lineHeight: 1.3,
                                        background: C.surface,
                                        color: C.text,
                                        textAlign: 'left',
                                    }, children: [_jsx("div", { children: qualityLabel(f.width, f.height, f.quality) }), f.width && f.height ? (_jsxs("div", { style: { fontSize: 10, color: C.faint, fontVariantNumeric: 'tabular-nums' }, children: [f.width, "\u00D7", f.height] })) : null] }, f.id))) })] })) : (_jsx("div", { style: {
                            marginTop: SPACE.s4,
                            padding: SPACE.s3,
                            borderRadius: RADIUS.md,
                            background: C.brandDim,
                            fontSize: 13,
                            color: C.sub,
                            lineHeight: 1.6,
                        }, children: caps?.dash
                            ? '这个视频没有可播放的清晰度。'
                            : '这个视频只提供分离流（音视频分开），而当前版本没有编入合流能力，所以播不了。' })), _jsxs("div", { style: { display: 'flex', gap: SPACE.s2, marginTop: SPACE.s4 }, children: [_jsx(PrimaryButton, { onClick: () => {
                                    if (firstPlayable)
                                        start(firstPlayable.id);
                                }, disabled: busy || !playable.length, children: busy ? '正在准备…' : '播放' }), _jsx("button", { type: "button", onClick: async () => {
                                    await copyText(video.url);
                                    toast('链接已复制');
                                }, style: {
                                    border: `1px solid ${C.line}`,
                                    background: 'transparent',
                                    color: C.sub,
                                    borderRadius: RADIUS.md,
                                    padding: `0 ${SPACE.s4}px`,
                                    fontSize: 14,
                                    flexShrink: 0,
                                }, children: "\u590D\u5236" }), _jsx("button", { type: "button", onClick: () => share(video.title, video.url), style: {
                                    border: `1px solid ${C.line}`,
                                    background: 'transparent',
                                    color: C.sub,
                                    borderRadius: RADIUS.md,
                                    padding: `0 ${SPACE.s4}px`,
                                    fontSize: 14,
                                    flexShrink: 0,
                                }, children: "\u5206\u4EAB" })] }), media?.durationSeconds ? (_jsxs("div", { style: { fontSize: 12, color: C.faint, marginTop: SPACE.s3 }, children: ["\u65F6\u957F ", formatDuration(media.durationSeconds), " \u00B7 \u89E3\u6790\u5668 ", media.extractor] })) : null] }), related.length ? (_jsxs("div", { style: { borderTop: `8px solid ${C.surface}`, paddingTop: SPACE.s2 }, children: [_jsx("div", { style: { padding: `${SPACE.s2}px ${SPACE.s4}px`, fontSize: 13, fontWeight: 600, color: C.sub }, children: "\u76F8\u4F3C\u89C6\u9891" }), related.map((v) => (_jsx(VideoCard, { video: v, onOpen: onOpen }, v.id)))] })) : null, _jsx("div", { style: { height: SPACE.s6 } })] }));
}
