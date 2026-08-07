import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 播放详情页的状态编排与页面骨架。
import { useEffect, useRef, useState } from 'react';
import { chapters as generateChapters } from '../lib/ai.js';
import { hashText } from '../lib/format.js';
import { listClips, loadArtifacts, localeTag, saveArtifacts, saveClip, transcribeClip } from '../lib/memos.js';
import { SPACE, alpha } from '../lib/theme.js';
import { Centered, CorrectedTab, MoreButton, OriginalTab, runSummary, SummaryTab, TabStrip, TranslationTab, } from './MemoDetail.js';
import { ClipPlayer } from './MemoPlayback.js';
import { Icon, PrimaryButton, PushPage } from './primitives.js';
export function MemoDetail(props) {
    const { palette, t, memo } = props;
    const [transcript, setTranscript] = useState(null);
    const [artifacts, setArtifacts] = useState(null);
    const [tab, setTab] = useState(null);
    const [chaptersBusy, setChaptersBusy] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const [segments, setSegments] = useState([]);
    const [error, setError] = useState('');
    /** 播放器的 seek 出口。章节 / 分段点击都经它跳转——1.x 这条线在宿主播放器上根本不存在。 */
    const seekRef = useRef(null);
    // 载入转写 + applet 侧衍生产物。转写现在长在剪辑记录上，不再有第二个数据源。
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const clip = (await listClips()).find((item) => item.id === memo.id);
            if (cancelled)
                return;
            const next = clip?.transcriptText
                ? {
                    status: clip.transcriptStatus ?? 'completed',
                    fullText: clip.transcriptText,
                    locale: clip.transcriptLocale ?? '',
                    isEdited: false,
                    segmentCount: clip.transcriptSegments?.length ?? 0,
                }
                : clip
                    ? { status: clip.transcriptStatus ?? 'none', fullText: '', locale: '', isEdited: false, segmentCount: 0 }
                    : null;
            setTranscript(next);
            setSegments(clip?.transcriptSegments ?? []);
            const loaded = await loadArtifacts(memo.id, next?.fullText ?? '');
            if (cancelled)
                return;
            setArtifacts(loaded);
            // 首次进入默认 Tab：只判一次，不打断用户后续手动切换。
            setTab((current) => current ?? (loaded.summaryText ? 'summary' : 'original'));
        })();
        return () => {
            cancelled = true;
        };
    }, [memo.id]);
    const text = transcript?.fullText ?? '';
    const context = {
        memo,
        transcript,
        artifacts,
        setArtifacts,
        text,
        segments,
        seek: (seconds) => seekRef.current?.(seconds),
    };
    // 上报给根视图配系统 ⋯ 菜单。**按签名而不是按 context 触发**：context 每帧重建，
    // 直接进依赖数组就是每帧过一次桥。签名里只放真正影响菜单可见性的几件事。
    const contextRef = useRef(context);
    contextRef.current = context;
    const onContextRef = useRef(props.onContext);
    onContextRef.current = props.onContext;
    const menuSignature = `${memo.id}|${text.trim() ? 1 : 0}|${artifacts?.summaryText ? 1 : 0}`;
    useEffect(() => {
        onContextRef.current?.(contextRef.current);
    }, [menuSignature]);
    // 离开详情页把菜单项收回去 —— 留着的话在列表页点 ⋯ 会看到一整排「对哪条录音操作？」的孤儿项。
    useEffect(() => () => {
        onContextRef.current?.(null);
    }, []);
    /** 转写这一条录音。同步等待到出结果——宿主侧每个 applet 同时只允许一条，排队没有意义。 */
    const runTranscription = async () => {
        const clip = (await listClips()).find((item) => item.id === memo.id);
        if (!clip?.handle || transcribing)
            return;
        setTranscribing(true);
        setError('');
        const outcome = await transcribeClip(clip.handle, localeTag(props.settings.transcribeLocale));
        setTranscribing(false);
        if (!outcome.ok) {
            setTranscript({ status: 'failed', fullText: '', locale: '', isEdited: false, segmentCount: 0 });
            setError(outcome.error);
            const latest = (await listClips()).find((item) => item.id === memo.id) ?? clip;
            await saveClip({ ...latest, transcriptStatus: 'failed' });
            return;
        }
        const latest = (await listClips()).find((item) => item.id === memo.id) ?? clip;
        await saveClip({
            ...latest,
            transcriptText: outcome.text,
            transcriptLocale: outcome.locale,
            transcriptSegments: outcome.segments,
            transcriptStatus: 'completed',
        });
        setTranscript({
            status: 'completed',
            fullText: outcome.text,
            locale: outcome.locale,
            isEdited: false,
            segmentCount: outcome.segments.length,
        });
        setSegments(outcome.segments);
        props.onRefresh();
    };
    // 详情页自动跑（规格 §13.7）：**只补空、不重复、不覆盖**用户已生成/已改的结果。
    useEffect(() => {
        if (!artifacts || !text.trim())
            return;
        if (!props.settings.autoSummarize)
            return;
        if (artifacts.summaryStatus !== 'none')
            return;
        void runSummary(context, props.settings.defaultTemplate, setError);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [artifacts?.memoID, text, props.settings.autoSummarize]);
    const status = transcribing ? 'inProgress' : (transcript?.status ?? 'none');
    return (_jsx(PushPage, { palette: palette, title: memo.title, onBack: props.onBack, chrome: props.chrome, trailing: props.hostMenu ? undefined : _jsx(MoreButton, { palette: palette, onClick: () => props.onMenu(context) }), footer: _jsx(ClipPlayer, { palette: palette, t: t, memo: memo, onSeekReady: (seek) => {
                seekRef.current = seek;
            }, registerPlayerCommand: props.registerPlayerCommand }), children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', minHeight: '100%' }, children: [!memo.hasAudio ? (_jsxs("div", { style: { background: alpha(palette.orange, 0.1), padding: `${SPACE.s3}px ${SPACE.s4}px` }, children: [_jsxs("div", { style: { fontSize: 13, fontWeight: 500, color: palette.orange }, children: [_jsx(Icon, { name: "waveform.slash", size: 13 }), " ", t('audioRemovedTitle')] }), _jsx("div", { style: { fontSize: 12, color: palette.muted, marginTop: 2 }, children: t('audioRemovedBody') })] })) : null, status === 'completed' ? (_jsxs(_Fragment, { children: [_jsx(TabStrip, { palette: palette, t: t, tab: tab ?? 'original', artifacts: artifacts, onChange: setTab }), _jsxs("div", { style: { flex: 1, padding: `${SPACE.s3}px ${SPACE.s5}px ${SPACE.s6}px` }, children: [(tab ?? 'original') === 'summary' ? (_jsx(SummaryTab, { palette: palette, t: t, context: context, settings: props.settings, onError: setError })) : null, (tab ?? 'original') === 'original' ? (_jsx(OriginalTab, { palette: palette, t: t, transcript: transcript, chapters: artifacts?.chapters ?? [], chaptersBusy: chaptersBusy, hasAudio: memo.hasAudio, onSeek: (seconds) => seekRef.current?.(seconds), onGenerateChapters: async () => {
                                        if (!artifacts)
                                            return;
                                        setChaptersBusy(true);
                                        // 秒数用真实分段回查校准，不信模型编的时间戳（见 lib/ai.ts chapters 注释）。
                                        const next = await generateChapters(text, segments).catch(() => []);
                                        setChaptersBusy(false);
                                        const merged = { ...artifacts, chapters: next, sourceHash: hashText(text) };
                                        setArtifacts(merged);
                                        await saveArtifacts(merged);
                                    } })) : null, (tab ?? 'original') === 'corrected' ? (_jsx(CorrectedTab, { palette: palette, t: t, dark: props.dark, context: context, onError: setError })) : null, (tab ?? 'original') === 'translation' ? (_jsx(TranslationTab, { palette: palette, t: t, context: context, onError: setError })) : null, error ? _jsx("div", { style: { fontSize: 13, color: palette.red, marginTop: SPACE.s3 }, children: error }) : null] })] })) : null, status === 'pending' || status === 'inProgress' ? (_jsxs(Centered, { children: [_jsx("div", { style: { fontSize: 17, fontWeight: 600, color: palette.ink }, children: t('transcribingTitle') }), _jsx("div", { style: { fontSize: 14, color: palette.muted, marginTop: 6 }, children: t('transcribingBody') })] })) : null, status === 'none' || status === 'failed' ? (_jsxs(Centered, { children: [_jsx(Icon, { name: status === 'failed' ? 'warning' : 'bubble', size: 46, color: palette.accent }), _jsx("div", { style: { fontSize: 17, fontWeight: 600, color: palette.ink, marginTop: SPACE.s3 }, children: status === 'failed' ? t('transcribeFailedTitle') : t('noTranscriptTitle') }), _jsx("div", { style: { fontSize: 14, color: palette.muted, marginTop: 6, maxWidth: 300 }, children: status === 'failed' ? t('transcribeFailedBody') : t('noTranscriptBody') }), memo.hasAudio ? (_jsx("div", { style: { marginTop: SPACE.s5 }, children: _jsx(PrimaryButton, { palette: palette, title: status === 'failed' ? t('retry') : t('transcribeAction'), onClick: () => void runTranscription() }) })) : null] })) : null] }) }));
}
