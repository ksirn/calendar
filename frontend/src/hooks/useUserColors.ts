import type { User } from '../types';

const DEFAULT_COLORS = [
  '#5b8def',
  '#52c41a',
  '#fa8c16',
  '#eb2f96',
  '#13c2c2',
  '#722ed1',
  '#ef4444',
  '#14b8a6',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#ec4899',
  '#3b82f6',
  '#10b981',
];

export function useUserColors(users: User[]) {
  const getColor = (userId: string, fallbackIndex = 0) => {
    const user = users.find((u) => u.id === userId);
    return user?.preferredColor || DEFAULT_COLORS[fallbackIndex % DEFAULT_COLORS.length];
  };

  return {
    getColor,
    defaultColors: DEFAULT_COLORS,
  };
}