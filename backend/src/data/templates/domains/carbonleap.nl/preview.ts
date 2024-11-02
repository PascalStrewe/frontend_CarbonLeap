// pages/api/domains/[domainId]/template/preview.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '../../../../../middleware/authMiddleware';
import { pdfTemplateService } from '../../../../../services/PDFTemplateService';
import { prisma } from '../../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await verifyToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { domainId } = req.query;

    // Get domain
    const domain = await prisma.domain.findUnique({
      where: { id: Number(domainId) }
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Get the latest intervention for sample data
    const sampleIntervention = await prisma.interventionRequest.findFirst({
      where: { 
        userId: user.id,
        status: 'verified'
      },
      orderBy: { date: 'desc' }
    });

    if (!sampleIntervention) {
      return res.status(404).json({ error: 'No verified interventions found for preview' });
    }

    // Create sample claim data
    const sampleClaim = {
      id: 'PREVIEW-CLAIM',
      amount: 100,
      vintage: new Date().getFullYear(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      status: 'active',
      claimDate: new Date()
    };

    // Generate preview PDF
    const pdfBuffer = await pdfTemplateService.generateClaimStatement(
      sampleClaim,
      sampleIntervention,
      domain
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=template-preview.pdf');
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error('Error generating template preview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Updated claims generation endpoint
// pages/api/claims/index.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '../../../middleware/authMiddleware';
import { prisma } from '../../../lib/prisma';
import { pdfTemplateService } from '../../../services/PDFTemplateService';
import { uploadToStorage } from '../../../lib/storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await verifyToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'POST') {
      const { interventionId, amount } = req.body;

      // Start a transaction
      const result = await prisma.$transaction(async (prisma) => {
        // Get the intervention
        const intervention = await prisma.interventionRequest.findUnique({
          where: { interventionId }
        });

        if (!intervention) {
          throw new Error('Intervention not found');
        }

        // Verify available amount
        const existingClaims = await prisma.carbonClaim.findMany({
          where: { interventionId }
        });

        const totalClaimed = existingClaims.reduce((sum, claim) => sum + claim.amount, 0);
        const available = intervention.emissionsAbated - totalClaimed;

        if (amount > available) {
          throw new Error('Insufficient available emissions to claim');
        }

        // Get domain
        const domain = await prisma.domain.findUnique({
          where: { id: user.domainId }
        });

        if (!domain) {
          throw new Error('Domain not found');
        }

        // Create claim
        const claim = await prisma.carbonClaim.create({
          data: {
            interventionId,
            amount,
            claimingDomainId: user.domainId,
            vintage: intervention.vintage,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year validity
            status: 'active'
          }
        });

        // Generate PDF statement
        const pdfBuffer = await pdfTemplateService.generateClaimStatement(
          claim,
          intervention,
          domain
        );

        // Upload PDF to storage
        const pdfUrl = await uploadToStorage(
          pdfBuffer,
          `claims/${domain.id}/${claim.id}/statement.pdf`,
          'application/pdf'
        );

        // Create statement record
        const statement = await prisma.claimStatement.create({
          data: {
            claimId: claim.id,
            pdfUrl,
            templateVersion: '1.0',
            metadata: {
              generatedAt: new Date(),
              generatedBy: user.id,
              template: await pdfTemplateService.loadDomainTemplate(domain.id)
            }
          }
        });

        // Return claim with all related data
        return prisma.carbonClaim.findUnique({
          where: { id: claim.id },
          include: {
            intervention: true,
            statement: true
          }
        });
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
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}