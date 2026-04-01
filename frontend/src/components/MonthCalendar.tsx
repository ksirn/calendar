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

export function MonthCalendar({
  selectedDate,
  selectedUsers,
  events,
  getUserColor,
  onSelectDate,
}: Props) {
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

  return (
    <div className="panel">
      <div className="month-grid weekdays">
        {weekdays.map((w) => (
          <div key={w} className="month-weekday">
            {w}
          </div>
        ))}
      </div>

      <div className="month-grid">
        {cells.map((date, idx) =>
          date ? (
            <button
              key={date}
              className={`month-cell ${date === selectedDate ? 'active' : ''}`}
              onClick={() => onSelectDate(date)}
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
    </div>
  );
}