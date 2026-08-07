import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 详情页：专辑 / 歌单（§2.11）、艺人（§2.12）、资料库分类全列表（§2.13）。
// 用滚动容器 + 惰性纵列，不用 List——多按钮行的点击容易被吞。
import React from 'react';
import Icon from './Icon.js';
import { Artwork, EmptyState, ListHeader, Spinner } from './primitives.js';
import { CollectionRow, Divider, NumberedTrackRow, SongRow } from './rows.js';
import { C, SPACE } from './theme.js';
import { music as callMusic, openURL, haptics } from '../lib/host.js';
export function CollectionDetail({ ctx, item }) {
    const { t, actions, store } = ctx;
    const [state, setState] = React.useState({ loading: true, tracks: [], albums: [] });
    React.useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const kind = item.type === 'artist' ? 'artist' : item.type === 'playlist' ? 'playlist' : 'album';
            const result = await callMusic('get', {
                id: item.musicItemId,
                kind,
                ...(item.source === 'local' ? { source: 'local' } : {}),
            });
            if (cancelled)
                return;
            const payload = result.json || {};
            const tracks = Array.isArray(payload.tracks) ? payload.tracks : [];
            const albums = Array.isArray(payload.albums) ? payload.albums : [];
            albums.forEach((row) => store.rememberArtwork(row));
            setState({ loading: false, tracks, albums, failed: !result.ok });
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [item, store]);
    const isArtist = item.type === 'artist';
    const tracks = state.tracks;
    const firstTrack = tracks[0];
    return (_jsxs("div", { className: "mu-scroll", "aria-label": "audioCollectionDetail", children: [_jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                    padding: `12px ${SPACE.s4}px ${SPACE.s4}px`,
                }, children: [_jsx(Artwork, { url: item.artworkUrl, size: isArtist ? 130 : 180, radius: isArtist ? 65 : 12, iconSize: isArtist ? 30 : 44, shadow: isArtist ? '0 6px 12px rgba(0,0,0,0.2)' : '0 8px 14px rgba(0,0,0,0.22)' }), _jsx("span", { style: { fontSize: isArtist ? 20 : 18, fontWeight: 700, textAlign: 'center' }, children: item.title || item.name }), !isArtist && item.artist ? (_jsx("span", { className: "mu-clamp-1", style: { fontSize: 14, color: C.muted }, children: item.artist })) : null, item.url ? (_jsxs("button", { type: "button", className: "mu-btn mu-press", onClick: () => {
                            if (item.url)
                                void openURL(item.url);
                        }, style: { display: 'flex', alignItems: 'center', gap: 6, color: C.accent, fontSize: 13 }, children: [_jsx(Icon, { name: "arrow.up.forward.app", size: 14, color: C.accent }), t('common.openInAppleMusic')] })) : null, !isArtist ? (_jsxs("div", { style: { display: 'flex', gap: 10, width: '100%', paddingTop: 4 }, children: [_jsx(HeaderButton, { icon: "play.fill", label: t('detail.play'), disabled: state.loading || tracks.length === 0, onClick: () => {
                                    if (firstTrack)
                                        actions.playTrack(firstTrack, tracks);
                                } }), _jsx(HeaderButton, { icon: "shuffle", label: t('detail.shuffle'), disabled: state.loading || tracks.length === 0, onClick: () => actions.shufflePlay(tracks) })] })) : null] }), state.loading ? (_jsx("div", { style: { padding: 30, display: 'flex', justifyContent: 'center' }, children: _jsx(Spinner, { color: C.muted }) })) : null, !state.loading && tracks.length === 0 && state.albums.length === 0 ? (_jsx(EmptyState, { icon: "music.note.list", title: isArtist ? t('detail.artistFailed') : t('detail.personalized'), top: 20, action: item.url ? (_jsx("button", { type: "button", className: "mu-btn mu-press", onClick: () => {
                        if (item.url)
                            void openURL(item.url);
                    }, style: {
                        marginTop: 6,
                        padding: '8px 16px',
                        borderRadius: 999,
                        fontSize: 14,
                        fontWeight: 600,
                        background: `color-mix(in srgb, ${C.accent} 15%, transparent)`,
                        color: C.accent,
                    }, children: t('common.openInAppleMusic') })) : null })) : null, tracks.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(ListHeader, { children: isArtist ? t('detail.topSongs') : t('detail.trackCount', tracks.length) }), (isArtist ? tracks.slice(0, 10) : tracks).map((track, index) => (_jsxs(React.Fragment, { children: [_jsx(NumberedTrackRow, { index: index, track: track, numberWidth: isArtist ? 24 : 28, onClick: () => actions.playTrack(track, tracks), onLongPress: () => actions.trackMenu(track, { group: tracks }) }), index < tracks.length - 1 ? _jsx(Divider, { inset: isArtist ? 52 : 56 }) : null] }, track.id || `${index}`)))] })) : null, state.albums.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(ListHeader, { children: t('detail.albums') }), _jsx("div", { className: "mu-hrow", style: { display: 'flex', gap: 12, padding: `0 ${SPACE.s4}px` }, children: state.albums.map((album) => (_jsxs("button", { type: "button", className: "mu-btn mu-press", onClick: () => {
                                haptics.impact('light');
                                actions.playCollection(album);
                            }, style: { width: 130, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsx(Artwork, { url: album.artworkUrl, size: 130, radius: 10, iconSize: 28 }), _jsx("span", { className: "mu-clamp-1", style: { fontSize: 13, fontWeight: 500, width: 130, textAlign: 'left' }, children: album.title })] }, album.musicItemId))) })] })) : null, _jsx("div", { style: { height: 24 } })] }));
}
function HeaderButton({ icon, label, disabled, onClick, }) {
    return (_jsxs("button", { type: "button", className: "mu-btn mu-press", disabled: disabled, onClick: onClick, style: {
            flex: '1 1 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 0',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            background: `color-mix(in srgb, ${C.accent} 15%, transparent)`,
            color: C.accent,
            opacity: disabled ? 0.4 : 1,
        }, children: [_jsx(Icon, { name: icon, size: 15, color: C.accent }), label] }));
}
/** 资料库分类全列表（§2.13）：读会话缓存，不重新请求网络。 */
export function CategoryList({ ctx, route }) {
    const { actions } = ctx;
    const items = route.items || [];
    const isSongs = route.id === 'songs';
    const songItems = items;
    const collectionItems = items;
    return (_jsxs("div", { className: "mu-scroll", children: [(isSongs ? songItems : collectionItems).map((item, index) => isSongs ? (_jsx(SongRow, { track: item, onClick: () => actions.playTrack(item, songItems), onLongPress: () => actions.trackMenu(item, { group: songItems }) }, item.musicItemId || index)) : (_jsx(CollectionRow, { item: item, onClick: () => actions.openCollection(item), onLongPress: () => actions.collectionMenu(item) }, item.musicItemId || index))), _jsx("div", { style: { height: 24 } })] }));
}
