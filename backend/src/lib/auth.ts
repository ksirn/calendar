import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from './prisma';

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function createSession(userId: string) {
  const token = generateToken();

  await prisma.session.create({
    data: {
      userId,
      token,
    },
  });

  return token;
}

export async function getUserByToken(token?: string) {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  return session?.user ?? null;
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string) {
  return /^[a-z0-9_.]{3,20}$/.test(value);
}
