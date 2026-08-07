// 语音备忘录的文件夹、回收站与设置页面。由根视图拆出，保持根路由只负责状态编排。

import { Toggle } from './MemoList.js'
import { Icon, PushPage } from './primitives.js'
import { byteSize, clockString } from '../lib/format.js'
import { deleteClip, saveClip } from '../lib/memos.js'
import { confirmDestructive } from '../lib/dialogs.js'
import { useMemoStore } from '../lib/store.js'
import type { T } from '../lib/strings.js'
import { SPACE, alpha, brandTint, type Palette } from '../lib/theme.js'
import type { Memo, Settings, SummaryTemplate } from '../lib/types.js'

// —— 文件夹 Tab（智能列表段可实现，用户文件夹段不行） ——

export function LibraryTab(props: {
  palette: Palette
  t: T
  memos: Memo[]
  trashCount: number
  onScope: (scope: 'all' | 'fav') => void
  onTrash: () => void
}) {
  const { palette, t } = props
  const rows: { id: 'all' | 'fav'; icon: string; label: string; badge: number }[] = [
    { id: 'all', icon: 'waveform', label: t('smartAllRecordings'), badge: props.memos.length },
    {
      id: 'fav',
      icon: 'star.fill',
      label: t('smartFavourites'),
      badge: props.memos.filter((memo) => memo.isFavourite).length,
    },
  ]
  return (
    <div style={{ padding: `${SPACE.s4}px 0` }}>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => props.onScope(row.id)}
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            gap: SPACE.s3,
            border: 'none',
            background: 'transparent',
            padding: `12px ${SPACE.s4}px`,
            cursor: 'pointer',
            borderBottom: `1px solid ${palette.line}`,
          }}
        >
          <Icon name={row.icon} size={16} color={palette.accent} />
          <span style={{ flex: 1, textAlign: 'left', fontSize: 16, color: palette.ink }}>{row.label}</span>
          <span style={{ fontSize: 14, color: palette.muted }}>{row.badge}</span>
          <Icon name="chevron" size={14} color={palette.muted} />
        </button>
      ))}

      <button
        type="button"
        onClick={props.onTrash}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          gap: SPACE.s3,
          border: 'none',
          background: 'transparent',
          padding: `12px ${SPACE.s4}px`,
          cursor: 'pointer',
          borderBottom: `1px solid ${palette.line}`,
          marginTop: SPACE.s4,
        }}
      >
        <Icon name="trash" size={16} color={palette.accent} />
        <span style={{ flex: 1, textAlign: 'left', fontSize: 16, color: palette.ink }}>{t('recentlyDeleted')}</span>
        <span style={{ fontSize: 14, color: palette.muted }}>{props.trashCount}</span>
        <Icon name="chevron" size={14} color={palette.muted} />
      </button>

      <div style={{ padding: `${SPACE.s4}px ${SPACE.s4}px`, fontSize: 12, color: palette.muted }}>
        {t('foldersUnavailable')}
      </div>
    </div>
  )
}

// —— 最近删除（只覆盖本机剪辑：宿主没有 `memo_trash` 工具投影） ——

export function TrashPage(props: {
  palette: Palette
  t: T
  store: ReturnType<typeof useMemoStore>
  onBack: () => void
  chrome?: boolean
}) {
  const { palette, t } = props
  const trashed = props.store.clips.filter((clip) => clip.isTrashed)
  return (
    <PushPage
      palette={palette}
      title={t('recentlyDeleted')}
      onBack={props.onBack}
      chrome={props.chrome}
      trailing={
        trashed.length ? (
          <button
            type="button"
            onClick={async () => {
              const ok = await confirmDestructive(t('emptyTrashConfirmTitle'), t('emptyTrash'), t('cancel'))
              if (!ok) return
              for (const clip of trashed) await deleteClip(clip.id)
              props.store.refresh()
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: palette.red,
              fontSize: 15,
              cursor: 'pointer',
              padding: 8,
            }}
          >
            {t('emptyTrash')}
          </button>
        ) : undefined
      }
    >
      {trashed.length === 0 ? (
        <div style={{ padding: `${SPACE.s8}px ${SPACE.s5}px`, textAlign: 'center' }}>
          <Icon name="trash" size={40} color={palette.muted} />
          <div style={{ fontSize: 17, fontWeight: 600, color: palette.ink, marginTop: SPACE.s3 }}>
            {t('trashEmptyTitle')}
          </div>
          <div style={{ fontSize: 14, color: palette.muted, marginTop: 6 }}>{t('trashEmptyBody')}</div>
        </div>
      ) : (
        <>
          {trashed.map((clip) => (
            <div
              key={clip.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.s3,
                padding: `10px ${SPACE.s4}px`,
                borderBottom: `1px solid ${palette.line}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 500, color: palette.ink }}>{clip.title}</div>
                <div style={{ fontSize: 12, color: palette.muted }}>{clockString(clip.durationMs / 1000)}</div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await saveClip({ ...clip, isTrashed: false, trashedAt: null })
                  props.store.refresh()
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: palette.accent,
                  fontSize: 18,
                  cursor: 'pointer',
                }}
                aria-label={t('restore')}
              >
                <Icon name="gobackward" size={18} />
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirmDestructive(t('deleteConfirmTitle'), t('deletePermanently'), t('cancel'))
                  if (!ok) return
                  await deleteClip(clip.id)
                  props.store.refresh()
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: palette.red,
                  fontSize: 16,
                  cursor: 'pointer',
                }}
                aria-label={t('deletePermanently')}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
          <div style={{ padding: SPACE.s4, fontSize: 12, color: palette.muted }}>{t('trashFooter')}</div>
        </>
      )}
    </PushPage>
  )
}

// —— 设置 Tab ——

export function SettingsTab(props: {
  palette: Palette
  t: T
  dark: boolean
  settings: Settings
  clips: ReturnType<typeof useMemoStore>['clips']
  onChange: (patch: Partial<Settings>) => void
}) {
  const { palette, t, settings } = props
  const bytes = props.clips.reduce((sum, clip) => sum + clip.byteCount, 0)
  const templates: SummaryTemplate[] = ['general', 'meeting', 'interview', 'oneOnOne', 'lecture', 'podcast']
  const templateLabels: Record<SummaryTemplate, string> = {
    general: t('templateGeneral'),
    meeting: t('templateMeeting'),
    interview: t('templateInterview'),
    oneOnOne: t('templateOneOnOne'),
    lecture: t('templateLecture'),
    podcast: t('templatePodcast'),
  }

  return (
    <div style={{ padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: alpha(brandTint(props.dark), 0.15),
            color: brandTint(props.dark),
            fontSize: 20,
          }}
        >
          <Icon name="mic" size={20} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: palette.ink }}>{t('titleVoiceMemos')}</div>
          <div style={{ fontSize: 12, color: palette.muted }}>
            {t('settingsAI')} · {t('settingsRecording')}
          </div>
        </div>
      </div>

      <section>
        <div
          style={{ fontSize: 12, fontWeight: 500, color: palette.muted, textTransform: 'uppercase', marginBottom: 6 }}
        >
          {t('settingsRecording')}
        </div>
        <Picker
          palette={palette}
          label={t('transcribeLanguage')}
          value={settings.transcribeLocale}
          options={[
            { value: 'auto', label: t('localeAuto') },
            { value: 'zh_CN', label: t('localeZh') },
            { value: 'en_US', label: t('localeEn') },
          ]}
          onChange={(value) => props.onChange({ transcribeLocale: value as Settings['transcribeLocale'] })}
        />
        <div style={{ fontSize: 12, color: palette.muted, margin: '4px 0 10px' }}>{t('transcribeLanguageHint')}</div>
        <Picker
          palette={palette}
          label={t('quality')}
          value={settings.quality}
          options={[
            { value: 'high', label: t('qualityHigh') },
            { value: 'medium', label: t('qualityMedium') },
            { value: 'low', label: t('qualityLow') },
          ]}
          onChange={(value) => props.onChange({ quality: value as Settings['quality'] })}
        />
        <div style={{ fontSize: 12, color: palette.muted, marginTop: 4 }}>{t('qualityHint')}</div>
      </section>

      <section>
        <div
          style={{ fontSize: 12, fontWeight: 500, color: palette.muted, textTransform: 'uppercase', marginBottom: 6 }}
        >
          {t('settingsAI')}
        </div>
        <Toggle
          palette={palette}
          label={t('autoTranscribe')}
          value={settings.autoTranscribe}
          onChange={(value) => props.onChange({ autoTranscribe: value })}
        />
        <Toggle
          palette={palette}
          label={t('autoSummarize')}
          hint={t('autoSummarizeHint')}
          value={settings.autoSummarize}
          onChange={(value) => props.onChange({ autoSummarize: value })}
        />
        <Picker
          palette={palette}
          label={t('defaultTemplate')}
          value={settings.defaultTemplate}
          options={templates.map((template) => ({ value: template, label: templateLabels[template] }))}
          onChange={(value) => props.onChange({ defaultTemplate: value as SummaryTemplate })}
        />
      </section>

      <section>
        <div
          style={{ fontSize: 12, fontWeight: 500, color: palette.muted, textTransform: 'uppercase', marginBottom: 6 }}
        >
          {t('settingsStorage')}
        </div>
        <StatRow palette={palette} label={t('clipCount')} value={String(props.clips.length)} />
        <StatRow palette={palette} label={t('clipBytes')} value={byteSize(bytes)} />
        <div style={{ fontSize: 12, color: palette.muted, marginTop: 8 }}>{t('hostSettingsNote')}</div>
      </section>
    </div>
  )
}

function Picker(props: {
  palette: Palette
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.s3,
        padding: '10px 0',
        fontSize: 15,
        color: props.palette.ink,
      }}
    >
      <span style={{ flex: 1 }}>{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        style={{
          border: `1px solid ${props.palette.line}`,
          borderRadius: 8,
          padding: '6px 8px',
          fontSize: 14,
          background: props.palette.surface,
          color: props.palette.ink,
        }}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function StatRow(props: { palette: Palette; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0', fontSize: 15, color: props.palette.ink }}>
      <span style={{ flex: 1 }}>{props.label}</span>
      <span style={{ color: props.palette.muted, fontSize: 14 }}>{props.value}</span>
    </div>
  )
}
