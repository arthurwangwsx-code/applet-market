// 音乐小应用的静态导航结构：集中维护 Tab 元数据、子页路径/标题与路由渲染。

import React from 'react'
import { CategoryList, CollectionDetail } from './DetailPage.js'
import EffectsPage from './EffectsPage.js'
import LocalLibrary from './LocalLibrary.js'
import SettingsPage from './SettingsPage.js'
import type { MusicAppContext, MusicRoute, MusicTrack, TabID, TabItem, Translate } from '../lib/types.js'

export const TABS: TabItem[] = [
  { id: 'forYou', titleKey: 'tab.forYou', icon: 'sparkles' },
  { id: 'search', titleKey: 'tab.search', icon: 'magnifyingglass' },
  { id: 'player', titleKey: 'tab.player', icon: 'play.circle' },
  { id: 'queue', titleKey: 'tab.queue', icon: 'list.bullet' },
  { id: 'albums', titleKey: 'tab.albums', icon: 'square.stack' },
]

/** mini 播放条只在非 Now Playing tab 出现，且必须有当前曲目。 */
export function showMiniFor(tab: TabID, track: MusicTrack | null): boolean {
  return tab !== 'player' && !!track
}

export function tabTitle(tab: TabID, queueCount: number, t: Translate): string {
  if (tab === 'player') return ''
  if (tab === 'queue') return queueCount > 0 ? t('nav.queueCount', queueCount) : t('tab.queue')
  const row = TABS.find((item) => item.id === tab)
  return row ? t(row.titleKey) : ''
}

/** 子页在 history 里的路径。页面自己不读它，只为宿主诊断与 `navigation.getState().url` 可读。 */
export function routePath(route: MusicRoute): string {
  if (route.name === 'collection')
    return `#/collection/${encodeURIComponent((route.item && route.item.musicItemId) || '')}`
  if (route.name === 'category') return `#/category/${encodeURIComponent(route.id || '')}`
  return `#/${route.name}`
}

export function routeTitle(route: MusicRoute, t: Translate): string {
  switch (route.name) {
    case 'settings':
      return t('settings.title')
    case 'effects':
      return t('effects.title')
    case 'local':
      return t('local.title')
    case 'category':
      return route.title
    case 'collection':
      return route.item.title || route.item.name || ''
    default:
      return ''
  }
}

export function renderRoute(route: MusicRoute, ctx: MusicAppContext): React.ReactNode {
  switch (route.name) {
    case 'settings':
      return <SettingsPage ctx={ctx} />
    case 'effects':
      return <EffectsPage ctx={ctx} />
    case 'local':
      return <LocalLibrary ctx={ctx} />
    case 'category':
      return <CategoryList ctx={ctx} route={route} />
    case 'collection':
      return <CollectionDetail ctx={ctx} item={route.item} />
    default:
      return null
  }
}

export function isTabID(value: string): value is TabID {
  return TABS.some((item) => item.id === value)
}
