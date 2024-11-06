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

     // Update source claim's transferred amount
     await tx.carbonClaim.update({
       where: { id: transfer.sourceClaimId },
       data: {
         transfers: {
           connect: { id: transfer.id }
         }
       }
     });

     // Create new intervention for target domain based on claim
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
     const [sourceDomain, targetDomain, sourceClaim] = await Promise.all([
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
               status: 'completed'
             }
           }
         }
       })
     ]);

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

     if (targetDomain.supplyChainLevel <= sourceDomain.supplyChainLevel) {
       return { isValid: false, error: 'Transfers can only be made downstream in the supply chain' };
     }

     const totalTransferred = sourceClaim.transfers.reduce(
       (sum, transfer) => sum + transfer.amount, 
       0
     );
     
     const availableToTransfer = sourceClaim.amount - totalTransferred;
     if (amount > availableToTransfer) {
       return {
         isValid: false,
         error: `Cannot transfer more than available claimed amount. Available: ${availableToTransfer.toFixed(2)} tCO2e`
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

 async getTransferHistory(interventionId: string, requestingDomainId: number) {
   try {
     const intervention = await this.prisma.interventionRequest.findFirst({
       where: { interventionId },
       include: {
         transfersAsSource: {
           where: {
             OR: [
               { sourceDomainId: requestingDomainId },
               { targetDomainId: requestingDomainId }
             ]
           },
           include: {
             sourceDomain: true,
             targetDomain: true,
             sourceClaim: true,
             childTransfers: {
               where: {
                 OR: [
                   { sourceDomainId: requestingDomainId },
                   { targetDomainId: requestingDomainId }
                 ]
               },
               include: {
                 sourceDomain: true,
                 targetDomain: true,
                 sourceClaim: true
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

   transfers.forEach(transfer => {
     transferMap.set(transfer.id, {
       ...transfer,
       children: []
     });
   });

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