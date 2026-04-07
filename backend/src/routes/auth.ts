import { Router } from 'express';
import prisma from '../lib/prisma';
import {
  createSession,
  hashPassword,
  normalizeUsername,
  validateUsername,
  verifyPassword,
} from '../lib/auth';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const usernameRaw = String(req.body?.username ?? '');
    const nameRaw = String(req.body?.name ?? '');
    const password = String(req.body?.password ?? '');

    const username = normalizeUsername(usernameRaw);
    const name = nameRaw.trim() || username;

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    if (!validateUsername(username)) {
      return res.status(400).json({
        error: 'username must be 3-20 chars and contain only a-z, 0-9, _ or .',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' });
    }

    const existing = await prisma.user.findUnique({
      where: { username },
    });

    if (existing) {
      return res.status(409).json({ error: 'username already taken' });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
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

    const token = await createSession(user.id);

    res.cookie('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    return res.json(user);
  } catch (error) {
    console.error('POST /auth/register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const username = normalizeUsername(String(req.body?.username ?? ''));
    const password = String(req.body?.password ?? '');

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(400).json({ error: 'invalid credentials' });
    }

    const ok = await verifyPassword(password, user.passwordHash);

    if (!ok) {
      return res.status(400).json({ error: 'invalid credentials' });
    }

    const token = await createSession(user.id);

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
  } catch (error) {
    console.error('POST /auth/login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies?.session;

    if (token) {
      await prisma.session.deleteMany({
        where: { token },
      });
    }

    res.clearCookie('session', { path: '/' });
    return res.json({ ok: true });
  } catch (error) {
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

    const session = await prisma.session.findUnique({
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
  } catch (error) {
    console.error('GET /auth/me error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = String((req as any).user.id);
    const nameRaw = String(req.body?.name ?? '').trim();
    const usernameRaw = String(req.body?.username ?? '');

    const username = normalizeUsername(usernameRaw);
    const name = nameRaw.trim();

    if (!name) {
      return res.status(400).json({ error: 'display name is required' });
    }

    if (!username) {
      return res.status(400).json({ error: 'username is required' });
    }

    if (!validateUsername(username)) {
      return res.status(400).json({
        error: 'username must be 3-20 chars and contain only a-z, 0-9, _ or .',
      });
    }

    const existing = await prisma.user.findFirst({
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

    const updated = await prisma.user.update({
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
  } catch (error) {
    console.error('PATCH /auth/profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/password', authMiddleware, async (req, res) => {
  try {
    const userId = String((req as any).user.id);
    const currentPassword = String(req.body?.currentPassword ?? '');
    const newPassword = String(req.body?.newPassword ?? '');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'new password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'user not found' });
    }

    const ok = await verifyPassword(currentPassword, user.passwordHash);

    if (!ok) {
      return res.status(400).json({ error: 'current password is incorrect' });
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('PATCH /auth/password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
