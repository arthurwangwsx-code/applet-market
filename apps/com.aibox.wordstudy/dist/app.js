import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 根视图（规格 §1）。三个 Tab 各自独立导航栈；**默认落地页是中间的「搜索」，不是第一个 Tab**。
//
// `useTabs().rendered === false` 时（card / sheet / drawer 面上没有原生 TabBar）必须自己画页内切换器 ——
// 少了这一条，那些呈现面上用户就永远切不了 Tab。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useScene, useTabs } from './lib/aibox-sdk-react.js';
import { registerWordActions } from './lib/actions.js';
import { capabilities } from './lib/host.js';
import { resolveIntent } from './lib/logic.js';
import { makeT } from './lib/strings.js';
import { useWordStore } from './lib/store.js';
import { SPACE, alpha, palette as makePalette } from './lib/theme.js';
import { ReviewPage } from './components/ReviewPage.js';
import { SearchPage } from './components/SearchPage.js';
import { TranslatePage, TranslationDetail } from './components/TranslatePage.js';
import { VocabPage } from './components/VocabPage.js';
import { WordDetail } from './components/WordDetail.js';
import { AiCompanion, PhotoSheet, PracticeSheet } from './components/Sheets.js';
import { Icon } from './components/primitives.js';
export default function App() {
    const scene = useScene();
    const locale = useLocale();
    const tabs = useTabs();
    const store = useWordStore();
    const lang = locale.language.startsWith('zh') ? 'zh' : 'en';
    const t = useMemo(() => makeT(lang), [lang]);
    const dark = scene?.appearance.effectiveColorScheme === 'dark';
    // accent 跟随用户全局主题色（本模块没有自己的品牌色）；宿主没给就用启动格 tint 兜底。
    const hostAccent = scene?.appearance.accentColor ?? null;
    const palette = useMemo(() => {
        const base = makePalette(Boolean(dark));
        return hostAccent ? { ...base, accent: hostAccent } : base;
    }, [dark, hostAccent]);
    // 默认落地页是中间那个 Tab。
    const [tab, setTab] = useState('search');
    const [route, setRoute] = useState({ kind: 'root' });
    const [searchQuery, setSearchQuery] = useState('');
    const [vocabQuery, setVocabQuery] = useState('');
    const [pendingTranslate, setPendingTranslate] = useState(null);
    const [practice, setPractice] = useState(null);
    const [photoOpen, setPhotoOpen] = useState(false);
    const [companion, setCompanion] = useState(null);
    // 原生 TabBar 的选中态由宿主给；`rendered === false` 时我们自己画一排。
    useEffect(() => {
        if (tabs.rendered && tabs.selected && tabs.selected !== tab)
            setTab(tabs.selected);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabs.selected, tabs.rendered]);
    useEffect(() => {
        registerWordActions(store.refresh);
    }, [store.refresh]);
    const openWord = useCallback((word) => {
        const value = word.trim();
        if (value)
            setRoute({ kind: 'word', word: value });
    }, []);
    const goTranslate = useCallback((text) => {
        setPendingTranslate(text);
        setRoute({ kind: 'root' });
        setTab('translate');
        if (tabs.rendered)
            void tabs.select('translate');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabs.rendered]);
    const aiAvailable = capabilities.ai;
    const companionAvailable = aiAvailable;
    return (_jsxs("div", { style: {
            position: 'relative',
            minHeight: '100dvh',
            background: palette.bg,
            color: palette.ink,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: 'env(safe-area-inset-bottom)',
        }, children: [tab !== 'translate' ? (_jsxs("div", { style: { padding: `${SPACE.s3}px ${SPACE.s4}px 0`, display: 'flex', gap: SPACE.s2, alignItems: 'center' }, children: [_jsx("input", { value: tab === 'search' ? searchQuery : vocabQuery, onChange: (event) => (tab === 'search' ? setSearchQuery : setVocabQuery)(event.target.value), placeholder: tab === 'search' ? t('searchPlaceholder') : t('vocabFilterPlaceholder'), autoCapitalize: "none", autoCorrect: "off", enterKeyHint: "search", onKeyDown: (event) => {
                            if (tab !== 'search' || event.key !== 'Enter')
                                return;
                            const value = searchQuery.trim();
                            if (!value)
                                return;
                            // 回车等同于兜底「查询」行 —— 过意图判定。
                            if (resolveIntent(value) === 'translate')
                                goTranslate(value);
                            else
                                openWord(value);
                        }, style: {
                            flex: 1, borderRadius: 10, border: 'none', padding: '9px 12px', fontSize: 16,
                            background: palette.surface, color: palette.ink,
                        } }), tab === 'search' && capabilities.picker && capabilities.ocr ? (_jsx("button", { type: "button", onClick: () => setPhotoOpen(true), style: { border: 'none', background: 'transparent', color: palette.accent, cursor: 'pointer', padding: 8 }, "aria-label": t('photoLookup'), children: _jsx(Icon, { name: "viewfinder", size: 18 }) })) : null] })) : null, _jsxs("main", { style: { flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }, children: [tab === 'search' ? (_jsx(SearchPage, { palette: palette, t: t, lang: lang, store: store, query: searchQuery, aiAvailable: aiAvailable, surface: scene?.effective ?? null, onOpenWord: openWord, onOpenTranslation: (id) => setRoute({ kind: 'translation', id }), onTranslateSentence: goTranslate, onOpenReview: () => setRoute({ kind: 'review' }) })) : null, tab === 'translate' ? (_jsx(TranslatePage, { palette: palette, t: t, store: store, pending: pendingTranslate, aiAvailable: aiAvailable, onPendingConsumed: () => setPendingTranslate(null) })) : null, tab === 'vocab' ? (_jsx(VocabPage, { palette: palette, t: t, lang: lang, store: store, query: vocabQuery, onOpenWord: openWord, onOpenReview: () => setRoute({ kind: 'review' }) })) : null] }), !tabs.rendered ? (_jsx("nav", { style: {
                    display: 'flex', borderTop: `1px solid ${palette.line}`, background: palette.surface,
                    paddingBottom: 'env(safe-area-inset-bottom)',
                }, children: ['translate', 'search', 'vocab'].map((id) => (_jsxs("button", { type: "button", onClick: () => setTab(id), style: {
                        flex: 1, border: 'none', background: 'transparent', padding: '10px 0 12px',
                        fontSize: 11, cursor: 'pointer',
                        color: tab === id ? palette.accent : palette.muted,
                    }, children: [_jsx("div", { style: { fontSize: 18, lineHeight: '22px' }, children: _jsx(Icon, { name: id === 'translate' ? 'globe' : id === 'search' ? 'magnifyingglass' : 'star', size: 18 }) }), t(id === 'translate' ? 'tabTranslate' : id === 'search' ? 'tabSearch' : 'tabVocab')] }, id))) })) : null, route.kind === 'word' ? (_jsx(WordDetail, { palette: palette, t: t, store: store, word: route.word, companionAvailable: companionAvailable, onBack: () => setRoute({ kind: 'root' }), onOpenWord: openWord, onPractice: (sentence) => setPractice(sentence), onCompanion: (seed, entryText) => setCompanion({ word: route.word, entryText, seed }) })) : null, route.kind === 'translation' ? (_jsx(TranslationDetail, { palette: palette, t: t, store: store, recordID: route.id, onBack: () => setRoute({ kind: 'root' }) })) : null, route.kind === 'review' ? (_jsx(ReviewPage, { palette: palette, t: t, store: store, onBack: () => setRoute({ kind: 'root' }), onOpenWord: openWord })) : null, _jsx(PracticeSheet, { palette: palette, t: t, open: practice !== null, sentence: practice ?? '', onClose: () => setPractice(null) }), _jsx(PhotoSheet, { palette: palette, t: t, open: photoOpen, onClose: () => setPhotoOpen(false), onPickWord: openWord }), _jsx(AiCompanion, { palette: palette, t: t, open: companion !== null, word: companion?.word ?? '', entryText: companion?.entryText ?? '', seed: companion?.seed ?? null, onClose: () => setCompanion(null) }), _jsx("div", { style: { display: 'none', background: alpha(palette.accent, 0.01) } })] }));
}
