import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 「我的」：扫码登录 + 登录后的观看历史。
//
// ## 登录这条链路的形状
//
// 1. `qrcode/generate` 拿到一个一次性 URL；
// 2. 用 `qrURL()` 在**本地**渲染成二维码（内容不出设备 —— 绝不能调第三方二维码服务，
//    那个 URL 谁拿到谁就能登录这个账号）；
// 3. 每 2 秒 `qrcode/poll` 一次；
// 4. 成功时 B 站在**响应头**下发 SESSDATA 等 cookie，宿主的 per-applet cookie 罐自动收下。
//    所以这里没有一行解析 Set-Cookie 的代码 —— 那本来就不该由页面做（多值 Set-Cookie
//    在响应头字典里已被合并成不可靠拆分的逗号串）。
//
// 同一台手机上扫自己屏幕上的码是不行的，所以页面明说：用另一台设备扫，或长按存图后在 B 站 App 里扫。
import React from 'react';
import * as ui from 'aibox/ui';
import { EmptyState, PrimaryButton, SectionTitle, SettingSwitch, Spinner } from './primitives.js';
import VideoCard from './VideoCard.js';
import { C, RADIUS, SPACE } from './theme.js';
import * as api from '../lib/api.js';
import { clearSession, hasSession, imageURL, secretsWritable, toast, } from '../lib/host.js';
import { formatCount } from '../lib/format.js';
import { DEFAULTS, loadSettings, updateSetting } from '../lib/settings.js';
const POLL_MS = 2000;
/**
 * `qrURL` 是 `aibox/ui` **1.3.0** 才有的导出，而市场包会被装到**别人的宿主**上。
 *
 * 所以这里必须是 namespace import + 运行时探测：ESM 的具名导入在导出不存在时会在**链接阶段**
 * 直接报错，整个应用连挂载都到不了 —— 一个「二维码画不出来」的降级，会变成「应用打不开」。
 *
 * 回退实现拼的是同一条 `applet://qr/` URL：老宿主没有那条路由，`<img>` 拿到 404，
 * 页面显示的是「二维码没画出来」而不是白屏——这才是正确的降级形状。
 */
const qrURL = typeof ui.qrURL === 'function'
    ? ui.qrURL
    : (content, options) => {
        const bytes = new TextEncoder().encode(String(content || ''));
        let binary = '';
        for (let i = 0; i < bytes.length; i += 1)
            binary += String.fromCharCode(bytes[i]);
        const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const size = Number((options || {}).size);
        return `applet://localhost/qr/${encoded}${size > 0 ? `?size=${Math.round(size)}` : ''}`;
    };
export default function MinePage({ onOpen }) {
    const [phase, setPhase] = React.useState('checking'); // checking | guest | qr | signedIn
    const [user, setUser] = React.useState(null);
    const [qr, setQR] = React.useState(null); // { url, key }
    const [hint, setHint] = React.useState('');
    const [historyList, setHistory] = React.useState([]);
    const [canPersist, setCanPersist] = React.useState(true);
    const [settings, setSettings] = React.useState(DEFAULTS);
    const pollTimer = React.useRef(null);
    const refresh = React.useCallback(async () => {
        setPhase('checking');
        // 真值是「罐里有没有 cookie」+「nav 认不认」。**不自己记 isLoggedIn 标志**：
        // cookie 会过期而标志不会，漂移后用户会看到「显示已登录但全是未登录数据」。
        const has = await hasSession();
        if (!has) {
            setPhase('guest');
            return;
        }
        try {
            const me = await api.me();
            if (!me) {
                setPhase('guest');
                return;
            }
            setUser(me);
            setPhase('signedIn');
            api.history().then(setHistory).catch(() => setHistory([]));
        }
        catch {
            setPhase('guest');
        }
    }, []);
    React.useEffect(() => {
        refresh();
        secretsWritable().then(setCanPersist);
        loadSettings().then(setSettings);
        return () => { if (pollTimer.current)
            clearInterval(pollTimer.current); };
    }, [refresh]);
    const startLogin = React.useCallback(async () => {
        try {
            const code = await api.loginQRCode();
            setQR(code);
            setHint('用另一台设备上的哔哩哔哩 App 扫码');
            setPhase('qr');
            if (pollTimer.current)
                clearInterval(pollTimer.current);
            pollTimer.current = setInterval(async () => {
                try {
                    const res = await api.loginPoll(code.key);
                    setHint(res.message);
                    if (res.status === 'ok') {
                        clearInterval(pollTimer.current);
                        pollTimer.current = null;
                        toast('登录成功');
                        refresh();
                    }
                    else if (res.status === 'expired') {
                        clearInterval(pollTimer.current);
                        pollTimer.current = null;
                    }
                }
                catch { /* 单次轮询失败不中断，下一拍再试 */ }
            }, POLL_MS);
        }
        catch (err) {
            toast(`拿不到二维码：${err?.message || err}`);
        }
    }, [refresh]);
    const signOut = React.useCallback(async () => {
        await clearSession();
        setUser(null);
        setHistory([]);
        setPhase('guest');
        toast('已退出登录');
    }, []);
    /** 播放设置。**登录与否都显示** —— 这些偏好和账号无关，
     *  而未登录恰恰是用户最可能第一次翻到这一页的时候。 */
    const settingsSection = (_jsxs("div", { style: { borderTop: `8px solid ${C.surface}` }, children: [_jsx(SectionTitle, { children: "\u64AD\u653E\u8BBE\u7F6E" }), _jsx(SettingSwitch, { title: "\u540E\u53F0\u64AD\u653E\u97F3\u9891", detail: "\u9000\u51FA\u5E94\u7528\u6216\u56DE\u5230\u684C\u9762\u540E\uFF0C\u753B\u9762\u6682\u505C\u4F46\u58F0\u97F3\u7EE7\u7EED \u2014\u2014 \u60F3\u300C\u542C\u89C6\u9891\u300D\u65F6\u7528\u3002", value: settings.backgroundAudio, onChange: async (v) => setSettings(await updateSetting('backgroundAudio', v)) }), _jsx(SettingSwitch, { title: "\u753B\u4E2D\u753B", detail: "\u79BB\u5F00\u5E94\u7528\u540E\u4FDD\u7559\u4E00\u4E2A\u6D6E\u7A97\u7EE7\u7EED\u64AD\u3002\u4E0E\u4E0A\u4E00\u9879\u4E0D\u540C\uFF1A\u8FD9\u4E2A\u7559\u753B\u9762\u3001\u4F1A\u5360\u4F4F\u5C4F\u5E55\u4E00\u89D2\u3002", value: settings.pictureInPicture, onChange: async (v) => setSettings(await updateSetting('pictureInPicture', v)) }), _jsx(SettingSwitch, { title: "\u624B\u52BF\u63A7\u5236", detail: "\u5728\u753B\u9762\u5DE6\u534A\u8FB9\u4E0A\u4E0B\u6ED1\u8C03\u4EAE\u5EA6\u3001\u53F3\u534A\u8FB9\u8C03\u97F3\u91CF\uFF0C\u53CC\u51FB\u6682\u505C\u6216\u7EE7\u7EED\u3002", value: settings.gestureControls, onChange: async (v) => setSettings(await updateSetting('gestureControls', v)) }), _jsx("div", { style: {
                    padding: `${SPACE.s2}px ${SPACE.s4}px ${SPACE.s4}px`,
                    fontSize: 11, color: C.faint, lineHeight: 1.6,
                }, children: "\u6539\u52A8\u5728\u4E0B\u4E00\u6B21\u70B9\u64AD\u653E\u65F6\u751F\u6548\u3002\u89C6\u9891\u5728\u9875\u9762\u9876\u90E8\u5185\u5D4C\u64AD\u653E\u3001\u4FDD\u6301\u7AD6\u5C4F\uFF1B \u8981\u6A2A\u5C4F\u70B9\u64AD\u653E\u5668\u53F3\u4E0B\u89D2\u7684\u5168\u5C4F\u6309\u94AE\u3002" })] }));
    if (phase === 'checking')
        return _jsx(Spinner, { label: "\u68C0\u67E5\u767B\u5F55\u72B6\u6001" });
    if (phase === 'qr' && qr) {
        return (_jsxs("div", { style: { padding: SPACE.s5, textAlign: 'center' }, children: [_jsx("div", { style: {
                        display: 'inline-block', padding: SPACE.s4,
                        background: '#fff', borderRadius: RADIUS.lg,
                    }, children: _jsx("img", { src: qrURL(qr.url, { size: 220, level: 'M' }), alt: "\u767B\u5F55\u4E8C\u7EF4\u7801", style: { width: 220, height: 220, display: 'block' } }) }), _jsx("div", { style: { marginTop: SPACE.s4, fontSize: 14, color: C.text }, children: hint }), _jsxs("div", { style: { marginTop: SPACE.s2, fontSize: 12, color: C.faint, lineHeight: 1.6 }, children: ["\u540C\u4E00\u53F0\u624B\u673A\u6CA1\u6CD5\u626B\u81EA\u5DF1\u7684\u5C4F\u5E55\u3002", _jsx("br", {}), "\u53EF\u4EE5\u957F\u6309\u4E8C\u7EF4\u7801\u5B58\u8FDB\u76F8\u518C\uFF0C\u518D\u7528\u54D4\u54E9\u54D4\u54E9 App \u4ECE\u76F8\u518C\u8BC6\u522B\u3002"] }), _jsxs("div", { style: { marginTop: SPACE.s5, display: 'flex', gap: SPACE.s2 }, children: [_jsx(PrimaryButton, { onClick: startLogin, children: "\u6362\u4E00\u4E2A\u4E8C\u7EF4\u7801" }), _jsx("button", { type: "button", onClick: () => { if (pollTimer.current)
                                clearInterval(pollTimer.current); setPhase('guest'); }, style: {
                                border: `1px solid ${C.line}`, background: 'transparent', color: C.sub,
                                borderRadius: RADIUS.md, padding: `0 ${SPACE.s4}px`, fontSize: 14, flexShrink: 0,
                            }, children: "\u53D6\u6D88" })] })] }));
    }
    if (phase === 'guest') {
        return (_jsxs("div", { className: "bl-scroll", style: { height: '100%', overflowY: 'auto' }, children: [_jsx(EmptyState, { title: "\u8FD8\u6CA1\u6709\u767B\u5F55", detail: '登录后可以看观看历史、个性化推荐和更高的清晰度。'
                        + (canPersist ? '' : '\n注意：这个构建存不住登录态（未签名的模拟器构建），下次启动要重新登录。'), actionLabel: "\u626B\u7801\u767B\u5F55", onAction: startLogin }), settingsSection, _jsx("div", { style: { height: SPACE.s6 } })] }));
    }
    return (_jsxs("div", { className: "bl-scroll", style: { height: '100%', overflowY: 'auto' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s3, padding: SPACE.s4 }, children: [user?.avatar ? (_jsx("img", { src: imageURL(user.avatar, 52), alt: "", style: { width: 52, height: 52, borderRadius: 26, objectFit: 'cover', background: C.surface } })) : null, _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 16, color: C.text, fontWeight: 500 }, children: user?.name }), _jsxs("div", { style: { fontSize: 12, color: C.faint, marginTop: 2 }, children: ["LV", user?.level, " \u00B7 ", formatCount(user?.coins || 0), "\u786C\u5E01"] })] }), _jsx("button", { type: "button", onClick: signOut, style: {
                            border: `1px solid ${C.line}`, background: 'transparent', color: C.sub,
                            borderRadius: RADIUS.md, padding: `6px ${SPACE.s3}px`, fontSize: 13,
                        }, children: "\u9000\u51FA" })] }), _jsxs("div", { style: { borderTop: `8px solid ${C.surface}`, paddingTop: SPACE.s2 }, children: [_jsx("div", { style: { padding: `${SPACE.s2}px ${SPACE.s4}px`, fontSize: 13, fontWeight: 600, color: C.sub }, children: "\u89C2\u770B\u5386\u53F2" }), historyList.length === 0 ? (_jsx(EmptyState, { title: "\u8FD8\u6CA1\u6709\u89C2\u770B\u8BB0\u5F55" })) : (historyList.map((video) => _jsx(VideoCard, { video: video, onOpen: onOpen }, video.bvid)))] }), settingsSection, _jsx("div", { style: { height: SPACE.s6 } })] }));
}
