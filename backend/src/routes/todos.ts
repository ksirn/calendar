import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

function normalizePair(user1Id: string, user2Id: string) {
  return user1Id < user2Id
    ? { userAId: user1Id, userBId: user2Id }
    : { userAId: user2Id, userBId: user1Id };
}

async function hasAcceptedConnection(user1Id: string, user2Id: string): Promise<boolean> {
  if (user1Id === user2Id) return true;
  const { userAId, userBId } = normalizePair(user1Id, user2Id);
  const connection = await prisma.connection.findFirst({
    where: { userAId, userBId, status: 'accepted' },
  });
  return Boolean(connection);
}

// GET /todos — получить свои задачи (входящие от других + созданные себе)
router.get('/', async (req, res) => {
  try {
    const userId = String((req as any).user.id);

    const todos = await prisma.todo.findMany({
      where: {
        ownerUserId: userId,
        status: { notIn: ['deleted', 'cancelled'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Подтягиваем инфо о создателях
    const creatorIds = [...new Set(todos.map((t) => t.creatorId).filter((id) => id !== userId))];
    const creators = creatorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, username: true, name: true, preferredColor: true },
        })
      : [];
    const creatorMap = new Map(creators.map((c) => [c.id, c]));

    // Подтягиваем инфо об исходящих (задачи созданные мной для других)
    const outgoing = await prisma.todo.findMany({
      where: {
        creatorId: userId,
        ownerUserId: { not: userId },
        status: { not: 'deleted' },
      },
      orderBy: { createdAt: 'desc' },
    });

    const ownerIds = [...new Set(outgoing.map((t) => t.ownerUserId))];
    const owners = ownerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, username: true, name: true, preferredColor: true },
        })
      : [];
    const ownerMap = new Map(owners.map((o) => [o.id, o]));

    const now = new Date();

    const enriched = todos.map((todo) => ({
      ...todo,
      isOverdue: todo.deadline ? todo.deadline < now && todo.status !== 'done' && todo.status !== 'scheduled' : false,
      creator: todo.creatorId === userId ? null : (creatorMap.get(todo.creatorId) ?? null),
    }));

    const enrichedOutgoing = outgoing.map((todo) => ({
      ...todo,
      isOverdue: todo.deadline ? todo.deadline < now && todo.status !== 'done' && todo.status !== 'scheduled' : false,
      owner: ownerMap.get(todo.ownerUserId) ?? null,
    }));

    return res.json({ inbox: enriched, outgoing: enrichedOutgoing });
  } catch (error) {
    console.error('GET /todos error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /todos — создать задачу (себе или другому)
router.post('/', async (req, res) => {
  try {
    const creatorId = String((req as any).user.id);
    const body = (req.body ?? {}) as Record<string, unknown>;

    const title = String(body.title ?? '').trim();
    const description = body.description ? String(body.description).trim() : null;
    const deadlineRaw = body.deadline ? String(body.deadline).trim() : null;
    const targetUserId = body.targetUserId ? String(body.targetUserId).trim() : creatorId;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    // Если назначаем другому — проверяем связь
    if (targetUserId !== creatorId) {
      const allowed = await hasAcceptedConnection(creatorId, targetUserId);
      if (!allowed) {
        return res.status(403).json({ error: 'No accepted connection with target user' });
      }

      const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!targetUser) {
        return res.status(404).json({ error: 'Target user not found' });
      }
    }

    let deadline: Date | null = null;
    if (deadlineRaw) {
      deadline = new Date(deadlineRaw);
      if (isNaN(deadline.getTime())) {
        return res.status(400).json({ error: 'Invalid deadline' });
      }
    }

    const todo = await prisma.todo.create({
      data: {
        creatorId,
        ownerUserId: targetUserId,
        title,
        description,
        deadline,
        status: 'inbox',
      },
    });

    return res.status(201).json(todo);
  } catch (error) {
    console.error('POST /todos error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /todos/:id — обновить задачу (статус, дедлайн, title)
router.patch('/:id', async (req, res) => {
  try {
    const userId = String((req as any).user.id);
    const todoId = String(req.params.id ?? '').trim();
    const body = (req.body ?? {}) as Record<string, unknown>;

    const todo = await prisma.todo.findUnique({ where: { id: todoId } });
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    if (todo.ownerUserId !== userId) return res.status(403).json({ error: 'No access' });

    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.description !== undefined) updates.description = body.description ? String(body.description) : null;
    if (body.status !== undefined) updates.status = String(body.status);
    if (body.deadline !== undefined) {
      if (body.deadline === null || body.deadline === '') {
        updates.deadline = null;
      } else {
        const d = new Date(String(body.deadline));
        if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid deadline' });
        updates.deadline = d;
      }
    }
    if (body.eventId !== undefined) updates.eventId = body.eventId ? String(body.eventId) : null;

    const updated = await prisma.todo.update({ where: { id: todoId }, data: updates });
    return res.json(updated);
  } catch (error) {
    console.error('PATCH /todos/:id error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /todos/:id/schedule — поставить задачу в календарь как событие
router.post('/:id/schedule', async (req, res) => {
  try {
    const userId = String((req as any).user.id);
    const todoId = String(req.params.id ?? '').trim();
    const body = (req.body ?? {}) as Record<string, unknown>;

    const todo = await prisma.todo.findUnique({ where: { id: todoId } });
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    if (todo.ownerUserId !== userId) return res.status(403).json({ error: 'No access' });

    const startAtRaw = String(body.startAt ?? '').trim();
    const endAtRaw = String(body.endAt ?? '').trim();

    if (!startAtRaw || !endAtRaw) {
      return res.status(400).json({ error: 'startAt and endAt are required' });
    }

    const startAt = new Date(startAtRaw);
    const endAt = new Date(endAtRaw);

    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime()) || endAt <= startAt) {
      return res.status(400).json({ error: 'Invalid time range' });
    }

    // Проверка конфликта
    const existing = await prisma.event.findMany({
      where: { ownerUserId: userId, status: 'active' },
    });
    const hasConflict = existing.some(
      (e) => startAt < e.endAt && endAt > e.startAt
    );
    if (hasConflict) {
      return res.status(409).json({ error: 'Time slot is already occupied' });
    }

    const event = await prisma.event.create({
      data: {
        creatorId: userId,
        ownerUserId: userId,
        title: todo.title,
        description: todo.description,
        startAt,
        endAt,
        blockType: 'soft',
        status: 'active',
        source: 'todo',
        parentEventId: null,
      },
    });

    const updated = await prisma.todo.update({
      where: { id: todoId },
      data: { status: 'scheduled', eventId: event.id },
    });

    return res.json({ ok: true, todo: updated, event });
  } catch (error) {
    console.error('POST /todos/:id/schedule error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /todos/:id — мягкое удаление
router.delete('/:id', async (req, res) => {
  try {
    const userId = String((req as any).user.id);
    const todoId = String(req.params.id ?? '').trim();

    const todo = await prisma.todo.findUnique({ where: { id: todoId } });
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    if (todo.ownerUserId !== userId && todo.creatorId !== userId) {
      return res.status(403).json({ error: 'No access' });
    }

    await prisma.todo.update({ where: { id: todoId }, data: { status: 'deleted' } });
    return res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /todos/:id error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /todos/:id/cancel — создатель отзывает задачу, назначенную другому
router.post('/:id/cancel', async (req, res) => {
  try {
    const userId = String((req as any).user.id);
    const todoId = String(req.params.id ?? '').trim();

    const todo = await prisma.todo.findUnique({ where: { id: todoId } });
    if (!todo) return res.status(404).json({ error: 'Todo not found' });

    // Отменить может только создатель, и только если задача назначена другому
    if (todo.creatorId !== userId) {
      return res.status(403).json({ error: 'Only creator can cancel this todo' });
    }
    if (todo.ownerUserId === userId) {
      return res.status(400).json({ error: 'Use delete for your own todos' });
    }
    if (todo.status === 'deleted' || todo.status === 'cancelled') {
      return res.status(400).json({ error: 'Todo already cancelled' });
    }

    await prisma.todo.update({ where: { id: todoId }, data: { status: 'cancelled' } });
    return res.json({ ok: true });
  } catch (error) {
    console.error('POST /todos/:id/cancel error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
