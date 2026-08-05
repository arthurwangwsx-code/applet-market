import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 添加订阅源表单：名称（可空 → 用 endpoint 顶替）、地址、类型 Picker（rawValue 不本地化）、主题 Picker。
// 「测试来源」走正式抓取链路但不写库；改 endpoint / kind / topic 会清空测试结果。
// 添加逻辑：endpoint 以 `/` 开头强制视为 rsshub；sortOrder = max+1；enabled = true。
import React from 'react';
import Icon from './Icon.js';
import PickerRow from './OptionPicker.js';
import { Card, SectionFooter, Spinner } from './primitives.js';
import { C, SPACE } from './theme.js';
import { FEED_KINDS, TOPIC_ORDER, topicKey } from '../lib/catalog.js';
function Field({ label, children }) {
    return (_jsxs("div", { style: {
            display: 'flex', alignItems: 'center', gap: SPACE.s3,
            padding: `11px ${SPACE.s4}px`, borderBottom: `0.5px solid ${C.line}`,
        }, children: [_jsx("span", { style: { fontSize: 15, color: C.ink, width: 68, flex: '0 0 auto' }, children: label }), children] }));
}
const inputStyle = {
    flex: '1 1 auto', minWidth: 0, border: 0, outline: 'none', background: 'transparent',
    font: 'inherit', fontSize: 15, color: 'var(--news-ink)', textAlign: 'right',
};
export default function AddSourcePage({ ctx }) {
    const [title, setTitle] = React.useState('');
    const [endpoint, setEndpoint] = React.useState('');
    const [kind, setKind] = React.useState('rss');
    const [topic, setTopic] = React.useState('top');
    const [testing, setTesting] = React.useState(false);
    const [result, setResult] = React.useState(null);
    const clearResult = () => setResult(null);
    const runTest = async () => {
        setTesting(true);
        setResult(null);
        const effectiveKind = endpoint.trim().startsWith('/') ? 'rsshub' : kind;
        const outcome = await ctx.actions.fetchSource({
            id: 'test',
            title: title.trim() || endpoint.trim(),
            endpoint: endpoint.trim(),
            kind: effectiveKind,
            topic,
        });
        setTesting(false);
        setResult(outcome.length > 0 ? { ok: true, count: outcome.length } : { ok: false });
    };
    const canSubmit = endpoint.trim().length > 0;
    return (_jsxs("div", { className: "news-scroll", children: [_jsx("div", { style: { height: SPACE.s3 } }), _jsxs(Card, { children: [_jsx(Field, { label: ctx.t('news.add.title'), children: _jsx("input", { value: title, onChange: (event) => setTitle(event.target.value), style: inputStyle }) }), _jsx(Field, { label: "", children: _jsx("input", { value: endpoint, onChange: (event) => { setEndpoint(event.target.value); clearResult(); }, placeholder: ctx.t('news.add.endpoint'), autoCapitalize: "none", autoCorrect: "off", spellCheck: false, inputMode: "url", style: { ...inputStyle, textAlign: 'left' } }) }), _jsx(PickerRow, { title: ctx.t('news.add.kind'), value: kind, options: FEED_KINDS.map((value) => ({ value, label: value })), onChange: (value) => { setKind(value); clearResult(); }, cancelLabel: ctx.t('news.action.cancel') }), _jsx(PickerRow, { title: ctx.t('news.add.topic'), value: topic, options: TOPIC_ORDER.map((value) => ({ value, label: ctx.t(topicKey(value)) })), onChange: (value) => { setTopic(value); clearResult(); }, cancelLabel: ctx.t('news.action.cancel'), last: true })] }), _jsx("div", { style: { height: SPACE.s5 } }), _jsxs(Card, { children: [_jsxs("button", { type: "button", className: "news-btn news-press", disabled: !canSubmit || testing, onClick: runTest, style: {
                            display: 'flex', alignItems: 'center', gap: SPACE.s2, width: '100%',
                            padding: `12px ${SPACE.s4}px`, fontSize: 15,
                            color: canSubmit ? C.brand : C.muted,
                            borderBottom: `0.5px solid ${C.line}`,
                        }, children: [testing ? _jsx(Spinner, { size: 15, color: C.brand }) : _jsx(Icon, { name: "waveform.path.ecg", size: 16 }), ctx.t('news.add.test')] }), result ? (_jsxs("div", { style: {
                            display: 'flex', alignItems: 'center', gap: SPACE.s2,
                            padding: `12px ${SPACE.s4}px`, fontSize: 13,
                            color: result.ok ? C.brand : C.orange,
                            borderBottom: `0.5px solid ${C.line}`,
                        }, children: [_jsx(Icon, { name: result.ok ? 'checkmark.circle.fill' : 'xmark.circle.fill', size: 16 }), _jsx("span", { children: result.ok ? ctx.t('news.add.testSuccess', result.count) : ctx.t('news.add.testFailed') })] })) : null, _jsx("button", { type: "button", className: "news-btn news-press", disabled: !canSubmit, onClick: async () => {
                            await ctx.actions.addFeed({ title, endpoint, kind, topic });
                            ctx.actions.back();
                        }, style: {
                            display: 'block', width: '100%', padding: `12px ${SPACE.s4}px`, fontSize: 15,
                            color: canSubmit ? C.brand : C.muted, textAlign: 'center', fontWeight: 600,
                        }, children: ctx.t('news.action.add') })] }), _jsx(SectionFooter, { children: ctx.t('news.add.testFooter') }), _jsx("div", { style: { height: 32 } })] }));
}
