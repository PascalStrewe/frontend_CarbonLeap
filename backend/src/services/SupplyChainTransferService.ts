// src/services/SupplyChainTransferService.ts

import { PrismaClient } from '@prisma/client';

export class SupplyChainTransferService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async initializeIntervention(interventionId: string) {
    const intervention = await this.prisma.interventionRequest.findUnique({
      where: { id: interventionId }
    });

    if (!intervention) {
      throw new Error('Intervention not found');
    }

    // Set the initial totalAmount and remainingAmount based on emissionsAbated
    await this.prisma.interventionRequest.update({
      where: { id: interventionId },
      data: {
        totalAmount: intervention.emissionsAbated,
        remainingAmount: intervention.emissionsAbated
      }
    });
  }

  async executeTransfer(transferId: string): Promise<void> {
    return await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({
        where: { id: transferId },
        include: {
          sourceIntervention: true,
          sourceDomain: true,
          targetDomain: true,
        },
      });
  
      if (!transfer) {
        throw new Error('Transfer not found');
      }
  
      if (transfer.status !== 'pending') {
        throw new Error('Transfer is not in pending status');
      }
  
      // Check if there's enough remaining amount
      if (transfer.sourceIntervention.remainingAmount < transfer.amount) {
        throw new Error('Insufficient remaining amount for transfer');
      }
  
      // Get a user from the target domain to associate with the new intervention
      const targetDomainUser = await tx.user.findFirst({
        where: { domainId: transfer.targetDomainId }
      });
  
      if (!targetDomainUser) {
        throw new Error('No user found in target domain');
      }
  
      // Decrease source intervention's remaining amount
      await tx.interventionRequest.update({
        where: { id: transfer.sourceInterventionId },
        data: {
          remainingAmount: {
            decrement: transfer.amount
          }
        }
      });
  
      // Create new intervention for target domain with correct user
      const newIntervention = await tx.interventionRequest.create({
        data: {
          userId: targetDomainUser.id,  // Using target domain user's ID
          interventionId: `${transfer.sourceInterventionId}_transfer_${transfer.id}`,
          clientName: transfer.targetDomain.companyName,
          emissionsAbated: transfer.amount,
          totalAmount: transfer.amount,
          remainingAmount: transfer.amount,
          date: new Date(),
          status: 'verified',
          modality: `Transfer from ${transfer.sourceDomain.companyName}`,
          geography: transfer.sourceIntervention.geography,
          additionality: transfer.sourceIntervention.additionality,
          causality: transfer.sourceIntervention.causality,
          vintage: transfer.sourceIntervention.vintage,
          ghgEmissionSaving: transfer.sourceIntervention.ghgEmissionSaving,
          thirdPartyVerification: 'Transfer Verified',
          lowCarbonFuel: 'n/a',
          feedstock: 'n/a',
          certificationScheme: 'n/a'
        }
      });
  
      // Complete the transfer
      await tx.transfer.update({
        where: { id: transferId },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      });
  
      // Create notifications for both parties
      await tx.notification.createMany({
        data: [
          {
            type: 'TRANSFER_COMPLETED',
            message: `Transfer of ${transfer.amount} tCO2e has been completed`,
            domainId: transfer.sourceDomainId,
            metadata: {
              transferId: transfer.id,
              amount: transfer.amount,
              sourceInterventionId: transfer.sourceInterventionId,
              newInterventionId: newIntervention.id
            }
          },
          {
            type: 'TRANSFER_COMPLETED',
            message: `Received transfer of ${transfer.amount} tCO2e`,
            domainId: transfer.targetDomainId,
            metadata: {
              transferId: transfer.id,
              amount: transfer.amount,
              sourceInterventionId: transfer.sourceInterventionId,
              newInterventionId: newIntervention.id
            }
          }
        ]
      });
    });
  }

  async validateTransfer(params: {
    sourceDomainId: number;
    targetDomainId: number;
    interventionId: string;
    amount: number;
  }): Promise<{ isValid: boolean; error?: string }> {
    const { sourceDomainId, targetDomainId, interventionId, amount } = params;

    // Get source and target domains with their supply chain levels
    const [sourceDomain, targetDomain] = await Promise.all([
      this.prisma.domain.findUnique({
        where: { id: sourceDomainId },
        select: { id: true, supplyChainLevel: true }
      }),
      this.prisma.domain.findUnique({
        where: { id: targetDomainId },
        select: { id: true, supplyChainLevel: true }
      })
    ]);

    if (!sourceDomain || !targetDomain) {
      return { isValid: false, error: 'Invalid source or target domain' };
    }

    // Check if on same level
    const isSameLevel = sourceDomain.supplyChainLevel === targetDomain.supplyChainLevel;

    // Get intervention with its claims
    const intervention = await this.prisma.interventionRequest.findFirst({
      where: { interventionId },
      include: {
        claims: {
          where: {
            status: 'active',
            claimingDomainId: sourceDomainId
          }
        }
      }
    });

    if (!intervention) {
      return { isValid: false, error: 'Intervention not found' };
    }

    // Calculate total claimed amount
    const totalClaimed = intervention.claims.reduce(
      (sum, claim) => sum + claim.amount,
      0
    );

    // For same level transfers
    if (isSameLevel) {
      // If there are claims, prevent transfer
      if (totalClaimed > 0) {
        return {
          isValid: false,
          error: 'Cannot transfer claimed reductions between companies at the same supply chain level'
        };
      }
      return { isValid: true };
    }

    // For different levels
    const isUpwardTransfer = sourceDomain.supplyChainLevel < targetDomain.supplyChainLevel;
    
    // Only allow transfers up the supply chain
    if (!isUpwardTransfer) {
      return {
        isValid: false,
        error: 'Transfers can only be made up the supply chain'
      };
    }

    // For upward transfers, ensure amount is claimed
    if (totalClaimed < amount) {
      return {
        isValid: false,
        error: 'Reductions must be claimed before transferring up the supply chain'
      };
    }

    return { isValid: true };
  }
}