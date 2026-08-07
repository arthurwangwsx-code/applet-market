import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 生词本页（规格 §6）。
// 三种排序的**分组形态不同**：添加时间按 `yyyy-MM` 分组（组 key 倒序），字母顺序与复习紧急度是单一段。
// 复习紧急度里**从未复习过（null）视为最紧急排最前**。
import { useMemo, useState } from 'react';
import { removeVocab, upsertVocab } from '../lib/db.js';
import { speak } from '../lib/host.js';
import { dueCount } from '../lib/logic.js';
import { dueBanner } from '../lib/strings.js';
import { SPACE } from '../lib/theme.js';
import { DueBanner, EmptyState, Icon, InfoChip, Row, SpeakButton } from './primitives.js';
import { pickAction } from './SearchPage.js';
export function VocabPage(props) {
    const { palette, t, store } = props;
    const [filter, setFilter] = useState('all');
    const [sort, setSort] = useState('added');
    const [tag, setTag] = useState(null);
    const due = useMemo(() => dueCount(store.vocab), [store.vocab]);
    /** 考纲标签是**现算**的：只有 `kind === 'word'` 且缓存里有词条时才有标签。 */
    const tagsOf = useMemo(() => {
        const map = new Map();
        for (const item of store.vocab) {
            if (item.kind !== 'word')
                continue;
            const entry = store.entryOf(item.text);
            if (entry?.examTags.length)
                map.set(item.text, entry.examTags);
        }
        return map;
    }, [store.vocab, store.entryOf]);
    const filtered = useMemo(() => {
        const query = props.query.trim().toLowerCase();
        let rows = store.vocab.filter((item) => matchesFilter(item, filter));
        if (query) {
            rows = rows.filter((item) => item.text.includes(query) || (item.brief ?? '').toLowerCase().includes(query));
        }
        if (tag)
            rows = rows.filter((item) => (tagsOf.get(item.text) ?? []).includes(tag));
        return rows;
    }, [store.vocab, filter, props.query, tag, tagsOf]);
    const availableTags = useMemo(() => {
        const set = new Set();
        for (const item of filtered)
            for (const value of tagsOf.get(item.text) ?? [])
                set.add(value);
        return [...set].sort();
    }, [filtered, tagsOf]);
    const groups = useMemo(() => buildGroups(filtered, sort), [filtered, sort]);
    return (_jsxs("div", { style: { paddingBottom: SPACE.s6 }, children: [_jsxs("div", { style: { display: 'flex', gap: SPACE.s2, padding: `${SPACE.s3}px ${SPACE.s4}px`, flexWrap: 'wrap' }, children: [_jsx(InfoChip, { palette: palette, icon: "list", label: `${t('filterVocab')}: ${filterLabel(t, filter)}`, filled: filter !== 'all', onClick: async () => {
                            const picked = await pickAction(props, [
                                { id: 'all', title: t('filterAll') },
                                { id: 'word', title: t('filterWord') },
                                { id: 'sentence', title: t('filterSentence') },
                                { id: 'mastered', title: t('filterMastered') },
                                { id: 'unmastered', title: t('filterUnmastered') },
                            ]);
                            if (picked)
                                setFilter(picked);
                        } }), _jsx(InfoChip, { palette: palette, icon: "cards", label: `${t('sortBy')}: ${sortLabel(t, sort)}`, filled: sort !== 'added', onClick: async () => {
                            const picked = await pickAction(props, [
                                { id: 'added', title: t('sortAdded') },
                                { id: 'alpha', title: t('sortAlpha') },
                                { id: 'urgency', title: t('sortUrgency') },
                            ]);
                            if (picked)
                                setSort(picked);
                        } }), availableTags.length ? (_jsx(InfoChip, { palette: palette, label: `${t('examTag')}: ${tag ?? t('allTags')}`, filled: tag !== null, onClick: async () => {
                            const picked = await pickAction(props, [
                                { id: '__all', title: t('allTags') },
                                ...availableTags.map((value) => ({ id: value, title: value })),
                            ]);
                            if (picked)
                                setTag(picked === '__all' ? null : picked);
                        } })) : null] }), due > 0 ? (_jsx("div", { style: { padding: `0 ${SPACE.s4}px ${SPACE.s3}px` }, children: _jsx(DueBanner, { palette: palette, text: dueBanner(t, props.lang, due), onClick: props.onOpenReview }) })) : null, filtered.length === 0 ? (_jsx(EmptyState, { palette: palette, icon: "star", text: t('vocabEmpty') })) : (_jsxs(_Fragment, { children: [_jsx("div", { style: { padding: `0 ${SPACE.s4}px 6px`, fontSize: 12, color: palette.muted }, children: t('vocabCount', { n: filtered.length }) }), groups.map((group) => (_jsxs("section", { children: [group.key ? (_jsx("div", { style: { padding: `${SPACE.s3}px ${SPACE.s4}px 4px`, fontSize: 12, color: palette.muted }, children: group.key })) : null, group.items.map((item) => (_jsx(Row, { palette: palette, title: _jsxs("span", { style: { display: 'inline-flex', alignItems: 'center', gap: 6 }, children: [item.text, item.masteredAt ? _jsx(Icon, { name: "checkmark.seal", size: 12, color: palette.green }) : null] }), subtitle: item.brief || undefined, onClick: () => props.onOpenWord(item.text), trailing: _jsx(SpeakButton, { palette: palette, onClick: () => void speak(item.text, 'us') }), onLongPress: async () => {
                                    const action = await pickAction(props, [
                                        { id: 'master', title: item.masteredAt ? t('unmarkMastered') : t('markMastered') },
                                        { id: 'delete', title: t('delete'), destructive: true },
                                    ]);
                                    if (action === 'master') {
                                        await upsertVocab({ term: item.text, mastered: item.masteredAt === null });
                                        store.refresh();
                                    }
                                    if (action === 'delete') {
                                        await removeVocab(item.text);
                                        store.refresh();
                                    }
                                } }, item.text)))] }, group.key)))] }))] }));
}
function matchesFilter(item, filter) {
    switch (filter) {
        case 'word':
            return item.kind === 'word';
        case 'sentence':
            return item.kind === 'sentence';
        case 'mastered':
            return item.masteredAt !== null;
        case 'unmastered':
            return item.masteredAt === null;
        default:
            return true;
    }
}
function filterLabel(t, filter) {
    const map = {
        all: 'filterAll',
        word: 'filterWord',
        sentence: 'filterSentence',
        mastered: 'filterMastered',
        unmastered: 'filterUnmastered',
    };
    return t(map[filter]);
}
function sortLabel(t, sort) {
    const map = { added: 'sortAdded', alpha: 'sortAlpha', urgency: 'sortUrgency' };
    return t(map[sort]);
}
function buildGroups(items, sort) {
    if (sort === 'alpha') {
        return [
            { key: '', items: [...items].sort((a, b) => a.text.localeCompare(b.text, undefined, { sensitivity: 'base' })) },
        ];
    }
    if (sort === 'urgency') {
        // 从未复习过（null）视为最紧急排最前。
        return [
            { key: '', items: [...items].sort((a, b) => (a.nextReviewAt ?? -Infinity) - (b.nextReviewAt ?? -Infinity)) },
        ];
    }
    const buckets = new Map();
    for (const item of [...items].sort((a, b) => b.addedAt - a.addedAt)) {
        const date = new Date(item.addedAt);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const bucket = buckets.get(key);
        if (bucket)
            bucket.push(item);
        else
            buckets.set(key, [item]);
    }
    return [...buckets.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([key, group]) => ({ key, items: group }));
}
