import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { subscribeDataChanged } from '../lib/dataEvents';
import type { User } from '../types';

export function useCurrentUser() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');

        const me = (await api.me()) as User | null;

        if (!me) {
          setIsAuthenticated(false);
          setUsers([]);
          setCurrentUserId('');
          return;
        }

        setIsAuthenticated(true);
        setCurrentUserId(me.id);

        const allUsers = (await api.getUsers()) as User[];
        setUsers(allUsers);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить пользователя');
      } finally {
        setLoading(false);
      }
    }

    load();
    const unsub = subscribeDataChanged(load);
    return unsub;
  }, []);

  const currentUser = users.find((u) => u.id === currentUserId) ?? null;

  return {
    users,
    currentUser,
    currentUserId,
    setUser: () => {},
    loading,
    error,
    isAuthenticated,
  };
}
