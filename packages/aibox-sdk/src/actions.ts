import { bridge } from './bridge'
import type { JSONValue } from './json'
import { AiboxError, normalizeError } from './errors'

/**
 * 类型化的 action 注册。
 *
 * ## 问题
 * `manifest.json` 里声明了 action 的 `inputSchemaJSON` / `outputSchemaJSON`，运行时用
 * `aibox.action.register(name, handler)` 注册同名 handler。两边**没有任何机械联系**——
 * 名字拼错、参数字段改了没同步、返回结构对不上 outputSchema，全都要等真机跑到那一步才发现。
 * 这是 applet 交付里最常见的一类静默失败。
 *
 * ## 做法
 * 构建期（`@aibox/applet-tsbuild` 的 `renderActionTypes`）从 `src/manifest.json` 的
 * `actions[].inputSchemaJSON` / `outputSchemaJSON` 生成 `src/aibox-actions.d.ts`，
 * 用 **模块增补** 往 `AppletActionMap` 里填字面量键与参数/返回类型：
 *
 * ```ts
 * declare module '@aibox/applet-sdk' {
 *   interface AppletActionMap {
 *     'search': { input: { query?: string; limit?: number }; output: { ok: boolean } }
 *   }
 * }
 * ```
 *
 * 于是：
 *  · 名字拼错     → `Argument of type '"serach"' is not assignable to parameter of type '"search"'`
 *  · 参数类型不符 → handler 形参报错
 *  · 返回结构不符 → 返回值报错
 * 全部是**编译期**错误。这就是「可校验」。
 *
 * 没跑生成器的应用（或纯手写场景）`AppletActionMap` 为空，此时降级成 `string` 键 +
 * `JSONValue`——不会因为少一个生成步骤就编译不过。
 */

/**
 * 应用的 action 契约表。**由生成的 `src/aibox-actions.d.ts` 用模块增补填充**，
 * 本体故意留空（空接口是模块增补的标准锚点）。
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AppletActionMap {}

type MapIsEmpty = [keyof AppletActionMap] extends [never] ? true : false

/** 可注册的 action 名。有生成表时是字面量联合，没有时退化成 `string`。 */
export type ActionName = MapIsEmpty extends true ? string : keyof AppletActionMap

type Entry<K> = K extends keyof AppletActionMap ? AppletActionMap[K] : { input: JSONValue; output: JSONValue }

/** 某个 action 的入参类型。 */
export type ActionInput<K extends ActionName> = Entry<K> extends { input: infer I } ? I : JSONValue

/** 某个 action 的返回类型。 */
export type ActionOutput<K extends ActionName> = Entry<K> extends { output: infer O } ? O : JSONValue

/** 一个 action 的处理函数。 */
export type ActionHandler<K extends ActionName> = (input: ActionInput<K>) => ActionOutput<K> | Promise<ActionOutput<K>>

function requireAction(): NonNullable<ReturnType<typeof bridge>>['action'] {
  const host = bridge()
  if (!host?.action || typeof host.action.register !== 'function') {
    throw new AiboxError(
      'aibox/unavailable',
      'aibox/unavailable: aibox.action.register is not available. Actions only work inside the applet container.',
    )
  }
  return host.action
}

/**
 * 注册一个 action handler。名字与入参/返回类型都受 `AppletActionMap` 约束。
 *
 * 容器外（单测、被当普通网页打开）调用是**静默 no-op**：一个只在容器里有意义的注册
 * 不该让页面在 Node 里崩掉。真正的桥缺失会在 `registerActions` 的 strict 模式里显式抛。
 */
export function registerAction<K extends ActionName>(name: K, handler: ActionHandler<K>): void {
  const host = bridge()
  if (!host?.action || typeof host.action.register !== 'function') return
  // handler 的入参是 manifest schema 推出来的具体类型，桥那侧只知道 JSONValue——
  // 这个方向的收窄由 schema 保证（宿主按 inputSchemaJSON 校验后才派发），不是这里能表达的。
  host.action.register(name as string, handler as unknown as (input: JSONValue) => JSONValue | Promise<JSONValue>)
}

/** 一次注册整张表。键必须覆盖 `AppletActionMap` 声明的**全部** action——漏一个就是编译错。 */
export type ActionHandlers = MapIsEmpty extends true
  ? Record<string, (input: JSONValue) => JSONValue | Promise<JSONValue>>
  : { [K in keyof AppletActionMap]: ActionHandler<K & ActionName> }

/**
 * 一次注册全部 action。
 *
 * 「漏注册」是 manifest 声明了 action 却没人处理——宿主会把它列进工具清单，AI 调过来直接失败。
 * 用整表注册就把「漏一个」变成编译错（`Property 'x' is missing in type ...`）。
 */
export function registerActions(handlers: ActionHandlers): void {
  const host = bridge()
  if (!host?.action || typeof host.action.register !== 'function') return
  for (const [name, handler] of Object.entries(handlers as Record<string, unknown>)) {
    if (typeof handler !== 'function') continue
    host.action.register(name, handler as (input: JSONValue) => JSONValue | Promise<JSONValue>)
  }
}

/** 把结构化结果回给当前调用方（AI / 自动化）。 */
export async function actionResult(data: JSONValue): Promise<boolean> {
  try {
    return await requireAction().result(data)
  } catch (error) {
    throw normalizeError(error)
  }
}
