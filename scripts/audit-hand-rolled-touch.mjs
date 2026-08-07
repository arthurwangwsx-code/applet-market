#!/usr/bin/env node
//
//  audit-hand-rolled-touch.mjs
//  手搓触摸手势闸门：`apps/*/src/**` 里不得出现裸 `onTouch*` / `addEventListener('touch…')`。
//
//  ## 为什么要这条闸门
//  `touchcancel` 只有**原生手势识别器抢走这串触摸**时才发（宿主的退出手势、页栈返回、系统接管）。
//  纯 Web 环境几乎触发不到——**在浏览器里写、在浏览器里测，永远测不出来**。
//  2026-08-06 实测：市场里两个应用各自手搓了横扫 / 滑动手势，两个都把它写错，**错法还相反**：
//    · 资讯 `Pager.jsx`：`onTouchCancel={onTouchEnd}` —— cancel 走完阈值判定并提交，
//      凭空翻一页用户没打算翻的页；
//    · 理财 `primitives.jsx`：根本没接 cancel —— `active` 永不复位、`startX` 停在旧值，
//      行卡在半开位，下一次无关触摸接着上一次的基准继续拖。
//  根因不是两个人粗心，是**缺少可供性**：SDK 里当时没有任何手势原语，想做只能手搓，谁写都会漏。
//
//  所以补原语（`@aibox/applet-sdk/react` 的 `useSwipePager` / `useDragGesture` / `useLongPress`）
//  只是一半；另一半是这条闸门——**没有闸门的共享基建，下一个人照样手搓一份**。
//  本仓已经数出八个「基建在、没人用」，其中一个正是「手搓基建检测器自己没挂闸门」。
//
//  ## 这条闸门查什么
//  只查**手写源**（`apps/*/src/`）。`dist/` 是产物、`releases/` 是历史包，都不算。
//  注释里提到 `onTouch*` 不算违规（迁移后的文件头正需要解释这条规矩）。
//
//  ## 用法
//    node scripts/audit-hand-rolled-touch.mjs            # 退出码 1 = 有人又手搓了
//    node scripts/audit-hand-rolled-touch.mjs --report   # 只看报告，不判红
//

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const APPS = path.join(ROOT, 'apps')
const REPORT_ONLY = process.argv.includes('--report')

const CODE_EXT = /\.(mjs|cjs|jsx?|tsx?)$/

/** 违规形态。注释已经在 `stripComments` 里去掉了，这里不用再排除。 */
const PATTERNS = [
  { re: /\bonTouch(?:Start|Move|End|Cancel)\b/g, what: 'JSX 上的裸 onTouch* 处理器' },
  { re: /addEventListener\(\s*['"`]touch(?:start|move|end|cancel)['"`]/g, what: "addEventListener('touch…')" },
]

/**
 * 去掉注释，保留行数（换成等长空白），这样报错行号仍然准。
 *
 * 不是完整的 JS 解析器：字符串里的 `//` 会被误判成注释开头。对本闸门无害——
 * 误删的只可能是字符串内容，而字符串内容里出现 `onTouchStart` 本来也不是违规。
 */
function stripComments(source) {
  let out = ''
  let mode = 'code' // code | line | block | single | double | template
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i]
    const next = source[i + 1]
    if (mode === 'code') {
      if (c === '/' && next === '/') {
        mode = 'line'
        out += '  '
        i += 1
        continue
      }
      if (c === '/' && next === '*') {
        mode = 'block'
        out += '  '
        i += 1
        continue
      }
      if (c === "'") mode = 'single'
      else if (c === '"') mode = 'double'
      else if (c === '`') mode = 'template'
      out += c
      continue
    }
    if (mode === 'line') {
      if (c === '\n') {
        mode = 'code'
        out += c
      } else out += ' '
      continue
    }
    if (mode === 'block') {
      if (c === '*' && next === '/') {
        mode = 'code'
        out += '  '
        i += 1
      } else out += c === '\n' ? c : ' '
      continue
    }
    // 字符串内部：只管找到闭合，顺带跳过转义。
    out += c
    if (c === '\\') {
      out += source[i + 1] ?? ''
      i += 1
      continue
    }
    if ((mode === 'single' && c === "'") || (mode === 'double' && c === '"') || (mode === 'template' && c === '`')) {
      // 开引号本身也会走到这里；用长度判断是否是闭合的那一个。
      if (out.length > 1) mode = 'code'
    }
  }
  return out
}

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.isDirectory()) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (CODE_EXT.test(entry.name)) out.push(full)
  }
  return out
}

const violations = []
const apps = fs.existsSync(APPS) ? fs.readdirSync(APPS).sort() : []
let scanned = 0

for (const app of apps) {
  const src = path.join(APPS, app, 'src')
  for (const file of walk(src)) {
    scanned += 1
    const code = stripComments(fs.readFileSync(file, 'utf8'))
    const lines = code.split('\n')
    for (const { re, what } of PATTERNS) {
      lines.forEach((line, i) => {
        re.lastIndex = 0
        if (re.test(line)) {
          violations.push({ file: path.relative(ROOT, file), line: i + 1, what, text: line.trim().slice(0, 90) })
        }
      })
    }
  }
}

console.log(`扫描 ${scanned} 个手写源文件（apps/*/src/），发现 ${violations.length} 处手搓触摸处理。`)

if (violations.length) {
  console.error('')
  console.error('❌ 手写源里不允许裸接触摸事件：')
  for (const v of violations) {
    console.error(`   · ${v.file}:${v.line}  ${v.what}`)
    console.error(`     ${v.text}`)
  }
  console.error('')
  console.error('改用 SDK 原语（@aibox/applet-sdk/react）：')
  console.error('   · 横扫分页          → useSwipePager({ count, index, onIndexChange })')
  console.error("   · 左滑露出操作      → useDragGesture({ axis: 'x', onDrag, onEnd, onCancel })")
  console.error("   · 下拉刷新          → useDragGesture({ axis: 'y', lock: 'none', canStart, … })")
  console.error('   · 长按 / 轻点        → useLongPress({ onLongPress, onTap })')
  console.error('')
  console.error('为什么不让手搓：`touchcancel` 只有原生手势抢走触摸时才发，浏览器里测不出来。')
  console.error('实测两个应用各自手搓、各自写错，错法还相反（当成 end 直接误提交 / 干脆不接、状态永不复位）。')
  console.error('原语把「cancel = 放弃」写死在里面，并有直接派发合成 touchcancel 的单测守着：')
  console.error('   node packages/aibox-sdk/tests/gestures.test.mjs')
  if (!REPORT_ONLY) process.exit(1)
} else {
  console.log('✓ 没有手搓的触摸处理 —— 手势一律走 SDK 原语。')
}
