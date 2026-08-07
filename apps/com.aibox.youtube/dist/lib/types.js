/** YouTube 小应用自己的领域模型；不把不稳定的 InnerTube 原始响应泄漏到 UI。 */
export function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
export function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
