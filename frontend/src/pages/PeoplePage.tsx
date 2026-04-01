import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { emitDataChanged, subscribeDataChanged } from '../lib/dataEvents';
import { useUserColors } from '../hooks/useUserColors';
import type { ConnectionsResponse, User } from '../types';

type Props = {
  currentUserId: string;
  users: User[];
};

export function PeoplePage({ currentUserId, users }: Props) {
  const [connections, setConnections] = useState<ConnectionsResponse | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const { getColor, defaultColors } = useUserColors(users);

  const currentUser = users.find((u) => u.id === currentUserId) ?? null;

  const load = async () => {
    try {
      setError('');
      const data = (await api.getConnections(currentUserId)) as ConnectionsResponse;
      setConnections(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    }
  };

  useEffect(() => {
    load();
    const unsub = subscribeDataChanged(load);
    return unsub;
  }, [currentUserId]);

  const acceptedIds = new Set(connections?.accepted.map((c) => c.otherUser?.id).filter(Boolean));
  const pendingIds = new Set([
    ...(connections?.incomingPending.map((c) => c.otherUser?.id).filter(Boolean) ?? []),
    ...(connections?.outgoingPending.map((c) => c.otherUser?.id).filter(Boolean) ?? []),
  ]);

  const availableUsers = useMemo(() => {
    const q = query.trim().toLowerCase();

    return users.filter((user) => {
      const allowed =
        user.id !== currentUserId && !acceptedIds.has(user.id) && !pendingIds.has(user.id);

      if (!allowed) return false;
      if (!q) return true;

      return user.name.toLowerCase().includes(q);
    });
  }, [users, currentUserId, acceptedIds, pendingIds, query]);

  const requestConnection = async (targetUserId: string) => {
    try {
      await api.createConnectionRequest(currentUserId, targetUserId);
      emitDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка запроса');
    }
  };

  const acceptConnection = async (connectionId: string) => {
    try {
      await api.acceptConnection(connectionId, currentUserId);
      emitDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка принятия');
    }
  };

  const declineConnection = async (connectionId: string) => {
    try {
      await api.declineConnection(connectionId, currentUserId);
      emitDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отклонения');
    }
  };

  const deleteConnection = async (connectionId: string) => {
    try {
      await api.deleteConnection(connectionId, currentUserId);
      emitDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления связи');
    }
  };

  const updateMyColor = async (color: string) => {
    try {
      await api.updateUserColor(currentUserId, color);
      emitDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения цвета');
    }
  };

  const updatePrivacy = async (
    connectionId: string,
    visibility: 'full' | 'busy_only'
  ) => {
    try {
      await api.updateConnectionPrivacy(connectionId, currentUserId, visibility);
      emitDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения приватности');
    }
  };

  return (
    <div>
      <h2>Люди</h2>

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      <section className="panel">
        <h3>Мой цвет</h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: getColor(currentUserId, 0),
              display: 'inline-block',
            }}
          />
          <strong>{currentUser?.name ?? 'Я'}</strong>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {defaultColors.map((color) => (
            <button
              key={color}
              onClick={() => updateMyColor(color)}
              title={color}
              style={{
                width: 28,
                height: 28,
                minWidth: 28,
                padding: 0,
                borderRadius: '50%',
                background: color,
                border: '2px solid var(--border)',
              }}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Найти пользователя</h3>
        <input
          placeholder="Поиск по имени..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ marginBottom: 12, maxWidth: '100%' }}
        />

        <div style={{ display: 'grid', gap: 8 }}>
          {availableUsers.length === 0 && <p>Никого не найдено.</p>}

          {availableUsers.map((user) => (
            <div key={user.id} className="mini-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>{user.name}</div>
                <button onClick={() => requestConnection(user.id)}>Отправить запрос</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Подтвержденные связи</h3>
        {!connections?.accepted.length && <p>Пока нет.</p>}
        <div style={{ display: 'grid', gap: 8 }}>
          {connections?.accepted.map((item, index) => {
            const user = item.otherUser;
            if (!user) return null;

            return (
              <div key={item.id} className="mini-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: getColor(user.id, index + 1),
                        display: 'inline-block',
                      }}
                    />
                    <strong>{user.name}</strong>
                  </div>

                  <button onClick={() => deleteConnection(item.id)}>Удалить связь</button>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>Что этот человек видит у тебя:</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                    Полностью — видно настоящее название события. Только занятость — видно только
                    «Занят» или «Занят, но могу перенести».
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className={item.visibility === 'full' ? 'view-mode-button active' : 'view-mode-button'}
                      onClick={() => updatePrivacy(item.id, 'full')}
                    >
                      Полностью
                    </button>

                    <button
                      className={item.visibility === 'busy_only' ? 'view-mode-button active' : 'view-mode-button'}
                      onClick={() => updatePrivacy(item.id, 'busy_only')}
                    >
                      Только занятость
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h3>Входящие</h3>
        {!connections?.incomingPending.length && <p>Пока нет.</p>}
        <div style={{ display: 'grid', gap: 8 }}>
          {connections?.incomingPending.map((item) => (
            <div key={item.id} className="mini-card">
              <div>{item.otherUser?.name}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => acceptConnection(item.id)}>Принять</button>
                <button onClick={() => declineConnection(item.id)}>Отклонить</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Исходящие</h3>
        {!connections?.outgoingPending.length && <p>Пока нет.</p>}
        <div style={{ display: 'grid', gap: 8 }}>
          {connections?.outgoingPending.map((item) => (
            <div key={item.id} className="mini-card">
              {item.otherUser?.name}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}