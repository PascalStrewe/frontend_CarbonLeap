// prisma/seed.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create initial domain
  const domain = await prisma.domain.create({
    data: {
      name: '@carbonleap.nl',
      companyName: 'CarbonLeap',
    },
  });

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      email: process.env.ADMIN_EMAIL || 'admin@carbonleap.nl',
      // In production, you should hash this password
      password: 'CarbonLeap1!',
      isAdmin: true,
      domainId: domain.id,
    },
  });

  // Create some sample interventions
  const intervention = await prisma.intervention.create({
    data: {
      domainId: domain.id,
      // Add other intervention fields as needed
    },
  });

  console.log('Seed data created:', {
    domain: domain.name,
    adminUser: adminUser.email,
    intervention: intervention.id,
  });
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });