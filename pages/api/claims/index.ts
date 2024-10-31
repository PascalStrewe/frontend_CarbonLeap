// pages/api/claims/index.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { pdfTemplateService } from '../../../services/PDFTemplateService';
import { verifyToken } from '../../../middleware/authMiddleware';
import { uploadToStorage } from '../../../lib/storage'; // You'll need to implement this

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await verifyToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'POST') {
      const { interventionId, amount, generateStatement } = req.body;

      // Start a transaction
      const result = await prisma.$transaction(async (prisma) => {
        // Create the claim
        const claim = await prisma.carbonClaim.create({
          data: {
            interventionId,
            amount,
            claimingDomainId: user.domainId,
            vintage: new Date().getFullYear(),
            expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            status: 'active'
          },
          include: {
            intervention: true
          }
        });

        if (generateStatement) {
          // Fetch necessary data for PDF generation
          const domain = await prisma.domain.findUnique({
            where: { id: user.domainId }
          });

          // Generate PDF
          const pdfBuffer = await pdfTemplateService.generateClaimStatement(
            claim,
            claim.intervention,
            domain
          );

          // Upload PDF to storage
          const pdfUrl = await uploadToStorage(
            pdfBuffer,
            `claims/${claim.id}/statement.pdf`
          );

          // Create statement record
          const statement = await prisma.claimStatement.create({
            data: {
              claimId: claim.id,
              pdfUrl,
              templateVersion: '1.0',
              metadata: {
                generatedAt: new Date(),
                generatedBy: user.id
              }
            }
          });

          return { ...claim, statement };
        }

        return claim;
      });

      res.status(201).json({ data: result });
    } else if (req.method === 'GET') {
      const claims = await prisma.carbonClaim.findMany({
        where: {
          claimingDomainId: user.domainId
        },
        include: {
          intervention: true,
          statement: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      res.status(200).json({ data: claims });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in claims API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// pages/api/claims/[id]/preview-statement.ts

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await verifyToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.query;

    const claim = await prisma.carbonClaim.findUnique({
      where: { id: String(id) },
      include: {
        intervention: true
      }
    });

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (claim.claimingDomainId !== user.domainId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const domain = await prisma.domain.findUnique({
      where: { id: user.domainId }
    });

    const pdfBuffer = await pdfTemplateService.generateClaimStatement(
      claim,
      claim.intervention,
      domain
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=claim-statement-${id}-preview.pdf`);
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}