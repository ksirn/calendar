import bcrypt from 'bcrypt';
import prisma from '../src/lib/prisma';

async function main() {
  const passwordHash = await bcrypt.hash('temp12345', 10);

  const users = [
    {
      username: 'misha',
      name: 'Миша',
      passwordHash,
    },
    {
      username: 'artem',
      name: 'Артём',
      passwordHash,
    },
    {
      username: 'sanya',
      name: 'Саня',
      passwordHash,
    },
  ];

  for (const user of users) {
    const existing = await prisma.user.findUnique({
      where: { username: user.username },
    });

    if (!existing) {
      await prisma.user.create({
        data: user,
      });
    }
  }

  console.log('Seed completed');
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
