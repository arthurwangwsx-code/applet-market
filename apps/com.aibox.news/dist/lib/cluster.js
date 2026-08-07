// 事件聚类 —— **近似实现，不是 1:1**。
//
// 原生 NewsClusterer 用 NLTextEmbedder（Apple 的句向量模型）对 `title + " " + summary` 取向量，
// 贪心单遍、余弦 > 0.82 归并、代表向量取簇内第一篇（不更新质心）。
// 小应用运行时里没有任何句向量模型（离线白名单只有 react / antd-mobile / chart.js），
// 因此改用**词袋（TF）余弦**：切词规则复用 SimHash 的 shingles（CJK 逐字 + 相邻二字组）。
//
// 保留的部分：贪心单遍、代表向量 = 簇内第一篇、取不到向量的文章不聚类、簇 ID 形如 c1/c2…。
// 改变的部分：相似度度量与阈值。词袋余弦的量纲与句向量完全不同——同一事件的两篇报道在句向量里
// 常达 0.85+，在词袋里通常只有 0.35~0.6，所以阈值必须重标定。默认 0.45 是**按度量特性推定**的，
// 未经真实语料标注验证；设置页没有暴露它，需要调整请改这里的 DEFAULT_THRESHOLD。
import { shingles } from './text.js';
export const DEFAULT_THRESHOLD = 0.45;
/** 少于这么多共享词就不认为是同一事件（防止两条极短标题因为一个共同词就并簇）。 */
const MIN_SHARED_TOKENS = 2;
/** 文本 → 归一化稀疏词频向量；空文本返回 null（＝原生「取不到向量」的降级分支）。 */
export function vectorize(text) {
    const tokens = shingles(text);
    if (tokens.length === 0)
        return null;
    const counts = new Map();
    for (const token of tokens)
        counts.set(token, (counts.get(token) || 0) + 1);
    let sumSquares = 0;
    for (const value of counts.values())
        sumSquares += value * value;
    const norm = Math.sqrt(sumSquares);
    if (norm === 0)
        return null;
    for (const [key, value] of counts)
        counts.set(key, value / norm);
    return counts;
}
/** 两个归一化稀疏向量的余弦；同时回报共享词数。 */
export function cosine(a, b) {
    const [small, large] = a.size <= b.size ? [a, b] : [b, a];
    let dot = 0;
    let shared = 0;
    for (const [key, value] of small) {
        const other = large.get(key);
        if (other !== undefined) {
            dot += value * other;
            shared += 1;
        }
    }
    return { similarity: dot, shared };
}
/**
 * 给文章打 clusterID（贪心单遍）。返回新数组，不修改入参。
 * @returns {{ articles: Array, clusteredCount: number }}
 */
export function cluster(articles, threshold = DEFAULT_THRESHOLD) {
    if (!Array.isArray(articles) || articles.length <= 1) {
        return { articles: articles || [], clusteredCount: 0 };
    }
    const reps = [];
    const clusterIDs = [];
    const assigned = articles.map((article) => ({ ...article }));
    let counter = 0;
    let clusteredCount = 0;
    for (let i = 0; i < assigned.length; i += 1) {
        const article = assigned[i];
        if (!article)
            continue;
        const vector = vectorize(`${article.title} ${article.summary}`);
        if (!vector)
            continue;
        let bestIndex = -1;
        let bestSimilarity = threshold;
        for (let k = 0; k < reps.length; k += 1) {
            const { similarity, shared } = cosine(vector, reps[k]);
            if (shared >= MIN_SHARED_TOKENS && similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestIndex = k;
            }
        }
        if (bestIndex >= 0) {
            article.clusterID = clusterIDs[bestIndex] ?? null;
        }
        else {
            counter += 1;
            const id = `c${counter}`;
            reps.push(vector);
            clusterIDs.push(id);
            article.clusterID = id;
        }
        clusteredCount += 1;
    }
    return { articles: assigned, clusteredCount };
}
