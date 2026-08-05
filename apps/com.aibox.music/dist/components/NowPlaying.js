import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// Now Playing（§2.1）。**普通独立页**，不是下拉抽屉、不是沉浸 overlay，本页自身没有任何拖拽手势。
// 两个就地切换的形态（专辑 / 歌词）**共享底部控件组**。
import React from 'react';
import Icon from './Icon.js';
import { Artwork, ToastCapsule } from './primitives.js';
import { Scrubber, TransportBar } from './PlayerControls.js';
import Lyrics from './Lyrics.js';
import { WHITE } from './theme.js';
import { rgba, sizedArtworkURL, artworkDataURL } from '../lib/artwork.js';
const MAX_COVER = 340;
export default function NowPlaying({ track, status, busy, progress, position, duration, artworkURL, color, lyrics, mode, onSetMode, isFavorite, onToggleFavorite, onOpenTrackMenu, scrub, onPrevious, onNext, onTogglePlay, onSeekSeconds, onRetry, t, }) {
    const [controlsHidden, setControlsHidden] = React.useState(false);
    const [toast, setToast] = React.useState(null);
    const toastTimer = React.useRef(null);
    const showToast = (message) => {
        setToast(message);
        if (toastTimer.current)
            clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 2000);
    };
    React.useEffect(() => () => { if (toastTimer.current)
        clearTimeout(toastTimer.current); }, []);
    const toggleMode = () => {
        if (!track) {
            showToast(t('np.lyricsUnavailable'));
            return;
        }
        onSetMode(mode === 'lyrics' ? 'album' : 'lyrics');
        if (mode === 'lyrics')
            setControlsHidden(false);
    };
    const failed = status.playbackState === 'failed';
    return (_jsxs("div", { style: { position: 'relative', flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }, children: [_jsx(Ambient, { url: artworkURL, color: color, dim: mode === 'lyrics' }), _jsxs("div", { style: {
                    position: 'relative', zIndex: 1, flex: '1 1 auto', minHeight: 0,
                    display: 'flex', flexDirection: 'column',
                    padding: '12px 20px 20px', color: WHITE.primary,
                }, children: [mode === 'lyrics' ? (_jsxs(_Fragment, { children: [_jsx(LyricsHeader, { track: track, artworkURL: artworkURL, isFavorite: isFavorite, onToggleFavorite: onToggleFavorite, onOpenTrackMenu: onOpenTrackMenu, onBack: () => { onSetMode('album'); setControlsHidden(false); }, t: t }), _jsx(Lyrics, { payload: lyrics, displayTime: position, onSeek: onSeekSeconds, onUserScroll: setControlsHidden, t: t })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { style: { flex: '0 1 16px', minHeight: 16 } }), _jsx(CoverArea, { url: artworkURL, playing: status.isPlaying, onTap: toggleMode, onLyrics: toggleMode }), _jsx("div", { style: { height: 24, flex: '0 0 auto' } }), _jsx(TitleRow, { track: track, isFavorite: isFavorite, onToggleFavorite: onToggleFavorite, onOpenTrackMenu: onOpenTrackMenu, t: t }), _jsx("div", { style: { flex: '1 1 20px', minHeight: 20 } })] })), _jsxs("div", { style: {
                            display: 'flex', flexDirection: 'column', gap: 20, flex: '0 0 auto',
                            maxHeight: controlsHidden ? 0 : 200,
                            opacity: controlsHidden ? 0 : 1,
                            overflow: 'hidden',
                            transform: controlsHidden ? 'translateY(24px)' : 'none',
                            transition: 'opacity 0.28s ease-in-out, transform 0.28s ease-in-out, max-height 0.28s ease-in-out',
                        }, children: [_jsx(Scrubber, { progress: progress, position: position, duration: duration, onBegin: scrub.begin, onChange: scrub.update, onEnd: scrub.end }), _jsx(TransportBar, { isPlaying: status.isPlaying, busy: busy, disabled: !track, onPrevious: onPrevious, onToggle: onTogglePlay, onNext: onNext })] })] }), failed ? _jsx(FailureCard, { status: status, onRetry: onRetry, t: t }) : null, _jsx(ToastCapsule, { message: toast })] }));
}
/** 氛围背景：自下而上 5 层，铺满全屏（含安全区）。 */
function Ambient({ url, color, dim }) {
    const [dataURL, setDataURL] = React.useState(null);
    const target = url ? sizedArtworkURL(url, 200) : null;
    React.useEffect(() => {
        let cancelled = false;
        setDataURL(null);
        if (!target)
            return undefined;
        artworkDataURL(target).then((value) => { if (!cancelled)
            setDataURL(value); });
        return () => { cancelled = true; };
    }, [target]);
    const base = color ? rgba(color, 0.55) : 'rgba(255,107,107,0.55)';
    const mid = color ? rgba(color, 0.16) : 'rgba(255,107,107,0.16)';
    return (_jsxs("div", { className: "mu-ambient", children: [_jsx("div", { style: { background: '#000' } }), dataURL ? _jsx("img", { className: "mu-ambient-blur", src: dataURL, alt: "" }) : null, _jsx("div", { style: {
                    background: `linear-gradient(to bottom, ${base} 0%, ${mid} 55%, rgba(0,0,0,0.35) 100%)`,
                    transition: 'background 0.4s ease-in-out',
                } }), _jsx("div", { style: { background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.5) 100%)' } }), _jsx("div", { style: {
                    background: 'rgba(0,0,0,0.28)',
                    opacity: dim ? 1 : 0,
                    transition: 'opacity 0.35s ease-in-out',
                } })] }));
}
function CoverArea({ url, playing, onTap, onLyrics }) {
    return (_jsx("div", { style: { display: 'flex', justifyContent: 'center', flex: '0 1 auto', minHeight: 0 }, children: _jsxs("div", { style: {
                position: 'relative',
                width: '100%',
                maxWidth: MAX_COVER,
                aspectRatio: '1 / 1',
                transform: `scale(${playing ? 1 : 0.86})`,
                transition: 'transform 0.45s cubic-bezier(0.2,0.9,0.3,1)',
            }, children: [_jsx("button", { type: "button", className: "mu-btn mu-press", onClick: onTap, style: { display: 'block', width: '100%', height: '100%' }, children: _jsx(Artwork, { url: url, size: "100%", radius: 16, iconSize: 64, tint: "#FFFFFF", background: "rgba(255,255,255,0.08)", shadow: playing ? '0 14px 28px rgba(0,0,0,0.4)' : '0 7px 14px rgba(0,0,0,0.4)', style: { width: '100%', height: '100%', minWidth: 0 } }) }), _jsx("button", { type: "button", className: "mu-btn mu-press", onClick: (event) => { event.stopPropagation(); onLyrics(); }, "aria-label": "audioLyricsToggle", style: {
                        position: 'absolute', right: 12, bottom: 12, width: 44, height: 44, borderRadius: 22,
                        background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }, children: _jsx(Icon, { name: "quote.bubble.fill", size: 18, color: WHITE.primary }) })] }) }));
}
function TitleRow({ track, isFavorite, onToggleFavorite, onOpenTrackMenu, t }) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }, children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: '1 1 auto' }, children: [_jsx("span", { className: "mu-clamp-1", style: { fontSize: 22, fontWeight: 700, color: WHITE.primary }, children: track ? track.title : t('np.notPlaying') }), track && track.artist ? (_jsx("span", { className: "mu-clamp-1", style: { fontSize: 17, color: WHITE.secondary }, children: track.artist })) : null] }), _jsx("button", { type: "button", className: "mu-btn mu-press", onClick: onToggleFavorite, disabled: !track, style: { opacity: track ? 1 : 0.35, padding: 4 }, children: _jsx(Icon, { name: isFavorite ? 'star.fill' : 'star', size: 24, color: WHITE.primary }) }), _jsx("button", { type: "button", className: "mu-btn mu-press", onClick: onOpenTrackMenu, disabled: !track, style: { opacity: track ? 1 : 0.35, padding: 4 }, children: _jsx(Icon, { name: "ellipsis", size: 24, color: WHITE.primary }) })] }));
}
function LyricsHeader({ track, artworkURL, isFavorite, onToggleFavorite, onOpenTrackMenu, onBack, t }) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto', paddingBottom: 8 }, children: [_jsx("button", { type: "button", className: "mu-btn mu-press", onClick: onBack, children: _jsx(Artwork, { url: artworkURL, size: 52, radius: 8, iconSize: 22, tint: "#FFFFFF", background: "rgba(255,255,255,0.1)" }) }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '1 1 auto', marginLeft: 4 }, children: [_jsx("span", { className: "mu-clamp-1", style: { fontSize: 17, fontWeight: 700, color: WHITE.primary }, children: track ? track.title : t('np.notPlaying') }), track && track.artist ? (_jsx("span", { className: "mu-clamp-1", style: { fontSize: 13, color: WHITE.secondary }, children: track.artist })) : null] }), _jsx("button", { type: "button", className: "mu-btn mu-press", onClick: onToggleFavorite, style: { padding: 4 }, children: _jsx(Icon, { name: isFavorite ? 'star.fill' : 'star', size: 20, color: WHITE.primary }) }), _jsx("button", { type: "button", className: "mu-btn mu-press", onClick: onOpenTrackMenu, style: { padding: 4 }, children: _jsx(Icon, { name: "ellipsis", size: 20, color: WHITE.primary }) })] }));
}
/** 失败态卡片：只有 playbackState == failed 时渲染；loading / buffering 不在这里显示 spinner。 */
function FailureCard({ status, onRetry, t }) {
    const reason = reasonText(status.lastError, t);
    return (_jsx("div", { style: {
            position: 'absolute', inset: 0, zIndex: 5, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 24, pointerEvents: 'none',
        }, children: _jsxs("div", { style: {
                maxWidth: 290, padding: 18, borderRadius: 18, textAlign: 'center', pointerEvents: 'auto',
                background: 'rgba(40,40,40,0.72)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: WHITE.primary,
            }, children: [_jsx(Icon, { name: "exclamationmark.triangle.fill", size: 24, color: WHITE.primary }), _jsx("span", { style: { fontSize: 16, fontWeight: 600 }, children: t('np.playbackFailed') }), _jsx("span", { style: { fontSize: 13, lineHeight: 1.4, color: 'rgba(255,255,255,0.8)' }, children: reason }), _jsx("button", { type: "button", className: "mu-btn mu-press", onClick: onRetry, style: {
                        marginTop: 4, padding: '9px 18px', borderRadius: 999,
                        background: '#FFFFFF', color: '#000', fontSize: 14, fontWeight: 600,
                    }, children: t('common.tryAgain') })] }) }));
}
function reasonText(lastError, t) {
    const value = String(lastError || '').toLowerCase();
    if (value.includes('not authorized') || value.includes('access'))
        return t('err.denied');
    if (value.includes('subscription'))
        return t('err.noSubscription');
    if (value.includes('not found'))
        return t('err.notFound');
    return t('err.generic');
}
