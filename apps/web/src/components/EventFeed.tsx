import type { TrialEvent } from '../types';

const EVENT_TYPE_ROW_CLASS: Record<string, string> = {
  evidence_reveal: 'event-row--evidence',
  system: 'event-row--system',
};

const EVENT_TYPE_LABEL: Record<string, string> = {
  statement: 'تصريح',
  evidence_reveal: 'كشف دليل',
  question: 'سؤال',
  objection: 'اعتراض',
  system: 'النظام',
};

export function EventFeed({ events }: { events: TrialEvent[] }) {
  if (events.length === 0) {
    return <p className="center-note">لم تبدأ أي أحداث بعد — أول من يتكلم يظهر هنا.</p>;
  }

  return (
    <div className="event-feed">
      {events.map((ev) => (
        <div key={ev.id} className={`event-row ${EVENT_TYPE_ROW_CLASS[ev.eventType] ?? ''}`}>
          <div className="event-row__meta">{EVENT_TYPE_LABEL[ev.eventType] ?? ev.eventType}</div>
          <div>{ev.content}</div>
        </div>
      ))}
    </div>
  );
}
