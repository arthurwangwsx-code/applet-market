// 队列状态机 + 平滑时钟 + 歌词行模型的 Node 自测。
//
// 为什么必须有：播放顺序错了**不容易肉眼发现**——UI 照常渲染，只是下一首放错。
// 这里把规格 §5.4 的每一条归一化规则钉成断言，随机序用可注入的确定性 rng。
//
//   node apps/com.aibox.music/tests/queue.test.mjs

import assert from 'node:assert/strict'
import * as Q from '../src/lib/queue.js'
import { SmoothClock } from '../src/lib/clock.js'
import { parseLRC, plainLines, currentLineIndex, sweepRatio, readLyricsPayload } from '../src/lib/lyrics.js'

let passed = 0
let failed = 0
function test(name, run) {
  try {
    run()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (error) {
    failed += 1
    console.error(`  ✗ ${name}\n    ${error.message}`)
  }
}

/** 确定性 rng（LCG），让洗牌可复现。 */
function makeRNG(seed = 42) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const track = (id, title = id) => ({ id, title })
const build = (ids, currentIndex = 0) => ({
  tracks: ids.map((id) => track(id)),
  currentIndex,
  shuffledTrackIDs: [],
})

console.log('队列状态机 §5.4')

test('replace：指定曲存在则选中它', () => {
  const state = Q.replace(build(['a', 'b', 'c'], 2), [track('x'), track('y'), track('z')], 'y', makeRNG())
  assert.equal(state.currentIndex, 1)
  assert.deepEqual(state.tracks.map((row) => row.id), ['x', 'y', 'z'])
})

test('replace：指定曲不存在则夹住旧下标', () => {
  const state = Q.replace(build(['a', 'b', 'c'], 2), [track('x'), track('y')], 'nope', makeRNG())
  assert.equal(state.currentIndex, 1) // min(2, 2-1)
})

test('replace：空队列索引归 0', () => {
  const state = Q.replace(build(['a', 'b'], 1), [], null, makeRNG())
  assert.equal(state.currentIndex, 0)
  assert.deepEqual(state.shuffledTrackIDs, [])
})

test('replace：重建随机序，且是全体 id 的一个排列', () => {
  const state = Q.replace(build([], 0), ['a', 'b', 'c', 'd'].map(track), 'c', makeRNG(7))
  assert.deepEqual([...state.shuffledTrackIDs].sort(), ['a', 'b', 'c', 'd'])
})

test('appendOrSelect：已存在则只选中，不重复追加', () => {
  const state = Q.appendOrSelect(build(['a', 'b', 'c'], 0), track('b'), makeRNG())
  assert.equal(state.tracks.length, 3)
  assert.equal(state.currentIndex, 1)
})

test('appendOrSelect：不存在则追加到队尾并选中末位', () => {
  const state = Q.appendOrSelect(build(['a', 'b'], 0), track('z'), makeRNG())
  assert.deepEqual(state.tracks.map((row) => row.id), ['a', 'b', 'z'])
  assert.equal(state.currentIndex, 2)
})

test('add：插入点 ≤ 当前索引时当前曲后移 N 位（还是同一首）', () => {
  const before = build(['a', 'b', 'c'], 2)
  const state = Q.add(before, [track('x'), track('y')], 0, makeRNG())
  assert.equal(state.tracks[state.currentIndex].id, 'c')
  assert.equal(state.currentIndex, 4)
})

test('add：插入点在当前之后时当前索引不动', () => {
  const state = Q.add(build(['a', 'b', 'c'], 0), [track('x')], 2, makeRNG())
  assert.equal(state.currentIndex, 0)
  assert.deepEqual(state.tracks.map((row) => row.id), ['a', 'b', 'x', 'c'])
})

test('add：插入位置 clamp 到 [0, count]', () => {
  const state = Q.add(build(['a', 'b'], 0), [track('x')], 99, makeRNG())
  assert.deepEqual(state.tracks.map((row) => row.id), ['a', 'b', 'x'])
})

test('remove：删当前之前 → 当前 -1', () => {
  const state = Q.remove(build(['a', 'b', 'c'], 2), 0, makeRNG())
  assert.equal(state.currentIndex, 1)
  assert.equal(state.tracks[state.currentIndex].id, 'c')
  assert.equal(state.shouldStop, false)
})

test('remove：删的就是当前 → 顺位接上下一首', () => {
  const state = Q.remove(build(['a', 'b', 'c'], 1), 1, makeRNG())
  assert.equal(state.currentIndex, 1)
  assert.equal(state.tracks[state.currentIndex].id, 'c')
})

test('remove：删的是最后一首且它是当前 → 夹回新末位', () => {
  const state = Q.remove(build(['a', 'b'], 1), 1, makeRNG())
  assert.equal(state.currentIndex, 0)
  assert.equal(state.tracks[state.currentIndex].id, 'a')
})

test('remove：删空 → 索引 0 且要求停止播放', () => {
  const state = Q.remove(build(['a'], 0), 0, makeRNG())
  assert.equal(state.tracks.length, 0)
  assert.equal(state.currentIndex, 0)
  assert.equal(state.shouldStop, true)
})

test('move：当前曲按 id 找回新下标（不是按下标推演）', () => {
  const state = Q.move(build(['a', 'b', 'c', 'd'], 2), 0, 3, makeRNG())
  assert.deepEqual(state.tracks.map((row) => row.id), ['b', 'c', 'd', 'a'])
  assert.equal(state.tracks[state.currentIndex].id, 'c')
  assert.equal(state.currentIndex, 1)
})

test('move：把当前曲自己挪走，索引跟着它', () => {
  const state = Q.move(build(['a', 'b', 'c'], 0), 0, 2, makeRNG())
  assert.equal(state.tracks[state.currentIndex].id, 'a')
  assert.equal(state.currentIndex, 2)
})

test('setShuffle(true)：重建随机序并把当前曲提到首位', () => {
  const state = Q.setShuffle(build(['a', 'b', 'c', 'd'], 2), true, makeRNG(3))
  assert.equal(state.shuffledTrackIDs[0], 'c')
  assert.deepEqual([...state.shuffledTrackIDs].sort(), ['a', 'b', 'c', 'd'])
})

test('setShuffle(false)：清空随机序', () => {
  const shuffled = Q.setShuffle(build(['a', 'b'], 0), true, makeRNG())
  assert.deepEqual(Q.setShuffle(shuffled, false).shuffledTrackIDs, [])
})

test('随机序对账：剔除失效 id、把新 id 打散追加，已有顺序不重排', () => {
  const state = {
    tracks: ['b', 'c', 'x', 'y'].map(track),
    currentIndex: 0,
    shuffledTrackIDs: ['c', 'a', 'b'], // a 已被删
  }
  const next = Q.reconcileShuffle(state, makeRNG(11))
  assert.deepEqual(next.shuffledTrackIDs.slice(0, 2), ['c', 'b'])
  assert.deepEqual([...next.shuffledTrackIDs].sort(), ['b', 'c', 'x', 'y'])
})

test('增删移动后随机序自动对账（add / remove / move 都过一遍）', () => {
  let state = Q.setShuffle(build(['a', 'b', 'c'], 0), true, makeRNG(5))
  state = Q.add(state, [track('d')], null, makeRNG(6))
  assert.deepEqual([...state.shuffledTrackIDs].sort(), ['a', 'b', 'c', 'd'])
  state = Q.remove(state, 1, makeRNG(6))
  assert.deepEqual([...state.shuffledTrackIDs].sort(), state.tracks.map((row) => row.id).sort())
  state = Q.move(state, 0, 2, makeRNG(6))
  assert.deepEqual([...state.shuffledTrackIDs].sort(), state.tracks.map((row) => row.id).sort())
})

console.log('下一首 / 上一首')

test('顺序：index ± 1', () => {
  const state = build(['a', 'b', 'c'], 1)
  assert.equal(Q.nextIndex(state), 2)
  assert.equal(Q.previousIndex(state), 0)
})

test('顺序：越界且 repeat=off → null（队列放完）', () => {
  assert.equal(Q.nextIndex(build(['a', 'b'], 1)), null)
  assert.equal(Q.previousIndex(build(['a', 'b'], 0)), null)
})

test('顺序：越界且 repeat=all → 回绕', () => {
  assert.equal(Q.nextIndex(build(['a', 'b'], 1), { repeatMode: 'all' }), 0)
  assert.equal(Q.previousIndex(build(['a', 'b'], 0), { repeatMode: 'all' }), 1)
})

test('随机：next 与 previous 走同一条随机序', () => {
  const state = {
    tracks: ['a', 'b', 'c'].map(track),
    currentIndex: 0, // a
    shuffledTrackIDs: ['b', 'a', 'c'],
  }
  assert.equal(Q.nextIndex(state, { shuffled: true }), 2) // a 之后是 c
  assert.equal(Q.previousIndex(state, { shuffled: true }), 1) // a 之前是 b
})

test('随机：到头且 repeat=all 首尾环回', () => {
  const state = {
    tracks: ['a', 'b', 'c'].map(track),
    currentIndex: 2, // c，随机序末位
    shuffledTrackIDs: ['b', 'a', 'c'],
  }
  assert.equal(Q.nextIndex(state, { shuffled: true }), null)
  assert.equal(Q.nextIndex(state, { shuffled: true, repeatMode: 'all' }), 1) // 回到 b
})

test('对账：以原生 music_queue list 的 isCurrent 为准', () => {
  const state = Q.reconcile(Q.emptyQueue(), [
    { id: 'n1', title: 'A', index: 0, isCurrent: false },
    { id: 'n2', title: 'B', index: 1, isCurrent: true },
  ], makeRNG())
  assert.equal(state.currentIndex, 1)
  assert.equal(state.tracks[1].title, 'B')
})

console.log('平滑时钟 §4.7（整数秒 → 插值）')

test('暂停时速率为 0，歌词与进度冻结', () => {
  let now = 0
  const clock = new SmoothClock({ now: () => now })
  clock.reanchor(10, { duration: 100, rate: 0 })
  now += 3000
  assert.equal(clock.read(), 10)
})

test('播放中按单调时钟插值，不用墙钟', () => {
  let now = 0
  const clock = new SmoothClock({ now: () => now })
  clock.reanchor(10, { duration: 100, rate: 1 })
  now += 500
  assert.ok(Math.abs(clock.read() - 10.5) < 1e-6)
})

test('整数秒进位沿被当作高质量锚点（同一秒内不抖）', () => {
  let now = 0
  const clock = new SmoothClock({ now: () => now })
  clock.observe(10, { duration: 100, rate: 1 })
  now += 1000
  const reanchored = clock.observe(11, { duration: 100, rate: 1 })
  assert.equal(reanchored, true)
  assert.equal(clock.read(), 11)
  now += 400
  const again = clock.observe(11, { duration: 100, rate: 1 }) // 同一秒的重复观测
  assert.equal(again, false)
  assert.ok(Math.abs(clock.read() - 11.4) < 1e-6)
})

test('seek / 切歌递增时间线版本 → 强制重新锚定', () => {
  let now = 0
  const clock = new SmoothClock({ now: () => now })
  clock.observe(50, { duration: 100, rate: 1, timeline: 1 })
  now += 200
  clock.observe(0, { duration: 180, rate: 1, timeline: 2 })
  assert.equal(clock.read(), 0)
  assert.equal(clock.duration, 180)
})

test('插值不会越过总时长', () => {
  let now = 0
  const clock = new SmoothClock({ now: () => now })
  clock.reanchor(99, { duration: 100, rate: 1 })
  now += 10000
  assert.equal(clock.read(), 100)
})

console.log('歌词行模型 §4.2 / §4.7')

test('LRC：一行多标签各产一行，offset 加到所有时间轴上', () => {
  const lines = parseLRC('[offset:-500]\n[00:10.00][00:20.00]hello\n[00:15.5]world')
  assert.deepEqual(lines.map((row) => row.text), ['hello', 'world', 'hello'])
  assert.ok(Math.abs(lines[0].time - 9.5) < 1e-6)
  assert.ok(Math.abs(lines[1].time - 15) < 1e-6)
})

test('纯文本：去空行，time 全为 null', () => {
  const lines = plainLines('a\n\n b \n')
  assert.deepEqual(lines.map((row) => row.text), ['a', 'b'])
  assert.equal(lines[0].time, null)
})

test('当前行 = 最后一个 time <= 显示时间 + 0.05 的行', () => {
  const lines = [{ time: 0 }, { time: 10 }, { time: 20 }]
  assert.equal(currentLineIndex(lines, 9.9), 0)
  assert.equal(currentLineIndex(lines, 9.96), 1)
  assert.equal(currentLineIndex(lines, 25), 2)
})

test('无时间轴时当前行恒为 -1（不高亮、不扫光）', () => {
  assert.equal(currentLineIndex(plainLines('a\nb'), 12), -1)
  assert.equal(sweepRatio(plainLines('a\nb'), 0, 12), 0)
})

test('扫光比例按本行到下一行的跨度，量化到 1/60', () => {
  const lines = [{ time: 0 }, { time: 4 }]
  assert.equal(sweepRatio(lines, 0, 2), 0.5)
  assert.equal(sweepRatio(lines, 0, 10), 1)
  assert.equal(sweepRatio(lines, 0, -5), 0)
})

test('music_lyrics 的纯文本返回被剥掉表头，且判定为未同步', () => {
  const payload = readLyricsPayload({
    ok: true,
    text: 'Lyrics for Song — Artist (a time-synced version is shown in the player):\n\nline one\nline two',
    json: null,
  })
  assert.equal(payload.state, 'ok')
  assert.equal(payload.synced, false)
  assert.deepEqual(payload.lines.map((row) => row.text), ['line one', 'line two'])
})

test('宿主一旦透出结构化 lines，同一份代码自动变成逐行同步', () => {
  const payload = readLyricsPayload({
    ok: true,
    text: '{}',
    json: { synced: true, source: 'lrclib', lines: [{ time: 0, text: 'a' }, { time: 3, text: 'b' }] },
  })
  assert.equal(payload.synced, true)
  assert.equal(currentLineIndex(payload.lines, 3.1), 1)
})

test('「没找到歌词」被识别成 none，而不是渲染成一行错文本', () => {
  const payload = readLyricsPayload({ ok: true, text: 'No lyrics found for “X — Y”.', json: null })
  assert.equal(payload.state, 'none')
  assert.equal(payload.lines.length, 0)
})

console.log(`\n${passed} 通过，${failed} 失败`)
process.exit(failed === 0 ? 0 : 1)
