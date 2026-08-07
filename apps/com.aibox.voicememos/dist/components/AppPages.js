import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 语音备忘录的文件夹、回收站与设置页面。由根视图拆出，保持根路由只负责状态编排。
import { Toggle } from './MemoList.js';
import { Icon, PushPage } from './primitives.js';
import { byteSize, clockString } from '../lib/format.js';
import { deleteClip, saveClip } from '../lib/memos.js';
import { confirmDestructive } from '../lib/dialogs.js';
import { SPACE, alpha, brandTint } from '../lib/theme.js';
// —— 文件夹 Tab（智能列表段可实现，用户文件夹段不行） ——
export function LibraryTab(props) {
    const { palette, t } = props;
    const rows = [
        { id: 'all', icon: 'waveform', label: t('smartAllRecordings'), badge: props.memos.length },
        {
            id: 'fav',
            icon: 'star.fill',
            label: t('smartFavourites'),
            badge: props.memos.filter((memo) => memo.isFavourite).length,
        },
    ];
    return (_jsxs("div", { style: { padding: `${SPACE.s4}px 0` }, children: [rows.map((row) => (_jsxs("button", { type: "button", onClick: () => props.onScope(row.id), style: {
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    gap: SPACE.s3,
                    border: 'none',
                    background: 'transparent',
                    padding: `12px ${SPACE.s4}px`,
                    cursor: 'pointer',
                    borderBottom: `1px solid ${palette.line}`,
                }, children: [_jsx(Icon, { name: row.icon, size: 16, color: palette.accent }), _jsx("span", { style: { flex: 1, textAlign: 'left', fontSize: 16, color: palette.ink }, children: row.label }), _jsx("span", { style: { fontSize: 14, color: palette.muted }, children: row.badge }), _jsx(Icon, { name: "chevron", size: 14, color: palette.muted })] }, row.id))), _jsxs("button", { type: "button", onClick: props.onTrash, style: {
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    gap: SPACE.s3,
                    border: 'none',
                    background: 'transparent',
                    padding: `12px ${SPACE.s4}px`,
                    cursor: 'pointer',
                    borderBottom: `1px solid ${palette.line}`,
                    marginTop: SPACE.s4,
                }, children: [_jsx(Icon, { name: "trash", size: 16, color: palette.accent }), _jsx("span", { style: { flex: 1, textAlign: 'left', fontSize: 16, color: palette.ink }, children: t('recentlyDeleted') }), _jsx("span", { style: { fontSize: 14, color: palette.muted }, children: props.trashCount }), _jsx(Icon, { name: "chevron", size: 14, color: palette.muted })] }), _jsx("div", { style: { padding: `${SPACE.s4}px ${SPACE.s4}px`, fontSize: 12, color: palette.muted }, children: t('foldersUnavailable') })] }));
}
// —— 最近删除（只覆盖本机剪辑：宿主没有 `memo_trash` 工具投影） ——
export function TrashPage(props) {
    const { palette, t } = props;
    const trashed = props.store.clips.filter((clip) => clip.isTrashed);
    return (_jsx(PushPage, { palette: palette, title: t('recentlyDeleted'), onBack: props.onBack, chrome: props.chrome, trailing: trashed.length ? (_jsx("button", { type: "button", onClick: async () => {
                const ok = await confirmDestructive(t('emptyTrashConfirmTitle'), t('emptyTrash'), t('cancel'));
                if (!ok)
                    return;
                for (const clip of trashed)
                    await deleteClip(clip.id);
                props.store.refresh();
            }, style: {
                border: 'none',
                background: 'transparent',
                color: palette.red,
                fontSize: 15,
                cursor: 'pointer',
                padding: 8,
            }, children: t('emptyTrash') })) : undefined, children: trashed.length === 0 ? (_jsxs("div", { style: { padding: `${SPACE.s8}px ${SPACE.s5}px`, textAlign: 'center' }, children: [_jsx(Icon, { name: "trash", size: 40, color: palette.muted }), _jsx("div", { style: { fontSize: 17, fontWeight: 600, color: palette.ink, marginTop: SPACE.s3 }, children: t('trashEmptyTitle') }), _jsx("div", { style: { fontSize: 14, color: palette.muted, marginTop: 6 }, children: t('trashEmptyBody') })] })) : (_jsxs(_Fragment, { children: [trashed.map((clip) => (_jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACE.s3,
                        padding: `10px ${SPACE.s4}px`,
                        borderBottom: `1px solid ${palette.line}`,
                    }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 16, fontWeight: 500, color: palette.ink }, children: clip.title }), _jsx("div", { style: { fontSize: 12, color: palette.muted }, children: clockString(clip.durationMs / 1000) })] }), _jsx("button", { type: "button", onClick: async () => {
                                await saveClip({ ...clip, isTrashed: false, trashedAt: null });
                                props.store.refresh();
                            }, style: {
                                border: 'none',
                                background: 'transparent',
                                color: palette.accent,
                                fontSize: 18,
                                cursor: 'pointer',
                            }, "aria-label": t('restore'), children: _jsx(Icon, { name: "gobackward", size: 18 }) }), _jsx("button", { type: "button", onClick: async () => {
                                const ok = await confirmDestructive(t('deleteConfirmTitle'), t('deletePermanently'), t('cancel'));
                                if (!ok)
                                    return;
                                await deleteClip(clip.id);
                                props.store.refresh();
                            }, style: {
                                border: 'none',
                                background: 'transparent',
                                color: palette.red,
                                fontSize: 16,
                                cursor: 'pointer',
                            }, "aria-label": t('deletePermanently'), children: _jsx(Icon, { name: "trash", size: 16 }) })] }, clip.id))), _jsx("div", { style: { padding: SPACE.s4, fontSize: 12, color: palette.muted }, children: t('trashFooter') })] })) }));
}
// —— 设置 Tab ——
export function SettingsTab(props) {
    const { palette, t, settings } = props;
    const bytes = props.clips.reduce((sum, clip) => sum + clip.byteCount, 0);
    const templates = ['general', 'meeting', 'interview', 'oneOnOne', 'lecture', 'podcast'];
    const templateLabels = {
        general: t('templateGeneral'),
        meeting: t('templateMeeting'),
        interview: t('templateInterview'),
        oneOnOne: t('templateOneOnOne'),
        lecture: t('templateLecture'),
        podcast: t('templatePodcast'),
    };
    return (_jsxs("div", { style: { padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s5 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s3 }, children: [_jsx("div", { style: {
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: alpha(brandTint(props.dark), 0.15),
                            color: brandTint(props.dark),
                            fontSize: 20,
                        }, children: _jsx(Icon, { name: "mic", size: 20 }) }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 16, fontWeight: 600, color: palette.ink }, children: t('titleVoiceMemos') }), _jsxs("div", { style: { fontSize: 12, color: palette.muted }, children: [t('settingsAI'), " \u00B7 ", t('settingsRecording')] })] })] }), _jsxs("section", { children: [_jsx("div", { style: { fontSize: 12, fontWeight: 500, color: palette.muted, textTransform: 'uppercase', marginBottom: 6 }, children: t('settingsRecording') }), _jsx(Picker, { palette: palette, label: t('transcribeLanguage'), value: settings.transcribeLocale, options: [
                            { value: 'auto', label: t('localeAuto') },
                            { value: 'zh_CN', label: t('localeZh') },
                            { value: 'en_US', label: t('localeEn') },
                        ], onChange: (value) => props.onChange({ transcribeLocale: value }) }), _jsx("div", { style: { fontSize: 12, color: palette.muted, margin: '4px 0 10px' }, children: t('transcribeLanguageHint') }), _jsx(Picker, { palette: palette, label: t('quality'), value: settings.quality, options: [
                            { value: 'high', label: t('qualityHigh') },
                            { value: 'medium', label: t('qualityMedium') },
                            { value: 'low', label: t('qualityLow') },
                        ], onChange: (value) => props.onChange({ quality: value }) }), _jsx("div", { style: { fontSize: 12, color: palette.muted, marginTop: 4 }, children: t('qualityHint') })] }), _jsxs("section", { children: [_jsx("div", { style: { fontSize: 12, fontWeight: 500, color: palette.muted, textTransform: 'uppercase', marginBottom: 6 }, children: t('settingsAI') }), _jsx(Toggle, { palette: palette, label: t('autoTranscribe'), value: settings.autoTranscribe, onChange: (value) => props.onChange({ autoTranscribe: value }) }), _jsx(Toggle, { palette: palette, label: t('autoSummarize'), hint: t('autoSummarizeHint'), value: settings.autoSummarize, onChange: (value) => props.onChange({ autoSummarize: value }) }), _jsx(Picker, { palette: palette, label: t('defaultTemplate'), value: settings.defaultTemplate, options: templates.map((template) => ({ value: template, label: templateLabels[template] })), onChange: (value) => props.onChange({ defaultTemplate: value }) })] }), _jsxs("section", { children: [_jsx("div", { style: { fontSize: 12, fontWeight: 500, color: palette.muted, textTransform: 'uppercase', marginBottom: 6 }, children: t('settingsStorage') }), _jsx(StatRow, { palette: palette, label: t('clipCount'), value: String(props.clips.length) }), _jsx(StatRow, { palette: palette, label: t('clipBytes'), value: byteSize(bytes) }), _jsx("div", { style: { fontSize: 12, color: palette.muted, marginTop: 8 }, children: t('hostSettingsNote') })] })] }));
}
function Picker(props) {
    return (_jsxs("label", { style: {
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.s3,
            padding: '10px 0',
            fontSize: 15,
            color: props.palette.ink,
        }, children: [_jsx("span", { style: { flex: 1 }, children: props.label }), _jsx("select", { value: props.value, onChange: (event) => props.onChange(event.target.value), style: {
                    border: `1px solid ${props.palette.line}`,
                    borderRadius: 8,
                    padding: '6px 8px',
                    fontSize: 14,
                    background: props.palette.surface,
                    color: props.palette.ink,
                }, children: props.options.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }));
}
function StatRow(props) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', padding: '10px 0', fontSize: 15, color: props.palette.ink }, children: [_jsx("span", { style: { flex: 1 }, children: props.label }), _jsx("span", { style: { color: props.palette.muted, fontSize: 14 }, children: props.value })] }));
}
