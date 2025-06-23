import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');

  await prisma.user.upsert({
    where: { verusId: 'testuser1' },
    update: {},
    create: {
      verusId: 'testuser1',
      displayName: 'Paco',
      avatarUrl: 'https://i.pravatar.cc/150?u=paco',
    },
  });

  await prisma.user.upsert({
    where: { verusId: 'testuser2' },
    update: {},
    create: {
      verusId: 'testuser2',
      displayName: 'Testy',
      avatarUrl: 'https://i.pravatar.cc/150?u=testy',
    },
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 