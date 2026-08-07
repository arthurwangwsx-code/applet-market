/**
 * `manifest.json` 的 TypeScript 形状。
 *
 * manifest 是**声明**而不是代码，发布时仍然从 `src/manifest.json` 原样取（`release.mjs`）。
 * 这里给的类型有两个用途：
 *  ① 想用 TS 写 manifest 的应用可以 `defineManifest({...})` 然后由构建脚本 emit 成 JSON；
 *  ② `@aibox/applet-tsbuild` 的 manifest 检查与 action 类型生成共用同一份形状。
 *
 * 字段是宿主 `AppletManifest` 的**市场包子集**——本机身份（id/createdAt/updatedAt）与市场归属
 * （marketSourceID/marketAppID/marketVersion）由宿主安装时写，包里写了也会被丢弃，故这里不给。
 */
/**
 * 恒等函数，只为拿类型检查与字面量推断。
 * `export default defineManifest({...} as const)` 之后 action 名就是字面量类型。
 */
export function defineManifest(manifest) {
    return manifest;
}
