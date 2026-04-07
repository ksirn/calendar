import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { emitDataChanged, subscribeDataChanged } from '../lib/dataEvents';
import { useUserColors } from '../hooks/useUserColors';
import { useToast } from '../components/ToastProvider';
import type { ConnectionsResponse, User } from '../types';

type Props = {
  currentUserId: string;
  users: User[];
};

export function PeoplePage({ currentUserId, users }: Props) {
  const [connections, setConnections] = useState<ConnectionsResponse | null>(null);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const { getColor, defaultColors } = useUserColors(users);
  const { showToast } = useToast();

  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const currentUser = users.find((u) => u.id === currentUserId) ?? null;

  const load = async () => {
    try {
      setError('');
      const data = (await api.getConnections()) as ConnectionsResponse;
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

  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name);
      setProfileUsername(currentUser.username);
    }
  }, [currentUser?.id, currentUser?.name, currentUser?.username]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const q = query.trim().toLowerCase();
        if (!q) {
          setSearchResults([]);
          return;
        }

        const data = (await api.searchConnectionCandidates(q)) as User[];
        setSearchResults(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка поиска');
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  const requestConnection = async (targetUserId: string) => {
    try {
      await api.createConnectionRequest(targetUserId);
      emitDataChanged();
      setQuery('');
      setSearchResults([]);
      showToast('Запрос на связь отправлен', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка запроса';
      setError(message);
      showToast(message, 'error');
    }
  };

  const acceptConnection = async (connectionId: string) => {
    try {
      await api.acceptConnection(connectionId);
      emitDataChanged();
      showToast('Связь подтверждена', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка принятия';
      setError(message);
      showToast(message, 'error');
    }
  };

  const declineConnection = async (connectionId: string) => {
    try {
      await api.declineConnection(connectionId);
      emitDataChanged();
      showToast('Запрос отклонен', 'info');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка отклонения';
      setError(message);
      showToast(message, 'error');
    }
  };

  const deleteConnection = async (connectionId: string) => {
    try {
      await api.deleteConnection(connectionId);
      emitDataChanged();
      showToast('Связь удалена', 'info');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка удаления связи';
      setError(message);
      showToast(message, 'error');
    }
  };

  const updateMyColor = async (color: string) => {
    try {
      await api.updateMyColor(color);
      emitDataChanged();
      showToast('Цвет сохранен', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка сохранения цвета';
      setError(message);
      showToast(message, 'error');
    }
  };

  const updatePrivacy = async (
    connectionId: string,
    visibility: 'full' | 'busy_only'
  ) => {
    try {
      await api.updateConnectionPrivacy(connectionId, visibility);
      emitDataChanged();
      showToast('Приватность обновлена', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка сохранения приватности';
      setError(message);
      showToast(message, 'error');
    }
  };

  const saveProfile = async () => {
    try {
      await api.updateProfile({
        name: profileName,
        username: profileUsername,
      });
      emitDataChanged();
      showToast('Профиль обновлен', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка обновления профиля';
      setError(message);
      showToast(message, 'error');
    }
  };

  const changePassword = async () => {
    try {
      await api.changePassword({
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      showToast('Пароль обновлен', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка смены пароля';
      setError(message);
      showToast(message, 'error');
    }
  };

  const acceptedSorted = useMemo(() => {
    return [...(connections?.accepted ?? [])].sort((a, b) =>
      (a.otherUser?.username ?? '').localeCompare(b.otherUser?.username ?? '')
    );
  }, [connections]);

  return (
    <div>
      <h2>Люди</h2>

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      <section className="panel">
        <h3>Мой профиль</h3>

        <div style={{ display: 'grid', gap: 10 }}>
          <label>
            Display name:
            <input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Как тебя будут видеть люди"
            />
          </label>

          <label>
            Username:
            <input
              value={profileUsername}
              onChange={(e) => setProfileUsername(e.target.value.toLowerCase())}
              placeholder="Уникальный ник"
            />
          </label>

          <div style={{ color: 'var(--muted)', fontSize: 12 }}>
            Username должен быть уникальным, 3–20 символов, только: a-z, 0-9, _ .
          </div>

          <div>
            <button onClick={saveProfile}>Сохранить профиль</button>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>Сменить пароль</h3>

        <div style={{ display: 'grid', gap: 10 }}>
          <label>
            Текущий пароль:
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>

          <label>
            Новый пароль:
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>

          <div>
            <button onClick={changePassword}>Обновить пароль</button>
          </div>
        </div>
      </section>

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
          <strong>
            {currentUser?.name ?? 'Я'} @{currentUser?.username ?? ''}
          </strong>
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
          placeholder="Поиск по username..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ marginBottom: 12, maxWidth: '100%' }}
        />

        <div style={{ display: 'grid', gap: 8 }}>
          {query && searchResults.length === 0 && <p>Никого не найдено.</p>}

          {searchResults.map((user) => (
            <div key={user.id} className="mini-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <strong>@{user.username}</strong>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>{user.name}</div>
                </div>
                <button onClick={() => requestConnection(user.id)}>Отправить запрос</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>Подтвержденные связи</h3>
        {!acceptedSorted.length && <p>Пока нет.</p>}
        <div style={{ display: 'grid', gap: 8 }}>
          {acceptedSorted.map((item, index) => {
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
                    <div>
                      <strong>@{user.username}</strong>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{user.name}</div>
                    </div>
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
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Входящие
          {!!connections?.incomingPending.length && (
            <span className="badge">{connections.incomingPending.length}</span>
          )}
        </h3>
        {!connections?.incomingPending.length && <p>Пока нет.</p>}
        <div style={{ display: 'grid', gap: 8 }}>
          {connections?.incomingPending.map((item) => (
            <div key={item.id} className="mini-card">
              <div>
                <strong>@{item.otherUser?.username}</strong>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{item.otherUser?.name}</div>
              </div>
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
              <strong>@{item.otherUser?.username}</strong>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{item.otherUser?.name}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
