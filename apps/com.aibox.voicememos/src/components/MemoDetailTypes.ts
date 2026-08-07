import type { Memo, MemoArtifacts, MemoTranscript, TranscriptSegment } from '../lib/types.js'

export type DetailTab = 'summary' | 'original' | 'corrected' | 'translation'

export interface DetailContext {
  memo: Memo
  transcript: MemoTranscript | null
  artifacts: MemoArtifacts | null
  setArtifacts: (value: MemoArtifacts) => void
  text: string
  /** 带时间戳的转写分段。2.0.0 才有，1.x 的宿主工具只回 segmentCount。 */
  segments: TranscriptSegment[]
  /** 跳到某一秒。接的是页面自己的 audio，所以是真的精确跳转。 */
  seek: (seconds: number) => void
}
