import { useState } from 'react';
import { api } from '../api/client';

type Props = {
  onAuthSuccess: () => void;
};

export function AuthPage({ onAuthSuccess }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    try {
      setError('');

      if (mode === 'login') {
        await api.login({ username, password });
      } else {
        await api.register({
          username,
          name: name || username,
          password,
        });
      }

      onAuthSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка авторизации');
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>
          {mode === 'login' ? 'Вход' : 'Регистрация'}
        </h2>

        <div style={{ display: 'grid', gap: 10 }}>
          <label>
            Username:
            <input
              placeholder="например: misha_01"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
            />
          </label>

          {mode === 'register' && (
            <label>
              Display name:
              <input
                placeholder="Например: Миша"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}

          <label>
            Пароль:
            <input
              type="password"
              placeholder="Не меньше 6 символов"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            Username должен быть уникальным, 3–20 символов, только: a-z, 0-9, _ .
          </div>

          {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={submit}>
              {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </button>

            <button
              onClick={() =>
                setMode((prev) => (prev === 'login' ? 'register' : 'login'))
              }
            >
              {mode === 'login' ? 'Нужна регистрация' : 'Уже есть аккаунт'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
