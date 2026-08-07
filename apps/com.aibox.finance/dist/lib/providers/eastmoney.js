// 东财 datacenter（财务 / 分红 / 龙虎榜 / 公告 / 业绩预告）—— 规格 §8.4。
// 这一族**全球可达**（与 §8.5 的 push2 不同），所以海外网络下行业页空、基本面仍能出。
//
// 统一信封：`result.data` 是行数组。Header 需要 Referer + 桌面 UA。
import { getJSON, num, str } from '../http.js';
import { secuCode } from '../symbol.js';
const EMWEB = { Referer: 'https://emweb.securities.eastmoney.com/' };
const DATA = { Referer: 'https://data.eastmoney.com/' };
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
async function rows(url, headers) {
    const result = await getJSON(url, { headers });
    if (!result.ok)
        return [];
    const data = result.body && result.body.result && result.body.result.data;
    return Array.isArray(data) ? data.filter(isRecord) : [];
}
/** A 股财务主要指标（近 8 期）。港/美用另外两张报表，见下。 */
export async function fetchFinancials(symbol) {
    if (symbol.market === 'ashare') {
        const code = secuCode(symbol);
        if (!code)
            return [];
        const url = 'https://datacenter.eastmoney.com/securities/api/data/v1/get' +
            '?reportName=RPT_F10_FINANCE_MAINFINADATA' +
            '&columns=SECURITY_NAME_ABBR,REPORT_DATE_NAME,EPSJB,BPS,MGJYXJJE,TOTALOPERATEREVE,PARENTNETPROFIT,ROEJQ,XSMLL,TOTALOPERATEREVETZ,PARENTNETPROFITTZ' +
            `&filter=(SECUCODE=%22${code}%22)&pageSize=8&sortColumns=REPORT_DATE&sortTypes=-1`;
        return (await rows(url, EMWEB)).map((row) => ({
            periodName: str(row.REPORT_DATE_NAME),
            eps: num(row.EPSJB),
            bps: num(row.BPS),
            cashPerShare: num(row.MGJYXJJE),
            revenue: num(row.TOTALOPERATEREVE),
            netProfit: num(row.PARENTNETPROFIT),
            roe: num(row.ROEJQ),
            grossMargin: num(row.XSMLL),
            revenueYoY: num(row.TOTALOPERATEREVETZ),
            netProfitYoY: num(row.PARENTNETPROFITTZ),
            currency: 'CNY',
        }));
    }
    if (symbol.market === 'hk') {
        const url = 'https://datacenter.eastmoney.com/securities/api/data/v1/get' +
            '?reportName=RPT_HKF10_FN_MAININDICATOR' +
            '&columns=REPORT_TYPE,CURRENCY,BASIC_EPS,BPS,PER_NETCASH_OPERATE,OPERATE_INCOME,OPERATE_INCOME_YOY,HOLDER_PROFIT,HOLDER_PROFIT_YOY,GROSS_PROFIT_RATIO,ROE_AVG' +
            `&filter=(SECURITY_CODE="${symbol.code}")&pageSize=8&sortColumns=STD_REPORT_DATE&sortTypes=-1`;
        return (await rows(url, EMWEB)).map((row) => ({
            periodName: str(row.REPORT_TYPE),
            eps: num(row.BASIC_EPS),
            bps: num(row.BPS),
            cashPerShare: num(row.PER_NETCASH_OPERATE),
            revenue: num(row.OPERATE_INCOME),
            netProfit: num(row.HOLDER_PROFIT),
            roe: num(row.ROE_AVG),
            grossMargin: num(row.GROSS_PROFIT_RATIO),
            revenueYoY: num(row.OPERATE_INCOME_YOY),
            netProfitYoY: num(row.HOLDER_PROFIT_YOY),
            currency: str(row.CURRENCY, 'HKD'),
        }));
    }
    if (symbol.market === 'us') {
        // 008 = 单季。银行/保险常无此报表 → 空结果，上层要给「不可用」而不是报错。
        const url = 'https://datacenter.eastmoney.com/securities/api/data/v1/get' +
            '?reportName=RPT_USF10_FN_GMAININDICATOR' +
            '&columns=REPORT_DATE,BASIC_EPS,OPERATE_INCOME,OPERATE_INCOME_YOY,PARENT_HOLDER_NETPROFIT,PARENT_HOLDER_NETPROFIT_YOY,GROSS_PROFIT_RATIO,ROE_AVG' +
            `&filter=(SECURITY_CODE="${symbol.code}")(DATE_TYPE_CODE="008")&pageSize=8&sortColumns=REPORT_DATE&sortTypes=-1`;
        return (await rows(url, EMWEB)).map((row) => ({
            periodName: str(row.REPORT_DATE).slice(0, 10),
            eps: num(row.BASIC_EPS),
            bps: 0,
            cashPerShare: 0,
            revenue: num(row.OPERATE_INCOME),
            netProfit: num(row.PARENT_HOLDER_NETPROFIT),
            roe: num(row.ROE_AVG),
            grossMargin: num(row.GROSS_PROFIT_RATIO),
            revenueYoY: num(row.OPERATE_INCOME_YOY),
            netProfitYoY: num(row.PARENT_HOLDER_NETPROFIT_YOY),
            currency: 'USD',
        }));
    }
    return [];
}
/** 分红送配（仅 A 股）。日期截前 10 字符；`IMPL_PLAN_PROFILE` 为空丢弃该行。 */
export async function fetchDividends(symbol) {
    if (symbol.market !== 'ashare')
        return [];
    const url = 'https://datacenter-web.eastmoney.com/api/data/v1/get' +
        '?reportName=RPT_SHAREBONUS_DET' +
        '&columns=SECURITY_NAME_ABBR,REPORT_DATE,PLAN_NOTICE_DATE,IMPL_PLAN_PROFILE' +
        `&filter=(SECURITY_CODE=%22${symbol.code}%22)&pageSize=8&sortColumns=REPORT_DATE&sortTypes=-1`;
    return (await rows(url, DATA))
        .map((row) => ({
        reportDate: str(row.REPORT_DATE).slice(0, 10),
        noticeDate: str(row.PLAN_NOTICE_DATE).slice(0, 10),
        plan: str(row.IMPL_PLAN_PROFILE),
    }))
        .filter((row) => row.plan);
}
/**
 * 龙虎榜。后处理三步：只保留首行日期（= 最新交易日）→ **按代码去重**（一股多因会重复）→ 取前 40。
 */
export async function fetchDragonBoard(limit = 40) {
    const url = 'https://datacenter-web.eastmoney.com/api/data/v1/get' +
        '?reportName=RPT_DAILYBILLBOARD_DETAILSNEW' +
        '&columns=TRADE_DATE,SECURITY_CODE,SECURITY_NAME_ABBR,CHANGE_RATE,BILLBOARD_NET_AMT,BILLBOARD_BUY_AMT,BILLBOARD_SELL_AMT,EXPLANATION' +
        '&pageSize=200&sortColumns=TRADE_DATE,BILLBOARD_NET_AMT&sortTypes=-1,-1';
    const data = await rows(url, DATA);
    if (data.length === 0)
        return [];
    const latest = str(data[0]?.TRADE_DATE).slice(0, 10);
    const seen = new Set();
    const out = [];
    for (const row of data) {
        if (str(row.TRADE_DATE).slice(0, 10) !== latest)
            continue;
        const code = str(row.SECURITY_CODE);
        if (!code || seen.has(code))
            continue;
        seen.add(code);
        out.push({
            tradeDate: latest,
            code,
            name: str(row.SECURITY_NAME_ABBR),
            changePct: num(row.CHANGE_RATE),
            netBuy: num(row.BILLBOARD_NET_AMT),
            buyAmt: num(row.BILLBOARD_BUY_AMT),
            sellAmt: num(row.BILLBOARD_SELL_AMT),
            reason: str(row.EXPLANATION),
        });
        if (out.length >= limit)
            break;
    }
    return out;
}
export async function fetchAnnouncements(symbol, limit = 20) {
    if (symbol.market !== 'ashare')
        return [];
    const url = 'https://np-anotice-stock.eastmoney.com/api/security/ann' +
        `?sr=-1&page_size=${Math.max(1, Math.min(50, limit))}&page_index=1&ann_type=A&client_source=web&stock_list=${symbol.code}`;
    const result = await getJSON(url, { headers: DATA });
    if (!result.ok)
        return [];
    const list = result.body && result.body.data && result.body.data.list;
    if (!Array.isArray(list))
        return [];
    return list
        .filter(isRecord)
        .map((row) => ({
        id: str(row.art_code),
        date: str(row.notice_date).slice(0, 10),
        title: str(row.title),
        kind: Array.isArray(row.columns) && row.columns[0] ? str(row.columns[0].column_name) : '',
    }))
        .filter((row) => row.title);
}
/** 业绩预告。摘要取 PREDICT_CONTENT，为空则退 CHANGE_REASON_EXPLAIN。 */
export async function fetchForecasts(limit = 20) {
    const url = 'https://datacenter-web.eastmoney.com/api/data/v1/get' +
        '?reportName=RPT_PUBLIC_OP_NEWPREDICT' +
        '&columns=SECURITY_CODE,SECURITY_NAME_ABBR,NOTICE_DATE,PREDICT_TYPE,ADD_AMP_LOWER,ADD_AMP_UPPER,PREDICT_CONTENT,CHANGE_REASON_EXPLAIN' +
        `&pageSize=${Math.max(1, Math.min(25, limit))}&sortColumns=NOTICE_DATE&sortTypes=-1&filter=(IS_LATEST=%221%22)`;
    return (await rows(url, DATA)).map((row) => ({
        code: str(row.SECURITY_CODE),
        name: str(row.SECURITY_NAME_ABBR),
        date: str(row.NOTICE_DATE).slice(0, 10),
        kind: str(row.PREDICT_TYPE),
        lower: num(row.ADD_AMP_LOWER),
        upper: num(row.ADD_AMP_UPPER),
        summary: str(row.PREDICT_CONTENT) || str(row.CHANGE_REASON_EXPLAIN),
    }));
}
