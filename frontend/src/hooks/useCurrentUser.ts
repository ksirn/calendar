import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { subscribeDataChanged } from '../lib/dataEvents';
import type { User } from '../types';

const STORAGE_KEY = 'calendar-mvp-current-user-id';

export function useCurrentUser() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');

        const data = (await api.getUsers()) as User[];
        setUsers(data);

        if (!data.length) {
          setError('Сервер вернул пустой список пользователей');
          return;
        }

        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved && data.some((u) => u.id === saved)) {
          setCurrentUserId(saved);
        } else {
          setCurrentUserId(data[0].id);
          localStorage.setItem(STORAGE_KEY, data[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить пользователей');
      } finally {
        setLoading(false);
      }
    }

    load();
    const unsub = subscribeDataChanged(load);
    return unsub;
  }, []);

  const setUser = (userId: string) => {
    setCurrentUserId(userId);
    localStorage.setItem(STORAGE_KEY, userId);
  };

  const currentUser = users.find((u) => u.id === currentUserId) ?? null;

  return {
    users,
    currentUser,
    currentUserId,
    setUser,
    loading,
    error,
  };
}