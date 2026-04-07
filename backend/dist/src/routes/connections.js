"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../lib/auth");
const router = (0, express_1.Router)();
function normalizePair(user1Id, user2Id) {
    return user1Id < user2Id
        ? { userAId: user1Id, userBId: user2Id }
        : { userAId: user2Id, userBId: user1Id };
}
function getMyVisibilityForConnection(connection, userId) {
    return connection.userAId === userId
        ? connection.visibilityForA
        : connection.visibilityForB;
}
router.get('/', async (req, res) => {
    try {
        const userId = String(req.user.id);
        const connections = await prisma_1.default.connection.findMany({
            where: {
                OR: [{ userAId: userId }, { userBId: userId }],
            },
            orderBy: { createdAt: 'desc' },
        });
        const userIds = Array.from(new Set(connections.flatMap((connection) => [connection.userAId, connection.userBId]))).filter((id) => id !== userId);
        const users = await prisma_1.default.user.findMany({
            where: {
                id: { in: userIds },
            },
            select: {
                id: true,
                username: true,
                name: true,
                preferredColor: true,
            },
        });
        const usersMap = new Map(users.map((user) => [user.id, user]));
        const accepted = [];
        const incomingPending = [];
        const outgoingPending = [];
        for (const connection of connections) {
            const otherUserId = connection.userAId === userId ? connection.userBId : connection.userAId;
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
                        username: otherUser.username,
                        name: otherUser.name,
                        preferredColor: otherUser.preferredColor,
                    }
                    : null,
            };
            if (connection.status === 'accepted') {
                accepted.push(item);
            }
            else if (connection.status === 'pending' &&
                connection.requestedByUserId === userId) {
                outgoingPending.push(item);
            }
            else if (connection.status === 'pending' &&
                connection.requestedByUserId !== userId) {
                incomingPending.push(item);
            }
        }
        return res.json({
            accepted,
            incomingPending,
            outgoingPending,
        });
    }
    catch (error) {
        console.error('GET /connections error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/search', async (req, res) => {
    try {
        const userId = String(req.user.id);
        const q = (0, auth_1.normalizeUsername)(String(req.query.q ?? ''));
        const connections = await prisma_1.default.connection.findMany({
            where: {
                OR: [{ userAId: userId }, { userBId: userId }],
            },
            select: {
                userAId: true,
                userBId: true,
            },
        });
        const excludedIds = new Set([userId]);
        for (const connection of connections) {
            excludedIds.add(connection.userAId);
            excludedIds.add(connection.userBId);
        }
        const whereClause = q
            ? {
                username: {
                    contains: q,
                    mode: 'insensitive',
                },
            }
            : {};
        const users = await prisma_1.default.user.findMany({
            where: {
                id: {
                    notIn: Array.from(excludedIds),
                },
                ...whereClause,
            },
            orderBy: {
                username: 'asc',
            },
            take: 20,
            select: {
                id: true,
                username: true,
                name: true,
                preferredColor: true,
            },
        });
        return res.json(users);
    }
    catch (error) {
        console.error('GET /connections/search error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/request', async (req, res) => {
    try {
        const requesterUserId = String(req.user.id);
        const targetUserId = String(req.body?.targetUserId ?? '').trim();
        if (!targetUserId) {
            return res.status(400).json({
                error: 'targetUserId is required',
            });
        }
        if (requesterUserId === targetUserId) {
            return res.status(400).json({
                error: 'Cannot create connection with yourself',
            });
        }
        const requester = await prisma_1.default.user.findUnique({
            where: { id: requesterUserId },
        });
        const target = await prisma_1.default.user.findUnique({
            where: { id: targetUserId },
        });
        if (!requester || !target) {
            return res.status(404).json({ error: 'User not found' });
        }
        const { userAId, userBId } = normalizePair(requesterUserId, targetUserId);
        const existing = await prisma_1.default.connection.findFirst({
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
        const connection = await prisma_1.default.connection.create({
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
    }
    catch (error) {
        console.error('POST /connections/request error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/:id/accept', async (req, res) => {
    try {
        const connectionId = String(req.params.id || '').trim();
        const userId = String(req.user.id);
        if (!connectionId) {
            return res.status(400).json({ error: 'connectionId is required' });
        }
        const connection = await prisma_1.default.connection.findUnique({
            where: { id: connectionId },
        });
        if (!connection) {
            return res.status(404).json({ error: 'Connection not found' });
        }
        const isParticipant = connection.userAId === userId || connection.userBId === userId;
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
        const updated = await prisma_1.default.connection.update({
            where: { id: connectionId },
            data: {
                status: 'accepted',
                respondedAt: new Date(),
            },
        });
        return res.json(updated);
    }
    catch (error) {
        console.error('POST /connections/:id/accept error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/:id/decline', async (req, res) => {
    try {
        const connectionId = String(req.params.id || '').trim();
        const userId = String(req.user.id);
        if (!connectionId) {
            return res.status(400).json({ error: 'connectionId is required' });
        }
        const connection = await prisma_1.default.connection.findUnique({
            where: { id: connectionId },
        });
        if (!connection) {
            return res.status(404).json({ error: 'Connection not found' });
        }
        const isParticipant = connection.userAId === userId || connection.userBId === userId;
        if (!isParticipant) {
            return res.status(403).json({ error: 'No access to this connection' });
        }
        if (connection.status !== 'pending') {
            return res.status(400).json({ error: 'Only pending connection can be declined' });
        }
        const updated = await prisma_1.default.connection.update({
            where: { id: connectionId },
            data: {
                status: 'declined',
                respondedAt: new Date(),
            },
        });
        return res.json(updated);
    }
    catch (error) {
        console.error('POST /connections/:id/decline error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.patch('/:id/privacy', async (req, res) => {
    try {
        const connectionId = String(req.params.id || '').trim();
        const userId = String(req.user.id);
        const visibility = String(req.body?.visibility ?? '').trim();
        if (!connectionId || !visibility) {
            return res.status(400).json({ error: 'connectionId and visibility are required' });
        }
        if (visibility !== 'full' && visibility !== 'busy_only') {
            return res.status(400).json({ error: 'visibility must be full or busy_only' });
        }
        const connection = await prisma_1.default.connection.findUnique({
            where: { id: connectionId },
        });
        if (!connection) {
            return res.status(404).json({ error: 'Connection not found' });
        }
        const isParticipant = connection.userAId === userId || connection.userBId === userId;
        if (!isParticipant) {
            return res.status(403).json({ error: 'No access to this connection' });
        }
        const updated = await prisma_1.default.connection.update({
            where: { id: connectionId },
            data: connection.userAId === userId
                ? { visibilityForA: visibility }
                : { visibilityForB: visibility },
        });
        return res.json(updated);
    }
    catch (error) {
        console.error('PATCH /connections/:id/privacy error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const connectionId = String(req.params.id || '').trim();
        const userId = String(req.user.id);
        if (!connectionId) {
            return res.status(400).json({ error: 'connectionId is required' });
        }
        const connection = await prisma_1.default.connection.findUnique({
            where: { id: connectionId },
        });
        if (!connection) {
            return res.status(404).json({ error: 'Connection not found' });
        }
        const isParticipant = connection.userAId === userId || connection.userBId === userId;
        if (!isParticipant) {
            return res.status(403).json({ error: 'No access to this connection' });
        }
        await prisma_1.default.connection.delete({
            where: { id: connectionId },
        });
        return res.json({ ok: true });
    }
    catch (error) {
        console.error('DELETE /connections/:id error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
