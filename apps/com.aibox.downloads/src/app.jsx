// 下载（com.aibox.downloads）—— 通用下载器。
//
// 根职责：接宿主外壳（tabs / toolbar / menu）→ 订阅 `download.progress` → 渲染队列。
//
// ## 这个应用**不下载任何东西**
//
// 它是一个遥控器。真正的传输跑在宿主的后台 URLSession 上：App 退到后台、被系统杀掉，
// 甚至这个 applet 被关掉，下载都照跑。所以：
//   · 页面里没有任何字节，只有 taskId 和只读元信息；
//   · 关掉再打开靠 `download.list()` 重新接上，而不是靠自己记状态；
//   · 进度走**事件**（`download.subscribe` + `aibox.events`），轮询只作为老宿主的兜底。
//
// 归属由宿主自动绑定成 `applet:com.aibox.downloads`——本应用**说不出**「看别人的任务」这句话，
// 所以「全部暂停」永远只暂停自己的，碰不到视频下载或宿主队列。

import React from 'react'
import { THEME_CSS, C, SPACE } from './components/theme.js'
import { Button, Card, EmptyState, Notice, SectionHeader } from './components/primitives.js'
import Icon from './components/Icon.js'
import TaskRow from './components/TaskRow.js'
import AddSheet from './components/AddSheet.js'
import { capabilities, downloads, onEvent, readClipboard, tap, confirm } from './lib/host.js'
import { addDownloads, registerActions, uiHooks } from './lib/actions.js'

// 无头执行时页面不挂载任何组件——注册必须发生在模块求值期。
registerActions()

const TABS = [
  { id: 'active', title: '进行中', icon: 'arrow.down.circle', selectedIcon: 'arrow.down.circle.fill' },
  { id: 'done', title: '已完成', icon: 'checkmark.circle', selectedIcon: 'checkmark.circle.fill' },
]

const ACTIVE_STATES = ['queued', 'running', 'paused']

function useThemeSetup() {
  React.useEffect(() => {
    if (document.getElementById('__dl_css__')) return
    const style = document.createElement('style')
    style.id = '__dl_css__'
    style.textContent = THEME_CSS
    document.head.appendChild(style)
  }, [])
}

/** 任务表。事件优先、轮询兜底——见文件头。 */
function useTasks() {
  const [tasks, setTasks] = React.useState([])
  const [loaded, setLoaded] = React.useState(false)
  const refresh = React.useCallback(async () => {
    const list = await downloads.list({})
    setTasks(list)
    setLoaded(true)
  }, [])

  React.useEffect(() => {
    let alive = true
    let poll = null
    let off = null
    const boot = async () => {
      await refresh()
      const pushed = await downloads.subscribe()
      if (!alive) return
      // 单条事件就地合并，不整表重拉：10 条并行下载每秒几十帧，整表重拉会把列表打成幻灯片。
      off = onEvent('download.progress', (task) => {
        if (!task || !task.taskId) { refresh(); return }
        setTasks((current) => {
          const index = current.findIndex((t) => t.taskId === task.taskId)
          if (index < 0) return [task, ...current]
          const next = current.slice()
          next[index] = task
          return next
        })
      })
      // 宿主没有事件通道（老宿主）时才轮询。它是兜底，不是主路径。
      if (!pushed) poll = setInterval(refresh, 1200)
    }
    boot()
    return () => {
      alive = false
      if (poll) clearInterval(poll)
      if (off) off()
      downloads.unsubscribe()
    }
  }, [refresh])

  return { tasks, loaded, refresh, setTasks }
}

export default function App() {
  useThemeSetup()
  const [tab, setTab] = React.useState('active')
  const [shell, setShell] = React.useState({ tabsRendered: false, toolbarRendered: false })
  const [adding, setAdding] = React.useState(false)
  const [notice, setNotice] = React.useState(null)
  const [engine, setEngine] = React.useState({ available: true, reason: '' })
  const { tasks, loaded, refresh, setTasks } = useTasks()

  React.useEffect(() => { downloads.availability().then(setEngine) }, [])

  const active = tasks.filter((t) => ACTIVE_STATES.includes(t.state))
  const finished = tasks.filter((t) => !ACTIVE_STATES.includes(t.state))
  const visible = tab === 'active' ? active : finished

  // —— 队列动作 ——

  const control = React.useCallback(async (action, taskId) => {
    tap('light')
    // 乐观更新：桥是异步的，等一趟往返再变按钮态，手感就是「点了没反应」。
    if (taskId) {
      setTasks((current) => current.map((t) => {
        if (t.taskId !== taskId) return t
        if (action === 'pause' && ACTIVE_STATES.includes(t.state)) return { ...t, state: 'paused' }
        if (action === 'resume' && (t.state === 'paused' || t.state === 'failed')) return { ...t, state: 'queued' }
        if (action === 'cancel') return { ...t, state: 'cancelled' }
        return t
      }).filter((t) => !(action === 'remove' && t.taskId === taskId)))
    }
    await downloads.control(action, taskId)
    if (!taskId) await refresh()
  }, [refresh, setTasks])

  const submit = React.useCallback(async (request) => {
    const result = await addDownloads(request)
    setNotice(result.ok
      ? { tone: 'success', text: result.text }
      : { tone: 'error', text: result.error || '入队失败' })
    if (result.ok) { tap('medium'); setTab('active') }
    await refresh()
  }, [refresh])

  // ⋯ 菜单的三个 UI 动作接到页面（无头时它们回落到 lib/actions.js 的纯桥调用）。
  React.useEffect(() => {
    uiHooks.refresh = refresh
    uiHooks.pauseAll = async () => { await control('pause'); return { ok: true, text: '已暂停全部下载。' } }
    uiHooks.resumeAll = async () => { await control('resume'); return { ok: true, text: '已继续全部下载。' } }
    uiHooks.clearFinished = async () => { await control('clearFinished'); return { ok: true, text: '已清空已完成记录。' } }
    return () => { uiHooks.refresh = null; uiHooks.pauseAll = null; uiHooks.resumeAll = null; uiHooks.clearFinished = null }
  }, [control, refresh])

  // —— 宿主外壳接线 ——
  const addRef = React.useRef(null)
  addRef.current = () => setAdding(true)

  React.useEffect(() => {
    let cancelled = false
    const offs = []
    const wire = async () => {
      const api = window.aibox
      if (api && api.tabs && typeof api.tabs.getState === 'function') {
        try {
          const state = await api.tabs.getState()
          if (!cancelled && state && state.rendered) {
            setShell((c) => ({ ...c, tabsRendered: true }))
            if (state.selected) setTab(state.selected)
          }
        } catch (error) { /* 宿主没这能力：留给自绘 TabBar */ }
        if (typeof api.tabs.on === 'function') {
          offs.push(api.tabs.on('changed', (state) => {
            if (!state) return
            // `rendered` 会**在挂载之后翻转**（形态切换会重发 changed），只判一次就会永远多/少一条自绘条。
            const rendered = state.rendered !== false
            setShell((c) => (c.tabsRendered === rendered ? c : { ...c, tabsRendered: rendered }))
            if (state.selected) setTab(state.selected)
          }))
        }
      }
      if (api && api.toolbar && typeof api.toolbar.getState === 'function') {
        try {
          const state = await api.toolbar.getState()
          if (!cancelled && state) setShell((c) => ({ ...c, toolbarRendered: state.rendered !== false }))
        } catch (error) { /* 同上 */ }
        if (typeof api.toolbar.on === 'function') {
          offs.push(api.toolbar.on('invoke', (payload) => {
            if (payload && payload.id === 'add' && addRef.current) addRef.current()
          }))
        }
      }
      // 回到前台时对一次账：后台期间 WebView 挂起收不到事件，但下载一直在跑。
      offs.push(onEvent('lifecycle.foreground', () => { refresh() }))
    }
    wire()
    return () => { cancelled = true; offs.forEach((off) => off && off()) }
  }, [refresh])

  const activeCount = active.length
  const finishedCount = finished.length
  const hasRunning = active.some((t) => t.state === 'running' || t.state === 'queued')
  const hasPaused = active.some((t) => t.state === 'paused')

  React.useEffect(() => {
    const api = window.aibox
    const title = tab === 'active' ? '进行中' : '已完成'
    document.title = title
    if (api && api.navigation && typeof api.navigation.setTitle === 'function') {
      api.navigation.setTitle(title).catch(() => {})
    }
    // 只在宿主真的画了外壳时才发 update：无头运行没有可见容器，这些调用恒回
    // `aibox/not-visible`，把每一轮验收日志染红，掩盖真正的错误。
    if (shell.toolbarRendered && api && api.menu && typeof api.menu.update === 'function') {
      api.menu.update({
        items: {
          pauseAll: { enabled: hasRunning },
          resumeAll: { enabled: hasPaused },
          clearFinished: { enabled: finishedCount > 0 },
        },
      }).catch(() => {})
    }
    if (shell.tabsRendered && api && api.tabs && typeof api.tabs.update === 'function') {
      api.tabs.update({
        items: {
          active: { badge: activeCount ? String(activeCount) : null },
          done: { badge: null },
        },
      }).catch(() => {})
    }
  }, [tab, activeCount, finishedCount, hasRunning, hasPaused, shell.tabsRendered, shell.toolbarRendered])

  // —— 渲染 ——

  if (!engine.available) {
    return (
      <div style={{ padding: SPACE.s4 }}>
        <EmptyState
          icon="exclamationmark.triangle"
          title="下载引擎不可用"
          hint={engine.reason || '这个宿主没有装下载引擎，暂时不能下载任何东西。'}
        />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: shell.tabsRendered ? 0 : 76 }}>
      {!shell.toolbarRendered ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: SPACE.s2,
          padding: `calc(${SPACE.s3}px + env(safe-area-inset-top)) ${SPACE.s4}px ${SPACE.s3}px`,
        }}>
          <span style={{ fontSize: 22, fontWeight: 700 }}>{tab === 'active' ? '进行中' : '已完成'}</span>
          <div style={{ flex: '1 1 auto' }} />
          <Button kind="primary" icon="plus" onClick={() => setAdding(true)}>添加</Button>
        </div>
      ) : null}

      <Notice text={notice && notice.text} tone={notice && notice.tone} onDismiss={() => setNotice(null)} />

      <div style={{ padding: `0 ${SPACE.s4}px ${SPACE.s5}px` }}>
        {!loaded ? null : visible.length === 0 ? (
          <EmptyState
            icon={tab === 'active' ? 'arrow.down.circle' : 'checkmark.circle'}
            title={tab === 'active' ? '没有进行中的下载' : '还没有完成的下载'}
            hint={tab === 'active'
              ? '粘贴任意 http(s) 链接就能开始。下载在后台继续，退出这个小应用也不会中断。'
              : '完成的文件留在宿主侧，可以直接打开或分享。'}
            action={tab === 'active'
              ? <Button kind="primary" icon="plus" onClick={() => setAdding(true)}>添加下载</Button>
              : null}
          />
        ) : (
          <>
            <SectionHeader
              trailing={tab === 'done' && finishedCount ? (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: '清空已完成？',
                      message: '只会清掉列表记录，已经下好的文件不会被删除。',
                      actions: [
                        { id: 'cancel', title: '取消', role: 'cancel' },
                        { id: 'clear', title: '清空', role: 'destructive' },
                      ],
                    })
                    if (ok) control('clearFinished')
                  }}
                  style={{ background: 'none', border: 'none', color: C.brand, fontSize: 13, cursor: 'pointer' }}
                >清空</button>
              ) : null}
            >
              {visible.length} 项
            </SectionHeader>
            <Card padding={0}>
              {visible.map((task, index) => (
                <div key={task.taskId} style={index ? { borderTop: `1px solid ${C.line}` } : undefined}>
                  <TaskRow
                    task={task}
                    onPause={(t) => control('pause', t.taskId)}
                    onResume={(t) => control('resume', t.taskId)}
                    onCancel={(t) => control('cancel', t.taskId)}
                    onRemove={(t) => control('remove', t.taskId)}
                    onOpen={capabilities.openURL ? (t) => downloads.openIn(t.taskId) : null}
                    onShare={capabilities.share ? (t) => downloads.share(t.taskId) : null}
                  />
                </div>
              ))}
            </Card>
          </>
        )}
      </div>

      {!shell.tabsRendered ? (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40,
          display: 'flex', borderTop: `1px solid ${C.line}`, background: C.surface,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {TABS.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => { setTab(row.id); tap('light') }}
              style={{
                flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, padding: '8px 0 6px', background: 'none', border: 'none', cursor: 'pointer',
                color: tab === row.id ? C.brand : C.muted,
              }}
            >
              <Icon name={tab === row.id ? row.selectedIcon : row.icon} size={22} />
              <span style={{ fontSize: 11 }}>{row.title}</span>
            </button>
          ))}
        </div>
      ) : null}

      <AddSheet
        open={adding}
        onClose={() => setAdding(false)}
        onSubmit={submit}
        onPaste={capabilities.clipboard ? readClipboard : null}
      />
    </div>
  )
}
