// 单词详情页（规格 §3）。
//
// 三条最容易做错的载入行为：
//  · 缓存命中的词**根本不调网络也不调 AI** —— 无 TTL、不过期、没有"刷新"，只有手动「重新生成」；
//  · 「重新生成」必须**先拿到完整新结果再覆盖**，失败时旧词条原样保留 + 橙色横幅，绝不变空页；
//  · 骨架屏一次成页，**不做流式拼装**（保排版稳定）。

import { useEffect, useMemo, useState } from 'react'
import { getEntry, recordHistory, removeVocab, replaceEntry, upsertVocab } from '../lib/db.js'
import { LookupError, lookupWord } from '../lib/dict.js'
import { copyText, shareText, speak } from '../lib/host.js'
import { formatEntryText } from '../lib/logic.js'
import { sourceLabel, type T } from '../lib/strings.js'
import type { WordStore } from '../lib/store.js'
import { RADIUS, SPACE, alpha, type Palette } from '../lib/theme.js'
import type { WordLookupPayload } from '../lib/types.js'
import { ChipsFlow, EmptyState, Icon, InfoChip, PrimaryButton, PushPage, SectionHeader } from './primitives.js'
import { pickAction } from './SearchPage.js'

interface Meta {
  isCached: boolean
  source: string | null
}

export function WordDetail(props: {
  palette: Palette
  t: T
  store: WordStore
  word: string
  onBack: () => void
  onOpenWord: (word: string) => void
  onPractice: (sentence: string) => void
  onCompanion: (seed: string | null, entryText: string) => void
  companionAvailable: boolean
}) {
  const { palette, t, store, word } = props
  const [payload, setPayload] = useState<WordLookupPayload | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [error, setError] = useState('')
  const [regenerateError, setRegenerateError] = useState('')
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)

  const saved = useMemo(() => store.vocab.some((item) => item.text === word.trim().toLowerCase()), [store.vocab, word])

  // `task(id: word)` —— 换词即重跑。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setPayload(null)
      setError('')
      setRegenerateError('')
      setMeta(null)

      const cached = await getEntry(word)
      if (cached && cached.payload && Array.isArray(cached.payload.senses)) {
        if (cancelled) return
        await recordHistory(word, cached.brief)
        setPayload(cached.payload)
        setMeta({ isCached: true, source: cached.source })
        setLoading(false)
        store.refresh()
        return
      }
      try {
        const fresh = await lookupWord(word)
        if (cancelled) return
        const entry = await replaceEntry(word, fresh)
        await recordHistory(word, entry.brief)
        setPayload(fresh)
        setMeta({ isCached: false, source: fresh.source })
        store.refresh()
      } catch (caught) {
        if (cancelled) return
        setError(caught instanceof LookupError ? caught.message : String(caught))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // store 每次 refresh 都会换引用，放进依赖会把这条 task 变成死循环。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word])

  const entryText = payload ? formatEntryText(payload) : ''

  const regenerate = async () => {
    if (!payload || regenerating) return
    setRegenerating(true)
    setRegenerateError('')
    try {
      // 先拿到完整新结果，成功后才替换缓存。绝不能先删缓存再请求。
      const fresh = await lookupWord(word)
      await replaceEntry(word, fresh)
      setPayload(fresh)
      setMeta({ isCached: false, source: fresh.source })
      store.refresh()
    } catch (caught) {
      setRegenerateError(caught instanceof LookupError ? caught.message : String(caught))
    } finally {
      setRegenerating(false)
    }
  }

  const toggleSave = async () => {
    if (saved) {
      await removeVocab(word)
    } else {
      // 收藏时把**当前 payload 的首条英文例句**存进 note 作为学习语境。
      await upsertVocab({
        term: word,
        kind: 'word',
        brief: payload ? briefOf(payload) : '',
        note: payload?.examples[0]?.en ?? null,
      })
    }
    store.refresh()
  }

  const menu = async () => {
    const action = await pickAction(props, [
      { id: 'star', title: saved ? t('unfavourite') : t('favourite') },
      ...(payload && !regenerating ? [{ id: 'regen', title: t('regenerate') }] : []),
      ...(entryText
        ? [
            { id: 'copy', title: t('copyEntry') },
            { id: 'share', title: t('share') },
          ]
        : []),
    ])
    if (action === 'star') await toggleSave()
    if (action === 'regen') await regenerate()
    if (action === 'copy') await copyText(entryText)
    if (action === 'share') await shareText(entryText)
  }

  return (
    <PushPage
      palette={palette}
      title={word}
      onBack={props.onBack}
      trailing={
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {props.companionAvailable && payload ? (
            <button
              type="button"
              onClick={() => props.onCompanion(null, entryText)}
              style={{
                border: 'none',
                background: 'transparent',
                color: palette.accent,
                fontSize: 17,
                cursor: 'pointer',
                width: 44,
                height: 44,
              }}
              aria-label={t('companionTitle')}
            >
              <Icon name="sparkles" size={17} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={menu}
            style={{
              border: 'none',
              background: 'transparent',
              color: palette.accent,
              fontSize: 17,
              cursor: 'pointer',
              width: 44,
              height: 44,
            }}
            aria-label="More"
          >
            ⋯
          </button>
        </div>
      }
    >
      <div style={{ padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s5 }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, color: palette.ink }}>{word}</h1>

        {loading ? <Skeleton palette={palette} /> : null}

        {!loading && error ? (
          <div style={{ textAlign: 'center', paddingTop: SPACE.s8 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: palette.ink }}>{t('loadFailed')}</div>
            <div style={{ fontSize: 13, color: palette.muted, margin: `${SPACE.s2}px 0 ${SPACE.s4}px` }}>{error}</div>
            <PrimaryButton palette={palette} title={t('retry')} onClick={() => props.onOpenWord(word)} />
          </div>
        ) : null}

        {payload ? (
          <>
            {regenerateError ? (
              <div style={{ background: alpha(palette.orange, 0.1), borderRadius: RADIUS.field, padding: SPACE.s3 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: palette.orange }}>
                  <Icon name="warning" size={13} /> {t('regenerateFailed')}
                </div>
                <div style={{ fontSize: 12, color: palette.muted, marginTop: 4 }}>{regenerateError}</div>
              </div>
            ) : null}

            {payload.corrected ? (
              <div style={{ fontSize: 14, color: palette.ink }}>
                {t('didYouMean')} <span style={{ fontWeight: 600 }}>“{payload.corrected}”?</span>
              </div>
            ) : null}

            {meta ? (
              <ChipsFlow>
                <InfoChip palette={palette} icon="shield" label={sourceLabel(t, meta.source)} filled />
                <InfoChip
                  palette={palette}
                  icon={meta.isCached ? 'drive' : 'refresh'}
                  label={meta.isCached ? t('cached') : t('justUpdated')}
                  tint={meta.isCached ? undefined : palette.green}
                  filled={!meta.isCached}
                />
              </ChipsFlow>
            ) : null}

            {payload.phoneticUK || payload.phoneticUS || payload.frequency !== null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2 }}>
                {payload.phoneticUK ? (
                  <InfoChip
                    palette={palette}
                    icon="speaker"
                    label={`UK /${payload.phoneticUK}/`}
                    onClick={() => void speak(word, 'uk')}
                  />
                ) : null}
                {payload.phoneticUS ? (
                  <InfoChip
                    palette={palette}
                    icon="speaker"
                    label={`US /${payload.phoneticUS}/`}
                    onClick={() => void speak(word, 'us')}
                  />
                ) : null}
                <div style={{ flex: 1 }} />
                {payload.frequency !== null ? <Frequency palette={palette} value={payload.frequency} /> : null}
              </div>
            ) : null}

            {payload.examTags.length ? (
              <ChipsFlow>
                {payload.examTags.map((tag) => (
                  <InfoChip key={tag} palette={palette} label={tag} />
                ))}
              </ChipsFlow>
            ) : null}

            <section>
              <SectionHeader palette={palette} title={t('sectionSenses')} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {payload.senses.map((sense, index) => (
                  <div key={`${sense.pos}-${index}`} style={{ fontSize: 15, color: palette.ink }}>
                    {sense.pos ? <span style={{ color: palette.accent }}>{sense.pos} </span> : null}
                    {sense.glosses.join('；')}
                  </div>
                ))}
              </div>
            </section>

            {props.companionAvailable ? (
              <section>
                <SectionHeader palette={palette} title={t('sectionCompanion')} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.s2 }}>
                  <Pill
                    palette={palette}
                    icon="quote"
                    label={t('chipSimpler')}
                    onClick={() => props.onCompanion(`Give me a simpler example sentence for "${word}".`, entryText)}
                  />
                  <Pill
                    palette={palette}
                    icon="list"
                    label={t('chipOther')}
                    onClick={() =>
                      props.onCompanion(
                        `Does "${word}" have other common meanings or uses I should know about?`,
                        entryText,
                      )
                    }
                  />
                </div>
              </section>
            ) : null}

            {payload.forms.length ? (
              <section>
                <SectionHeader palette={palette} title={t('sectionForms')} />
                <ChipsFlow>
                  {payload.forms.map((form) => (
                    <InfoChip
                      key={`${form.label}-${form.value}`}
                      palette={palette}
                      label={`${form.label} ${form.value}`}
                      onClick={() => props.onOpenWord(form.value)}
                    />
                  ))}
                </ChipsFlow>
              </section>
            ) : null}

            {payload.examples.length ? (
              <section>
                <SectionHeader palette={palette} title={t('sectionExamples')} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s3 }}>
                  {payload.examples.map((example, index) => (
                    <div
                      key={`${example.en}-${index}`}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: SPACE.s2 }}
                    >
                      <button
                        type="button"
                        onClick={() => void speak(example.en, 'us')}
                        style={{
                          flex: 1,
                          border: 'none',
                          background: 'transparent',
                          padding: 0,
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 14, color: palette.ink }}>{example.en}</div>
                        {example.zh ? (
                          <div style={{ fontSize: 13, color: palette.muted, marginTop: 2 }}>{example.zh}</div>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        onClick={() => props.onPractice(example.en)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: palette.accent,
                          cursor: 'pointer',
                          padding: 4,
                        }}
                        aria-label={t('practiceTitle')}
                      >
                        <Icon name="mic" size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {payload.memoryTip ? (
              <section>
                <SectionHeader palette={palette} title={t('sectionMemoryTip')} />
                <div
                  style={{
                    background: palette.surface,
                    borderRadius: RADIUS.card,
                    padding: SPACE.s3,
                    fontSize: 14,
                    color: palette.ink,
                  }}
                >
                  {payload.memoryTip}
                </div>
              </section>
            ) : null}

            {payload.synonyms.length || payload.antonyms.length ? (
              <section>
                <SectionHeader palette={palette} title={t('sectionRelated')} />
                <ChipsFlow>
                  {payload.synonyms.map((item) => (
                    <InfoChip
                      key={`syn-${item}`}
                      palette={palette}
                      label={item}
                      filled
                      onClick={() => props.onOpenWord(item)}
                    />
                  ))}
                  {payload.antonyms.map((item) => (
                    <InfoChip
                      key={`ant-${item}`}
                      palette={palette}
                      label={item}
                      tint={palette.red}
                      filled
                      onClick={() => props.onOpenWord(item)}
                    />
                  ))}
                </ChipsFlow>
              </section>
            ) : null}
          </>
        ) : null}

        {!loading && !payload && !error ? (
          <EmptyState palette={palette} icon="magnifyingglass" text={t('emptySearchHint')} />
        ) : null}
      </div>
    </PushPage>
  )
}

function briefOf(payload: WordLookupPayload): string {
  const sense = payload.senses[0]
  if (!sense) return ''
  return [sense.pos, sense.glosses[0] ?? ''].filter(Boolean).join(' ').trim()
}

/** 常用度：5 个 6pt 圆点，`i <= clamp(frequency, 0, 5)` 实心。 */
function Frequency({ palette, value }: { palette: Palette; value: number }) {
  const level = Math.min(5, Math.max(0, Math.round(value)))
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1, 2, 3, 4, 5].map((index) => (
        <span
          key={index}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            display: 'inline-block',
            background: index <= level ? palette.accent : 'transparent',
            border: index <= level ? 'none' : `1px solid ${palette.line}`,
          }}
        />
      ))}
    </div>
  )
}

function Pill(props: { palette: Palette; icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: 'none',
        borderRadius: RADIUS.pill,
        padding: '8px 12px',
        fontSize: 13,
        fontWeight: 500,
        color: props.palette.accent,
        background: alpha(props.palette.accent, 0.1),
        cursor: 'pointer',
      }}
    >
      <Icon name={props.icon} size={12} /> {props.label}
    </button>
  )
}

/** 骨架屏：4 个 surface 圆角块，整体降低不透明度。一次成页。 */
function Skeleton({ palette }: { palette: Palette }) {
  const block = (width: number | string, height: number) => (
    <div style={{ width, height, borderRadius: 8, background: palette.surface }} />
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s3, opacity: 0.55 }}>
      {block(160, 28)}
      {block(220, 16)}
      {block('100%', 16)}
      {block('100%', 80)}
    </div>
  )
}
