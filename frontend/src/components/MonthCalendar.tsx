import { useState } from 'react';
import type { CalendarColumnUser, EventItem } from '../types';

type Props = {
  selectedDate: string;
  selectedUsers: CalendarColumnUser[];
  events: EventItem[];
  getUserColor: (userId: string, fallbackIndex?: number) => string;
  onSelectDate: (date: string) => void;
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLocalDateKey(dateString: string) {
  return toDateKey(new Date(dateString));
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MonthCalendar({
  selectedDate,
  selectedUsers,
  events,
  getUserColor,
  onSelectDate,
}: Props) {
  const [tooltip, setTooltip] = useState<{ date: string; x: number; y: number } | null>(null);

  const cursor = new Date(`${selectedDate}T12:00:00`);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<string | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toDateKey(new Date(year, month, day, 12, 0, 0)));
  }

  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const getEventsForDay = (date: string) =>
    events
      .filter(
        (e) =>
          e.status !== 'cancelled' &&
          e.status !== 'needs_reschedule' &&
          toLocalDateKey(e.startAt) === date &&
          selectedUsers.some((u) => u.id === e.ownerUserId)
      )
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const tooltipEvents = tooltip ? getEventsForDay(tooltip.date) : [];

  return (
    <div className="panel" style={{ position: 'relative' }}>
      <div className="month-grid weekdays">
        {weekdays.map((w) => (
          <div key={w} className="month-weekday">{w}</div>
        ))}
      </div>

      <div className="month-grid">
        {cells.map((date, idx) =>
          date ? (
            <button
              key={date}
              className={`month-cell ${date === selectedDate ? 'active' : ''}`}
              onClick={() => onSelectDate(date)}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const container = e.currentTarget.closest('.panel')!.getBoundingClientRect();
                setTooltip({
                  date,
                  x: rect.left - container.left,
                  y: rect.bottom - container.top + 4,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <div className="month-cell-day">{new Date(`${date}T12:00:00`).getDate()}</div>

              <div className="month-events">
                {selectedUsers.slice(0, 4).map((user, userIndex) => {
                  const count = events.filter(
                    (e) =>
                      e.ownerUserId === user.id &&
                      e.status !== 'needs_reschedule' &&
                      e.status !== 'cancelled' &&
                      toLocalDateKey(e.startAt) === date
                  ).length;

                  if (!count) return null;

                  return (
                    <div key={user.id} className="month-event-line">
                      <span
                        className="month-event-dot"
                        style={{ background: getUserColor(user.id, userIndex) }}
                      />
                      <span>{user.name}: {count}</span>
                    </div>
                  );
                })}
              </div>
            </button>
          ) : (
            <div key={`empty-${idx}`} className="month-cell empty" />
          )
        )}
      </div>

      {tooltip && tooltipEvents.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 14px',
            zIndex: 200,
            minWidth: 210,
            maxWidth: 300,
            pointerEvents: 'none',
            boxShadow: '0 6px 20px rgba(0,0,0,0.22)',
            fontSize: 12,
            opacity: 1,
          }}
        >
          {tooltipEvents.map((ev) => {
            const userIndex = selectedUsers.findIndex((u) => u.id === ev.ownerUserId);
            const color = getUserColor(ev.ownerUserId, userIndex >= 0 ? userIndex : 0);
            return (
              <div key={ev.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 5 }}>
                <span
                  style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                    background: color, flexShrink: 0, marginTop: 3,
                  }}
                />
                <span>
                  <span style={{ color: 'var(--muted)', marginRight: 4 }}>
                    {formatTime(ev.startAt)}–{formatTime(ev.endAt)}
                  </span>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                    {ev.emoji ? `${ev.emoji} ` : ''}{ev.title}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
