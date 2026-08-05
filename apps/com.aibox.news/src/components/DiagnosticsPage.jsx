// 资讯诊断（对应 NewsDiagnosticsView）：概览 → 最近一次刷新 → 逐源状态 → 立即刷新 / 清除缓存。

import React from 'react'
import Icon from './Icon.js'
import { Card, Row, SectionFooter, SectionHeader } from './primitives.js'
import { C, SPACE } from './theme.js'
import { bytes, duration, relative } from '../lib/format.js'

const STATUS_META = {
  success: { icon: 'checkmark.circle', color: C.brand, key: 'news.diagnostics.success' },
  empty: { icon: 'minus.circle', color: C.orange, key: 'news.diagnostics.empty' },
  failed: { icon: 'exclamationmark.circle', color: C.danger, key: 'news.diagnostics.failed' },
}

function failureText(state, t) {
  if (!state.failure) return null
  if (state.failure === 'http' && state.httpStatus) return `HTTP ${state.httpStatus}`
  return t(`news.diagnostics.failure.${state.failure}`)
}

export default function DiagnosticsPage({ ctx }) {
  const { agg, t, locale, now } = ctx
  const report = agg.lastReport
  const enabledCount = ctx.store.enabledFeeds.length

  return (
    <div className="news-scroll">
      <SectionHeader>{t('news.diagnostics.overview')}</SectionHeader>
      <Card>
        <Row
          title={t('news.diagnostics.lastUpdate')}
          detail={agg.lastUpdated ? relative(agg.lastUpdated, locale, now) : t('news.diagnostics.never')}
        />
        <Row title={t('news.diagnostics.timelineCount')} detail={agg.timeline.length} />
        <Row title={t('news.diagnostics.enabledSources')} detail={enabledCount} />
        <Row
          title={t('news.diagnostics.clustering')}
          detail={ctx.settings.clustering ? t('news.diagnostics.available') : t('news.diagnostics.disabled')}
        />
        <Row title={t('news.diagnostics.cache')} detail={bytes(ctx.store.contentCacheBytes())} last />
      </Card>

      <SectionHeader>{t('news.diagnostics.lastRun')}</SectionHeader>
      {report ? (
        <>
          <Card>
            <Row title={t('news.diagnostics.duration')} detail={duration((report.finishedAt - report.startedAt) / 1000, t)} />
            <Row title={t('news.diagnostics.fetchDuration')} detail={duration(report.fetchDuration, t)} />
            <Row title={t('news.diagnostics.processingDuration')} detail={duration(report.processingDuration, t)} />
            <Row
              title={t('news.diagnostics.enrichmentDuration')}
              detail={report.enrichmentDuration === null ? '—' : duration(report.enrichmentDuration, t)}
            />
            <Row title={t('news.diagnostics.fetched')} detail={report.fetchedArticleCount} />
            <Row title={t('news.diagnostics.duplicates')} detail={report.duplicateCount} />
            <Row title={t('news.diagnostics.clustered')} detail={report.clusteredArticleCount} />
            <Row
              title={t('news.diagnostics.successSources')}
              detail={report.sourceStates.filter((row) => row.status === 'success').length}
            />
            <Row
              title={t('news.diagnostics.emptySources')}
              detail={report.sourceStates.filter((row) => row.status === 'empty').length}
            />
            <Row
              title={t('news.diagnostics.failedSources')}
              detail={report.sourceStates.filter((row) => row.status === 'failed').length}
              last
            />
          </Card>
          <SectionFooter>{t('news.diagnostics.emptyFooter')}</SectionFooter>
        </>
      ) : (
        <Card><Row title={t('news.diagnostics.noSourceData')} last /></Card>
      )}

      <SectionHeader>{t('news.diagnostics.sources')}</SectionHeader>
      <Card>
        {report && report.sourceStates.length > 0 ? report.sourceStates.map((state, i) => {
          const meta = STATUS_META[state.status] || STATUS_META.failed
          const failure = failureText(state, t)
          return (
            <div
              key={`${state.id}-${state.sourceName}`}
              style={{
                display: 'flex', alignItems: 'center', gap: SPACE.s3,
                padding: `10px ${SPACE.s4}px`,
                borderBottom: i === report.sourceStates.length - 1 ? 'none' : `0.5px solid ${C.line}`,
              }}
            >
              <Icon name={meta.icon} size={16} color={meta.color} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 auto', minWidth: 0 }}>
                <span className="news-clamp-1" style={{ fontSize: 15, color: C.ink }}>{state.sourceName}</span>
                <span className="news-mono" style={{ fontSize: 12, color: C.muted }}>
                  {t('news.diagnostics.sourceDetail', state.itemCount, duration(state.duration, t))}
                </span>
                {failure ? <span style={{ fontSize: 12, color: C.danger }}>{failure}</span> : null}
              </span>
              <span style={{ fontSize: 13, color: meta.color, flex: '0 0 auto' }}>{t(meta.key)}</span>
            </div>
          )
        }) : (
          <Row title={t('news.diagnostics.noSourceData')} last />
        )}
      </Card>

      <div style={{ height: SPACE.s5 }} />
      <Card>
        <Row
          icon="arrow.clockwise"
          iconColor={C.brand}
          title={t('news.diagnostics.refreshNow')}
          onClick={() => ctx.actions.refresh(true)}
          accessory={null}
        />
        <Row
          icon="trash"
          iconColor={C.danger}
          title={t('news.subs.cache.clear')}
          danger
          onClick={() => ctx.actions.clearContentCache()}
          accessory={null}
          last
        />
      </Card>
      <div style={{ height: 32 }} />
    </div>
  )
}
