// 领域类型 —— 对齐 VoiceMemosDomain 的值类型（规格 §14）。日期一律存 epoch 毫秒。
export const DEFAULT_SETTINGS = {
    transcribeLocale: 'auto',
    autoTranscribe: false,
    autoSummarize: false,
    defaultTemplate: 'general',
    quality: 'high',
};
/** 录音质量 → AAC 参数（规格 §9.1，逐条对齐）。声道恒为单声道。 */
export const QUALITY_PRESET = {
    high: { sampleRate: 44_100, bitrate: 128_000 },
    medium: { sampleRate: 32_000, bitrate: 96_000 },
    low: { sampleRate: 22_050, bitrate: 64_000 },
};
export const DEFAULT_FILTER = {
    duration: 'any',
    date: 'all',
    sort: 'newest',
    favOnly: false,
    withTranscript: false,
};
/** `isActive` = 任一收窄条件生效（**排序不算**）—— 决定筛选图标是否填充。 */
export function filterIsActive(filter) {
    return filter.duration !== 'any'
        || filter.date !== 'all'
        || filter.favOnly
        || filter.withTranscript;
}
