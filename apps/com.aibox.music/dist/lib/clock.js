// 平滑播放时钟（规格 §4.7 的移植版）。
//
// 为什么必须有它：容器只给 `music_status` 轮询，且 `currentTime` 是**取整到秒的整数**
// （framework-capabilities.md §3.6.1 缺口 #1）。直接把整数秒喂给进度条 / 歌词，
// 视觉上就是每秒跳一格。这里用「轮询锚点 + 单调时钟插值」把它铺平。
//
// 三条与原生一致的纪律：
//  1. **不用墙钟**（Date.now 会被系统时间校正跳变），用 performance.now 的单调运行时间；
//  2. 暂停 / 忙（loading、buffering）时**有效速率为 0**，歌词与进度冻结，不空转；
//  3. 切歌 / seek / stop 递增时间线版本号 → 强制重新锚定。
//
// 相对原生的额外一招：整数秒的**进位沿**是免费的高精度信息。
// 轮询到 `reported` 比上一次大 1 时，说明「这一秒刚刚跨过去」，误差不超过一个轮询周期，
// 于是把锚点钉在那一刻；同一秒内的重复观测只用来兜底纠偏，不重新锚定。
const DEFAULT_NOW = () => (typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now());
export class SmoothClock {
    constructor({ now = DEFAULT_NOW } = {}) {
        this.now = now;
        this.reset();
    }
    reset() {
        this.anchorMedia = 0;
        this.anchorUptime = this.now();
        this.rate = 0;
        this.duration = 0;
        this.lastReported = null;
        this.timeline = 0;
        this.anchoredOnEdge = false;
    }
    /** 有效速率：暂停 / 忙 → 0；本地音效路径 → 实际倍速；Apple Music 与普通本地 → 1。 */
    static effectiveRate({ playbackState, isPlaying, effectsRate = 1, appliesEffects = false }) {
        if (playbackState === 'loading' || playbackState === 'buffering')
            return 0;
        if (playbackState === 'failed' || playbackState === 'idle')
            return 0;
        if (!isPlaying && playbackState !== 'playing')
            return 0;
        return appliesEffects ? Math.max(0.25, Math.min(4, Number(effectsRate) || 1)) : 1;
    }
    /** 强制重新锚定（切歌 / seek / stop 后调用）。 */
    reanchor(seconds, { duration, rate, timeline } = {}) {
        this.anchorMedia = clamp(Number(seconds) || 0, 0, duration === undefined ? Infinity : duration);
        this.anchorUptime = this.now();
        if (duration !== undefined)
            this.duration = Math.max(0, Number(duration) || 0);
        if (rate !== undefined)
            this.rate = Math.max(0, Number(rate) || 0);
        if (timeline !== undefined)
            this.timeline = timeline;
        this.lastReported = Math.floor(this.anchorMedia);
        this.anchoredOnEdge = true;
    }
    /**
     * 吃一次轮询快照。`reported` 是整数秒。
     * 返回 true 表示这次观测触发了重新锚定（调试与自测用）。
     */
    observe(reported, { duration, rate, timeline } = {}) {
        const seconds = Math.max(0, Math.floor(Number(reported) || 0));
        if (duration !== undefined)
            this.duration = Math.max(0, Number(duration) || 0);
        if (rate !== undefined)
            this.rate = Math.max(0, Number(rate) || 0);
        if (timeline !== undefined && timeline !== this.timeline) {
            this.reanchor(seconds, { timeline });
            return true;
        }
        if (this.lastReported === null) {
            this.reanchor(seconds);
            return true;
        }
        // 进位沿：这一秒刚跨过去 → 高质量锚点。
        if (seconds === this.lastReported + 1) {
            this.anchorMedia = seconds;
            this.anchorUptime = this.now();
            this.lastReported = seconds;
            this.anchoredOnEdge = true;
            return true;
        }
        // 非连续跳变（seek、外部换曲、长时间挂起）→ 重新锚定。
        if (seconds < this.lastReported || seconds > this.lastReported + 1) {
            this.reanchor(seconds);
            return true;
        }
        // 同一整数秒：只在插值明显跑出 [reported, reported+1) 合法带时纠偏，避免每次轮询都抖一下。
        this.lastReported = seconds;
        const predicted = this.read({ clampToDuration: false });
        if (predicted < seconds - 0.05 || predicted > seconds + 1.6) {
            this.anchorMedia = predicted < seconds ? seconds : seconds + 0.98;
            this.anchorUptime = this.now();
            this.anchoredOnEdge = false;
            return true;
        }
        return false;
    }
    /** 插值当前媒体时间（秒，浮点）。 */
    read({ clampToDuration = true } = {}) {
        const elapsed = Math.max(0, (this.now() - this.anchorUptime) / 1000);
        let value = this.anchorMedia + elapsed * this.rate;
        if (value < 0)
            value = 0;
        if (clampToDuration && this.duration > 0)
            value = Math.min(value, this.duration);
        return value;
    }
    /** 0–1 进度。总时长未知时回 0。 */
    progress() {
        if (!(this.duration > 0))
            return 0;
        return clamp(this.read() / this.duration, 0, 1);
    }
}
function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
}
