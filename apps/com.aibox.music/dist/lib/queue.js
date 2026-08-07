// 队列状态机 —— 规格 §5.4 的逐条复刻（纯函数，无宿主依赖，可在 Node 里断言）。
//
// ⚠️ 权威队列在原生侧（`aibox.music.queue`）。本模块**不是影子队列**：
// 它只做两件事——
//   1. 乐观更新：拖拽排序 / 滑动删除时先本地推演出结果，UI 立刻响应，
//      随后用 `music_queue action=list` 的真值对账（`reconcile`），失败即回滚；
//   2. 顺序语义的单一表述：随机序按曲目 id 保存（不是索引）、增删移动后自动对账，
//      与原生同一套规则，便于用 Node 断言把「播放顺序乱掉」这类静默错误钉死。
//
// 跨 App 重启恢复与锁屏控制依赖的仍是原生那一份，本模块从不落盘。
/** 队列初值。tracks 里每一项至少要有 `id`。 */
export function emptyQueue() {
    return { tracks: [], currentIndex: 0, shuffledTrackIDs: [] };
}
function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
}
/** 确定性洗牌（Fisher-Yates）。rng 可注入，测试里用固定序列。 */
export function shuffleIDs(ids, rng = Math.random) {
    const out = ids.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        const swap = out[i];
        out[i] = out[j];
        out[j] = swap;
    }
    return out;
}
/**
 * 随机序对账：剔除已不在队列里的 id，把新出现的 id 打散后追加。
 * 「打散追加」而不是「整序重建」——已播过的随机顺序不该因为加了一首歌就重排。
 */
export function reconcileShuffle(state, rng = Math.random) {
    const live = new Set(state.tracks.map((track) => track.id));
    const kept = (state.shuffledTrackIDs || []).filter((id) => live.has(id));
    const known = new Set(kept);
    const fresh = state.tracks.map((track) => track.id).filter((id) => !known.has(id));
    return { ...state, shuffledTrackIDs: fresh.length > 0 ? kept.concat(shuffleIDs(fresh, rng)) : kept };
}
/** 重建随机序；`pinCurrent` 时把当前曲提到首位（开启随机的语义）。 */
export function rebuildShuffle(state, { pinCurrent = false, rng = Math.random, } = {}) {
    const ids = state.tracks.map((track) => track.id);
    let order = shuffleIDs(ids, rng);
    const current = state.tracks[state.currentIndex];
    if (pinCurrent && current) {
        order = [current.id].concat(order.filter((id) => id !== current.id));
    }
    return { ...state, shuffledTrackIDs: order };
}
/** 整体替换队列。指定曲存在则选中它，否则夹住旧下标；空队列回 0。 */
export function replace(state, tracks, currentTrackID = null, rng = Math.random) {
    const list = tracks.slice();
    let index = 0;
    if (list.length > 0) {
        const found = currentTrackID ? list.findIndex((track) => track.id === currentTrackID) : -1;
        index = found >= 0 ? found : clamp(state.currentIndex, 0, list.length - 1);
    }
    return rebuildShuffle({ ...state, tracks: list, currentIndex: index }, { rng });
}
/** 已在队列里就选中它；否则追加到队尾并选中。 */
export function appendOrSelect(state, track, rng = Math.random) {
    const found = state.tracks.findIndex((row) => row.id === track.id);
    if (found >= 0)
        return { ...state, currentIndex: found };
    const tracks = state.tracks.concat([track]);
    return reconcileShuffle({ ...state, tracks, currentIndex: tracks.length - 1 }, rng);
}
/** 插入若干曲目。插入点 ≤ 当前索引时当前曲整体后移，保证「正在播的还是那一首」。 */
export function add(state, tracks, at = null, rng = Math.random) {
    if (tracks.length === 0)
        return state;
    const insertAt = clamp(at === null || at === undefined ? state.tracks.length : at, 0, state.tracks.length);
    const next = state.tracks.slice();
    next.splice(insertAt, 0, ...tracks);
    const currentIndex = state.tracks.length === 0
        ? 0
        : state.currentIndex >= insertAt
            ? state.currentIndex + tracks.length
            : state.currentIndex;
    return reconcileShuffle({ ...state, tracks: next, currentIndex }, rng);
}
/**
 * 删除一项。
 * - 删的位置在当前之前 → 当前索引 -1（还是同一首）
 * - 删的就是当前 → 当前 = min(原下标, 新长度-1)（顺位接上下一首）
 * - 删空 → 索引 0，并要求调用方停止播放（`shouldStop`）
 */
export function remove(state, at, rng = Math.random) {
    if (at < 0 || at >= state.tracks.length)
        return { ...state, shouldStop: false };
    const tracks = state.tracks.slice();
    tracks.splice(at, 1);
    let currentIndex = state.currentIndex;
    if (tracks.length === 0)
        currentIndex = 0;
    else if (at < state.currentIndex)
        currentIndex = state.currentIndex - 1;
    else if (at === state.currentIndex)
        currentIndex = clamp(state.currentIndex, 0, tracks.length - 1);
    const next = reconcileShuffle({ ...state, tracks, currentIndex }, rng);
    return { ...next, shouldStop: tracks.length === 0 };
}
/** 移动一项。移动后**按 id 找回**当前曲的新下标——用下标推演在多段偏移下必错。 */
export function move(state, from, to, rng = Math.random) {
    if (from < 0 || from >= state.tracks.length)
        return state;
    const destination = clamp(to, 0, state.tracks.length - 1);
    const currentID = state.tracks[state.currentIndex]?.id ?? null;
    const tracks = state.tracks.slice();
    const [moved] = tracks.splice(from, 1);
    if (!moved)
        return state;
    tracks.splice(destination, 0, moved);
    const found = currentID ? tracks.findIndex((track) => track.id === currentID) : -1;
    return reconcileShuffle({ ...state, tracks, currentIndex: found >= 0 ? found : 0 }, rng);
}
/** 开启随机：重建随机序并把当前曲提到首位。关闭随机：清空随机序。 */
export function setShuffle(state, enabled, rng = Math.random) {
    if (!enabled)
        return { ...state, shuffledTrackIDs: [] };
    return rebuildShuffle(state, { pinCurrent: true, rng });
}
function shuffleCursor(state) {
    const current = state.tracks[state.currentIndex];
    if (!current)
        return -1;
    return state.shuffledTrackIDs.indexOf(current.id);
}
function indexOfID(state, id) {
    return state.tracks.findIndex((track) => track.id === id);
}
/**
 * 下一首的队列下标。
 * - 随机：在随机序里前进一步；到头且 repeat=all 环回，否则 null
 * - 顺序：index + 1；越界且 repeat=all 回绕，否则 null
 * - repeat=one 不在这里处理（曲终逻辑是 seek 0 + resume，不换曲）
 */
export function nextIndex(state, { shuffled = false, repeatMode = 'off', } = {}) {
    const count = state.tracks.length;
    if (count === 0)
        return null;
    if (shuffled && state.shuffledTrackIDs.length > 0) {
        const cursor = shuffleCursor(state);
        if (cursor < 0)
            return indexOfID(state, state.shuffledTrackIDs[0]);
        if (cursor + 1 < state.shuffledTrackIDs.length)
            return indexOfID(state, state.shuffledTrackIDs[cursor + 1]);
        return repeatMode === 'all' ? indexOfID(state, state.shuffledTrackIDs[0]) : null;
    }
    if (state.currentIndex + 1 < count)
        return state.currentIndex + 1;
    return repeatMode === 'all' ? 0 : null;
}
/** 上一首的队列下标。语义与 nextIndex 对称（`currentTime > 3` 的「回到开头」在播放层处理）。 */
export function previousIndex(state, { shuffled = false, repeatMode = 'off', } = {}) {
    const count = state.tracks.length;
    if (count === 0)
        return null;
    if (shuffled && state.shuffledTrackIDs.length > 0) {
        const cursor = shuffleCursor(state);
        if (cursor < 0)
            return indexOfID(state, state.shuffledTrackIDs[0]);
        if (cursor - 1 >= 0)
            return indexOfID(state, state.shuffledTrackIDs[cursor - 1]);
        return repeatMode === 'all' ? indexOfID(state, state.shuffledTrackIDs[state.shuffledTrackIDs.length - 1]) : null;
    }
    if (state.currentIndex - 1 >= 0)
        return state.currentIndex - 1;
    return repeatMode === 'all' ? count - 1 : null;
}
/**
 * 用原生真值对账本地投影。原生 `music_queue list` 返回 `[{...track, index, isCurrent}]`。
 * 队列身份不同（原生每次可能重新生成 UUID）时以原生为准，随机序按 id 交集保留。
 */
export function reconcile(state, nativeRows, rng = Math.random) {
    const tracks = nativeRows.map((row) => ({ ...row, id: String(row.id) }));
    const currentRow = nativeRows.findIndex((row) => row.isCurrent);
    const currentIndex = currentRow >= 0 ? currentRow : clamp(state.currentIndex, 0, Math.max(0, tracks.length - 1));
    return reconcileShuffle({ ...state, tracks, currentIndex }, rng);
}
