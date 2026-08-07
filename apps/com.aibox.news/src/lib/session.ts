// 唯一一份运行时状态（store / aggregator / broadcast），**模块级单例**。
//
// 为什么不放在 React 里：manifest 声明的 4 个 action 是 `headless: true` 的延迟工具，
// AI 会在**没有界面**的无头 WebView 里调它们。数据层挂在组件上就等于「AI 调用时还没装配」。
// 所以状态住在这里，UI 与 action 共用同一份；`whenReady()` 让任何入口都能等到磁盘装载完成。

import { NewsStore } from './store.js'
import { NewsAggregator } from './aggregator.js'
import { BroadcastController } from './broadcast.js'
import type { NewsArticle } from '../types.js'

const store = new NewsStore()
const agg = new NewsAggregator(store)
const broadcast = new BroadcastController(store)

/** 用户此刻在列表上看到的那串文章（lead 序列）；工具栏播报按钮据此建队列。UI 挂载后回填。 */
const session = { store, agg, broadcast, visibleArticles: [] as NewsArticle[] }

let bootPromise: Promise<typeof session> | null = null

/** 幂等启动：装载磁盘数据 + hydrate 时间线快照。UI 与 action 谁先来谁触发。 */
export function whenReady() {
  if (!bootPromise) {
    bootPromise = (async () => {
      await store.load()
      await agg.hydrate()
      return session
    })()
  }
  return bootPromise
}

export function getSession() {
  return session
}
