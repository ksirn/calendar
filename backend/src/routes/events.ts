import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

function normalizePair(user1Id: string, user2Id: string) {
  return user1Id < user2Id
    ? { userAId: user1Id, userBId: user2Id }
    : { userAId: user2Id, userBId: user1Id };
}

async function hasAcceptedConnection(user1Id: string, user2Id: string): Promise<boolean> {
  const { userAId, userBId } = normalizePair(user1Id, user2Id);

  const connection = await prisma.connection.findFirst({
    where: {
      userAId,
      userBId,
      status: 'accepted',
    },
  });

  return Boolean(connection);
}

function parseParticipants(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item: unknown) => String(item ?? '').trim())
    .filter((item: string) => item.length > 0);
}

function hasTimeOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

async function findConflictingEvent(
  ownerUserId: string,
  startAt: Date,
  endAt: Date,
  excludeEventId?: string
) {
  const events = await prisma.event.findMany({
    where: {
      ownerUserId,
      status: 'active',
      ...(excludeEventId
        ? {
            id: {
              not: excludeEventId,
            },
          }
        : {}),
    },
    orderBy: {
      startAt: 'asc',
    },
  });

  return (
    events.find((event) => hasTimeOverlap(startAt, endAt, event.startAt, event.endAt)) ?? null
  );
}

async function validateParticipants(creatorId: string, participants: string[]) {
  const uniqueParticipants = Array.from(
    new Set(participants.filter((participantId: string) => participantId !== creatorId))
  );

  for (const participantId of uniqueParticipants) {
    const participant = await prisma.user.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      throw new Error(`Participant not found: ${participantId}`);
    }

    const allowed = await hasAcceptedConnection(creatorId, participantId);

    if (!allowed) {
      throw new Error(`No accepted connection with participant ${participantId}`);
    }
  }

  return uniqueParticipants;
}

async function createSingleEvent(input: {
  creatorId: string;
  ownerUserId: string;
  title: string;
  emoji: string | null;
  description: string | null;
  startAt: Date;
  endAt: Date;
  blockType: 'hard' | 'soft';
  participants: string[];
}) {
  const {
    creatorId,
    ownerUserId,
    title,
    emoji,
    description,
    startAt,
    endAt,
    blockType,
    participants,
  } = input;

  const conflictingEvent = await findConflictingEvent(ownerUserId, startAt, endAt);

  if (conflictingEvent) {
    return {
      ok: false as const,
      error: 'Time slot is already occupied',
      conflict: {
        id: conflictingEvent.id,
        title: conflictingEvent.title,
        startAt: conflictingEvent.startAt,
        endAt: conflictingEvent.endAt,
        blockType: conflictingEvent.blockType,
        status: conflictingEvent.status,
      },
    };
  }

  const uniqueParticipants = await validateParticipants(creatorId, participants);

  const event = await prisma.event.create({
    data: {
      creatorId,
      ownerUserId,
      title,
      emoji,
      description,
      startAt,
      endAt,
      blockType,
      status: 'active',
      source: uniqueParticipants.length > 0 ? 'created_with_invites' : 'personal',
      parentEventId: null,
    },
  });

  const invites = [];

  for (const participantId of uniqueParticipants) {
    const invite = await prisma.invite.create({
      data: {
        eventId: event.id,
        invitedUserId: participantId,
        inviterUserId: creatorId,
        responseStatus: 'pending',
        conflictType: 'none',
      },
    });

    invites.push(invite);
  }

  return {
    ok: true as const,
    event,
    invites,
  };
}

// GET /events?viewerUserId=...&userIds=id1,id2,id3
// GET /events?viewerUserId=...&userIds=id1,id2,id3
router.get('/', async (req, res) => {
  try {
    const viewerUserId = String(req.query.viewerUserId ?? '').trim();
    const userIdsRaw = String(req.query.userIds ?? '').trim();

    if (!viewerUserId) {
      return res.status(400).json({ error: 'viewerUserId is required' });
    }

    const requestedUserIds = userIdsRaw
      ? userIdsRaw
          .split(',')
          .map((id: string) => id.trim())
          .filter((id: string) => id.length > 0)
      : [viewerUserId];

    const uniqueRequestedUserIds = Array.from(new Set(requestedUserIds));
    const allowedUserIds: string[] = [];

    for (const userId of uniqueRequestedUserIds) {
      if (userId === viewerUserId) {
        allowedUserIds.push(userId);
        continue;
      }

      const allowed = await hasAcceptedConnection(viewerUserId, userId);
      if (allowed) {
        allowedUserIds.push(userId);
      }
    }

    const events = await prisma.event.findMany({
      where: {
        ownerUserId: {
          in: allowedUserIds,
        },
        status: {
          not: 'cancelled',
        },
      },
      orderBy: {
        startAt: 'asc',
      },
    });

    const otherUserIds = allowedUserIds.filter((id) => id !== viewerUserId);

    const connections = otherUserIds.length
      ? await prisma.connection.findMany({
          where: {
            OR: otherUserIds.map((otherUserId) => {
              const { userAId, userBId } = normalizePair(viewerUserId, otherUserId);
              return { userAId, userBId };
            }),
            status: 'accepted',
          },
        })
      : [];

    const connectionMap = new Map<string, typeof connections[number]>();

    for (const connection of connections) {
      const otherUserId =
        connection.userAId === viewerUserId ? connection.userBId : connection.userAId;
      connectionMap.set(otherUserId, connection);
    }

    const maskedEvents = events.map((event) => {
      if (event.ownerUserId === viewerUserId) {
        return event;
      }

      const connection = connectionMap.get(event.ownerUserId);

      if (!connection) {
        return event;
      }

      const visibility =
        connection.userAId === event.ownerUserId
          ? connection.visibilityForA
          : connection.visibilityForB;

      if (visibility === 'full') {
        return event;
      }

      return {
        ...event,
        title: event.blockType === 'soft' ? 'Занят, но могу перенести' : 'Занят',
        emoji: null,
        description: null,
      };
    });

    return res.json(maskedEvents);
  } catch (error) {
    console.error('GET /events error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /events
router.post('/', async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const creatorId = String(body.creatorId ?? '').trim();
    const ownerUserId = String(body.ownerUserId ?? '').trim();
    const title = String(body.title ?? '').trim();
    const emojiRaw = String(body.emoji ?? '').trim();
    const emoji = emojiRaw || null;

    const descriptionValue = body.description;
    const description =
      descriptionValue === undefined || descriptionValue === null
        ? null
        : String(descriptionValue);

    const startAtRaw = String(body.startAt ?? '').trim();
    const endAtRaw = String(body.endAt ?? '').trim();
    const blockType = String(body.blockType ?? '').trim();
    const participants = parseParticipants(body.participants);

    if (!creatorId || !ownerUserId || !title || !startAtRaw || !endAtRaw || !blockType) {
      return res.status(400).json({
        error: 'creatorId, ownerUserId, title, startAt, endAt, blockType are required',
      });
    }

    if (creatorId !== ownerUserId) {
      return res.status(400).json({
        error: 'For MVP creatorId must be equal to ownerUserId',
      });
    }

    if (blockType !== 'hard' && blockType !== 'soft') {
      return res.status(400).json({
        error: 'blockType must be hard or soft',
      });
    }

    const startAt = new Date(startAtRaw);
    const endAt = new Date(endAtRaw);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return res.status(400).json({ error: 'Invalid startAt or endAt' });
    }

    if (endAt <= startAt) {
      return res.status(400).json({ error: 'endAt must be after startAt' });
    }

    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
    });

    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const result = await createSingleEvent({
      creatorId,
      ownerUserId,
      title,
      emoji,
      description,
      startAt,
      endAt,
      blockType: blockType as 'hard' | 'soft',
      participants,
    });

    if (!result.ok) {
      return res.status(409).json(result);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error('POST /events error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// POST /events/bulk
router.post('/bulk', async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const creatorId = String(body.creatorId ?? '').trim();
    const ownerUserId = String(body.ownerUserId ?? '').trim();
    const title = String(body.title ?? '').trim();
    const emojiRaw = String(body.emoji ?? '').trim();
    const emoji = emojiRaw || null;

    const descriptionValue = body.description;
    const description =
      descriptionValue === undefined || descriptionValue === null
        ? null
        : String(descriptionValue);

    const blockType = String(body.blockType ?? '').trim();
    const participants = parseParticipants(body.participants);
    const occurrences = Array.isArray(body.occurrences) ? body.occurrences : [];

    if (!creatorId || !ownerUserId || !title || !blockType || occurrences.length === 0) {
      return res.status(400).json({
        error: 'creatorId, ownerUserId, title, blockType and occurrences are required',
      });
    }

    if (creatorId !== ownerUserId) {
      return res.status(400).json({
        error: 'For MVP creatorId must be equal to ownerUserId',
      });
    }

    if (blockType !== 'hard' && blockType !== 'soft') {
      return res.status(400).json({
        error: 'blockType must be hard or soft',
      });
    }

    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
    });

    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    await validateParticipants(creatorId, participants);

    const created: Array<unknown> = [];
    const skipped: Array<unknown> = [];

    for (const occurrence of occurrences) {
      const item = occurrence as Record<string, unknown>;
      const startAtRaw = String(item.startAt ?? '').trim();
      const endAtRaw = String(item.endAt ?? '').trim();

      const startAt = new Date(startAtRaw);
      const endAt = new Date(endAtRaw);

      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
        skipped.push({
          startAt: startAtRaw,
          endAt: endAtRaw,
          error: 'Invalid occurrence range',
        });
        continue;
      }

      const result = await createSingleEvent({
        creatorId,
        ownerUserId,
        title,
        emoji,
        description,
        startAt,
        endAt,
        blockType: blockType as 'hard' | 'soft',
        participants,
      });

      if (result.ok) {
        created.push(result);
      } else {
        skipped.push({
          startAt: startAtRaw,
          endAt: endAtRaw,
          error: result.error,
          conflict: result.conflict,
        });
      }
    }

    return res.json({
      ok: true,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    });
  } catch (error) {
    console.error('POST /events/bulk error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// PATCH /events/:id
router.patch('/:id', async (req, res) => {
  try {
    const eventId = String(req.params.id ?? '').trim();
    const body = (req.body ?? {}) as Record<string, unknown>;

    const userId = String(body.userId ?? '').trim();
    const title = String(body.title ?? '').trim();
    const emojiRaw = String(body.emoji ?? '').trim();
    const emoji = emojiRaw || null;

    const description =
      body.description === undefined || body.description === null
        ? null
        : String(body.description);

    const startAtRaw = String(body.startAt ?? '').trim();
    const endAtRaw = String(body.endAt ?? '').trim();
    const blockType = String(body.blockType ?? '').trim();

    if (!eventId || !userId || !title || !startAtRaw || !endAtRaw || !blockType) {
      return res.status(400).json({
        error: 'eventId, userId, title, startAt, endAt, blockType are required',
      });
    }

    if (blockType !== 'hard' && blockType !== 'soft') {
      return res.status(400).json({ error: 'blockType must be hard or soft' });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.ownerUserId !== userId) {
      return res.status(403).json({ error: 'No access to edit this event' });
    }

    const startAt = new Date(startAtRaw);
    const endAt = new Date(endAtRaw);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return res.status(400).json({ error: 'Invalid startAt or endAt' });
    }

    if (endAt <= startAt) {
      return res.status(400).json({ error: 'endAt must be after startAt' });
    }

    const conflictingEvent = await findConflictingEvent(userId, startAt, endAt, eventId);

    if (conflictingEvent) {
      return res.status(409).json({
        error: 'Time slot is already occupied',
        conflict: {
          id: conflictingEvent.id,
          title: conflictingEvent.title,
          startAt: conflictingEvent.startAt,
          endAt: conflictingEvent.endAt,
          blockType: conflictingEvent.blockType,
          status: conflictingEvent.status,
        },
      });
    }

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        title,
        emoji,
        description,
        startAt,
        endAt,
        blockType,
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error('PATCH /events/:id error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /events/:id?userId=...
router.delete('/:id', async (req, res) => {
  try {
    const eventId = String(req.params.id ?? '').trim();
    const userId = String(req.query.userId ?? '').trim();

    if (!eventId || !userId) {
      return res.status(400).json({ error: 'eventId and userId are required' });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.ownerUserId !== userId) {
      return res.status(403).json({ error: 'No access to delete this event' });
    }

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        status: 'cancelled',
      },
    });

    return res.json({ ok: true, event: updated });
  } catch (error) {
    console.error('DELETE /events/:id error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;