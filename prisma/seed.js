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

// Update in prisma/seed.js or create a new seeding script
async function seedSupplyChainLevels() {
  const levels = [
    { 
      level: 1, 
      description: 'Raw Material Suppliers / Primary Producers / Primary Transportation Companies',  // Added Primary Transportation
      examples: "Examples: Biofuel producers, Raw material transporters, Primary logistics providers"
    },
    { 
      level: 2, 
      description: 'Manufacturers / Secondary Producers / Inter-factory Transportation',  // Added Inter-factory Transportation
      examples: "Examples: Biofuel refiners, Factory-to-factory transporters, Manufacturing logistics"
    },
    { 
      level: 3, 
      description: 'Distributors / Wholesalers / Distribution Transportation',  // Added Distribution Transportation
      examples: "Examples: Fuel distributors, Long-haul transport companies, Wholesale logistics providers"
    },
    { 
      level: 4, 
      description: 'Retailers / End Service Providers / Last-Mile Transportation',  // Added Last-Mile Transportation
      examples: "Examples: Fuel retailers, Delivery services, Local transport companies"
    },
    { 
      level: 5, 
      description: 'End Consumers / Final Businesses',
      examples: "Examples: Companies using the final product, End-user businesses"
    }
  ];

  for (const level of levels) {
    await prisma.supplyChainLevelDescription.upsert({
      where: { level: level.level },
      update: { 
        description: level.description,
        examples: level.examples
      },
      create: { 
        level: level.level, 
        description: level.description,
        examples: level.examples
      }
    });
  }
}