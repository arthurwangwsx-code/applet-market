import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 资料库页（§2.7）。四段：最近添加 / 本设备 / Apple Music 资料库（五态互斥）/ 我的合集。
//
// 五态的判定在原生是「先授权 → 再探订阅 → 再看是否全空」，靠的是 MusicAuthorization 与
// MusicSubscription 两个独立 API。宿主没有 `availability()` 投影（缺口⑨），
// 这里只能从工具失败文案**反推**——文案变了就会退化成「加载失败」，不会误报成「库为空」。
import React from 'react';
import Icon from './Icon.js';
import { Artwork, EmptyState, IconTile, ListHeader, Row, Spinner, Chevron } from './primitives.js';
import { C, SPACE } from './theme.js';
import { music as callMusic, classifyMusicError, openURL } from '../lib/host.js';
const CATEGORIES = [
    { id: 'playlists', icon: 'music.note.list', key: 'lib.playlists' },
    { id: 'artists', icon: 'music.mic', key: 'lib.artists' },
    { id: 'albums', icon: 'square.stack', key: 'lib.albums' },
    { id: 'songs', icon: 'music.note', key: 'lib.songs' },
];
const cache = { data: null };
export default function LibraryPage({ ctx }) {
    const { t, store, actions } = ctx;
    const [state, setState] = React.useState(() => (cache.data
        ? { status: 'loaded', ...cache.data }
        : { status: 'loading', groups: {}, collections: [] }));
    React.useEffect(() => {
        if (cache.data)
            return undefined;
        let cancelled = false;
        const load = async () => {
            const [albums, playlists, songs, artists, collections] = await Promise.all([
                callMusic('library', { action: 'albums', limit: 60 }),
                callMusic('library', { action: 'playlists', limit: 60 }),
                callMusic('library', { action: 'songs', limit: 60 }),
                callMusic('library', { action: 'artists', limit: 60 }),
                callMusic('playlist', { action: 'list', source: 'local' }),
            ]);
            if (cancelled)
                return;
            const failure = classifyMusicError(albums.error || playlists.error || songs.error || artists.error);
            const groups = {
                albums: pick(albums, 'albums'),
                playlists: pick(playlists, 'playlists'),
                songs: pick(songs, 'songs'),
                artists: pick(artists, 'artists'),
            };
            Object.values(groups).flat().forEach((row) => store.rememberArtwork(row));
            const local = pick(collections, 'playlists');
            const total = Object.values(groups).reduce((sum, rows) => sum + rows.length, 0);
            let status = 'loaded';
            if (total === 0) {
                if (failure === 'denied')
                    status = 'denied';
                else if (failure === 'noSubscription')
                    status = 'noSubscription';
                else
                    status = 'empty';
            }
            cache.data = { groups, collections: local };
            setState({ status, groups, collections: local });
        };
        load();
        return () => { cancelled = true; };
    }, [store]);
    const { groups, collections } = state;
    const favorites = ctx.favorites;
    return (_jsxs("div", { className: "mu-scroll", children: [groups.albums && groups.albums.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(ListHeader, { children: t('lib.recentlyAdded') }), _jsx("div", { className: "mu-hrow", style: { display: 'flex', gap: 12, padding: `0 ${SPACE.s4}px 4px` }, children: groups.albums.slice(0, 10).map((album) => (_jsxs("button", { type: "button", className: "mu-btn mu-press", onClick: () => actions.openCollection(album), style: { width: 120, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsx(Artwork, { url: album.artworkUrl, size: 120, radius: 8, iconSize: 26 }), _jsx("span", { className: "mu-clamp-1", style: { fontSize: 12, fontWeight: 500, width: 120, textAlign: 'left' }, children: album.title })] }, album.musicItemId))) })] })) : null, _jsx(ListHeader, { children: t('lib.onThisDevice') }), _jsx(Row, { leading: _jsx(IconTile, { name: "heart.fill" }), title: t('lib.favorites'), subtitle: favorites.length > 0 ? t('lib.lovedCount', favorites.length) : t('lib.lovedEmpty'), accessory: _jsx(Chevron, {}), onClick: () => actions.openSheet('favorites') }), _jsx(Row, { leading: _jsx(IconTile, { name: "chart.bar.fill" }), title: t('lib.playHistory'), subtitle: t('lib.playHistoryHint'), accessory: _jsx(Chevron, {}), onClick: () => actions.openSheet('history') }), _jsx(Row, { leading: _jsx(IconTile, { name: "folder.fill" }), title: t('lib.localAudio'), subtitle: t('lib.localAudioHint'), accessory: _jsx(Chevron, {}), onClick: () => actions.navigate({ name: 'local' }), last: true }), _jsx(ListHeader, { children: t('lib.appleMusicLibrary') }), state.status === 'loading' ? (_jsx("div", { style: { padding: 24, display: 'flex', justifyContent: 'center' }, children: _jsx(Spinner, { color: C.muted }) })) : null, state.status === 'denied' ? (_jsx(EmptyState, { icon: "lock.fill", title: t('lib.accessNeeded'), hint: t('lib.accessNeededHint'), top: 16, action: (_jsx("button", { type: "button", className: "mu-btn mu-press", onClick: () => openURL('app-settings:'), style: {
                        marginTop: 6, padding: '8px 16px', borderRadius: 999, fontSize: 14, fontWeight: 600,
                        background: `color-mix(in srgb, ${C.accent} 15%, transparent)`, color: C.accent,
                    }, children: t('lib.openSettings') })) })) : null, state.status === 'noSubscription' ? (_jsx(EmptyState, { icon: "music.note", title: t('lib.subRequired'), hint: t('lib.subRequiredHint'), top: 16 })) : null, state.status === 'empty' ? (_jsx(EmptyState, { icon: "music.note.list", title: t('lib.noSaved'), hint: t('lib.noSavedHint'), top: 16 })) : null, state.status === 'loaded' ? CATEGORIES.map((category) => {
                const rows = groups[category.id] || [];
                if (rows.length === 0)
                    return null;
                return (_jsx(Row, { leading: _jsx(IconTile, { name: category.icon, size: 36, radius: 8, iconSize: 15 }), title: t(category.key), detail: rows.length, accessory: _jsx(Chevron, {}), minHeight: 48, onClick: () => actions.navigate({ name: 'category', id: category.id, title: t(category.key), items: rows }) }, category.id));
            }) : null, collections && collections.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(ListHeader, { children: t('lib.collections') }), collections.map((collection) => (_jsx(Row, { leading: _jsx(IconTile, { name: "music.note.list", size: 36, radius: 8, iconSize: 15 }), title: collection.title || collection.name, subtitle: collection.artist, accessory: _jsx(Chevron, {}), minHeight: 48, onClick: () => actions.openCollection({ ...collection, type: 'playlist', source: 'local' }) }, collection.musicItemId)))] })) : null, _jsx("div", { style: { height: 24 } })] }));
}
function pick(result, key) {
    if (!result.ok || !result.json)
        return [];
    const rows = result.json[key];
    return Array.isArray(rows) ? rows : [];
}
