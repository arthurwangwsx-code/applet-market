import { bridge, available } from './bridge';

/**
 * AI 与宿主工具网关的薄封装。
 *
 * ## 为什么要封一层（裸 `aibox.ai.*` 已经不错了）
 * 分叉里 3 个应用各写了一遍 `aiAvailability` + `aiGenerate`，形态一致但**兜底纪律不一致**：
 * 有的在不可用时抛错、有的回空串、有的回 null。AI 调用**每一次都可能失败**
 * （不可用 / 被拒 / 超配额 / 超时），所以「拿不到就走确定性兜底」不是可选项。
 * 这里统一成：**永不抛错，拿不到就返回 null**，让调用方一个 `?? fallback` 收口。
 *
 * 需要区分失败原因（是没配模型，还是超了配额）时用 `aiAvailability()` / 捕获原始错误码，
 * 那属于设置页的诉求，不该让每个功能路径都去处理。
 */

/** 模型现在能不能用（不弹框、不计费）。 */
export async function aiAvailability(): Promise<{ available: boolean; reason?: string }> {
  const host = bridge();
  if (!host?.ai?.availability) return { available: false, reason: 'aibox/ai-unavailable' };
  try {
    const value = await host.ai.availability();
    return { available: value.available, reason: value.reason };
  } catch {
    return { available: false, reason: 'aibox/ai-unavailable' };
  }
}

/** 生成一段文本。**失败返回 null**（不抛），调用方用规则兜底。 */
export async function aiGenerate(
  input: string | { system?: string; prompt?: string; intent?: 'fast' | 'balanced' | 'reasoning'; maxTokens?: number; timeoutMs?: number },
): Promise<string | null> {
  const host = bridge();
  if (!host?.ai?.generate) return null;
  try {
    const value = await host.ai.generate(typeof input === 'string' ? { prompt: input } : input);
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/** 让模型产出一个**符合 schema 的对象**。失败返回 null。 */
export async function aiDecide<T = Record<string, unknown>>(input: {
  system?: string;
  prompt: string;
  schema: Record<string, unknown>;
  intent?: 'fast' | 'balanced' | 'reasoning';
  timeoutMs?: number;
}): Promise<T | null> {
  const host = bridge();
  if (!host?.ai?.decide) return null;
  try {
    return await host.ai.decide<T>(input as Parameters<typeof aibox.ai.decide>[0]);
  } catch {
    return null;
  }
}

/** 把当前页上下文交给主会话并打开聊天（`suggestedPrompt` 是给用户的起手句，不是命令）。 */
export async function openChat(suggestedPrompt?: string): Promise<boolean> {
  const host = bridge();
  if (!host?.chat?.shareContext) return false;
  try {
    return await host.chat.shareContext(suggestedPrompt ? { suggestedPrompt } : undefined);
  } catch {
    return false;
  }
}

/** 按关键词找一个宿主工具。找不到 / 网关不在场返回 null。 */
export async function findTool(query: string): Promise<string | null> {
  const host = bridge();
  if (!host?.tools?.search) return null;
  try {
    const results = await host.tools.search({ query, limit: 1 });
    return results[0]?.name ?? null;
  } catch {
    return null;
  }
}

/** 这个工具当前调得动吗（存在 + 已授权）。 */
export async function toolAllowed(name: string): Promise<boolean> {
  const host = bridge();
  if (!host?.access?.explain) return false;
  try {
    const decision = await host.access.explain({ tool: name });
    return Boolean(decision.allowed);
  } catch {
    return false;
  }
}

/**
 * 调一个宿主工具。返回**统一信封**——`ok` 为假时 `text` 就是给用户看的原因。
 * 不抛错：工具调用失败是常规分支，不是异常。
 */
export async function callTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ ok: boolean; text: string; details?: unknown }> {
  const host = bridge();
  if (!host?.tools?.call) return { ok: false, text: 'aibox/unavailable: tool gateway is not registered' };
  try {
    const result = await host.tools.call({ name, arguments: args });
    return { ok: result.ok && !result.isError, text: result.text ?? '', details: result.details };
  } catch (error) {
    return { ok: false, text: String((error as { message?: string })?.message ?? error) };
  }
}

/** 同步探测（渲染入口前用）。 */
export const intelligenceAvailable = {
  ai: () => available('ai', 'generate'),
  tools: () => available('tools', 'call'),
  chat: () => available('chat'),
};
