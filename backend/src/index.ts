import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import prisma from './lib/prisma';
import authRoutes from './routes/auth';
import connectionsRouter from './routes/connections';
import eventsRouter from './routes/events';
import invitesRouter from './routes/invites';
import rescheduleRouter from './routes/reschedule';
import { authMiddleware } from './middleware/auth';

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);

app.get('/users', authMiddleware, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        username: true,
        name: true,
        preferredColor: true,
        createdAt: true,
      },
    });

    res.json(users);
  } catch (error) {
    console.error('GET /users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/users/me/color', authMiddleware, async (req, res) => {
  try {
    const userId = String((req as any).user.id);
    const color = String((req.body ?? {}).preferredColor ?? '').trim();

    if (!color) {
      return res.status(400).json({ error: 'preferredColor is required' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { preferredColor: color },
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
    console.error('PATCH /users/me/color error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.use('/connections', authMiddleware, connectionsRouter);
app.use('/events', authMiddleware, eventsRouter);
app.use('/invites', authMiddleware, invitesRouter);
app.use('/reschedule', authMiddleware, rescheduleRouter);

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
