import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 翻译页（规格 §4）+ 翻译详情页（§5）。
//
// 语向条三态：`auto`（默认）显示的是**对当前输入内容的预判**；点左/右语言名锁定方向；
// 语言名恒用母语名（`中文` / `English`），**不随界面语言翻译**。
import { useEffect, useMemo, useState } from 'react';
import { cryptoID, getTranslation, removeTranslation, saveTranslation } from '../lib/db.js';
import { LookupError, translateStream } from '../lib/dict.js';
import { copyText, speak } from '../lib/host.js';
import { previewDirection } from '../lib/logic.js';
import { RADIUS, SPACE } from '../lib/theme.js';
import { EmptyState, Icon, PrimaryButton, PushPage, SecondaryButton } from './primitives.js';
/** 语言名恒用母语名。 */
const NATIVE_NAME = { zh: '中文', en: 'English' };
/** 3000 只是展示上限。**有意改良**（规格 §22.3）：原生只显示不拦截，这里真的禁用发送。 */
const MAX_CHARS = 3000;
export function TranslatePage(props) {
    const { palette, t, store } = props;
    const [input, setInput] = useState('');
    const [direction, setDirection] = useState('auto');
    const [output, setOutput] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    // 监听 pendingTranslateText：非空即预填输入框并清空该字段。
    useEffect(() => {
        if (props.pending === null)
            return;
        setInput(props.pending);
        props.onPendingConsumed();
    }, [props.pending]);
    const preview = useMemo(() => previewDirection(input, direction), [input, direction]);
    const overLimit = input.length > MAX_CHARS;
    const run = async () => {
        const text = input.trim();
        if (!text || busy || overLimit)
            return;
        setBusy(true);
        setOutput('');
        setError('');
        let accumulated = '';
        try {
            await translateStream({
                text,
                from: preview.from,
                to: preview.to,
                onDelta: (chunk) => {
                    accumulated += chunk;
                    setOutput(accumulated);
                },
            });
            const finalText = accumulated.trim();
            if (!finalText) {
                setError(t('translateFailed'));
            }
            else {
                await saveTranslation({
                    id: cryptoID(),
                    source: text,
                    target: finalText,
                    srcLang: preview.from,
                    dstLang: preview.to,
                    at: Date.now(),
                    starred: false,
                });
                store.refresh();
            }
        }
        catch (caught) {
            setError(caught instanceof LookupError ? caught.message : String(caught));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { style: { padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s4 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s2, fontSize: 13, fontWeight: 500, color: palette.accent }, children: [_jsx("button", { type: "button", style: plain(palette), onClick: () => setDirection('zhToEn'), children: NATIVE_NAME[preview.from] }), _jsx("button", { type: "button", style: plain(palette), onClick: () => setDirection(preview.from === 'zh' ? 'enToZh' : 'zhToEn'), "aria-label": "Swap", children: _jsx(Icon, { name: "swap", size: 13 }) }), _jsx("button", { type: "button", style: plain(palette), onClick: () => setDirection('enToZh'), children: NATIVE_NAME[preview.to] }), _jsx("div", { style: { flex: 1 } }), direction !== 'auto' ? (_jsx("button", { type: "button", style: { ...plain(palette), fontSize: 11, color: palette.muted }, onClick: () => setDirection('auto'), children: t('autoDetect') })) : null] }), _jsx("textarea", { value: input, onChange: (event) => setInput(event.target.value), placeholder: t('translateInputPlaceholder'), rows: 4, style: {
                    width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 96, maxHeight: 260,
                    borderRadius: RADIUS.field, border: `1px solid ${palette.line}`, padding: SPACE.s3,
                    fontSize: 15, color: palette.ink, background: palette.surface, fontFamily: 'inherit',
                } }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s3 }, children: [_jsxs("span", { style: { fontSize: 11, color: overLimit ? palette.red : palette.muted }, children: [input.length, " / ", MAX_CHARS] }), _jsx("div", { style: { flex: 1 } }), _jsx(PrimaryButton, { palette: palette, title: t('translateAction'), busy: busy, disabled: !input.trim() || overLimit || !props.aiAvailable, onClick: run })] }), error ? _jsx("div", { style: { fontSize: 13, color: palette.red }, children: error }) : null, output ? (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s3 }, children: [_jsx("div", { style: { fontSize: 16, color: palette.ink, whiteSpace: 'pre-wrap' }, children: output }), _jsxs("div", { style: { display: 'flex', gap: SPACE.s4 }, children: [_jsx("button", { type: "button", style: { ...plain(palette), fontSize: 12 }, onClick: () => void copyText(output), children: t('copy') }), _jsxs("button", { type: "button", style: { ...plain(palette), fontSize: 12 }, onClick: () => void speak(output, 'us'), children: [_jsx(Icon, { name: "speaker", size: 12 }), " ", t('speakAloud')] })] })] })) : null] }));
}
function plain(palette) {
    return {
        border: 'none', background: 'transparent', color: palette.accent,
        padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 500,
    };
}
export function TranslationDetail(props) {
    const { palette, t, store } = props;
    const [record, setRecord] = useState(null);
    const [missing, setMissing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const found = await getTranslation(props.recordID);
            if (cancelled)
                return;
            if (!found)
                setMissing(true);
            else
                setRecord(found);
        })();
        return () => { cancelled = true; };
    }, [props.recordID]);
    const toggleStar = async () => {
        if (!record)
            return;
        const next = { ...record, starred: !record.starred };
        setRecord(next);
        await saveTranslation(next);
        store.refresh();
    };
    const retranslate = async () => {
        if (!record || busy)
            return;
        setBusy(true);
        setError('');
        const previous = record.target;
        let accumulated = '';
        try {
            await translateStream({
                text: record.source,
                from: record.srcLang,
                to: record.dstLang,
                onDelta: (chunk) => {
                    accumulated += chunk;
                    setRecord((current) => (current ? { ...current, target: accumulated } : current));
                },
            });
            const finalText = accumulated.trim();
            if (!finalText) {
                // 失败或结果为空 → 还原旧译文 + 显示错误。
                setRecord((current) => (current ? { ...current, target: previous } : current));
                setError(t('translateFailed'));
            }
            else {
                const next = { ...record, target: finalText, at: Date.now() };
                setRecord(next);
                await saveTranslation(next);
                store.refresh();
            }
        }
        catch (caught) {
            setRecord((current) => (current ? { ...current, target: previous } : current));
            setError(caught instanceof LookupError ? caught.message : String(caught));
        }
        finally {
            setBusy(false);
        }
    };
    if (missing) {
        return (_jsx(PushPage, { palette: palette, title: "", onBack: props.onBack, children: _jsx(EmptyState, { palette: palette, icon: "clock", text: t('noTranslationRecord') }) }));
    }
    if (!record)
        return _jsx(PushPage, { palette: palette, title: "", onBack: props.onBack, children: _jsx("div", {}) });
    // **朗读永远读英文那一侧**：源语言是 en 就读原文，否则读当前译文（读中文会跑偏）。
    const speakText = record.srcLang === 'en' ? record.source : record.target;
    return (_jsx(PushPage, { palette: palette, title: record.source, onBack: props.onBack, trailing: _jsx("button", { type: "button", onClick: toggleStar, style: { border: 'none', background: 'transparent', color: palette.accent, fontSize: 17, cursor: 'pointer', padding: 8 }, "aria-label": record.starred ? t('unfavourite') : t('favourite'), children: _jsx(Icon, { name: record.starred ? 'star.fill' : 'star', size: 17 }) }), children: _jsxs("div", { style: { padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s5 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 11, fontWeight: 500, color: palette.muted, textTransform: 'uppercase' }, children: NATIVE_NAME[record.srcLang] }), _jsx("div", { style: { fontSize: 16, fontWeight: 500, color: palette.ink, marginTop: 6, userSelect: 'text' }, children: record.source })] }), _jsx("div", { style: { height: 1, background: palette.line } }), _jsxs("div", { children: [_jsxs("div", { style: { fontSize: 11, fontWeight: 500, color: palette.accent, textTransform: 'uppercase' }, children: [NATIVE_NAME[record.dstLang], busy ? ' …' : ''] }), _jsx("div", { style: { fontSize: 16, color: palette.ink, marginTop: 6, whiteSpace: 'pre-wrap', userSelect: 'text' }, children: record.target })] }), error ? _jsx("div", { style: { fontSize: 13, color: palette.red }, children: error }) : null, _jsxs("div", { style: { display: 'flex', gap: SPACE.s4, alignItems: 'center' }, children: [_jsx("button", { type: "button", style: { ...plain(palette), fontSize: 12 }, onClick: () => void copyText(record.target), children: t('copy') }), _jsxs("button", { type: "button", style: { ...plain(palette), fontSize: 12 }, onClick: () => void speak(speakText, 'us'), children: [_jsx(Icon, { name: "speaker", size: 12 }), " ", t('speakAloud')] }), _jsx(SecondaryButton, { palette: palette, title: t('retranslate'), icon: "refresh", disabled: busy, onClick: retranslate }), _jsx("div", { style: { flex: 1 } }), _jsx("button", { type: "button", style: { ...plain(palette), fontSize: 12, color: palette.red }, onClick: async () => {
                                await removeTranslation(record.id);
                                store.refresh();
                                props.onBack();
                            }, children: t('delete') })] })] }) }));
}
