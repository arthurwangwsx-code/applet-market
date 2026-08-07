import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 单词详情页（规格 §3）。
//
// 三条最容易做错的载入行为：
//  · 缓存命中的词**根本不调网络也不调 AI** —— 无 TTL、不过期、没有"刷新"，只有手动「重新生成」；
//  · 「重新生成」必须**先拿到完整新结果再覆盖**，失败时旧词条原样保留 + 橙色横幅，绝不变空页；
//  · 骨架屏一次成页，**不做流式拼装**（保排版稳定）。
import { useEffect, useMemo, useState } from 'react';
import { getEntry, recordHistory, removeVocab, replaceEntry, upsertVocab } from '../lib/db.js';
import { LookupError, lookupWord } from '../lib/dict.js';
import { copyText, shareText, speak } from '../lib/host.js';
import { formatEntryText } from '../lib/logic.js';
import { sourceLabel } from '../lib/strings.js';
import { RADIUS, SPACE, alpha } from '../lib/theme.js';
import { ChipsFlow, EmptyState, Icon, InfoChip, PrimaryButton, PushPage, SectionHeader } from './primitives.js';
import { pickAction } from './SearchPage.js';
export function WordDetail(props) {
    const { palette, t, store, word } = props;
    const [payload, setPayload] = useState(null);
    const [meta, setMeta] = useState(null);
    const [error, setError] = useState('');
    const [regenerateError, setRegenerateError] = useState('');
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const saved = useMemo(() => store.vocab.some((item) => item.text === word.trim().toLowerCase()), [store.vocab, word]);
    // `task(id: word)` —— 换词即重跑。
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            setLoading(true);
            setPayload(null);
            setError('');
            setRegenerateError('');
            setMeta(null);
            const cached = await getEntry(word);
            if (cached && cached.payload && Array.isArray(cached.payload.senses)) {
                if (cancelled)
                    return;
                await recordHistory(word, cached.brief);
                setPayload(cached.payload);
                setMeta({ isCached: true, source: cached.source });
                setLoading(false);
                store.refresh();
                return;
            }
            try {
                const fresh = await lookupWord(word);
                if (cancelled)
                    return;
                const entry = await replaceEntry(word, fresh);
                await recordHistory(word, entry.brief);
                setPayload(fresh);
                setMeta({ isCached: false, source: fresh.source });
                store.refresh();
            }
            catch (caught) {
                if (cancelled)
                    return;
                setError(caught instanceof LookupError ? caught.message : String(caught));
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
        // store 每次 refresh 都会换引用，放进依赖会把这条 task 变成死循环。
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [word]);
    const entryText = payload ? formatEntryText(payload) : '';
    const regenerate = async () => {
        if (!payload || regenerating)
            return;
        setRegenerating(true);
        setRegenerateError('');
        try {
            // 先拿到完整新结果，成功后才替换缓存。绝不能先删缓存再请求。
            const fresh = await lookupWord(word);
            await replaceEntry(word, fresh);
            setPayload(fresh);
            setMeta({ isCached: false, source: fresh.source });
            store.refresh();
        }
        catch (caught) {
            setRegenerateError(caught instanceof LookupError ? caught.message : String(caught));
        }
        finally {
            setRegenerating(false);
        }
    };
    const toggleSave = async () => {
        if (saved) {
            await removeVocab(word);
        }
        else {
            // 收藏时把**当前 payload 的首条英文例句**存进 note 作为学习语境。
            await upsertVocab({
                term: word,
                kind: 'word',
                brief: payload ? briefOf(payload) : '',
                note: payload?.examples[0]?.en ?? null,
            });
        }
        store.refresh();
    };
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
        ]);
        if (action === 'star')
            await toggleSave();
        if (action === 'regen')
            await regenerate();
        if (action === 'copy')
            await copyText(entryText);
        if (action === 'share')
            await shareText(entryText);
    };
    return (_jsx(PushPage, { palette: palette, title: word, onBack: props.onBack, trailing: _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 2 }, children: [props.companionAvailable && payload ? (_jsx("button", { type: "button", onClick: () => props.onCompanion(null, entryText), style: {
                        border: 'none',
                        background: 'transparent',
                        color: palette.accent,
                        fontSize: 17,
                        cursor: 'pointer',
                        width: 44,
                        height: 44,
                    }, "aria-label": t('companionTitle'), children: _jsx(Icon, { name: "sparkles", size: 17 }) })) : null, _jsx("button", { type: "button", onClick: menu, style: {
                        border: 'none',
                        background: 'transparent',
                        color: palette.accent,
                        fontSize: 17,
                        cursor: 'pointer',
                        width: 44,
                        height: 44,
                    }, "aria-label": "More", children: "\u22EF" })] }), children: _jsxs("div", { style: { padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s5 }, children: [_jsx("h1", { style: { margin: 0, fontSize: 30, fontWeight: 600, color: palette.ink }, children: word }), loading ? _jsx(Skeleton, { palette: palette }) : null, !loading && error ? (_jsxs("div", { style: { textAlign: 'center', paddingTop: SPACE.s8 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 500, color: palette.ink }, children: t('loadFailed') }), _jsx("div", { style: { fontSize: 13, color: palette.muted, margin: `${SPACE.s2}px 0 ${SPACE.s4}px` }, children: error }), _jsx(PrimaryButton, { palette: palette, title: t('retry'), onClick: () => props.onOpenWord(word) })] })) : null, payload ? (_jsxs(_Fragment, { children: [regenerateError ? (_jsxs("div", { style: { background: alpha(palette.orange, 0.1), borderRadius: RADIUS.field, padding: SPACE.s3 }, children: [_jsxs("div", { style: { fontSize: 13, fontWeight: 500, color: palette.orange }, children: [_jsx(Icon, { name: "warning", size: 13 }), " ", t('regenerateFailed')] }), _jsx("div", { style: { fontSize: 12, color: palette.muted, marginTop: 4 }, children: regenerateError })] })) : null, payload.corrected ? (_jsxs("div", { style: { fontSize: 14, color: palette.ink }, children: [t('didYouMean'), " ", _jsxs("span", { style: { fontWeight: 600 }, children: ["\u201C", payload.corrected, "\u201D?"] })] })) : null, meta ? (_jsxs(ChipsFlow, { children: [_jsx(InfoChip, { palette: palette, icon: "shield", label: sourceLabel(t, meta.source), filled: true }), _jsx(InfoChip, { palette: palette, icon: meta.isCached ? 'drive' : 'refresh', label: meta.isCached ? t('cached') : t('justUpdated'), tint: meta.isCached ? undefined : palette.green, filled: !meta.isCached })] })) : null, payload.phoneticUK || payload.phoneticUS || payload.frequency !== null ? (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s2 }, children: [payload.phoneticUK ? (_jsx(InfoChip, { palette: palette, icon: "speaker", label: `UK /${payload.phoneticUK}/`, onClick: () => void speak(word, 'uk') })) : null, payload.phoneticUS ? (_jsx(InfoChip, { palette: palette, icon: "speaker", label: `US /${payload.phoneticUS}/`, onClick: () => void speak(word, 'us') })) : null, _jsx("div", { style: { flex: 1 } }), payload.frequency !== null ? _jsx(Frequency, { palette: palette, value: payload.frequency }) : null] })) : null, payload.examTags.length ? (_jsx(ChipsFlow, { children: payload.examTags.map((tag) => (_jsx(InfoChip, { palette: palette, label: tag }, tag))) })) : null, _jsxs("section", { children: [_jsx(SectionHeader, { palette: palette, title: t('sectionSenses') }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: payload.senses.map((sense, index) => (_jsxs("div", { style: { fontSize: 15, color: palette.ink }, children: [sense.pos ? _jsxs("span", { style: { color: palette.accent }, children: [sense.pos, " "] }) : null, sense.glosses.join('；')] }, `${sense.pos}-${index}`))) })] }), props.companionAvailable ? (_jsxs("section", { children: [_jsx(SectionHeader, { palette: palette, title: t('sectionCompanion') }), _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: SPACE.s2 }, children: [_jsx(Pill, { palette: palette, icon: "quote", label: t('chipSimpler'), onClick: () => props.onCompanion(`Give me a simpler example sentence for "${word}".`, entryText) }), _jsx(Pill, { palette: palette, icon: "list", label: t('chipOther'), onClick: () => props.onCompanion(`Does "${word}" have other common meanings or uses I should know about?`, entryText) })] })] })) : null, payload.forms.length ? (_jsxs("section", { children: [_jsx(SectionHeader, { palette: palette, title: t('sectionForms') }), _jsx(ChipsFlow, { children: payload.forms.map((form) => (_jsx(InfoChip, { palette: palette, label: `${form.label} ${form.value}`, onClick: () => props.onOpenWord(form.value) }, `${form.label}-${form.value}`))) })] })) : null, payload.examples.length ? (_jsxs("section", { children: [_jsx(SectionHeader, { palette: palette, title: t('sectionExamples') }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s3 }, children: payload.examples.map((example, index) => (_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: SPACE.s2 }, children: [_jsxs("button", { type: "button", onClick: () => void speak(example.en, 'us'), style: {
                                                    flex: 1,
                                                    border: 'none',
                                                    background: 'transparent',
                                                    padding: 0,
                                                    textAlign: 'left',
                                                    cursor: 'pointer',
                                                }, children: [_jsx("div", { style: { fontSize: 14, color: palette.ink }, children: example.en }), example.zh ? (_jsx("div", { style: { fontSize: 13, color: palette.muted, marginTop: 2 }, children: example.zh })) : null] }), _jsx("button", { type: "button", onClick: () => props.onPractice(example.en), style: {
                                                    border: 'none',
                                                    background: 'transparent',
                                                    color: palette.accent,
                                                    cursor: 'pointer',
                                                    padding: 4,
                                                }, "aria-label": t('practiceTitle'), children: _jsx(Icon, { name: "mic", size: 16 }) })] }, `${example.en}-${index}`))) })] })) : null, payload.memoryTip ? (_jsxs("section", { children: [_jsx(SectionHeader, { palette: palette, title: t('sectionMemoryTip') }), _jsx("div", { style: {
                                        background: palette.surface,
                                        borderRadius: RADIUS.card,
                                        padding: SPACE.s3,
                                        fontSize: 14,
                                        color: palette.ink,
                                    }, children: payload.memoryTip })] })) : null, payload.synonyms.length || payload.antonyms.length ? (_jsxs("section", { children: [_jsx(SectionHeader, { palette: palette, title: t('sectionRelated') }), _jsxs(ChipsFlow, { children: [payload.synonyms.map((item) => (_jsx(InfoChip, { palette: palette, label: item, filled: true, onClick: () => props.onOpenWord(item) }, `syn-${item}`))), payload.antonyms.map((item) => (_jsx(InfoChip, { palette: palette, label: item, tint: palette.red, filled: true, onClick: () => props.onOpenWord(item) }, `ant-${item}`)))] })] })) : null] })) : null, !loading && !payload && !error ? (_jsx(EmptyState, { palette: palette, icon: "magnifyingglass", text: t('emptySearchHint') })) : null] }) }));
}
function briefOf(payload) {
    const sense = payload.senses[0];
    if (!sense)
        return '';
    return [sense.pos, sense.glosses[0] ?? ''].filter(Boolean).join(' ').trim();
}
/** 常用度：5 个 6pt 圆点，`i <= clamp(frequency, 0, 5)` 实心。 */
function Frequency({ palette, value }) {
    const level = Math.min(5, Math.max(0, Math.round(value)));
    return (_jsx("div", { style: { display: 'flex', gap: 3 }, children: [1, 2, 3, 4, 5].map((index) => (_jsx("span", { style: {
                width: 6,
                height: 6,
                borderRadius: 3,
                display: 'inline-block',
                background: index <= level ? palette.accent : 'transparent',
                border: index <= level ? 'none' : `1px solid ${palette.line}`,
            } }, index))) }));
}
function Pill(props) {
    return (_jsxs("button", { type: "button", onClick: props.onClick, style: {
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
        }, children: [_jsx(Icon, { name: props.icon, size: 12 }), " ", props.label] }));
}
/** 骨架屏：4 个 surface 圆角块，整体降低不透明度。一次成页。 */
function Skeleton({ palette }) {
    const block = (width, height) => (_jsx("div", { style: { width, height, borderRadius: 8, background: palette.surface } }));
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s3, opacity: 0.55 }, children: [block(160, 28), block(220, 16), block('100%', 16), block('100%', 80)] }));
}
