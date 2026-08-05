// 打开文章：标已读（＝写入阅读历史）→ 备好正文 → 交给宿主浏览器。
// 正文四级回退：正文缓存 → feed 自带 contentHTML（长度 > summary.length + 40 才采用）→
// 抓页抽取 → 回落 feed summary。
import { openArticle as hostOpenArticle, openURL, httpGet, PAGE_MAX_BYTES } from './host.js';
import { extract } from './extractor.js';
/** 四级回退取正文；命中网络时顺手写缓存。 */
export async function resolveContent(article, store, { allowNetwork = true } = {}) {
    if (article.url) {
        const cached = await store.readContent(article.url);
        if (cached)
            return cached;
    }
    if (article.contentHTML) {
        const text = extract(article.contentHTML);
        if (text.length > (article.summary || '').length + 40) {
            if (article.url)
                await store.writeContent(article.url, text);
            return text;
        }
    }
    if (allowNetwork && article.url) {
        const page = await httpGet(article.url, { maxBytes: PAGE_MAX_BYTES });
        if (page.ok) {
            const text = extract(page.body);
            if (text) {
                await store.writeContent(article.url, text);
                return text;
            }
        }
    }
    return article.summary || '';
}
/**
 * 点击一篇文章。
 * - URL 为空直接返回（原生同）；
 * - 先标已读 → 行立即变灰 + 进历史（哪怕用户立刻返回）；
 * - openMode === 'web' → 直接开网页；否则带预提取正文进 Reader。
 */
export async function openArticle(article, { store, settings }) {
    if (!article || !article.url)
        return false;
    await store.markRead(article);
    if (settings.openMode === 'web') {
        return openURL(article.url, 'inApp');
    }
    // 打开路径上只用「已有的」正文，不为了开一篇文章先去抓一次全页（那会让点击等上几秒）。
    const content = await resolveContent(article, store, { allowNetwork: false });
    return hostOpenArticle({
        url: article.url,
        title: article.title,
        excerpt: article.summary || '',
        siteName: article.sourceName || '',
        publishedAt: new Date(article.publishedAt).toISOString(),
        content,
    });
}
/** 保存到知识库：只存摘要快照 + 原文链接，不存全文。 */
export function knowledgeMarkdown(article) {
    const published = new Date(article.publishedAt);
    const stamp = Number.isFinite(published.getTime()) ? published.toLocaleString() : '';
    const label = article.sourceName || article.url;
    return `# ${article.title}\n\n> Source: [${label}](${article.url})\n> Published: ${stamp}\n\n${article.summary || ''}\n`;
}
