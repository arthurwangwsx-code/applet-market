// `viddl_jobs list` 的文本解析。**这是领域逻辑，不是桥胶水**，所以它留在应用里、
// 没有随 host.js 一起进 SDK：宿主没给这条工具定结构化卡片负载，而推动宿主改协议不是一个小应用的事。
//
// 解析纪律：**认不出的行整条丢掉，绝不猜**。`[job: …]` 是唯一强锚点——没有它就不是一条任务行，
// 猜一行的代价是用户看到一条根本不存在的下载。进度/速度这些「猜错了只是难看」的字段真值另有来源
// （`aibox.download.list()` 的结构化队列），不靠这里。
export function parseJobLines(text) {
    if (!text || typeof text !== 'string')
        return [];
    const out = [];
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        const anchor = line.match(/\[job:\s*([^\]]+)\]\s*$/);
        if (!anchor)
            continue;
        const body = line.slice(0, anchor.index).replace(/^[•\-\s]+/, '').trim();
        const dash = body.indexOf(' — ');
        const title = (dash >= 0 ? body.slice(0, dash) : body).trim();
        const tail = dash >= 0 ? body.slice(dash + 3) : '';
        const segments = tail.split('·').map((s) => s.trim());
        const stateSegment = segments[0] || '';
        const state = (stateSegment.split(/[\s→]/)[0] || '').trim();
        const percent = tail.match(/(\d{1,3})%/);
        const output = tail.match(/→\s*([^·]+)/);
        const source = tail.match(/source:\s*([^·]+)/);
        out.push({
            jobId: anchor[1].trim(),
            state: state || 'unknown',
            fraction: percent ? Number(percent[1]) / 100 : undefined,
            title: title || anchor[1].trim(),
            outputName: output ? output[1].trim() : undefined,
            source: source ? source[1].trim() : undefined,
        });
    }
    return out;
}
