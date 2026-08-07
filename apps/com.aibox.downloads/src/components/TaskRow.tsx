// 一条下载任务的行。
//
// 一行要同时回答四个问题：**下什么、到哪了、多快、现在能对它做什么**。
// 少任何一个都会让用户去点开详情页找答案——那是这类界面最常见的失败。

import React from 'react'
import Icon from './Icon.js'
import { IconButton, ProgressBar } from './primitives.js'
import { C, SPACE, formatBytes, formatETA, formatSpeed, stateColor } from './theme.js'
import type { DownloadTask } from '../types.js'

const STATE_LABEL: Record<DownloadTask['state'], string> = {
  queued: '排队中',
  running: '下载中',
  paused: '已暂停',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

/** 副标题：把「多少 / 多快 / 还要多久」压成一行，缺哪项就不写哪项，不留占位符。 */
function subtitle(task: DownloadTask): string {
  const parts: string[] = []
  if (task.state === 'completed') {
    if (task.totalBytes || task.bytesReceived) parts.push(formatBytes(task.totalBytes || task.bytesReceived))
    if (task.outputPath) parts.push(task.outputPath.split('/').slice(-2).join('/'))
    return parts.join(' · ')
  }
  if (task.state === 'failed') return task.error || '下载失败'
  if (task.state === 'cancelled') return '已取消'
  if (task.totalBytes) parts.push(`${formatBytes(task.bytesReceived || 0)} / ${formatBytes(task.totalBytes)}`)
  else if (task.bytesReceived) parts.push(formatBytes(task.bytesReceived))
  const speed = formatSpeed(task.speed)
  if (speed && task.state === 'running') parts.push(speed)
  const eta = formatETA(task.eta)
  if (eta && task.state === 'running') parts.push(`剩 ${eta}`)
  if (!parts.length) parts.push(STATE_LABEL[task.state] || task.state)
  return parts.join(' · ')
}

interface TaskRowProps {
  task: DownloadTask
  onPause: (task: DownloadTask) => void
  onResume: (task: DownloadTask) => void
  onCancel: (task: DownloadTask) => void
  onRemove: (task: DownloadTask) => void
  onOpen: ((task: DownloadTask) => void) | null
  onShare: ((task: DownloadTask) => void) | null
}

export default function TaskRow({ task, onPause, onResume, onCancel, onRemove, onOpen, onShare }: TaskRowProps) {
  const color = stateColor(task.state)
  const running = task.state === 'running' || task.state === 'queued'
  const resumable = task.state === 'paused' || task.state === 'failed'
  const finished = ['completed', 'failed', 'cancelled'].includes(task.state)
  const percent = typeof task.fraction === 'number' ? `${Math.round(task.fraction * 100)}%` : ''

  return (
    <div data-row-id={task.taskId} style={{ padding: `${SPACE.s3}px ${SPACE.s4}px` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s3 }}>
        <Icon
          name={
            task.state === 'completed'
              ? 'checkmark.circle.fill'
              : task.state === 'failed'
                ? 'exclamationmark.triangle'
                : task.state === 'paused'
                  ? 'pause.circle'
                  : 'arrow.down.circle'
          }
          size={24}
          color={color}
        />
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {task.filename}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: task.state === 'failed' ? C.failed : C.muted,
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle(task)}
          </div>
        </div>
        {percent && !finished ? (
          <span style={{ fontSize: 12.5, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{percent}</span>
        ) : null}
        {running ? <IconButton name="pause" onClick={() => onPause(task)} label="暂停" /> : null}
        {resumable ? <IconButton name="play" onClick={() => onResume(task)} label="继续" /> : null}
        {!finished ? <IconButton name="xmark" onClick={() => onCancel(task)} label="取消" /> : null}
        {task.state === 'completed' && onOpen ? (
          <IconButton name="doc.text" onClick={() => onOpen(task)} label="打开" />
        ) : null}
        {task.state === 'completed' && onShare ? (
          <IconButton name="square.and.arrow.up" onClick={() => onShare(task)} label="分享" />
        ) : null}
        {finished ? <IconButton name="trash" onClick={() => onRemove(task)} label="删除记录" /> : null}
      </div>
      {!finished ? (
        <div style={{ marginTop: SPACE.s2, marginLeft: 24 + SPACE.s3 }}>
          <ProgressBar fraction={task.fraction} color={color} />
        </div>
      ) : null}
    </div>
  )
}
