import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { api } from '../api/client';

type Props = {
  children: ReactNode;
  currentUserName: string;
  currentUsername: string;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  invitesCount: number;
  rescheduleCount: number;
  peopleCount: number;
};

type NavItem = {
  to: string;
  label: string;
  badgeKey?: 'invites' | 'reschedule' | 'people';
};

const navItems: NavItem[] = [
  { to: '/', label: 'Календарь' },
  { to: '/invites', label: 'Приглашения', badgeKey: 'invites' },
  { to: '/reschedule', label: 'Перенести', badgeKey: 'reschedule' },
  { to: '/people', label: 'Люди', badgeKey: 'people' },
];

export function Layout({
  children,
  currentUserName,
  currentUsername,
  theme,
  onToggleTheme,
  invitesCount,
  rescheduleCount,
  peopleCount,
}: Props) {
  const location = useLocation();

  const getBadgeValue = (badgeKey?: 'invites' | 'reschedule' | 'people') => {
    if (badgeKey === 'invites') return invitesCount;
    if (badgeKey === 'reschedule') return rescheduleCount;
    if (badgeKey === 'people') return peopleCount;
    return 0;
  };

  const logout = async () => {
    await api.logout();
    window.location.reload();
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
      <header className="panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ margin: '0 0 12px' }}>Календарь</h1>
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>
              Вы вошли как: <strong>{currentUserName}</strong> @{currentUsername}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={onToggleTheme}>
              Тема: {theme === 'dark' ? 'Темная' : 'Светлая'}
            </button>
            <button onClick={logout}>Выйти</button>
          </div>
        </div>
      </header>

      <nav style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          const badgeValue = getBadgeValue(item.badgeKey);

          return (
            <Link
              key={item.to}
              to={item.to}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                textDecoration: 'none',
                color: 'var(--text)',
                background: isActive ? 'var(--link-active)' : 'var(--link-bg)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{item.label}</span>
              {badgeValue > 0 && <span className="badge">{badgeValue}</span>}
            </Link>
          );
        })}
      </nav>

      <main>{children}</main>
    </div>
  );
}
