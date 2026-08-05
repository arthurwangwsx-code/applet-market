// ⋯ 溢出菜单（§1）与通用选项面板。
//
// 为什么自绘而不是 `aibox.ui.actionSheet`：原生这份菜单里有 **Toggle（随机）**、
// **带勾的子菜单（循环 / 睡眠定时器）**，action sheet 表达不了勾选态与两级结构，
// 而且上限 8 项。长按曲目那种「一排纯动作」仍然走原生 action sheet（见 app.jsx）。
//
// 与原生的两处差异（README 有记）：
//  · **Autoplay（无尽播放）** 是原生偏好键 `AudioAutoplay`，没有任何工具投影 → 整项不渲染；
//  · **歌词翻译**两项需要 AI 文本能力，本应用 `ai: false` → 整段不渲染。

import React from 'react'
import Icon from './Icon.js'
import { C, SPACE } from './theme.js'

const SLEEP_PRESETS = [5, 10, 15, 30, 45, 60]

export default function OptionsMenu({ open, onClose, tab, ctx }) {
  const { t, music, actions } = ctx
  const [submenu, setSubmenu] = React.useState(null)
  React.useEffect(() => { if (open) setSubmenu(null) }, [open])
  if (!open) return null

  const status = music.status
  const timer = music.sleepTimer
  const isPlayer = tab === 'player'

  const close = (run) => { onClose(); if (run) run() }

  const repeatIcon = status.repeatMode === 'one' ? 'repeat.1' : 'repeat'
  const repeatValue = {
    off: t('menu.repeatOff'), one: t('menu.repeatOne'), all: t('menu.repeatAll'),
  }[status.repeatMode] || t('menu.repeatOff')

  const timerValue = timer.endOfTrack
    ? t('menu.stopAfterSong')
    : (timer.remaining !== null && timer.remaining !== undefined
      ? t('menu.stopIn', `${Math.floor(timer.remaining / 60)}:${String(timer.remaining % 60).padStart(2, '0')}`)
      : t('menu.notSet'))

  return (
    <div className="mu-sheet-backdrop" onClick={onClose} role="presentation">
      <div className="mu-sheet" onClick={(event) => event.stopPropagation()} role="presentation">
        <div style={{ padding: `10px ${SPACE.s4}px`, borderBottom: `0.5px solid ${C.line}` }}>
          <span style={{ fontSize: 13, color: C.muted }}>{submenu ? submenu.title : t('menu.options')}</span>
        </div>
        <div className="mu-scroll" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {submenu ? (
            <>
              <MenuRow icon="chevron.backward" title={t('common.back')} onClick={() => setSubmenu(null)} />
              {submenu.items.map((item) => (
                <MenuRow
                  key={item.id}
                  icon={item.icon}
                  title={item.title}
                  checked={item.checked}
                  danger={item.danger}
                  onClick={() => close(item.run)}
                />
              ))}
            </>
          ) : (
            <>
              {isPlayer ? (
                <>
                  <MenuRow
                    icon="shuffle"
                    title={t('menu.shuffle')}
                    trailing={<Toggle on={status.isShuffled} />}
                    onClick={() => music.setShuffle(!status.isShuffled)}
                  />
                  <MenuRow
                    icon={repeatIcon}
                    title={t('menu.repeat')}
                    detail={repeatValue}
                    onClick={() => setSubmenu({
                      title: t('menu.repeat'),
                      items: ['off', 'one', 'all'].map((mode) => ({
                        id: mode,
                        title: { off: t('menu.repeatOff'), one: t('menu.repeatOne'), all: t('menu.repeatAll') }[mode],
                        checked: status.repeatMode === mode,
                        run: () => music.setRepeat(mode),
                      })),
                    })}
                  />
                  <MenuRow
                    icon="moon.zzz.fill"
                    title={t('menu.sleepTimer')}
                    detail={timerValue}
                    onClick={() => setSubmenu({
                      title: t('menu.sleepTimer'),
                      items: [
                        ...(timer.active ? [{
                          id: 'cancel',
                          icon: 'moon.zzz.fill',
                          title: t('menu.turnOffTimer'),
                          danger: true,
                          run: () => music.cancelSleepTimer(),
                        }] : []),
                        ...SLEEP_PRESETS.map((minutes) => ({
                          id: `m${minutes}`,
                          title: t('menu.minutes', minutes),
                          run: () => music.setSleepTimer(minutes),
                        })),
                        { id: 'eot', title: t('menu.endOfTrack'), run: () => music.setSleepTimerEndOfTrack() },
                      ],
                    })}
                  />
                  <MenuRow
                    icon="slider.horizontal.3"
                    title={t('menu.audioEffects')}
                    onClick={() => close(() => actions.navigate({ name: 'effects' }))}
                  />
                  {ctx.externalURL ? (
                    <MenuRow
                      icon="square.and.arrow.up"
                      title={t('common.share')}
                      onClick={() => close(() => actions.shareCurrent())}
                    />
                  ) : null}
                  <Separator />
                </>
              ) : null}
              <MenuRow
                icon="gearshape"
                title={t('menu.musicSettings')}
                onClick={() => close(() => actions.navigate({ name: 'settings' }))}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function MenuRow({ icon, title, detail, trailing, checked, danger, onClick }) {
  return (
    <button
      type="button"
      className="mu-btn mu-press"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: `13px ${SPACE.s4}px`, borderBottom: `0.5px solid ${C.line}`,
        color: danger ? C.danger : C.ink,
      }}
    >
      {icon ? <Icon name={icon} size={18} color={danger ? C.danger : C.ink} /> : <span style={{ width: 18 }} />}
      <span style={{ flex: '1 1 auto', fontSize: 16 }}>{title}</span>
      {detail ? <span style={{ fontSize: 14, color: C.muted }}>{detail}</span> : null}
      {checked ? <Icon name="checkmark" size={15} color={C.accent} /> : null}
      {trailing}
    </button>
  )
}

function Toggle({ on }) {
  return (
    <span style={{
      width: 38, height: 22, borderRadius: 11, position: 'relative', flex: '0 0 auto',
      background: on ? C.accent : `color-mix(in srgb, ${C.muted} 32%, transparent)`,
    }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s ease-out',
      }}
      />
    </span>
  )
}

function Separator() {
  return <div style={{ height: 8, background: C.bg }} />
}

/** 通用单选面板（设置页的循环模式等复用它）。 */
export function OptionPicker({ request, onClose }) {
  if (!request) return null
  return (
    <div className="mu-sheet-backdrop" onClick={onClose} role="presentation">
      <div className="mu-sheet" onClick={(event) => event.stopPropagation()} role="presentation">
        <div style={{ padding: `10px ${SPACE.s4}px`, borderBottom: `0.5px solid ${C.line}` }}>
          <span style={{ fontSize: 13, color: C.muted }}>{request.title}</span>
        </div>
        <div className="mu-scroll" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {request.options.map((option) => (
            <MenuRow
              key={option.id}
              title={option.title}
              checked={request.selected === option.id}
              onClick={() => { onClose(); request.onPick(option.id) }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
