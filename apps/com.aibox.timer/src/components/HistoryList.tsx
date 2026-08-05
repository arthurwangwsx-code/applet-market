import { List } from 'antd-mobile';
import type { Session } from '../lib/timer.js';
import { formatDuration } from '../lib/timer.js';

interface HistoryListProps {
  sessions: Session[];
  locale: string;
}

/** 历史记录。空态是**一等状态**，不是「列表恰好没有行」——它要解释下一步做什么。 */
export function HistoryList({ sessions, locale }: HistoryListProps) {
  if (sessions.length === 0) {
    return (
      <div className="ax-muted" style={{ padding: '32px 16px', textAlign: 'center', fontSize: 14 }}>
        还没有记录。计完一段就会出现在这里。
      </div>
    );
  }

  const time = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <List header={`最近 ${sessions.length} 段`}>
      {sessions.map((session) => (
        <List.Item
          key={session.id}
          description={time.format(new Date(session.finishedAt))}
          extra={
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatDuration(session.actualSeconds)}
            </span>
          }
        >
          {session.label}
          {!session.completed && <span className="ax-muted" style={{ marginLeft: 6, fontSize: 12 }}>（中断）</span>}
        </List.Item>
      ))}
    </List>
  );
}
