import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 搜索页（§2.6）。范围切换 Apple Music / 资料库，防抖 300ms，结果分五段。
//
// 与原生的两处差异（宿主缺口，见 README）：
//  · **没有实时建议** —— 原生用 `MusicCatalogSearchSuggestionsRequest`，宿主未投影，这里不渲染建议行；
//  · 「资料库」范围走 `music_library` 的分类浏览 + 本地过滤，不是服务端的资料库搜索。
import React from 'react';
import Icon from './Icon.js';
import { EmptyState, ListHeader, Segmented, Spinner, SwipeRow } from './primitives.js';
import { useRowGestures } from 'aibox/ui';
import { CollectionRow, SongRow } from './rows.js';
import { C, SPACE } from './theme.js';
import { music as callMusic, classifyMusicError, openURL } from '../lib/host.js';
const DEBOUNCE_MS = 300;
/** 手势层的行身份。歌曲与合集的 id 空间可能撞车，故带类型前缀。 */
function rowKey(kind, item) {
    if (!item)
        return '';
    return `${kind}:${item.musicItemId || item.localTrackId || item.url || item.title || ''}`;
}
export default function SearchPage({ ctx, query, onQueryChange, searchRendered, }) {
    const { t, store, actions } = ctx;
    const [scope, setScope] = React.useState('catalog');
    const [state, setState] = React.useState({ loading: false, result: null, failure: null });
    React.useEffect(() => {
        const value = String(query || '').trim();
        if (!value) {
            setState({ loading: false, result: null, failure: null });
            return undefined;
        }
        setState((current) => ({ ...current, loading: true }));
        const timer = setTimeout(async () => {
            const result = await callMusic('search', {
                query: value,
                types: ['song', 'album', 'artist', 'playlist'],
                limit: 12,
                ...(scope === 'library' ? { source: 'local' } : {}),
            });
            if (!result.ok) {
                setState({ loading: false, result: null, failure: classifyMusicError(result.error) });
                return;
            }
            const raw = result.json || {};
            const payload = {
                songs: Array.isArray(raw.songs) ? raw.songs : [],
                albums: Array.isArray(raw.albums) ? raw.albums : [],
                artists: Array.isArray(raw.artists) ? raw.artists : [],
                playlists: Array.isArray(raw.playlists) ? raw.playlists : [],
            };
            ['songs', 'albums', 'artists', 'playlists'].forEach((kind) => {
                ;
                (payload[kind] || []).forEach((row) => store.rememberArtwork(row));
            });
            setState({ loading: false, result: payload, failure: null });
        }, DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [query, scope, store]);
    const submit = () => {
        const value = String(query || '').trim();
        if (value)
            store.recordQuery(value);
    };
    const playSong = (track, group) => {
        submit();
        store.recordSearchTrack(track);
        actions.playTrack(track, group);
    };
    const result = state.result;
    const songs = result?.songs || [];
    const albums = result?.albums || [];
    const artists = result?.artists || [];
    const playlists = result?.playlists || [];
    const hasResults = songs.length + albums.length + artists.length + playlists.length > 0;
    // 顶级结果：歌曲第 1 + 艺人第 1 + 专辑第 1，不足 3 条补歌单第 1，最多 3 条。
    const top = [songs[0], artists[0], albums[0]].filter((item) => Boolean(item)).slice(0, 3);
    if (top.length < 3 && playlists[0])
        top.push(playlists[0]);
    // —— 原生行手势（`aibox.list.*`）——
    //
    // 结果里歌曲行与合集行的可用动作不同，但**身份必须一次声明完**（合同同 `aibox.menu`：
    // 只能改显示状态、不能增删 id）。所以四项都声明，用逐行 `rowOverrides` 把不适用的那几项藏掉——
    // 这正是 `rowOverrides` 存在的理由，不要靠给每种行各配一个 region。
    const rowIndex = React.useMemo(() => {
        const map = new Map();
        songs.forEach((item) => map.set(rowKey('song', item), { kind: 'song', item }));
        [...artists, ...albums, ...playlists].forEach((item) => map.set(rowKey('item', item), { kind: 'item', item }));
        // 「顶级结果」里的那几条会**同时**出现在下面的分段里 —— 同一个 `data-row-id` 出现两次
        // 就是两份矩形争同一个身份（宿主只认最后一份，菜单会弹在错误的那一行）。给它们独立后缀。
        top.forEach((item) => {
            const kind = item.type === 'song' ? 'song' : 'item';
            map.set(`${rowKey(kind, item)}#top`, { kind, item });
        });
        return map;
    }, [songs, artists, albums, playlists, top]);
    const openExternal = (item) => {
        const link = item.url || store.externalURL(item);
        if (link)
            openURL(link);
    };
    const gestures = useRowGestures('search.results', {
        contextMenu: [
            { id: 'play', title: t('common.play'), icon: 'play.fill' },
            { id: 'queue', title: t('common.addToQueue'), icon: 'text.append' },
            { id: 'favorite', title: t('common.addToFavorites'), icon: 'heart' },
            { id: 'open', title: t('common.openInAppleMusic'), icon: 'arrow.up.forward.app' },
        ],
        rowOverrides: (rowId) => {
            const row = rowIndex.get(rowId);
            if (!row)
                return null;
            const hasLink = !!(row.item && (row.item.url || store.externalURL(row.item)));
            return {
                queue: { hidden: row.kind !== 'song' },
                favorite: { hidden: row.kind !== 'song' },
                open: { hidden: !hasLink },
            };
        },
        onAction: ({ rowId, actionId }) => {
            const row = rowIndex.get(rowId);
            if (!row)
                return;
            if (row.kind === 'song') {
                if (actionId === 'play')
                    playSong(row.item, songs);
                else if (actionId === 'queue')
                    actions.addToQueue(row.item);
                else if (actionId === 'favorite')
                    actions.toggleFavorite(row.item, true);
                else if (actionId === 'open')
                    openExternal(row.item);
                return;
            }
            if (actionId === 'play')
                actions.playCollection(row.item);
            else if (actionId === 'open')
                openExternal(row.item);
        },
    });
    return (_jsxs("div", { className: "mu-scroll", children: [!searchRendered ? (_jsx("div", { style: { padding: `${SPACE.s2}px ${SPACE.s4}px 0` }, children: _jsx("input", { value: query, placeholder: t('search.placeholder'), autoCorrect: "off", autoCapitalize: "none", onChange: (event) => onQueryChange(event.target.value), onKeyDown: (event) => {
                        if (event.key === 'Enter')
                            submit();
                    }, style: {
                        width: '100%',
                        border: 0,
                        outline: 'none',
                        borderRadius: 10,
                        background: `color-mix(in srgb, ${C.muted} 12%, transparent)`,
                        padding: '9px 12px',
                        fontSize: 16,
                        color: C.ink,
                    } }) })) : null, _jsx("div", { style: { padding: `${SPACE.s2}px ${SPACE.s4}px` }, children: _jsx(Segmented, { items: [
                        { id: 'catalog', title: t('search.scopeCatalog') },
                        { id: 'library', title: t('search.scopeLibrary') },
                    ], value: scope, onChange: setScope }) }), state.loading ? (_jsx("div", { style: { padding: 40, display: 'flex', justifyContent: 'center' }, children: _jsx(Spinner, { color: C.muted }) })) : null, !state.loading && state.failure === 'denied' ? (_jsx(EmptyState, { icon: "lock", title: t('search.notAuthorized'), hint: t('search.notAuthorizedHint') })) : null, !state.loading && state.failure === 'noSubscription' ? (_jsxs("div", { style: { display: 'flex', gap: 8, padding: `8px ${SPACE.s4}px`, alignItems: 'flex-start' }, children: [_jsx(Icon, { name: "info.circle", size: 15, color: C.accent }), _jsx("span", { style: { fontSize: 12, color: C.muted, lineHeight: 1.4 }, children: t('search.noSubBanner') })] })) : null, !state.loading && String(query || '').trim() && !hasResults && !state.failure ? (_jsx(EmptyState, { icon: "magnifyingglass", title: t('search.noResults', String(query).trim()) })) : null, hasResults ? (_jsxs("div", { ...gestures.regionProps, children: [top.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(ListHeader, { children: t('search.topResults') }), top.map((item) => item.type === 'song' ? (_jsx(SongRow, { rowId: `${rowKey('song', item)}#top`, track: item, onClick: () => playSong(item, songs), onLongPress: gestures.rendered ? undefined : () => actions.trackMenu(item, { group: songs }) }, `top-${item.musicItemId}`)) : (_jsx(CollectionRow, { rowId: `${rowKey('item', item)}#top`, item: item, onClick: () => {
                                    submit();
                                    actions.openCollection(item);
                                }, onLongPress: gestures.rendered ? undefined : () => actions.collectionMenu(item) }, `top-${item.type}-${item.musicItemId}`)))] })) : null, _jsx(Group, { title: t('search.artists'), items: artists, render: (item) => (_jsx(CollectionRow, { rowId: rowKey('item', item), item: item, onClick: () => {
                                submit();
                                actions.openCollection(item);
                            }, onLongPress: gestures.rendered ? undefined : () => actions.collectionMenu(item) }, item.musicItemId)) }), _jsx(Group, { title: t('search.songs'), items: songs, render: (item) => (_jsx(SongRow, { rowId: rowKey('song', item), track: item, onClick: () => playSong(item, songs), onLongPress: gestures.rendered ? undefined : () => actions.trackMenu(item, { group: songs }) }, item.musicItemId || item.localTrackId)) }), _jsx(Group, { title: t('search.albums'), items: albums, render: (item) => (_jsx(CollectionRow, { rowId: rowKey('item', item), item: item, onClick: () => {
                                submit();
                                actions.openCollection(item);
                            }, onLongPress: gestures.rendered ? undefined : () => actions.collectionMenu(item) }, item.musicItemId)) }), _jsx(Group, { title: t('search.playlists'), items: playlists, render: (item) => (_jsx(CollectionRow, { rowId: rowKey('item', item), item: item, onClick: () => {
                                submit();
                                actions.openCollection(item);
                            }, onLongPress: gestures.rendered ? undefined : () => actions.collectionMenu(item) }, item.musicItemId)) })] })) : null, !String(query || '').trim() && !state.loading ? _jsx(History, { ctx: ctx, onPick: onQueryChange }) : null, _jsx("div", { style: { height: 24 } })] }));
}
function Group({ title, items, render, }) {
    if (!items || items.length === 0)
        return null;
    return (_jsxs(_Fragment, { children: [_jsx(ListHeader, { children: title }), items.map(render)] }));
}
function History({ ctx, onPick }) {
    const { t, store, actions } = ctx;
    const queries = store.search.queries;
    const tracks = store.search.tracks;
    if (queries.length === 0 && tracks.length === 0) {
        return _jsx(EmptyState, { icon: "magnifyingglass", title: t('search.emptyTitle'), hint: t('search.emptyHint') });
    }
    return (_jsxs(_Fragment, { children: [queries.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(ListHeader, { trailing: _jsx("button", { type: "button", className: "mu-btn mu-press", onClick: () => actions.confirmClear(t('search.clearConfirm'), () => store.clearQueries()), style: { fontSize: 12, fontWeight: 500, color: C.accent }, children: t('common.clear') }), children: t('search.recentSearches') }), queries.map((row) => (_jsx(SwipeRow, { actionLabel: t('common.delete'), onAction: () => store.removeQuery(row), children: _jsxs("button", { type: "button", className: "mu-btn mu-press", onClick: () => onPick(row), style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: `10px ${SPACE.s4}px` }, children: [_jsx(Icon, { name: "clock.arrow.circlepath", size: 16, color: C.muted }), _jsx("span", { className: "mu-clamp-1", style: { flex: '1 1 auto', fontSize: 15, color: C.ink }, children: row }), _jsx(Icon, { name: "arrow.up.left", size: 12, color: C.muted })] }) }, row)))] })) : null, tracks.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(ListHeader, { trailing: _jsx("button", { type: "button", className: "mu-btn mu-press", onClick: () => actions.confirmClear(t('search.clearConfirm'), () => store.clearSearchTracks()), style: { fontSize: 12, fontWeight: 500, color: C.accent }, children: t('common.clear') }), children: t('search.recentTracks') }), tracks.map((row) => (_jsx(SwipeRow, { actionLabel: t('common.remove'), onAction: () => store.removeSearchTrack(row.key), children: _jsx(SongRow, { track: row.track, onClick: () => actions.playTrack(row.track, tracks.map((item) => item.track)), onLongPress: () => actions.trackMenu(row.track) }) }, row.key)))] })) : null] }));
}
