import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 搜索页（默认落地，规格 §2）—— **默认落地页是中间那个 Tab，不是第一个**。
//
// 两个必须守住的行为：
//  · 联想行点击**永远走查词**，不做句子判定；
//  · 回车 / 兜底「查询」行才过意图判定；「作为句子翻译」永远无条件走翻译。
import { useEffect, useMemo, useState } from 'react';
import { clearHistory, clearTranslations, getDaily, removeHistory, saveDaily, upsertVocab } from '../lib/db.js';
import { generateDaily } from '../lib/dict.js';
import { confirm, copyText, probeAI, speak } from '../lib/host.js';
import { dateKeyOf, dueCount, resolveIntent, suggest } from '../lib/logic.js';
import { seedSentence } from '../lib/seed.js';
import { dueBanner } from '../lib/strings.js';
import { SPACE, alpha } from '../lib/theme.js';
import { ChipsFlow, DueBanner, EmptyState, Icon, InfoChip, Row, SectionHeader } from './primitives.js';
export function SearchPage(props) {
    const { palette, t, store } = props;
    const [daily, setDaily] = useState(null);
    const [expandHistory, setExpandHistory] = useState(false);
    const [expandTranslations, setExpandTranslations] = useState(false);
    const trimmed = props.query.trim();
    const due = useMemo(() => dueCount(store.vocab), [store.vocab]);
    // 每日一句三级降级：缓存 → AI → 内置种子。
    //
    // 顺序刻意是「先把种子渲染出来，再尝试用 AI 升级」：
    //  · 卡片首帧就有内容，不会先空一块再跳出来；
    //  · AI 这一步有两道门 —— `ai.availability()`（模型配没配，不弹框不花配额）与
    //    **呈现面必须可见**。`aibox/not-visible` 的语义是"授权提示需要一个可见的 applet 来锚定"，
    //    无头运行时 `generate` 必被拒、页面白吃一条 console 错误。
    //  · `surface === null` = scene 还没回话（`useScene` 是异步的，首帧恒为 null）——
    //    这时**不能**当成可见，否则挂载那一刻就会打出去一发必失败的请求。
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const dateKey = dateKeyOf();
            const cached = await getDaily(dateKey);
            if (cancelled)
                return;
            if (cached) {
                setDaily(cached);
                return;
            }
            setDaily({ dateKey, ...seedSentence(dateKey) });
            const visible = props.surface !== null && props.surface !== 'headless';
            if (!props.aiAvailable || !visible)
                return;
            if (!(await probeAI()))
                return;
            const generated = await generateDaily(dateKey);
            if (cancelled || !generated)
                return;
            const value = { dateKey, ...generated };
            await saveDaily(value);
            setDaily(value);
        })();
        return () => { cancelled = true; };
    }, [props.aiAvailable, props.surface]);
    const suggestions = useMemo(() => suggest({ prefix: trimmed, history: store.history, vocab: store.vocab, cachedWords: store.cachedWords }), [trimmed, store.history, store.vocab, store.cachedWords]);
    if (trimmed) {
        return (_jsxs("div", { children: [suggestions.map((item) => (_jsx(Row, { palette: palette, title: item.term, subtitle: item.brief || undefined, 
                    // 点联想行永远走查词，不做句子判定。
                    onClick: () => props.onOpenWord(item.term), trailing: item.isCached ? _jsx(InfoChip, { palette: palette, label: t('cached'), tint: palette.green, filled: true }) : undefined }, item.term))), _jsx(Row, { palette: palette, title: _jsxs("span", { children: [_jsx(Icon, { name: "sparkles", size: 13, color: palette.accent }), ' ', t('lookupAction'), " ", _jsxs("span", { style: { fontWeight: 600 }, children: ["\u201C", trimmed, "\u201D"] })] }), onClick: () => {
                        // 兜底行 A 走意图分流。
                        if (resolveIntent(trimmed) === 'translate')
                            props.onTranslateSentence(trimmed);
                        else
                            props.onOpenWord(trimmed);
                    } }), _jsx(Row, { palette: palette, title: _jsxs("span", { children: [_jsx(Icon, { name: "globe", size: 13, color: palette.accent }), " ", t('translateAsSentence')] }), 
                    // 兜底行 B **无条件**切到翻译。
                    onClick: () => props.onTranslateSentence(trimmed) })] }));
    }
    const historyRows = expandHistory ? store.history : store.history.slice(0, 5);
    const translationRows = expandTranslations ? store.translations : store.translations.slice(0, 5);
    const bothEmpty = store.history.length === 0 && store.translations.length === 0;
    return (_jsxs("div", { style: { paddingBottom: SPACE.s6 }, children: [due > 0 ? (_jsx("div", { style: { padding: `${SPACE.s3}px ${SPACE.s4}px 0` }, children: _jsx(DueBanner, { palette: palette, text: dueBanner(t, props.lang, due), onClick: props.onOpenReview }) })) : null, daily && daily.en ? (_jsx("div", { style: { padding: `${SPACE.s4}px ${SPACE.s4}px 4px` }, children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s2 }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 500, color: palette.accent, textTransform: 'uppercase', letterSpacing: 0.6 }, children: t('dailyHeader') }), _jsx("div", { style: { fontSize: 15, fontWeight: 500, color: palette.ink }, children: daily.en }), daily.zh ? (_jsx("div", { style: { fontSize: 13, color: palette.muted }, children: `“${daily.zh}” — ${daily.author}` })) : null, _jsxs("div", { style: { display: 'flex', gap: SPACE.s2, marginTop: 2 }, children: [_jsx(InfoChip, { palette: palette, icon: "speaker", label: t('speakNormal'), onClick: () => void speak(daily.en, 'us', 'normal') }), _jsx(InfoChip, { palette: palette, icon: "tortoise", label: t('speakSlow'), onClick: () => void speak(daily.en, 'us', 'slow') })] })] }) })) : null, bothEmpty ? _jsx(EmptyState, { palette: palette, icon: "magnifyingglass", text: t('emptySearchHint') }) : null, store.history.length > 0 ? (_jsxs("section", { style: { marginTop: SPACE.s5 }, children: [_jsx("div", { style: { padding: `0 ${SPACE.s4}px` }, children: _jsx(SectionHeader, { palette: palette, title: t('recentLookups'), trailing: _jsx("button", { type: "button", style: { border: 'none', background: 'transparent', color: palette.accent, fontSize: 11, cursor: 'pointer' }, onClick: async () => {
                                    const ok = await confirm({
                                        title: t('clearHistoryTitle'),
                                        confirmTitle: t('clear'),
                                        cancelTitle: t('cancel'),
                                        destructive: true,
                                    });
                                    if (!ok)
                                        return;
                                    await clearHistory();
                                    store.refresh();
                                }, children: t('clear') }) }) }), historyRows.map((item) => (_jsx(Row, { palette: palette, title: item.term, subtitle: item.brief || undefined, onClick: () => props.onOpenWord(item.term), onLongPress: async () => {
                            const action = await pickAction(props, [
                                { id: 'copy', title: t('copy') },
                                { id: 'save', title: t('addToVocab') },
                                { id: 'delete', title: t('delete'), destructive: true },
                            ]);
                            if (action === 'copy')
                                await copyText(item.term);
                            if (action === 'save') {
                                await upsertVocab({ term: item.term, brief: item.brief });
                                store.refresh();
                            }
                            if (action === 'delete') {
                                await removeHistory(item.term);
                                store.refresh();
                            }
                        } }, item.term))), store.history.length > 5 ? (_jsxs("button", { type: "button", onClick: () => setExpandHistory((value) => !value), style: expandStyle(palette), children: [expandHistory ? t('collapse') : t('expandAll'), " ", _jsx(Icon, { name: expandHistory ? 'chevron.up' : 'chevron.down', size: 11 })] })) : null] })) : null, store.translations.length > 0 ? (_jsxs("section", { style: { marginTop: SPACE.s5 }, children: [_jsx("div", { style: { padding: `0 ${SPACE.s4}px` }, children: _jsx(SectionHeader, { palette: palette, title: t('translationHistory'), trailing: _jsx("button", { type: "button", style: { border: 'none', background: 'transparent', color: palette.accent, fontSize: 11, cursor: 'pointer' }, onClick: async () => {
                                    const ok = await confirm({
                                        title: t('clearTranslationsTitle'),
                                        confirmTitle: t('clear'),
                                        cancelTitle: t('cancel'),
                                        destructive: true,
                                    });
                                    if (!ok)
                                        return;
                                    await clearTranslations();
                                    store.refresh();
                                }, children: t('clear') }) }) }), translationRows.map((record) => (_jsx(Row, { palette: palette, title: _jsx("span", { style: { fontSize: 14 }, children: record.source }), subtitle: record.target, onClick: () => props.onOpenTranslation(record.id), trailing: record.starred ? _jsx(Icon, { name: "star.fill", size: 11, color: palette.accent }) : undefined }, record.id))), store.translations.length > 5 ? (_jsxs("button", { type: "button", onClick: () => setExpandTranslations((value) => !value), style: expandStyle(palette), children: [expandTranslations ? t('collapse') : t('expandAll'), ' ', _jsx(Icon, { name: expandTranslations ? 'chevron.up' : 'chevron.down', size: 11 })] })) : null] })) : null, _jsx(ChipsFlow, { children: null })] }));
}
function expandStyle(palette) {
    return {
        display: 'block', width: '100%', textAlign: 'left', border: 'none',
        background: 'transparent', color: palette.accent, fontSize: 13,
        padding: `10px ${SPACE.s4}px`, cursor: 'pointer',
        borderBottom: `1px solid ${alpha(palette.line, 1)}`,
    };
}
/** 长按菜单 —— 原生是 contextMenu，这里用系统 actionSheet（同样是原生控件）。 */
async function pickAction(props, actions) {
    void props;
    const bridge = typeof window !== 'undefined' ? window.aibox : undefined;
    if (!bridge?.ui)
        return null;
    try {
        const result = await bridge.ui.actionSheet({
            actions: actions.map((action) => ({
                id: action.id,
                title: action.title,
                role: action.destructive ? 'destructive' : 'default',
            })),
        });
        return result.cancelled ? null : result.actionId;
    }
    catch {
        return null;
    }
}
export { pickAction };
