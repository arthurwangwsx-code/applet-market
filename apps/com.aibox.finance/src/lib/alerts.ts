// 到价提醒（规格 §9.3 FinPriceAlert + §14.2）。
//
// **诚实降级**：容器有 `aibox.notifications.schedule`，但**没有后台唤醒**。
// 所以照原生的做法——**前台刷新时检查并推送**，UI 文案如实说明「App 活跃时生效」，
// 不假装能后台盯盘。触发判定 `shouldFire` 是纯函数，容器日后补了后台能力可直接复用。

import { storage } from './host.js'
import { KEYS, newID } from './store.js'
import type { FinanceStore } from './store.js'
import type { AlertCondition, PriceAlert, Quote, QuoteMap } from './types.js'

/** 命中后 4 小时冷却，防同一条提醒反复推。 */
export const COOLDOWN_MS = 4 * 3600 * 1000

export const CONDITIONS: AlertCondition[] = ['above', 'below', 'up_pct', 'down_pct']

export function isPercentCondition(condition: AlertCondition): boolean {
  return condition === 'up_pct' || condition === 'down_pct'
}

export function isUpwardCondition(condition: AlertCondition): boolean {
  return condition === 'above' || condition === 'up_pct'
}

/**
 * 纯判定：给一条提醒与一份行情，判断此刻是否该推。
 * 百分比档比的是 `changePct`，价格档比的是 `price`。
 */
export function shouldFire(
  alert: PriceAlert | null | undefined,
  quote: Quote | null | undefined,
  now: number,
): boolean {
  if (!alert || !alert.enabled || !quote) return false
  if (alert.lastFiredAt && now - alert.lastFiredAt < COOLDOWN_MS) return false
  const target = Number(alert.targetPrice)
  if (!Number.isFinite(target)) return false
  const value = isPercentCondition(alert.conditionRaw) ? Number(quote.changePct) : Number(quote.price)
  if (!Number.isFinite(value)) return false
  return isUpwardCondition(alert.conditionRaw) ? value >= target : value <= target
}

export class AlertStore {
  store: FinanceStore

  constructor(store: FinanceStore) {
    this.store = store
  }

  all(): PriceAlert[] {
    return this.store.alerts
  }

  forSymbol(canonical: string): PriceAlert[] {
    return this.store.alerts.filter((row) => row.instrumentSymbol === canonical)
  }

  async persist(): Promise<boolean> {
    const ok = await storage.set(KEYS.alerts, this.store.alerts)
    this.store.storageHealthy = ok
    this.store.bump()
    return ok
  }

  /**
   * 去重规则（§9.3）：同 symbol + 同 condition 已存在 → 改阈值/备注 + 重新启用 +
   * **清空 `lastFiredAt`**（让新阈值能再次触发），不新建。
   */
  async set({
    symbol,
    name,
    condition,
    targetPrice,
    note,
  }: {
    symbol: string
    name?: string
    condition: string
    targetPrice: number
    note?: string
  }) {
    if (!isAlertCondition(condition)) return { ok: false, error: 'invalidCondition' }
    if (!Number.isFinite(targetPrice)) return { ok: false, error: 'invalidTarget' }
    const existing = this.store.alerts.find((row) => row.instrumentSymbol === symbol && row.conditionRaw === condition)
    if (existing) {
      this.store.alerts = this.store.alerts.map((row) =>
        row === existing
          ? {
              ...row,
              targetPrice,
              note: note || '',
              enabled: true,
              lastFiredAt: null,
            }
          : row,
      )
    } else {
      this.store.alerts = [
        ...this.store.alerts,
        {
          id: newID('al'),
          instrumentSymbol: symbol,
          name: name || symbol,
          conditionRaw: condition,
          targetPrice,
          enabled: true,
          note: note || '',
          createdAt: Date.now(),
          lastFiredAt: null,
        },
      ]
    }
    const ok = await this.persist()
    return ok ? { ok: true } : { ok: false, error: 'storageUnavailable' }
  }

  async remove(id: string) {
    this.store.alerts = this.store.alerts.filter((row) => row.id !== id)
    const ok = await this.persist()
    return ok ? { ok: true } : { ok: false, error: 'storageUnavailable' }
  }

  async setEnabled(id: string, enabled: boolean) {
    this.store.alerts = this.store.alerts.map((row) => (row.id === id ? { ...row, enabled } : row))
    const ok = await this.persist()
    return ok ? { ok: true } : { ok: false, error: 'storageUnavailable' }
  }

  /**
   * 每轮刷新后调用：找出命中的提醒，标记 lastFiredAt 并返回待推送列表。
   * **不在这里发通知**——发送交给调用方（页面），便于在没有通知权限时降级成 App 内提示条。
   */
  async check(
    quotes: QuoteMap | null | undefined,
    now = Date.now(),
  ): Promise<Array<{ alert: PriceAlert; quote: Quote }>> {
    const fired: Array<{ alert: PriceAlert; quote: Quote }> = []
    let changed = false
    this.store.alerts = this.store.alerts.map((row) => {
      const quote = quotes ? quotes[row.instrumentSymbol] : null
      if (!quote || !shouldFire(row, quote, now)) return row
      fired.push({ alert: row, quote })
      changed = true
      return { ...row, lastFiredAt: now }
    })
    if (changed) await this.persist()
    return fired
  }
}

function isAlertCondition(value: string): value is AlertCondition {
  return CONDITIONS.some((condition) => condition === value)
}
