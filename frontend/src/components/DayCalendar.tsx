import { useEffect, useMemo, useState } from 'react';
import type { CalendarColumnUser, EventItem } from '../types';

type Props = {
  selectedUsers: CalendarColumnUser[];
  events: EventItem[];
  selectedDate: string;
  currentUserId: string;
  onEmptySlotClick: (payload: { ownerUserId: string; startAt: string; endAt: string }) => void;
  onEventClick: (event: EventItem) => void;
  getUserColor: (userId: string, fallbackIndex?: number) => string;
};

type UserIndexMap = Record<string, number>;

const HOUR_HEIGHT = 64;
const DAY_START_HOUR = 0;
const DAY_END_HOUR = 24;
const TOTAL_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT;

function getMinutesFromDayStart(dateString: string) {
  const date = new Date(dateString);
  return date.getHours() * 60 + date.getMinutes();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toLocalDateKey(dateString: string) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getEventStyle(event: EventItem) {
  const startMinutes = getMinutesFromDayStart(event.startAt);
  const endMinutes = getMinutesFromDayStart(event.endAt);

  const top = (startMinutes / 60) * HOUR_HEIGHT;
  const rawHeight = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
  const height = Math.max(rawHeight, 28);

  return {
    top: clamp(top, 0, TOTAL_HEIGHT - 28),
    height: clamp(height, 28, TOTAL_HEIGHT),
  };
}

function getDateTimeLocal(dateString: string, hours: number, minutes: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function getCurrentTimeLineTop(selectedDate: string) {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;

  if (today !== selectedDate) return null;

  const minutes = now.getHours() * 60 + now.getMinutes();
  return (minutes / 60) * HOUR_HEIGHT;
}

export function DayCalendar({
  selectedUsers,
  events,
  selectedDate,
  currentUserId,
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

  const dayEvents = events.filter(
    (event) =>
      toLocalDateKey(event.startAt) === selectedDate &&
      event.status !== 'needs_reschedule' &&
      event.status !== 'cancelled'
  );

  const userIndexMap = useMemo<UserIndexMap>(() => {
    const map: UserIndexMap = {};
    selectedUsers.forEach((user, index) => {
      map[user.id] = index;
    });
    return map;
  }, [selectedUsers]);

  const nowLineTop = useMemo(() => getCurrentTimeLineTop(selectedDate), [selectedDate, nowTick]);

  return (
    <div className="calendar-shell">
      <div
        className="calendar-header-grid"
        style={{
          gridTemplateColumns: `72px repeat(${selectedUsers.length || 1}, minmax(220px, 1fr))`,
        }}
      >
        <div className="calendar-header-cell">Время</div>

        {selectedUsers.map((user) => (
          <div key={user.id} className="calendar-header-cell">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: getUserColor(user.id, userIndexMap[user.id]),
                  display: 'inline-block',
                }}
              />
              {user.name}
            </div>
          </div>
        ))}
      </div>

      <div
        className="calendar-body-grid"
        style={{
          gridTemplateColumns: `72px repeat(${selectedUsers.length || 1}, minmax(220px, 1fr))`,
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

        {selectedUsers.map((user) => {
          const userEvents = dayEvents.filter((event) => event.ownerUserId === user.id);
          const userColor = getUserColor(user.id, userIndexMap[user.id]);

          return (
            <div
              key={user.id}
              className="calendar-user-column"
              style={{ height: TOTAL_HEIGHT }}
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;

                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const totalMinutes = Math.floor((y / HOUR_HEIGHT) * 60);
                const roundedMinutes = Math.floor(totalMinutes / 30) * 30;
                const hours = Math.floor(roundedMinutes / 60);
                const minutes = roundedMinutes % 60;

                onEmptySlotClick({
                  ownerUserId: user.id,
                  startAt: getDateTimeLocal(selectedDate, hours, minutes),
                  endAt: getDateTimeLocal(selectedDate, hours + 1, minutes),
                });
              }}
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="calendar-hour-line"
                  style={{
                    top: hour * HOUR_HEIGHT,
                  }}
                />
              ))}

              {nowLineTop !== null && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: nowLineTop,
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
                    className={`calendar-event-block ${isSoft ? 'soft' : 'hard'} ${
                      isOwner ? 'editable' : ''
                    }`}
                    style={{
                      left: 8,
                      right: 8,
                      top: style.top,
                      height: style.height,
                      border: `1px solid ${userColor}`,
                      background: isSoft
                        ? `repeating-linear-gradient(135deg, color-mix(in srgb, ${userColor} 22%, transparent), color-mix(in srgb, ${userColor} 22%, transparent) 8px, color-mix(in srgb, ${userColor} 10%, transparent) 8px, color-mix(in srgb, ${userColor} 10%, transparent) 16px)`
                        : `color-mix(in srgb, ${userColor} 18%, var(--panel))`,
                    }}
                    title={`${event.title} (${formatTime(event.startAt)}–${formatTime(
                      event.endAt
                    )})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isOwner) {
                        onEventClick(event);
                      }
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{event.title}</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      {formatTime(event.startAt)}–{formatTime(event.endAt)}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>
                      {event.blockType === 'hard' ? 'Занят' : 'Могу перенести'}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>
                      {user.name}
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