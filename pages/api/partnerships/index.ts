// src/pages/api/partnerships/index.ts

import { PrismaClient } from '@prisma/client';
import { verify } from 'jsonwebtoken';
import type { NextApiRequest, NextApiResponse } from 'next';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verify(token, process.env.JWT_SECRET!) as JWTPayload;

    switch (req.method) {
      case 'GET':
        return getPartnerships(req, res, decoded);
      case 'POST':
        return createPartnership(req, res, decoded);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Partnership API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getPartnerships(
  req: NextApiRequest,
  res: NextApiResponse,
  decoded: JWTPayload
) {
  const partnerships = await prisma.domainPartnership.findMany({
    where: {
      OR: [
        { domain1Id: decoded.domainId },
        { domain2Id: decoded.domainId }
      ]
    },
    include: {
      domain1: {
        select: {
          id: true,
          name: true,
          companyName: true
        }
      },
      domain2: {
        select: {
          id: true,
          name: true,
          companyName: true
        }
      }
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });

  return res.status(200).json(partnerships);
}

async function createPartnership(
  req: NextApiRequest,
  res: NextApiResponse,
  decoded: JWTPayload
) {
  const { domainId, message } = req.body;

  // Validation
  if (!domainId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check if partnership already exists
  const existingPartnership = await prisma.domainPartnership.findFirst({
    where: {
      OR: [
        {
          AND: [
            { domain1Id: decoded.domainId },
            { domain2Id: domainId }
          ]
        },
        {
          AND: [
            { domain1Id: domainId },
            { domain2Id: decoded.domainId }
          ]
        }
      ]
    }
  });

  if (existingPartnership) {
    if (existingPartnership.status === 'inactive') {
      // Reactivate partnership
      const updated = await prisma.domainPartnership.update({
        where: { id: existingPartnership.id },
        data: {
          status: 'pending',
          updatedAt: new Date()
        },
        include: {
          domain1: {
            select: {
              id: true,
              name: true,
              companyName: true
            }
          },
          domain2: {
            select: {
              id: true,
              name: true,
              companyName: true
            }
          }
        }
      });
      return res.status(200).json(updated);
    }
    return res.status(400).json({ error: 'Partnership already exists' });
  }

  // Create new partnership
  const partnership = await prisma.$transaction(async (tx) => {
    // Create partnership
    const newPartnership = await tx.domainPartnership.create({
      data: {
        domain1Id: decoded.domainId,
        domain2Id: domainId,
        status: 'pending'
      },
      include: {
        domain1: {
          select: {
            id: true,
            name: true,
            companyName: true
          }
        },
        domain2: {
          select: {
            id: true,
            name: true,
            companyName: true
          }
        }
      }
    });

    // Create notification for target domain
    await tx.notification.create({
      data: {
        type: 'PARTNERSHIP_REQUEST',
        message: `New partnership request from ${newPartnership.domain1.companyName}${
          message ? `: ${message}` : ''
        }`,
        domainId,
        metadata: {
          partnershipId: newPartnership.id,
          sourceCompany: newPartnership.domain1.companyName
        }
      }
    });

    return newPartnership;
  });

  return res.status(201).json(partnership);
}

// src/pages/api/domains/available.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verify(token, process.env.JWT_SECRET!) as JWTPayload;

    // Get domains that don't have any partnership with the current domain
    const availableDomains = await prisma.domain.findMany({
      where: {
        AND: [
          { id: { not: decoded.domainId } },
          {
            NOT: {
              OR: [
                {
                  partnershipsAsFirst: {
                    some: {
                      domain2Id: decoded.domainId,
                      status: { not: 'inactive' }
                    }
                  }
                },
                {
                  partnershipsAsSecond: {
                    some: {
                      domain1Id: decoded.domainId,
                      status: { not: 'inactive' }
                    }
                  }
                }
              ]
            }
          }
        ]
      },
      select: {
        id: true,
        name: true,
        companyName: true
      }
    });

    return res.status(200).json(availableDomains);
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// src/pages/api/partnerships/[id].ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verify(token, process.env.JWT_SECRET!) as JWTPayload;
    const { id } = req.query;

    if (req.method === 'PATCH') {
      const { status } = req.body;

      const partnership = await prisma.$transaction(async (tx) => {
        // Get partnership
        const existing = await tx.domainPartnership.findUnique({
          where: { id: parseInt(id as string) },
          include: {
            domain1: true,
            domain2: true
          }
        });

        if (!existing) {
          throw new Error('Partnership not found');
        }

        // Verify authorization
        if (existing.domain1Id !== decoded.domainId && existing.domain2Id !== decoded.domainId) {
          throw new Error('Not authorized to update this partnership');
        }

        // Update partnership
        const updated = await tx.domainPartnership.update({
          where: { id: parseInt(id as string) },
          data: {
            status,
            updatedAt: new Date()
          },
          include: {
            domain1: {
              select: {
                id: true,
                name: true,
                companyName: true
              }
            },
            domain2: {
              select: {
                id: true,
                name: true,
                companyName: true
              }
            }
          }
        });

        // Create notification for the other party
        const notificationDomainId = 
          decoded.domainId === existing.domain1Id 
            ? existing.domain2Id 
            : existing.domain1Id;

        await tx.notification.create({
          data: {
            type: `PARTNERSHIP_${status.toUpperCase()}`,
            message: `Partnership ${
              status === 'active' ? 'accepted' : 
              status === 'inactive' ? 'rejected' : 
              'updated'
            } by ${
              decoded.domainId === existing.domain1Id 
                ? existing.domain1.companyName 
                : existing.domain2.companyName
            }`,
            domainId: notificationDomainId,
            metadata: {
              partnershipId: existing.id,
              status
            }
          }
        });

        return updated;
      });

      return res.status(200).json(partnership);
    }

    res.setHeader('Allow', ['PATCH']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}