import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useTheme } from './hooks/useTheme';
import { CalendarPage } from './pages/CalendarPage';
import { InvitesPage } from './pages/InvitesPage';
import { ReschedulePage } from './pages/ReschedulePage';
import { PeoplePage } from './pages/PeoplePage';
import { AuthPage } from './pages/AuthPage';
import { useEffect, useState } from 'react';
import { api } from './api/client';
import { subscribeDataChanged } from './lib/dataEvents';
import type { ConnectionsResponse, InviteItem, RescheduleItem } from './types';

export default function App() {
  const {
    users,
    currentUser,
    currentUserId,
    loading,
    error,
    isAuthenticated,
  } = useCurrentUser();
  const { theme, toggleTheme } = useTheme();

  const [invitesCount, setInvitesCount] = useState(0);
  const [rescheduleCount, setRescheduleCount] = useState(0);
  const [peopleCount, setPeopleCount] = useState(0);

  useEffect(() => {
    async function loadBadges() {
      if (!currentUserId) return;

      try {
        const invites = (await api.getInvites(currentUserId)) as InviteItem[];
        const reschedule = (await api.getReschedule(currentUserId)) as RescheduleItem[];
        const connections = (await api.getConnections()) as ConnectionsResponse;

        setInvitesCount(invites.length);
        setRescheduleCount(reschedule.length);
        setPeopleCount(connections.incomingPending.length);
      } catch {
        setInvitesCount(0);
        setRescheduleCount(0);
        setPeopleCount(0);
      }
    }

    loadBadges();
    const unsub = subscribeDataChanged(loadBadges);
    return unsub;
  }, [currentUserId]);

  if (loading) {
    return <div style={{ padding: 24 }}>Загрузка...</div>;
  }

  if (!isAuthenticated) {
    return <AuthPage onAuthSuccess={() => window.location.reload()} />;
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Ошибка загрузки</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!currentUser || !currentUserId) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Пользователь не найден</h2>
      </div>
    );
  }

  return (
    <Layout
      currentUserName={currentUser.name}
      currentUsername={currentUser.username}
      theme={theme}
      onToggleTheme={toggleTheme}
      invitesCount={invitesCount}
      rescheduleCount={rescheduleCount}
      peopleCount={peopleCount}
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
