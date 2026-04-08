const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'Request failed');
  }

  return data as T;
}

export const api = {
  register: (payload: { username: string; name: string; password: string }) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { username: string; password: string }) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    request('/auth/logout', {
      method: 'POST',
    }),

  me: () => request('/auth/me'),

  updateProfile: (payload: { username: string; name: string }) =>
    request('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    request('/auth/password', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getUsers: () => request('/users'),

  updateMyColor: (preferredColor: string) =>
    request('/users/me/color', {
      method: 'PATCH',
      body: JSON.stringify({ preferredColor }),
    }),

  getConnections: () => request('/connections'),

  searchConnectionCandidates: (q: string) =>
    request(`/connections/search?q=${encodeURIComponent(q)}`),

  createConnectionRequest: (targetUserId: string) =>
    request('/connections/request', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),

  acceptConnection: (connectionId: string) =>
    request(`/connections/${connectionId}/accept`, {
      method: 'POST',
    }),

  declineConnection: (connectionId: string) =>
    request(`/connections/${connectionId}/decline`, {
      method: 'POST',
    }),

  updateConnectionPrivacy: (
    connectionId: string,
    visibility: 'full' | 'busy_only'
  ) =>
    request(`/connections/${connectionId}/privacy`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility }),
    }),

  deleteConnection: (connectionId: string) =>
    request(`/connections/${connectionId}`, {
      method: 'DELETE',
    }),

  getEvents: (viewerUserId: string, userIds: string[]) =>
    request(
      `/events?viewerUserId=${encodeURIComponent(viewerUserId)}&userIds=${encodeURIComponent(
        userIds.join(',')
      )}`
    ),

  createEvent: (payload: unknown) =>
    request('/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createEventsBulk: (payload: unknown) =>
    request('/events/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateEvent: (eventId: string, payload: unknown) =>
    request(`/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteEvent: (eventId: string, userId: string) =>
    request(`/events/${eventId}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    }),

  getInvites: (userId: string) =>
    request(`/invites?userId=${encodeURIComponent(userId)}`),

  acceptInvite: (inviteId: string, userId: string) =>
    request(`/invites/${inviteId}/accept?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
    }),

  declineInvite: (inviteId: string, userId: string) =>
    request(`/invites/${inviteId}/decline?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
    }),

  getReschedule: (userId: string) =>
    request(`/reschedule?userId=${encodeURIComponent(userId)}`),

  moveReschedule: (itemId: string, userId: string, newStartAt: string) =>
    request(`/reschedule/${itemId}/move?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: JSON.stringify({ newStartAt }),
    }),

  dismissReschedule: (itemId: string, userId: string) =>
    request(`/reschedule/${itemId}/dismiss?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
    }),

  getTodos: () => request('/todos'),

  createTodo: (payload: { title: string; description?: string; deadline?: string; targetUserId?: string }) =>
    request('/todos', { method: 'POST', body: JSON.stringify(payload) }),

  updateTodo: (todoId: string, payload: Record<string, unknown>) =>
    request(`/todos/${todoId}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  scheduleTodo: (todoId: string, payload: { startAt: string; endAt: string }) =>
    request(`/todos/${todoId}/schedule`, { method: 'POST', body: JSON.stringify(payload) }),

  deleteTodo: (todoId: string) =>
    request(`/todos/${todoId}`, { method: 'DELETE' }),

  cancelTodo: (todoId: string) =>
    request(`/todos/${todoId}/cancel`, { method: 'POST' }),

  getOutgoingInvites: () => request('/invites/outgoing'),
};
