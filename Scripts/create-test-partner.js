const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function createTestEnvironment() {
    try {
        // Check if partner domain already exists
        let partnerDomain = await prisma.domain.findFirst({
            where: {
                name: '@testcompany.com'
            }
        });

        // Only create partner domain if it doesn't exist
        if (!partnerDomain) {
            partnerDomain = await prisma.domain.create({
                data: {
                    name: '@testcompany.com',
                    companyName: 'Test Company BV'
                }
            });
            console.log('Created new partner domain:', partnerDomain.companyName);
        } else {
            console.log('Using existing partner domain:', partnerDomain.companyName);
        }

        // Check if partner user exists
        let partnerUser = await prisma.user.findFirst({
            where: {
                email: 'partner@testcompany.com'
            }
        });

        // Only create partner user if it doesn't exist
        if (!partnerUser) {
            const hashedPassword = await bcrypt.hash('TestCompany1!', 10);
            partnerUser = await prisma.user.create({
                data: {
                    email: 'partner@testcompany.com',
                    password: hashedPassword,
                    isAdmin: false,
                    domainId: partnerDomain.id
                }
            });
            console.log('Created new partner user:', partnerUser.email);
        } else {
            console.log('Partner user already exists:', partnerUser.email);
        }

        // Check if test intervention exists
        const existingIntervention = await prisma.interventionRequest.findFirst({
            where: {
                interventionId: 'TEST-INT-001'
            }
        });

        // Only create test intervention if it doesn't exist
        if (!existingIntervention) {
            const adminDomain = await prisma.domain.findFirst({
                where: {
                    name: '@carbonleap.nl'
                }
            });

            if (adminDomain) {
                const testIntervention = await prisma.interventionRequest.create({
                    data: {
                        userId: 1, // Admin user ID
                        clientName: "Test Client",
                        emissionsAbated: 100.0,
                        modality: "Maritime",
                        geography: "Netherlands",
                        status: "verified",
                        interventionId: "TEST-INT-001",
                        ghgEmissionSaving: "100",
                        vintage: 2024,
                        thirdPartyVerification: "verified",
                        remainingAmount: 100.0,
                        totalAmount: 100.0
                    }
                });
                console.log('Created test intervention:', testIntervention.interventionId);
            }
        } else {
            console.log('Test intervention already exists:', existingIntervention.interventionId);
        }

        console.log('\nTest environment summary:');
        console.log('Partner Email: partner@testcompany.com');
        console.log('Partner Password: TestCompany1!');
        console.log('Company Name:', partnerDomain.companyName);
        console.log('Domain ID:', partnerDomain.id);

    } catch (error) {
        console.error('Error setting up test environment:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createTestEnvironment();