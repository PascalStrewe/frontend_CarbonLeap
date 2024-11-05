// src/services/SupplyChainTransferService.ts

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
  
      // Create new intervention for target domain
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
  
      // Update the transfer with the new target intervention
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
  }): Promise<{ isValid: boolean; error?: string }> {
    const { sourceDomainId, targetDomainId, interventionId, amount } = params;

    try {
      // Get source and target domains with their supply chain levels
      const [sourceDomain, targetDomain, intervention] = await Promise.all([
        this.prisma.domain.findUnique({
          where: { id: sourceDomainId },
          select: { id: true, supplyChainLevel: true, name: true }
        }),
        this.prisma.domain.findUnique({
          where: { id: targetDomainId },
          select: { id: true, supplyChainLevel: true, name: true }
        }),
        this.prisma.interventionRequest.findFirst({
          where: { interventionId },
          include: {
            claims: {
              where: {
                status: 'active'
              }
            },
            transfersAsSource: {
              where: {
                status: 'completed'
              },
              include: {
                targetDomain: true,
                targetIntervention: {
                  include: {
                    claims: {
                      where: {
                        status: 'active'
                      }
                    }
                  }
                }
              }
            }
          }
        })
      ]);

      if (!sourceDomain || !targetDomain) {
        return { isValid: false, error: 'Invalid source or target domain' };
      }

      if (!intervention) {
        return { isValid: false, error: 'Intervention not found' };
      }

      // Check if there's enough remaining amount
      if (intervention.remainingAmount < amount) {
        return { 
          isValid: false, 
          error: `Insufficient remaining amount. Available: ${intervention.remainingAmount} tCO2e` 
        };
      }

      // Check if on same level
      const isSameLevel = sourceDomain.supplyChainLevel === targetDomain.supplyChainLevel;

      // Calculate total claimed amount in source domain
      const totalClaimedInSource = intervention.claims.reduce(
        (sum, claim) => sum + claim.amount,
        0
      );

      // For different levels
      if (!isSameLevel) {
        const isUpwardTransfer = sourceDomain.supplyChainLevel < targetDomain.supplyChainLevel;
        
        // Only allow transfers up the supply chain
        if (!isUpwardTransfer) {
          return {
            isValid: false,
            error: 'Transfers can only be made up the supply chain'
          };
        }

        // Check if the intervention has been claimed before transfer between tiers
        if (totalClaimedInSource === 0) {
          return {
            isValid: false,
            error: 'Intervention must be claimed before transferring between different supply chain levels'
          };
        }

        // Check if the claimed amount matches the transfer amount
        if (totalClaimedInSource < amount) {
          return {
            isValid: false,
            error: `Transfer amount (${amount} tCO2e) exceeds claimed amount (${totalClaimedInSource} tCO2e)`
          };
        }
      }

      // For same level transfers
      if (isSameLevel) {
        // If there are claims, prevent transfer
        if (totalClaimedInSource > 0) {
          return {
            isValid: false,
            error: 'Cannot transfer claimed reductions between companies at the same supply chain level'
          };
        }
      }

      // Calculate total claimed in original tier (for transfers back to original tier)
      const originalTierClaimedAmount = intervention.transfersAsSource.reduce((sum, transfer) => {
        // Check if this transfer went to a different tier
        if (transfer.targetDomain.supplyChainLevel !== sourceDomain.supplyChainLevel) {
          // Add up claims made in the target intervention
          const targetClaims = transfer.targetIntervention?.claims || [];
          return sum + targetClaims.reduce((claimSum, claim) => claimSum + claim.amount, 0);
        }
        return sum;
      }, 0);

      // Check if the transfer would exceed the original intervention amount when combined with existing claims
      const totalClaimedAndTransferred = originalTierClaimedAmount + amount;
      if (totalClaimedAndTransferred > intervention.totalAmount) {
        return {
          isValid: false,
          error: `Transfer would exceed original intervention amount. Maximum available: ${intervention.totalAmount - originalTierClaimedAmount} tCO2e`
        };
      }

      // Check for cyclic transfers
      const existingTransferChain = await this.prisma.transfer.findFirst({
        where: {
          OR: [
            {
              sourceDomainId: targetDomainId,
              targetDomainId: sourceDomainId,
              status: 'completed'
            },
            {
              sourceDomainId: targetDomainId,
              status: 'completed',
              parentTransfer: {
                sourceDomainId: sourceDomainId
              }
            }
          ]
        }
      });

      if (existingTransferChain) {
        return {
          isValid: false,
          error: 'Cyclic transfer detected in the supply chain'
        };
      }

      return { isValid: true };
    } catch (error) {
      console.error('Error validating transfer:', error);
      return { 
        isValid: false, 
        error: 'An error occurred while validating the transfer' 
      };
    }
  }

  async getTransferHistory(interventionId: string) {
    try {
      const intervention = await this.prisma.interventionRequest.findFirst({
        where: { interventionId },
        include: {
          transfersAsSource: {
            include: {
              targetIntervention: {
                include: {
                  transfersAsSource: {
                    include: {
                      targetIntervention: true,
                      sourceDomain: true,
                      targetDomain: true,
                      childTransfers: true
                    }
                  }
                }
              },
              sourceDomain: true,
              targetDomain: true,
              childTransfers: {
                include: {
                  targetIntervention: true,
                  sourceDomain: true,
                  targetDomain: true
                }
              }
            }
          }
        }
      });
  
      if (!intervention) {
        throw new Error('Intervention not found');
      }
  
      return {
        intervention,
        transferTree: this.buildTransferTree(intervention.transfersAsSource)
      };
    } catch (error) {
      console.error('Error fetching transfer history:', error);
      throw error;
    }
  }

  private buildTransferTree(transfers: any[]) {
    const transferMap = new Map();
    const rootTransfers = [];

    // First pass: create nodes
    transfers.forEach(transfer => {
      transferMap.set(transfer.id, {
        ...transfer,
        children: []
      });
    });

    // Second pass: build tree
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
}