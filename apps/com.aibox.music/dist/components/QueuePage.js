import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// 队列页（§2.4）。最多三段：正在播放 / 即将播放 / 最常播放。
// 「即将播放」= currentIndex+1 到末尾——**已播过的不显示**（与 Apple Music 一致）。
//
// 拖拽排序：宿主 `music_queue action=move` 一次只能移一步（缺口⑪ 没有批量重排），
// 所以这里在拖动过程中只做本地乐观重排，**松手时只发一次 move(from,to)**，再用真值对账。
import React from 'react';
import Icon from './Icon.js';
import { EmptyState, ListHeader, SwipeRow } from './primitives.js';
import { QueueRow } from './rows.js';
import { C, SPACE } from './theme.js';
import { useRowGestures } from 'aibox/ui';
const ROW = 52;
export default function QueuePage({ ctx }) {
    const { t, music, store, actions } = ctx;
    const [editing, setEditing] = React.useState(false);
    const [drag, setDrag] = React.useState(null);
    const tracks = music.queue.tracks;
    const index = Number(music.status.currentIndex);
    const current = index >= 0 && index < tracks.length ? tracks[index] : null;
    const upNext = index >= 0 ? tracks.slice(index + 1) : tracks.slice();
    const currentKey = current ? (current.musicItemId ? `am:${current.musicItemId}` : `url:${current.url}`) : null;
    const mostPlayed = store.mostPlayed(8, currentKey);
    // —— 原生行手势（`aibox.list.*`）——
    //
    // 长按走真 `UIContextMenuInteraction`（有缩略图预览、毛玻璃、触觉曲线），左滑走原生滑动条
    // （有橡皮筋与阈值触发）。这些正是「像不像原生」的全部内容，自绘做不出来。
    // `rendered:false`（宿主没实现 / 形态不支持）时下面照旧用 `SwipeRow` + `useLongPress`。
    // 编辑态要用自己的拖拽把手，此时关掉手势层（否则长按与拖动打架）。
    const upNextGestures = useRowGestures('queue.upNext', {
        enabled: !editing,
        contextMenu: [
            { id: 'play', title: t('common.play'), icon: 'play.fill' },
            { id: 'favorite', title: t('common.addToFavorites'), icon: 'heart' },
            { id: 'more', title: t('common.more'), icon: 'ellipsis' },
            { id: 'remove', title: t('common.remove'), icon: 'trash', role: 'destructive' },
        ],
        trailingSwipe: [{ id: 'remove', title: t('common.remove'), icon: 'trash', role: 'destructive' }],
        onAction: ({ rowId, actionId }) => {
            const absolute = Number(rowId);
            const track = music.queue.tracks[absolute];
            if (!track)
                return;
            if (actionId === 'play')
                actions.playQueueIndex(absolute);
            else if (actionId === 'favorite')
                actions.toggleFavorite(track, true);
            else if (actionId === 'remove')
                actions.removeQueue(absolute);
            else if (actionId === 'more')
                actions.trackMenu(track, { queueIndex: absolute });
        },
    });
    // 「最常播放」段：与原生 `frequentRow.contextMenu` 逐条对齐（播放 / 加入队列）。
    const frequentGestures = useRowGestures('queue.mostPlayed', {
        contextMenu: [
            { id: 'play', title: t('common.play'), icon: 'play.fill' },
            { id: 'queue', title: t('common.addToQueue'), icon: 'text.append' },
        ],
        onAction: ({ rowId, actionId }) => {
            const row = mostPlayed.find((item) => item.key === rowId);
            if (!row)
                return;
            if (actionId === 'play')
                actions.playTrack(row.track, mostPlayed.map((item) => item.track));
            else if (actionId === 'queue')
                actions.addToQueue(row.track);
        },
    });
    const ordered = React.useMemo(() => {
        if (!drag)
            return upNext;
        const list = upNext.slice();
        const [moved] = list.splice(drag.from, 1);
        if (!moved)
            return list;
        list.splice(drag.to, 0, moved);
        return list;
    }, [upNext, drag]);
    if (tracks.length === 0 && mostPlayed.length === 0) {
        return (_jsx("div", { className: "mu-scroll", children: _jsx(EmptyState, { icon: "music.note.list", title: t('queue.empty'), hint: t('queue.emptyHint') }) }));
    }
    return (_jsxs("div", { className: "mu-scroll", children: [upNext.length > 0 ? (_jsx("div", { style: { display: 'flex', justifyContent: 'flex-end', padding: `8px ${SPACE.s4}px 0` }, children: _jsx("button", { type: "button", className: "mu-btn mu-press", onClick: () => setEditing(!editing), style: { fontSize: 16, fontWeight: 600, color: C.accent }, children: editing ? t('common.done') : t('common.edit') }) })) : null, current ? (_jsxs(_Fragment, { children: [_jsx(ListHeader, { children: t('queue.nowPlaying') }), _jsx(QueueRow, { track: current, isCurrent: true, isPlaying: music.status.isPlaying, onClick: () => actions.playQueueIndex(index) })] })) : null, upNext.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(ListHeader, { children: t('queue.playingNext') }), _jsx("div", { style: { position: 'relative' }, ...upNextGestures.regionProps, children: ordered.map((track, position) => {
                            const absolute = index + 1 + position;
                            const row = (_jsx(QueueRow, { rowId: String(absolute), track: track, isCurrent: false, isPlaying: false, onClick: editing ? undefined : () => actions.playQueueIndex(absolute), onLongPress: upNextGestures.rendered ? undefined : () => actions.trackMenu(track, { queueIndex: absolute }), trailing: editing ? (_jsx("span", { className: "mu-press", style: { padding: '6px 2px 6px 10px', color: C.muted, touchAction: 'none' }, onPointerDown: (event) => {
                                        event.currentTarget.setPointerCapture(event.pointerId);
                                        setDrag({ from: position, to: position, startY: event.clientY });
                                    }, onPointerMove: (event) => {
                                        setDrag((state) => {
                                            if (!state)
                                                return state;
                                            const delta = Math.round((event.clientY - state.startY) / ROW);
                                            const to = Math.max(0, Math.min(upNext.length - 1, state.from + delta));
                                            return to === state.to ? state : { ...state, to };
                                        });
                                    }, onPointerUp: () => {
                                        // 副作用不放进 setState 更新函数里（StrictMode 会跑两次）——直接读闭包里的 drag。
                                        if (drag && drag.from !== drag.to) {
                                            actions.moveQueue(index + 1 + drag.from, index + 1 + drag.to);
                                        }
                                        setDrag(null);
                                    }, onPointerCancel: () => setDrag(null), children: _jsx(Icon, { name: "line.3.horizontal", size: 18 }) })) : undefined }));
                            // 手势层在场时不再套自绘 SwipeRow —— 两套滑动叠在一起就是「滑不动 / 滑两下」。
                            if (upNextGestures.rendered) {
                                return _jsx(React.Fragment, { children: row }, `${track.id || track.title}-${absolute}`);
                            }
                            return (_jsx(SwipeRow, { actionLabel: t('common.remove'), onAction: () => actions.removeQueue(absolute), children: row }, `${track.id || track.title}-${absolute}`));
                        }) })] })) : null, mostPlayed.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(ListHeader, { children: t('queue.mostPlayed') }), _jsx("div", { ...frequentGestures.regionProps, children: mostPlayed.map((row) => (_jsx(QueueRow, { rowId: row.key, track: row.track, isCurrent: false, isPlaying: false, onClick: () => actions.playTrack(row.track, mostPlayed.map((item) => item.track)), onLongPress: frequentGestures.rendered ? undefined : () => actions.trackMenu(row.track), trailing: _jsx("button", { type: "button", className: "mu-btn mu-press", onClick: (event) => {
                                    event.stopPropagation();
                                    actions.addToQueue(row.track);
                                }, style: { padding: '6px 2px 6px 10px', color: C.accent }, children: _jsx(Icon, { name: "text.append", size: 15 }) }) }, row.key))) })] })) : null, _jsx("div", { style: { height: 24 } })] }));
}
