// 生词本页（规格 §6）。
// 三种排序的**分组形态不同**：添加时间按 `yyyy-MM` 分组（组 key 倒序），字母顺序与复习紧急度是单一段。
// 复习紧急度里**从未复习过（null）视为最紧急排最前**。

import { useMemo, useState } from 'react'
import { removeVocab, upsertVocab } from '../lib/db'
import { speak } from '../lib/host'
import { dueCount } from '../lib/logic'
import { dueBanner, type Lang, type T } from '../lib/strings'
import type { WordStore } from '../lib/store'
import { SPACE, type Palette } from '../lib/theme'
import type { VocabItem } from '../lib/types'
import { DueBanner, EmptyState, Icon, InfoChip, Row, SpeakButton } from './primitives'
import { pickAction } from './SearchPage'

type Filter = 'all' | 'word' | 'sentence' | 'mastered' | 'unmastered'
type Sort = 'added' | 'alpha' | 'urgency'

export function VocabPage(props: {
  palette: Palette
  t: T
  lang: Lang
  store: WordStore
  query: string
  onOpenWord: (word: string) => void
  onOpenReview: () => void
}) {
  const { palette, t, store } = props
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('added')
  const [tag, setTag] = useState<string | null>(null)

  const due = useMemo(() => dueCount(store.vocab), [store.vocab])

  /** 考纲标签是**现算**的：只有 `kind === 'word'` 且缓存里有词条时才有标签。 */
  const tagsOf = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const item of store.vocab) {
      if (item.kind !== 'word') continue
      const entry = store.entryOf(item.text)
      if (entry?.examTags.length) map.set(item.text, entry.examTags)
    }
    return map
  }, [store.vocab, store.entryOf])

  const filtered = useMemo(() => {
    const query = props.query.trim().toLowerCase()
    let rows = store.vocab.filter((item) => matchesFilter(item, filter))
    if (query) {
      rows = rows.filter((item) => item.text.includes(query) || (item.brief ?? '').toLowerCase().includes(query))
    }
    if (tag) rows = rows.filter((item) => (tagsOf.get(item.text) ?? []).includes(tag))
    return rows
  }, [store.vocab, filter, props.query, tag, tagsOf])

  const availableTags = useMemo(() => {
    const set = new Set<string>()
    for (const item of filtered) for (const value of tagsOf.get(item.text) ?? []) set.add(value)
    return [...set].sort()
  }, [filtered, tagsOf])

  const groups = useMemo(() => buildGroups(filtered, sort), [filtered, sort])

  return (
    <div style={{ paddingBottom: SPACE.s6 }}>
      <div style={{ display: 'flex', gap: SPACE.s2, padding: `${SPACE.s3}px ${SPACE.s4}px`, flexWrap: 'wrap' }}>
        <InfoChip
          palette={palette}
          icon="list"
          label={`${t('filterVocab')}: ${filterLabel(t, filter)}`}
          filled={filter !== 'all'}
          onClick={async () => {
            const picked = await pickAction(props, [
              { id: 'all', title: t('filterAll') },
              { id: 'word', title: t('filterWord') },
              { id: 'sentence', title: t('filterSentence') },
              { id: 'mastered', title: t('filterMastered') },
              { id: 'unmastered', title: t('filterUnmastered') },
            ])
            if (picked) setFilter(picked as Filter)
          }}
        />
        <InfoChip
          palette={palette}
          icon="cards"
          label={`${t('sortBy')}: ${sortLabel(t, sort)}`}
          filled={sort !== 'added'}
          onClick={async () => {
            const picked = await pickAction(props, [
              { id: 'added', title: t('sortAdded') },
              { id: 'alpha', title: t('sortAlpha') },
              { id: 'urgency', title: t('sortUrgency') },
            ])
            if (picked) setSort(picked as Sort)
          }}
        />
        {/* 考纲标签 picker **只在当前结果里存在标签时才出现**。 */}
        {availableTags.length ? (
          <InfoChip
            palette={palette}
            label={`${t('examTag')}: ${tag ?? t('allTags')}`}
            filled={tag !== null}
            onClick={async () => {
              const picked = await pickAction(props, [
                { id: '__all', title: t('allTags') },
                ...availableTags.map((value) => ({ id: value, title: value })),
              ])
              if (picked) setTag(picked === '__all' ? null : picked)
            }}
          />
        ) : null}
      </div>

      {due > 0 ? (
        <div style={{ padding: `0 ${SPACE.s4}px ${SPACE.s3}px` }}>
          <DueBanner palette={palette} text={dueBanner(t, props.lang, due)} onClick={props.onOpenReview} />
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState palette={palette} icon="star" text={t('vocabEmpty')} />
      ) : (
        <>
          <div style={{ padding: `0 ${SPACE.s4}px 6px`, fontSize: 12, color: palette.muted }}>
            {t('vocabCount', { n: filtered.length })}
          </div>
          {groups.map((group) => (
            <section key={group.key}>
              {group.key ? (
                <div style={{ padding: `${SPACE.s3}px ${SPACE.s4}px 4px`, fontSize: 12, color: palette.muted }}>{group.key}</div>
              ) : null}
              {group.items.map((item) => (
                <Row
                  key={item.text}
                  palette={palette}
                  title={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {item.text}
                      {item.masteredAt ? <Icon name="checkmark.seal" size={12} color={palette.green} /> : null}
                    </span>
                  }
                  subtitle={item.brief || undefined}
                  onClick={() => props.onOpenWord(item.text)}
                  trailing={<SpeakButton palette={palette} onClick={() => void speak(item.text, 'us')} />}
                  onLongPress={async () => {
                    const action = await pickAction(props, [
                      { id: 'master', title: item.masteredAt ? t('unmarkMastered') : t('markMastered') },
                      { id: 'delete', title: t('delete'), destructive: true },
                    ])
                    if (action === 'master') {
                      await upsertVocab({ term: item.text, mastered: item.masteredAt === null })
                      store.refresh()
                    }
                    if (action === 'delete') {
                      await removeVocab(item.text)
                      store.refresh()
                    }
                  }}
                />
              ))}
            </section>
          ))}
        </>
      )}
    </div>
  )
}

function matchesFilter(item: VocabItem, filter: Filter): boolean {
  switch (filter) {
    case 'word': return item.kind === 'word'
    case 'sentence': return item.kind === 'sentence'
    case 'mastered': return item.masteredAt !== null
    case 'unmastered': return item.masteredAt === null
    default: return true
  }
}

function filterLabel(t: T, filter: Filter): string {
  const map: Record<Filter, Parameters<T>[0]> = {
    all: 'filterAll', word: 'filterWord', sentence: 'filterSentence',
    mastered: 'filterMastered', unmastered: 'filterUnmastered',
  }
  return t(map[filter])
}

function sortLabel(t: T, sort: Sort): string {
  const map: Record<Sort, Parameters<T>[0]> = { added: 'sortAdded', alpha: 'sortAlpha', urgency: 'sortUrgency' }
  return t(map[sort])
}

function buildGroups(items: VocabItem[], sort: Sort): { key: string; items: VocabItem[] }[] {
  if (sort === 'alpha') {
    return [{ key: '', items: [...items].sort((a, b) => a.text.localeCompare(b.text, undefined, { sensitivity: 'base' })) }]
  }
  if (sort === 'urgency') {
    // 从未复习过（null）视为最紧急排最前。
    return [{ key: '', items: [...items].sort((a, b) => (a.nextReviewAt ?? -Infinity) - (b.nextReviewAt ?? -Infinity)) }]
  }
  const buckets = new Map<string, VocabItem[]>()
  for (const item of [...items].sort((a, b) => b.addedAt - a.addedAt)) {
    const date = new Date(item.addedAt)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const bucket = buckets.get(key)
    if (bucket) bucket.push(item)
    else buckets.set(key, [item])
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, group]) => ({ key, items: group }))
}
