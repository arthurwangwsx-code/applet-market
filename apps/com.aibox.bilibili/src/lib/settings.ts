// 播放偏好。
//
// ## 为什么要有这一层，而不是每次调 `stage()` 时写死参数
//
// 宿主的 `aibox.video.stage()` 收 `backgroundAudio` / `pictureInPicture` / `gestureControls`，
// 但那是**每次调用的参数**——不是用户偏好。写死在调用点意味着用户永远只能接受一种行为。
//
// 这些开关的差别对用户是真实存在的：
//  · 「只想听」的人要后台音频、不要画中画（浮窗挡着别的 App）；
//  · 「边做别的边看」的人正好相反；
//  · 手势调音量对有些人是惊喜，对另一些人是误触。
//
// 合成一个「省电模式」之类的总开关必然让一半人被迫接受另一半的行为，所以逐项存。

import { loadPref, savePref } from './host.js'
import type { PlaybackSettings } from './types.js'
import { isRecord } from './types.js'

const KEY = 'playback-settings'

/** 默认值。**后台音频默认开**——「退出去还能继续听」是这类应用最常见的用法。 */
export const DEFAULTS: PlaybackSettings = {
  backgroundAudio: true,
  pictureInPicture: true,
  gestureControls: true,
}

/** 读偏好。缺字段用默认值补齐（老版本存过的记录不会因为新增开关而缺项）。 */
export async function loadSettings(): Promise<PlaybackSettings> {
  const saved = await loadPref<unknown>(KEY, null)
  if (!isRecord(saved)) return { ...DEFAULTS }
  return {
    backgroundAudio: typeof saved.backgroundAudio === 'boolean' ? saved.backgroundAudio : DEFAULTS.backgroundAudio,
    pictureInPicture: typeof saved.pictureInPicture === 'boolean' ? saved.pictureInPicture : DEFAULTS.pictureInPicture,
    gestureControls: typeof saved.gestureControls === 'boolean' ? saved.gestureControls : DEFAULTS.gestureControls,
  }
}

/** 写一项。回合并后的完整设置，供调用方直接 setState。 */
export async function updateSetting(key: keyof PlaybackSettings, value: boolean): Promise<PlaybackSettings> {
  const current = await loadSettings()
  const next = { ...current, [key]: !!value }
  await savePref(KEY, next)
  return next
}
