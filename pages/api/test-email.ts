// pages/api/test-email.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { emailService } from '../../lib/emailService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Test the email configuration
    const configTest = await emailService.verifyConfiguration();
    
    if (!configTest) {
      return res.status(500).json({
        success: false,
        message: 'Email configuration verification failed'
      });
    }

    // Send a test email
    const testResult = await emailService.sendEmail(
      process.env.ADMIN_NOTIFICATION_EMAIL!,
      'Email Configuration Test - CarbonLeap',
      `
      <div style="font-family: Arial, sans-serif;">
        <h2>Email Configuration Test</h2>
        <p>This is a test email to verify the email configuration is working correctly.</p>
        <p>If you received this email, the configuration is successful.</p>
        <p>Environment: ${process.env.NODE_ENV}</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      </div>
      `
    );

    return res.status(200).json({
      success: true,
      message: 'Email configuration test completed successfully',
      testResult
    });
  } catch (error) {
    console.error('Email test failed:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Email test failed',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
}