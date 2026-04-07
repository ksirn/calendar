export type User = {
  id: string;
  username: string;
  name: string;
  preferredColor: string | null;
  createdAt: string;
};

export type ConnectionItem = {
  id: string;
  status: string;
  requestedByUserId: string;
  visibility: 'full' | 'busy_only';
  createdAt: string;
  respondedAt: string | null;
  otherUser: {
    id: string;
    username: string;
    name: string;
    preferredColor?: string | null;
  } | null;
};

export type ConnectionsResponse = {
  accepted: ConnectionItem[];
  incomingPending: ConnectionItem[];
  outgoingPending: ConnectionItem[];
};

export type EventItem = {
  id: string;
  creatorId: string;
  ownerUserId: string;
  title: string;
  emoji: string | null;
  description: string | null;
  startAt: string;
  endAt: string;
  blockType: 'hard' | 'soft';
  status: 'active' | 'needs_reschedule' | 'cancelled';
  source: string;
  parentEventId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InviteItem = {
  id: string;
  eventId: string;
  invitedUserId: string;
  inviterUserId: string;
  responseStatus: string;
  conflictType: 'none' | 'soft' | 'hard';
  conflictEventTitle?: string | null;
  createdAt: string;
  respondedAt: string | null;
  event: EventItem | null;
};

export type RescheduleItem = {
  id: string;
  userId: string;
  eventId: string;
  originalStartAt: string;
  originalEndAt: string;
  status: string;
  createdAt: string;
  event: EventItem | null;
};

export type CalendarColumnUser = {
  id: string;
  name: string;
};
