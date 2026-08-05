import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 歌词区（§4.7 / §4.9）。四态：加载中 / 有歌词 / 无歌词 / 无当前曲。
//
// 逐行同步的代码结构**已经就位**（当前行、扫光、点行跳转、滚到 40% 高度都实现了），
// 只是今天宿主 `music_lyrics` 返回的是剥掉时间轴的纯文本 → `synced === false`：
// 此时统一按「居中、可滚动的整块文本」渲染，不做高亮、不做扫光、不响应点行跳转。
// 宿主补上 `lines:[{time,text}]` 后，`synced` 变 true，同一份代码自动变成逐行同步。
import React from 'react';
import Icon from './Icon.js';
import { Spinner } from './primitives.js';
import { WHITE } from './theme.js';
import { currentLineIndex, sweepRatio } from '../lib/lyrics.js';
const SCROLL_IDLE_MS = 1800;
export default function Lyrics({ payload, displayTime, onSeek, onUserScroll, t }) {
    const ref = React.useRef(null);
    const lineRefs = React.useRef([]);
    const idleTimer = React.useRef(null);
    const [scrolling, setScrolling] = React.useState(false);
    const lines = payload.lines || [];
    const synced = !!payload.synced;
    const index = synced ? currentLineIndex(lines, displayTime) : -1;
    // 当前行变化时滚到卡片 40% 高度处（anchor y = 0.4）。用户正在手动滚动时不抢。
    React.useEffect(() => {
        if (!synced || index < 0 || scrolling)
            return;
        const container = ref.current;
        const element = lineRefs.current[index];
        if (!container || !element)
            return;
        const target = element.offsetTop - container.clientHeight * 0.4 + element.clientHeight / 2;
        container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }, [index, synced, scrolling]);
    const handleScroll = () => {
        if (!scrolling) {
            setScrolling(true);
            onUserScroll(true);
        }
        if (idleTimer.current)
            clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(() => {
            setScrolling(false);
            onUserScroll(false);
        }, SCROLL_IDLE_MS);
    };
    React.useEffect(() => () => { if (idleTimer.current)
        clearTimeout(idleTimer.current); }, []);
    if (payload.state === 'loading') {
        return (_jsx("div", { style: { flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: _jsx(Spinner, { size: 26, color: WHITE.primary }) }));
    }
    if (payload.state !== 'ok' || lines.length === 0) {
        return (_jsxs("div", { style: {
                flex: '1 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 10, padding: 24, textAlign: 'center', color: WHITE.primary,
            }, children: [_jsx(Icon, { name: "quote.bubble", size: 30, color: WHITE.primary }), _jsx("span", { style: { fontSize: 15, fontWeight: 700 }, children: t('np.lyricsUnavailable') }), _jsx("span", { style: { fontSize: 12, lineHeight: 1.45, color: 'rgba(255,255,255,0.65)' }, children: t('np.lyricsUnavailableHint') })] }));
    }
    return (_jsx("div", { ref: ref, className: "mu-scroll", onScroll: handleScroll, style: {
            flex: '1 1 auto',
            padding: '40px 24px 280px',
            // 上下边缘淡出遮罩：透明 @0 / 不透明 @12% / 不透明 @84% / 透明 @100%
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 12%, #000 84%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, #000 12%, #000 84%, transparent 100%)',
        }, children: lines.map((line, i) => (_jsx(LyricLine, { ref: (node) => { lineRefs.current[i] = node; }, line: line, active: synced && i === index, synced: synced, sweep: synced && i === index ? sweepRatio(lines, i, displayTime) : 0, onClick: synced && line.time !== null ? () => onSeek(line.time) : undefined }, `${i}-${line.time === null ? 'p' : line.time}`))) }));
}
const LyricLine = React.forwardRef(({ line, active, synced, sweep, onClick }, ref) => {
    const text = line.text && line.text.length > 0 ? line.text : ' ';
    // 卡拉OK扫光：仅当前行、仅同步歌词。渐变 stops = [白 @0, 白 @sweep, 白45% @sweep+0.03, 白45% @1]
    const sweepStyle = active ? {
        backgroundImage: `linear-gradient(to right, ${WHITE.primary} 0%, ${WHITE.primary} ${sweep * 100}%, rgba(255,255,255,0.45) ${Math.min(1, sweep + 0.03) * 100}%, rgba(255,255,255,0.45) 100%)`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
    } : {};
    return (_jsxs("div", { ref: ref, onClick: onClick, role: onClick ? 'button' : undefined, style: {
            padding: '8px 0',
            marginBottom: 6,
            cursor: onClick ? 'pointer' : 'default',
            transformOrigin: 'left center',
            transform: synced ? `scale(${active ? 1 : 0.94})` : 'none',
            opacity: synced ? (active ? 1 : 0.4) : 0.92,
            transition: 'opacity 0.28s ease-out, transform 0.28s cubic-bezier(0.2,0.8,0.3,1)',
        }, children: [_jsx("div", { style: {
                    fontSize: 24,
                    fontWeight: 700,
                    lineHeight: 1.28,
                    color: WHITE.primary,
                    textAlign: synced ? 'left' : 'center',
                    ...sweepStyle,
                }, children: text }), line.translation ? (_jsx("div", { style: {
                    fontSize: 17, fontWeight: 500, marginTop: 4,
                    color: active ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.45)',
                    textAlign: synced ? 'left' : 'center',
                }, children: line.translation })) : null] }));
});
LyricLine.displayName = 'LyricLine';
