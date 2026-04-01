import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { User } from '../types';

type Props = {
  children: ReactNode;
  users: User[];
  currentUserId: string;
  onChangeUser: (userId: string) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  invitesCount: number;
  rescheduleCount: number;
};

const navItems = [
  { to: '/', label: 'Календарь' },
  { to: '/invites', label: 'Приглашения', badgeKey: 'invites' },
  { to: '/reschedule', label: 'Перенести', badgeKey: 'reschedule' },
  { to: '/people', label: 'Люди' },
] as const;

export function Layout({
  children,
  users,
  currentUserId,
  onChangeUser,
  theme,
  onToggleTheme,
  invitesCount,
  rescheduleCount,
}: Props) {
  const location = useLocation();

  const getBadgeValue = (badgeKey?: string) => {
    if (badgeKey === 'invites') return invitesCount;
    if (badgeKey === 'reschedule') return rescheduleCount;
    return 0;
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
            <h1 style={{ margin: '0 0 12px' }}>Calendar MVP</h1>

            <label>
              Текущий пользователь:{' '}
              <select value={currentUserId} onChange={(e) => onChangeUser(e.target.value)}>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button onClick={onToggleTheme}>
            Тема: {theme === 'dark' ? 'Темная' : 'Светлая'}
          </button>
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