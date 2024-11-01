// src/services/SupplyChainTransferService.ts

import { PrismaClient } from '@prisma/client';

export class SupplyChainTransferService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
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