import { useMemo, useState } from 'react';

type Item = {
  id: string;
  name: string;
};

type Props = {
  open: boolean;
  title: string;
  items: Item[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
};

export function UserSelectModal({
  open,
  title,
  items,
  selectedIds,
  onToggle,
  onClose,
}: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, query]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose}>✕</button>
        </div>

        <input
          placeholder="Поиск..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ marginBottom: 12, maxWidth: '100%' }}
        />

        <div className="user-select-grid">
          {filtered.length === 0 && <div>Ничего не найдено</div>}

          {filtered.map((item) => {
            const active = selectedIds.includes(item.id);

            return (
              <button
                key={item.id}
                type="button"
                className={`select-card ${active ? 'active' : ''}`}
                onClick={() => onToggle(item.id)}
              >
                <span className={`select-card-indicator ${active ? 'active' : ''}`} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={onClose}>Готово</button>
        </div>
      </div>
    </div>
  );
}