const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function createAdminEnvironment() {
    try {
        // Check if admin domain exists
        let adminDomain = await prisma.domain.findFirst({
            where: {
                name: '@carbonleap.nl'
            }
        });

        // Create admin domain if it doesn't exist
        if (!adminDomain) {
            adminDomain = await prisma.domain.create({
                data: {
                    name: '@carbonleap.nl',
                    companyName: 'CarbonLeap BV',
                    supplyChainLevel: 1
                }
            });
            console.log('Created new admin domain:', adminDomain.companyName);
        } else {
            console.log('Using existing admin domain:', adminDomain.companyName);
        }

        // Check if admin user exists
        let adminUser = await prisma.user.findFirst({
            where: {
                email: 'admin@carbonleap.nl'
            }
        });

        // Create admin user if it doesn't exist
        if (!adminUser) {
            const hashedPassword = await bcrypt.hash('Admin123!', 10);
            adminUser = await prisma.user.create({
                data: {
                    email: 'admin@carbonleap.nl',
                    password: hashedPassword,
                    isAdmin: true,
                    domainId: adminDomain.id
                }
            });
            console.log('Created new admin user:', adminUser.email);
        } else {
            console.log('Admin user already exists:', adminUser.email);
        }

        console.log('\nAdmin environment summary:');
        console.log('Admin Email: admin@carbonleap.nl');
        console.log('Admin Password: Admin123!');
        console.log('Company Name:', adminDomain.companyName);
        console.log('Domain ID:', adminDomain.id);

    } catch (error) {
        console.error('Error setting up admin environment:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createAdminEnvironment();