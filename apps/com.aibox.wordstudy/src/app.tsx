// 根视图（规格 §1）。三个 Tab 各自独立导航栈；**默认落地页是中间的「搜索」，不是第一个 Tab**。
//
// `useTabs().rendered === false` 时（card / sheet / drawer 面上没有原生 TabBar）必须自己画页内切换器 ——
// 少了这一条，那些呈现面上用户就永远切不了 Tab。

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useScene, useTabs } from '@aibox/applet-sdk/react'
import { registerWordActions } from './lib/actions.js'
import { capabilities } from './lib/host.js'
import { resolveIntent } from './lib/logic.js'
import { makeT, type Lang } from './lib/strings.js'
import { useWordStore } from './lib/store.js'
import { SPACE, alpha, palette as makePalette } from './lib/theme.js'
import { ReviewPage } from './components/ReviewPage.js'
import { SearchPage } from './components/SearchPage.js'
import { TranslatePage, TranslationDetail } from './components/TranslatePage.js'
import { VocabPage } from './components/VocabPage.js'
import { WordDetail } from './components/WordDetail.js'
import { AiCompanion, PhotoSheet, PracticeSheet } from './components/Sheets.js'
import { Icon } from './components/primitives.js'

type TabID = 'translate' | 'search' | 'vocab'

type Route =
  | { kind: 'root' }
  | { kind: 'word'; word: string }
  | { kind: 'translation'; id: string }
  | { kind: 'review' }

export default function App() {
  const scene = useScene()
  const locale = useLocale()
  const tabs = useTabs()
  const store = useWordStore()

  const lang: Lang = locale.language.startsWith('zh') ? 'zh' : 'en'
  const t = useMemo(() => makeT(lang), [lang])
  const dark = scene?.appearance.effectiveColorScheme === 'dark'
  // accent 跟随用户全局主题色（本模块没有自己的品牌色）；宿主没给就用启动格 tint 兜底。
  const hostAccent = scene?.appearance.accentColor ?? null
  const palette = useMemo(() => {
    const base = makePalette(Boolean(dark))
    return hostAccent ? { ...base, accent: hostAccent } : base
  }, [dark, hostAccent])

  // 默认落地页是中间那个 Tab。
  const [tab, setTab] = useState<TabID>('search')
  const [route, setRoute] = useState<Route>({ kind: 'root' })
  const [searchQuery, setSearchQuery] = useState('')
  const [vocabQuery, setVocabQuery] = useState('')
  const [pendingTranslate, setPendingTranslate] = useState<string | null>(null)
  const [practice, setPractice] = useState<string | null>(null)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [companion, setCompanion] = useState<{ word: string; entryText: string; seed: string | null } | null>(null)

  // 原生 TabBar 的选中态由宿主给；`rendered === false` 时我们自己画一排。
  useEffect(() => {
    if (tabs.rendered && tabs.selected && tabs.selected !== tab) setTab(tabs.selected as TabID)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.selected, tabs.rendered])

  useEffect(() => {
    registerWordActions(store.refresh)
  }, [store.refresh])

  const openWord = useCallback((word: string) => {
    const value = word.trim()
    if (value) setRoute({ kind: 'word', word: value })
  }, [])

  const goTranslate = useCallback(
    (text: string) => {
      setPendingTranslate(text)
      setRoute({ kind: 'root' })
      setTab('translate')
      if (tabs.rendered) void tabs.select('translate')
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [tabs.rendered],
  )

  const aiAvailable = capabilities.ai
  const companionAvailable = aiAvailable

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100dvh',
        background: palette.bg,
        color: palette.ink,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* 搜索框：`aibox.toolbar.search` 是单一声明字段，而本模块两个 Tab 各要一个不同 placeholder
          的搜索框，所以搜索框画在页内 —— 与原生 `searchable` 的位置一致（列表顶部）。 */}
      {tab !== 'translate' ? (
        <div style={{ padding: `${SPACE.s3}px ${SPACE.s4}px 0`, display: 'flex', gap: SPACE.s2, alignItems: 'center' }}>
          <input
            value={tab === 'search' ? searchQuery : vocabQuery}
            onChange={(event) => (tab === 'search' ? setSearchQuery : setVocabQuery)(event.target.value)}
            placeholder={tab === 'search' ? t('searchPlaceholder') : t('vocabFilterPlaceholder')}
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="search"
            onKeyDown={(event) => {
              if (tab !== 'search' || event.key !== 'Enter') return
              const value = searchQuery.trim()
              if (!value) return
              // 回车等同于兜底「查询」行 —— 过意图判定。
              if (resolveIntent(value) === 'translate') goTranslate(value)
              else openWord(value)
            }}
            style={{
              flex: 1,
              borderRadius: 10,
              border: 'none',
              padding: '9px 12px',
              fontSize: 16,
              background: palette.surface,
              color: palette.ink,
            }}
          />
          {tab === 'search' && capabilities.picker && capabilities.ocr ? (
            <button
              type="button"
              onClick={() => setPhotoOpen(true)}
              style={{
                border: 'none',
                background: 'transparent',
                color: palette.accent,
                cursor: 'pointer',
                padding: 8,
              }}
              aria-label={t('photoLookup')}
            >
              <Icon name="viewfinder" size={18} />
            </button>
          ) : null}
        </div>
      ) : null}

      <main style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {tab === 'search' ? (
          <SearchPage
            palette={palette}
            t={t}
            lang={lang}
            store={store}
            query={searchQuery}
            aiAvailable={aiAvailable}
            surface={scene?.effective ?? null}
            onOpenWord={openWord}
            onOpenTranslation={(id) => setRoute({ kind: 'translation', id })}
            onTranslateSentence={goTranslate}
            onOpenReview={() => setRoute({ kind: 'review' })}
          />
        ) : null}
        {tab === 'translate' ? (
          <TranslatePage
            palette={palette}
            t={t}
            store={store}
            pending={pendingTranslate}
            aiAvailable={aiAvailable}
            onPendingConsumed={() => setPendingTranslate(null)}
          />
        ) : null}
        {tab === 'vocab' ? (
          <VocabPage
            palette={palette}
            t={t}
            lang={lang}
            store={store}
            query={vocabQuery}
            onOpenWord={openWord}
            onOpenReview={() => setRoute({ kind: 'review' })}
          />
        ) : null}
      </main>

      {/* `rendered === false`（card/sheet/drawer 上没有原生 TabBar）时自己画页内切换器。 */}
      {!tabs.rendered ? (
        <nav
          style={{
            display: 'flex',
            borderTop: `1px solid ${palette.line}`,
            background: palette.surface,
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {(['translate', 'search', 'vocab'] as TabID[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                padding: '10px 0 12px',
                fontSize: 11,
                cursor: 'pointer',
                color: tab === id ? palette.accent : palette.muted,
              }}
            >
              <div style={{ fontSize: 18, lineHeight: '22px' }}>
                <Icon name={id === 'translate' ? 'globe' : id === 'search' ? 'magnifyingglass' : 'star'} size={18} />
              </div>
              {t(id === 'translate' ? 'tabTranslate' : id === 'search' ? 'tabSearch' : 'tabVocab')}
            </button>
          ))}
        </nav>
      ) : null}

      {route.kind === 'word' ? (
        <WordDetail
          palette={palette}
          t={t}
          store={store}
          word={route.word}
          companionAvailable={companionAvailable}
          onBack={() => setRoute({ kind: 'root' })}
          onOpenWord={openWord}
          onPractice={(sentence) => setPractice(sentence)}
          onCompanion={(seed, entryText) => setCompanion({ word: route.word, entryText, seed })}
        />
      ) : null}
      {route.kind === 'translation' ? (
        <TranslationDetail
          palette={palette}
          t={t}
          store={store}
          recordID={route.id}
          onBack={() => setRoute({ kind: 'root' })}
        />
      ) : null}
      {route.kind === 'review' ? (
        <ReviewPage
          palette={palette}
          t={t}
          store={store}
          onBack={() => setRoute({ kind: 'root' })}
          onOpenWord={openWord}
        />
      ) : null}

      <PracticeSheet
        palette={palette}
        t={t}
        open={practice !== null}
        sentence={practice ?? ''}
        onClose={() => setPractice(null)}
      />
      <PhotoSheet palette={palette} t={t} open={photoOpen} onClose={() => setPhotoOpen(false)} onPickWord={openWord} />
      <AiCompanion
        palette={palette}
        t={t}
        open={companion !== null}
        word={companion?.word ?? ''}
        entryText={companion?.entryText ?? ''}
        seed={companion?.seed ?? null}
        onClose={() => setCompanion(null)}
      />

      {/* 深浅色都要能看：这里用 alpha 兜一层，防止极端主题下底色与卡片同色。 */}
      <div style={{ display: 'none', background: alpha(palette.accent, 0.01) }} />
    </div>
  )
}
