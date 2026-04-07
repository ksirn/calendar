import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { emitDataChanged, subscribeDataChanged } from '../lib/dataEvents';
import type { InviteItem } from '../types';
import { useToast } from '../components/ToastProvider';

type Props = {
  currentUserId: string;
};

function conflictLabel(invite: InviteItem) {
  if (invite.conflictType === 'hard') {
    return invite.conflictEventTitle
      ? `Жесткий конфликт: ${invite.conflictEventTitle}`
      : 'Жесткий конфликт';
  }

  if (invite.conflictType === 'soft') {
    return invite.conflictEventTitle
      ? `Нужно перенести: ${invite.conflictEventTitle}`
      : 'Нужно перенести дело';
  }

  return 'Без конфликта';
}

export function InvitesPage({ currentUserId }: Props) {
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const data = (await api.getInvites(currentUserId)) as InviteItem[];
      setInvites(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = subscribeDataChanged(load);
    return unsub;
  }, [currentUserId]);

  const accept = async (inviteId: string) => {
    try {
      await api.acceptInvite(inviteId, currentUserId);
      emitDataChanged();
      showToast('Приглашение принято', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка принятия';
      setError(message);
      showToast(message, 'error');
    }
  };

  const decline = async (inviteId: string) => {
    try {
      await api.declineInvite(inviteId, currentUserId);
      emitDataChanged();
      showToast('Приглашение отклонено', 'info');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка отклонения';
      setError(message);
      showToast(message, 'error');
    }
  };

  return (
    <div>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        Приглашения
        {invites.length > 0 && <span className="badge">{invites.length}</span>}
      </h2>

      {loading && <p>Загрузка...</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {!loading && !invites.length && <p>Приглашений пока нет.</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {invites.map((invite) => (
          <div key={invite.id} className="panel">
            <div style={{ fontWeight: 700 }}>
              {invite.event?.emoji ? `${invite.event.emoji} ` : ''}
              {invite.event?.title ?? 'Без названия'}
            </div>
            <div>Начало: {invite.event ? new Date(invite.event.startAt).toLocaleString() : '—'}</div>
            <div>Конец: {invite.event ? new Date(invite.event.endAt).toLocaleString() : '—'}</div>

            <div style={{ marginTop: 8 }}>
              <span className="badge subtle">{conflictLabel(invite)}</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => accept(invite.id)}>Принять</button>
              <button onClick={() => decline(invite.id)}>Отклонить</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}