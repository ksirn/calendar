import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { emitDataChanged, subscribeDataChanged } from '../lib/dataEvents';
import type { TodoItem, OutgoingTodoItem, ConnectionsResponse } from '../types';
import { useToast } from '../components/ToastProvider';

type Props = {
  currentUserId: string;
};

type ScheduleModal = {
  todoId: string;
  title: string;
  startAt: string;
  endAt: string;
};

function toDateTimeLocalValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function isOverdue(todo: TodoItem) {
  return todo.deadline
    ? new Date(todo.deadline) < new Date() && todo.status !== 'done' && todo.status !== 'scheduled'
    : false;
}

function DeadlineBadge({ deadline, status }: { deadline: string | null; status: string }) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const overdue = d < new Date() && status !== 'done' && status !== 'scheduled';
  return (
    <span style={{
      fontSize: 11,
      padding: '2px 7px',
      borderRadius: 10,
      background: overdue ? 'var(--danger-bg, rgba(239,68,68,0.12))' : 'rgba(128,128,128,0.12)',
      color: overdue ? 'var(--danger)' : 'var(--muted)',
      marginLeft: 6,
    }}>
      {overdue ? '⚠ до ' : '⏰ '}
      {d.toLocaleDateString([], { day: 'numeric', month: 'short' })}
    </span>
  );
}

export function TodoPage({ currentUserId }: Props) {
  const [connectedUsers, setConnectedUsers] = useState<Array<{id: string; username: string; name: string}>>([]);
  const [inbox, setInbox] = useState<TodoItem[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingTodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'inbox' | 'outgoing'>('inbox');

  // Форма создания
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [formError, setFormError] = useState('');

  // Модалка планирования
  const [scheduleModal, setScheduleModal] = useState<ScheduleModal | null>(null);
  const [scheduleError, setScheduleError] = useState('');

  const { showToast } = useToast();

  const load = async () => {
    try {
      setLoading(true);
      const [todosData, connectionsData] = await Promise.all([
        api.getTodos() as Promise<{ inbox: TodoItem[]; outgoing: OutgoingTodoItem[] }>,
        api.getConnections() as Promise<ConnectionsResponse>,
      ]);
      setInbox(todosData.inbox);
      setOutgoing(todosData.outgoing);
      setConnectedUsers(
        connectionsData.accepted
          .map((c) => c.otherUser)
          .filter((u): u is NonNullable<typeof u> => u !== null)
      );
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = subscribeDataChanged(load);
    return unsub;
  }, [currentUserId]);

  const createTodo = async () => {
    setFormError('');
    if (!newTitle.trim()) { setFormError('Введите название задачи'); return; }
    try {
      await api.createTodo({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        deadline: newDeadline || undefined,
        targetUserId: newTarget || undefined,
      });
      setNewTitle(''); setNewDesc(''); setNewDeadline(''); setNewTarget('');
      setShowForm(false);
      emitDataChanged();
      showToast('Задача создана', 'success');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const markDone = async (todoId: string, current: string) => {
    const next = current === 'done' ? 'inbox' : 'done';
    await api.updateTodo(todoId, { status: next });
    emitDataChanged();
  };

  const deleteTodo = async (todoId: string) => {
    await api.deleteTodo(todoId);
    emitDataChanged();
    showToast('Задача удалена', 'info');
  };

  const cancelOutgoing = async (todoId: string) => {
    try {
      await api.cancelTodo(todoId);
      emitDataChanged();
      showToast('Задача отозвана', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Ошибка', 'error');
    }
  };

  const openSchedule = (todo: TodoItem) => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    setScheduleError('');
    setScheduleModal({
      todoId: todo.id,
      title: todo.title,
      startAt: toDateTimeLocalValue(now),
      endAt: toDateTimeLocalValue(end),
    });
  };

  const doSchedule = async () => {
    if (!scheduleModal) return;
    setScheduleError('');
    try {
      await api.scheduleTodo(scheduleModal.todoId, {
        startAt: new Date(scheduleModal.startAt).toISOString(),
        endAt: new Date(scheduleModal.endAt).toISOString(),
      });
      setScheduleModal(null);
      emitDataChanged();
      showToast('Задача добавлена в календарь', 'success');
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  // Разделяем на категории для отображения
  const activeTodos = inbox.filter((t) => t.status === 'inbox' && !isOverdue(t));
  const scheduledTodos = inbox.filter((t) => t.status === 'scheduled');
  const doneTodos = inbox.filter((t) => t.status === 'done');
  const overdueTodos = inbox.filter((t) => isOverdue(t));


  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: active ? 'var(--link-active)' : 'var(--link-bg)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: 14,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  });

  const renderTodoCard = (todo: TodoItem, showDone = true) => (
    <div
      key={todo.id}
      className="panel"
      style={{
        opacity: todo.status === 'done' ? 0.6 : 1,
        borderLeft: isOverdue(todo) ? '3px solid var(--danger)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Чекбокс */}
        {showDone && (
          <button
            onClick={() => markDone(todo.id, todo.status)}
            title={todo.status === 'done' ? 'Отметить как активную' : 'Отметить выполненной'}
            style={{
              width: 20, height: 20, borderRadius: 4, border: '2px solid var(--border)',
              background: todo.status === 'done' ? 'var(--link-active)' : 'transparent',
              cursor: 'pointer', flexShrink: 0, marginTop: 2, display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text)',
            }}
          >
            {todo.status === 'done' ? '✓' : ''}
          </button>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <span style={{
              fontWeight: 500, fontSize: 14,
              textDecoration: todo.status === 'done' ? 'line-through' : 'none',
            }}>
              {todo.title}
            </span>
            <DeadlineBadge deadline={todo.deadline} status={todo.status} />
            {todo.status === 'scheduled' && (
              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10,
                background: 'rgba(34,197,94,0.12)', color: 'var(--success, #22c55e)', marginLeft: 4 }}>
                📅 В календаре
              </span>
            )}
          </div>

          {todo.creator && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              от: {todo.creator.name}
            </div>
          )}

          {todo.description && (
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              {todo.description}
            </div>
          )}
        </div>

        {/* Действия */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {todo.status === 'inbox' && (
            <button
              onClick={() => openSchedule(todo)}
              title="Поставить в календарь"
              style={{ fontSize: 13, padding: '4px 10px' }}
            >
              📅
            </button>
          )}
          <button
            onClick={() => deleteTodo(todo.id)}
            title="Удалить"
            style={{ fontSize: 13, padding: '4px 10px', color: 'var(--danger)', background: 'none',
              border: '1px solid var(--border)' }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>To-do</h2>
        <button onClick={() => setShowForm((v) => !v)}>
          {showForm ? '✕ Отмена' : '+ Новая задача'}
        </button>
      </div>

      {/* Форма создания */}
      {showForm && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <label>
              Задача:
              <input
                placeholder="Что нужно сделать?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
              />
            </label>
            <label>
              Описание (необязательно):
              <input
                placeholder="Подробности..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </label>
            <label>
              Дедлайн (необязательно):
              <input
                type="datetime-local"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
              />
            </label>
            {connectedUsers.length > 0 && (
              <label>
                Назначить другому (необязательно):
                <select value={newTarget} onChange={(e) => setNewTarget(e.target.value)}>
                  <option value="">— Себе —</option>
                  {connectedUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
                  ))}
                </select>
              </label>
            )}
            {formError && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{formError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createTodo}>Создать</button>
              <button onClick={() => setShowForm(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Табы */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button style={tabStyle(tab === 'inbox')} onClick={() => setTab('inbox')}>
          Мои задачи
          {(activeTodos.length + overdueTodos.length) > 0 && (
            <span className="badge">{activeTodos.length + overdueTodos.length}</span>
          )}
        </button>
        <button style={tabStyle(tab === 'outgoing')} onClick={() => setTab('outgoing')}>
          Назначенные другим
          {outgoing.filter(t => t.status === 'inbox').length > 0 && (
            <span className="badge">{outgoing.filter(t => t.status === 'inbox').length}</span>
          )}
        </button>
      </div>

      {loading && <p>Загрузка...</p>}

      {/* Мои задачи */}
      {tab === 'inbox' && !loading && (
        <div style={{ display: 'grid', gap: 8 }}>
          {/* Просроченные */}
          {overdueTodos.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--danger)', marginTop: 4, marginBottom: 2 }}>
                ⚠ Просроченные ({overdueTodos.length})
              </div>
              {overdueTodos.map((t) => renderTodoCard(t))}
              <div style={{ height: 8 }} />
            </>
          )}

          {/* Активные */}
          {activeTodos.length > 0 && (
            <>
              {activeTodos.map((t) => renderTodoCard(t))}
            </>
          )}

          {activeTodos.length === 0 && overdueTodos.length === 0 && (
            <p style={{ color: 'var(--muted)' }}>Активных задач нет. Отлично!</p>
          )}

          {/* В календаре */}
          {scheduledTodos.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, marginBottom: 4 }}>
                В календаре ({scheduledTodos.length})
              </div>
              {scheduledTodos.map((t) => renderTodoCard(t))}
            </>
          )}

          {/* Выполненные */}
          {doneTodos.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, marginBottom: 4 }}>
                Выполненные ({doneTodos.length})
              </div>
              {doneTodos.map((t) => renderTodoCard(t, true))}
            </>
          )}
        </div>
      )}

      {/* Назначенные другим */}
      {tab === 'outgoing' && !loading && (
        <div style={{ display: 'grid', gap: 8 }}>
          {outgoing.length === 0 && (
            <p style={{ color: 'var(--muted)' }}>Вы не назначали задачи другим.</p>
          )}
          {outgoing.map((todo) => (
            <div key={todo.id} className="panel" style={{
              opacity: todo.status === 'done' || todo.status === 'cancelled' ? 0.55 : 1,
              borderLeft: todo.status === 'cancelled' ? '3px solid var(--danger)' : undefined,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>
                    {todo.title}
                    <DeadlineBadge deadline={todo.deadline} status={todo.status} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Назначено: {todo.owner?.name ?? '?'}
                  </div>
                  {todo.description && (
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{todo.description}</div>
                  )}
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 11,
                      background: todo.status === 'done'
                        ? 'rgba(34,197,94,0.12)'
                        : todo.status === 'cancelled'
                        ? 'rgba(239,68,68,0.12)'
                        : todo.status === 'scheduled'
                        ? 'rgba(59,130,246,0.12)'
                        : 'rgba(128,128,128,0.12)',
                      color: todo.status === 'done'
                        ? 'var(--success, #22c55e)'
                        : todo.status === 'cancelled'
                        ? 'var(--danger)'
                        : todo.status === 'scheduled'
                        ? '#60a5fa'
                        : 'var(--muted)',
                    }}>
                      {todo.status === 'done' ? '✓ Выполнена'
                        : todo.status === 'cancelled' ? '✕ Отозвана'
                        : todo.status === 'scheduled' ? '📅 В календаре'
                        : '⏳ Ожидает'}
                    </span>
                  </div>
                </div>
                {todo.status !== 'done' && todo.status !== 'cancelled' && (
                  <button
                    onClick={() => cancelOutgoing(todo.id)}
                    title="Отозвать задачу"
                    style={{
                      fontSize: 12, padding: '4px 10px', flexShrink: 0,
                      color: 'var(--danger)', background: 'none',
                      border: '1px solid var(--border)', borderRadius: 6,
                    }}
                  >
                    Отозвать
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модалка планирования */}
      {scheduleModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="panel" style={{ maxWidth: 400, width: '100%', margin: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Поставить в календарь</h3>
            <div style={{ fontWeight: 500, marginBottom: 12 }}>{scheduleModal.title}</div>

            <div style={{ display: 'grid', gap: 10 }}>
              <label>
                Начало:
                <input
                  type="datetime-local"
                  value={scheduleModal.startAt}
                  onChange={(e) => setScheduleModal({ ...scheduleModal, startAt: e.target.value })}
                />
              </label>
              <label>
                Конец:
                <input
                  type="datetime-local"
                  value={scheduleModal.endAt}
                  onChange={(e) => setScheduleModal({ ...scheduleModal, endAt: e.target.value })}
                />
              </label>
              {scheduleError && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{scheduleError}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={doSchedule}>Добавить в календарь</button>
                <button onClick={() => setScheduleModal(null)}>Отмена</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
