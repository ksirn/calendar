import express from 'express';
import cors from 'cors';
import prisma from './lib/prisma';
import connectionsRouter from './routes/connections';
import eventsRouter from './routes/events';
import invitesRouter from './routes/invites';
import rescheduleRouter from './routes/reschedule';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
  });

  res.json(users);
});

app.patch('/users/:id/color', async (req, res) => {
  try {
    const userId = String(req.params.id ?? '').trim();
    const color = String((req.body ?? {}).preferredColor ?? '').trim();

    if (!userId || !color) {
      return res.status(400).json({ error: 'userId and preferredColor are required' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { preferredColor: color },
    });

    return res.json(updated);
  } catch (error) {
    console.error('PATCH /users/:id/color error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.use('/connections', connectionsRouter);
app.use('/events', eventsRouter);
app.use('/invites', invitesRouter);
app.use('/reschedule', rescheduleRouter);

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});