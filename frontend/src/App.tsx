import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useTheme } from './hooks/useTheme';
import { CalendarPage } from './pages/CalendarPage';
import { InvitesPage } from './pages/InvitesPage';
import { ReschedulePage } from './pages/ReschedulePage';
import { PeoplePage } from './pages/PeoplePage';
import { useEffect, useState } from 'react';
import { api } from './api/client';
import { subscribeDataChanged } from './lib/dataEvents';
import type { InviteItem, RescheduleItem } from './types';

export default function App() {
  const { users, currentUserId, setUser, loading, error } = useCurrentUser();
  const { theme, toggleTheme } = useTheme();

  const [invitesCount, setInvitesCount] = useState(0);
  const [rescheduleCount, setRescheduleCount] = useState(0);

  useEffect(() => {
    async function loadBadges() {
      if (!currentUserId) return;

      try {
        const invites = (await api.getInvites(currentUserId)) as InviteItem[];
        const reschedule = (await api.getReschedule(currentUserId)) as RescheduleItem[];

        setInvitesCount(invites.length);
        setRescheduleCount(reschedule.length);
      } catch {
        setInvitesCount(0);
        setRescheduleCount(0);
      }
    }

    loadBadges();
    const unsub = subscribeDataChanged(loadBadges);
    return unsub;
  }, [currentUserId]);

  if (loading) {
    return <div style={{ padding: 24 }}>Загрузка...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Ошибка загрузки</h2>
        <p>{error}</p>
        <p>Проверь backend на http://localhost:3000/users</p>
      </div>
    );
  }

  if (!users.length) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Нет пользователей</h2>
        <p>Сервер вернул пустой список пользователей.</p>
      </div>
    );
  }

  if (!currentUserId) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Нет выбранного пользователя</h2>
        <p>Users loaded: {users.length}</p>
      </div>
    );
  }

  return (
    <Layout
      users={users}
      currentUserId={currentUserId}
      onChangeUser={setUser}
      theme={theme}
      onToggleTheme={toggleTheme}
      invitesCount={invitesCount}
      rescheduleCount={rescheduleCount}
    >
      <Routes>
        <Route path="/" element={<CalendarPage currentUserId={currentUserId} users={users} />} />
        <Route path="/invites" element={<InvitesPage currentUserId={currentUserId} />} />
        <Route path="/reschedule" element={<ReschedulePage currentUserId={currentUserId} />} />
        <Route
          path="/people"
          element={<PeoplePage currentUserId={currentUserId} users={users} />}
        />
      </Routes>
    </Layout>
  );
}