// C:/Users/PascalStrewe/Downloads/frontend_CarbonLeap/pages/api/intervention_requets.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

async function sendNotificationEmail(requestData: any) {
  const emailHtml = 
    <h2>New Intervention Request Received</h2>
    <p>A new intervention request has been submitted with the following details:</p>
    <ul>
      <li><strong>Company:</strong> ${requestData.companyDomain}</li>
      <li><strong>Modality:</strong> ${requestData.modality}</li>
      <li><strong>Geography:</strong> ${requestData.geography}</li>
      <li><strong>Low Carbon Fuel:</strong> ${requestData.lowCarbonFuel}</li>
      <li><strong>Scope 3 Emissions Abated:</strong> ${requestData.scope3EmissionsAbated || 'Not provided'}</li>
    </ul>
    <p>Please log in to the admin dashboard to review this request.</p>
  ;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: 'pascalstrewe@carbonleap.nl',
    subject: 'New Intervention Request - CarbonBank',
    html: emailHtml,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Create the intervention request
    const interventionRequest = await prisma.interventionRequest.create({
      data: {
        ...req.body,
        notificationSent: false,
        status: 'pending_review',
      },
    });

    // Send email notification
    await sendNotificationEmail(req.body);

    // Update the request to mark notification as sent
    await prisma.interventionRequest.update({
      where: { id: interventionRequest.id },
      data: { notificationSent: true },
    });

    return res.status(200).json({
      message: 'Request submitted successfully',
      requestId: interventionRequest.id,
    });
  } catch (error) {
    console.error('Error processing intervention request:', error);
    return res.status(500).json({ message: 'Error processing request' });
  }
}