// 应用级数据仓：合并「宿主录音库 + 本机剪辑」，加设置与刷新。

import { useCallback, useEffect, useMemo, useState } from 'react'
import { capabilities, clipToMemo, listClips, listLibrary, loadSetting, saveSetting } from './memos'
import { DEFAULT_SETTINGS, type LocalClip, type Memo, type Settings } from './types'

export interface MemoStore {
  ready: boolean
  memos: Memo[]
  clips: LocalClip[]
  settings: Settings
  libraryAvailable: boolean
  /** 宿主录音库调不通时的原因（用于把空态和「没装模块」区分开）。 */
  libraryError: string | null
  updateSettings: (patch: Partial<Settings>) => void
  refresh: () => void
}

const SETTINGS_KEY = 'settings'

export function useMemoStore(): MemoStore {
  const [ready, setReady] = useState(false)
  const [library, setLibrary] = useState<Memo[]>([])
  const [clips, setClips] = useState<LocalClip[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [nextLibrary, nextClips, stored] = await Promise.all([
        capabilities.library ? listLibrary() : Promise.resolve<Memo[]>([]),
        listClips(),
        loadSetting<Partial<Settings>>(SETTINGS_KEY, {}),
      ])
      if (cancelled) return
      setLibrary(nextLibrary)
      setClips(nextClips)
      setSettings({ ...DEFAULT_SETTINGS, ...stored })
      setLibraryError(capabilities.library ? null : 'aibox/voicememos-unavailable')
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [tick])

  const memos = useMemo(() => {
    const merged = [...library, ...clips.filter((clip) => !clip.isTrashed).map(clipToMemo)]
    return merged.sort((a, b) => b.createdAt - a.createdAt)
  }, [library, clips])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      void saveSetting(SETTINGS_KEY, next as unknown as Record<string, unknown>)
      return next
    })
  }, [])

  return {
    ready,
    memos,
    clips,
    settings,
    libraryAvailable: capabilities.library,
    libraryError,
    updateSettings,
    refresh,
  }
}
