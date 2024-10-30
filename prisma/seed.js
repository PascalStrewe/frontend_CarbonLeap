const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const domain = await prisma.domain.create({
    data: {
      name: 'carbonleap-test.com',
      companyName: 'CarbonLeap Test',
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@carbonleap.nl',
      password: await bcrypt.hash('CarbonLeap1!', 10),
      isAdmin: true,
      domainId: domain.id,
    },
  });

  const testUser = await prisma.user.create({
    data: {
      email: "test@carbonleap-test.com",
      password: await bcrypt.hash('test123', 10),
      domainId: domain.id,
      isAdmin: false
    },
  });

  const interventionRequest = await prisma.interventionRequest.create({
    data: {
      userId: testUser.id,
      companyDomain: "carbonleap-test.com",
      intervention: "Test Intervention",
      modality: "Ship",
      geography: "Global",
      status: "pending",
      ghgEmissionSaving: "100",
      vintage: "2024",
      lowCarbonFuel: "Bio",
      feedstock: "Waste",
      causality: "Direct",
      additionality: "Yes",
      thirdPartyVerification: "Yes",
      certificationScheme: "Gold Standard",
      standards: "ISO14001"
    }
  });

  console.log('Seed data created:', {
    domain: domain.name,
    adminUser: adminUser.email,
    testUser: testUser.email,
    interventionRequest: interventionRequest.id
  });
}