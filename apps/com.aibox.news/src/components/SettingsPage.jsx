// 新闻设置（对应 NewsSettingsView）：4 段 + 高级设置。

import React from 'react'
import PickerRow from './OptionPicker.js'
import { Card, Row, SectionFooter, SectionHeader, Toggle } from './primitives.js'
import { C, SPACE } from './theme.js'
import { bytes } from '../lib/format.js'

const inputStyle = {
  flex: '1 1 auto', minWidth: 0, border: 0, outline: 'none', background: 'transparent',
  font: 'inherit', fontSize: 15, color: 'var(--news-ink)', textAlign: 'right',
}

function TextRow({ icon, title, value, onChange, placeholder, type, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: SPACE.s3,
      padding: `11px ${SPACE.s4}px`, minHeight: 44,
      borderBottom: last ? 'none' : `0.5px solid ${C.line}`,
    }}
    >
      <span style={{ fontSize: 15, color: C.ink, flex: '0 0 auto' }}>{title}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type || 'text'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        style={inputStyle}
      />
    </div>
  )
}

export default function SettingsPage({ ctx }) {
  const s = ctx.settings
  const set = ctx.actions.updateSettings
  const cacheBytes = ctx.store.contentCacheBytes()

  return (
    <div className="news-scroll">
      <SectionHeader>{ctx.t('news.settings.readingDisplay')}</SectionHeader>
      <Card>
        <PickerRow
          icon="doc.richtext"
          title={ctx.t('news.subs.openMode')}
          value={s.openMode}
          options={[
            { value: 'auto', label: ctx.t('news.openMode.auto') },
            { value: 'reader', label: ctx.t('news.openMode.reader') },
            { value: 'web', label: ctx.t('news.openMode.web') },
          ]}
          onChange={(value) => set({ openMode: value })}
          cancelLabel={ctx.t('news.action.cancel')}
        />
        <Row
          icon="rectangle.stack"
          title={ctx.t('news.settings.collapseClusters')}
          accessory={<Toggle checked={s.collapseClusters} onChange={(v) => set({ collapseClusters: v })} label={ctx.t('news.settings.collapseClusters')} />}
        />
        <Row
          icon="waveform.path.ecg"
          title={ctx.t('news.settings.showStatus')}
          accessory={<Toggle checked={s.showRefreshStatus} onChange={(v) => set({ showRefreshStatus: v })} label={ctx.t('news.settings.showStatus')} />}
        />
        <Row
          icon="eye.slash"
          title={ctx.t('news.subs.hideRead')}
          accessory={<Toggle checked={s.hideRead} onChange={(v) => set({ hideRead: v })} label={ctx.t('news.subs.hideRead')} />}
          last
        />
      </Card>

      <SectionHeader>{ctx.t('news.settings.refreshPerformance')}</SectionHeader>
      <Card>
        <Row
          icon="arrow.clockwise"
          title={ctx.t('news.subs.autoRefresh')}
          accessory={<Toggle checked={s.autoRefresh} onChange={(v) => set({ autoRefresh: v })} label={ctx.t('news.subs.autoRefresh')} />}
        />
        <Row
          icon="moon.zzz"
          title={ctx.t('news.subs.bgRefresh')}
          accessory={<Toggle checked={s.backgroundRefresh} onChange={(v) => set({ backgroundRefresh: v })} label={ctx.t('news.subs.bgRefresh')} />}
        />
        <Row
          icon="battery.25"
          title={ctx.t('news.settings.pauseLowPower')}
          accessory={<Toggle checked={s.pauseInLowPower} onChange={(v) => set({ pauseInLowPower: v })} label={ctx.t('news.settings.pauseLowPower')} />}
        />
        <Row
          icon="rectangle.3.group"
          title={ctx.t('news.settings.clustering')}
          accessory={<Toggle checked={s.clustering} onChange={(v) => set({ clustering: v })} label={ctx.t('news.settings.clustering')} />}
        />
        <Row
          icon="arrow.down.doc"
          title={ctx.t('news.settings.prefetch')}
          accessory={<Toggle checked={s.prefetch} onChange={(v) => set({ prefetch: v })} label={ctx.t('news.settings.prefetch')} />}
        />
        <PickerRow
          icon="doc.on.doc"
          title={ctx.t('news.settings.prefetchCount')}
          value={s.prefetchCount}
          disabled={!s.prefetch}
          options={[0, 6, 12, 20, 30].map((value) => ({ value, label: String(value) }))}
          onChange={(value) => set({ prefetchCount: value })}
          cancelLabel={ctx.t('news.action.cancel')}
        />
        <PickerRow
          icon="list.number"
          title={ctx.t('news.settings.timelineLimit')}
          value={s.timelineLimit}
          options={[100, 200, 300].map((value) => ({ value, label: String(value) }))}
          onChange={(value) => set({ timelineLimit: value })}
          cancelLabel={ctx.t('news.action.cancel')}
          last
        />
      </Card>
      <SectionFooter>{ctx.t('news.settings.performanceFooter')}</SectionFooter>

      <SectionHeader>{ctx.t('news.subs.cache')}</SectionHeader>
      <Card>
        <Row
          icon="internaldrive"
          title={ctx.t('news.subs.cache')}
          detail={bytes(cacheBytes)}
          accessory={(
            <button
              type="button"
              className="news-btn news-press"
              onClick={() => ctx.actions.clearContentCache()}
              style={{ color: C.brand, fontSize: 15, padding: '4px 2px' }}
            >
              {ctx.t('news.subs.cache.clear')}
            </button>
          )}
        />
        <PickerRow
          icon="internaldrive"
          title={ctx.t('news.subs.cacheLimit')}
          value={s.cacheLimitMB}
          options={[20, 50, 100, 200].map((value) => ({ value, label: `${value} MB` }))}
          onChange={(value) => set({ cacheLimitMB: value })}
          cancelLabel={ctx.t('news.action.cancel')}
          last
        />
      </Card>

      <div style={{ height: SPACE.s5 }} />
      <Card>
        <Row
          icon="stethoscope"
          iconColor={C.brand}
          title={ctx.t('news.diagnostics.title')}
          onClick={() => ctx.actions.navigate({ name: 'diagnostics' })}
          last={!ctx.hasAI}
        />
        {ctx.hasAI ? (
          <Row
            icon="sun.max"
            iconColor={C.brand}
            title={ctx.t('news.digest.setup')}
            onClick={() => ctx.actions.askAI(ctx.t('news.digest.seed'))}
            last
          />
        ) : null}
      </Card>

      <SectionHeader>{ctx.t('news.subs.advanced')}</SectionHeader>
      <Card>
        <TextRow
          title={ctx.t('news.subs.rsshub')}
          value={s.rsshubInstance}
          onChange={(value) => set({ rsshubInstance: value })}
          placeholder="https://rsshub.app"
        />
        <TextRow
          title={ctx.t('news.subs.apikey')}
          value={s.newsAPIKey}
          onChange={(value) => set({ newsAPIKey: value })}
          type="password"
        />
        <TextRow
          title={ctx.t('news.subs.language')}
          value={s.searchLanguage}
          onChange={(value) => set({ searchLanguage: value })}
          placeholder="zh"
          last
        />
      </Card>
      <SectionFooter>{ctx.t('news.subs.settings.footer')}</SectionFooter>
      <div style={{ height: 32 }} />
    </div>
  )
}
