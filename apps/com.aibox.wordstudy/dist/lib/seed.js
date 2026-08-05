// 内置种子资源 —— 逐字取自原生 `Resources/daily-seed.json`（8 条）与 `words-seed.tsv`（20 行）。
// 规格 §20.4：两个文件都很小，直接内联进 JS 常量最省事（不必再走 applet:// 读文件）。
/** 每日一句种子池。AI 失败时按日期稳定取一条兜底。 */
export const DAILY_SEED = [
    { en: 'Chance fights ever on the side of the prudent.', zh: '机遇永远站在谨慎者一边。', author: '欧里庇得斯' },
    { en: 'The only way to do great work is to love what you do.', zh: '成就伟业的唯一途径就是热爱自己所做的事。', author: '史蒂夫·乔布斯' },
    { en: 'It is never too late to be what you might have been.', zh: '成为你本可以成为的人，永远不会太晚。', author: '乔治·艾略特' },
    { en: 'The future belongs to those who believe in the beauty of their dreams.', zh: '未来属于那些相信自己梦想之美的人。', author: '埃莉诺·罗斯福' },
    { en: 'Well begun is half done.', zh: '良好的开始是成功的一半。', author: '亚里士多德' },
    { en: 'Knowledge speaks, but wisdom listens.', zh: '知识在说，智慧在听。', author: '吉米·亨德里克斯' },
    { en: 'A journey of a thousand miles begins with a single step.', zh: '千里之行，始于足下。', author: '老子' },
    { en: 'Whatever you are, be a good one.', zh: '无论你成为什么样的人，都要做到最好。', author: '亚伯拉罕·林肯' },
];
/**
 * 内置词表 —— **只用于联想与拼写提示，不是离线词典**（只有 `词 → 简义` 两列，无音标无例句）。
 * 表里本身就是小写，联想那一路直接 `startsWith` 前缀匹配即可。
 */
export const WORDS_SEED = [
    { word: 'lean', brief: 'vi. 倾斜；倚靠；倾向 adj. 瘦的' },
    { word: 'learn', brief: 'vt. 学习；得知' },
    { word: 'leap', brief: 'vi. 跳跃；剧增' },
    { word: 'leaflet', brief: 'n. 传单；小叶' },
    { word: 'enforce', brief: 'vt. 强迫，强制；实施，执行' },
    { word: 'mole', brief: 'n. 鼹鼠；色素痣；防波堤' },
    { word: 'glove', brief: 'n. 手套 vt. 给…戴手套' },
    { word: 'blunt', brief: 'adj. 钝的，不锋利的；生硬的；直率的' },
    { word: 'fort', brief: 'n. 堡垒；要塞' },
    { word: 'lime', brief: 'n. 石灰；酸橙；绿黄色' },
    { word: 'verdict', brief: 'n. 裁定；结论' },
    { word: 'volatile', brief: 'adj. 不稳定的；易变的；易怒的' },
    { word: 'grounding', brief: 'n. 对某学科基本要素的传授；基础' },
    { word: 'churn', brief: 'vi. 搅动；vt. 搅拌' },
    { word: 'pitfall', brief: 'n. 陷阱；诱惑' },
    { word: 'drift', brief: 'n. 漂流，漂移；趋势 vi. 漂流，漂移' },
    { word: 'surgery', brief: 'n. 外科；外科手术；手术室' },
    { word: 'cognition', brief: 'n. 认识；认识力；认知' },
    { word: 'persona', brief: 'n. 人物角色；伪装的外表' },
    { word: 'permit', brief: 'vi. 许可；允许 vt. 允许；许可' },
];
/**
 * FNV-1a 32 位稳定哈希。
 *
 * **有意改良**（规格 §22.1）：原生用 Swift 的 `String.hashValue` 取种子句，而那个哈希
 * **每次进程启动都换种子** —— "同一天多次打开看到同一条" 的承诺只在单次进程内成立，冷启动就变了。
 * 这里换成稳定哈希，同一天永远同一条。
 */
export function stableHash(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}
/** 按 dateKey 从种子池稳定取一条。池为空时返回三个空串（与原生边界行为一致）。 */
export function seedSentence(dateKey) {
    if (DAILY_SEED.length === 0)
        return { en: '', zh: '', author: '' };
    // 取模保证下标在池内；`??` 兜底与池为空时同一条返回值，只为满足 noUncheckedIndexedAccess。
    return DAILY_SEED[stableHash(dateKey) % DAILY_SEED.length] ?? { en: '', zh: '', author: '' };
}
