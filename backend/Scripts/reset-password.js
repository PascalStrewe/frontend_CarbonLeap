const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function resetPassword() {
    try {
        const newPassword = 'TestCompany1!'; // You can change this to any new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        const updatedUser = await prisma.user.update({
            where: {
                email: 'partner@testcompany.com'
            },
            data: {
                password: hashedPassword
            }
        });

        console.log('Password reset successful for:', updatedUser.email);
        console.log('New password is:', newPassword);

    } catch (error) {
        console.error('Error resetting password:', error);
    } finally {
        await prisma.$disconnect();
    }
}

resetPassword();