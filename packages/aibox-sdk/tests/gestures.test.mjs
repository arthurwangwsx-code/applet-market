// 触摸手势原语的 Node 自测 —— 重点是把 **`touchcancel` = 放弃** 钉成可执行断言。
//
// ## 为什么必须是「真的派发事件」而不是「读一遍代码觉得对」
//
// `touchcancel` 只有原生手势识别器抢走这串触摸时才发。**在浏览器里写、在浏览器里测，
// 永远测不出来**——这正是市场里两个应用各自手搓、各自把它写错（而且错法相反）的原因。
// 所以这里不做「逻辑上对」的推理，而是：
//
//   ① 把原语返回的四个处理器 `addEventListener` 到一个**真的 `EventTarget`** 上；
//   ② `dispatchEvent(new SyntheticTouchEvent('touchcancel'))` —— 真的派发；
//   ③ 断言 abort 分支跑到了（状态复位 + 回弹动画起了）**且 `commit` 一次都没被调用**。
//
// §2 末尾还留了一条**反例**：把 cancel 接到 `onTouchEnd` 上（资讯原来的写法），断言它
// **确实会**误提交。没有这条，"cancel 不翻页" 可能只是因为这串手势本来就不该翻页——
// 反例证明了断言是吃劲的。
//
//   node packages/aibox-sdk/tests/gestures.test.mjs
//   （先 npm run build --workspace @aibox/applet-sdk，本测跑的是 dist/ 产物）

import assert from 'node:assert/strict'
import React from 'react'
import {
  createDragGesture, createLongPress, createSwipePager, useDragGesture, useSwipePager,
} from '../dist/react/gestures.js'

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

// ---------------------------------------------------------------------------
// 事件harness：真 EventTarget + 合成 TouchEvent
// ---------------------------------------------------------------------------

/**
 * 合成触摸事件。
 *
 * Node 没有 `TouchEvent`，但 `Event` 的 `cancelable` / `preventDefault()` / `defaultPrevented`
 * 是标准实现，`touches` 只要满足原语声明的 `ArrayLike<{clientX, clientY}>` 结构即可——
 * 原语本来就故意只依赖这点结构（好让 React 合成事件、真 DOM 事件、这里三者同源）。
 */
class SyntheticTouchEvent extends Event {
  constructor(type, points = []) {
    super(type, { cancelable: true })
    this.touches = points.map(([clientX, clientY]) => ({ clientX, clientY }))
  }
}

/** 把四个处理器挂到真的 EventTarget 上，返回一个「派发一条事件」的函数。 */
function mount(handlers, { cancelGoesTo = 'onTouchCancel' } = {}) {
  const target = new EventTarget()
  target.addEventListener('touchstart', handlers.onTouchStart)
  target.addEventListener('touchmove', handlers.onTouchMove)
  target.addEventListener('touchend', handlers.onTouchEnd)
  // `cancelGoesTo` 只为反例服务：默认接的是独立的 cancel 处理器。
  target.addEventListener('touchcancel', handlers[cancelGoesTo])
  return function dispatch(type, points) {
    const event = new SyntheticTouchEvent(type, points)
    target.dispatchEvent(event)
    return event
  }
}

/** 手动时钟：切页动画的 setTimeout 由它接管，测试里不用真等 220ms。 */
function makeClock() {
  let queue = []
  return {
    schedule: (run) => { queue.push(run) },
    flush() {
      const due = queue
      queue = []
      for (const run of due) run()
    },
    get pending() { return queue.length },
  }
}

/** 造一个无头分页器，把 commit / 视觉快照都记下来。 */
function makePager(options = {}) {
  const clock = makeClock()
  const committed = []
  const views = []
  let index = options.startIndex ?? 0
  const core = createSwipePager({
    count: () => options.count ?? 3,
    index: () => index,
    width: () => options.width ?? 390,
    commit: (next) => { committed.push(next); index = next },
    render: (view) => { views.push({ ...view }) },
    schedule: clock.schedule,
    ...(options.threshold === undefined ? {} : { threshold: options.threshold }),
  })
  return {
    core,
    clock,
    committed,
    views,
    get index() { return index },
    get last() { return views[views.length - 1] },
  }
}

/** 一串「横向拖到 dx」的手势，不含收尾。起点固定在 (200, 300)。 */
function swipeTo(dispatch, dx, { dy = 0, from = [200, 300] } = {}) {
  dispatch('touchstart', [from])
  // 分两步：第一步越过 6px 方向锁，第二步走到目标位移。
  const firstX = from[0] + Math.sign(dx) * Math.min(Math.abs(dx), 20)
  dispatch('touchmove', [[firstX, from[1] + (dy === 0 ? 0 : Math.sign(dy) * 2)]])
  return dispatch('touchmove', [[from[0] + dx, from[1] + dy]])
}

console.log('\n§1 横扫分页：正常抬手才翻页')

test('横向拖过阈值 + touchend → 提交翻页（基线：证明这套 harness 真能翻页）', () => {
  const p = makePager()
  const dispatch = mount(p.core)
  swipeTo(dispatch, -120)
  assert.equal(p.last.offset, -120, '拖动中位移应实时跟手')
  dispatch('touchend', [])
  p.clock.flush()
  assert.deepEqual(p.committed, [1])
  assert.equal(p.index, 1)
})

test('横向拖不够阈值 + touchend → 回弹，不翻页', () => {
  const p = makePager()
  const dispatch = mount(p.core)
  swipeTo(dispatch, -60) // 阈值 = max(48, 390×0.22) = 85.8
  dispatch('touchend', [])
  p.clock.flush()
  assert.deepEqual(p.committed, [])
  assert.equal(p.last.offset, 0)
})

console.log('\n§2 ⭐ touchcancel = 放弃（本文件存在的理由）')

test('派发真的 touchcancel（已过阈值）→ abort 分支跑到，且一次都没提交', () => {
  const p = makePager()
  const dispatch = mount(p.core)
  swipeTo(dispatch, -200) // 远超阈值 85.8：换成 touchend 一定会翻页
  assert.equal(p.last.offset, -200)

  const event = dispatch('touchcancel', [])
  assert.equal(event.type, 'touchcancel', '确实是经 dispatchEvent 派发的 touchcancel')
  assert.ok(event instanceof Event)

  // ① abort 分支跑到了：位移回 0、回弹动画起了、手势已复位。
  assert.equal(p.last.offset, 0, 'cancel 必须立刻把位移动画回 0')
  assert.equal(p.last.animating, true, 'cancel 走的是回弹分支（有动画）')
  assert.equal(p.last.dragging, false, 'cancel 必须清掉拖拽中标记')
  assert.equal(p.core.isActive(), false, 'cancel 必须复位手势状态（理财那条 bug）')

  // ② 没有翻页 —— 动画定时器跑完之后也仍然没有。
  assert.deepEqual(p.committed, [], 'cancel 绝不能提交翻页（资讯那条 bug）')
  p.clock.flush()
  assert.deepEqual(p.committed, [], '动画落地后依然不能提交')
  assert.equal(p.index, 0, '页码原地不动')
  assert.equal(p.last.animating, false, '回弹动画正常收尾')
})

test('反例：把 touchcancel 接到 onTouchEnd 上（资讯原来的写法）→ 确实会误提交', () => {
  const p = makePager()
  const dispatch = mount(p.core, { cancelGoesTo: 'onTouchEnd' })
  swipeTo(dispatch, -200)
  dispatch('touchcancel', [])
  p.clock.flush()
  // 这条**故意**断言坏行为：它证明上一条测试的 `committed === []` 是吃劲的，
  // 不是「这串手势本来就不会翻页」的假绿。
  assert.deepEqual(p.committed, [1], '共用处理器就是会提交一次用户没打算做的翻页')
})

test('onTouchCancel 与 onTouchEnd 必须是两个不同的函数（结构性防线）', () => {
  const p = makePager()
  assert.notEqual(p.core.onTouchCancel, p.core.onTouchEnd)
  const drag = createDragGesture({ axis: 'x' })
  assert.notEqual(drag.onTouchCancel, drag.onTouchEnd)
})

test('cancel 之后状态复位：下一串手势从新起点算，不接着上一次的基准', () => {
  const p = makePager()
  const dispatch = mount(p.core)
  swipeTo(dispatch, -200)
  dispatch('touchcancel', [])
  p.clock.flush()

  // 新的一串触摸，起点在别处、只拖 20px。
  dispatch('touchstart', [[500, 300]])
  dispatch('touchmove', [[480, 300]])
  assert.equal(p.last.offset, -20, '起点若没复位，这里会是 -220 之类的值（行卡在半开位的根因）')
})

test('拖拽中途 cancel（还没过阈值）同样不提交', () => {
  const p = makePager()
  const dispatch = mount(p.core)
  swipeTo(dispatch, -40)
  dispatch('touchcancel', [])
  p.clock.flush()
  assert.deepEqual(p.committed, [])
})

test('还没锁定方向就 cancel → 不留下动画、不提交', () => {
  const p = makePager()
  const dispatch = mount(p.core)
  dispatch('touchstart', [[200, 300]])
  dispatch('touchmove', [[202, 301]]) // < 6px slop，方向未定
  dispatch('touchcancel', [])
  assert.deepEqual(p.committed, [])
  assert.equal(p.core.isActive(), false)
  assert.equal(p.clock.pending, 0, '没锁定就没必要跑回弹动画')
})

console.log('\n§3 方向锁')

test('锁定前绝不 preventDefault（否则页面滚不动）', () => {
  const p = makePager()
  const dispatch = mount(p.core)
  dispatch('touchstart', [[200, 300]])
  const small = dispatch('touchmove', [[203, 302]]) // 3px < slop
  assert.equal(small.defaultPrevented, false)
  const locked = dispatch('touchmove', [[180, 300]])
  assert.equal(locked.defaultPrevented, true, '锁定到横轴之后才抢')
})

test('纵向为主 → 不锁横轴：不抢事件、不位移、抬手不翻页', () => {
  const p = makePager()
  const dispatch = mount(p.core)
  dispatch('touchstart', [[200, 300]])
  const move = dispatch('touchmove', [[190, 360]]) // |dy| > |dx|
  assert.equal(move.defaultPrevented, false)
  assert.equal(p.views.length, 0, '副轴手势不该产生任何视觉更新')
  dispatch('touchend', [])
  p.clock.flush()
  assert.deepEqual(p.committed, [])
})

test('多指落下不重置手势起点', () => {
  const p = makePager()
  const dispatch = mount(p.core)
  dispatch('touchstart', [[200, 300]])
  dispatch('touchmove', [[180, 300]])
  dispatch('touchstart', [[200, 300], [260, 300]]) // 第二根手指
  dispatch('touchmove', [[100, 300]])
  assert.equal(p.last.offset, -100, '起点若被第二根手指重置，这里会跳变')
})

console.log('\n§4 阈值 / 橡皮筋 / 程序化切页')

test('默认阈值 = max(48, 宽 × 0.22)', () => {
  // 宽 390：阈值 85.8
  const wide = makePager({ width: 390 })
  const wideDispatch = mount(wide.core)
  swipeTo(wideDispatch, -85)
  wideDispatch('touchend', [])
  wide.clock.flush()
  assert.deepEqual(wide.committed, [], '85 < 85.8，不翻')

  const wide2 = makePager({ width: 390 })
  const wide2Dispatch = mount(wide2.core)
  swipeTo(wide2Dispatch, -86)
  wide2Dispatch('touchend', [])
  wide2.clock.flush()
  assert.deepEqual(wide2.committed, [1], '86 > 85.8，翻')

  // 窄容器走 48 这条下限（0.22×100 = 22 太小）。
  const narrow = makePager({ width: 100 })
  const narrowDispatch = mount(narrow.core)
  swipeTo(narrowDispatch, -30)
  narrowDispatch('touchend', [])
  narrow.clock.flush()
  assert.deepEqual(narrow.committed, [], '30 < 48 下限，不翻')
})

test('阈值可配（数值与函数两种写法）', () => {
  const fixed = makePager({ threshold: 10 })
  const fixedDispatch = mount(fixed.core)
  swipeTo(fixedDispatch, -20)
  fixedDispatch('touchend', [])
  fixed.clock.flush()
  assert.deepEqual(fixed.committed, [1])

  const computed = makePager({ threshold: (width) => width / 2 })
  const computedDispatch = mount(computed.core)
  swipeTo(computedDispatch, -180) // 390/2 = 195，不够
  computedDispatch('touchend', [])
  computed.clock.flush()
  assert.deepEqual(computed.committed, [])
})

test('首页往回拖走橡皮筋阻尼（0.28）', () => {
  const p = makePager({ startIndex: 0 })
  const dispatch = mount(p.core)
  swipeTo(dispatch, 100)
  assert.ok(Math.abs(p.last.offset - 28) < 1e-9, `首页回拖应被阻尼到 28，实得 ${p.last.offset}`)
  dispatch('touchend', [])
  p.clock.flush()
  assert.deepEqual(p.committed, [], '首页没有上一页可翻')
})

test('末页往前拖同样阻尼', () => {
  const p = makePager({ startIndex: 2, count: 3 })
  const dispatch = mount(p.core)
  swipeTo(dispatch, -100)
  assert.ok(Math.abs(p.last.offset + 28) < 1e-9)
  dispatch('touchend', [])
  p.clock.flush()
  assert.deepEqual(p.committed, [])
})

test('slideTo：程序化切页走同一条动画后才提交', () => {
  const p = makePager()
  p.core.slideTo(2)
  assert.deepEqual(p.committed, [], '动画期间还没落地')
  assert.equal(p.last.animating, true)
  p.clock.flush()
  assert.deepEqual(p.committed, [2])
})

test('slideTo 越界 / 切到当前页都是空操作', () => {
  const p = makePager()
  p.core.slideTo(0)
  p.core.slideTo(-1)
  p.core.slideTo(3)
  p.clock.flush()
  assert.deepEqual(p.committed, [])
  assert.equal(p.views.length, 0)
})

test('切页动画进行中不接受新手势', () => {
  const p = makePager()
  const dispatch = mount(p.core)
  p.core.slideTo(1)
  swipeTo(dispatch, -300)
  assert.equal(p.core.isActive(), false, '动画中 canStart 应该拦住')
  dispatch('touchend', [])
  p.clock.flush()
  assert.deepEqual(p.committed, [1], '只有 slideTo 那一次落地')
})

console.log('\n§5 轴锁拖拽：左滑露操作 / 下拉刷新形状')

/** 复刻 SwipeRow：横向拖，过一半宽度就停在展开位。 */
function makeSwipeRow() {
  const WIDTH = 88
  const log = []
  let base = 0
  let offset = 0
  const core = createDragGesture({
    axis: 'x',
    onStart: () => { base = offset },
    onDrag: ({ dx }) => { offset = Math.max(-WIDTH, Math.min(0, base + dx)); log.push(['drag', offset]) },
    onEnd: () => { offset = offset < -WIDTH / 2 ? -WIDTH : 0; log.push(['end', offset]) },
    onCancel: () => { offset = 0; log.push(['cancel', offset]) },
  })
  return { core, log, get offset() { return offset } }
}

test('SwipeRow：正常抬手过半 → 停在展开位', () => {
  const row = makeSwipeRow()
  const dispatch = mount(row.core)
  swipeTo(dispatch, -60)
  dispatch('touchend', [])
  assert.equal(row.offset, -88)
  assert.deepEqual(row.log.at(-1), ['end', -88])
})

test('SwipeRow：touchcancel → 弹回原位、不提交、状态复位', () => {
  const row = makeSwipeRow()
  const dispatch = mount(row.core)
  swipeTo(dispatch, -60)
  dispatch('touchcancel', [])
  assert.equal(row.offset, 0, 'cancel 必须弹回，不能卡在半开位')
  assert.deepEqual(row.log.at(-1), ['cancel', 0])
  assert.ok(!row.log.some(([kind]) => kind === 'end'), 'cancel 绝不能走 end 分支')
  assert.equal(row.core.isActive(), false)

  // 下一串无关触摸必须从零开始，而不是接着上一次的基准继续拖。
  dispatch('touchstart', [[500, 300]])
  dispatch('touchmove', [[490, 300]])
  assert.equal(row.offset, -10)
})

/** 复刻 PullRefresh：只看纵向、不判方向锁、不抢事件。 */
function makePullRefresh() {
  const THRESHOLD = 64
  let pull = 0
  let refreshed = 0
  const core = createDragGesture({
    axis: 'y',
    lock: 'none',
    preventDefaultWhenLocked: false,
    onDrag: ({ dy }) => { pull = dy <= 0 ? 0 : Math.min(96, dy * 0.5) },
    onEnd: () => { if (pull >= THRESHOLD) refreshed += 1; pull = 0 },
    onCancel: () => { pull = 0 },
  })
  return { core, get pull() { return pull }, get refreshed() { return refreshed } }
}

test('PullRefresh：拉过阈值抬手 → 刷新一次', () => {
  const pr = makePullRefresh()
  const dispatch = mount(pr.core)
  dispatch('touchstart', [[200, 100]])
  const move = dispatch('touchmove', [[200, 240]]) // dy=140 → pull=70 ≥ 64
  assert.equal(move.defaultPrevented, false, '下拉刷新不抢事件（原有行为）')
  dispatch('touchend', [])
  assert.equal(pr.refreshed, 1)
  assert.equal(pr.pull, 0)
})

test('PullRefresh：touchcancel 绝不触发刷新', () => {
  const pr = makePullRefresh()
  const dispatch = mount(pr.core)
  dispatch('touchstart', [[200, 100]])
  dispatch('touchmove', [[200, 300]]) // 远超阈值
  dispatch('touchcancel', [])
  assert.equal(pr.refreshed, 0, '用户并没有完成这次下拉，那一下属于别的手势')
  assert.equal(pr.pull, 0, '下拉区必须收起')
  assert.equal(pr.core.isActive(), false)
})

test('canStart 为假时整串手势不启动（下拉刷新的 scrollTop 守卫）', () => {
  let allowed = false
  let drags = 0
  const core = createDragGesture({ axis: 'y', lock: 'none', canStart: () => allowed, onDrag: () => { drags += 1 } })
  const dispatch = mount(core)
  dispatch('touchstart', [[200, 100]])
  dispatch('touchmove', [[200, 200]])
  assert.equal(drags, 0)
  allowed = true
  dispatch('touchstart', [[200, 100]])
  dispatch('touchmove', [[200, 200]])
  assert.equal(drags, 1)
})

console.log('\n§6 长按 / 轻点')

function makeLongPress() {
  const log = []
  let queued = null
  const core = createLongPress({
    onLongPress: () => log.push('long'),
    onTap: () => log.push('tap'),
    timers: {
      set: (run) => { queued = run; return 1 },
      clear: () => { queued = null },
    },
  })
  return { core, log, fire: () => { const run = queued; queued = null; if (run) run() }, get armed() { return queued !== null } }
}

test('轻点：没走远、没到时长 → tap', () => {
  const lp = makeLongPress()
  const dispatch = mount(lp.core)
  dispatch('touchstart', [[200, 300]])
  dispatch('touchmove', [[203, 302]])
  dispatch('touchend', [])
  assert.deepEqual(lp.log, ['tap'])
})

test('长按触发后抬手不再补一次 tap', () => {
  const lp = makeLongPress()
  const dispatch = mount(lp.core)
  dispatch('touchstart', [[200, 300]])
  lp.fire()
  dispatch('touchend', [])
  assert.deepEqual(lp.log, ['long'])
})

test('手指走远（滚列表 / 横扫切页）→ 既不长按也不 tap', () => {
  const lp = makeLongPress()
  const dispatch = mount(lp.core)
  dispatch('touchstart', [[200, 300]])
  dispatch('touchmove', [[200, 360]])
  assert.equal(lp.armed, false, '走远就该掐掉长按计时器')
  dispatch('touchend', [])
  assert.deepEqual(lp.log, [])
})

test('touchcancel：掐掉计时器、整串作废，之后的 touchend 也不补 tap', () => {
  const lp = makeLongPress()
  const dispatch = mount(lp.core)
  dispatch('touchstart', [[200, 300]])
  dispatch('touchcancel', [])
  assert.equal(lp.armed, false)
  dispatch('touchend', []) // 现实里不会来，但契约不能靠「它不会来」
  assert.deepEqual(lp.log, [])
})

test('触摸过之后的合成 click 必须被吞掉（否则一次点击算两次）', () => {
  const lp = makeLongPress()
  const dispatch = mount(lp.core)
  dispatch('touchstart', [[200, 300]])
  dispatch('touchend', [])
  lp.core.onClick()
  assert.deepEqual(lp.log, ['tap'], 'iOS 补的那次 click 不能再算一次')
})

test('纯鼠标 / 辅助技术：没触摸过时 click 就是点击', () => {
  const lp = makeLongPress()
  lp.core.onClick()
  assert.deepEqual(lp.log, ['tap'])
})

console.log('\n§7 React 绑定（受控 / 非受控，端到端）')

// 前面几节验的是无 React 的核心。这一节把**真正的 hook** 跑起来，验两件核心测不到的事：
// ① 受控 / 非受控两条路都通；② `touchcancel` 的「不翻页」在 React 这层也成立
//    （核心对了但 hook 把 commit 接错，一样会翻页）。
//
// 没有 jsdom / 渲染器，所以借 React 自己的 dispatcher 槽跑 hook：hook 的调用约定就是
// 「从 ReactCurrentDispatcher.current 取实现」，把它换成下面这份最小实现即可。
// 只服务单组件顺序渲染，不模拟并发与批处理——本节要验的东西都不依赖那些。
const internals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
if (!internals?.ReactCurrentDispatcher) {
  // 这条只在 React 大版本换掉 dispatcher 槽时会响（React 19 起改了内部结构）。
  // **故意判红而不是跳过**：静默少跑一节的代价是「受控/非受控 + cancel 端到端」无人守。
  console.error('  ✗ §7 harness 失效：React 的 ReactCurrentDispatcher 槽不在了（换 React 大版本了？）')
  console.error('    修法：把 mountHook 改成用当前 React 的 hook 调用约定，或改接一个真渲染器。')
  process.exit(1)
}

function sameDeps(a, b) {
  if (!a || !b || a.length !== b.length) return false
  return a.every((v, i) => Object.is(v, b[i]))
}

function mountHook(run) {
  const slots = []
  let cursor = 0
  let result
  const pending = []
  let renders = 0

  const dispatcher = {
    useState(initial) {
      const i = cursor++
      if (slots[i] === undefined) slots[i] = { value: typeof initial === 'function' ? initial() : initial }
      const slot = slots[i]
      return [slot.value, (next) => {
        const value = typeof next === 'function' ? next(slot.value) : next
        if (Object.is(value, slot.value)) return
        slot.value = value
        render()
      }]
    },
    useRef(initial) {
      const i = cursor++
      if (slots[i] === undefined) slots[i] = { current: initial }
      return slots[i]
    },
    useMemo(factory, deps) {
      const i = cursor++
      if (slots[i] === undefined || !sameDeps(slots[i].deps, deps)) slots[i] = { value: factory(), deps }
      return slots[i].value
    },
    useCallback(fn, deps) { return dispatcher.useMemo(() => fn, deps) },
    useEffect(fn, deps) {
      const i = cursor++
      if (slots[i] === undefined || !sameDeps(slots[i].deps, deps)) {
        if (slots[i]?.cleanup) slots[i].cleanup()
        slots[i] = { deps, cleanup: null, run: fn }
        pending.push(slots[i])
      }
    },
  }

  function render() {
    renders += 1
    cursor = 0
    const previous = internals.ReactCurrentDispatcher.current
    internals.ReactCurrentDispatcher.current = dispatcher
    try { result = run() } finally { internals.ReactCurrentDispatcher.current = previous }
    while (pending.length) { const e = pending.shift(); e.cleanup = e.run() || null }
    return result
  }

  render()
  return { get current() { return result }, render, get renders() { return renders } }
}

/** 等一次切页动画落地（hook 用真 setTimeout，测试里把时长压到 10ms）。 */
const settled = () => new Promise((resolve) => { setTimeout(resolve, 40) })

/** 把 hook 的 containerProps 挂到真 EventTarget 上，并塞一个有宽度的假节点。 */
function attach(hook, width = 390) {
  hook.current.containerProps.ref({ clientWidth: width })
  return mount(hook.current.containerProps)
}

const asyncTests = []
function asyncTest(name, run) { asyncTests.push([name, run]) }

asyncTest('受控：翻页经 onIndexChange 回写，页码真值在调用方', async () => {
  const changes = []
  let index = 0
  const hook = mountHook(() =>
    useSwipePager({ count: 3, index, onIndexChange: (next) => { changes.push(next); index = next }, durationMs: 10 }))
  const dispatch = attach(hook)

  swipeTo(dispatch, -120)
  assert.equal(hook.current.offset, -120, '拖动位移应经 hook 透出')
  dispatch('touchend', [])
  await settled()
  assert.deepEqual(changes, [1])

  hook.render() // 调用方把新页码传回来
  assert.equal(hook.current.index, 1)
})

asyncTest('非受控：hook 自己持有页码，不给 index 也能翻', async () => {
  const changes = []
  const hook = mountHook(() =>
    useSwipePager({ count: 3, defaultIndex: 0, onIndexChange: (n) => changes.push(n), durationMs: 10 }))
  const dispatch = attach(hook)

  swipeTo(dispatch, -120)
  dispatch('touchend', [])
  await settled()
  assert.equal(hook.current.index, 1, '非受控时页码由 hook 自己推进')
  assert.deepEqual(changes, [1], '同时仍然通知调用方')
})

asyncTest('⭐ 端到端：hook 上派发 touchcancel → 既不回调也不改页码', async () => {
  const changes = []
  const hook = mountHook(() =>
    useSwipePager({ count: 3, defaultIndex: 0, onIndexChange: (n) => changes.push(n), durationMs: 10 }))
  const dispatch = attach(hook)

  swipeTo(dispatch, -200) // 远超阈值 85.8
  const event = dispatch('touchcancel', [])
  assert.equal(event.type, 'touchcancel')
  await settled()
  assert.deepEqual(changes, [], 'React 这层也不能提交')
  assert.equal(hook.current.index, 0, '页码原地不动')
  assert.equal(hook.current.offset, 0, '回弹到位')
  assert.equal(hook.current.dragging, false)
})

asyncTest('trackStyle 与迁移前逐字一致（三屏轨道约定）', async () => {
  const hook = mountHook(() => useSwipePager({ count: 3, defaultIndex: 0 }))
  const dispatch = attach(hook)
  assert.equal(hook.current.trackStyle.transform, 'translate3d(calc(-100% / 3 + 0px), 0, 0)')
  assert.equal(hook.current.trackStyle.transition, 'none')

  swipeTo(dispatch, -120)
  assert.equal(hook.current.trackStyle.transform, 'translate3d(calc(-100% / 3 + -120px), 0, 0)')
  dispatch('touchend', [])
  assert.equal(
    hook.current.trackStyle.transition,
    'transform 220ms cubic-bezier(0.42, 0, 0.58, 1)',
    '默认时长 220ms、曲线 easeInOut —— 观感不能变',
  )
})

asyncTest('slideTo 身份稳定（否则 useImperativeHandle 每帧重建句柄）', async () => {
  const hook = mountHook(() => useSwipePager({ count: 3, defaultIndex: 0 }))
  const first = hook.current.slideTo
  hook.render()
  hook.render()
  assert.equal(hook.current.slideTo, first)
  assert.equal(hook.current.containerProps, hook.current.containerProps)
})

asyncTest('useDragGesture：handlers 身份稳定，回调始终读最新闭包', async () => {
  let label = 'a'
  const seen = []
  const hook = mountHook(() => useDragGesture({ axis: 'x', onEnd: () => seen.push(label) }))
  const first = hook.current.handlers
  label = 'b'
  hook.render()
  assert.equal(hook.current.handlers, first, 'handlers 不该因重渲染而重建')

  const dispatch = mount(hook.current.handlers)
  swipeTo(dispatch, -50)
  dispatch('touchend', [])
  assert.deepEqual(seen, ['b'], '读到的必须是最新一次渲染的闭包，不是挂载时的快照')
})

const run = async () => {
  for (const [name, body] of asyncTests) {
    try {
      await body()
      passed += 1
      console.log(`  ✓ ${name}`)
    } catch (error) {
      failed += 1
      console.error(`  ✗ ${name}\n    ${error.message}`)
    }
  }
  console.log(`\n${failed === 0 ? '✓' : '✗'} 手势原语：${passed} 通过、${failed} 失败\n`)
  process.exit(failed === 0 ? 0 : 1)
}

run()
