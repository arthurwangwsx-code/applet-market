/** Bilibili 小应用的稳定领域模型；接口原始字段只允许停留在 api.ts。 */
export function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
export function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
