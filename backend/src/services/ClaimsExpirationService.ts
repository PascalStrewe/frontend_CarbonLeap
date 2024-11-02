// src/services/ClaimsExpirationService.ts

import { PrismaClient } from '@prisma/client';
import { CronJob } from 'cron';
import { emailService } from '../emailService';

export class ClaimsExpirationService {
  private prisma: PrismaClient;
  private expirationJob: CronJob;
  private warningJob: CronJob;

  constructor() {
    this.prisma = new PrismaClient();
    
    // Run expiration check daily at midnight
    this.expirationJob = new CronJob('0 0 * * *', () => {
      this.handleExpiredClaims();
    });

    // Run warning check daily at 1 AM
    this.warningJob = new CronJob('0 1 * * *', () => {
      this.sendExpirationWarnings();
    });
  }

  public start(): void {
    this.expirationJob.start();
    this.warningJob.start();
    console.log('Claims expiration service started');
  }

  public stop(): void {
    this.expirationJob.stop();
    this.warningJob.stop();
    console.log('Claims expiration service stopped');
  }

  private async handleExpiredClaims(): Promise<void> {
    try {
      const expiredClaims = await this.prisma.carbonClaim.findMany({
        where: {
          status: 'active',
          expiryDate: {
            lte: new Date()
          }
        },
        include: {
          claimedBy: true,
          intervention: true
        }
      });

      for (const claim of expiredClaims) {
        await this.prisma.$transaction(async (tx) => {
          // Update claim status
          await tx.carbonClaim.update({
            where: { id: claim.id },
            data: { status: 'expired' }
          });

          // Create notification
          await tx.notification.create({
            data: {
              type: 'CLAIM_EXPIRED',
              message: `Carbon claim for ${claim.amount} tCO2e has expired`,
              domainId: claim.claimingDomainId,
              metadata: {
                claimId: claim.id,
                interventionId: claim.interventionId,
                amount: claim.amount
              }
            }
          });

          // Send email notification
          const emailHtml = `
            <h1>Carbon Claim Expired</h1>
            <p>Your carbon claim has expired:</p>
            <ul>
              <li>Amount: ${claim.amount} tCO2e</li>
              <li>Intervention: ${claim.intervention.modality}</li>
              <li>Claim ID: ${claim.id}</li>
              <li>Expiry Date: ${claim.expiryDate.toLocaleDateString()}</li>
            </ul>
          `;

          await emailService.sendEmail(
            'Carbon Claim Expired',
            emailHtml,
            claim.claimedBy.companyEmail
          );
        });
      }
    } catch (error) {
      console.error('Error handling expired claims:', error);
    }
  }

  private async sendExpirationWarnings(): Promise<void> {
    try {
      // Get claims expiring in the next 30 days
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + 30);

      const expiringClaims = await this.prisma.carbonClaim.findMany({
        where: {
          status: 'active',
          expiryDate: {
            gt: new Date(),
            lte: warningDate
          }
        },
        include: {
          claimedBy: true,
          intervention: true
        }
      });

      for (const claim of expiringClaims) {
        const daysUntilExpiry = Math.ceil(
          (claim.expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );

        // Create notification
        await this.prisma.notification.create({
          data: {
            type: 'CLAIM_EXPIRING_SOON',
            message: `Carbon claim for ${claim.amount} tCO2e expires in ${daysUntilExpiry} days`,
            domainId: claim.claimingDomainId,
            metadata: {
              claimId: claim.id,
              interventionId: claim.interventionId,
              amount: claim.amount,
              daysUntilExpiry
            }
          }
        });

        // Send email warning
        const emailHtml = `
          <h1>Carbon Claim Expiring Soon</h1>
          <p>Your carbon claim will expire in ${daysUntilExpiry} days:</p>
          <ul>
            <li>Amount: ${claim.amount} tCO2e</li>
            <li>Intervention: ${claim.intervention.modality}</li>
            <li>Claim ID: ${claim.id}</li>
            <li>Expiry Date: ${claim.expiryDate.toLocaleDateString()}</li>
          </ul>
          <p>Please take appropriate action before the claim expires.</p>
        `;

        await emailService.sendEmail(
          'Carbon Claim Expiring Soon',
          emailHtml,
          claim.claimedBy.companyEmail
        );
      }
    } catch (error) {
      console.error('Error sending expiration warnings:', error);
    }
  }
}

// Initialize service in server.ts
const claimsExpirationService = new ClaimsExpirationService();
claimsExpirationService.start();