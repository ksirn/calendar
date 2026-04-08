import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { emitDataChanged, subscribeDataChanged } from '../lib/dataEvents';
import type { InviteItem, OutgoingInviteGroup } from '../types';
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

function statusLabel(status: string) {
  if (status === 'accepted') return '✓ Принял';
  if (status === 'declined') return '✗ Отклонил';
  return '⏳ Ожидает';
}

function statusColor(status: string) {
  if (status === 'accepted') return 'var(--success, #22c55e)';
  if (status === 'declined') return 'var(--danger)';
  return 'var(--muted)';
}

export function InvitesPage({ currentUserId }: Props) {
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingInviteGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [addingToCalendar, setAddingToCalendar] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const [incomingData, outgoingData] = await Promise.all([
        api.getInvites(currentUserId) as Promise<InviteItem[]>,
        api.getOutgoingInvites() as Promise<OutgoingInviteGroup[]>,
      ]);
      setInvites(incomingData);
      setOutgoing(outgoingData);
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

  // Добавить событие в свой календарь (когда все отклонили)
  const addEventToCalendar = async (group: OutgoingInviteGroup) => {
    setAddingToCalendar(group.event.id);
    try {
      await api.createEvent({
        creatorId: currentUserId,
        ownerUserId: currentUserId,
        title: group.event.title,
        emoji: group.event.emoji,
        description: group.event.description,
        startAt: group.event.startAt,
        endAt: group.event.endAt,
        blockType: group.event.blockType,
        participants: [],
      });
      emitDataChanged();
      showToast('Событие добавлено в ваш календарь', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Ошибка', 'error');
    } finally {
      setAddingToCalendar(null);
    }
  };

  const totalIncoming = invites.length;
  const totalOutgoing = outgoing.length;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: active ? 'var(--link-active)' : 'var(--link-bg)',
    color: 'var(--text)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 14,
  });

  return (
    <div>
      <h2>Приглашения</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button style={tabStyle(tab === 'incoming')} onClick={() => setTab('incoming')}>
          Входящие
          {totalIncoming > 0 && <span className="badge">{totalIncoming}</span>}
        </button>
        <button style={tabStyle(tab === 'outgoing')} onClick={() => setTab('outgoing')}>
          Исходящие
          {totalOutgoing > 0 && <span className="badge">{totalOutgoing}</span>}
        </button>
      </div>

      {loading && <p>Загрузка...</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {/* Incoming */}
      {tab === 'incoming' && !loading && (
        <div style={{ display: 'grid', gap: 12 }}>
          {!invites.length && <p>Входящих приглашений нет.</p>}
          {invites.map((invite) => (
            <div key={invite.id} className="panel">
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {invite.event?.emoji ? `${invite.event.emoji} ` : ''}
                {invite.event?.title ?? 'Без названия'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {invite.event
                  ? `${new Date(invite.event.startAt).toLocaleString()} — ${new Date(invite.event.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : '—'}
              </div>

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
      )}

      {/* Outgoing */}
      {tab === 'outgoing' && !loading && (
        <div style={{ display: 'grid', gap: 12 }}>
          {!outgoing.length && <p>Исходящих приглашений нет.</p>}
          {outgoing.map((group) => (
            <div key={group.event.id} className="panel">
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {group.event.emoji ? `${group.event.emoji} ` : ''}
                {group.event.title}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                {new Date(group.event.startAt).toLocaleString()} —{' '}
                {new Date(group.event.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>

              {/* Статусы участников */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                {group.invites.map((inv) => (
                  <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ color: 'var(--muted)' }}>
                      {inv.invitedUser?.name ?? inv.invitedUserId}
                    </span>
                    <span style={{ color: statusColor(inv.responseStatus), fontSize: 12 }}>
                      {statusLabel(inv.responseStatus)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Если никто не принял и все отклонили — предлагаем добавить себе */}
              {group.allDeclined && !group.anyAccepted && (
                <div style={{
                  padding: '8px 12px',
                  background: 'var(--muted-bg, rgba(128,128,128,0.1))',
                  borderRadius: 8,
                  fontSize: 13,
                  marginTop: 4,
                }}>
                  <div style={{ marginBottom: 8, color: 'var(--muted)' }}>
                    Все участники отклонили. Хотите добавить событие в свой календарь?
                  </div>
                  <button
                    onClick={() => addEventToCalendar(group)}
                    disabled={addingToCalendar === group.event.id}
                  >
                    {addingToCalendar === group.event.id ? 'Добавляю...' : 'Добавить в мой календарь'}
                  </button>
                </div>
              )}

              {/* Если есть ожидающие */}
              {group.pendingCount > 0 && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Ожидает ответа: {group.pendingCount}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
