import { useEffect, useMemo, useState } from 'react';
import type { CalendarColumnUser, EventItem } from '../types';

type Props = {
  selectedUsers: CalendarColumnUser[];
  events: EventItem[];
  currentUserId: string;
  visibleDates: string[];
  onEmptySlotClick: (payload: { ownerUserId: string; startAt: string; endAt: string }) => void;
  onEventClick: (event: EventItem) => void;
  getUserColor: (userId: string, fallbackIndex?: number) => string;
};

const HOUR_HEIGHT = 64;
const TOTAL_HEIGHT = 24 * HOUR_HEIGHT;

function toLocalDateKey(dateString: string) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getMinutesFromDayStart(dateString: string) {
  const date = new Date(dateString);
  return date.getHours() * 60 + date.getMinutes();
}

function getEventStyle(event: EventItem) {
  const startMinutes = getMinutesFromDayStart(event.startAt);
  const endMinutes = getMinutesFromDayStart(event.endAt);

  const top = (startMinutes / 60) * HOUR_HEIGHT;
  const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 28);

  return { top, height };
}

function getDateTimeLocal(dateString: string, hours: number, minutes: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function formatHeaderDate(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString([], {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

function getCurrentTimeLineTop(dateString: string) {
  const now = new Date();
  if (toLocalDateKey(now.toISOString()) !== dateString) return null;

  const minutes = now.getHours() * 60 + now.getMinutes();
  return (minutes / 60) * HOUR_HEIGHT;
}

export function TimeGridCalendar({
  selectedUsers,
  events,
  currentUserId,
  visibleDates,
  onEmptySlotClick,
  onEventClick,
  getUserColor,
}: Props) {
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const columns = useMemo(
    () =>
      visibleDates.flatMap((date) =>
        selectedUsers.map((user, index) => ({
          key: `${date}-${user.id}`,
          date,
          user,
          color: getUserColor(user.id, index),
        }))
      ),
    [visibleDates, selectedUsers, getUserColor]
  );

  const filteredEvents = events.filter(
    (event) =>
      visibleDates.includes(toLocalDateKey(event.startAt)) &&
      event.status !== 'needs_reschedule' &&
      event.status !== 'cancelled'
  );

  return (
    <div className="calendar-shell">
      <div
        className="calendar-header-grid"
        style={{
          gridTemplateColumns: `72px repeat(${columns.length || 1}, minmax(180px, 1fr))`,
        }}
      >
        <div className="calendar-header-cell">Время</div>

        {columns.map((column) => (
          <div key={column.key} className="calendar-header-cell">
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
              {formatHeaderDate(column.date)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: column.color,
                  display: 'inline-block',
                }}
              />
              {column.user.name}
            </div>
          </div>
        ))}
      </div>

      <div
        className="calendar-body-grid"
        style={{
          gridTemplateColumns: `72px repeat(${columns.length || 1}, minmax(180px, 1fr))`,
        }}
      >
        <div className="calendar-time-column" style={{ height: TOTAL_HEIGHT }}>
          {hours.map((hour) => (
            <div
              key={hour}
              style={{
                position: 'absolute',
                top: hour * HOUR_HEIGHT - 10,
                left: 8,
                fontSize: 12,
                color: 'var(--muted)',
              }}
            >
              {String(hour).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {columns.map((column) => {
          const userEvents = filteredEvents.filter(
            (event) =>
              event.ownerUserId === column.user.id &&
              toLocalDateKey(event.startAt) === column.date
          );

          return (
            <div
              key={column.key}
              className="calendar-user-column"
              style={{ height: TOTAL_HEIGHT }}
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;

                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const totalMinutes = Math.floor((y / HOUR_HEIGHT) * 60);
                const roundedMinutes = Math.floor(totalMinutes / 30) * 30;
                const hh = Math.floor(roundedMinutes / 60);
                const mm = roundedMinutes % 60;

                onEmptySlotClick({
                  ownerUserId: column.user.id,
                  startAt: getDateTimeLocal(column.date, hh, mm),
                  endAt: getDateTimeLocal(column.date, hh + 1, mm),
                });
              }}
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="calendar-hour-line"
                  style={{ top: hour * HOUR_HEIGHT }}
                />
              ))}

              {getCurrentTimeLineTop(column.date) !== null && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: getCurrentTimeLineTop(column.date)!,
                    height: 2,
                    background: '#ff4d4f',
                    zIndex: 6,
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: -4,
                      top: -4,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: '#ff4d4f',
                    }}
                  />
                </div>
              )}

              {userEvents.map((event) => {
                const style = getEventStyle(event);
                const isOwner = event.ownerUserId === currentUserId;
                const isSoft = event.blockType === 'soft';

                return (
                  <div
                    key={event.id}
                    className={`calendar-event-block ${isOwner ? 'editable' : ''}`}
                    style={{
                      left: 8,
                      right: 8,
                      top: style.top,
                      height: style.height,
                      border: `1px solid ${column.color}`,
                      background: isSoft
                        ? `repeating-linear-gradient(135deg, color-mix(in srgb, ${column.color} 22%, transparent), color-mix(in srgb, ${column.color} 22%, transparent) 8px, color-mix(in srgb, ${column.color} 10%, transparent) 8px, color-mix(in srgb, ${column.color} 10%, transparent) 16px)`
                        : `color-mix(in srgb, ${column.color} 18%, var(--panel))`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isOwner) onEventClick(event);
                    }}
                    title={`${event.title} (${formatTime(event.startAt)}–${formatTime(event.endAt)})`}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {event.emoji ? `${event.emoji} ` : ''}
                      {event.title}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      {formatTime(event.startAt)}–{formatTime(event.endAt)}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>
                      {event.blockType === 'hard' ? 'Занят' : 'Могу перенести'}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}