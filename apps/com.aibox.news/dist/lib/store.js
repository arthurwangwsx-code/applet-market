// 持久化层（对应原生 NewsStore + NewsSnapshotCache + NewsContentCache）。
// 全部落 aibox.storage（每 applet 隔离的 JSON KV，市场更新时保留）。
//
// 键位：
//   news.feeds          订阅源数组
//   news.saved          收藏数组
//   news.read           阅读记录数组（上限 2000，超限按 readAt 升序删到 1500）
//   news.settings       设置
//   news.snapshot       时间线快照 { articles(≤timelineLimit), savedAt }
//   news.content.index  正文缓存索引 { [hash]: { bytes, accessedAt } }
//   news.content.<hash> 正文分片 { url, text, bytes, accessedAt }
// migrate: 本文件对 ./host.js 的依赖已全部由 @aibox/applet-sdk 取代
import { SEEDS } from './catalog.js';
import { fnv1aHex, normalizeURL } from './text.js';
import { storage } from 'aibox/sdk';
export const KEYS = {
    feeds: 'news.feeds',
    saved: 'news.saved',
    read: 'news.read',
    settings: 'news.settings',
    snapshot: 'news.snapshot',
    contentIndex: 'news.content.index',
};
export const READ_HISTORY_CAP = 2000;
export const READ_HISTORY_TRIM_TO = 1500;
export const HISTORY_UI_LIMIT = 200;
export const DEFAULT_SETTINGS = {
    // ① 阅读与显示
    openMode: 'auto', // auto / reader / web
    collapseClusters: true,
    showRefreshStatus: true,
    hideRead: false,
    // ② 刷新与性能
    autoRefresh: true,
    backgroundRefresh: true,
    pauseInLowPower: true,
    clustering: true,
    prefetch: true,
    prefetchCount: 12, // 0 / 6 / 12 / 20 / 30
    timelineLimit: 300, // 100 / 200 / 300
    // ③ 已缓存正文
    cacheLimitMB: 50, // 20 / 50 / 100 / 200
    // ⑤ 高级设置
    rsshubInstance: 'https://rsshub.app',
    newsAPIKey: '',
    searchLanguage: 'zh',
};
export function newID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        return crypto.randomUUID();
    return `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function asArray(value) {
    return Array.isArray(value) ? value : [];
}
function json(value) {
    return value;
}
/** 一个极小的可订阅状态容器（React 侧用 useStore 订阅）。 */
export class NewsStore {
    feeds;
    saved;
    read;
    settings;
    contentIndex;
    ready;
    listeners;
    version;
    constructor() {
        this.feeds = [];
        this.saved = [];
        this.read = [];
        this.settings = { ...DEFAULT_SETTINGS };
        this.contentIndex = {};
        this.ready = false;
        this.listeners = new Set();
        this.version = 0;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    emit() {
        this.version += 1;
        for (const listener of [...this.listeners])
            listener(this.version);
    }
    async load() {
        const [feeds, saved, read, settings, contentIndex] = await Promise.all([
            storage.get(KEYS.feeds, null),
            storage.get(KEYS.saved, null),
            storage.get(KEYS.read, null),
            storage.get(KEYS.settings, null),
            storage.get(KEYS.contentIndex, null),
        ]);
        this.feeds = asArray(feeds);
        this.saved = asArray(saved);
        this.read = asArray(read);
        this.settings = {
            ...DEFAULT_SETTINGS,
            ...(settings && typeof settings === 'object' ? settings : {}),
        };
        this.contentIndex =
            contentIndex && typeof contentIndex === 'object' && !Array.isArray(contentIndex)
                ? contentIndex
                : {};
        if (this.feeds.length === 0) {
            this.feeds = seedFeeds();
            await storage.set(KEYS.feeds, json(this.feeds));
        }
        this.ready = true;
        this.emit();
    }
    // MARK: 设置
    async updateSettings(patch) {
        this.settings = { ...this.settings, ...patch };
        this.emit();
        await storage.set(KEYS.settings, json(this.settings));
    }
    // MARK: 订阅源
    get enabledFeeds() {
        return this.feeds.filter((feed) => feed.enabled);
    }
    async persistFeeds() {
        this.emit();
        await storage.set(KEYS.feeds, json(this.feeds));
    }
    /**
     * @param explicitKind true 时 `kind` 说了算（news_source 工具语义：显式 kind 优先）；
     *   false 时「endpoint 以 / 开头强制视为 rsshub」（添加表单语义，与原生 NewsStore.addFeed 一致）。
     */
    async addFeed({ title, endpoint, kind, topic, explicitKind = false }) {
        const trimmedEndpoint = String(endpoint || '').trim();
        const effectiveKind = explicitKind ? kind : trimmedEndpoint.startsWith('/') ? 'rsshub' : kind;
        const maxOrder = this.feeds.reduce((max, feed) => Math.max(max, feed.sortOrder || 0), 0);
        const feed = {
            id: newID(),
            title: String(title || '').trim() || trimmedEndpoint,
            endpoint: trimmedEndpoint,
            kind: effectiveKind,
            topic,
            enabled: true,
            isBuiltin: false,
            sortOrder: maxOrder + 1,
            lastFetched: 0,
        };
        this.feeds = [...this.feeds, feed];
        await this.persistFeeds();
        return feed;
    }
    async setFeedEnabled(id, enabled) {
        this.feeds = this.feeds.map((feed) => (feed.id === id ? { ...feed, enabled } : feed));
        await this.persistFeeds();
    }
    async removeFeed(id) {
        this.feeds = this.feeds.filter((feed) => feed.id !== id);
        await this.persistFeeds();
    }
    /** 在同主题分组内上/下移（direction = -1 上移 / +1 下移）。 */
    async moveFeed(id, direction) {
        const target = this.feeds.find((feed) => feed.id === id);
        if (!target)
            return;
        const siblings = this.feeds
            .filter((feed) => feed.topic === target.topic)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        const index = siblings.findIndex((feed) => feed.id === id);
        const swapWith = index + direction;
        if (index < 0 || swapWith < 0 || swapWith >= siblings.length)
            return;
        const a = siblings[index];
        const b = siblings[swapWith];
        if (!a || !b)
            return;
        const orderA = a.sortOrder || 0;
        const orderB = b.sortOrder || 0;
        this.feeds = this.feeds.map((feed) => {
            if (feed.id === a.id)
                return { ...feed, sortOrder: orderB };
            if (feed.id === b.id)
                return { ...feed, sortOrder: orderA };
            return feed;
        });
        await this.persistFeeds();
    }
    async markFeedFetched(id, at = Date.now()) {
        let changed = false;
        this.feeds = this.feeds.map((feed) => {
            if (feed.id !== id)
                return feed;
            changed = true;
            return { ...feed, lastFetched: at };
        });
        if (changed)
            await storage.set(KEYS.feeds, json(this.feeds));
    }
    // MARK: 收藏
    get savedKeys() {
        return new Set(this.saved.map((entry) => entry.id));
    }
    async save(article) {
        if (this.saved.some((entry) => entry.id === article.id))
            return;
        this.saved = [
            {
                id: article.id,
                url: article.url,
                title: article.title,
                summary: article.summary,
                sourceName: article.sourceName,
                topic: article.topic,
                imageURL: article.imageURL || '',
                author: article.author || '',
                publishedAt: article.publishedAt,
                savedAt: Date.now(),
                fullText: '',
            },
            ...this.saved,
        ];
        this.emit();
        await storage.set(KEYS.saved, json(this.saved));
    }
    async unsave(id) {
        this.saved = this.saved.filter((entry) => entry.id !== id);
        this.emit();
        await storage.set(KEYS.saved, json(this.saved));
    }
    // MARK: 已读 / 历史
    get readKeys() {
        return new Set(this.read.map((entry) => entry.articleKey));
    }
    /** 标已读：readAt 置顶 + 补齐展示字段（＝写入阅读历史）。 */
    async markRead(article) {
        const now = Date.now();
        const entry = {
            articleKey: article.id,
            readAt: now,
            title: article.title || '',
            url: article.url || '',
            sourceName: article.sourceName || '',
            imageURL: article.imageURL || '',
            topic: article.topic || 'top',
            publishedAt: article.publishedAt || 0,
        };
        const rest = this.read.filter((row) => row.articleKey !== article.id);
        let next = [entry, ...rest];
        if (next.length > READ_HISTORY_CAP) {
            next.sort((a, b) => b.readAt - a.readAt);
            next = next.slice(0, READ_HISTORY_TRIM_TO);
        }
        this.read = next;
        this.emit();
        await storage.set(KEYS.read, json(this.read));
    }
    async markUnread(articleKey) {
        this.read = this.read.filter((row) => row.articleKey !== articleKey);
        this.emit();
        await storage.set(KEYS.read, json(this.read));
    }
    /** 删除一条历史（收藏页历史子 Tab 的左滑删除）。 */
    async removeHistory(articleKey) {
        return this.markUnread(articleKey);
    }
    // MARK: 时间线快照
    async loadSnapshot() {
        const snapshot = await storage.get(KEYS.snapshot, null);
        if (!snapshot || typeof snapshot !== 'object')
            return null;
        const row = snapshot;
        return { articles: asArray(row.articles), savedAt: Number(row.savedAt) || 0 };
    }
    async persistSnapshot(articles) {
        await storage.set(KEYS.snapshot, json({
            articles: articles.slice(0, this.settings.timelineLimit),
            savedAt: Date.now(),
        }));
    }
    // MARK: 正文缓存（分片 + LRU）
    contentCacheBytes() {
        return Object.values(this.contentIndex).reduce((sum, row) => sum + (row.bytes || 0), 0);
    }
    static shardKey(url) {
        return `news.content.${fnv1aHex(normalizeURL(url))}`;
    }
    async readContent(url) {
        const key = NewsStore.shardKey(url);
        const shard = await storage.get(key, null);
        if (!shard || typeof shard !== 'object' || Array.isArray(shard) || !('text' in shard))
            return null;
        const text = shard.text;
        if (typeof text !== 'string' || !text)
            return null;
        const row = this.contentIndex[key];
        if (row) {
            // 读命中会 touch 访问时间（LRU 靠它排序）。
            this.contentIndex = { ...this.contentIndex, [key]: { ...row, accessedAt: Date.now() } };
            await storage.set(KEYS.contentIndex, json(this.contentIndex));
        }
        return text;
    }
    async writeContent(url, text) {
        if (!text)
            return;
        const key = NewsStore.shardKey(url);
        const bytes = text.length * 2;
        await storage.set(key, json({ url, text, bytes, accessedAt: Date.now() }));
        this.contentIndex = { ...this.contentIndex, [key]: { bytes, accessedAt: Date.now() } };
        await this.enforceCacheLimit();
    }
    /** 写完超限 → LRU 按访问时间升序删到 90% 水位。 */
    async enforceCacheLimit() {
        const limit = (this.settings.cacheLimitMB || 50) * 1000 * 1000;
        let total = this.contentCacheBytes();
        if (total <= limit) {
            await storage.set(KEYS.contentIndex, json(this.contentIndex));
            return;
        }
        const target = limit * 0.9;
        const rows = Object.entries(this.contentIndex).sort((a, b) => (a[1].accessedAt || 0) - (b[1].accessedAt || 0));
        const next = { ...this.contentIndex };
        for (const [key, row] of rows) {
            if (total <= target)
                break;
            delete next[key];
            total -= row.bytes || 0;
            await storage.remove(key);
        }
        this.contentIndex = next;
        await storage.set(KEYS.contentIndex, json(this.contentIndex));
        this.emit();
    }
    async clearContentCache() {
        for (const key of Object.keys(this.contentIndex))
            await storage.remove(key);
        this.contentIndex = {};
        await storage.set(KEYS.contentIndex, json(this.contentIndex));
        this.emit();
    }
}
function seedFeeds() {
    return SEEDS.map((seed, index) => ({
        id: newID(),
        title: seed.title,
        endpoint: seed.endpoint,
        kind: seed.kind,
        topic: seed.topic,
        enabled: seed.enabled,
        isBuiltin: true,
        sortOrder: index,
        lastFetched: 0,
    }));
}
