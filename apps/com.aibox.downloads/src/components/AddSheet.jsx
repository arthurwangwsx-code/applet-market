// 「添加下载」面板：批量粘贴 + 落点选择 + 优先级。
//
// **落点必须在这里出现**，哪怕大多数人只用沙盒。改造前这条桥把落点硬编码成沙盒根，
// 引擎明明支持四种——把它画出来，是这一轮泛化在用户面前的唯一证据。

import React from 'react'
import Icon from './Icon.jsx'
import { Button, Chip, Sheet } from './primitives.jsx'
import { C, RADIUS, SPACE } from './theme.js'

const DESTINATIONS = [
  { kind: 'sandbox', label: '应用内', icon: 'folder', hint: '恒可用，不需要任何授权' },
  { kind: 'iCloud', label: 'iCloud', icon: 'icloud', hint: '同步到 iCloud Drive' },
  { kind: 'externalFiles', label: '外部文件夹', icon: 'externaldrive', hint: '需先在下载设置里授权一个文件夹' },
  { kind: 'vault', label: '笔记 Vault', icon: 'lock', hint: '落进当前活动 vault' },
]

const PRIORITIES = [
  { id: 'high', label: '优先' },
  { id: 'normal', label: '普通' },
  { id: 'low', label: '后台' },
]

/** 从一段文本里抽出所有 http(s) 链接（换行、空格、混在正文里都能认）。 */
export function extractURLs(text) {
  if (!text) return []
  const found = String(text).match(/https?:\/\/[^\s<>"')\]]+/g) || []
  const seen = new Set()
  const out = []
  for (const raw of found) {
    const url = raw.replace(/[.,;]+$/, '')
    if (seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

export default function AddSheet({ open, onClose, onSubmit, onPaste }) {
  const [text, setText] = React.useState('')
  const [destination, setDestination] = React.useState('sandbox')
  const [folder, setFolder] = React.useState('')
  const [priority, setPriority] = React.useState('normal')
  const urls = React.useMemo(() => extractURLs(text), [text])

  React.useEffect(() => { if (open) setText('') }, [open])

  const submit = () => {
    if (!urls.length) return
    onSubmit({ urls, destination, folder: folder.trim(), priority })
    onClose()
  }

  return (
    <Sheet
      open={open}
      title="添加下载"
      onClose={onClose}
      footer={(
        <Button kind="primary" block disabled={!urls.length} onClick={submit} icon="arrow.down.to.line">
          {urls.length > 1 ? `下载 ${urls.length} 个链接` : '开始下载'}
        </Button>
      )}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="粘贴一个或多个链接，每行一个"
        rows={4}
        style={{
          width: '100%', boxSizing: 'border-box', resize: 'none',
          padding: SPACE.s3, borderRadius: RADIUS.control,
          border: `1px solid ${C.line}`, background: 'transparent',
          fontSize: 14, lineHeight: 1.5,
        }}
      />
      {onPaste ? (
        <div style={{ marginTop: SPACE.s2 }}>
          <Button
            icon="doc.on.clipboard"
            onClick={async () => { const t = await onPaste(); if (t) setText((prev) => (prev ? `${prev}\n${t}` : t)) }}
          >从剪贴板粘贴</Button>
        </div>
      ) : null}
      {text && !urls.length ? (
        <div style={{ marginTop: SPACE.s2, fontSize: 12.5, color: C.failed }}>
          没找到 http(s) 链接。
        </div>
      ) : null}
      {urls.length > 1 ? (
        <div style={{ marginTop: SPACE.s2, fontSize: 12.5, color: C.muted }}>
          识别到 {urls.length} 个链接，会作为同一批入队（可一并暂停或取消）。
        </div>
      ) : null}

      <div style={{ marginTop: SPACE.s5, fontSize: 13, fontWeight: 600, color: C.muted }}>存到哪</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s1, marginTop: SPACE.s2 }}>
        {DESTINATIONS.map((d) => (
          <button
            key={d.kind}
            type="button"
            onClick={() => setDestination(d.kind)}
            style={{
              display: 'flex', alignItems: 'center', gap: SPACE.s3, textAlign: 'left',
              padding: `${SPACE.s2}px ${SPACE.s3}px`, borderRadius: RADIUS.control,
              border: `1px solid ${destination === d.kind ? C.brand : C.line}`,
              background: 'transparent', cursor: 'pointer', minHeight: 44,
            }}
          >
            <Icon name={d.icon} size={20} color={destination === d.kind ? C.brand : C.muted} />
            <span style={{ flex: '1 1 auto' }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 500 }}>{d.label}</span>
              <span style={{ display: 'block', fontSize: 12, color: C.muted }}>{d.hint}</span>
            </span>
            {destination === d.kind ? <Icon name="checkmark.circle.fill" size={18} color={C.brand} /> : null}
          </button>
        ))}
      </div>

      <input
        value={folder}
        onChange={(e) => setFolder(e.target.value)}
        placeholder="子文件夹（可留空）"
        style={{
          width: '100%', boxSizing: 'border-box', marginTop: SPACE.s3,
          padding: SPACE.s3, borderRadius: RADIUS.control,
          border: `1px solid ${C.line}`, background: 'transparent', fontSize: 14,
        }}
      />

      <div style={{ marginTop: SPACE.s5, fontSize: 13, fontWeight: 600, color: C.muted }}>优先级</div>
      <div style={{ display: 'flex', gap: SPACE.s2, marginTop: SPACE.s2 }}>
        {PRIORITIES.map((p) => (
          <Chip key={p.id} active={priority === p.id} onClick={() => setPriority(p.id)}>{p.label}</Chip>
        ))}
      </div>
    </Sheet>
  )
}
