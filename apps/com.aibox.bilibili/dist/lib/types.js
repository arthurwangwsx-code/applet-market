/** Bilibili 小应用的稳定领域模型；接口原始字段只允许停留在 api.ts。 */
/** 把宿主发现面折叠成这款应用真正需要的能力：能播且能解析 B 站页面。 */
export function classifyVideoReadiness(snapshot, methods) {
    if (!snapshot)
        return { ok: false, reason: 'noBridge', resolve: false, dash: false };
    const available = snapshot.available === true && methods.play;
    const resolve = snapshot.resolve === true && methods.resolve;
    if (!available)
        return { ok: false, reason: 'noEngine', resolve, dash: snapshot.dash === true };
    if (!resolve)
        return { ok: false, reason: 'noResolver', resolve: false, dash: snapshot.dash === true };
    return { ok: true, reason: 'ok', resolve: true, dash: snapshot.dash === true };
}
/** 将桥的技术错误变成用户能执行的恢复动作，同时保留未知错误原文用于诊断。 */
export function playbackErrorMessage(error) {
    const raw = errorMessage(error);
    if (/aibox\/(not-granted|denied)/.test(raw)) {
        return '还没有允许视频能力。点右上角「⋯」→「应用详情」→「能力」，允许视频能力后重试。';
    }
    if (/aibox\/unavailable.*(extractor|解析)|no media extractor|没有视频解析能力/i.test(raw)) {
        return '当前 AiBox 构建没有媒体解析模块，无法解析 B 站视频。请更新并重新安装 AiBox 本体。';
    }
    if (raw.startsWith('aibox/resolve-failed:')) {
        return `B 站视频解析失败：${raw.slice('aibox/resolve-failed:'.length).trim()}`;
    }
    return raw;
}
export function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
export function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
