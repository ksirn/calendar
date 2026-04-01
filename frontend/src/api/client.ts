const API_BASE = 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
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
  getUsers: () => request('/users'),

  updateUserColor: (userId: string, preferredColor: string) =>
    request(`/users/${userId}/color`, {
      method: 'PATCH',
      body: JSON.stringify({ preferredColor }),
    }),

  getConnections: (userId: string) =>
    request(`/connections?userId=${encodeURIComponent(userId)}`),

  createConnectionRequest: (requesterUserId: string, targetUserId: string) =>
    request('/connections/request', {
      method: 'POST',
      body: JSON.stringify({ requesterUserId, targetUserId }),
    }),

  acceptConnection: (connectionId: string, userId: string) =>
    request(`/connections/${connectionId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  declineConnection: (connectionId: string, userId: string) =>
    request(`/connections/${connectionId}/decline`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  updateConnectionPrivacy: (
    connectionId: string,
    userId: string,
    visibility: 'full' | 'busy_only'
  ) =>
    request(`/connections/${connectionId}/privacy`, {
      method: 'PATCH',
      body: JSON.stringify({ userId, visibility }),
    }),

  deleteConnection: (connectionId: string, userId: string) =>
    request(`/connections/${connectionId}?userId=${encodeURIComponent(userId)}`, {
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
};