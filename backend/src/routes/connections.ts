import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

function normalizePair(user1Id: string, user2Id: string) {
  return user1Id < user2Id
    ? { userAId: user1Id, userBId: user2Id }
    : { userAId: user2Id, userBId: user1Id };
}

function getMyVisibilityForConnection(connection: {
  userAId: string;
  userBId: string;
  visibilityForA: string;
  visibilityForB: string;
}, userId: string) {
  return connection.userAId === userId
    ? connection.visibilityForA
    : connection.visibilityForB;
}

// GET /connections?userId=...
router.get('/', async (req, res) => {
  try {
    const userId = String(req.query.userId || '').trim();

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const connections = await prisma.connection.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      orderBy: { createdAt: 'desc' },
    });

    const userIds = Array.from(
      new Set(connections.flatMap((connection) => [connection.userAId, connection.userBId]))
    ).filter((id) => id !== userId);

    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
    });

    const usersMap = new Map(users.map((user) => [user.id, user]));

    const accepted = [];
    const incomingPending = [];
    const outgoingPending = [];

    for (const connection of connections) {
      const otherUserId =
        connection.userAId === userId ? connection.userBId : connection.userAId;

      const otherUser = usersMap.get(otherUserId);

      const item = {
        id: connection.id,
        status: connection.status,
        requestedByUserId: connection.requestedByUserId,
        visibility: getMyVisibilityForConnection(connection, userId),
        createdAt: connection.createdAt,
        respondedAt: connection.respondedAt,
        otherUser: otherUser
          ? {
              id: otherUser.id,
              name: otherUser.name,
              telegramId: otherUser.telegramId,
              preferredColor: otherUser.preferredColor,
            }
          : null,
      };

      if (connection.status === 'accepted') {
        accepted.push(item);
      } else if (
        connection.status === 'pending' &&
        connection.requestedByUserId === userId
      ) {
        outgoingPending.push(item);
      } else if (
        connection.status === 'pending' &&
        connection.requestedByUserId !== userId
      ) {
        incomingPending.push(item);
      }
    }

    return res.json({
      accepted,
      incomingPending,
      outgoingPending,
    });
  } catch (error) {
    console.error('GET /connections error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /connections/request
router.post('/request', async (req, res) => {
  try {
    const body = req.body ?? {};

    const requesterUserId = String(body.requesterUserId ?? '').trim();
    const targetUserId = String(body.targetUserId ?? '').trim();

    if (!requesterUserId || !targetUserId) {
      return res.status(400).json({
        error: 'requesterUserId and targetUserId are required',
      });
    }

    if (requesterUserId === targetUserId) {
      return res.status(400).json({
        error: 'Cannot create connection with yourself',
      });
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterUserId },
    });

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!requester || !target) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { userAId, userBId } = normalizePair(requesterUserId, targetUserId);

    const existing = await prisma.connection.findFirst({
      where: {
        userAId,
        userBId,
      },
    });

    if (existing) {
      return res.status(409).json({
        error: 'Connection already exists',
        connection: existing,
      });
    }

    const connection = await prisma.connection.create({
      data: {
        userAId,
        userBId,
        requestedByUserId: requesterUserId,
        status: 'pending',
        visibilityForA: 'full',
        visibilityForB: 'full',
      },
    });

    return res.status(201).json(connection);
  } catch (error) {
    console.error('POST /connections/request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /connections/:id/accept
router.post('/:id/accept', async (req, res) => {
  try {
    const connectionId = String(req.params.id || '').trim();
    const body = req.body ?? {};
    const userId = String(body.userId ?? '').trim();

    if (!connectionId || !userId) {
      return res.status(400).json({ error: 'connectionId and userId are required' });
    }

    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const isParticipant =
      connection.userAId === userId || connection.userBId === userId;

    if (!isParticipant) {
      return res.status(403).json({ error: 'No access to this connection' });
    }

    if (connection.requestedByUserId === userId) {
      return res
        .status(400)
        .json({ error: 'Requester cannot accept own connection request' });
    }

    if (connection.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending connection can be accepted' });
    }

    const updated = await prisma.connection.update({
      where: { id: connectionId },
      data: {
        status: 'accepted',
        respondedAt: new Date(),
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error('POST /connections/:id/accept error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /connections/:id/decline
router.post('/:id/decline', async (req, res) => {
  try {
    const connectionId = String(req.params.id || '').trim();
    const body = req.body ?? {};
    const userId = String(body.userId ?? '').trim();

    if (!connectionId || !userId) {
      return res.status(400).json({ error: 'connectionId and userId are required' });
    }

    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const isParticipant =
      connection.userAId === userId || connection.userBId === userId;

    if (!isParticipant) {
      return res.status(403).json({ error: 'No access to this connection' });
    }

    if (connection.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending connection can be declined' });
    }

    const updated = await prisma.connection.update({
      where: { id: connectionId },
      data: {
        status: 'declined',
        respondedAt: new Date(),
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error('POST /connections/:id/decline error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /connections/:id/privacy
router.patch('/:id/privacy', async (req, res) => {
  try {
    const connectionId = String(req.params.id || '').trim();
    const body = (req.body ?? {}) as Record<string, unknown>;

    const userId = String(body.userId ?? '').trim();
    const visibility = String(body.visibility ?? '').trim();

    if (!connectionId || !userId || !visibility) {
      return res.status(400).json({ error: 'connectionId, userId and visibility are required' });
    }

    if (visibility !== 'full' && visibility !== 'busy_only') {
      return res.status(400).json({ error: 'visibility must be full or busy_only' });
    }

    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const isParticipant =
      connection.userAId === userId || connection.userBId === userId;

    if (!isParticipant) {
      return res.status(403).json({ error: 'No access to this connection' });
    }

    const updated = await prisma.connection.update({
      where: { id: connectionId },
      data:
        connection.userAId === userId
          ? { visibilityForA: visibility }
          : { visibilityForB: visibility },
    });

    return res.json(updated);
  } catch (error) {
    console.error('PATCH /connections/:id/privacy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /connections/:id?userId=...
router.delete('/:id', async (req, res) => {
  try {
    const connectionId = String(req.params.id || '').trim();
    const userId = String(req.query.userId || '').trim();

    if (!connectionId || !userId) {
      return res.status(400).json({ error: 'connectionId and userId are required' });
    }

    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const isParticipant =
      connection.userAId === userId || connection.userBId === userId;

    if (!isParticipant) {
      return res.status(403).json({ error: 'No access to this connection' });
    }

    await prisma.connection.delete({
      where: { id: connectionId },
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /connections/:id error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;