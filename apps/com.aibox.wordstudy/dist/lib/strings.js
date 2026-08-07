// 文案表 —— 逐条取自原生 `WordStudyKit/Resources/Localizable.xcstrings`（131 键，en 源 + zh-Hans）。
// 生效语言由 `useLocale()` 给（首帧就有值，不会先渲染成英文再闪）。
const TABLE = {
    // 全局 / Tab
    tabTranslate: { zh: '翻译', en: 'Translate' },
    tabSearch: { zh: '搜索', en: 'Search' },
    tabVocab: { zh: '生词本', en: 'Vocabulary' },
    // 搜索页
    searchPlaceholder: { zh: '查询单词或句子', en: 'Search a word or sentence' },
    reviewBannerOne: { zh: '今天有 1 个词到期待复习', en: '1 word due for review today' },
    reviewBannerOther: { zh: '今天有 {n} 个词到期待复习', en: '{n} words due for review today' },
    dailyHeader: { zh: '每日一句', en: 'SENTENCE OF THE DAY' },
    speakNormal: { zh: '常速', en: 'Normal' },
    speakSlow: { zh: '慢速', en: 'Slow' },
    recentLookups: { zh: '最近查询', en: 'Recent Lookups' },
    translationHistory: { zh: '翻译历史', en: 'Translation History' },
    clear: { zh: '清空', en: 'Clear' },
    expandAll: { zh: '展开全部', en: 'Show all' },
    collapse: { zh: '收起', en: 'Show less' },
    emptySearchHint: { zh: '查一个今天遇到的词试试', en: 'Look up a word you met today' },
    clearHistoryTitle: { zh: '清空查询历史？', en: 'Clear lookup history?' },
    clearTranslationsTitle: { zh: '清空翻译历史？', en: 'Clear translation history?' },
    lookupAction: { zh: '查询', en: 'Look up' },
    translateAsSentence: { zh: '作为句子翻译', en: 'Translate as a sentence' },
    cached: { zh: '已缓存', en: 'Cached' },
    copy: { zh: '复制', en: 'Copy' },
    copied: { zh: '已复制', en: 'Copied' },
    addToVocab: { zh: '加入生词本', en: 'Add to vocabulary' },
    delete: { zh: '删除', en: 'Delete' },
    speakAloud: { zh: '朗读', en: 'Speak' },
    favourite: { zh: '收藏', en: 'Favourite' },
    unfavourite: { zh: '取消收藏', en: 'Unfavourite' },
    cancel: { zh: '取消', en: 'Cancel' },
    photoLookup: { zh: '拍照/相册查词', en: 'Look Up from Photo' },
    // 词详情
    regenerate: { zh: '重新生成', en: 'Regenerate' },
    copyEntry: { zh: '复制词条', en: 'Copy entry' },
    share: { zh: '分享', en: 'Share' },
    regenerateFailed: {
        zh: '更新词条失败，已保留原有版本。',
        en: 'Could not update the entry; the previous version is kept.',
    },
    didYouMean: { zh: '你要找的是不是', en: 'Did you mean' },
    sourceAI: { zh: 'AI 生成', en: 'AI generated' },
    sourceYoudao: { zh: '有道词典', en: 'Youdao Dictionary' },
    sourceOther: { zh: '词典来源', en: 'Dictionary source' },
    justUpdated: { zh: '刚刚更新', en: 'Just updated' },
    sectionSenses: { zh: '释义', en: 'Senses' },
    sectionCompanion: { zh: 'AI 单词伴侣', en: 'AI Word Companion' },
    sectionForms: { zh: '变形', en: 'Forms' },
    sectionExamples: { zh: '例句', en: 'Examples' },
    sectionMemoryTip: { zh: 'AI 助记', en: 'AI Memory Tip' },
    sectionRelated: { zh: '近义 / 反义', en: 'Synonyms / Antonyms' },
    loadFailed: { zh: '加载失败', en: 'Loading failed' },
    retry: { zh: '重试', en: 'Retry' },
    starred: { zh: '已收藏', en: 'Saved' },
    // AI 伴侣
    companionTitle: { zh: 'AI 单词伴侣', en: 'AI Word Companion' },
    chipSimpler: { zh: '换个更简单的例句', en: 'Simpler example' },
    chipOther: { zh: '还有其他意思吗？', en: 'Other meanings?' },
    chipStory: { zh: '讲个记忆小故事', en: 'Memory story' },
    chipWrite: { zh: '帮我造句', en: 'Help me write a sentence' },
    chipQuiz: { zh: '考考我', en: 'Quiz me' },
    companionPlaceholder: { zh: '就这个词随便问…', en: 'Ask anything about this word…' },
    sendToChat: { zh: '转到主聊天', en: 'Send to main chat' },
    // 翻译
    translateTitle: { zh: '翻译', en: 'Translate' },
    autoDetect: { zh: '自动判向', en: 'Auto-detect' },
    translateInputPlaceholder: { zh: '输入要翻译的文本', en: 'Enter text to translate' },
    translateAction: { zh: '翻译', en: 'Translate' },
    translateFailed: { zh: '翻译失败，请重试', en: 'Translation failed, please try again' },
    retranslate: { zh: '重新翻译', en: 'Translate again' },
    noTranslationRecord: { zh: '查一个今天遇到的词试试', en: 'Look up a word you met today' },
    // 生词本
    vocabTitle: { zh: '生词本', en: 'Vocabulary' },
    vocabFilterPlaceholder: { zh: '筛选生词', en: 'Filter vocabulary' },
    filterVocab: { zh: '筛选生词', en: 'Filter' },
    filterAll: { zh: '全部', en: 'All' },
    filterWord: { zh: '仅单词', en: 'Words only' },
    filterSentence: { zh: '仅句子', en: 'Sentences only' },
    filterMastered: { zh: '已掌握', en: 'Mastered' },
    filterUnmastered: { zh: '未掌握', en: 'Not mastered' },
    sortBy: { zh: '排序', en: 'Sort' },
    sortAdded: { zh: '添加时间', en: 'Date added' },
    sortAlpha: { zh: '字母顺序', en: 'Alphabetical' },
    sortUrgency: { zh: '复习紧急度', en: 'Review urgency' },
    examTag: { zh: '考纲标签', en: 'Exam tag' },
    allTags: { zh: '全部标签', en: 'All tags' },
    vocabEmpty: { zh: '查词时点 ★ 即可收进生词本', en: 'Tap ★ while looking up to save a word' },
    vocabCount: { zh: '共 {n} 个生词', en: '{n} saved' },
    markMastered: { zh: '已掌握', en: 'Mastered' },
    unmarkMastered: { zh: '取消掌握', en: 'Not mastered' },
    // 复习
    reviewTitle: { zh: '复习', en: 'Review' },
    reviewEmpty: { zh: '暂时没有到期要复习的词', en: 'Nothing is due for review right now' },
    reviewDoneCount: { zh: '本次复习了 {n} 个词', en: 'Reviewed {n} words' },
    reviewTomorrow: { zh: '明天还有 {n} 个词到期', en: '{n} more due tomorrow' },
    done: { zh: '完成', en: 'Done' },
    exerciseListening: { zh: '听音辨词', en: 'Listening' },
    exerciseCloze: { zh: '例句填空', en: 'Fill in the Blank' },
    exerciseSpelling: { zh: '看义拼写', en: 'Spelling' },
    listeningHint: { zh: '听发音，输入你听到的内容。', en: 'Listen and type what you hear.' },
    promptFallback: { zh: '输入与提示匹配的单词。', en: 'Type the word that matches the hint.' },
    answerPlaceholder: { zh: '输入答案', en: 'Type your answer' },
    checkAnswer: { zh: '检查答案', en: 'Check answer' },
    showAnswer: { zh: '查看答案', en: 'Show answer' },
    answerCorrect: { zh: '回答正确', en: 'Correct' },
    answerKeepPracticing: { zh: '继续练习', en: 'Keep practicing' },
    savedContext: { zh: '收藏时语境', en: 'Saved context' },
    viewFullDetail: { zh: '查看完整详情', en: 'View full entry' },
    gradeForgot: { zh: '忘记', en: 'Forgot' },
    gradeFuzzy: { zh: '模糊', en: 'Fuzzy' },
    gradeKnow: { zh: '认识', en: 'Know it' },
    // 跟读 / 相册
    practiceTitle: { zh: '跟读练习', en: 'Read-aloud practice' },
    practiceTapToStart: { zh: '轻触开始跟读', en: 'Tap to start' },
    practiceRecording: { zh: '录音中…轻触结束', en: 'Recording… tap to finish' },
    practiceScoring: { zh: '评分中…', en: 'Scoring…' },
    practiceMatchLabel: { zh: '语音识别文本匹配度', en: 'Speech recognition text match' },
    practiceRetry: { zh: '重试', en: 'Try again' },
    speechRecognizerUnavailable: {
        zh: '此设备暂时无法使用语音识别。',
        en: 'Speech recognition is unavailable on this device.',
    },
    speechOnDeviceUnsupported: {
        zh: '此设备不支持该语言的本地语音识别。',
        en: 'On-device recognition is not supported for this language.',
    },
    speechMicDenied: {
        zh: '需要麦克风权限，请在设置中允许。',
        en: 'Microphone access is required. Allow it in Settings.',
    },
    speechDenied: {
        zh: '需要语音识别权限，请在设置中允许。',
        en: 'Speech recognition access is required. Allow it in Settings.',
    },
    photoPickHint: {
        zh: '选一张带英文的图片，点其中的词即可查询。',
        en: 'Pick a picture with English text, then tap a word to look it up.',
    },
    photoPick: { zh: '选择照片', en: 'Choose photo' },
    photoChange: { zh: '换一张照片', en: 'Choose another' },
    photoTapWord: { zh: '点其中的词即可查询', en: 'Tap a word to look it up' },
    photoNoText: { zh: '这张图片里没有识别到文字。', en: 'No text was recognized in this picture.' },
    photoLoadFailed: { zh: '无法加载这张图片。', en: 'This picture could not be loaded.' },
    photoUnsupported: { zh: '此设备不支持文字识别。', en: 'Text recognition is not supported on this device.' },
    // 错误
    errNoProvider: { zh: '所选模型未配置 AI 服务商。', en: 'No AI provider is configured for the selected model.' },
    errUnparseable: { zh: 'AI 返回内容无法解析。', en: "The AI response couldn't be parsed." },
};
/** 取一条文案，可选插值 `{n}`。 */
export function makeT(lang) {
    return (key, params) => {
        let value = TABLE[key][lang];
        if (params) {
            for (const [name, replacement] of Object.entries(params)) {
                value = value.split(`{${name}}`).join(String(replacement));
            }
        }
        return value;
    };
}
/** 复习提醒条：英文有 one/other 复数，中文只有 other。 */
export function dueBanner(t, lang, count) {
    if (lang === 'en' && count === 1)
        return t('reviewBannerOne');
    return t('reviewBannerOther', { n: count });
}
/** 来源名映射（规格 §3.2）。 */
export function sourceLabel(t, source) {
    if (source === 'youdao')
        return t('sourceYoudao');
    if (!source || source === 'ai')
        return t('sourceAI');
    return t('sourceOther');
}
