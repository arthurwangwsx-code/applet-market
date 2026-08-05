// 三个数据源 Provider 的移植：RSS/Atom（原样 GET）、RSSHub（实例基址 + 路由 + limit）、
// NewsAPI（NewsData.io JSON）。统一返回 `{ articles, failure, httpStatus }`，失败不抛。
import { httpGet, FAILURE, FEED_MAX_BYTES } from './host.js';
import { parseFeed } from './feedParser.js';
import { plain, stableKey } from './text.js';
import { parseDate } from './dates.js';
export const RSSHUB_DEFAULT_INSTANCE = 'https://rsshub.app';
export const FEED_LIMIT = 40;
export const API_LIMIT = 20;
const success = (articles) => ({ articles, failure: null, httpStatus: null });
const failed = (failure, httpStatus = null) => ({ articles: [], failure, httpStatus });
function refOf(feed) {
    return { sourceID: feed.id, sourceName: feed.title, topic: feed.topic };
}
/** 原生 RSS / Atom：完整 URL 原样 GET，一次 40 条。 */
export async function fetchRSS(feed, { now = Date.now(), limit = FEED_LIMIT } = {}) {
    const response = await httpGet(feed.endpoint, { maxBytes: FEED_MAX_BYTES });
    if (!response.ok)
        return failed(response.failure || FAILURE.unknown, response.httpStatus);
    return success(parseFeed(response.body, refOf(feed), now).slice(0, limit));
}
function trimTrailingSlash(text) {
    let out = String(text || '');
    while (out.endsWith('/'))
        out = out.slice(0, -1);
    return out;
}
/** RSSHub：`trimSlash(instance) + route + ("?"|"&") + limit=40`。 */
export async function fetchRSSHub(feed, { instance, now = Date.now(), limit = FEED_LIMIT } = {}) {
    const base = trimTrailingSlash(instance || RSSHUB_DEFAULT_INSTANCE);
    const route = feed.endpoint.startsWith('/') ? feed.endpoint : `/${feed.endpoint}`;
    const separator = feed.endpoint.includes('?') ? '&' : '?';
    const url = `${base}${route}${separator}limit=${limit}`;
    const response = await httpGet(url, { maxBytes: FEED_MAX_BYTES });
    if (!response.ok)
        return failed(response.failure || FAILURE.unknown, response.httpStatus);
    return success(parseFeed(response.body, refOf(feed), now).slice(0, limit));
}
/** NewsData.io 分类 → 本地主题。 */
export function mapAPITopic(category) {
    switch (String(category || '').toLowerCase()) {
        case 'world': return 'world';
        case 'politics':
        case 'top': return 'top';
        case 'technology': return 'tech';
        case 'business': return 'business';
        case 'science':
        case 'environment': return 'science';
        case 'sports': return 'sports';
        case 'health':
        case 'food': return 'health';
        case 'entertainment': return 'culture';
        default: return 'top';
    }
}
/** News API（NewsData.io latest）：apiKey + 关键词 + 语言，一次 20 条。 */
export async function fetchNewsAPI(feed, { apiKey, language = 'zh', now = Date.now(), limit = API_LIMIT } = {}) {
    const key = String(apiKey || '').trim();
    if (!key)
        return failed(FAILURE.configuration);
    const params = new URLSearchParams();
    params.set('apikey', key);
    const query = String(feed.endpoint || '').trim();
    if (query)
        params.set('q', query);
    if (language)
        params.set('language', language);
    const url = `https://newsdata.io/api/1/latest?${params.toString()}`;
    const response = await httpGet(url, { maxBytes: FEED_MAX_BYTES });
    if (!response.ok)
        return failed(response.failure || FAILURE.unknown, response.httpStatus);
    let payload;
    try {
        payload = JSON.parse(response.body);
    }
    catch (error) {
        return failed(FAILURE.decoding);
    }
    if (!payload || !Array.isArray(payload.results))
        return failed(FAILURE.decoding);
    const articles = [];
    for (const row of payload.results.slice(0, limit)) {
        const title = String((row && row.title) || '').trim();
        const link = String((row && row.link) || '');
        if (!title || !link)
            continue;
        const description = row.description || row.content || '';
        const src = row.source_id || row.source_name || 'news api';
        const category = Array.isArray(row.category) ? row.category[0] : 'top';
        const parsed = parseDate(row.pubDate || '');
        const guid = row.article_id || '';
        const author = Array.isArray(row.creator) ? (row.creator[0] || '') : '';
        articles.push({
            id: stableKey(link, guid, title),
            title,
            url: link,
            summary: plain(description).slice(0, 400),
            contentHTML: null,
            author,
            sourceID: `api:${src}`,
            sourceName: src,
            topic: mapAPITopic(category),
            imageURL: row.image_url || null,
            publishedAt: parsed ? parsed.getTime() : now,
            fetchedAt: now,
            clusterID: null,
        });
    }
    return success(articles);
}
/** 按 kind 分发。`settings` 提供 RSSHub 实例、API Key 与检索语言。 */
export async function fetchFeed(feed, settings, now = Date.now()) {
    switch (feed.kind) {
        case 'rsshub':
            return fetchRSSHub(feed, { instance: settings.rsshubInstance, now });
        case 'api':
            return fetchNewsAPI(feed, { apiKey: settings.newsAPIKey, language: settings.searchLanguage, now });
        case 'rss':
        case 'atom':
        default:
            return fetchRSS(feed, { now });
    }
}
