// src/pages/api/claims/index.ts

import { PrismaClient } from '@prisma/client';
import { verify } from 'jsonwebtoken';
import type { NextApiRequest, NextApiResponse } from 'next';
import PDFDocument from 'pdfkit';
import { Storage } from '@google-cloud/storage';
import path from 'path';

const prisma = new PrismaClient();

interface ClaimRequest {
  interventionId: string;
  amount: number;
}

interface JWTPayload {
  userId: number;
  domainId: number;
  isAdmin: boolean;
}

// Initialize Google Cloud Storage
const storage = new Storage({
  keyFilename: path.join(process.cwd(), 'google-cloud-key.json')
});
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || 'carbon-claims');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verify(token, process.env.JWT_SECRET!) as JWTPayload;

    switch (req.method) {
      case 'POST':
        return handleCreateClaim(req, res, decoded);
      case 'GET':
        return handleGetClaims(req, res, decoded);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Claims API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleCreateClaim(
  req: NextApiRequest,
  res: NextApiResponse,
  decoded: JWTPayload
) {
  const { interventionId, amount }: ClaimRequest = req.body;

  // Start transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Get intervention and verify availability
    const intervention = await tx.interventionRequest.findUnique({
      where: { id: interventionId },
      include: {
        claims: {
          where: {
            status: 'active'
          }
        }
      }
    });

    if (!intervention) {
      throw new Error('Intervention not found');
    }

    // 2. Check if amount is available
    const totalClaimed = intervention.claims.reduce(
      (sum, claim) => sum + claim.amount,
      0
    );
    const available = intervention.totalAmount - totalClaimed;

    if (amount > available) {
      throw new Error(`Insufficient available amount. Available: ${available} tCO2e`);
    }

    // 3. Calculate expiry date based on vintage years
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + intervention.expiryYears);

    // 4. Create the claim
    const claim = await tx.carbonClaim.create({
      data: {
        interventionId,
        claimingDomainId: decoded.domainId,
        amount,
        vintage: intervention.vintage,
        expiryDate,
        status: 'active'
      }
    });

    // 5. Generate PDF statement
    const pdfBuffer = await generateClaimStatement(claim, intervention);
    
    // 6. Upload PDF to storage
    const fileName = `claims/${claim.id}.pdf`;
    const file = bucket.file(fileName);
    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf'
      }
    });

    // 7. Create claim statement record
    const statement = await tx.claimStatement.create({
      data: {
        claimId: claim.id,
        pdfUrl: `https://storage.googleapis.com/${bucket.name}/${fileName}`,
        templateVersion: '1.0',
        metadata: {
          interventionType: intervention.modality,
          geography: intervention.geography,
          vintage: intervention.vintage
        }
      }
    });

    return { claim, statement };
  });

  return res.status(201).json(result);
}

async function handleGetClaims(
  req: NextApiRequest,
  res: NextApiResponse,
  decoded: JWTPayload
) {
  const claims = await prisma.carbonClaim.findMany({
    where: {
      claimingDomainId: decoded.domainId
    },
    include: {
      intervention: true,
      statement: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return res.status(200).json(claims);
}

// Helper function to generate PDF statement
async function generateClaimStatement(claim: any, intervention: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Add content to PDF
    doc.fontSize(20).text('Carbon Reduction Claim Statement', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Claim ID: ${claim.id}`);
    doc.text(`Intervention ID: ${intervention.interventionId}`);
    doc.text(`Amount Claimed: ${claim.amount} tCO2e`);
    doc.text(`Vintage: ${intervention.vintage}`);
    doc.text(`Valid Until: ${claim.expiryDate.toLocaleDateString()}`);
    doc.moveDown();
    doc.text('Intervention Details:');
    doc.text(`Type: ${intervention.modality}`);
    doc.text(`Geography: ${intervention.geography}`);
    doc.text(`Certification: ${intervention.certificationScheme}`);

    doc.end();
  });
}