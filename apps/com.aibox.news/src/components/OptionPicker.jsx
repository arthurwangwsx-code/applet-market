// 选项行（对应 SwiftUI 的 Picker）：点开底部面板选一个。设置页与添加订阅源表单共用。

import React from 'react'
import Icon from './Icon.js'
import { Row, Sheet } from './primitives.js'
import { C, SPACE } from './theme.js'

export default function PickerRow({ icon, title, value, options, onChange, disabled, last, cancelLabel }) {
  const [open, setOpen] = React.useState(false)
  const selected = options.find((option) => option.value === value)
  return (
    <>
      <Row
        icon={icon}
        title={title}
        detail={selected ? selected.label : ''}
        accessory={<Icon name="chevron.down" size={12} color={disabled ? C.line : C.muted} />}
        onClick={disabled ? undefined : () => setOpen(true)}
        last={last}
      />
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <div style={{ padding: `${SPACE.s4}px ${SPACE.s4}px ${SPACE.s2}px`, fontSize: 13, color: C.muted }}>{title}</div>
        {options.map((option, i) => (
          <button
            key={String(option.value)}
            type="button"
            className="news-btn news-press"
            onClick={() => { setOpen(false); onChange(option.value) }}
            style={{
              display: 'flex', alignItems: 'center', gap: SPACE.s3, width: '100%',
              padding: `13px ${SPACE.s4}px`, fontSize: 16, color: C.ink,
              borderTop: `0.5px solid ${C.line}`,
              borderBottom: i === options.length - 1 ? `0.5px solid ${C.line}` : 'none',
            }}
          >
            <span style={{ flex: '1 1 auto' }}>{option.label}</span>
            {option.value === value ? <Icon name="checkmark" size={16} color={C.brand} /> : null}
          </button>
        ))}
        {cancelLabel ? (
          <button
            type="button"
            className="news-btn news-press"
            onClick={() => setOpen(false)}
            style={{ display: 'block', width: '100%', padding: `14px ${SPACE.s4}px`, color: C.brand, fontSize: 16, textAlign: 'center' }}
          >
            {cancelLabel}
          </button>
        ) : null}
      </Sheet>
    </>
  )
}
