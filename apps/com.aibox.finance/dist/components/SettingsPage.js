import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 设置页 —— 规格 §12「设置」段。
//
// 通知开关的 footer **如实说明降级**：这个容器只有 `notifications.schedule`，
// 没有后台唤醒，所以到价提醒只在 App 活跃、正在刷新行情时才会推。
// iCloud 自选同步在容器里没有对应能力 → 整块不渲染（不留一个点了没反应的开关）。
import React from 'react';
import { Card, Row, Segmented, Sheet, SheetHeader, Toggle } from './primitives.js';
import { C, SPACE } from './theme.js';
import { capabilities } from '../lib/host.js';
const INTERVALS = [15, 30, 60, 120];
const SOURCES = ['automatic', 'tencent', 'sina'];
export default function SettingsPage({ ctx }) {
    const { t, store, settings, actions } = ctx;
    const set = (patch) => store.updateSettings(patch);
    return (_jsx("div", { className: "fin-scroll", children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s4 }, children: [_jsxs(Card, { title: t('finance.settings.colorSection'), children: [_jsx(Row, { title: t('finance.settings.color'), last: true, accessory: _jsx("div", { style: { width: 190 }, children: _jsx(Segmented, { value: settings.upIsRed ? 'red' : 'green', onChange: (next) => set({ upIsRed: next === 'red' }), items: [
                                        { id: 'red', label: t('finance.settings.redUp') },
                                        { id: 'green', label: t('finance.settings.greenUp') },
                                    ] }) }) }), _jsxs("div", { style: { display: 'flex', gap: SPACE.s4, paddingTop: SPACE.s3 }, children: [_jsxs("span", { className: "fin-mono", style: { fontSize: 13, color: settings.upIsRed ? C.red : C.green }, children: [t('finance.settings.up'), " +1.23%"] }), _jsxs("span", { className: "fin-mono", style: { fontSize: 13, color: settings.upIsRed ? C.green : C.red }, children: [t('finance.settings.down'), " -1.23%"] }), _jsx("span", { className: "fin-mono", style: { fontSize: 13, color: C.muted }, children: "0.00%" })] })] }), _jsxs(Card, { title: t('finance.settings.refreshSection'), children: [_jsx(Row, { title: t('finance.settings.autoRefresh'), accessory: _jsx(Toggle, { checked: settings.autoRefresh, onChange: (next) => set({ autoRefresh: next }), label: t('finance.settings.autoRefresh') }) }), _jsx(Row, { title: t('finance.settings.refreshInterval'), accessory: _jsx("div", { style: { width: 190 }, children: _jsx(Segmented, { value: String(settings.refreshInterval), onChange: (next) => set({ refreshInterval: Number(next) }), items: INTERVALS.map((value) => ({ id: String(value), label: t('finance.settings.seconds', value) })) }) }) }), _jsx(Row, { title: t('finance.settings.quoteSource'), accessory: _jsx("div", { style: { width: 190 }, children: _jsx(Segmented, { value: settings.quoteSource, onChange: (next) => set({ quoteSource: next }), items: SOURCES.map((id) => ({
                                        id,
                                        label: id === 'automatic' ? t('finance.settings.sourceAuto') : id === 'sina' ? 'Sina' : 'Tencent',
                                    })) }) }) }), _jsx(Row, { title: t('finance.settings.industryRefresh'), last: true, accessory: _jsx(Toggle, { checked: settings.industryAutoRefresh, onChange: (next) => set({ industryAutoRefresh: next }), label: t('finance.settings.industryRefresh') }) }), _jsx("span", { style: { display: 'block', fontSize: 12, color: C.muted, lineHeight: 1.45, paddingTop: SPACE.s2 }, children: t('finance.settings.refreshFoot') })] }), capabilities.notifications ? (_jsxs(Card, { title: t('finance.settings.notifySection'), children: [_jsx(Row, { title: t('finance.settings.notify'), last: true, accessory: _jsx(Toggle, { checked: settings.notifyAlerts, onChange: (next) => set({ notifyAlerts: next }), label: t('finance.settings.notify') }) }), _jsx("span", { style: { display: 'block', fontSize: 12, color: C.muted, lineHeight: 1.45, paddingTop: SPACE.s2 }, children: t('finance.settings.notifyFoot') })] })) : null, _jsxs(Card, { title: t('finance.settings.manage'), children: [_jsx(Row, { title: t('finance.account.manage'), onClick: actions.openAccounts }), _jsx(Row, { title: t('finance.groups.title'), onClick: actions.openGroups, last: true })] }), _jsx(Card, { title: t('finance.storage.title'), children: _jsx(Row, { title: store.storageHealthy ? t('finance.storage.title') : t('finance.storage.degraded'), detail: store.storageHealthy ? 'OK' : '—', detailColor: store.storageHealthy ? C.muted : C.danger, last: true }) }), _jsxs(Card, { title: t('finance.settings.about'), children: [_jsx("span", { style: { display: 'block', fontSize: 13, color: C.muted, lineHeight: 1.5 }, children: t('finance.settings.dataSource') }), _jsx("span", { style: { display: 'block', fontSize: 13, color: C.muted, lineHeight: 1.5, paddingTop: 4 }, children: t('finance.settings.disclaimer') })] }), _jsx("div", { style: { height: SPACE.s6 } })] }) }));
}
/** 自选分组管理（设置 → 管理 → 自选分组）。 */
export function GroupsSheet({ ctx, visible, onClose }) {
    const { t, store } = ctx;
    const [name, setName] = React.useState('');
    return (_jsxs(Sheet, { visible: visible, onClose: onClose, children: [_jsx(SheetHeader, { title: t('finance.groups.title'), onClose: onClose, closeLabel: t('finance.done') }), _jsxs("div", { className: "fin-scroll", style: { padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s4 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: SPACE.s2 }, children: [_jsx("input", { className: "fin-field", style: { background: C.surface, borderRadius: 10, padding: '10px 12px', fontSize: 15 }, value: name, placeholder: t('finance.groups.name'), onChange: (event) => setName(event.target.value) }), _jsx("button", { type: "button", className: "fin-btn fin-press", disabled: !name.trim(), onClick: () => {
                                    store.createGroup(name.trim());
                                    setName('');
                                }, style: { color: C.brand, fontSize: 15, opacity: name.trim() ? 1 : 0.4, flex: '0 0 auto' }, children: t('finance.groups.add') })] }), _jsx(Card, { children: store.groups
                            .slice()
                            .sort((a, b) => a.sortOrder - b.sortOrder)
                            .map((row, index, all) => (_jsx(Row, { title: row.name.startsWith('group.') ? t(row.name) : row.name, subtitle: row.isDefault ? t('finance.groups.default') : null, detail: store.items.filter((item) => item.groupID === row.id).length, last: index === all.length - 1, accessory: row.isDefault ? undefined : (_jsx("button", { type: "button", className: "fin-btn fin-press", onClick: () => store.deleteGroup(row.id), style: { color: C.danger, fontSize: 13 }, children: t('finance.delete') })) }, row.id))) })] })] }));
}
