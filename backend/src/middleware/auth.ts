import { Request, Response, NextFunction } from 'express';
import { getUserByToken } from '../lib/auth';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.session;
    const user = await getUserByToken(token);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    console.error('authMiddleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
