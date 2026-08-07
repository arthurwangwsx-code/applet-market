import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 左右横扫分页（对应原生 `TabView(.page)`）：资讯页的主题分页与收藏页的两个子 Tab 共用。
// 只挂载「上一页 / 当前页 / 下一页」三屏，切页动画 easeInOut 0.22s，与 chip / 分段控件双向联动。
//
// 手势本身**不在这里**：方向锁、阈值、橡皮筋、以及最要命的「`touchcancel` = 放弃」
// 都住在 SDK 的 `useSwipePager` 里（`@aibox/applet-sdk/react`）。
// 本文件只剩「三屏轨道怎么摆」这点纯布局职责——手势代码有第二份的那一天，
// 就是两份实现开始各修各的那一天（2026-08-06 实测：本文件与理财的 primitives.jsx
// 各自把 cancel 写错，错法还相反）。
import React from 'react';
import { useSwipePager } from 'aibox/sdk/react';
const Pager = React.forwardRef(function Pager({ count, index, onIndex, renderPage, style }, ref) {
    // 受控用法：页码的真值在调用方（chip / 分段控件也要读它），翻页落地时由 onIndex 写回。
    const pager = useSwipePager({ count, index, onIndexChange: onIndex });
    // `pager.slideTo` 身份稳定（手势核心只建一次），句柄不会每帧重建。
    React.useImperativeHandle(ref, () => ({
        slideTo(nextIndex) {
            pager.slideTo(nextIndex);
        },
    }), [pager.slideTo]);
    return (_jsx("div", { ...pager.containerProps, style: { overflow: 'hidden', flex: '1 1 auto', minHeight: 0, display: 'flex', ...style }, children: _jsxs("div", { className: "news-pager-track", style: pager.trackStyle, children: [_jsx("div", { className: "news-pager-slot", children: index - 1 >= 0 ? renderPage(index - 1) : null }), _jsx("div", { className: "news-pager-slot", children: renderPage(index) }), _jsx("div", { className: "news-pager-slot", children: index + 1 < count ? renderPage(index + 1) : null })] }) }));
});
export default Pager;
