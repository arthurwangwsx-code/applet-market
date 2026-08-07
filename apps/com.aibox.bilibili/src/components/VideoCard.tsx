// 视频卡片 —— 列表的基本行。对标 B 站 App 的横向卡：左封面 16:9，右标题两行 + UP 主 + 播放量。
//
// 两处关键：
//  · 封面走 `imageURL()`（`applet://image/`）。裸 https 会被 CSP 静默拦成空白。
//  · 卡片高度**固定**（COVER_H + 上下 padding）。虚拟列表靠估高定位，行高一变就会跳；
//    标题用 `.bl-clamp2` 截两行正是为了让高度恒定。

import React from 'react'
import { C, RADIUS, SPACE } from './theme.js'
import { imageURL } from '../lib/host.js'
import { formatCount, formatDuration } from '../lib/format.js'
import type { VideoSummary } from '../lib/types.js'

const COVER_W = 152
const COVER_H = 86 // 16:9
export const CARD_HEIGHT = COVER_H + SPACE.s3 * 2

export default function VideoCard({ video, onOpen }: { video: VideoSummary; onOpen?: (video: VideoSummary) => void }) {
  return (
    <div
      className="bl-press"
      data-row-id={video.bvid}
      onClick={() => onOpen?.(video)}
      style={{
        display: 'flex',
        gap: SPACE.s3,
        padding: `${SPACE.s3}px ${SPACE.s4}px`,
        alignItems: 'flex-start',
        boxSizing: 'border-box',
        height: CARD_HEIGHT,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: COVER_W,
          height: COVER_H,
          flexShrink: 0,
          borderRadius: RADIUS.md,
          overflow: 'hidden',
          background: C.surface,
        }}
      >
        {video.cover ? (
          <img
            src={imageURL(video.cover, COVER_W)}
            alt=""
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}
        {video.duration > 0 ? (
          <span
            style={{
              position: 'absolute',
              right: 4,
              bottom: 4,
              padding: '1px 5px',
              borderRadius: RADIUS.sm,
              background: 'rgba(0,0,0,0.65)',
              color: '#fff',
              fontSize: 11,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatDuration(video.duration)}
          </span>
        ) : null}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: COVER_H }}>
        <div className="bl-clamp2" style={{ fontSize: 14, lineHeight: 1.35, color: C.text, fontWeight: 500 }}>
          {video.title}
        </div>
        <div style={{ flex: 1 }} />
        {video.author ? (
          <div
            style={{
              fontSize: 12,
              color: C.faint,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {video.author}
          </div>
        ) : null}
        <div style={{ fontSize: 12, color: C.faint, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
          {formatCount(video.play)}观看
          {video.danmaku > 0 ? ` · ${formatCount(video.danmaku)}弹幕` : ''}
        </div>
      </div>
    </div>
  )
}
