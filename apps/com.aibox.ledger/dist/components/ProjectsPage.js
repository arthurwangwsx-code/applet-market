import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 项目页（LedgerProjectsView）。
// 「项目」= 正交于分类/账户/标签的分组维度：一笔可以同时属于项目 + 分类 + 账户 + 标签。
import React from 'react';
import { IconBadge } from './Icon.js';
import { Card, Divider, EmptyState, SectionHeader, useLongPress } from './primitives.js';
import { C, RADIUS, SPACE, alpha, fade } from './theme.js';
import { projectSpentMinor } from '../lib/split.js';
import { money, moneyCompact } from '../lib/money.js';
import { mediumDayDate } from '../lib/dates.js';
export default function ProjectsPage({ ctx }) {
    const { store, t, canMutate } = ctx;
    const active = store.projects.filter((row) => !row.isArchived).sort((a, b) => a.sortOrder - b.sortOrder);
    const archived = store.projects.filter((row) => row.isArchived).sort((a, b) => a.sortOrder - b.sortOrder);
    if (active.length === 0 && archived.length === 0) {
        return (_jsx("div", { className: "lg-scroll", style: { flex: '1 1 auto', padding: SPACE.s4 }, children: _jsx(EmptyState, { icon: "folder.badge.plus", title: t('prj.emptyTitle'), body: t('prj.emptyBody') }) }));
    }
    return (_jsx("div", { className: "lg-scroll", style: { flex: '1 1 auto' }, children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s4, paddingBottom: 96 }, children: [active.length > 0 ? (_jsx(Card, { padding: 0, children: active.map((project, index) => (_jsxs(React.Fragment, { children: [index > 0 ? _jsx(Divider, { inset: 60 }) : null, _jsx(ProjectRow, { ctx: ctx, project: project, canMutate: canMutate })] }, project.id))) })) : null, archived.length > 0 ? (_jsxs("div", { children: [_jsx(SectionHeader, { children: t('x.archived') }), _jsx(Card, { padding: 0, children: archived.map((project, index) => (_jsxs(React.Fragment, { children: [index > 0 ? _jsx(Divider, { inset: 60 }) : null, _jsx(ProjectRow, { ctx: ctx, project: project, canMutate: canMutate, archived: true })] }, project.id))) })] })) : null] }) }));
}
function subtitleFor(project, t, locale) {
    const start = project.startOn ? mediumDayDate(project.startOn, locale) : null;
    const end = project.endOn ? mediumDayDate(project.endOn, locale) : null;
    if (start && end)
        return `${start} – ${end}`;
    if (start)
        return t('prj.since', start);
    if (end)
        return null; // 只有止 → 不显示副标题
    return project.isActive ? t('prj.ongoing') : null;
}
function ProjectRow({ ctx, project, canMutate, archived }) {
    const { store, t, locale, actions } = ctx;
    const spent = projectSpentMinor(store, project.id);
    const subtitle = subtitleFor(project, t, locale);
    const longPress = useLongPress(() => {
        if (!canMutate)
            return;
        const items = archived
            ? [{ id: 'restore', label: t('x.restore'), icon: 'arrow.uturn.backward', onSelect: () => actions.archiveProject(project, false) }]
            : [
                project.isActive
                    ? { id: 'clear', label: t('prj.clearCurrent'), icon: 'circle.slash', onSelect: () => actions.clearCurrentProject() }
                    : { id: 'set', label: t('prj.setCurrent'), icon: 'checkmark.circle', onSelect: () => actions.activateProject(project) },
                { id: 'edit', label: t('x.edit'), icon: 'pencil', onSelect: () => actions.editProject(project) },
                { id: 'archive', label: t('x.archive'), icon: 'archivebox', destructive: true, onSelect: () => actions.archiveProject(project, true) },
            ];
        actions.showMenu(items);
    });
    return (_jsxs("button", { type: "button", className: "lg-btn", onClick: () => actions.openProject(project), ...longPress, style: { display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%', padding: SPACE.s3 }, children: [_jsx(IconBadge, { name: project.systemImage, size: 40, color: project.colorHex, background: alpha(project.colorHex, 0.16) }), _jsxs("div", { style: { flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }, children: [_jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }, children: [_jsx("span", { className: "lg-clamp-1", style: { fontSize: 15, fontWeight: 500, color: C.ink }, children: project.name }), project.isActive ? (_jsx("span", { style: {
                                    fontSize: 10, fontWeight: 500, color: C.brand, background: fade(C.brand, 14),
                                    borderRadius: RADIUS.pill, padding: '1px 6px', flex: '0 0 auto',
                                }, children: t('prj.current') })) : null] }), subtitle ? _jsx("span", { className: "lg-clamp-1", style: { fontSize: 12, color: C.muted }, children: subtitle }) : null] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }, children: [_jsx("span", { className: "lg-mono", style: { fontSize: 16, fontWeight: 500, color: C.ink }, children: money(spent, store.baseCode) }), project.budgetMinor > 0 ? (_jsx("span", { className: "lg-mono", style: { fontSize: 12, color: C.muted }, children: t('prj.of', moneyCompact(project.budgetMinor, store.baseCode)) })) : null] })] }));
}
