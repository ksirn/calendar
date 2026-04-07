import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

function hasTimeOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
) {
  return aStart < bEnd && aEnd > bStart;
}

function readUserId(req: any): string {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const fromBody = String(body.userId ?? '').trim();
  const fromQuery = String(req.query.userId ?? '').trim();

  return fromBody || fromQuery;
}

async function detectConflict(userId: string, eventId: string): Promise<{
  conflictType: 'none' | 'soft' | 'hard';
  conflictEventTitle: string | null;
}> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    return { conflictType: 'none', conflictEventTitle: null };
  }

  const userEvents = await prisma.event.findMany({
    where: {
      ownerUserId: userId,
      status: 'active',
    },
    orderBy: {
      startAt: 'asc',
    },
  });

  let softConflictTitle: string | null = null;

  for (const e of userEvents) {
    if (hasTimeOverlap(event.startAt, event.endAt, e.startAt, e.endAt)) {
      if (e.blockType === 'hard') {
        return {
          conflictType: 'hard',
          conflictEventTitle: e.title,
        };
      }

      if (!softConflictTitle) {
        softConflictTitle = e.title;
      }
    }
  }

  if (softConflictTitle) {
    return {
      conflictType: 'soft',
      conflictEventTitle: softConflictTitle,
    };
  }

  return {
    conflictType: 'none',
    conflictEventTitle: null,
  };
}

// GET /invites?userId=...
router.get('/', async (req, res) => {
  try {
    const userId = String(req.query.userId ?? '').trim();

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const invites = await prisma.invite.findMany({
      where: {
        invitedUserId: userId,
        responseStatus: 'pending',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const events = await prisma.event.findMany({
      where: {
        id: { in: invites.map((i) => i.eventId) },
      },
    });

    const eventMap = new Map(events.map((e) => [e.id, e]));

    const result = await Promise.all(
      invites.map(async (invite) => {
        const event = eventMap.get(invite.eventId) ?? null;
        const liveConflict = event
          ? await detectConflict(userId, invite.eventId)
          : { conflictType: 'none' as const, conflictEventTitle: null };

        return {
          ...invite,
          conflictType: liveConflict.conflictType,
          conflictEventTitle: liveConflict.conflictEventTitle,
          event,
        };
      })
    );

    return res.json(result);
  } catch (error) {
    console.error('GET /invites error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /invites/:id/accept
router.post('/:id/accept', async (req, res) => {
  try {
    const inviteId = String(req.params.id ?? '').trim();
    const userId = readUserId(req);

    if (!inviteId || !userId) {
      return res.status(400).json({ error: 'inviteId and userId are required' });
    }

    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    if (invite.invitedUserId !== userId) {
      return res.status(403).json({ error: 'No access to this invite' });
    }

    if (invite.responseStatus !== 'pending') {
      return res.status(400).json({ error: 'Invite already processed' });
    }

    const event = await prisma.event.findUnique({
      where: { id: invite.eventId },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const userEvents = await prisma.event.findMany({
      where: {
        ownerUserId: userId,
        status: 'active',
      },
    });

    let hasHardConflict = false;
    const softConflicts: typeof userEvents = [];
    let hardConflictTitle: string | null = null;

    for (const e of userEvents) {
      if (hasTimeOverlap(event.startAt, event.endAt, e.startAt, e.endAt)) {
        if (e.blockType === 'hard') {
          hasHardConflict = true;
          hardConflictTitle = e.title;
        } else {
          softConflicts.push(e);
        }
      }
    }

    if (hasHardConflict) {
      await prisma.invite.update({
        where: { id: inviteId },
        data: {
          conflictType: 'hard',
        },
      });

      return res.status(400).json({
        error: hardConflictTitle
          ? `Жесткий конфликт: ${hardConflictTitle}`
          : 'Hard conflict: cannot accept event',
      });
    }

    const newEvent = await prisma.event.create({
      data: {
        creatorId: event.creatorId,
        ownerUserId: userId,
        title: event.title,
        description: event.description,
        startAt: event.startAt,
        endAt: event.endAt,
        blockType: 'hard',
        status: 'active',
        source: 'invite_accept',
        parentEventId: event.id,
      },
    });

    const rescheduleItems = [];

    for (const softEvent of softConflicts) {
      await prisma.event.update({
        where: { id: softEvent.id },
        data: {
          status: 'needs_reschedule',
        },
      });

      const item = await prisma.rescheduleItem.create({
        data: {
          userId,
          eventId: softEvent.id,
          originalStartAt: softEvent.startAt,
          originalEndAt: softEvent.endAt,
          status: 'open',
        },
      });

      rescheduleItems.push(item);
    }

    await prisma.invite.update({
      where: { id: inviteId },
      data: {
        responseStatus: 'accepted',
        respondedAt: new Date(),
        conflictType: softConflicts.length > 0 ? 'soft' : 'none',
      },
    });

    return res.json({
      ok: true,
      newEvent,
      rescheduleItems,
      mode: softConflicts.length > 0 ? 'accepted_with_reschedule' : 'accepted',
    });
  } catch (error) {
    console.error('POST /invites/:id/accept error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /invites/:id/decline
router.post('/:id/decline', async (req, res) => {
  try {
    const inviteId = String(req.params.id ?? '').trim();
    const userId = readUserId(req);

    if (!inviteId || !userId) {
      return res.status(400).json({ error: 'inviteId and userId are required' });
    }

    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    if (invite.invitedUserId !== userId) {
      return res.status(403).json({ error: 'No access to this invite' });
    }

    await prisma.invite.update({
      where: { id: inviteId },
      data: {
        responseStatus: 'declined',
        respondedAt: new Date(),
      },
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('POST /invites/:id/decline error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;