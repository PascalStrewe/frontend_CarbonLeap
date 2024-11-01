// src/pages/api/transfers/index.ts

import { PrismaClient } from '@prisma/client';
import { verify } from 'jsonwebtoken';
import type { NextApiRequest, NextApiResponse } from 'next';

const prisma = new PrismaClient();

interface TransferRequest {
  interventionId: string;
  targetDomainId: number;
  amount: string;
  notes?: string;
}

interface JWTPayload {
  userId: number;
  domainId: number;
  isAdmin: boolean;
}

async function validatePartnership(
  sourceDomainId: number,
  targetDomainId: number,
  tx: PrismaClient
): Promise<boolean> {
  const partnership = await tx.domainPartnership.findFirst({
    where: {
      OR: [
        {
          AND: [
            { domain1Id: sourceDomainId },
            { domain2Id: targetDomainId },
            { status: 'active' }
          ]
        },
        {
          AND: [
            { domain1Id: targetDomainId },
            { domain2Id: sourceDomainId },
            { status: 'active' }
          ]
        }
      ]
    }
  });
  return !!partnership;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Verify JWT token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verify(token, process.env.JWT_SECRET!) as JWTPayload;

    switch (req.method) {
      case 'GET':
        return handleGetTransfers(req, res, decoded);
      case 'POST':
        return handleCreateTransfer(req, res, decoded);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Transfer API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleGetTransfers(
  req: NextApiRequest,
  res: NextApiResponse,
  decoded: JWTPayload
) {
  const transfers = await prisma.transfer.findMany({
    where: {
      OR: [
        { sourceDomainId: decoded.domainId },
        { targetDomainId: decoded.domainId }
      ]
    },
    include: {
      sourceIntervention: {
        select: {
          id: true,
          modality: true,
          scope3EmissionsAbated: true
        }
      },
      sourceDomain: {
        select: {
          name: true,
          companyName: true
        }
      },
      targetDomain: {
        select: {
          name: true,
          companyName: true
        }
      },
      createdBy: {
        select: {
          email: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return res.status(200).json(transfers);
}

async function handleCreateTransfer(
  req: NextApiRequest,
  res: NextApiResponse,
  decoded: JWTPayload
) {
  const { interventionId, targetDomainId, amount, notes }: TransferRequest = req.body;

  // Validation
  if (!interventionId || !targetDomainId || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const transfer = await prisma.$transaction(async (tx) => {
      // 1. Verify active partnership exists
      const hasPartnership = await validatePartnership(decoded.domainId, targetDomainId, tx);
      if (!hasPartnership) {
        throw new Error('No active partnership exists with the target domain');
      }

      // 2. Get intervention and verify ownership
      const intervention = await tx.interventionRequest.findUnique({
        where: { id: interventionId },
        include: {
          user: {
            select: {
              domainId: true
            }
          },
          claims: {
            where: {
              status: 'active',
              claimingDomainId: decoded.domainId,
              expiryDate: {
                gt: new Date()
              }
            }
          }
        }
      });

      if (!intervention) {
        throw new Error('Intervention not found');
      }

      if (intervention.user.domainId !== decoded.domainId) {
        throw new Error('Not authorized to transfer this intervention');
      }

      // 3. Verify claimed amount and check if it's already being transferred
      const activeTransfers = await tx.transfer.findMany({
        where: {
          sourceInterventionId: interventionId,
          status: 'pending',
          sourceDomainId: decoded.domainId
        }
      });

      const pendingTransferAmount = activeTransfers.reduce(
        (sum, transfer) => sum + parseFloat(transfer.amount.toString()),
        0
      );

      const totalClaimed = intervention.claims.reduce(
        (sum, claim) => sum + claim.amount,
        0
      );

      const availableAmount = totalClaimed - pendingTransferAmount;
      
      if (availableAmount < parseFloat(amount)) {
        throw new Error(
          `Insufficient available amount. Available: ${availableAmount} tCO2e (${totalClaimed} claimed - ${pendingTransferAmount} pending)`
        );
      }

      // 4. Create transfer with tracking numbers
      const newTransfer = await tx.transfer.create({
        data: {
          sourceInterventionId: interventionId,
          sourceDomainId: decoded.domainId,
          targetDomainId,
          amount: amount.toString(),
          status: 'pending',
          notes,
          createdById: decoded.userId
        },
        include: {
          sourceIntervention: {
            select: {
              id: true,
              modality: true,
              scope3EmissionsAbated: true
            }
          },
          sourceDomain: {
            select: {
              name: true,
              companyName: true
            }
          },
          targetDomain: {
            select: {
              name: true,
              companyName: true
            }
          },
          createdBy: {
            select: {
              email: true
            }
          }
        }
      });

      // 5. Create notifications for both parties
      await tx.notification.create({
        data: {
          type: 'TRANSFER_CREATED',
          message: `New transfer of ${amount} tCO2e created`,
          domainId: targetDomainId,
          metadata: {
            transferId: newTransfer.id,
            amount: amount,
            sourceCompany: newTransfer.sourceDomain.companyName
          }
        }
      });

      return newTransfer;
    });

    return res.status(201).json(transfer);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to create transfer' });
  }
}