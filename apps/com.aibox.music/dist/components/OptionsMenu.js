import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// ⋯ 溢出菜单（§1）与通用选项面板。
//
// 为什么自绘而不是 `aibox.ui.actionSheet`：原生这份菜单里有 **Toggle（随机）**、
// **带勾的子菜单（循环 / 睡眠定时器）**，action sheet 表达不了勾选态与两级结构，
// 而且上限 8 项。长按曲目那种「一排纯动作」仍然走原生 action sheet（见 app.jsx）。
//
// 与原生的两处差异（README 有记）：
//  · **Autoplay（无尽播放）** 是原生偏好键 `AudioAutoplay`，没有任何工具投影 → 整项不渲染；
//  · **歌词翻译**两项需要 AI 文本能力，本应用 `ai: false` → 整段不渲染。
import React from 'react';
import Icon from './Icon.js';
import { C, SPACE } from './theme.js';
const SLEEP_PRESETS = [5, 10, 15, 30, 45, 60];
export default function OptionsMenu({ open, onClose, tab, ctx, }) {
    const { t, music, actions } = ctx;
    const [submenu, setSubmenu] = React.useState(null);
    React.useEffect(() => {
        if (open)
            setSubmenu(null);
    }, [open]);
    if (!open)
        return null;
    const status = music.status;
    const timer = music.sleepTimer;
    const isPlayer = tab === 'player';
    const close = (run) => {
        onClose();
        if (run)
            void run();
    };
    const repeatIcon = status.repeatMode === 'one' ? 'repeat.1' : 'repeat';
    const repeatValue = {
        off: t('menu.repeatOff'),
        one: t('menu.repeatOne'),
        all: t('menu.repeatAll'),
    }[status.repeatMode] || t('menu.repeatOff');
    const timerValue = timer.endOfTrack
        ? t('menu.stopAfterSong')
        : timer.remaining !== null && timer.remaining !== undefined
            ? t('menu.stopIn', `${Math.floor(timer.remaining / 60)}:${String(timer.remaining % 60).padStart(2, '0')}`)
            : t('menu.notSet');
    return (_jsx("div", { className: "mu-sheet-backdrop", onClick: onClose, role: "presentation", children: _jsxs("div", { className: "mu-sheet", onClick: (event) => event.stopPropagation(), role: "presentation", children: [_jsx("div", { style: { padding: `10px ${SPACE.s4}px`, borderBottom: `0.5px solid ${C.line}` }, children: _jsx("span", { style: { fontSize: 13, color: C.muted }, children: submenu ? submenu.title : t('menu.options') }) }), _jsx("div", { className: "mu-scroll", style: { paddingBottom: 'env(safe-area-inset-bottom)' }, children: submenu ? (_jsxs(_Fragment, { children: [_jsx(MenuRow, { icon: "chevron.backward", title: t('common.back'), onClick: () => setSubmenu(null) }), submenu.items.map((item) => (_jsx(MenuRow, { icon: item.icon, title: item.title, checked: item.checked, danger: item.danger, onClick: () => close(item.run) }, item.id)))] })) : (_jsxs(_Fragment, { children: [isPlayer ? (_jsxs(_Fragment, { children: [_jsx(MenuRow, { icon: "shuffle", title: t('menu.shuffle'), trailing: _jsx(Toggle, { on: status.isShuffled }), onClick: () => music.setShuffle(!status.isShuffled) }), _jsx(MenuRow, { icon: repeatIcon, title: t('menu.repeat'), detail: repeatValue, onClick: () => setSubmenu({
                                            title: t('menu.repeat'),
                                            items: ['off', 'one', 'all'].map((mode) => ({
                                                id: mode,
                                                title: { off: t('menu.repeatOff'), one: t('menu.repeatOne'), all: t('menu.repeatAll') }[mode],
                                                checked: status.repeatMode === mode,
                                                run: () => music.setRepeat(mode),
                                            })),
                                        }) }), _jsx(MenuRow, { icon: "moon.zzz.fill", title: t('menu.sleepTimer'), detail: timerValue, onClick: () => setSubmenu({
                                            title: t('menu.sleepTimer'),
                                            items: [
                                                ...(timer.active
                                                    ? [
                                                        {
                                                            id: 'cancel',
                                                            icon: 'moon.zzz.fill',
                                                            title: t('menu.turnOffTimer'),
                                                            danger: true,
                                                            run: () => music.cancelSleepTimer(),
                                                        },
                                                    ]
                                                    : []),
                                                ...SLEEP_PRESETS.map((minutes) => ({
                                                    id: `m${minutes}`,
                                                    title: t('menu.minutes', minutes),
                                                    run: () => music.setSleepTimer(minutes),
                                                })),
                                                { id: 'eot', title: t('menu.endOfTrack'), run: () => music.setSleepTimerEndOfTrack() },
                                            ],
                                        }) }), _jsx(MenuRow, { icon: "slider.horizontal.3", title: t('menu.audioEffects'), onClick: () => close(() => actions.navigate({ name: 'effects' })) }), ctx.externalURL ? (_jsx(MenuRow, { icon: "square.and.arrow.up", title: t('common.share'), onClick: () => close(() => actions.shareCurrent()) })) : null, _jsx(Separator, {})] })) : null, _jsx(MenuRow, { icon: "gearshape", title: t('menu.musicSettings'), onClick: () => close(() => actions.navigate({ name: 'settings' })) })] })) })] }) }));
}
function MenuRow({ icon, title, detail, trailing, checked, danger, onClick, }) {
    return (_jsxs("button", { type: "button", className: "mu-btn mu-press", onClick: onClick, style: {
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            padding: `13px ${SPACE.s4}px`,
            borderBottom: `0.5px solid ${C.line}`,
            color: danger ? C.danger : C.ink,
        }, children: [icon ? _jsx(Icon, { name: icon, size: 18, color: danger ? C.danger : C.ink }) : _jsx("span", { style: { width: 18 } }), _jsx("span", { style: { flex: '1 1 auto', fontSize: 16 }, children: title }), detail ? _jsx("span", { style: { fontSize: 14, color: C.muted }, children: detail }) : null, checked ? _jsx(Icon, { name: "checkmark", size: 15, color: C.accent }) : null, trailing] }));
}
function Toggle({ on }) {
    return (_jsx("span", { style: {
            width: 38,
            height: 22,
            borderRadius: 11,
            position: 'relative',
            flex: '0 0 auto',
            background: on ? C.accent : `color-mix(in srgb, ${C.muted} 32%, transparent)`,
        }, children: _jsx("span", { style: {
                position: 'absolute',
                top: 2,
                left: on ? 18 : 2,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s ease-out',
            } }) }));
}
function Separator() {
    return _jsx("div", { style: { height: 8, background: C.bg } });
}
/** 通用单选面板（设置页的循环模式等复用它）。 */
export function OptionPicker({ request, onClose }) {
    if (!request)
        return null;
    return (_jsx("div", { className: "mu-sheet-backdrop", onClick: onClose, role: "presentation", children: _jsxs("div", { className: "mu-sheet", onClick: (event) => event.stopPropagation(), role: "presentation", children: [_jsx("div", { style: { padding: `10px ${SPACE.s4}px`, borderBottom: `0.5px solid ${C.line}` }, children: _jsx("span", { style: { fontSize: 13, color: C.muted }, children: request.title }) }), _jsx("div", { className: "mu-scroll", style: { paddingBottom: 'env(safe-area-inset-bottom)' }, children: request.options.map((option) => (_jsx(MenuRow, { title: option.title, checked: request.selected === option.id, onClick: () => {
                            onClose();
                            request.onPick(option.id);
                        } }, option.id))) })] }) }));
}
