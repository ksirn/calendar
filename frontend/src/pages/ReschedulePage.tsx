import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { emitDataChanged, subscribeDataChanged } from '../lib/dataEvents';
import type { RescheduleItem } from '../types';
import { useToast } from '../components/ToastProvider';

type Props = {
  currentUserId: string;
};

export function ReschedulePage({ currentUserId }: Props) {
  const [items, setItems] = useState<RescheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [moveDates, setMoveDates] = useState<Record<string, string>>({});
  const { showToast } = useToast();

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const data = (await api.getReschedule(currentUserId)) as RescheduleItem[];
      setItems(data);
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

  const move = async (itemId: string) => {
    const newStartAt = moveDates[itemId];
    if (!newStartAt) {
      const msg = 'Укажи новое время';
      setError(msg);
      showToast(msg, 'error');
      return;
    }

    try {
      await api.moveReschedule(itemId, currentUserId, new Date(newStartAt).toISOString());
      emitDataChanged();
      showToast('Событие перенесено', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка переноса';
      setError(msg);
      showToast(msg, 'error');
    }
  };

  const dismiss = async (itemId: string) => {
    try {
      await api.dismissReschedule(itemId, currentUserId);
      emitDataChanged();
      showToast('Событие отменено', 'info');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка отмены';
      setError(msg);
      showToast(msg, 'error');
    }
  };

  return (
    <div>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        Перенести
        {items.length > 0 && <span className="badge">{items.length}</span>}
      </h2>

      {loading && <p>Загрузка...</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {!loading && !items.length && <p>Список пересогласования пуст.</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        {items.map((item) => (
          <div key={item.id} className="panel">
            <div style={{ fontWeight: 700 }}>
              {item.event?.emoji ? `${item.event.emoji} ` : ''}
              {item.event?.title ?? 'Событие'}
            </div>
            <div>Старое начало: {new Date(item.originalStartAt).toLocaleString()}</div>
            <div>Старый конец: {new Date(item.originalEndAt).toLocaleString()}</div>

            <div style={{ marginTop: 8 }}>
              <span className="badge subtle">Требует пересогласования</span>
            </div>

            <div style={{ marginTop: 10 }}>
              <input
                type="datetime-local"
                value={moveDates[item.id] ?? ''}
                onChange={(e) =>
                  setMoveDates((prev) => ({ ...prev, [item.id]: e.target.value }))
                }
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => move(item.id)}>Перенести</button>
              <button onClick={() => dismiss(item.id)}>Отменить</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}