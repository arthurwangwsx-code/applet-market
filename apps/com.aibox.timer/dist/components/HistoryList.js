import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { List } from 'antd-mobile';
import { formatDuration } from '../lib/timer.js';
/** 历史记录。空态是**一等状态**，不是「列表恰好没有行」——它要解释下一步做什么。 */
export function HistoryList({ sessions, locale }) {
    if (sessions.length === 0) {
        return (_jsx("div", { className: "ax-muted", style: { padding: '32px 16px', textAlign: 'center', fontSize: 14 }, children: "\u8FD8\u6CA1\u6709\u8BB0\u5F55\u3002\u8BA1\u5B8C\u4E00\u6BB5\u5C31\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002" }));
    }
    const time = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return (_jsx(List, { header: `最近 ${sessions.length} 段`, children: sessions.map((session) => (_jsxs(List.Item, { description: time.format(new Date(session.finishedAt)), extra: _jsx("span", { style: { fontVariantNumeric: 'tabular-nums' }, children: formatDuration(session.actualSeconds) }), children: [session.label, !session.completed && (_jsx("span", { className: "ax-muted", style: { marginLeft: 6, fontSize: 12 }, children: "\uFF08\u4E2D\u65AD\uFF09" }))] }, session.id))) }));
}
