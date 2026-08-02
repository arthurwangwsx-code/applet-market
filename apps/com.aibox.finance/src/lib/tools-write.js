// 4 个**写型** `finance_*` 工具（规格 §13.4）：自选 / 交易 / 账户 / 提醒。
//
// 独立成文件不是为了好看：写型工具是唯一会改动用户账目与自选的入口，
// 集中在一处才能一眼复核「解析纪律」是否都做到了——
// 账户名对不上返回候选、标的多条命中返回候选、失败一律返回可判定的错误码而不是抛。

import { toMinor } from './money.js'

/** `deps` = { store, ledger, quotes, alerts }；`helpers` = { account, resolveInstrument, quoteJSON }。 */
export function createWriteHandlers(deps, helpers) {
  const { store, ledger, quotes, alerts } = deps
  const { account, resolveInstrument, quoteJSON } = helpers

  return {
    async finance_watch(args = {}) {
      const action = args.action || 'list'
      if (action === 'list') {
        const symbols = store.items.map((row) => row.instrumentSymbol)
        if (symbols.length > 0) await quotes.refresh(symbols, { force: false })
        return {
          ok: true,
          items: store.items.map((row) => ({
            symbol: row.instrumentSymbol,
            name: store.instrumentName(row.instrumentSymbol),
            group: (store.groups.find((g) => g.id === row.groupID) || {}).name || null,
            quote: quoteJSON(quotes.quote(row.instrumentSymbol), row.instrumentSymbol),
          })),
          groups: store.groups.map((row) => row.name),
        }
      }
      if (action === 'create_group') return store.createGroup(String(args.group || '').trim())
      if (action === 'delete_group') {
        const group = store.groups.find((row) => row.name === args.group)
        if (!group) return { ok: false, error: `No group named "${args.group}".`, groups: store.groups.map((row) => row.name) }
        return store.deleteGroup(group.id)
      }
      const resolved = await resolveInstrument(args.symbol, { strict: true })
      if (!resolved.ok) return resolved
      if (action === 'add') return store.addWatch(resolved.canonical, { name: resolved.name })
      if (action === 'remove') return store.removeWatch(resolved.canonical)
      if (action === 'move') {
        const group = store.groups.find((row) => row.name === args.group)
        if (!group) return { ok: false, error: `No group named "${args.group}".`, groups: store.groups.map((row) => row.name) }
        return store.moveWatch(resolved.canonical, group.id)
      }
      return { ok: false, error: `Unknown action "${action}".` }
    },
    async finance_trade(args = {}) {
      const side = args.action
      if (side !== 'buy' && side !== 'sell') return { ok: false, error: 'action must be buy or sell.' }
      const resolvedAccount = account(args.account)
      if (!resolvedAccount.ok) return resolvedAccount
      const resolved = await resolveInstrument(args.symbol, { strict: true })
      if (!resolved.ok) return resolved

      await quotes.refresh([resolved.canonical], { force: false })
      await quotes.exchangeRates({ force: false })
      const quote = quotes.quote(resolved.canonical)
      const price = Number(args.price) > 0 ? Number(args.price) : (quote ? quote.price : null)
      if (!(price > 0)) return { ok: false, error: 'No price given and no quote available.' }

      const instrumentCurrency = quote ? quote.currency : 'CNY'
      const rate = ledger.fxRateFor(instrumentCurrency, resolvedAccount.account.currency, quotes.fx)
      if (!rate) {
        return { ok: false, error: `No ${instrumentCurrency}→${resolvedAccount.account.currency} exchange rate is available; the trade was not recorded.` }
      }
      const payload = {
        accountID: resolvedAccount.account.id,
        symbol: resolved.canonical,
        name: (quote && quote.name) || resolved.name || resolved.canonical,
        market: resolved.symbol.market,
        currency: instrumentCurrency,
        quantity: Number(args.quantity),
        price,
        fxRate: rate,
        feeMinor: Math.max(0, toMinor(Number(args.fee) || 0)),
        source: 'ai',
      }
      const result = side === 'buy' ? await ledger.buy(payload) : await ledger.sell(payload)
      if (!result.ok) return result
      return {
        ok: true,
        side,
        symbol: resolved.canonical,
        quantity: payload.quantity,
        price,
        currency: instrumentCurrency,
        fxRate: rate,
        account: resolvedAccount.account.name,
        note: 'Simulated only — no real order was placed.',
      }
    },
    async finance_account(args = {}) {
      const action = args.action || 'list'
      if (action === 'list') {
        return {
          ok: true,
          accounts: ledger.accounts
            .filter((row) => args.include_archived || !row.isArchived)
            .map((row) => ({
              name: row.name, currency: row.currency, cashMinor: row.cashMinor,
              initialCashMinor: row.initialCashMinor, isArchived: row.isArchived, isRealCopy: row.isRealCopy,
            })),
        }
      }
      if (action === 'create') {
        return ledger.createAccount({
          name: args.name,
          currency: args.currency || 'CNY',
          initialCashMinor: toMinor(Number(args.initial_cash) > 0 ? Number(args.initial_cash) : 1000000),
          note: args.note,
          isRealCopy: !!args.is_real_copy,
        })
      }
      if (action === 'copy') {
        const source = account(args.from_account || args.name)
        if (!source.ok) return source
        return ledger.copyAccount(source.account.id, args.name)
      }
      const resolved = account(args.name)
      if (!resolved.ok) return resolved
      if (action === 'rename') return ledger.updateAccount(resolved.account.id, { name: String(args.name || '').trim() })
      if (action === 'update') return ledger.updateAccount(resolved.account.id, { note: args.note, isRealCopy: !!args.is_real_copy })
      if (action === 'reset') return ledger.resetAccount(resolved.account.id)
      if (action === 'archive') return ledger.updateAccount(resolved.account.id, { isArchived: true })
      if (action === 'unarchive') return ledger.updateAccount(resolved.account.id, { isArchived: false })
      if (action === 'delete') return ledger.deleteAccount(resolved.account.id)
      if (action === 'cashflow') {
        const amount = Number(args.amount)
        if (!(amount > 0)) return { ok: false, error: 'amount must be > 0.' }
        return ledger.addCashFlow({
          accountID: resolved.account.id,
          kind: args.cashflow_type || 'deposit',
          amountMinor: toMinor(amount),
          note: args.note,
          source: 'ai',
        })
      }
      return { ok: false, error: `Unknown action "${action}".` }
    },
    async finance_alert(args = {}) {
      const action = args.action || 'list'
      if (action === 'list') {
        return {
          ok: true,
          alerts: alerts.all().map((row) => ({
            symbol: row.instrumentSymbol, name: row.name, condition: row.conditionRaw,
            target: row.targetPrice, enabled: row.enabled, note: row.note,
          })),
          note: 'Alerts fire while quotes refresh with the app open; there is no background monitoring in this container.',
        }
      }
      const resolved = await resolveInstrument(args.symbol, { strict: true })
      if (!resolved.ok) return resolved
      if (action === 'set') {
        return alerts.set({
          symbol: resolved.canonical,
          name: resolved.name || store.instrumentName(resolved.canonical),
          condition: args.condition || 'above',
          targetPrice: Number(args.price),
          note: args.note,
        })
      }
      const rows = alerts.forSymbol(resolved.canonical)
        .filter((row) => !args.condition || row.conditionRaw === args.condition)
      if (rows.length === 0) return { ok: false, error: 'No matching alert.' }
      for (const row of rows) {
        if (action === 'remove') await alerts.remove(row.id)
        else if (action === 'enable') await alerts.setEnabled(row.id, true)
        else if (action === 'disable') await alerts.setEnabled(row.id, false)
      }
      return { ok: true, affected: rows.length }
    },
  }
}
