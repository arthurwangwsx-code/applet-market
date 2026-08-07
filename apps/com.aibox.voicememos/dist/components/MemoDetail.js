import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 播放详情页（规格 §4）。
//
// **4 个 Tab 不是 3 个**：摘要 / 原文 / 校正后 / 翻译，可左右横扫；进度点长在 Tab 标签上、
// 内容区不放第二个 spinner。首次进入默认 Tab：有摘要 → 摘要；否则 → 原文（只判一次）。
//
// ## 2.0.0：1.x 的两处降级都没有了
// 1.x 的这个页面是**分叉**的：宿主录音走"有转写、但读不到播放位置、也拿不到 segments"的一支，
// 本机剪辑走"能精确播放、但没有任何转写路径"的另一支。哪一支都不完整。
//
// 宿主补上 `aibox.audio.transcribe` 之后分叉消失，两半的长处合到同一个页面上：
//  · 转写来自 `aibox.audio.transcribe`，**带时间戳分段** → 原文 Tab 可以点句跳转、章节可以定位；
//  · 播放是页面自己的 `<audio>` → 有真 scrubber、有已播时间、进度与波形逐帧同步。
import { useMemo, useState } from 'react';
import { correct, summarize, translate, speakerDisplayName, TRANSLATION_LANGS, LANG_NAME, } from '../lib/ai.js';
import { clockString, hashText } from '../lib/format.js';
import { saveArtifacts } from '../lib/memos.js';
import { RADIUS, SPACE, alpha, speakerPalette } from '../lib/theme.js';
import { EmptyState, Icon, SecondaryButton, Sheet } from './primitives.js';
const TEMPLATES = ['general', 'meeting', 'interview', 'oneOnOne', 'lecture', 'podcast'];
export function MoreButton(props) {
    return (_jsx("button", { type: "button", onClick: props.onClick, style: {
            border: 'none',
            background: 'transparent',
            color: props.palette.accent,
            fontSize: 17,
            cursor: 'pointer',
            width: 44,
            height: 44,
        }, "aria-label": "More", children: _jsx(Icon, { name: "ellipsis", size: 17 }) }));
}
export function Centered({ children }) {
    return (_jsx("div", { style: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            textAlign: 'center',
        }, children: children }));
}
/** 4 个 Tab 的胶囊栏。进度点长在标签上；**原文 Tab 永不显示进度点**。 */
export function TabStrip(props) {
    const { palette, t } = props;
    const items = [
        { id: 'summary', label: t('tabSummary'), busy: props.artifacts?.summaryStatus === 'generating' },
        { id: 'original', label: t('tabOriginal'), busy: false },
        { id: 'corrected', label: t('tabCorrected'), busy: props.artifacts?.correctionStatus === 'generating' },
        { id: 'translation', label: t('tabTranslation'), busy: props.artifacts?.translationStatus === 'generating' },
    ];
    return (_jsx("div", { style: { padding: `${SPACE.s2}px ${SPACE.s4}px 4px` }, children: _jsx("div", { style: { display: 'flex', background: palette.surface, borderRadius: 999, padding: 4 }, children: items.map((item) => {
                const active = props.tab === item.id;
                return (_jsxs("button", { type: "button", onClick: () => props.onChange(item.id), style: {
                        flex: 1,
                        border: 'none',
                        borderRadius: 999,
                        padding: '7px 4px',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: active ? 600 : 400,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        color: active ? palette.onAccent : palette.muted,
                        background: active ? palette.accent : 'transparent',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                    }, children: [_jsx("span", { style: { overflow: 'hidden', textOverflow: 'ellipsis' }, children: item.label }), item.busy ? _jsx("span", { style: { fontSize: 10 }, children: "\u2022" }) : null] }, item.id));
            }) }) }));
}
// —— 摘要 Tab（§4.8） ——
export async function runSummary(context, template, onError) {
    const base = context.artifacts;
    if (!base || !context.text.trim())
        return;
    context.setArtifacts({ ...base, summaryStatus: 'generating', summaryTemplate: template });
    try {
        const result = await summarize(context.text, template);
        const next = {
            ...base,
            summaryText: result.text,
            summaryPoints: result.points,
            summaryTemplate: template,
            summaryStatus: 'ready',
            sourceHash: hashText(context.text),
        };
        context.setArtifacts(next);
        await saveArtifacts(next);
    }
    catch (error) {
        onError(String(error));
        context.setArtifacts({ ...base, summaryStatus: 'failed', summaryTemplate: template });
    }
}
export function SummaryTab(props) {
    const { palette, t, context } = props;
    const [picking, setPicking] = useState(false);
    const artifacts = context.artifacts;
    if (!artifacts)
        return null;
    const busy = artifacts.summaryStatus === 'generating';
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s4 }, children: [_jsx("div", { children: _jsxs("button", { type: "button", disabled: busy, onClick: () => setPicking(true), style: {
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        border: 'none',
                        borderRadius: 999,
                        padding: '7px 11px',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: busy ? 'default' : 'pointer',
                        color: palette.accent,
                        background: alpha(palette.accent, 0.1),
                        opacity: busy ? 0.5 : 1,
                    }, children: [_jsx(Icon, { name: "sparkles", size: 12 }), " ", templateLabel(t, artifacts.summaryTemplate)] }) }), busy ? _jsx("div", { style: { fontSize: 14, color: palette.muted, textAlign: 'center' }, children: t('summarizing') }) : null, !busy && artifacts.summaryText ? (_jsxs(_Fragment, { children: [artifacts.summaryStatus === 'stale' ? (_jsxs("div", { style: { fontSize: 12, color: palette.muted }, children: [_jsx(Icon, { name: "clock", size: 11 }), " ", t('stale'), " \u2014 ", t('staleTranscriptChanged')] })) : null, _jsx(Markdown, { palette: palette, text: artifacts.summaryText }), artifacts.summaryPoints.length ? (_jsx("ul", { style: { margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }, children: artifacts.summaryPoints.map((point, index) => (_jsx("li", { style: { fontSize: 15, color: palette.ink }, children: point }, index))) })) : null] })) : null, !busy && !artifacts.summaryText ? (artifacts.summaryStatus === 'failed' || artifacts.summaryStatus === 'stale' ? (_jsxs(Centered, { children: [_jsx(Icon, { name: "warning", size: 38, color: palette.orange }), _jsx("div", { style: { fontSize: 14, color: palette.muted, marginTop: SPACE.s3 }, children: t('summaryFailed') })] })) : (_jsxs(Centered, { children: [_jsx(Icon, { name: "sparkles", size: 40, color: palette.accent }), _jsx("div", { style: { fontSize: 17, fontWeight: 600, color: palette.ink, marginTop: SPACE.s3 }, children: t('noSummaryTitle') }), _jsx("div", { style: { fontSize: 14, color: palette.muted, marginTop: 6 }, children: t('noSummaryBody') })] }))) : null, _jsx(Sheet, { palette: palette, open: picking, onClose: () => setPicking(false), children: TEMPLATES.map((template) => (_jsxs("button", { type: "button", onClick: () => {
                        setPicking(false);
                        // 点任一项 = 立即用该模板（重新）生成。
                        void runSummary(context, template, props.onError);
                    }, style: {
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        border: 'none',
                        background: 'transparent',
                        padding: `12px ${SPACE.s4}px`,
                        fontSize: 15,
                        color: palette.ink,
                        cursor: 'pointer',
                        borderBottom: `1px solid ${palette.line}`,
                    }, children: [_jsx("span", { style: { flex: 1, textAlign: 'left' }, children: templateLabel(t, template) }), artifacts.summaryTemplate === template ? _jsx(Icon, { name: "check", size: 14, color: palette.accent }) : null] }, template))) })] }));
}
function templateLabel(t, template) {
    const map = {
        general: 'templateGeneral',
        meeting: 'templateMeeting',
        interview: 'templateInterview',
        oneOnOne: 'templateOneOnOne',
        lecture: 'templateLecture',
        podcast: 'templatePodcast',
    };
    return t(map[template]);
}
// —— 原文 Tab（§4.3 的可实现子集） ——
export function OriginalTab(props) {
    const { palette, t } = props;
    const paragraphs = useMemo(() => (props.transcript?.fullText ?? '')
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean), [props.transcript?.fullText]);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s4 }, children: [props.transcript?.isEdited ? (_jsxs("div", { style: { fontSize: 12, color: palette.muted }, children: [_jsx(Icon, { name: "pencil", size: 11 }), " ", t('edited')] })) : null, props.chaptersBusy ? (_jsx("div", { style: {
                    background: palette.surface,
                    borderRadius: RADIUS.field,
                    padding: SPACE.s4,
                    fontSize: 14,
                    color: palette.muted,
                }, children: t('findingChapters') })) : props.chapters.length ? (_jsxs("div", { style: { background: palette.surface, borderRadius: RADIUS.field, padding: SPACE.s4 }, children: [_jsxs("div", { style: { fontSize: 15, fontWeight: 600, color: palette.accent, marginBottom: SPACE.s2 }, children: [_jsx(Icon, { name: "list", size: 13 }), " ", t('chapters')] }), props.chapters.map((chapter, index) => (_jsxs("button", { type: "button", disabled: !props.hasAudio, onClick: () => props.onSeek(chapter.start), style: {
                            display: 'flex',
                            width: '100%',
                            alignItems: 'center',
                            gap: SPACE.s3,
                            border: 'none',
                            background: 'transparent',
                            padding: '7px 0',
                            cursor: props.hasAudio ? 'pointer' : 'default',
                        }, children: [_jsx("span", { style: { flex: 1, textAlign: 'left', fontSize: 15, color: palette.ink }, children: chapter.title }), _jsx("span", { style: { fontSize: 12, color: palette.muted, fontFamily: 'ui-monospace, monospace' }, children: clockString(chapter.start) })] }, `${chapter.title}-${index}`)))] })) : (_jsx(SecondaryButton, { palette: palette, title: t('chapters'), icon: "list", onClick: props.onGenerateChapters })), paragraphs.length === 0 ? (_jsx(EmptyState, { palette: palette, icon: "bubble", text: t('noTranscriptBody') })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s3 }, children: paragraphs.map((paragraph, index) => (_jsx("p", { style: { margin: 0, fontSize: 18, lineHeight: 1.6, color: palette.ink, userSelect: 'text' }, children: paragraph }, index))) }))] }));
}
// —— 校正后 Tab（§4.9） ——
export function CorrectedTab(props) {
    const { palette, t, context } = props;
    const artifacts = context.artifacts;
    const [mode, setMode] = useState(artifacts?.correctionMode ?? 'auto');
    const [count, setCount] = useState(Math.max(2, artifacts?.correctionSpeakers.length ?? 2));
    const [names, setNames] = useState(artifacts?.correctionSpeakers ?? ['', '']);
    if (!artifacts)
        return null;
    const busy = artifacts.correctionStatus === 'generating';
    const colors = speakerPalette(props.dark);
    const run = async () => {
        const base = context.artifacts;
        if (!base)
            return;
        // 运行中底色 50% 但**不禁用** —— 上次崩溃会把状态卡在 generating，禁用会让用户永远无法重试。
        context.setArtifacts({ ...base, correctionStatus: 'generating', correctionMode: mode });
        try {
            const turns = await correct({
                transcript: context.text,
                mode,
                speakers: names.slice(0, count).map((name, index) => name.trim() || `Speaker ${index + 1}`),
            });
            const next = {
                ...base,
                correctionTurns: turns,
                correctionStatus: 'ready',
                correctionMode: mode,
                correctionSpeakers: names.slice(0, count),
                sourceHash: hashText(context.text),
            };
            context.setArtifacts(next);
            await saveArtifacts(next);
        }
        catch (error) {
            props.onError(String(error));
            context.setArtifacts({ ...base, correctionStatus: 'failed', correctionMode: mode });
        }
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s4 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s2, flexWrap: 'wrap' }, children: [_jsx(Icon, { name: "person.2", size: 13, color: palette.muted }), _jsxs("select", { value: mode, onChange: (event) => setMode(event.target.value), style: {
                            border: `1px solid ${palette.line}`,
                            borderRadius: 8,
                            padding: '6px 8px',
                            fontSize: 13,
                            background: palette.surface,
                            color: palette.ink,
                        }, children: [_jsx("option", { value: "none", children: t('speakerModeNone') }), _jsx("option", { value: "auto", children: t('speakerModeAuto') }), _jsx("option", { value: "named", children: t('speakerModeNamed') })] }), mode === 'named' ? (_jsx("input", { type: "number", min: 2, max: 6, value: count, onChange: (event) => {
                            const value = Math.min(6, Math.max(2, Number(event.target.value) || 2));
                            setCount(value);
                            setNames((current) => {
                                const next = [...current];
                                while (next.length < value)
                                    next.push('');
                                return next.slice(0, value);
                            });
                        }, style: {
                            width: 56,
                            border: `1px solid ${palette.line}`,
                            borderRadius: 8,
                            padding: '6px 8px',
                            fontSize: 13,
                            background: palette.surface,
                            color: palette.ink,
                        } })) : null, _jsx("div", { style: { flex: 1 } }), _jsxs("button", { type: "button", disabled: !context.text.trim(), onClick: run, style: {
                            border: 'none',
                            borderRadius: 999,
                            padding: '8px 14px',
                            fontSize: 13,
                            fontWeight: 500,
                            color: palette.onAccent,
                            background: palette.accent,
                            cursor: 'pointer',
                            opacity: busy ? 0.5 : context.text.trim() ? 1 : 0.4,
                        }, children: [_jsx(Icon, { name: artifacts.correctionTurns.length ? 'refresh' : 'sparkles', size: 12 }), ' ', artifacts.correctionTurns.length ? t('recorrectAction') : t('correctAction')] })] }), mode === 'named' ? (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: new Array(count).fill(0).map((_, index) => (_jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACE.s2,
                        background: palette.surface,
                        borderRadius: 8,
                        padding: '6px 10px',
                    }, children: [_jsx("span", { style: { width: 8, height: 8, borderRadius: 4, background: colors[index % colors.length] } }), _jsx("input", { value: names[index] ?? '', onChange: (event) => setNames((current) => {
                                const next = [...current];
                                next[index] = event.target.value;
                                return next;
                            }), placeholder: t('speakerName', { n: index + 1 }), style: {
                                flex: 1,
                                border: 'none',
                                background: 'transparent',
                                fontSize: 14,
                                color: palette.ink,
                                outline: 'none',
                            } })] }, index))) })) : null, busy ? _jsx("div", { style: { fontSize: 14, color: palette.muted, textAlign: 'center' }, children: t('correcting') }) : null, !busy && artifacts.correctionTurns.length ? (_jsxs(_Fragment, { children: [artifacts.correctionStatus === 'stale' ? (_jsxs("div", { style: { fontSize: 12, color: palette.muted }, children: [_jsx(Icon, { name: "warning", size: 11 }), " ", t('staleTranscriptChanged')] })) : null, _jsx("div", { style: { fontSize: 11, color: palette.muted }, children: t('correctionNoTimestamps') }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s3 }, children: artifacts.correctionTurns.map((turn, index) => {
                            const previous = artifacts.correctionTurns[index - 1];
                            // 同一说话人连续发言只在第一段显示说话人标。
                            const showSpeaker = Boolean(turn.speaker) && previous?.speaker !== turn.speaker;
                            const color = colors[turn.colorIndex % colors.length];
                            return (_jsxs("div", { style: { background: palette.surface, borderRadius: 12, padding: SPACE.s3 }, children: [showSpeaker ? (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }, children: [_jsx("span", { style: { width: 9, height: 9, borderRadius: 5, background: color } }), _jsx("span", { style: { fontSize: 14, fontWeight: 600, color }, children: speakerDisplayName(turn.speaker, index, t('speakerName', { n: '{n}' })) })] })) : null, _jsx("div", { style: { fontSize: 17, lineHeight: 1.5, color: palette.ink, userSelect: 'text' }, children: turn.text })] }, index));
                        }) })] })) : null, !busy && artifacts.correctionTurns.length === 0 ? (artifacts.correctionStatus === 'failed' ? (_jsxs(Centered, { children: [_jsx(Icon, { name: "warning", size: 38, color: palette.orange }), _jsx("div", { style: { fontSize: 14, color: palette.muted, marginTop: SPACE.s3 }, children: t('correctionFailed') })] })) : (_jsxs(Centered, { children: [_jsx(Icon, { name: "wand", size: 40, color: palette.accent }), _jsx("div", { style: { fontSize: 17, fontWeight: 600, color: palette.ink, marginTop: SPACE.s3 }, children: t('noCorrectionTitle') }), _jsx("div", { style: { fontSize: 14, color: palette.muted, marginTop: 6 }, children: t('noCorrectionBody') })] }))) : null] }));
}
// —— 翻译 Tab（§4.10） ——
export function TranslationTab(props) {
    const { palette, t, context } = props;
    const artifacts = context.artifacts;
    const [lang, setLang] = useState(artifacts?.translationLang ?? 'en');
    const [bilingual, setBilingual] = useState(artifacts?.translationBilingual ?? false);
    if (!artifacts)
        return null;
    const busy = artifacts.translationStatus === 'generating';
    // **源文优先级**：校正稿非空 → 用校正稿；否则原始转写。
    const source = artifacts.correctionTurns.length
        ? artifacts.correctionTurns.map((turn) => turn.text).join('\n\n')
        : context.text;
    const run = async () => {
        const base = context.artifacts;
        if (!base)
            return;
        context.setArtifacts({
            ...base,
            translationStatus: 'generating',
            translationLang: lang,
            translationBilingual: bilingual,
        });
        try {
            const text = await translate({ text: source, lang, bilingual });
            const next = {
                ...base,
                translationText: text,
                translationLang: lang,
                translationBilingual: bilingual,
                translationStatus: 'ready',
                sourceHash: hashText(context.text),
            };
            context.setArtifacts(next);
            await saveArtifacts(next);
        }
        catch (error) {
            props.onError(String(error));
            context.setArtifacts({ ...base, translationStatus: 'failed', translationLang: lang });
        }
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s4 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s2, flexWrap: 'wrap' }, children: [_jsx(Icon, { name: "globe", size: 13, color: palette.muted }), _jsx("select", { value: lang, onChange: (event) => setLang(event.target.value), style: {
                            border: `1px solid ${palette.line}`,
                            borderRadius: 8,
                            padding: '6px 8px',
                            fontSize: 13,
                            background: palette.surface,
                            color: palette.ink,
                        }, children: TRANSLATION_LANGS.map((code) => (_jsx("option", { value: code, children: LANG_NAME[code] }, code))) }), _jsx("div", { style: { flex: 1 } }), _jsxs("button", { type: "button", disabled: !source.trim(), onClick: run, style: {
                            border: 'none',
                            borderRadius: 999,
                            padding: '8px 14px',
                            fontSize: 13,
                            fontWeight: 500,
                            color: palette.onAccent,
                            background: palette.accent,
                            cursor: 'pointer',
                            opacity: busy ? 0.5 : source.trim() ? 1 : 0.4,
                        }, children: [_jsx(Icon, { name: artifacts.translationText ? 'refresh' : 'globe', size: 12 }), ' ', artifacts.translationText ? t('retranslateAction') : t('translateAction')] })] }), _jsx("div", { style: { display: 'flex', background: palette.surface, borderRadius: 999, padding: 3 }, children: [false, true].map((value) => (_jsx("button", { type: "button", onClick: () => setBilingual(value), style: {
                        flex: 1,
                        border: 'none',
                        borderRadius: 999,
                        padding: '6px 0',
                        fontSize: 13,
                        cursor: 'pointer',
                        color: bilingual === value ? palette.onAccent : palette.muted,
                        background: bilingual === value ? palette.accent : 'transparent',
                    }, children: value ? t('bilingual') : t('translationOnly') }, String(value)))) }), busy ? _jsx("div", { style: { fontSize: 14, color: palette.muted, textAlign: 'center' }, children: t('translating') }) : null, !busy && artifacts.translationText ? (_jsxs(_Fragment, { children: [artifacts.translationStatus === 'stale' ? (_jsxs("div", { style: { fontSize: 12, color: palette.muted }, children: [_jsx(Icon, { name: "warning", size: 11 }), " ", t('staleTranscriptChanged')] })) : null, _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s3 }, children: artifacts.translationText
                            .split(/\n+/)
                            .filter(Boolean)
                            .map((paragraph, index) => (_jsx("p", { style: { margin: 0, fontSize: 17, lineHeight: 1.6, color: palette.ink, userSelect: 'text' }, children: paragraph }, index))) })] })) : null, !busy && !artifacts.translationText ? (_jsxs(Centered, { children: [_jsx(Icon, { name: "globe", size: 40, color: palette.accent }), _jsx("div", { style: { fontSize: 17, fontWeight: 600, color: palette.ink, marginTop: SPACE.s3 }, children: t('noTranslationTitle') }), _jsx("div", { style: { fontSize: 14, color: palette.muted, marginTop: 6 }, children: t('noTranslationBody') })] })) : null] }));
}
/** 极简 Markdown 渲染（`##` 段标题 + `-` 列表 + 段落）—— 模板摘要产出的就是这三种形态。 */
function Markdown(props) {
    const blocks = props.text.split('\n');
    return (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: blocks.map((line, index) => {
            const trimmed = line.trim();
            if (!trimmed)
                return null;
            if (trimmed.startsWith('## ')) {
                return (_jsx("div", { style: { fontSize: 15, fontWeight: 600, color: props.palette.accent, marginTop: 8 }, children: trimmed.slice(3) }, index));
            }
            if (trimmed.startsWith('# ')) {
                return (_jsx("div", { style: { fontSize: 17, fontWeight: 700, color: props.palette.ink }, children: trimmed.slice(2) }, index));
            }
            if (trimmed.startsWith('- ')) {
                return (_jsxs("div", { style: { fontSize: 15, color: props.palette.ink, paddingLeft: 14, position: 'relative' }, children: [_jsx("span", { style: { position: 'absolute', left: 2 }, children: "\u2022" }), stripBold(trimmed.slice(2))] }, index));
            }
            return (_jsx("p", { style: { margin: 0, fontSize: 15, lineHeight: 1.6, color: props.palette.ink }, children: stripBold(trimmed) }, index));
        }) }));
}
function stripBold(text) {
    return text.replace(/\*\*(.+?)\*\*/g, '$1');
}
