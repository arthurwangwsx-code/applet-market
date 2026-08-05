// AI 工具面（续）：账户 / 分类 / 币种 / 项目+AA 四个工具。
// 与 actions.js 同一套纪律：无 UI 也能跑、走同一条 WAL 写路径、金额第一步转整数分。
import { money, majorNumberToMinor } from './money.js';
import { normalizeCurrencyCode } from './currencies.js';
import { monthTitle } from './dates.js';
import { buckets, filterTransactions } from './queries.js';
import { balancesByAccount, netWorth, setBalance } from './balances.js';
import { activateProject, addCurrency, addMember, applyFetchedRates, archiveAccount, createAccount, createCategory, createProject, removeMember, setBaseCurrency, setRate, updateAccount, updateCategory, updateProject, } from './entities.js';
import { isNoneToken, resolveAccount, resolveCategory, resolveMember, resolveProject } from './resolve.js';
import { memberBalances, projectIncomeMinor, projectSpentMinor, recordSettlement, settlementPlan } from './split.js';
import { fetchRates } from './fx.js';
import { httpGetJSON } from './host.js';
import { PERSISTENCE_FAILURE, actionCandidatesText, actionDone, actionFail, parseFlexibleDate } from './actions.js';
const fail = actionFail;
const done = actionDone;
const candidatesText = actionCandidatesText;
export async function actionAccount(store, args, locale) {
    const action = String(args.action ?? 'list').toLowerCase();
    if (action === 'create') {
        const result = await createAccount(store, {
            name: args.name,
            kind: args.kind ?? 'cash',
            currency: normalizeCurrencyCode(args.currency ?? store.baseCode),
            initialBalanceMinor: majorNumberToMinor(args.initial_balance ?? 0),
            creditLimitMinor: majorNumberToMinor(args.credit_limit ?? 0),
            includeInNetWorth: args.include_in_net_worth !== false,
        });
        if (!result.ok)
            return fail(result.reason === 'emptyName' ? 'create needs a name.' : PERSISTENCE_FAILURE);
        return done(`Created account "${result.account.name}" (${result.account.kind}, ${result.account.currency}).`, { id: result.account.id });
    }
    const target = args.account || args.name;
    if (['set_balance', 'archive', 'update'].includes(action)) {
        const resolved = resolveAccount(store, target, args.currency);
        if (!resolved.found)
            return fail(candidatesText('account', resolved.candidates));
        const account = resolved.value;
        if (action === 'set_balance') {
            if (args.balance === undefined || args.balance === null)
                return fail('set_balance needs balance.');
            const result = await setBalance(store, account, majorNumberToMinor(args.balance));
            if (!result.ok)
                return fail(PERSISTENCE_FAILURE);
            if (result.noop)
                return done(`"${account.name}" already matches that balance — nothing to adjust.`);
            return done(`Adjusted "${account.name}" by ${money(result.delta, account.currency, { signed: true })}.`, { deltaMinor: result.delta });
        }
        if (action === 'archive') {
            const result = await archiveAccount(store, account.id, args.archived !== false);
            if (!result.ok)
                return fail(PERSISTENCE_FAILURE);
            return done(`${args.archived === false ? 'Restored' : 'Archived'} account "${account.name}".`);
        }
        const result = await updateAccount(store, account.id, {
            name: args.new_name ?? args.name,
            kind: args.kind,
            includeInNetWorth: args.include_in_net_worth,
            creditLimitMinor: args.credit_limit !== undefined ? majorNumberToMinor(args.credit_limit) : undefined,
        });
        if (!result.ok)
            return fail(PERSISTENCE_FAILURE);
        return done(`Updated account "${account.name}".`);
    }
    const balances = balancesByAccount(store);
    const worth = netWorth(store, balances);
    const lines = store.activeAccounts().map((account) => {
        const own = money(balances[account.id] ?? 0, account.currency);
        const base = account.currency === store.baseCode
            ? ''
            : ` ≈ ${money(store.toBaseMinor(balances[account.id] ?? 0, account.currency), store.baseCode)}`;
        return `${account.name} (${account.kind}, ${account.currency}): ${own}${base} [id: ${account.id}]`;
    });
    return done(`Net worth ${money(worth.net, store.baseCode)} · assets ${money(worth.assets, store.baseCode)} · `
        + `liabilities ${money(worth.liabilities, store.baseCode)}\n${lines.join('\n')}`, { netWorthMinor: worth.net, assetsMinor: worth.assets, liabilitiesMinor: worth.liabilities, baseCurrency: store.baseCode });
}
export async function actionCategory(store, args, locale) {
    const action = String(args.action ?? 'list').toLowerCase();
    const kind = args.kind === 'income' ? 'income' : 'expense';
    if (action === 'create') {
        let parentID = null;
        if (args.parent) {
            const resolved = resolveCategory(store, args.parent, kind);
            if (!resolved.found)
                return fail(candidatesText('parent category', resolved.candidates));
            parentID = resolved.value.id;
        }
        const result = await createCategory(store, { name: args.name, kind, parentID });
        if (!result.ok)
            return fail(result.reason === 'emptyName' ? 'create needs a name.' : PERSISTENCE_FAILURE);
        return done(`Created category "${store.categoryPath(result.category.id)}".`, { id: result.category.id });
    }
    if (action === 'rename' || action === 'archive') {
        const resolved = resolveCategory(store, args.name, kind);
        if (!resolved.found)
            return fail(candidatesText('category', resolved.candidates));
        const patch = action === 'rename' ? { name: args.new_name } : { isArchived: args.archived !== false };
        if (action === 'rename' && !String(args.new_name ?? '').trim())
            return fail('rename needs new_name.');
        const result = await updateCategory(store, resolved.value.id, patch);
        if (!result.ok)
            return fail(PERSISTENCE_FAILURE);
        return done(action === 'rename'
            ? `Renamed to "${String(args.new_name).trim()}".`
            : `${args.archived === false ? 'Restored' : 'Archived'} "${resolved.value.name}".`);
    }
    const roots = store.rootCategories(kind);
    const lines = roots.map((root) => {
        const children = store.childCategories(root.id);
        return children.length > 0 ? `${root.name}: ${children.map((row) => row.name).join(', ')}` : root.name;
    });
    return done(`${kind} categories:\n${lines.join('\n')}`, { categories: lines });
}
export async function actionCurrency(store, args, locale) {
    const action = String(args.action ?? 'list').toLowerCase();
    const code = args.code ? normalizeCurrencyCode(args.code) : null;
    if (action === 'add') {
        if (!code || code.length !== 3)
            return fail('add needs a 3-letter ISO currency code.');
        const result = await addCurrency(store, code, args.rate);
        if (!result.ok)
            return fail(PERSISTENCE_FAILURE);
        const configured = Number(args.rate) > 0;
        return done(configured
            ? `Added ${code} at 1 ${code} = ${Number(args.rate)} ${store.baseCode}.`
            : `Added ${code} without a rate — it is EXCLUDED from converted totals until a real rate is configured.`);
    }
    if (action === 'set_rate') {
        if (!code)
            return fail('set_rate needs code.');
        const result = await setRate(store, code, args.rate);
        if (!result.ok)
            return fail(result.reason === 'invalidRate' ? 'rate must be greater than 0.' : PERSISTENCE_FAILURE);
        return done(`1 ${code} = ${Number(args.rate)} ${store.baseCode} (marked manual; online refresh will not overwrite it).`);
    }
    if (action === 'set_preferred') {
        if (!code)
            return fail('set_preferred needs code.');
        const result = await setBaseCurrency(store, code);
        if (!result.ok) {
            return fail(result.reason === 'rateNeeded'
                ? `${code} has no configured rate yet — set one before making it the base currency.`
                : PERSISTENCE_FAILURE);
        }
        return done(`Base currency is now ${code}. All stats, net worth and budgets are priced in it.`);
    }
    if (action === 'refresh') {
        const rates = await fetchRates(store.baseCode, httpGetJSON);
        if (!rates)
            return fail('Could not fetch live rates just now. Set them manually with set_rate.');
        const result = await applyFetchedRates(store, rates);
        if (!result.ok)
            return fail(PERSISTENCE_FAILURE);
        return done(result.changed ? 'Exchange rates refreshed.' : 'Rates were already up to date.');
    }
    const lines = store.currencies.map((row) => (row.isBase
        ? `${row.code} (base)`
        : `1 ${row.code} = ${row.rateConfigured ? Number(row.rateToBase).toFixed(4) : 'no rate'} ${store.baseCode}`
            + `${row.manualRate ? ' (manual)' : ''}`));
    return done(`Base currency ${store.baseCode}.\n${lines.join('\n')}`, { baseCurrency: store.baseCode });
}
export async function actionProject(store, args, locale) {
    const action = String(args.action ?? 'list').toLowerCase();
    if (action === 'create') {
        const result = await createProject(store, {
            name: args.name,
            budgetMinor: majorNumberToMinor(args.budget ?? 0),
            startOn: args.start ? parseFlexibleDate(args.start) : null,
            endOn: args.end ? parseFlexibleDate(args.end) : null,
            isActive: !!args.activate,
        });
        if (!result.ok)
            return fail(result.reason === 'emptyName' ? 'create needs a name.' : PERSISTENCE_FAILURE);
        return done(`Created project "${result.project.name}".`, { id: result.project.id });
    }
    if (action === 'activate') {
        if (isNoneToken(args.name)) {
            const result = await activateProject(store, null);
            return result.ok ? done('Cleared the current project.') : fail(PERSISTENCE_FAILURE);
        }
        const resolved = resolveProject(store, args.name);
        if (!resolved.found)
            return fail(candidatesText('project', resolved.candidates));
        const result = await activateProject(store, resolved.value.id);
        return result.ok ? done(`"${resolved.value.name}" is now the current project.`) : fail(PERSISTENCE_FAILURE);
    }
    if (action === 'list') {
        const rows = store.projects.map((project) => {
            const spent = projectSpentMinor(store, project.id);
            return `${project.name}${project.isActive ? ' (current)' : ''}${project.isArchived ? ' (archived)' : ''}: `
                + `${money(spent, store.baseCode)}`
                + `${project.budgetMinor > 0 ? ` / ${money(project.budgetMinor, store.baseCode)}` : ''} [id: ${project.id}]`;
        });
        return done(rows.length > 0 ? rows.join('\n') : 'No projects yet.', { count: store.projects.length });
    }
    const resolved = resolveProject(store, args.name);
    if (!resolved.found)
        return fail(candidatesText('project', resolved.candidates));
    const project = resolved.value;
    switch (action) {
        case 'update': {
            const result = await updateProject(store, project.id, {
                name: args.new_name,
                budgetMinor: args.budget !== undefined ? majorNumberToMinor(args.budget) : undefined,
                startOn: args.start ? parseFlexibleDate(args.start) : undefined,
                endOn: args.end ? parseFlexibleDate(args.end) : undefined,
            });
            return result.ok ? done(`Updated project "${project.name}".`) : fail(PERSISTENCE_FAILURE);
        }
        case 'archive': {
            const result = await updateProject(store, project.id, { isArchived: args.archived !== false });
            return result.ok ? done(`${args.archived === false ? 'Restored' : 'Archived'} "${project.name}".`) : fail(PERSISTENCE_FAILURE);
        }
        case 'members': {
            const rows = store.projectMembers(project.id).map((row) => `${row.name}${row.isMe ? ' (me)' : ''} [id: ${row.id}]`);
            return done(rows.length > 0 ? rows.join('\n') : 'No members yet.', { count: rows.length });
        }
        case 'add_member': {
            const name = String(args.member ?? '').trim();
            if (name.length === 0)
                return fail('add_member needs member.');
            // 项目还没成员且这次不是加「我」→ 先自动补一个名为 "Me" 的自己。
            if (store.projectMembers(project.id).length === 0 && !args.is_me) {
                const seeded = await addMember(store, project.id, { name: 'Me', isMe: true });
                if (!seeded.ok)
                    return fail(PERSISTENCE_FAILURE);
            }
            const result = await addMember(store, project.id, { name, isMe: !!args.is_me });
            return result.ok ? done(`Added member "${name}".`, { id: result.member.id }) : fail(PERSISTENCE_FAILURE);
        }
        case 'remove_member': {
            const resolvedMember = resolveMember(store, project.id, args.member);
            if (!resolvedMember.found)
                return fail(candidatesText('member', resolvedMember.candidates));
            const result = await removeMember(store, resolvedMember.value.id);
            return result.ok ? done(`Removed member "${resolvedMember.value.name}".`) : fail(PERSISTENCE_FAILURE);
        }
        case 'settle': {
            const net = memberBalances(store, project.id);
            const plan = settlementPlan(store, project.id);
            const balanceLines = store.projectMembers(project.id)
                .map((row) => `${row.name}: ${money(net[row.id] ?? 0, store.baseCode, { signed: true })}`);
            const planLines = plan.map((row) => {
                const from = store.member(row.fromMemberID);
                const to = store.member(row.toMemberID);
                return `${from ? from.name : '?'} → ${to ? to.name : '?'} ${money(row.amountMinor, store.baseCode)}`;
            });
            return done(`${balanceLines.join('\n')}\n${planLines.length > 0 ? `Settle up:\n${planLines.join('\n')}` : "Everyone's settled up."}`, { balances: net, plan });
        }
        case 'record_settlement': {
            const from = resolveMember(store, project.id, args.from);
            const to = resolveMember(store, project.id, args.to);
            if (!from.found)
                return fail(candidatesText('member', from.candidates));
            if (!to.found)
                return fail(candidatesText('member', to.candidates));
            const result = await recordSettlement(store, project.id, from.value.id, to.value.id, majorNumberToMinor(args.amount ?? 0));
            if (!result.ok)
                return fail(result.reason === 'invalidAmount' ? 'amount must be greater than 0.' : PERSISTENCE_FAILURE);
            return done(`Recorded ${from.value.name} → ${to.value.name} ${money(result.settlement.amountBaseMinor, store.baseCode)}.`, { id: result.settlement.id, linkedTransactionID: result.settlement.linkedTransactionID });
        }
        default: {
            const spent = projectSpentMinor(store, project.id);
            const income = projectIncomeMinor(store, project.id);
            const rows = filterTransactions(store, { projectID: project.id });
            const list = buckets(store, rows, 'byCategory', 'expense', locale);
            const lines = list.slice(0, 10).map((bucket) => `${bucket.label}: ${money(bucket.amountMinor, store.baseCode)}`);
            return done(`"${project.name}" — spent ${money(spent, store.baseCode)}`
                + `${income > 0 ? `, income ${money(income, store.baseCode)}` : ''}`
                + `${project.budgetMinor > 0 ? `, budget ${money(project.budgetMinor, store.baseCode)}` : ''}`
                + `, ${rows.length} entries.\n${lines.join('\n')}`, { spentMinor: spent, incomeMinor: income, budgetMinor: project.budgetMinor, buckets: list });
        }
    }
}
