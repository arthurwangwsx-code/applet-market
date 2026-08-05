// 应用级数据仓。**2.0.0 起只有一个数据源**：本应用自己的剪辑（`aibox.db` + applet 资源域）。
// 1.x 这里是「宿主录音库 + 本机剪辑」的合并视图，因为转写只有宿主那条线有；
// `aibox.audio.transcribe` 补上之后合并没有了理由，也就没有了「宿主模块不在场时半个应用变空」的风险。
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clipToMemo, listClips, loadSetting, saveSetting } from './memos.js';
import { DEFAULT_SETTINGS } from './types.js';
const SETTINGS_KEY = 'settings';
export function useMemoStore() {
    const [ready, setReady] = useState(false);
    const [clips, setClips] = useState([]);
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [tick, setTick] = useState(0);
    const refresh = useCallback(() => setTick((value) => value + 1), []);
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const [nextClips, stored] = await Promise.all([
                listClips(),
                loadSetting(SETTINGS_KEY, {}),
            ]);
            if (cancelled)
                return;
            setClips(nextClips);
            setSettings({ ...DEFAULT_SETTINGS, ...stored });
            setReady(true);
        })();
        return () => { cancelled = true; };
    }, [tick]);
    const memos = useMemo(() => clips.filter((clip) => !clip.isTrashed).map(clipToMemo).sort((a, b) => b.createdAt - a.createdAt), [clips]);
    const updateSettings = useCallback((patch) => {
        setSettings((current) => {
            const next = { ...current, ...patch };
            void saveSetting(SETTINGS_KEY, next);
            return next;
        });
    }, []);
    return {
        ready,
        memos,
        clips,
        settings,
        updateSettings,
        refresh,
    };
}
