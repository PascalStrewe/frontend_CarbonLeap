// server.ts

import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { emailService } from './emailService';
import 'dotenv/config';

// Type definitions
interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    isAdmin: boolean;
    domainId: number;
    domain: string;
  };
}

interface JWTPayload {
  id: number;
  email: string;
  isAdmin: boolean;
  domainId: number;
  domain: string;
}

// Initialize Express app
const app = express();

// Basic JSON parsing (needs to be before routes)
app.use(express.json({ limit: process.env.MAX_FILE_SIZE || '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Environment variable validation
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'MS_CLIENT_ID',
  'MS_CLIENT_SECRET',
  'MS_TENANT_ID',
  'SMTP_USER',
  'ADMIN_NOTIFICATION_EMAIL',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Initialize PrismaClient
const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});

// Prisma logging
prisma.$on('query', (e) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Query: ' + e.query);
    console.log('Duration: ' + e.duration + 'ms');
  }
});

async function verifyEmailConfig() {
  try {
    await emailService.verifyConfiguration();
  } catch (error) {
    console.error('Email configuration error:', error);
  }
}

// CORS middleware
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Authentication middleware
const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied: No token provided',
      });
    }

    jwt.verify(token, process.env.JWT_SECRET!, async (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Invalid token',
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: (decoded as JWTPayload).id },
        include: { domain: true },
      });

      if (!user) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: User no longer exists',
        });
      }

      req.user = {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        domainId: user.domainId,
        domain: user.domain.name,
      };

      next();
    });
  } catch (error) {
    next(error);
  }
};

// Error handling middleware
app.use(
  (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    console.error('Error:', err);
    res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === 'development'
          ? err.message
          : 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
);

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: 'connected',
    email: 'configured',
  });
});

// Test email endpoint - ADD THIS NEW SECTION
app.post('/api/test-email', async (_req: Request, res: Response) => {
  try {
    console.log('Testing email configuration...');
    
    const result = await emailService.sendEmail(
      'Test Email - CarbonLeap',
      '<h1>This is a test email</h1><p>If you receive this, the email service is working correctly.</p>'
    );

    console.log('Email test result:', result);
    
    res.json({
      success: true,
      message: 'Test email sent',
      result
    });
  } catch (error) {
    console.error('Test email failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message
    });
  }
});

// Auth routes
app.post('/api/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { domain: true },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        domainId: user.domainId,
        domain: user.domain.name,
      },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        domain: user.domain.name,
        companyName: user.domain.companyName,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Domain routes
app.post(
  '/api/domains',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
      }

      const { companyName, domainName } = req.body;

      if (!companyName || !domainName) {
        return res.status(400).json({
          success: false,
          message: 'Company name and domain name are required',
        });
      }

      const domain = await prisma.domain.create({
        data: {
          name: domainName,
          companyName,
        },
      });

      res.json({
        success: true,
        data: domain,
      });
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  '/api/domains',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
      }

      const domains = await prisma.domain.findMany({
        include: {
          users: {
            select: {
              id: true,
              email: true,
              isAdmin: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: domains,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Intervention routes
app.post(
  '/api/intervention-requests',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      console.log('Processing intervention request:', req.body);

      const requiredFields = [
        'modality',
        'geography',
        'lowCarbonFuel',
        'feedstock',
        'additionality',
        'causality',
        'certificationScheme',
      ];

      const missingFields = requiredFields.filter((field) => !req.body[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`,
        });
      }

      const interventionRequest = await prisma.interventionRequest.create({
        data: {
          userId: req.user.id,
          companyDomain: req.body.companyDomain,
          intervention: req.body.intervention,
          modality: req.body.modality,
          vesselType: req.body.vesselType,
          geography: req.body.geography,
          lowCarbonFuelLiters: req.body.lowCarbonFuelLiters,
          lowCarbonFuelMT: req.body.lowCarbonFuelMT,
          scope3EmissionsAbated: req.body.scope3EmissionsAbated,
          ghgEmissionSaving: req.body.ghgEmissionSaving,
          vintage: req.body.vintage,
          lowCarbonFuel: req.body.lowCarbonFuel,
          feedstock: req.body.feedstock,
          causality: req.body.causality,
          additionality: req.body.additionality,
          thirdPartyVerification: req.body.thirdPartyVerification,
          certificationScheme: req.body.certificationScheme,
          otherCertificationScheme: req.body.otherCertificationScheme,
          standards: req.body.standards,
          status: 'pending_review',
          notificationSent: false,
        },
      });

      console.log('Intervention request created:', interventionRequest);

      // Send email notification directly using the emailService
      try {
        console.log('Preparing to send email notification...');
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2C5282;">New Intervention Request Received</h2>
            <p>A new intervention request has been submitted with the following details:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Company:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${req.body.companyDomain}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Modality:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${req.body.modality}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Geography:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${req.body.geography}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Low Carbon Fuel:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${req.body.lowCarbonFuel}</td>
              </tr>
            </table>
            <p style="margin-top: 20px;">Please log in to the admin dashboard to review this request.</p>
          </div>
        `;

        console.log('Email HTML prepared');

        const emailResult = await emailService.sendEmail(
          'New Intervention Request - CarbonLeap',
          emailHtml
        );

        console.log('Email sending result:', emailResult);

        if (emailResult) {
          await prisma.interventionRequest.update({
            where: { id: interventionRequest.id },
            data: { notificationSent: true },
          });
          console.log('Notification status updated in database');
        }
      } catch (emailError) {
        console.error('Detailed email error:', emailError);
        console.error('Email error stack:', emailError.stack);
        if (emailError.response) {
          console.error('Graph API error response:', emailError.response.data);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Request submitted successfully',
        requestId: interventionRequest.id,
        data: interventionRequest,
      });
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  '/api/intervention-requests',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // If user is admin, get all requests
      // If not, only get requests for their company
      const requests = await prisma.interventionRequest.findMany({
        where: req.user?.isAdmin 
          ? {} 
          : { userId: req.user?.id },
        orderBy: {
          submissionDate: 'desc'
        },
        include: {
          user: {
            select: {
              email: true,
              domain: {
                select: {
                  companyName: true,
                },
              },
            },
          },
        },
      });

      // Transform the data to match your frontend expectations
      const transformedRequests = requests.map(request => ({
        clientName: request.user.domain.companyName,
        emissionsAbated: parseFloat(request.scope3EmissionsAbated || '0'),
        date: new Date(request.submissionDate).toLocaleDateString(),
        interventionId: request.id.toString(),
        modality: request.modality,
        geography: request.geography,
        additionality: request.additionality === 'Yes',
        causality: request.causality === 'Yes',
        status: request.status.toLowerCase(),
        standards: request.standards
      }));

      res.json(transformedRequests);
    } catch (error) {
      next(error);
    }
  }
);

// Admin intervention request handling
app.get(
  '/api/admin/intervention-requests',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
      }

      const requests = await prisma.interventionRequest.findMany({
        orderBy: {
          submissionDate: 'desc',
        },
        include: {
          user: {
            select: {
              email: true,
              domain: {
                select: {
                  companyName: true,
                },
              },
            },
          },
        },
      });

      res.json({
        success: true,
        data: requests,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update intervention request status
app.patch(
  '/api/admin/intervention-requests/:id',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
      }

      const { id } = req.params;
      const { status, adminNotes } = req.body;

      const updatedRequest = await prisma.interventionRequest.update({
        where: { id: parseInt(id) },
        data: {
          status,
          adminNotes,
          reviewDate: new Date(),
        },
        include: {
          user: true,
        },
      });

      // Send email notification using the emailService
      try {
        const statusMessages = {
          approved: 'Your intervention request has been approved',
          rejected: 'Your intervention request has been rejected',
          pending_review: 'Your intervention request is under review',
          more_info_needed:
            'Additional information is needed for your intervention request',
        };

        const statusMessage =
          statusMessages[status as keyof typeof statusMessages] ||
          'Your intervention request status has been updated';

        await emailService.sendEmail(
          updatedRequest.user.email,
          'Intervention Request Status Update - CarbonLeap',
          `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2C5282;">Intervention Request Status Update</h2>
            <p>Dear ${updatedRequest.user.email},</p>
            <p>${statusMessage}.</p>
            ${
              adminNotes
                ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>`
                : ''
            }
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Request ID:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${id}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Status:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${status}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Update Date:</strong></td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${new Date().toLocaleDateString()}</td>
              </tr>
            </table>
            <p>Please log in to your dashboard to view the complete details of your request.</p>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">This is an automated message from CarbonLeap.</p>
          </div>
          `
        );
      } catch (emailError) {
        console.error('Failed to send status update email:', emailError);
      }

      res.json({
        success: true,
        data: updatedRequest,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Error handling for unhandled routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Initialize email configuration
verifyEmailConfig().catch(console.error);

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Close database connections
  await prisma.$disconnect();
  console.log('Database connections closed.');

  process.exit(0);
};

// Shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error(
    'Unhandled Rejection at:',
    promise,
    'reason:',
    reason
  );
});

// Start server
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(
    `Server running in ${
      process.env.NODE_ENV || 'development'
    } mode on http://localhost:${PORT}`
  );
});

// Server error handler
server.on('error', (error: Error) => {
  console.error('Server error:', error);
  process.exit(1);
});

export default app;
