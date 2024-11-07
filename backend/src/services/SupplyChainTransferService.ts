// services/SupplyChainTransferService.ts

import { PrismaClient } from '@prisma/client';

export class SupplyChainTransferService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async executeTransfer(transferId: string): Promise<void> {
    return await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({
        where: { id: transferId },
        include: {
          sourceIntervention: true,
          sourceDomain: true,
          targetDomain: true,
          parentTransfer: true,
          sourceClaim: true,
        },
      });
 
      if (!transfer) {
        throw new Error('Transfer not found');
      }
 
      if (transfer.status !== 'pending') {
        throw new Error('Transfer is not in pending status');
      }

      // Get a user from the target domain to associate with the new intervention
      const targetDomainUser = await tx.user.findFirst({
        where: { domainId: transfer.targetDomainId }
      });
 
      if (!targetDomainUser) {
        throw new Error('No user found in target domain');
      }

      // Update source claim
      await tx.carbonClaim.update({
        where: { id: transfer.sourceClaimId },
        data: {
          transfers: {
            connect: { id: transfer.id }
          }
        }
      });

      // Create new intervention for target domain based on transfer
      const newIntervention = await tx.interventionRequest.create({
        data: {
          userId: targetDomainUser.id,
          interventionId: `${transfer.sourceIntervention.interventionId}_transfer_${transfer.id}`,
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
 
      // Update the transfer status
      await tx.transfer.update({
        where: { id: transferId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          targetIntervention: {
            connect: { id: newIntervention.id }
          }
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
              sourceClaimId: transfer.sourceClaimId,
              targetInterventionId: newIntervention.id
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
              sourceClaimId: transfer.sourceClaimId,
              targetInterventionId: newIntervention.id
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
    sourceClaimId: string;
  }): Promise<{ isValid: boolean; error?: string }> {
    const { sourceDomainId, targetDomainId, interventionId, amount, sourceClaimId } = params;

    try {
      // Fetch all necessary data in parallel
      const [sourceDomain, targetDomain, sourceClaim, allClaimsAtSourceLevel] = await Promise.all([
        this.prisma.domain.findUnique({
          where: { id: sourceDomainId },
          select: { id: true, supplyChainLevel: true, name: true }
        }),
        this.prisma.domain.findUnique({
          where: { id: targetDomainId },
          select: { id: true, supplyChainLevel: true, name: true }
        }),
        this.prisma.carbonClaim.findUnique({
          where: { id: sourceClaimId },
          include: {
            intervention: true,
            transfers: {
              where: {
                status: { in: ['completed', 'pending'] }
              }
            }
          }
        }),
        this.prisma.carbonClaim.findMany({
          where: {
            interventionId,
            claimLevel: sourceDomain?.supplyChainLevel,
            status: 'active'
          },
          include: {
            transfers: {
              where: {
                status: { in: ['completed', 'pending'] }
              }
            }
          }
        })
      ]);

      // Basic validation checks
      if (!sourceDomain || !targetDomain) {
        return { isValid: false, error: 'Invalid source or target domain' };
      }

      if (!sourceClaim) {
        return { isValid: false, error: 'Source claim not found' };
      }

      if (sourceClaim.claimingDomainId !== sourceDomainId) {
        return { isValid: false, error: 'Not authorized to transfer this claim' };
      }

      if (sourceClaim.status !== 'active') {
        return { isValid: false, error: 'Can only transfer active claims' };
      }

      // Supply chain level validation
      if (targetDomain.supplyChainLevel <= sourceDomain.supplyChainLevel) {
        return { 
          isValid: false, 
          error: `Transfers can only be made downstream in the supply chain. Target level (${targetDomain.supplyChainLevel}) must be higher than source level (${sourceDomain.supplyChainLevel})`
        };
      }

      // Calculate various totals
      const totalTransferredFromClaim = sourceClaim.transfers.reduce(
        (sum, transfer) => sum + transfer.amount,
        0
      );

      const totalTransferredAtLevel = allClaimsAtSourceLevel.reduce(
        (sum, claim) => sum + claim.transfers.reduce(
          (transferSum, transfer) => transferSum + transfer.amount,
          0
        ),
        0
      );

      const totalClaimedAtLevel = allClaimsAtSourceLevel.reduce(
        (sum, claim) => sum + claim.amount,
        0
      );

      // Amount validations
      const availableFromClaim = sourceClaim.amount - totalTransferredFromClaim;
      if (amount > availableFromClaim) {
        return {
          isValid: false,
          error: `Cannot transfer more than available from claim. Available: ${availableFromClaim.toFixed(2)} tCO2e`
        };
      }

      const availableAtLevel = totalClaimedAtLevel - totalTransferredAtLevel;
      if (amount > availableAtLevel) {
        return {
          isValid: false,
          error: `Cannot transfer more than available at this level. Available: ${availableAtLevel.toFixed(2)} tCO2e`
        };
      }

      // Check for pending transfers to this target domain
      const pendingTransferToSameTarget = await this.prisma.transfer.findFirst({
        where: {
          sourceClaimId: sourceClaimId,
          targetDomainId: targetDomainId,
          status: 'pending'
        }
      });

      if (pendingTransferToSameTarget) {
        return {
          isValid: false,
          error: 'There is already a pending transfer to this domain for this claim'
        };
      }

      return { isValid: true };
    } catch (error) {
      console.error('Error validating transfer:', error);
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'An error occurred while validating the transfer'
      };
    }
  }

  async getTransferHistory(interventionId: string) {
    try {
      const transfers = await this.prisma.transfer.findMany({
        where: {
          sourceIntervention: {
            interventionId: interventionId
          }
        },
        include: {
          sourceIntervention: {
            select: {
              interventionId: true,
              modality: true,
              emissionsAbated: true,
              clientName: true
            }
          },
          sourceDomain: {
            select: {
              id: true,
              name: true,
              companyName: true,
              supplyChainLevel: true
            }
          },
          targetDomain: {
            select: {
              id: true,
              name: true,
              companyName: true,
              supplyChainLevel: true
            }
          },
          sourceClaim: {
            select: {
              id: true,
              amount: true,
              claimLevel: true
            }
          },
          childTransfers: {
            include: {
              sourceDomain: true,
              targetDomain: true,
              sourceClaim: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return {
        transfers,
        transferTree: this.buildTransferTree(transfers)
      };
    } catch (error) {
      console.error('Error fetching transfer history:', error);
      throw error;
    }
  }

  private buildTransferTree(transfers: any[]) {
    const transferMap = new Map();
    const rootTransfers = [];

    // First pass: Create map entries for all transfers
    transfers.forEach(transfer => {
      transferMap.set(transfer.id, {
        ...transfer,
        children: []
      });
    });

    // Second pass: Build the tree structure
    transfers.forEach(transfer => {
      if (transfer.parentTransferId && transferMap.has(transfer.parentTransferId)) {
        const parent = transferMap.get(transfer.parentTransferId);
        parent.children.push(transferMap.get(transfer.id));
      } else {
        rootTransfers.push(transferMap.get(transfer.id));
      }
    });

    return rootTransfers;
  }

  async calculateTotalTransferredAmount(interventionId: string): Promise<number> {
    const transfers = await this.prisma.transfer.findMany({
      where: {
        sourceIntervention: {
          interventionId: interventionId
        },
        status: 'completed'
      }
    });

    return transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
  }

  async calculateAvailableAmount(interventionId: string, claimId: string): Promise<number> {
    const claim = await this.prisma.carbonClaim.findUnique({
      where: { id: claimId },
      include: {
        transfers: {
          where: {
            status: { in: ['completed', 'pending'] }
          }
        }
      }
    });

    if (!claim) {
      throw new Error('Claim not found');
    }

    const totalTransferred = claim.transfers.reduce(
      (sum, transfer) => sum + transfer.amount,
      0
    );

    return claim.amount - totalTransferred;
  }
}