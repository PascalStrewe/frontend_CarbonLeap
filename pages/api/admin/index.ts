// C:/Users/PascalStrewe/Downloads/frontend_CarbonLeap/pages/api/admin/index.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check admin authentication
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user?.isAdmin) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  if (req.method === 'GET') {
    try {
      const requests = await prisma.interventionRequest.findMany({
        orderBy: {
          submissionDate: 'desc',
        },
      });

      return res.status(200).json({ requests });
    } catch (error) {
      console.error('Error fetching intervention requests:', error);
      return res.status(500).json({ message: 'Error fetching requests' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}