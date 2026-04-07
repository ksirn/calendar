import { useEffect, useState } from 'react';
import { MultiDatePicker } from './MultiDatePicker';

type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly';

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  title: string;
  startAt: string;
  endAt: string;
  blockType: 'hard' | 'soft';
  participants: string[];
  acceptedUsers: { id: string; name: string }[];
  duplicateDates: string[];
  selectedDate: string;
  repeatMode: RepeatMode;
  repeatUntil: string;
  error: string;
  onClose: () => void;
  onChangeTitle: (value: string) => void;
  onChangeStartAt: (value: string) => void;
  onChangeEndAt: (value: string) => void;
  onChangeBlockType: (value: 'hard' | 'soft') => void;
  onOpenParticipants: () => void;
  onToggleDuplicateDate: (date: string) => void;
  onChangeRepeatMode: (value: RepeatMode) => void;
  onChangeRepeatUntil: (value: string) => void;
  onSubmit: () => void;
  onDelete?: () => void;
};

export function EventModal({
  open,
  mode,
  title,
  startAt,
  endAt,
  blockType,
  participants,
  acceptedUsers,
  duplicateDates,
  selectedDate,
  repeatMode,
  repeatUntil,
  error,
  onClose,
  onChangeTitle,
  onChangeStartAt,
  onChangeEndAt,
  onChangeBlockType,
  onOpenParticipants,
  onToggleDuplicateDate,
  onChangeRepeatMode,
  onChangeRepeatUntil,
  onSubmit,
  onDelete,
}: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setCalendarOpen(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0 }}>
            {mode === 'create' ? 'Создать событие' : 'Изменить событие'}
          </h3>
          <button onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <label>
            Название:
            <input
              placeholder="Например: Работа"
              value={title}
              onChange={(e) => onChangeTitle(e.target.value)}
            />
          </label>

          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            Можно вставлять emoji прямо в название. Например: 💼 Смена, 😴 Сон
          </div>

          <label>
            Начало:
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => onChangeStartAt(e.target.value)}
            />
          </label>

          <label>
            Конец:
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => onChangeEndAt(e.target.value)}
            />
          </label>

          <label>
            Тип:
            <select
              value={blockType}
              onChange={(e) => onChangeBlockType(e.target.value as 'hard' | 'soft')}
            >
              <option value="hard">Занят</option>
              <option value="soft">Могу перенести</option>
            </select>
          </label>

          {mode === 'create' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={onOpenParticipants}>
                  Выбрать участников
                </button>
                <span className="badge subtle">Выбрано: {participants.length}</span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                  Доступно: {acceptedUsers.length}
                </span>
              </div>

              <div className="expandable-block">
                <button
                  type="button"
                  className="expandable-trigger"
                  onClick={() => setCalendarOpen((v) => !v)}
                >
                  <span>{calendarOpen ? '▾' : '▸'}</span>
                  <span>Повторить на даты</span>
                  {duplicateDates.length > 0 && (
                    <span className="badge subtle">{duplicateDates.length}</span>
                  )}
                </button>

                {calendarOpen && (
                  <div style={{ marginTop: 10 }}>
                    <MultiDatePicker
                      selectedDate={selectedDate}
                      selectedDates={duplicateDates}
                      onToggleDate={onToggleDuplicateDate}
                    />
                  </div>
                )}
              </div>

              <div className="expandable-block">
                <div style={{ display: 'grid', gap: 8 }}>
                  <label>
                    Серия:
                    <select
                      value={repeatMode}
                      onChange={(e) =>
                        onChangeRepeatMode(e.target.value as 'none' | 'daily' | 'weekly' | 'monthly')
                      }
                    >
                      <option value="none">Не повторять</option>
                      <option value="daily">Каждый день</option>
                      <option value="weekly">Каждую неделю</option>
                      <option value="monthly">Каждый месяц</option>
                    </select>
                  </label>

                  {repeatMode !== 'none' && (
                    <>
                      <label>
                        До даты:
                        <input
                          type="date"
                          value={repeatUntil}
                          onChange={(e) => onChangeRepeatUntil(e.target.value)}
                        />
                      </label>

                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                        Серия создаст обычные отдельные события до выбранной даты.
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={onSubmit}>
              {mode === 'create' ? 'Создать' : 'Сохранить'}
            </button>

            {mode === 'edit' && onDelete && <button onClick={onDelete}>Удалить</button>}

            <button onClick={onClose}>Закрыть</button>
          </div>
        </div>
      </div>
    </div>
  );
}
