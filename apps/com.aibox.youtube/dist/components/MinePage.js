import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// 「我的」：观看历史 + 播放设置。
//
// 这个应用**没有登录**（YouTube 要 Google OAuth，需要跳外部网页，而容器的导航白名单
// 只放行 `applet://`），所以这一页不是账号页，而是「我看过什么」+「播放怎么表现」。
import React from 'react';
import VideoCard from './VideoCard.js';
import { EmptyState, SectionTitle, SettingSwitch } from './primitives.js';
import { C, SPACE } from './theme.js';
import { loadPref, savePref } from '../lib/host.js';
import { DEFAULTS, loadSettings, updateSetting } from '../lib/settings.js';
const HISTORY_KEY = 'watch-history';
export default function MinePage({ onOpen }) {
    const [history, setHistory] = React.useState([]);
    const [settings, setSettings] = React.useState(DEFAULTS);
    React.useEffect(() => {
        loadPref(HISTORY_KEY, []).then((h) => setHistory(h || []));
        loadSettings().then(setSettings);
    }, []);
    return (_jsxs("div", { className: "yt-scroll", style: { height: '100%', overflowY: 'auto', background: C.bg }, children: [_jsx(SectionTitle, { children: "\u6700\u8FD1\u89C2\u770B" }), history.length === 0 ? (_jsx(EmptyState, { title: "\u8FD8\u6CA1\u6709\u89C2\u770B\u8BB0\u5F55", detail: "\u641C\u7D22\u5E76\u64AD\u653E\u4E00\u4E2A\u89C6\u9891\u540E\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002" })) : (_jsxs(_Fragment, { children: [history.slice(0, 30).map((v) => (_jsx(VideoCard, { video: v, onOpen: onOpen }, v.id))), _jsx("div", { style: { padding: `${SPACE.s2}px ${SPACE.s4}px` }, children: _jsx("button", { type: "button", onClick: () => { setHistory([]); savePref(HISTORY_KEY, []); }, style: {
                                border: `1px solid ${C.line}`, background: 'transparent', color: C.sub,
                                borderRadius: 10, padding: `7px ${SPACE.s4}px`, fontSize: 13,
                            }, children: "\u6E05\u7A7A\u8BB0\u5F55" }) })] })), _jsxs("div", { style: { borderTop: `8px solid ${C.surface}` }, children: [_jsx(SectionTitle, { children: "\u64AD\u653E\u8BBE\u7F6E" }), _jsx(SettingSwitch, { title: "\u540E\u53F0\u64AD\u653E\u97F3\u9891", detail: "\u9000\u51FA\u5E94\u7528\u6216\u56DE\u5230\u684C\u9762\u540E\uFF0C\u753B\u9762\u6682\u505C\u4F46\u58F0\u97F3\u7EE7\u7EED \u2014\u2014 \u60F3\u300C\u542C\u89C6\u9891\u300D\u65F6\u7528\u3002", value: settings.backgroundAudio, onChange: async (v) => setSettings(await updateSetting('backgroundAudio', v)) }), _jsx(SettingSwitch, { title: "\u753B\u4E2D\u753B", detail: "\u79BB\u5F00\u5E94\u7528\u540E\u4FDD\u7559\u4E00\u4E2A\u6D6E\u7A97\u7EE7\u7EED\u64AD\u3002\u4E0E\u4E0A\u4E00\u9879\u4E0D\u540C\uFF1A\u8FD9\u4E2A\u7559\u753B\u9762\u3001\u4F1A\u5360\u4F4F\u5C4F\u5E55\u4E00\u89D2\u3002", value: settings.pictureInPicture, onChange: async (v) => setSettings(await updateSetting('pictureInPicture', v)) }), _jsx(SettingSwitch, { title: "\u624B\u52BF\u63A7\u5236", detail: "\u5728\u753B\u9762\u5DE6\u534A\u8FB9\u4E0A\u4E0B\u6ED1\u8C03\u4EAE\u5EA6\u3001\u53F3\u534A\u8FB9\u8C03\u97F3\u91CF\uFF0C\u53CC\u51FB\u6682\u505C\u6216\u7EE7\u7EED\u3002", value: settings.gestureControls, onChange: async (v) => setSettings(await updateSetting('gestureControls', v)) }), _jsx("div", { style: {
                            padding: `${SPACE.s2}px ${SPACE.s4}px ${SPACE.s4}px`,
                            fontSize: 11, color: C.faint, lineHeight: 1.6,
                        }, children: "\u6539\u52A8\u5728\u4E0B\u4E00\u6B21\u70B9\u64AD\u653E\u65F6\u751F\u6548\u3002\u89C6\u9891\u5728\u9875\u9762\u9876\u90E8\u5185\u5D4C\u64AD\u653E\u3001\u4FDD\u6301\u7AD6\u5C4F\uFF1B \u8981\u6A2A\u5C4F\u70B9\u64AD\u653E\u5668\u53F3\u4E0B\u89D2\u7684\u5168\u5C4F\u6309\u94AE\u3002" })] }), _jsx("div", { style: { height: SPACE.s6 } })] }));
}
