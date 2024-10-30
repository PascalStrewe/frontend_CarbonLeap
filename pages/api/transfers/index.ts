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

  // Start transaction
  const transfer = await prisma.$transaction(async (tx) => {
    // 1. Get intervention and verify ownership
    const intervention = await tx.interventionRequest.findUnique({
      where: { id: interventionId },
      include: {
        user: {
          select: {
            domainId: true
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

    if (intervention.status !== 'verified') {
      throw new Error('Can only transfer verified interventions');
    }

    // 2. Calculate remaining amount
    const existingTransfers = await tx.transfer.aggregate({
      where: {
        sourceInterventionId: interventionId,
        status: {
          in: ['pending', 'completed']
        }
      },
      _sum: {
        amount: true
      }
    });

    const transferredAmount = parseFloat(existingTransfers._sum.amount || '0');
    const availableAmount = parseFloat(intervention.scope3EmissionsAbated || '0') - transferredAmount;
    const requestedAmount = parseFloat(amount);

    if (requestedAmount > availableAmount) {
      throw new Error(`Insufficient available amount. Available: ${availableAmount} tCO2e`);
    }

    // 3. Create transfer
    return tx.transfer.create({
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
  });

  return res.status(201).json(transfer);
}

// src/pages/api/transfers/[id]/approve.ts
export async function handleApproveTransfer(
  req: NextApiRequest,
  res: NextApiResponse,
  decoded: JWTPayload
) {
  const { id } = req.query;

  const transfer = await prisma.$transaction(async (tx) => {
    // 1. Get transfer
    const transfer = await tx.transfer.findUnique({
      where: { id: id as string },
      include: {
        targetDomain: true
      }
    });

    if (!transfer) {
      throw new Error('Transfer not found');
    }

    // 2. Verify authorization
    if (transfer.targetDomainId !== decoded.domainId) {
      throw new Error('Not authorized to approve this transfer');
    }

    if (transfer.status !== 'pending') {
      throw new Error('Transfer is not pending');
    }

    // 3. Update transfer status
    const updatedTransfer = await tx.transfer.update({
      where: { id: id as string },
      data: {
        status: 'completed',
        completedAt: new Date()
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
        }
      }
    });

    // 4. Create notification for source domain
    await tx.notification.create({
      data: {
        type: 'TRANSFER_APPROVED',
        message: `Transfer of ${transfer.amount} tCO2e has been approved by ${transfer.targetDomain.companyName}`,
        domainId: transfer.sourceDomainId,
        metadata: {
          transferId: transfer.id,
          amount: transfer.amount
        }
      }
    });

    return updatedTransfer;
  });

  return res.status(200).json(transfer);
}

// src/pages/api/transfers/[id]/reject.ts
export async function handleRejectTransfer(
  req: NextApiRequest,
  res: NextApiResponse,
  decoded: JWTPayload
) {
  const { id } = req.query;
  const { reason } = req.body;

  const transfer = await prisma.$transaction(async (tx) => {
    // 1. Get transfer
    const transfer = await tx.transfer.findUnique({
      where: { id: id as string },
      include: {
        targetDomain: true
      }
    });

    if (!transfer) {
      throw new Error('Transfer not found');
    }

    // 2. Verify authorization
    if (transfer.targetDomainId !== decoded.domainId) {
      throw new Error('Not authorized to reject this transfer');
    }

    if (transfer.status !== 'pending') {
      throw new Error('Transfer is not pending');
    }

    // 3. Update transfer status
    const updatedTransfer = await tx.transfer.update({
      where: { id: id as string },
      data: {
        status: 'cancelled',
        notes: reason || 'Transfer rejected'
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
        }
      }
    });

    // 4. Create notification for source domain
    await tx.notification.create({
      data: {
        type: 'TRANSFER_REJECTED',
        message: `Transfer of ${transfer.amount} tCO2e has been rejected by ${transfer.targetDomain.companyName}${
          reason ? `: ${reason}` : ''
        }`,
        domainId: transfer.sourceDomainId,
        metadata: {
          transferId: transfer.id,
          amount: transfer.amount,
          reason
        }
      }
    });

    return updatedTransfer;
  });

  return res.status(200).json(transfer);
}