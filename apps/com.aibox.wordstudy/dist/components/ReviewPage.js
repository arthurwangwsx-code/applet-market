import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 复习流（规格 §7）。三态：空 / 卡片流 / 完成页。
//
// 两条必须守住：
//  · 题型按**队列下标轮换**（index % 3），不是随机 —— 中断续跑重进时题目必须一模一样；
//  · 会话锚点存的是**词面数组**（不是对象）+ 当前下标。
import { useEffect, useMemo, useState } from 'react';
import { loadAnchor, saveAnchor, saveReview } from '../lib/db.js';
import { haptic, speak } from '../lib/host.js';
import { dueQueue, isCorrect, planExercise, scheduleNext, tomorrowPreview } from '../lib/logic.js';
import { RADIUS, SPACE, alpha } from '../lib/theme.js';
import { Icon, PrimaryButton, PushPage } from './primitives.js';
export function ReviewPage(props) {
    const { palette, t, store } = props;
    const [queue, setQueue] = useState(null);
    const [index, setIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [answer, setAnswer] = useState('');
    const [verdict, setVerdict] = useState(null);
    const [reviewed, setReviewed] = useState(0);
    const [tomorrow, setTomorrow] = useState(0);
    const [finished, setFinished] = useState(false);
    // 中断续跑：有锚点 → 按词面重新取回条目、下标取 min(存的下标, 队列长度)；否则新拉一批并写锚点。
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const anchor = await loadAnchor();
            if (cancelled)
                return;
            if (anchor && anchor.terms.length) {
                const byTerm = new Map(store.vocab.map((item) => [item.text, item]));
                const restored = anchor.terms.map((term) => byTerm.get(term)).filter(Boolean);
                if (restored.length) {
                    setQueue(restored);
                    setIndex(Math.min(anchor.index, restored.length));
                    return;
                }
            }
            const fresh = dueQueue(store.vocab);
            setQueue(fresh);
            setIndex(0);
            if (fresh.length)
                await saveAnchor({ terms: fresh.map((item) => item.text), index: 0 });
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const current = queue && index < queue.length ? queue[index] : null;
    const exercise = useMemo(() => (current ? planExercise({ index, item: current, entry: store.entryOf(current.text) }) : null), [current, index, store.entryOf]);
    const entry = current ? store.entryOf(current.text) : null;
    const grade = async (value) => {
        if (!current || !queue)
            return;
        const next = scheduleNext(current.box, value);
        await saveReview(current.text, next.box, next.nextReviewAt);
        void haptic('light');
        setReviewed((count) => count + 1);
        setFlipped(false);
        setAnswer('');
        setVerdict(null);
        const nextIndex = index + 1;
        if (nextIndex >= queue.length) {
            // 下标走完 → 清空续跑锚点 + 算一次明日预告，进完成页。
            await saveAnchor(null);
            store.refresh();
            setTomorrow(tomorrowPreview(store.vocab));
            setFinished(true);
            return;
        }
        setIndex(nextIndex);
        await saveAnchor({ terms: queue.map((item) => item.text), index: nextIndex });
        store.refresh();
    };
    if (queue === null)
        return (_jsx(PushPage, { palette: palette, title: t('reviewTitle'), onBack: props.onBack, children: _jsx("div", {}) }));
    if (finished) {
        return (_jsx(PushPage, { palette: palette, title: t('reviewTitle'), onBack: props.onBack, children: _jsxs(Centered, { children: [_jsx(Icon, { name: "checkmark.seal", size: 48, color: palette.green }), _jsx("div", { style: { fontSize: 17, fontWeight: 500, color: palette.ink, marginTop: SPACE.s3 }, children: t('reviewDoneCount', { n: reviewed }) }), tomorrow > 0 ? (_jsx("div", { style: { fontSize: 13, color: palette.muted, marginTop: 6 }, children: t('reviewTomorrow', { n: tomorrow }) })) : null, _jsx("div", { style: { marginTop: SPACE.s5 }, children: _jsx(PrimaryButton, { palette: palette, title: t('done'), onClick: props.onBack }) })] }) }));
    }
    if (queue.length === 0 || !current || !exercise) {
        return (_jsx(PushPage, { palette: palette, title: t('reviewTitle'), onBack: props.onBack, children: _jsxs(Centered, { children: [_jsx(Icon, { name: "checkmark.seal", size: 40, color: palette.green }), _jsx("div", { style: { fontSize: 15, fontWeight: 500, color: palette.ink, marginTop: SPACE.s3 }, children: t('reviewEmpty') })] }) }));
    }
    return (_jsx(PushPage, { palette: palette, title: t('reviewTitle'), onBack: props.onBack, children: _jsxs("div", { style: {
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100%',
                padding: `${SPACE.s4}px 0 ${SPACE.s5}px`,
            }, children: [_jsxs("div", { style: { padding: `0 ${SPACE.s5}px` }, children: [_jsx("div", { style: { height: 4, borderRadius: 2, background: palette.line, overflow: 'hidden' }, children: _jsx("div", { style: { width: `${(index / queue.length) * 100}%`, height: '100%', background: palette.accent } }) }), _jsxs("div", { style: { fontSize: 12, color: palette.muted, marginTop: 6 }, children: [index + 1, " / ", queue.length] })] }), _jsx("div", { style: { flex: 1 } }), _jsx("div", { style: {
                        margin: `0 ${SPACE.s5}px`,
                        minHeight: 220,
                        background: palette.surface,
                        borderRadius: RADIUS.card,
                        padding: SPACE.s5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: SPACE.s3,
                    }, children: !flipped ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: palette.accent,
                                }, children: [_jsx(Icon, { name: kindIcon(exercise.kind), size: 12 }), " ", kindLabel(t, exercise.kind)] }), exercise.kind === 'listening' ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: () => void speak(current.text, 'us'), style: {
                                            border: 'none',
                                            background: 'transparent',
                                            color: palette.accent,
                                            fontSize: 52,
                                            cursor: 'pointer',
                                            lineHeight: 1,
                                        }, "aria-label": t('speakAloud'), children: _jsx(Icon, { name: "speaker", size: 52 }) }), _jsx("div", { style: { fontSize: 14, color: palette.muted, textAlign: 'center' }, children: t('listeningHint') })] })) : (_jsx("div", { style: {
                                    fontSize: exercise.kind === 'cloze' ? 18 : 16,
                                    fontWeight: 500,
                                    color: palette.ink,
                                    textAlign: 'center',
                                }, children: exercise.prompt ?? t('promptFallback') })), _jsx("input", { value: answer, onChange: (event) => setAnswer(event.target.value), onKeyDown: (event) => {
                                    if (event.key !== 'Enter' || !answer.trim())
                                        return;
                                    setVerdict(isCorrect(answer, exercise.answer));
                                    setFlipped(true);
                                }, placeholder: t('answerPlaceholder'), autoCapitalize: "none", autoCorrect: "off", spellCheck: false, enterKeyHint: "done", style: {
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    borderRadius: 10,
                                    border: `1px solid ${palette.line}`,
                                    padding: '10px 12px',
                                    fontSize: 16,
                                    background: palette.bg,
                                    color: palette.ink,
                                } })] })) : (_jsxs(_Fragment, { children: [verdict !== null ? (_jsxs("div", { style: { fontSize: 13, fontWeight: 500, color: verdict ? palette.green : palette.orange }, children: [_jsx(Icon, { name: verdict ? 'check' : 'refresh', size: 13 }), ' ', verdict ? t('answerCorrect') : t('answerKeepPracticing')] })) : null, _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s2 }, children: [_jsx("span", { style: { fontSize: 28, fontWeight: 500, color: palette.ink }, children: current.text }), _jsx("button", { type: "button", onClick: () => void speak(current.text, 'us'), style: { border: 'none', background: 'transparent', color: palette.accent, cursor: 'pointer' }, "aria-label": t('speakAloud'), children: _jsx(Icon, { name: "speaker", size: 18 }) })] }), entry?.phoneticUK ? (_jsxs("div", { style: { fontSize: 14, color: palette.muted }, children: ["/", entry.phoneticUK, "/"] })) : null, _jsx("div", { style: { height: 1, background: palette.line, width: '100%' } }), current.brief ? (_jsx("div", { style: { fontSize: 16, color: palette.ink, textAlign: 'center' }, children: current.brief })) : null, entry?.examTags.length ? (_jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }, children: entry.examTags.map((tag) => (_jsx("span", { style: {
                                        fontSize: 12,
                                        color: palette.muted,
                                        background: palette.line,
                                        borderRadius: 999,
                                        padding: '4px 9px',
                                    }, children: tag }, tag))) })) : null, current.note ? (_jsxs("div", { style: {
                                    width: '100%',
                                    background: alpha(palette.accent, 0.08),
                                    borderRadius: RADIUS.field,
                                    padding: SPACE.s3,
                                }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 500, color: palette.muted }, children: t('savedContext') }), _jsx("div", { style: { fontSize: 14, color: palette.ink, marginTop: 4 }, children: current.note })] })) : null, current.kind === 'word' ? (_jsx("button", { type: "button", onClick: () => props.onOpenWord(current.text), style: {
                                    border: 'none',
                                    background: 'transparent',
                                    color: palette.accent,
                                    fontSize: 12,
                                    cursor: 'pointer',
                                }, children: t('viewFullDetail') })) : null] })) }), _jsx("div", { style: { flex: 1 } }), !flipped ? (_jsxs("div", { style: { padding: `0 ${SPACE.s5}px`, display: 'flex', flexDirection: 'column', gap: SPACE.s2 }, children: [_jsx(PrimaryButton, { palette: palette, title: t('checkAnswer'), block: true, disabled: !answer.trim(), onClick: () => {
                                setVerdict(isCorrect(answer, exercise.answer));
                                setFlipped(true);
                            } }), _jsx("button", { type: "button", onClick: () => {
                                setVerdict(null);
                                setFlipped(true);
                            }, style: {
                                border: 'none',
                                background: 'transparent',
                                color: palette.muted,
                                fontSize: 14,
                                padding: 8,
                                cursor: 'pointer',
                            }, children: t('showAnswer') })] })) : (_jsxs("div", { style: { padding: `0 ${SPACE.s5}px`, display: 'flex', gap: SPACE.s3 }, children: [_jsx(GradeButton, { palette: palette, label: t('gradeForgot'), tint: palette.red, onClick: () => void grade('forgot') }), _jsx(GradeButton, { palette: palette, label: t('gradeFuzzy'), tint: palette.orange, onClick: () => void grade('fuzzy') }), _jsx(GradeButton, { palette: palette, label: t('gradeKnow'), tint: palette.green, onClick: () => void grade('know') })] }))] }) }));
}
function GradeButton(props) {
    return (_jsx("button", { type: "button", onClick: props.onClick, style: {
            flex: 1,
            border: 'none',
            borderRadius: RADIUS.field,
            padding: '12px 0',
            fontSize: 14,
            fontWeight: 500,
            color: props.tint,
            background: alpha(props.tint, 0.12),
            cursor: 'pointer',
        }, children: props.label }));
}
function Centered({ children }) {
    return (_jsx("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
            textAlign: 'center',
        }, children: children }));
}
function kindLabel(t, kind) {
    if (kind === 'listening')
        return t('exerciseListening');
    if (kind === 'cloze')
        return t('exerciseCloze');
    return t('exerciseSpelling');
}
function kindIcon(kind) {
    if (kind === 'listening')
        return 'ear';
    if (kind === 'cloze')
        return 'blank';
    return 'pencil';
}
