import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 音效页（§2.16）。三段：开关 / 速度 / 均衡器。**改动即时应用**，没有「保存」按钮。
// 全部经 `music_effects`（宿主工具覆盖完整，这一页没有降级）。
import React from 'react';
import { Card, ListHeader, Row, Spinner } from './primitives.js';
import { Switch } from './SettingsPage.js';
import { C, SPACE } from './theme.js';
import { bandLabel, gainLabel, presetRateLabel, rateLabel } from '../lib/format.js';
const PRESETS = ['flat', 'bass', 'vocal', 'treble', 'rock', 'pop', 'jazz', 'classical'];
const RATE_PRESETS = [0.75, 1, 1.25, 1.5, 2];
export default function EffectsPage({ ctx }) {
    const { t, music } = ctx;
    const effects = music.effects;
    React.useEffect(() => { music.refreshEffects(); }, [music]);
    if (!effects) {
        return _jsx("div", { style: { padding: 60, display: 'flex', justifyContent: 'center' }, children: _jsx(Spinner, { color: C.muted }) });
    }
    const bands = Array.isArray(effects.bands) ? effects.bands : [];
    const preset = String(effects.preset || 'flat');
    return (_jsxs("div", { className: "mu-scroll", children: [_jsx(Card, { style: { marginTop: SPACE.s4 }, children: _jsx(Row, { title: t('effects.enabled'), accessory: (_jsx(Switch, { value: !!effects.enabled, onChange: (value) => music.updateEffects('enable', { enabled: value }) })), last: true }) }), _jsxs("div", { style: { padding: `6px ${SPACE.s5}px ${SPACE.s2}px`, fontSize: 12, color: C.muted, lineHeight: 1.45 }, children: [t('effects.footer'), effects.appliesToCurrentTrack === false ? ` ${t('effects.appleMusicNote')}` : ''] }), _jsx(ListHeader, { children: t('effects.speed') }), _jsx(Card, { children: _jsxs("div", { style: { padding: `12px ${SPACE.s4}px` }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', paddingBottom: 4 }, children: [_jsx("span", { style: { fontSize: 16 }, children: t('effects.speed') }), _jsx("span", { className: "mu-mono", style: { fontSize: 15, color: C.muted }, children: rateLabel(effects.rate) })] }), _jsx("input", { className: "mu-slider", type: "range", min: "0.5", max: "2", step: "0.05", value: Number(effects.rate) || 1, onChange: (event) => music.updateEffects('set_rate', { rate: Number(event.target.value) }) }), _jsx("div", { style: { display: 'flex', gap: 6, paddingTop: 8 }, children: RATE_PRESETS.map((rate) => {
                                const active = Math.abs(Number(effects.rate) - rate) < 0.001;
                                return (_jsx("button", { type: "button", className: "mu-btn mu-press", onClick: () => music.updateEffects('set_rate', { rate }), style: {
                                        flex: '1 1 0', textAlign: 'center', padding: '6px 0', borderRadius: 999, fontSize: 13,
                                        background: active
                                            ? `color-mix(in srgb, ${C.accent} 18%, transparent)`
                                            : `color-mix(in srgb, ${C.muted} 12%, transparent)`,
                                        color: active ? C.accent : C.ink,
                                    }, children: presetRateLabel(rate) }, rate));
                            }) })] }) }), _jsx(ListHeader, { children: t('effects.equalizer') }), _jsxs(Card, { children: [_jsxs("div", { style: { padding: `12px ${SPACE.s4}px`, borderBottom: `0.5px solid ${C.line}` }, children: [_jsx("span", { style: { fontSize: 13, color: C.muted }, children: t('effects.preset') }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 8 }, children: PRESETS.concat(preset === 'custom' ? ['custom'] : []).map((name) => {
                                    const active = preset === name;
                                    return (_jsx("button", { type: "button", className: "mu-btn mu-press", onClick: () => { if (name !== 'custom')
                                            music.updateEffects('preset', { preset: name }); }, style: {
                                            padding: '6px 12px', borderRadius: 999, fontSize: 13,
                                            background: active
                                                ? `color-mix(in srgb, ${C.accent} 18%, transparent)`
                                                : `color-mix(in srgb, ${C.muted} 12%, transparent)`,
                                            color: active ? C.accent : C.ink,
                                        }, children: name === 'custom' ? t('effects.custom') : name.charAt(0).toUpperCase() + name.slice(1) }, name));
                                }) })] }), bands.map((band) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, padding: `6px ${SPACE.s4}px` }, children: [_jsx("span", { className: "mu-mono", style: { fontSize: 11, color: C.muted, width: 40 }, children: bandLabel(band.frequencyHz) }), _jsx("input", { className: "mu-slider", style: { flex: '1 1 auto' }, type: "range", min: "-12", max: "12", step: "1", value: Number(band.gainDB) || 0, onChange: (event) => music.updateEffects('set_band', {
                                    bandIndex: band.index, gainDB: Number(event.target.value),
                                }) }), _jsx("span", { className: "mu-mono", style: { fontSize: 11, color: C.muted, width: 30, textAlign: 'right' }, children: gainLabel(band.gainDB) })] }, band.index))), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, padding: `10px ${SPACE.s4}px` }, children: [_jsx("span", { style: { fontSize: 13, color: C.muted, width: 68 }, children: t('effects.preamp') }), _jsx("input", { className: "mu-slider", style: { flex: '1 1 auto' }, type: "range", min: "-12", max: "12", step: "1", value: Number(effects.preampDB) || 0, onChange: (event) => music.updateEffects('set_preamp', { preampDB: Number(event.target.value) }) }), _jsx("span", { className: "mu-mono", style: { fontSize: 11, color: C.muted, width: 30, textAlign: 'right' }, children: gainLabel(effects.preampDB) })] })] }), _jsx("div", { style: { height: 24 } })] }));
}
