import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { TimeGridCalendar } from '../components/TimeGridCalendar';
import { MonthCalendar } from '../components/MonthCalendar';
import { EventModal } from '../components/EventModal';
import { UserSelectModal } from '../components/UserSelectModal';
import { useUserColors } from '../hooks/useUserColors';
import { emitDataChanged, subscribeDataChanged } from '../lib/dataEvents';
import { useToast } from '../components/ToastProvider';
import type { CalendarColumnUser, ConnectionItem, EventItem, User } from '../types';

type Props = {
  currentUserId: string;
  users: User[];
};

type ViewMode = 'day' | '3days' | 'week' | 'month';
type FormMode = 'create' | 'edit';

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function addDays(dateString: string, delta: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + delta);
  return toDateInputValue(date);
}

function formatSelectedDate(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString([], {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function replaceDatePart(dateTimeLocal: string, newDate: string) {
  const timePart = dateTimeLocal.split('T')[1] ?? '00:00';
  return `${newDate}T${timePart}`;
}

function getVisibleDates(selectedDate: string, viewMode: ViewMode) {
  if (viewMode === 'day') return [selectedDate];
  if (viewMode === '3days') return [0, 1, 2].map((d) => addDays(selectedDate, d));
  if (viewMode === 'week') return [0, 1, 2, 3, 4, 5, 6].map((d) => addDays(selectedDate, d));
  return [selectedDate];
}

export function CalendarPage({ currentUserId, users }: Props) {
  const today = toDateInputValue(new Date());
  const { getColor } = useUserColors(users);
  const { showToast } = useToast();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [modalError, setModalError] = useState('');

  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState(() =>
    toDateTimeLocalValue(new Date(`${today}T18:00:00`))
  );
  const [endAt, setEndAt] = useState(() =>
    toDateTimeLocalValue(new Date(`${today}T19:00:00`))
  );
  const [blockType, setBlockType] = useState<'hard' | 'soft'>('hard');
  const [participants, setParticipants] = useState<string[]>([]);
  const [duplicateDates, setDuplicateDates] = useState<string[]>([]);

  const visibleDates = useMemo(() => getVisibleDates(selectedDate, viewMode), [selectedDate, viewMode]);

  const loadConnections = async () => {
    const data = (await api.getConnections(currentUserId)) as { accepted: ConnectionItem[] };
    setConnections(data.accepted);
  };

  const loadEvents = async (userIds: string[]) => {
    const ids = [currentUserId, ...userIds.filter((id) => id !== currentUserId)];
    const data = (await api.getEvents(currentUserId, ids)) as EventItem[];
    setEvents(data);
  };

  const load = async () => {
    try {
      setLoading(true);
      setPageError('');
      await loadConnections();
      await loadEvents(selectedUserIds);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedUserIds([]);
  }, [currentUserId]);

  useEffect(() => {
    load();
    const unsub = subscribeDataChanged(load);
    return unsub;
  }, [currentUserId, selectedUserIds]);

  const acceptedUsers = useMemo(
    () => connections.map((c) => c.otherUser).filter(Boolean),
    [connections]
  );

  const acceptedUserSimple = useMemo(
    () => acceptedUsers.map((u) => ({ id: u!.id, name: u!.name })),
    [acceptedUsers]
  );

  const selectedUsers = useMemo<CalendarColumnUser[]>(() => {
    const me: CalendarColumnUser = { id: currentUserId, name: 'Я' };
    const others = acceptedUsers
      .filter((user) => selectedUserIds.includes(user!.id))
      .map((user) => ({ id: user!.id, name: user!.name }));

    return [me, ...others];
  }, [acceptedUsers, currentUserId, selectedUserIds]);

  const closeModal = () => {
    setModalOpen(false);
    setParticipantsModalOpen(false);
    setModalError('');
    setEditingEventId(null);
    setFormMode('create');
    setTitle('');
    setStartAt(toDateTimeLocalValue(new Date(`${selectedDate}T18:00:00`)));
    setEndAt(toDateTimeLocalValue(new Date(`${selectedDate}T19:00:00`)));
    setBlockType('hard');
    setParticipants([]);
    setDuplicateDates([]);
  };

  const openCreateModal = (start: Date, end: Date) => {
    setFormMode('create');
    setEditingEventId(null);
    setTitle('');
    setStartAt(toDateTimeLocalValue(start));
    setEndAt(toDateTimeLocalValue(end));
    setBlockType('hard');
    setParticipants([]);
    setDuplicateDates([]);
    setModalError('');
    setModalOpen(true);
  };

  const openEditModal = (event: EventItem) => {
    setFormMode('edit');
    setEditingEventId(event.id);
    setTitle(event.title);
    setStartAt(toDateTimeLocalValue(new Date(event.startAt)));
    setEndAt(toDateTimeLocalValue(new Date(event.endAt)));
    setBlockType(event.blockType);
    setParticipants([]);
    setDuplicateDates([]);
    setModalError('');
    setModalOpen(true);
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleParticipant = (userId: string) => {
    setParticipants((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleDuplicateDate = (date: string) => {
    if (date === selectedDate) return;
    setDuplicateDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

  const submitForm = async () => {
    if (!title || !startAt || !endAt) {
      setModalError('Заполни название, начало и конец');
      return;
    }

    try {
      setModalError('');

      if (formMode === 'create') {
        if (duplicateDates.length === 0) {
          await api.createEvent({
            creatorId: currentUserId,
            ownerUserId: currentUserId,
            title,
            description: '',
            startAt: new Date(startAt).toISOString(),
            endAt: new Date(endAt).toISOString(),
            blockType,
            participants,
          });

          closeModal();
          emitDataChanged();
          showToast('Событие создано', 'success');
          return;
        }

        const occurrences = [
          {
            startAt: new Date(startAt).toISOString(),
            endAt: new Date(endAt).toISOString(),
          },
          ...duplicateDates.map((date) => ({
            startAt: new Date(replaceDatePart(startAt, date)).toISOString(),
            endAt: new Date(replaceDatePart(endAt, date)).toISOString(),
          })),
        ];

        const result = (await api.createEventsBulk({
          creatorId: currentUserId,
          ownerUserId: currentUserId,
          title,
          description: '',
          blockType,
          participants,
          occurrences,
        })) as {
          createdCount: number;
          skippedCount: number;
          skipped: Array<{ startAt: string; error: string; conflict?: { title?: string } }>;
        };

        emitDataChanged();

        if (result.skippedCount > 0) {
          const firstSkipped = result.skipped[0];
          const dateText = firstSkipped?.startAt
            ? new Date(firstSkipped.startAt).toLocaleDateString()
            : 'одной из дат';
          const conflictTitle = firstSkipped?.conflict?.title
            ? ` (${firstSkipped.conflict.title})`
            : '';

          setModalError(
            `Создано: ${result.createdCount}. Пропущено: ${result.skippedCount}. Пример: ${dateText}${conflictTitle}`
          );
          showToast(`Создано ${result.createdCount}, пропущено ${result.skippedCount}`, 'info');
          return;
        }

        closeModal();
        showToast(`Создано ${result.createdCount} событий`, 'success');
        return;
      }

      if (editingEventId) {
        await api.updateEvent(editingEventId, {
          userId: currentUserId,
          title,
          description: '',
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          blockType,
        });

        closeModal();
        emitDataChanged();
        showToast('Событие обновлено', 'success');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка сохранения';
      setModalError(message);
      showToast(message, 'error');
    }
  };

  const deleteCurrentEvent = async () => {
    if (!editingEventId) return;

    try {
      setModalError('');
      await api.deleteEvent(editingEventId, currentUserId);
      closeModal();
      emitDataChanged();
      showToast('Событие удалено', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка удаления';
      setModalError(message);
      showToast(message, 'error');
    }
  };

  const handleEmptySlotClick = (payload: {
    ownerUserId: string;
    startAt: string;
    endAt: string;
  }) => {
    if (payload.ownerUserId !== currentUserId) return;
    openCreateModal(new Date(payload.startAt), new Date(payload.endAt));
  };

  const handleEventClick = (event: EventItem) => {
    if (event.ownerUserId !== currentUserId) return;
    openEditModal(event);
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>Календарь</h2>
        <button className="icon-filter-button" onClick={() => setFilterModalOpen(true)} title="Фильтр">
          ⚲
        </button>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Период</h3>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setSelectedDate(addDays(selectedDate, -1))}>← Назад</button>
          <button onClick={() => setSelectedDate(today)}>Сегодня</button>
          <button onClick={() => setSelectedDate(addDays(selectedDate, 1))}>Вперед →</button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ maxWidth: 220 }}
          />

          <strong>{formatSelectedDate(selectedDate)}</strong>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setViewMode('day')} className={viewMode === 'day' ? 'view-mode-button active' : 'view-mode-button'}>
              День
            </button>
            <button onClick={() => setViewMode('3days')} className={viewMode === '3days' ? 'view-mode-button active' : 'view-mode-button'}>
              3 дня
            </button>
            <button onClick={() => setViewMode('week')} className={viewMode === 'week' ? 'view-mode-button active' : 'view-mode-button'}>
              Неделя
            </button>
            <button onClick={() => setViewMode('month')} className={viewMode === 'month' ? 'view-mode-button active' : 'view-mode-button'}>
              Месяц
            </button>
          </div>

          <button
            onClick={() =>
              openCreateModal(
                new Date(`${selectedDate}T18:00:00`),
                new Date(`${selectedDate}T19:00:00`)
              )
            }
          >
            + Событие
          </button>
        </div>

        {selectedUserIds.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {acceptedUsers
              .filter((u) => selectedUserIds.includes(u!.id))
              .map((u, index) => (
                <button
                  key={u!.id}
                  className="pill-button"
                  onClick={() => toggleUser(u!.id)}
                >
                  <span
                    className="pill-dot"
                    style={{ background: getColor(u!.id, index) }}
                  />
                  {u!.name}
                </button>
              ))}
          </div>
        )}
      </div>

      {loading && <p>Загрузка...</p>}
      {pageError && <p style={{ color: 'var(--danger)' }}>{pageError}</p>}

      {viewMode === 'month' ? (
        <MonthCalendar
          selectedDate={selectedDate}
          selectedUsers={selectedUsers}
          events={events}
          getUserColor={getColor}
          onSelectDate={setSelectedDate}
        />
      ) : (
        <TimeGridCalendar
          selectedUsers={selectedUsers}
          events={events}
          currentUserId={currentUserId}
          visibleDates={visibleDates}
          onEmptySlotClick={handleEmptySlotClick}
          onEventClick={handleEventClick}
          getUserColor={getColor}
        />
      )}

      <EventModal
        open={modalOpen}
        mode={formMode}
        title={title}
        startAt={startAt}
        endAt={endAt}
        blockType={blockType}
        participants={participants}
        acceptedUsers={acceptedUserSimple}
        duplicateDates={duplicateDates}
        selectedDate={selectedDate}
        error={modalError}
        onClose={closeModal}
        onChangeTitle={setTitle}
        onChangeStartAt={setStartAt}
        onChangeEndAt={setEndAt}
        onChangeBlockType={setBlockType}
        onOpenParticipants={() => setParticipantsModalOpen(true)}
        onToggleDuplicateDate={toggleDuplicateDate}
        onSubmit={submitForm}
        onDelete={formMode === 'edit' ? deleteCurrentEvent : undefined}
      />

      <UserSelectModal
        open={participantsModalOpen}
        title="Выбор участников"
        items={acceptedUserSimple}
        selectedIds={participants}
        onToggle={toggleParticipant}
        onClose={() => setParticipantsModalOpen(false)}
      />

      <UserSelectModal
        open={filterModalOpen}
        title="Фильтр по людям"
        items={acceptedUserSimple}
        selectedIds={selectedUserIds}
        onToggle={toggleUser}
        onClose={() => setFilterModalOpen(false)}
      />
    </div>
  );
}