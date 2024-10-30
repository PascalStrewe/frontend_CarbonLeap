// src/pages/api/partnerships/request.ts

import { PrismaClient } from '@prisma/client';
import { verify } from 'jsonwebtoken';
import type { NextApiRequest, NextApiResponse } from 'next';
import { emailService } from '../../../emailService';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verify(token, process.env.JWT_SECRET!) as JWTPayload;
    const { partnerEmail, message } = req.body;

    // Find requesting domain
    const requestingDomain = await prisma.domain.findUnique({
      where: { id: decoded.domainId },
      include: { users: true }
    });

    if (!requestingDomain) {
      return res.status(404).json({ error: 'Requesting domain not found' });
    }

    // Find target domain by user email
    const targetUser = await prisma.user.findUnique({
      where: { email: partnerEmail },
      include: { domain: true }
    });

    if (!targetUser) {
      return res.status(404).json({ 
        error: 'No registered user found with this email address' 
      });
    }

    // Check if partnership already exists
    const existingPartnership = await prisma.domainPartnership.findFirst({
      where: {
        OR: [
          {
            AND: [
              { domain1Id: decoded.domainId },
              { domain2Id: targetUser.domainId }
            ]
          },
          {
            AND: [
              { domain1Id: targetUser.domainId },
              { domain2Id: decoded.domainId }
            ]
          }
        ]
      }
    });

    if (existingPartnership) {
      return res.status(400).json({ 
        error: 'A partnership request already exists with this domain' 
      });
    }

    // Create partnership request and send email notification
    const result = await prisma.$transaction(async (tx) => {
      // Create partnership request
      const partnership = await tx.domainPartnership.create({
        data: {
          domain1Id: decoded.domainId,
          domain2Id: targetUser.domainId,
          status: 'pending'
        },
        include: {
          domain1: true,
          domain2: true
        }
      });

      // Create notification
      await tx.notification.create({
        data: {
          type: 'PARTNERSHIP_REQUEST',
          message: `New partnership request from ${requestingDomain.companyName}${
            message ? `: ${message}` : ''
          }`,
          domainId: targetUser.domainId,
          metadata: {
            partnershipId: partnership.id,
            sourceCompany: requestingDomain.companyName
          }
        }
      });

      // Send email notification
      await emailService.sendEmail(
        `New Partnership Request from ${requestingDomain.companyName}`,
        `
        <h2>New Partnership Request</h2>
        <p>${requestingDomain.companyName} would like to establish a trading partnership with your organization.</p>
        ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
        <p>Please log in to your CarbonLeap dashboard to review and respond to this request.</p>
        `
      );

      return partnership;
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Partnership request error:', error);
    return res.status(500).json({ 
      error: 'Failed to process partnership request' 
    });
  }
}