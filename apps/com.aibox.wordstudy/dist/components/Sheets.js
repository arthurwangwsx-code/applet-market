import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 三个半浮层：跟读评分（§8）/ 相册查词（§9）/ AI 单词伴侣（§3.5 的最小可用替代）。
import { useEffect, useRef, useState } from 'react';
import { cancelRecognizing, lookUpFromPhoto, partialTranscript, probeSpeech, recognize, shareWordContext, stopRecognizing, } from '../lib/host.js';
import { scorePronunciation } from '../lib/logic.js';
import { RADIUS, SPACE, alpha } from '../lib/theme.js';
import { EmptyState, Icon, PrimaryButton, SecondaryButton, Sheet } from './primitives.js';
export function PracticeSheet(props) {
    const { palette, t } = props;
    const [state, setState] = useState('idle');
    const [score, setScore] = useState(null);
    const [reason, setReason] = useState(null);
    const [detail, setDetail] = useState('');
    const [partial, setPartial] = useState('');
    const pending = useRef(null);
    useEffect(() => {
        if (!props.open)
            return;
        setState('idle');
        setScore(null);
        setPartial('');
        void (async () => {
            const probe = await probeSpeech('en-US');
            if (!probe.available) {
                setReason(probe.reason);
                setDetail(probe.detail);
                setState('unavailable');
            }
        })();
        // sheet 消失时取消录音。
        return () => {
            void cancelRecognizing();
        };
    }, [props.open]);
    // 录音中轮询中间文本，让用户看到"在听"。
    useEffect(() => {
        if (state !== 'recording')
            return;
        const timer = window.setInterval(async () => setPartial(await partialTranscript()), 400);
        return () => window.clearInterval(timer);
    }, [state]);
    const start = async () => {
        setState('requestingPermission');
        setPartial('');
        // 按住说话：**不 await** 地发起，松手再 stop + await。
        pending.current = recognize('en-US', 15_000);
        setState('recording');
    };
    const finish = async () => {
        setState('scoring');
        await stopRecognizing();
        const result = await pending.current;
        pending.current = null;
        if (!result || result.error) {
            setReason('engineError');
            setDetail(result?.error ?? '');
            setState('unavailable');
            return;
        }
        setScore(scorePronunciation(props.sentence, result.transcript));
        setState('result');
    };
    return (_jsxs(Sheet, { palette: palette, open: props.open, onClose: props.onClose, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', padding: SPACE.s4 }, children: [_jsxs("div", { style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 15,
                            fontWeight: 500,
                            color: palette.ink,
                        }, children: [_jsx(Icon, { name: "mic", size: 15 }), " ", t('practiceTitle')] }), _jsx("div", { style: { flex: 1 } }), _jsx("button", { type: "button", onClick: props.onClose, style: { border: 'none', background: 'transparent', color: palette.accent, fontSize: 15, cursor: 'pointer' }, children: t('done') })] }), _jsx("div", { style: { padding: `0 ${SPACE.s5}px`, fontSize: 17, fontWeight: 500, color: palette.ink, textAlign: 'center' }, children: props.sentence }), _jsxs("div", { style: { padding: `${SPACE.s6}px ${SPACE.s5}px ${SPACE.s6}px`, textAlign: 'center' }, children: [state === 'idle' ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: start, style: {
                                    border: 'none',
                                    background: 'transparent',
                                    color: palette.accent,
                                    cursor: 'pointer',
                                    lineHeight: 1,
                                }, "aria-label": t('practiceTapToStart'), children: _jsx(Icon, { name: "mic", size: 64 }) }), _jsx("div", { style: { fontSize: 12, color: palette.muted, marginTop: SPACE.s3 }, children: t('practiceTapToStart') })] })) : null, state === 'requestingPermission' || state === 'scoring' ? (_jsx("div", { style: { fontSize: 12, color: palette.muted }, children: state === 'scoring' ? t('practiceScoring') : '…' })) : null, state === 'recording' ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: finish, style: {
                                    border: 'none',
                                    background: 'transparent',
                                    color: palette.red,
                                    cursor: 'pointer',
                                    lineHeight: 1,
                                }, "aria-label": t('practiceRecording'), children: _jsx(Icon, { name: "stop", size: 64 }) }), _jsx("div", { style: { fontSize: 12, color: palette.muted, marginTop: SPACE.s3 }, children: t('practiceRecording') }), partial ? _jsx("div", { style: { fontSize: 13, color: palette.muted, marginTop: 6 }, children: partial }) : null] })) : null, state === 'result' && score ? (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s4, alignItems: 'center' }, children: [_jsxs("div", { style: { fontSize: 40, fontWeight: 500, color: scoreColor(palette, score.percent) }, children: [score.percent, "%"] }), _jsx("div", { style: { fontSize: 12, color: palette.muted }, children: t('practiceMatchLabel') }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }, children: score.words.map((word, index) => (_jsx("span", { style: {
                                        fontSize: 14,
                                        fontWeight: 500,
                                        borderRadius: 999,
                                        padding: '5px 10px',
                                        color: word.matched ? palette.green : palette.red,
                                        background: alpha(word.matched ? palette.green : palette.red, 0.12),
                                    }, children: word.text }, `${word.text}-${index}`))) }), _jsx(SecondaryButton, { palette: palette, title: t('practiceRetry'), icon: "refresh", onClick: () => setState('idle') })] })) : null, state === 'unavailable' ? (_jsxs("div", { children: [_jsx(Icon, { name: "warning", size: 32, color: palette.muted }), _jsx("div", { style: { fontSize: 13, color: palette.muted, marginTop: SPACE.s3 }, children: unavailableText(t, reason, detail) })] })) : null] })] }));
}
function scoreColor(palette, percent) {
    if (percent >= 80)
        return palette.green;
    if (percent >= 50)
        return palette.orange;
    return palette.red;
}
function unavailableText(t, reason, detail) {
    switch (reason) {
        case 'recognizerUnavailable':
            return t('speechRecognizerUnavailable');
        case 'onDeviceUnsupported':
            return t('speechOnDeviceUnsupported');
        case 'micDenied':
            return t('speechMicDenied');
        case 'speechDenied':
            return t('speechDenied');
        default:
            return detail || t('speechRecognizerUnavailable');
    }
}
// —— §9 相册查词 ——
export function PhotoSheet(props) {
    const { palette, t } = props;
    const [busy, setBusy] = useState(false);
    const [words, setWords] = useState(null);
    const [error, setError] = useState(null);
    const [preview, setPreview] = useState(null);
    useEffect(() => {
        if (props.open)
            return;
        setWords(null);
        setError(null);
        setPreview(null);
    }, [props.open]);
    const pick = async () => {
        setBusy(true);
        const result = await lookUpFromPhoto();
        setBusy(false);
        setPreview(result.previewURL);
        setWords(result.words);
        setError(result.error);
    };
    return (_jsxs(Sheet, { palette: palette, open: props.open, onClose: props.onClose, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', padding: SPACE.s4 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 500, color: palette.ink }, children: t('photoLookup') }), _jsx("div", { style: { flex: 1 } }), _jsx("button", { type: "button", onClick: props.onClose, style: { border: 'none', background: 'transparent', color: palette.accent, fontSize: 15, cursor: 'pointer' }, children: t('done') })] }), _jsx("div", { style: { padding: `0 ${SPACE.s5}px ${SPACE.s6}px`, textAlign: 'center' }, children: !preview && !words ? (_jsxs(_Fragment, { children: [_jsx(Icon, { name: "viewfinder", size: 48, color: palette.muted }), _jsx("div", { style: { fontSize: 13, color: palette.muted, margin: `${SPACE.s3}px ${SPACE.s6}px ${SPACE.s4}px` }, children: t('photoPickHint') }), _jsx(PrimaryButton, { palette: palette, title: t('photoPick'), busy: busy, onClick: pick })] })) : (_jsxs(_Fragment, { children: [preview ? (_jsx("img", { src: preview, alt: "", style: { maxWidth: '100%', maxHeight: 240, borderRadius: RADIUS.card, objectFit: 'contain' } })) : null, _jsxs("div", { style: { marginTop: SPACE.s4 }, children: [error === 'load' ? (_jsx("div", { style: { fontSize: 13, color: palette.muted }, children: t('photoLoadFailed') })) : null, error === 'unsupported' ? (_jsx("div", { style: { fontSize: 13, color: palette.muted }, children: t('photoUnsupported') })) : null, error === 'empty' ? _jsx("div", { style: { fontSize: 13, color: palette.muted }, children: t('photoNoText') }) : null, !error && words?.length ? (_jsxs(_Fragment, { children: [_jsx("div", { style: { fontSize: 12, color: palette.muted, marginBottom: SPACE.s2 }, children: t('photoTapWord') }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }, children: words.map((word) => (_jsx("button", { type: "button", onClick: () => {
                                                    props.onPickWord(word);
                                                    props.onClose();
                                                }, style: {
                                                    border: 'none',
                                                    borderRadius: 999,
                                                    padding: '5px 10px',
                                                    fontSize: 14,
                                                    color: palette.accent,
                                                    background: alpha(palette.accent, 0.12),
                                                    cursor: 'pointer',
                                                }, children: word }, word))) })] })) : null] }), _jsx("div", { style: { marginTop: SPACE.s4 }, children: _jsx(SecondaryButton, { palette: palette, title: t('photoChange'), icon: "photo", onClick: pick }) })] })) })] }));
}
// —— §3.5 AI 单词伴侣 ——
/**
 * 页面内自建的轻量对话面板。
 * 拿不到原生那套「同 identity 复用底层会话 + toolScope 限定 + 会话列表场景徽标」，
 * 但**行为上等价**：5 个 chip 就是 5 个预置 prompt + 词条上下文拼进 system。
 * 差异只在于它不进 App 的会话历史 —— 想进主聊天时点「转到主聊天」。
 */
export function AiCompanion(props) {
    const { palette, t } = props;
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const seeded = useRef('');
    const system = `The user is looking at this dictionary entry:\n\n${props.entryText}`;
    const send = async (text) => {
        const value = text.trim();
        if (!value || busy)
            return;
        setInput('');
        setMessages((current) => [...current, { role: 'user', text: value }, { role: 'assistant', text: '' }]);
        setBusy(true);
        const bridge = typeof window !== 'undefined' ? window.aibox : undefined;
        if (!bridge?.ai) {
            setMessages((current) => replaceLast(current, t('errNoProvider')));
            setBusy(false);
            return;
        }
        try {
            if (typeof bridge.ai.generateStream === 'function') {
                let accumulated = '';
                for await (const delta of bridge.ai.generateStream({ system, prompt: value, intent: 'balanced' })) {
                    accumulated += delta;
                    setMessages((current) => replaceLast(current, accumulated));
                }
            }
            else {
                const reply = await bridge.ai.generate({ system, prompt: value, intent: 'balanced' });
                setMessages((current) => replaceLast(current, reply));
            }
        }
        catch (error) {
            setMessages((current) => replaceLast(current, String(error)));
        }
        finally {
            setBusy(false);
        }
    };
    // 带种子进来时自动发一条（原生 `autoSend` 语义）。
    useEffect(() => {
        if (!props.open) {
            setMessages([]);
            seeded.current = '';
            return;
        }
        if (props.seed && seeded.current !== props.seed) {
            seeded.current = props.seed;
            void send(props.seed);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.open, props.seed]);
    const chips = [
        { label: t('chipSimpler'), seed: `Give me a simpler example sentence for "${props.word}".` },
        { label: t('chipOther'), seed: `Does "${props.word}" have other common meanings or uses I should know about?` },
        {
            label: t('chipStory'),
            seed: `Tell me a short, vivid memory story or association to help me remember "${props.word}".`,
        },
        { label: t('chipWrite'), seed: `Help me write my own sentence using "${props.word}", and correct it if needed.` },
        { label: t('chipQuiz'), seed: `Quiz me on "${props.word}" with a couple of quick questions.` },
    ];
    return (_jsxs(Sheet, { palette: palette, open: props.open, onClose: props.onClose, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', padding: SPACE.s4 }, children: [_jsxs("div", { style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 15,
                            fontWeight: 500,
                            color: palette.ink,
                        }, children: [_jsx(Icon, { name: "sparkles", size: 15, color: palette.accent }), " ", t('companionTitle')] }), _jsx("div", { style: { flex: 1 } }), _jsx("button", { type: "button", onClick: () => void shareWordContext(`Tell me more about the English word "${props.word}".`), style: { border: 'none', background: 'transparent', color: palette.accent, fontSize: 12, cursor: 'pointer' }, children: t('sendToChat') }), _jsx("button", { type: "button", onClick: props.onClose, style: {
                            border: 'none',
                            background: 'transparent',
                            color: palette.accent,
                            fontSize: 15,
                            cursor: 'pointer',
                            marginLeft: SPACE.s3,
                        }, children: t('done') })] }), _jsx("div", { style: { padding: `0 ${SPACE.s4}px`, display: 'flex', flexWrap: 'wrap', gap: 6 }, children: chips.map((chip) => (_jsx("button", { type: "button", onClick: () => void send(chip.seed), style: {
                        border: 'none',
                        borderRadius: 999,
                        padding: '8px 12px',
                        fontSize: 13,
                        fontWeight: 500,
                        color: palette.accent,
                        background: alpha(palette.accent, 0.1),
                        cursor: 'pointer',
                    }, children: chip.label }, chip.label))) }), _jsxs("div", { style: { padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s3, minHeight: 160 }, children: [messages.length === 0 ? (_jsx(EmptyState, { palette: palette, icon: "sparkles", text: t('companionPlaceholder') })) : null, messages.map((message, index) => (_jsx("div", { style: {
                            alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            borderRadius: 18,
                            padding: '10px 13px',
                            fontSize: 15,
                            whiteSpace: 'pre-wrap',
                            color: message.role === 'user' ? palette.onAccent : palette.ink,
                            background: message.role === 'user' ? palette.accent : palette.surface,
                        }, children: message.text || '…' }, index)))] }), _jsxs("div", { style: { display: 'flex', gap: SPACE.s2, padding: `0 ${SPACE.s4}px ${SPACE.s4}px` }, children: [_jsx("input", { value: input, onChange: (event) => setInput(event.target.value), onKeyDown: (event) => {
                            if (event.key === 'Enter')
                                void send(input);
                        }, placeholder: t('companionPlaceholder'), style: {
                            flex: 1,
                            borderRadius: RADIUS.field,
                            border: `1px solid ${palette.line}`,
                            padding: '10px 12px',
                            fontSize: 15,
                            background: palette.surface,
                            color: palette.ink,
                        } }), _jsx(PrimaryButton, { palette: palette, title: "\u2191", busy: busy, disabled: !input.trim(), onClick: () => void send(input) })] })] }));
}
function replaceLast(messages, text) {
    const next = [...messages];
    next[next.length - 1] = { role: 'assistant', text };
    return next;
}
