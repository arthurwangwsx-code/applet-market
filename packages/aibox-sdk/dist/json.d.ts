/** 桥可以传输的值（= 宿主 `aibox.JSONValue`，这里导出成普通类型供应用代码使用）。 */
export type JSONValue = null | boolean | number | string | JSONValue[] | {
    [key: string]: JSONValue;
};
/** JSON 对象。 */
export type JSONObject = {
    [key: string]: JSONValue;
};
//# sourceMappingURL=json.d.ts.map