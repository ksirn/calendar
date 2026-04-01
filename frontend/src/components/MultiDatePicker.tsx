import { useMemo, useState } from 'react';

type Props = {
  selectedDate: string;
  selectedDates: string[];
  onToggleDate: (date: string) => void;
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
  });
}

export function MultiDatePicker({ selectedDate, selectedDates, onToggleDate }: Props) {
  const [cursor, setCursor] = useState(() => new Date(`${selectedDate}T12:00:00`));

  const data = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();

    const firstDay = new Date(year, month, 1);
    const startWeekday = (firstDay.getDay() + 6) % 7; // monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ key: string; label: string; muted: boolean }> = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push({ key: `empty-${i}`, label: '', muted: true });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day, 12, 0, 0);
      cells.push({
        key: toDateKey(date),
        label: String(day),
        muted: false,
      });
    }

    return cells;
  }, [cursor]);

  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  return (
    <div className="mini-calendar">
      <div className="mini-calendar-header">
        <button
          type="button"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        >
          ←
        </button>
        <strong>{monthLabel(cursor)}</strong>
        <button
          type="button"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        >
          →
        </button>
      </div>

      <div className="mini-calendar-grid weekdays">
        {weekdays.map((w) => (
          <div key={w} className="mini-calendar-weekday">
            {w}
          </div>
        ))}
      </div>

      <div className="mini-calendar-grid">
        {data.map((cell) =>
          cell.muted ? (
            <div key={cell.key} className="mini-calendar-cell empty" />
          ) : (
            <button
              key={cell.key}
              type="button"
              className={`mini-calendar-cell ${selectedDates.includes(cell.key) ? 'active' : ''}`}
              onClick={() => onToggleDate(cell.key)}
            >
              {cell.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}