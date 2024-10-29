// scripts/create-admin.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function createAdminUser() {
    try {
        // First, let's delete any existing admin user to avoid duplicates
        await prisma.user.deleteMany({
            where: {
                email: 'admin@carbonleap.nl'
            }
        });

        // Check if domain exists, if not create it
        let domain = await prisma.domain.findFirst({
            where: {
                name: '@carbonleap.nl'
            }
        });

        if (!domain) {
            domain = await prisma.domain.create({
                data: {
                    name: '@carbonleap.nl',
                    companyName: 'CarbonLeap'
                }
            });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash('CarbonLeap1!', 10);

        // Create new admin user with hashed password
        const adminUser = await prisma.user.create({
            data: {
                email: 'admin@carbonleap.nl',
                password: hashedPassword,
                isAdmin: true,
                domainId: domain.id
            }
        });

        console.log('Successfully created admin user with credentials:');
        console.log('Email:', adminUser.email);
        console.log('Password: CarbonLeap1!');
        console.log('This password is properly hashed in the database.');

    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createAdminUser();