// src/pages/api/trading-partners/index.ts
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
        return getPartners(req, res, decoded);
      default:
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getPartners(
  req: NextApiRequest,
  res: NextApiResponse,
  decoded: JWTPayload
) {
  const partners = await prisma.domain.findMany({
    where: {
      OR: [
        {
          partnershipsAsFirst: {
            some: {
              domain2Id: decoded.domainId,
              status: 'active'
            }
          }
        },
        {
          partnershipsAsSecond: {
            some: {
              domain1Id: decoded.domainId,
              status: 'active'
            }
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

  return res.status(200).json(partners);
}