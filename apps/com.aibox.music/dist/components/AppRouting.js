import { jsx as _jsx } from "react/jsx-runtime";
import { CategoryList, CollectionDetail } from './DetailPage.js';
import EffectsPage from './EffectsPage.js';
import LocalLibrary from './LocalLibrary.js';
import SettingsPage from './SettingsPage.js';
export const TABS = [
    { id: 'forYou', titleKey: 'tab.forYou', icon: 'sparkles' },
    { id: 'search', titleKey: 'tab.search', icon: 'magnifyingglass' },
    { id: 'player', titleKey: 'tab.player', icon: 'play.circle' },
    { id: 'queue', titleKey: 'tab.queue', icon: 'list.bullet' },
    { id: 'albums', titleKey: 'tab.albums', icon: 'square.stack' },
];
/** mini 播放条只在非 Now Playing tab 出现，且必须有当前曲目。 */
export function showMiniFor(tab, track) {
    return tab !== 'player' && !!track;
}
export function tabTitle(tab, queueCount, t) {
    if (tab === 'player')
        return '';
    if (tab === 'queue')
        return queueCount > 0 ? t('nav.queueCount', queueCount) : t('tab.queue');
    const row = TABS.find((item) => item.id === tab);
    return row ? t(row.titleKey) : '';
}
/** 子页在 history 里的路径。页面自己不读它，只为宿主诊断与 `navigation.getState().url` 可读。 */
export function routePath(route) {
    if (route.name === 'collection')
        return `#/collection/${encodeURIComponent((route.item && route.item.musicItemId) || '')}`;
    if (route.name === 'category')
        return `#/category/${encodeURIComponent(route.id || '')}`;
    return `#/${route.name}`;
}
export function routeTitle(route, t) {
    switch (route.name) {
        case 'settings':
            return t('settings.title');
        case 'effects':
            return t('effects.title');
        case 'local':
            return t('local.title');
        case 'category':
            return route.title;
        case 'collection':
            return route.item.title || route.item.name || '';
        default:
            return '';
    }
}
export function renderRoute(route, ctx) {
    switch (route.name) {
        case 'settings':
            return _jsx(SettingsPage, { ctx: ctx });
        case 'effects':
            return _jsx(EffectsPage, { ctx: ctx });
        case 'local':
            return _jsx(LocalLibrary, { ctx: ctx });
        case 'category':
            return _jsx(CategoryList, { ctx: ctx, route: route });
        case 'collection':
            return _jsx(CollectionDetail, { ctx: ctx, item: route.item });
        default:
            return null;
    }
}
export function isTabID(value) {
    return TABS.some((item) => item.id === value);
}
