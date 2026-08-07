// 播放控制器：唯一与宿主播放引擎对话的地方。
//
// 架构裁决（framework-capabilities.md §3.6）：**遥控 `aibox.music.*`，绝不自持引擎**。
// 播放仍由原生 AudioPlayerService 执行 → 锁屏卡片、remote command、耳机线控、后台续播、
// 中断恢复、系统音量全部由原生维护，本应用挂起也不影响。
//
// 实时面的缺口（缺口 #1）在这里被吸收：
//  · 轮询 `status`（1Hz 播放中 / 0.4Hz 暂停 / 页面不可见时停轮询）
//  · 整数秒 → SmoothClock 插值（clock.js）
//  · 队列改动先本地乐观推演（queue.js），再用 `music_queue list` 对账
import { music as callMusic, classifyMusicError, haptics } from './host.js';
import { SmoothClock } from './clock.js';
import { playArgs } from './format.js';
import * as Q from './queue.js';
const POLL_PLAYING = 1000;
const POLL_IDLE = 2500;
const SCRUB_HOLD_MS = 300;
const EMPTY_STATUS = {
    isPlaying: false,
    playbackState: 'idle',
    currentTime: 0,
    duration: 0,
    volume: 0.5,
    repeatMode: 'off',
    isShuffled: false,
    queueCount: 0,
    currentIndex: -1,
    currentTrack: null,
    lastError: null,
};
export class MusicController {
    store;
    status;
    clock;
    queue;
    listeners;
    timer;
    polling;
    visible;
    trackKey;
    timeline;
    scrub;
    scrubHoldUntil;
    heldTime;
    availability;
    sleepTimer;
    effects;
    queueRevision;
    pendingOptimistic;
    version;
    constructor({ store }) {
        this.store = store;
        this.status = { ...EMPTY_STATUS };
        this.clock = new SmoothClock();
        this.queue = Q.emptyQueue();
        this.listeners = new Set();
        this.timer = null;
        this.polling = false;
        this.visible = true;
        this.trackKey = null;
        this.timeline = 0;
        this.scrub = null;
        // 松手后 0.3 秒内锁定显示的位置（防 seek 生效前回跳闪烁）；两者必须成对初始化。
        this.scrubHoldUntil = 0;
        this.heldTime = 0;
        this.availability = 'unknown';
        this.sleepTimer = { active: false, text: null };
        this.effects = null;
        this.queueRevision = 0;
        this.pendingOptimistic = null;
        this.version = 0;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    notify() {
        this.version += 1;
        this.listeners.forEach((listener) => listener());
    }
    // MARK: - 轮询
    start() {
        if (this.timer)
            return;
        this.tick(true);
    }
    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    /** 页面不可见时停轮询：锁屏 / 后台的媒体 UI 是**原生那一面**，与本页无关，停掉纯赚。 */
    setVisible(visible) {
        const changed = this.visible !== visible;
        this.visible = visible;
        if (!visible) {
            this.stop();
            return;
        }
        if (changed)
            this.tick(true);
    }
    schedule() {
        if (!this.visible)
            return;
        this.stop();
        const interval = this.status.playbackState === 'playing' ? POLL_PLAYING : POLL_IDLE;
        this.timer = setTimeout(() => this.tick(false), interval);
    }
    async tick(immediate) {
        if (this.polling)
            return;
        this.polling = true;
        try {
            await this.refreshStatus();
        }
        finally {
            this.polling = false;
            this.schedule();
        }
        if (immediate)
            this.notify();
    }
    async refreshStatus() {
        const result = await callMusic('status', {});
        if (!result.ok || !result.json) {
            if (result.error && result.error !== 'aibox/music-unavailable') {
                this.availability = classifyMusicError(result.error);
            }
            return;
        }
        const next = { ...EMPTY_STATUS, ...result.json };
        const key = trackIdentity(next.currentTrack);
        const trackChanged = key !== this.trackKey;
        const stateChanged = next.playbackState !== this.status.playbackState || next.isPlaying !== this.status.isPlaying;
        if (trackChanged) {
            this.trackKey = key;
            this.timeline += 1;
            this.pendingOptimistic = null;
            if (next.currentTrack) {
                this.store.recordPlay(next.currentTrack);
                this.store.setRestorePoint(next.currentTrack, next.currentTime);
            }
        }
        const rate = SmoothClock.effectiveRate({
            playbackState: next.playbackState,
            isPlaying: next.isPlaying,
            effectsRate: this.effects ? this.effects.rate : 1,
            appliesEffects: !!(this.effects && this.effects.enabled && this.effects.appliesToCurrentTrack),
        });
        this.clock.observe(next.currentTime, {
            duration: next.duration,
            rate,
            timeline: this.timeline,
        });
        const queueCountChanged = next.queueCount !== this.status.queueCount;
        this.status = next;
        if (next.currentTrack && !trackChanged) {
            this.store.setRestorePoint(next.currentTrack, next.currentTime);
        }
        if (queueCountChanged || trackChanged)
            this.refreshQueue();
        if (trackChanged || stateChanged || queueCountChanged)
            this.notify();
    }
    // MARK: - 读
    get currentTrack() {
        return this.status.currentTrack;
    }
    get isBusy() {
        return this.status.playbackState === 'loading' || this.status.playbackState === 'buffering';
    }
    /** 显示用的播放位置：拖动中/松手 0.3s 内锁在松手位置，其余时候用插值时钟。 */
    displayTime() {
        if (this.scrub !== null)
            return this.scrub * (this.status.duration || 0);
        if (this.scrubHoldUntil > Date.now())
            return this.heldTime;
        return this.clock.read();
    }
    displayProgress() {
        if (this.scrub !== null)
            return this.scrub;
        const total = this.status.duration || 0;
        if (!(total > 0))
            return 0;
        return Math.max(0, Math.min(1, this.displayTime() / total));
    }
    // MARK: - 走带
    async play(track, queueTracks) {
        if (!track)
            return;
        haptics.impact('medium');
        // 乐观点亮：不等授权 / 订阅 / 取曲 / 起播这几趟往返，先把 UI 切成播放态。
        this.pendingOptimistic = { track: playArgs(track), at: Date.now() };
        this.status = {
            ...this.status,
            isPlaying: true,
            playbackState: 'loading',
            currentTrack: playArgs(track),
            currentTime: 0,
            duration: Number(track.duration) || 0,
        };
        this.trackKey = trackIdentity(this.status.currentTrack);
        this.timeline += 1;
        this.clock.reanchor(0, { duration: this.status.duration, rate: 0, timeline: this.timeline });
        this.notify();
        const base = playArgs(track);
        const args = { ...base };
        if (Array.isArray(queueTracks) && queueTracks.length > 0)
            args.queue = queueTracks.map(playArgs);
        const result = await callMusic('play', args);
        if (!result.ok) {
            // 失败分支如实纠回，绝不留个假的「正在播放」。
            this.status = { ...this.status, isPlaying: false, playbackState: 'failed', lastError: result.error };
            this.availability = classifyMusicError(result.error);
            this.notify();
            return;
        }
        this.store.rememberArtwork(track);
        await this.refreshStatus();
        this.notify();
    }
    async transport(action) {
        if (action === 'previous' && this.displayTime() > 3) {
            // 与原生同义：> 3 秒时「上一曲」是回到本曲开头。本地先归零，视觉不等一趟往返。
            this.clock.reanchor(0, { timeline: ++this.timeline });
            this.notify();
        }
        if (action === 'pause' || action === 'resume') {
            const playing = action === 'resume';
            this.status = {
                ...this.status,
                isPlaying: playing,
                playbackState: playing ? 'playing' : 'paused',
            };
            this.clock.rate = playing ? 1 : 0;
            this.clock.reanchor(this.clock.read(), { timeline: this.timeline });
            this.notify();
        }
        const result = await callMusic('transport', { action });
        if (!result.ok)
            this.status = { ...this.status, lastError: result.error };
        await this.refreshStatus();
        this.notify();
    }
    async togglePlayPause() {
        haptics.impact('light');
        await this.transport(this.status.isPlaying ? 'pause' : 'resume');
    }
    async retry() {
        const track = this.status.currentTrack;
        if (!track)
            return;
        await this.play(track, this.queue.tracks);
    }
    // MARK: - 进度条
    beginScrub(ratio) {
        this.scrub = clamp01(ratio);
        this.notify();
    }
    updateScrub(ratio) {
        if (this.scrub === null)
            return;
        this.scrub = clamp01(ratio);
        this.notify();
    }
    /** 松手：锁定到松手位置 → 触感 → seek → 0.3 秒后才把控制权交还真实播放时间。 */
    async endScrub() {
        if (this.scrub === null)
            return;
        const ratio = this.scrub;
        const total = this.status.duration || 0;
        const seconds = Math.round(ratio * total);
        this.heldTime = seconds;
        this.scrubHoldUntil = Date.now() + SCRUB_HOLD_MS;
        this.scrub = null;
        haptics.selection();
        this.clock.reanchor(seconds, { timeline: ++this.timeline });
        this.notify();
        await callMusic('seek', { seconds });
        setTimeout(() => {
            this.refreshStatus().then(() => this.notify());
        }, SCRUB_HOLD_MS);
    }
    async seekTo(seconds) {
        this.clock.reanchor(seconds, { timeline: ++this.timeline });
        this.notify();
        await callMusic('seek', { seconds: Math.max(0, Math.round(seconds)) });
    }
    // MARK: - 模式
    async setRepeat(mode) {
        this.status = { ...this.status, repeatMode: mode };
        this.notify();
        await callMusic('repeat', { mode });
        await this.refreshStatus();
        this.notify();
    }
    cycleRepeat() {
        const order = { off: 'all', all: 'one', one: 'off' };
        return this.setRepeat(order[this.status.repeatMode] || 'all');
    }
    async setShuffle(enabled) {
        this.status = { ...this.status, isShuffled: enabled };
        this.queue = Q.setShuffle(this.queue, enabled);
        this.notify();
        await callMusic('shuffle', { enabled });
        await this.refreshStatus();
        this.notify();
    }
    async setVolume(level) {
        const value = clamp01(level);
        this.status = { ...this.status, volume: value };
        this.notify();
        await callMusic('volume', { level: value });
    }
    // MARK: - 队列（权威在原生，本地只做乐观推演 + 对账）
    async refreshQueue() {
        const result = await callMusic('queue', { action: 'list' });
        const rows = Array.isArray(result.json) ? result.json : [];
        this.queue = Q.reconcile(this.queue, rows);
        this.queueRevision += 1;
        this.notify();
    }
    async addToQueue(tracks, at = null) {
        const list = (Array.isArray(tracks) ? tracks : [tracks]).filter((track) => Boolean(track));
        if (list.length === 0)
            return;
        haptics.impact('light');
        const before = this.queue;
        this.queue = Q.add(this.queue, list.map((track) => ({ ...playArgs(track), id: localID() })), at);
        this.queueRevision += 1;
        this.notify();
        const args = { action: 'add', tracks: list.map(playArgs) };
        if (at !== null && at !== undefined)
            args.insertAt = at;
        const result = await callMusic('queue', args);
        if (!result.ok) {
            this.queue = before;
            this.notify();
        }
        await this.refreshQueue();
    }
    async removeFromQueue(index) {
        const before = this.queue;
        const next = Q.remove(this.queue, index);
        this.queue = next;
        this.queueRevision += 1;
        this.notify();
        const result = await callMusic('queue', { action: 'remove', index });
        if (!result.ok) {
            this.queue = before;
            this.notify();
        }
        if (next.shouldStop)
            await callMusic('transport', { action: 'stop' });
        await this.refreshQueue();
        await this.refreshStatus();
    }
    async moveInQueue(from, to) {
        if (from === to)
            return;
        const before = this.queue;
        this.queue = Q.move(this.queue, from, to);
        this.queueRevision += 1;
        this.notify();
        const result = await callMusic('queue', { action: 'move', from, to });
        if (!result.ok) {
            this.queue = before;
            this.notify();
        }
        await this.refreshQueue();
    }
    async clearQueue() {
        this.queue = Q.emptyQueue();
        this.queueRevision += 1;
        this.notify();
        await callMusic('queue', { action: 'clear' });
        await this.refreshStatus();
        this.notify();
    }
    // MARK: - 睡眠定时器
    async refreshSleepTimer() {
        const result = await callMusic('sleepTimer', { action: 'status' });
        const text = String(result.text || '');
        this.sleepTimer = {
            active: !/^No sleep timer/i.test(text) && result.ok,
            endOfTrack: /end of current song/i.test(text),
            remaining: parseRemaining(text),
            text,
        };
        this.notify();
    }
    async setSleepTimer(minutes) {
        await callMusic('sleepTimer', { action: 'set', minutes });
        await this.refreshSleepTimer();
    }
    async setSleepTimerEndOfTrack() {
        await callMusic('sleepTimer', { action: 'end_of_track' });
        await this.refreshSleepTimer();
    }
    async cancelSleepTimer() {
        await callMusic('sleepTimer', { action: 'cancel' });
        await this.refreshSleepTimer();
    }
    // MARK: - 音效
    async refreshEffects() {
        const result = await callMusic('effects', { action: 'status' });
        if (result.json) {
            this.effects = result.json;
            this.notify();
        }
    }
    async updateEffects(action, args) {
        const result = await callMusic('effects', { action, ...args });
        if (result.json)
            this.effects = result.json;
        this.notify();
    }
}
function trackIdentity(track) {
    if (!track)
        return null;
    return String(track.musicItemId || track.url || track.id || track.title || '');
}
function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}
let counter = 0;
function localID() {
    counter += 1;
    return `local-${counter}-${Date.now()}`;
}
/** 「Sleep timer: 12m 30s remaining.」→ 秒。解析不出回 null。 */
export function parseRemaining(text) {
    const match = /(\d+)m\s*(\d+)s/i.exec(String(text || ''));
    if (!match)
        return null;
    return Number(match[1]) * 60 + Number(match[2]);
}
