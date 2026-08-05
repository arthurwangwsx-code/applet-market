// 「添加视频」面板：粘贴地址 → 解析 → **选画质** → 下载。
//
// 画质选择是这个应用的核心交互，也是判据里唯一判为「策略归应用」的那一格：
// 同一个视频，两个应用可以默认选不同档且**都对**（一个默认最高清、一个默认省流量）。
// 所以它必须在这里画出来，而不是让宿主替用户决定。

import React from 'react'
import Icon from './Icon.js'
import { Button, Chip, Sheet } from './primitives.js'
import { C, RADIUS, SPACE } from './theme.js'

/** 从一段文本里抽第一个 http(s) 链接（分享过来的文字常常带一堆前后缀）。 */
export function firstURL(text) {
  const found = String(text || '').match(/https?:\/\/[^\s<>"')\]]+/)
  return found ? found[0].replace(/[.,;]+$/, '') : ''
}

function protoBadge(proto) {
  const label = { direct: '直链', hls: 'HLS', dash: 'DASH' }[proto] || proto
  return (
    <span style={{
      fontSize: 11, padding: '1px 6px', borderRadius: 4,
      border: `1px solid ${C.line}`, color: C.muted,
    }}>{label}</span>
  )
}

export default function InspectSheet({ open, onClose, onInspect, onDownload, onPaste }) {
  const [url, setUrl] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [info, setInfo] = React.useState(null)
  const [formats, setFormats] = React.useState([])
  const [chosen, setChosen] = React.useState(null)
  const [audioOnly, setAudioOnly] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setUrl(''); setInfo(null); setFormats([]); setChosen(null); setAudioOnly(false); setError('')
  }, [open])

  const inspect = async () => {
    const target = firstURL(url)
    if (!target) { setError('没找到 http(s) 链接。'); return }
    setBusy(true); setError('')
    const result = await onInspect(target)
    setBusy(false)
    if (!result.ok) { setError(result.text || result.error || '解析失败。'); return }
    setInfo(result.video)
    setFormats(result.formats || [])
    // 缺省选第一条——extractor 已按清晰度降序给出，第一条就是「最好的那个」。
    setChosen((result.formats && result.formats[0] && result.formats[0].id) || null)
    if (!result.formats || !result.formats.length) {
      // 解析成功但没有格式清单（部分直链就是这样）：仍然可以下，只是没得选。
      setError('')
    }
  }

  const start = async () => {
    const target = firstURL(url)
    if (!target) return
    setBusy(true)
    await onDownload({ url: target, formatId: chosen || undefined, audioOnly })
    setBusy(false)
    onClose()
  }

  return (
    <Sheet
      open={open}
      title="添加视频"
      onClose={onClose}
      footer={info ? (
        <Button kind="primary" block disabled={busy} onClick={start} icon="arrow.down.to.line">
          {audioOnly ? '只下音频' : '开始下载'}
        </Button>
      ) : (
        <Button kind="primary" block disabled={busy || !url.trim()} onClick={inspect} icon="magnifyingglass">
          {busy ? '解析中…' : '解析'}
        </Button>
      )}
    >
      <input
        value={url}
        onChange={(e) => { setUrl(e.target.value); setInfo(null); setFormats([]) }}
        placeholder="粘贴视频页面或直链地址"
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: SPACE.s3, borderRadius: RADIUS.control,
          border: `1px solid ${C.line}`, background: 'transparent', fontSize: 14,
        }}
      />
      {onPaste ? (
        <div style={{ marginTop: SPACE.s2 }}>
          <Button
            icon="doc.on.clipboard"
            onClick={async () => { const t = await onPaste(); if (t) { setUrl(t); setInfo(null) } }}
          >从剪贴板粘贴</Button>
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: SPACE.s3, fontSize: 13, color: C.failed, lineHeight: 1.5 }}>{error}</div>
      ) : null}

      {info ? (
        <div style={{ marginTop: SPACE.s4 }}>
          <div style={{ display: 'flex', gap: SPACE.s3 }}>
            {info.thumbnailURL ? (
              <img
                src={info.thumbnailURL}
                alt=""
                style={{ width: 96, height: 54, objectFit: 'cover', borderRadius: 8, background: C.track }}
              />
            ) : (
              <div style={{
                width: 96, height: 54, borderRadius: 8, background: C.track,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted,
              }}><Icon name="film" size={22} /></div>
            )}
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{info.title}</div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>
                {[info.uploader, info.durationText, info.extractor].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>

          {formats.length ? (
            <>
              <div style={{ marginTop: SPACE.s4, fontSize: 13, fontWeight: 600, color: C.muted }}>画质</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s1, marginTop: SPACE.s2 }}>
                {formats.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setChosen(f.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: SPACE.s2, textAlign: 'left',
                      padding: `${SPACE.s2}px ${SPACE.s3}px`, borderRadius: RADIUS.control,
                      border: `1px solid ${chosen === f.id ? C.brand : C.line}`,
                      background: 'transparent', cursor: 'pointer', minHeight: 44,
                    }}
                  >
                    <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 500 }}>{f.qualityLabel}</span>
                      <span style={{ display: 'block', fontSize: 12, color: C.muted }}>
                        {[f.codecs, f.filesizeText, f.needsMerge ? '需合并音视频轨' : null]
                          .filter(Boolean).join(' · ') || f.container}
                      </span>
                    </span>
                    {protoBadge(f.proto)}
                    {chosen === f.id ? <Icon name="checkmark.circle.fill" size={18} color={C.brand} /> : null}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div style={{ marginTop: SPACE.s3, fontSize: 12.5, color: C.muted }}>
              这个来源没有给出可选画质，会按默认清晰度下载。
            </div>
          )}

          <div style={{ marginTop: SPACE.s4, display: 'flex', gap: SPACE.s2, alignItems: 'center' }}>
            <Chip active={!audioOnly} onClick={() => setAudioOnly(false)}>视频</Chip>
            <Chip active={audioOnly} onClick={() => setAudioOnly(true)}>只要音频</Chip>
          </div>
          {audioOnly ? (
            <div style={{ marginTop: SPACE.s2, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
              DASH 来源会直接跳过视频轨（很快）；直链与 HLS 需要先下完整流再抽音频。
            </div>
          ) : null}
          {info.subtitles && info.subtitles.length ? (
            <div style={{ marginTop: SPACE.s2, fontSize: 12, color: C.muted }}>
              字幕：{info.subtitles.join('、')}
            </div>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  )
}
