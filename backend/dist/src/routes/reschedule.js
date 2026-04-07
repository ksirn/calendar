"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const router = (0, express_1.Router)();
function readUserId(req) {
    const body = (req.body ?? {});
    const fromBody = String(body.userId ?? '').trim();
    const fromQuery = String(req.query.userId ?? '').trim();
    return fromBody || fromQuery;
}
function hasTimeOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && aEnd > bStart;
}
async function findConflictingEvent(ownerUserId, startAt, endAt, excludeEventId) {
    const events = await prisma_1.default.event.findMany({
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
    return (events.find((event) => hasTimeOverlap(startAt, endAt, event.startAt, event.endAt)) ?? null);
}
// GET /reschedule?userId=...
router.get('/', async (req, res) => {
    try {
        const userId = String(req.query.userId ?? '').trim();
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }
        const items = await prisma_1.default.rescheduleItem.findMany({
            where: {
                userId,
                status: 'open',
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        const eventIds = items.map((item) => item.eventId);
        const events = eventIds.length
            ? await prisma_1.default.event.findMany({
                where: {
                    id: { in: eventIds },
                },
            })
            : [];
        const eventMap = new Map(events.map((event) => [event.id, event]));
        const result = items.map((item) => ({
            ...item,
            event: eventMap.get(item.eventId) ?? null,
        }));
        return res.json(result);
    }
    catch (error) {
        console.error('GET /reschedule error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /reschedule/:id/move
router.post('/:id/move', async (req, res) => {
    try {
        const itemId = String(req.params.id ?? '').trim();
        const userId = readUserId(req);
        const body = (req.body ?? {});
        const newStartAtRaw = String(body.newStartAt ?? '').trim();
        if (!itemId || !userId || !newStartAtRaw) {
            return res.status(400).json({
                error: 'itemId, userId and newStartAt are required',
            });
        }
        const item = await prisma_1.default.rescheduleItem.findUnique({
            where: { id: itemId },
        });
        if (!item) {
            return res.status(404).json({ error: 'Reschedule item not found' });
        }
        if (item.userId !== userId) {
            return res.status(403).json({ error: 'No access to this reschedule item' });
        }
        if (item.status !== 'open') {
            return res.status(400).json({ error: 'Reschedule item already processed' });
        }
        const event = await prisma_1.default.event.findUnique({
            where: { id: item.eventId },
        });
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        const newStartAt = new Date(newStartAtRaw);
        if (Number.isNaN(newStartAt.getTime())) {
            return res.status(400).json({ error: 'Invalid newStartAt' });
        }
        const originalDurationMs = new Date(item.originalEndAt).getTime() - new Date(item.originalStartAt).getTime();
        if (originalDurationMs <= 0) {
            return res.status(400).json({ error: 'Invalid original duration' });
        }
        const newEndAt = new Date(newStartAt.getTime() + originalDurationMs);
        const conflictingEvent = await findConflictingEvent(userId, newStartAt, newEndAt, event.id);
        if (conflictingEvent) {
            return res.status(409).json({
                error: 'Cannot move event into occupied time slot',
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
        const updatedEvent = await prisma_1.default.event.update({
            where: { id: event.id },
            data: {
                startAt: newStartAt,
                endAt: newEndAt,
                status: 'active',
            },
        });
        const updatedItem = await prisma_1.default.rescheduleItem.update({
            where: { id: item.id },
            data: {
                status: 'resolved',
            },
        });
        return res.json({
            ok: true,
            event: updatedEvent,
            rescheduleItem: updatedItem,
        });
    }
    catch (error) {
        console.error('POST /reschedule/:id/move error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /reschedule/:id/dismiss
router.post('/:id/dismiss', async (req, res) => {
    try {
        const itemId = String(req.params.id ?? '').trim();
        const userId = readUserId(req);
        if (!itemId || !userId) {
            return res.status(400).json({
                error: 'itemId and userId are required',
            });
        }
        const item = await prisma_1.default.rescheduleItem.findUnique({
            where: { id: itemId },
        });
        if (!item) {
            return res.status(404).json({ error: 'Reschedule item not found' });
        }
        if (item.userId !== userId) {
            return res.status(403).json({ error: 'No access to this reschedule item' });
        }
        if (item.status !== 'open') {
            return res.status(400).json({ error: 'Reschedule item already processed' });
        }
        await prisma_1.default.event.update({
            where: { id: item.eventId },
            data: {
                status: 'cancelled',
            },
        });
        const updatedItem = await prisma_1.default.rescheduleItem.update({
            where: { id: item.id },
            data: {
                status: 'dismissed',
            },
        });
        return res.json({
            ok: true,
            rescheduleItem: updatedItem,
        });
    }
    catch (error) {
        console.error('POST /reschedule/:id/dismiss error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
