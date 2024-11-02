// scripts/check-users.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAndResetUsers() {
    try {
        // Check all users
        const allUsers = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                isAdmin: true,
                domain: {
                    select: {
                        name: true,
                        companyName: true
                    }
                }
            }
        });

        console.log('Existing users:', allUsers);

        // Create admin if none exists
        if (allUsers.length === 0) {
            // First create domain
            const domain = await prisma.domain.create({
                data: {
                    name: '@carbonleap.nl',
                    companyName: 'CarbonLeap'
                }
            });

            // Then create admin user
            const adminUser = await prisma.user.create({
                data: {
                    email: 'admin@carbonleap.nl',
                    password: 'CarbonLeap1!', // You should change this after first login
                    isAdmin: true,
                    domainId: domain.id
                }
            });

            console.log('Created new admin user:', {
                email: adminUser.email,
                password: 'CarbonLeap1!'
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkAndResetUsers();