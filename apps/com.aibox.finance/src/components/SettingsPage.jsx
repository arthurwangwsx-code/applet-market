// 设置页 —— 规格 §12「设置」段。
//
// 通知开关的 footer **如实说明降级**：这个容器只有 `notifications.schedule`，
// 没有后台唤醒，所以到价提醒只在 App 活跃、正在刷新行情时才会推。
// iCloud 自选同步在容器里没有对应能力 → 整块不渲染（不留一个点了没反应的开关）。

import React from 'react'
import { Card, Row, Segmented, Sheet, SheetHeader, Toggle } from './primitives.js'
import { C, SPACE } from './theme.js'
import { capabilities } from '../lib/host.js'

const INTERVALS = [15, 30, 60, 120]
const SOURCES = ['automatic', 'tencent', 'sina']

export default function SettingsPage({ ctx }) {
  const { t, store, settings, actions } = ctx
  const set = (patch) => store.updateSettings(patch)

  return (
    <div className="fin-scroll">
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.s4, padding: SPACE.s4 }}>
        <Card title={t('finance.settings.colorSection')}>
          <Row
            title={t('finance.settings.color')}
            last
            accessory={(
              <div style={{ width: 190 }}>
                <Segmented
                  value={settings.upIsRed ? 'red' : 'green'}
                  onChange={(next) => set({ upIsRed: next === 'red' })}
                  items={[
                    { id: 'red', label: t('finance.settings.redUp') },
                    { id: 'green', label: t('finance.settings.greenUp') },
                  ]}
                />
              </div>
            )}
          />
          <div style={{ display: 'flex', gap: SPACE.s4, paddingTop: SPACE.s3 }}>
            <span className="fin-mono" style={{ fontSize: 13, color: settings.upIsRed ? C.red : C.green }}>
              {t('finance.settings.up')} +1.23%
            </span>
            <span className="fin-mono" style={{ fontSize: 13, color: settings.upIsRed ? C.green : C.red }}>
              {t('finance.settings.down')} -1.23%
            </span>
            <span className="fin-mono" style={{ fontSize: 13, color: C.muted }}>0.00%</span>
          </div>
        </Card>

        <Card title={t('finance.settings.refreshSection')}>
          <Row
            title={t('finance.settings.autoRefresh')}
            accessory={(
              <Toggle
                checked={settings.autoRefresh}
                onChange={(next) => set({ autoRefresh: next })}
                label={t('finance.settings.autoRefresh')}
              />
            )}
          />
          <Row
            title={t('finance.settings.refreshInterval')}
            accessory={(
              <div style={{ width: 190 }}>
                <Segmented
                  value={String(settings.refreshInterval)}
                  onChange={(next) => set({ refreshInterval: Number(next) })}
                  items={INTERVALS.map((value) => ({ id: String(value), label: t('finance.settings.seconds', value) }))}
                />
              </div>
            )}
          />
          <Row
            title={t('finance.settings.quoteSource')}
            accessory={(
              <div style={{ width: 190 }}>
                <Segmented
                  value={settings.quoteSource}
                  onChange={(next) => set({ quoteSource: next })}
                  items={SOURCES.map((id) => ({
                    id,
                    label: id === 'automatic' ? t('finance.settings.sourceAuto') : (id === 'sina' ? 'Sina' : 'Tencent'),
                  }))}
                />
              </div>
            )}
          />
          <Row
            title={t('finance.settings.industryRefresh')}
            last
            accessory={(
              <Toggle
                checked={settings.industryAutoRefresh}
                onChange={(next) => set({ industryAutoRefresh: next })}
                label={t('finance.settings.industryRefresh')}
              />
            )}
          />
          <span style={{ display: 'block', fontSize: 12, color: C.muted, lineHeight: 1.45, paddingTop: SPACE.s2 }}>
            {t('finance.settings.refreshFoot')}
          </span>
        </Card>

        {/* 没有通知能力就整块不渲染——留一个点了没反应的开关比没有更糟。 */}
        {capabilities.notifications ? (
          <Card title={t('finance.settings.notifySection')}>
            <Row
              title={t('finance.settings.notify')}
              last
              accessory={(
                <Toggle
                  checked={settings.notifyAlerts}
                  onChange={(next) => set({ notifyAlerts: next })}
                  label={t('finance.settings.notify')}
                />
              )}
            />
            <span style={{ display: 'block', fontSize: 12, color: C.muted, lineHeight: 1.45, paddingTop: SPACE.s2 }}>
              {t('finance.settings.notifyFoot')}
            </span>
          </Card>
        ) : null}

        <Card title={t('finance.settings.manage')}>
          <Row title={t('finance.account.manage')} onClick={actions.openAccounts} />
          <Row title={t('finance.groups.title')} onClick={actions.openGroups} last />
        </Card>

        <Card title={t('finance.storage.title')}>
          <Row
            title={store.storageHealthy ? t('finance.storage.title') : t('finance.storage.degraded')}
            detail={store.storageHealthy ? 'OK' : '—'}
            detailColor={store.storageHealthy ? C.muted : C.danger}
            last
          />
        </Card>

        <Card title={t('finance.settings.about')}>
          <span style={{ display: 'block', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
            {t('finance.settings.dataSource')}
          </span>
          <span style={{ display: 'block', fontSize: 13, color: C.muted, lineHeight: 1.5, paddingTop: 4 }}>
            {t('finance.settings.disclaimer')}
          </span>
        </Card>

        <div style={{ height: SPACE.s6 }} />
      </div>
    </div>
  )
}

/** 自选分组管理（设置 → 管理 → 自选分组）。 */
export function GroupsSheet({ ctx, visible, onClose }) {
  const { t, store } = ctx
  const [name, setName] = React.useState('')

  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetHeader title={t('finance.groups.title')} onClose={onClose} closeLabel={t('finance.done')} />
      <div className="fin-scroll" style={{ padding: SPACE.s4, display: 'flex', flexDirection: 'column', gap: SPACE.s4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.s2 }}>
          <input
            className="fin-field"
            style={{ background: C.surface, borderRadius: 10, padding: '10px 12px', fontSize: 15 }}
            value={name}
            placeholder={t('finance.groups.name')}
            onChange={(event) => setName(event.target.value)}
          />
          <button
            type="button"
            className="fin-btn fin-press"
            disabled={!name.trim()}
            onClick={() => { store.createGroup(name.trim()); setName('') }}
            style={{ color: C.brand, fontSize: 15, opacity: name.trim() ? 1 : 0.4, flex: '0 0 auto' }}
          >
            {t('finance.groups.add')}
          </button>
        </div>
        <Card>
          {store.groups.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((row, index, all) => (
            <Row
              key={row.id}
              title={row.name.startsWith('group.') ? t(row.name) : row.name}
              subtitle={row.isDefault ? t('finance.groups.default') : null}
              detail={store.items.filter((item) => item.groupID === row.id).length}
              last={index === all.length - 1}
              accessory={row.isDefault ? undefined : (
                <button
                  type="button"
                  className="fin-btn fin-press"
                  onClick={() => store.deleteGroup(row.id)}
                  style={{ color: C.danger, fontSize: 13 }}
                >
                  {t('finance.delete')}
                </button>
              )}
            />
          ))}
        </Card>
      </div>
    </Sheet>
  )
}
