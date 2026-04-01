import prisma from '../src/lib/prisma';

async function main() {
  const users = [
    { telegramId: '1', name: 'You' },
    { telegramId: '2', name: 'Friend 1' },
    { telegramId: '3', name: 'Friend 2' },
  ];

  for (const user of users) {
    const existing = await prisma.user.findUnique({
      where: { telegramId: user.telegramId },
    });

    if (!existing) {
      await prisma.user.create({ data: user });
    }
  }

  console.log('Seed done');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });