// prisma/seed.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  try {
    // Create initial domain
    const adminDomain = await prisma.domain.upsert({
      where: { name: '@admin' },
      update: {},
      create: {
        name: '@admin',
        companyName: 'CarbonLeap Admin'
      }
    });

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@carbonleap.com' },
      update: {},
      create: {
        email: 'admin@carbonleap.com',
        password: hashedPassword,
        isAdmin: true,
        domainId: adminDomain.id
      }
    });

    console.log('Seed data created:', { admin, adminDomain });
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
