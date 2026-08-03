// 搜索页（默认落地，规格 §2）—— **默认落地页是中间那个 Tab，不是第一个**。
//
// 两个必须守住的行为：
//  · 联想行点击**永远走查词**，不做句子判定；
//  · 回车 / 兜底「查询」行才过意图判定；「作为句子翻译」永远无条件走翻译。

import { useEffect, useMemo, useState } from 'react'
import { clearHistory, clearTranslations, getDaily, removeHistory, saveDaily, upsertVocab } from '../lib/db'
import { generateDaily } from '../lib/dict'
import { confirm, copyText, speak } from '../lib/host'
import { dateKeyOf, dueCount, resolveIntent, suggest } from '../lib/logic'
import { seedSentence } from '../lib/seed'
import { dueBanner, type Lang, type T } from '../lib/strings'
import type { WordStore } from '../lib/store'
import { SPACE, alpha, type Palette } from '../lib/theme'
import type { DailySentence } from '../lib/types'
import { ChipsFlow, DueBanner, EmptyState, Icon, InfoChip, Row, SectionHeader } from './primitives'

export function SearchPage(props: {
  palette: Palette
  t: T
  lang: Lang
  store: WordStore
  query: string
  onOpenWord: (word: string) => void
  onOpenTranslation: (id: string) => void
  onTranslateSentence: (text: string) => void
  onOpenReview: () => void
  aiAvailable: boolean
}) {
  const { palette, t, store } = props
  const [daily, setDaily] = useState<DailySentence | null>(null)
  const [expandHistory, setExpandHistory] = useState(false)
  const [expandTranslations, setExpandTranslations] = useState(false)

  const trimmed = props.query.trim()
  const due = useMemo(() => dueCount(store.vocab), [store.vocab])

  // 每日一句三级降级：缓存 → AI → 内置种子（静默兜底，不报错）。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const dateKey = dateKeyOf()
      const cached = await getDaily(dateKey)
      if (cached) {
        if (!cancelled) setDaily(cached)
        return
      }
      const generated = props.aiAvailable ? await generateDaily(dateKey) : null
      const value: DailySentence = { dateKey, ...(generated ?? seedSentence(dateKey)) }
      if (generated) await saveDaily(value)
      if (!cancelled) setDaily(value)
    })()
    return () => { cancelled = true }
  }, [props.aiAvailable])

  const suggestions = useMemo(
    () => suggest({ prefix: trimmed, history: store.history, vocab: store.vocab, cachedWords: store.cachedWords }),
    [trimmed, store.history, store.vocab, store.cachedWords],
  )

  if (trimmed) {
    return (
      <div>
        {suggestions.map((item) => (
          <Row
            key={item.term}
            palette={palette}
            title={item.term}
            subtitle={item.brief || undefined}
            // 点联想行永远走查词，不做句子判定。
            onClick={() => props.onOpenWord(item.term)}
            trailing={item.isCached ? <InfoChip palette={palette} label={t('cached')} tint={palette.green} filled /> : undefined}
          />
        ))}
        <Row
          palette={palette}
          title={
            <span>
              <Icon name="sparkles" size={13} color={palette.accent} />{' '}
              {t('lookupAction')} <span style={{ fontWeight: 600 }}>“{trimmed}”</span>
            </span>
          }
          onClick={() => {
            // 兜底行 A 走意图分流。
            if (resolveIntent(trimmed) === 'translate') props.onTranslateSentence(trimmed)
            else props.onOpenWord(trimmed)
          }}
        />
        <Row
          palette={palette}
          title={
            <span>
              <Icon name="globe" size={13} color={palette.accent} /> {t('translateAsSentence')}
            </span>
          }
          // 兜底行 B **无条件**切到翻译。
          onClick={() => props.onTranslateSentence(trimmed)}
        />
      </div>
    )
  }

  const historyRows = expandHistory ? store.history : store.history.slice(0, 5)
  const translationRows = expandTranslations ? store.translations : store.translations.slice(0, 5)
  const bothEmpty = store.history.length === 0 && store.translations.length === 0

  return (
    <div style={{ paddingBottom: SPACE.s6 }}>
      {due > 0 ? (
        <div style={{ padding: `${SPACE.s3}px ${SPACE.s4}px 0` }}>
          <DueBanner palette={palette} text={dueBanner(t, props.lang, due)} onClick={props.onOpenReview} />
        </div>
      ) : null}

      {daily && daily.en ? (
        <div style={{ padding: `${SPACE.s4}px ${SPACE.s4}px 4px` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s2 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: palette.accent, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {t('dailyHeader')}
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: palette.ink }}>{daily.en}</div>
            {daily.zh ? (
              <div style={{ fontSize: 13, color: palette.muted }}>{`“${daily.zh}” — ${daily.author}`}</div>
            ) : null}
            <div style={{ display: 'flex', gap: SPACE.s2, marginTop: 2 }}>
              <InfoChip palette={palette} icon="speaker" label={t('speakNormal')} onClick={() => void speak(daily.en, 'us', 'normal')} />
              <InfoChip palette={palette} icon="tortoise" label={t('speakSlow')} onClick={() => void speak(daily.en, 'us', 'slow')} />
            </div>
          </div>
        </div>
      ) : null}

      {bothEmpty ? <EmptyState palette={palette} icon="magnifyingglass" text={t('emptySearchHint')} /> : null}

      {store.history.length > 0 ? (
        <section style={{ marginTop: SPACE.s5 }}>
          <div style={{ padding: `0 ${SPACE.s4}px` }}>
            <SectionHeader
              palette={palette}
              title={t('recentLookups')}
              trailing={
                <button
                  type="button"
                  style={{ border: 'none', background: 'transparent', color: palette.accent, fontSize: 11, cursor: 'pointer' }}
                  onClick={async () => {
                    const ok = await confirm({
                      title: t('clearHistoryTitle'),
                      confirmTitle: t('clear'),
                      cancelTitle: t('cancel'),
                      destructive: true,
                    })
                    if (!ok) return
                    await clearHistory()
                    store.refresh()
                  }}
                >
                  {t('clear')}
                </button>
              }
            />
          </div>
          {historyRows.map((item) => (
            <Row
              key={item.term}
              palette={palette}
              title={item.term}
              subtitle={item.brief || undefined}
              onClick={() => props.onOpenWord(item.term)}
              onLongPress={async () => {
                const action = await pickAction(props, [
                  { id: 'copy', title: t('copy') },
                  { id: 'save', title: t('addToVocab') },
                  { id: 'delete', title: t('delete'), destructive: true },
                ])
                if (action === 'copy') await copyText(item.term)
                if (action === 'save') {
                  await upsertVocab({ term: item.term, brief: item.brief })
                  store.refresh()
                }
                if (action === 'delete') {
                  await removeHistory(item.term)
                  store.refresh()
                }
              }}
            />
          ))}
          {store.history.length > 5 ? (
            <button
              type="button"
              onClick={() => setExpandHistory((value) => !value)}
              style={expandStyle(palette)}
            >
              {expandHistory ? t('collapse') : t('expandAll')} <Icon name={expandHistory ? 'chevron.up' : 'chevron.down'} size={11} />
            </button>
          ) : null}
        </section>
      ) : null}

      {store.translations.length > 0 ? (
        <section style={{ marginTop: SPACE.s5 }}>
          <div style={{ padding: `0 ${SPACE.s4}px` }}>
            <SectionHeader
              palette={palette}
              title={t('translationHistory')}
              trailing={
                <button
                  type="button"
                  style={{ border: 'none', background: 'transparent', color: palette.accent, fontSize: 11, cursor: 'pointer' }}
                  onClick={async () => {
                    const ok = await confirm({
                      title: t('clearTranslationsTitle'),
                      confirmTitle: t('clear'),
                      cancelTitle: t('cancel'),
                      destructive: true,
                    })
                    if (!ok) return
                    await clearTranslations()
                    store.refresh()
                  }}
                >
                  {t('clear')}
                </button>
              }
            />
          </div>
          {translationRows.map((record) => (
            <Row
              key={record.id}
              palette={palette}
              title={<span style={{ fontSize: 14 }}>{record.source}</span>}
              subtitle={record.target}
              onClick={() => props.onOpenTranslation(record.id)}
              trailing={record.starred ? <Icon name="star.fill" size={11} color={palette.accent} /> : undefined}
            />
          ))}
          {store.translations.length > 5 ? (
            <button
              type="button"
              onClick={() => setExpandTranslations((value) => !value)}
              style={expandStyle(palette)}
            >
              {expandTranslations ? t('collapse') : t('expandAll')}{' '}
              <Icon name={expandTranslations ? 'chevron.up' : 'chevron.down'} size={11} />
            </button>
          ) : null}
        </section>
      ) : null}

      <ChipsFlow>{null}</ChipsFlow>
    </div>
  )
}

function expandStyle(palette: Palette) {
  return {
    display: 'block', width: '100%', textAlign: 'left' as const, border: 'none',
    background: 'transparent', color: palette.accent, fontSize: 13,
    padding: `10px ${SPACE.s4}px`, cursor: 'pointer',
    borderBottom: `1px solid ${alpha(palette.line, 1)}`,
  }
}

/** 长按菜单 —— 原生是 contextMenu，这里用系统 actionSheet（同样是原生控件）。 */
async function pickAction(
  props: { palette: Palette },
  actions: { id: string; title: string; destructive?: boolean }[],
): Promise<string | null> {
  void props
  const bridge = typeof window !== 'undefined' ? window.aibox : undefined
  if (!bridge?.ui) return null
  try {
    const result = await bridge.ui.actionSheet({
      actions: actions.map((action) => ({
        id: action.id,
        title: action.title,
        role: action.destructive ? 'destructive' : 'default',
      })),
    })
    return result.cancelled ? null : result.actionId
  } catch {
    return null
  }
}

export { pickAction }
