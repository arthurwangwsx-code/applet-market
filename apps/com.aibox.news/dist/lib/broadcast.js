// 播报（TTS）控制器 —— **部分近似**（README 有记）。
//
// 桥只给了 `aibox.tts.speak`（一发即返，不等读完）和 `aibox.tts.stop`，**没有「读完了」事件**，
// 也没有 pause/resume。于是：
//  · 自动连播靠**按文本长度估算时长**后定时切下一篇（中文 ~4.5 字/秒、西文 ~15 字符/秒）；
//  · 「暂停」= stop；「继续」= 从当前这篇的开头重新读（不是从断点续读）；
//  · 进度条按估算时长线性推进，不是真实播放进度。
// 其余行为（队列上限 20、懒加载正文、拼「标题. 正文」、失败提示、跳到正在朗读那篇）与原生一致。
import { speak, stopSpeaking, capabilities } from './host.js';
import { extract } from './extractor.js';
import { bcp47 } from '../i18n/index.js';
export const BROADCAST_QUEUE_LIMIT = 20;
const CJK_CHARS_PER_SECOND = 4.5;
const LATIN_CHARS_PER_SECOND = 15;
const GAP_SECONDS = 0.6;
const TICK_MS = 250;
function estimateSeconds(text) {
    let cjk = 0;
    let other = 0;
    for (const ch of String(text || '')) {
        const code = ch.codePointAt(0);
        if ((code >= 0x3400 && code <= 0x9fff) || (code >= 0xf900 && code <= 0xfaff))
            cjk += 1;
        else
            other += 1;
    }
    const seconds = cjk / CJK_CHARS_PER_SECOND + other / LATIN_CHARS_PER_SECOND + GAP_SECONDS;
    return Math.max(2, seconds);
}
export class BroadcastController {
    constructor(store) {
        this.store = store;
        this.items = [];
        this.index = 0;
        this.active = false;
        this.playing = false;
        this.progress = 0;
        this.noticeKey = null;
        this.spokeAtLeastOnce = false;
        this.timer = null;
        this.noticeTimer = null;
        this.startedAt = 0;
        this.estimated = 0;
        this.listeners = new Set();
        this.token = 0;
    }
    get available() {
        return capabilities.tts;
    }
    get current() {
        return this.items[this.index] || null;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    emit() {
        for (const listener of [...this.listeners])
            listener();
    }
    showNotice(key) {
        this.noticeKey = key;
        this.emit();
        if (this.noticeTimer)
            clearTimeout(this.noticeTimer);
        this.noticeTimer = setTimeout(() => this.dismissNotice(), 5000);
    }
    dismissNotice() {
        if (this.noticeTimer) {
            clearTimeout(this.noticeTimer);
            this.noticeTimer = null;
        }
        if (this.noticeKey === null)
            return;
        this.noticeKey = null;
        this.emit();
    }
    /** 工具栏「朗读」：取当前列表投影后的 lead 序列前 20 篇。 */
    start(articles) {
        const queue = (articles || []).slice(0, BROADCAST_QUEUE_LIMIT);
        if (queue.length === 0) {
            this.showNotice('news.broadcast.notice.empty');
            return;
        }
        this.items = queue;
        this.index = 0;
        this.active = true;
        this.spokeAtLeastOnce = false;
        this.playCurrent();
    }
    /** 长按「朗读」：从该篇在当前这一串里的位置往后取 20 篇。 */
    startFrom(article, sequence) {
        const list = sequence || [];
        const at = list.findIndex((row) => row.id === article.id);
        const from = at >= 0 ? at : 0;
        this.start(list.slice(from));
    }
    toggle(articles) {
        if (this.active)
            this.stop({ userInitiated: true });
        else
            this.start(articles);
    }
    stop({ userInitiated = false } = {}) {
        this.token += 1;
        this.clearTimer();
        stopSpeaking();
        const wasActive = this.active;
        this.active = false;
        this.playing = false;
        this.progress = 0;
        this.items = [];
        this.index = 0;
        if (wasActive && !userInitiated && !this.spokeAtLeastOnce) {
            this.showNotice('news.broadcast.notice.failed');
        }
        this.emit();
    }
    pause() {
        this.token += 1;
        this.clearTimer();
        stopSpeaking();
        this.playing = false;
        this.emit();
    }
    resume() {
        if (!this.active)
            return;
        this.playCurrent();
    }
    next() {
        if (this.index >= this.items.length - 1)
            return;
        this.index += 1;
        this.playCurrent();
    }
    previous() {
        if (this.index <= 0)
            return;
        this.index -= 1;
        this.playCurrent();
    }
    jumpTo(index) {
        if (index < 0 || index >= this.items.length)
            return;
        this.index = index;
        this.playCurrent();
    }
    clearTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    async playCurrent() {
        const token = ++this.token;
        this.clearTimer();
        await stopSpeaking();
        const article = this.current;
        if (!article) {
            this.stop({ userInitiated: true });
            return;
        }
        this.playing = true;
        this.progress = 0;
        this.emit();
        const text = await this.textFor(article);
        if (token !== this.token)
            return;
        const lang = /[㐀-鿿]/.test(text) ? 'zh-CN' : bcp47('en');
        const ok = await speak(text, lang);
        if (token !== this.token)
            return;
        if (!ok) {
            this.stop({ userInitiated: false });
            return;
        }
        this.spokeAtLeastOnce = true;
        this.startedAt = Date.now();
        this.estimated = estimateSeconds(text) * 1000;
        this.timer = setInterval(() => {
            if (token !== this.token)
                return;
            const elapsed = Date.now() - this.startedAt;
            this.progress = Math.min(1, elapsed / this.estimated);
            if (this.progress >= 1) {
                this.clearTimer();
                if (this.index < this.items.length - 1) {
                    this.index += 1;
                    this.playCurrent();
                }
                else {
                    this.active = false;
                    this.playing = false;
                    this.progress = 0;
                    this.items = [];
                    this.index = 0;
                    this.emit();
                }
                return;
            }
            this.emit();
        }, TICK_MS);
        this.emit();
    }
    /** 每篇朗读文本：懒加载正文，为空回落 summary，拼成「标题. 正文」。 */
    async textFor(article) {
        let body = '';
        if (article.url) {
            const cached = await this.store.readContent(article.url);
            if (cached)
                body = cached;
        }
        if (!body && article.contentHTML)
            body = extract(article.contentHTML);
        if (!body)
            body = article.summary || '';
        return body ? `${article.title}. ${body}` : article.title;
    }
}
