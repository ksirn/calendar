"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../lib/auth");
const auth_2 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/register', async (req, res) => {
    try {
        const usernameRaw = String(req.body?.username ?? '');
        const nameRaw = String(req.body?.name ?? '');
        const password = String(req.body?.password ?? '');
        const username = (0, auth_1.normalizeUsername)(usernameRaw);
        const name = nameRaw.trim() || username;
        if (!username || !password) {
            return res.status(400).json({ error: 'username and password are required' });
        }
        if (!(0, auth_1.validateUsername)(username)) {
            return res.status(400).json({
                error: 'username must be 3-20 chars and contain only a-z, 0-9, _ or .',
            });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'password must be at least 6 characters' });
        }
        const existing = await prisma_1.default.user.findUnique({
            where: { username },
        });
        if (existing) {
            return res.status(409).json({ error: 'username already taken' });
        }
        const passwordHash = await (0, auth_1.hashPassword)(password);
        const user = await prisma_1.default.user.create({
            data: {
                username,
                name,
                passwordHash,
            },
            select: {
                id: true,
                username: true,
                name: true,
                preferredColor: true,
                createdAt: true,
            },
        });
        const token = await (0, auth_1.createSession)(user.id);
        res.cookie('session', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            path: '/',
            maxAge: 1000 * 60 * 60 * 24 * 30,
        });
        return res.json(user);
    }
    catch (error) {
        console.error('POST /auth/register error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/login', async (req, res) => {
    try {
        const username = (0, auth_1.normalizeUsername)(String(req.body?.username ?? ''));
        const password = String(req.body?.password ?? '');
        if (!username || !password) {
            return res.status(400).json({ error: 'username and password are required' });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { username },
        });
        if (!user) {
            return res.status(400).json({ error: 'invalid credentials' });
        }
        const ok = await (0, auth_1.verifyPassword)(password, user.passwordHash);
        if (!ok) {
            return res.status(400).json({ error: 'invalid credentials' });
        }
        const token = await (0, auth_1.createSession)(user.id);
        res.cookie('session', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            path: '/',
            maxAge: 1000 * 60 * 60 * 24 * 30,
        });
        return res.json({
            id: user.id,
            username: user.username,
            name: user.name,
            preferredColor: user.preferredColor,
            createdAt: user.createdAt,
        });
    }
    catch (error) {
        console.error('POST /auth/login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/logout', async (req, res) => {
    try {
        const token = req.cookies?.session;
        if (token) {
            await prisma_1.default.session.deleteMany({
                where: { token },
            });
        }
        res.clearCookie('session', { path: '/' });
        return res.json({ ok: true });
    }
    catch (error) {
        console.error('POST /auth/logout error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/me', async (req, res) => {
    try {
        const token = req.cookies?.session;
        if (!token) {
            return res.json(null);
        }
        const session = await prisma_1.default.session.findUnique({
            where: { token },
            include: { user: true },
        });
        if (!session?.user) {
            return res.json(null);
        }
        return res.json({
            id: session.user.id,
            username: session.user.username,
            name: session.user.name,
            preferredColor: session.user.preferredColor,
            createdAt: session.user.createdAt,
        });
    }
    catch (error) {
        console.error('GET /auth/me error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.patch('/profile', auth_2.authMiddleware, async (req, res) => {
    try {
        const userId = String(req.user.id);
        const nameRaw = String(req.body?.name ?? '').trim();
        const usernameRaw = String(req.body?.username ?? '');
        const username = (0, auth_1.normalizeUsername)(usernameRaw);
        const name = nameRaw.trim();
        if (!name) {
            return res.status(400).json({ error: 'display name is required' });
        }
        if (!username) {
            return res.status(400).json({ error: 'username is required' });
        }
        if (!(0, auth_1.validateUsername)(username)) {
            return res.status(400).json({
                error: 'username must be 3-20 chars and contain only a-z, 0-9, _ or .',
            });
        }
        const existing = await prisma_1.default.user.findFirst({
            where: {
                username,
                id: {
                    not: userId,
                },
            },
        });
        if (existing) {
            return res.status(409).json({ error: 'username already taken' });
        }
        const updated = await prisma_1.default.user.update({
            where: { id: userId },
            data: {
                name,
                username,
            },
            select: {
                id: true,
                username: true,
                name: true,
                preferredColor: true,
                createdAt: true,
            },
        });
        return res.json(updated);
    }
    catch (error) {
        console.error('PATCH /auth/profile error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.patch('/password', auth_2.authMiddleware, async (req, res) => {
    try {
        const userId = String(req.user.id);
        const currentPassword = String(req.body?.currentPassword ?? '');
        const newPassword = String(req.body?.newPassword ?? '');
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'currentPassword and newPassword are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'new password must be at least 6 characters' });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return res.status(404).json({ error: 'user not found' });
        }
        const ok = await (0, auth_1.verifyPassword)(currentPassword, user.passwordHash);
        if (!ok) {
            return res.status(400).json({ error: 'current password is incorrect' });
        }
        const passwordHash = await (0, auth_1.hashPassword)(newPassword);
        await prisma_1.default.user.update({
            where: { id: userId },
            data: { passwordHash },
        });
        return res.json({ ok: true });
    }
    catch (error) {
        console.error('PATCH /auth/password error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
