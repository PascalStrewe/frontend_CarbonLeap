// src/server.ts

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

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

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

// Environment variable validation
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Initialize PrismaClient with logging
const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});

// Prisma logging events
prisma.$on('query', (e) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Query: ' + e.query);
    console.log('Duration: ' + e.duration + 'ms');
  }
});

// Email configuration
const emailConfig: EmailConfig = {
  host: process.env.SMTP_HOST!,
  port: parseInt(process.env.SMTP_PORT!, 10),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASSWORD!,
  }
};

// Initialize nodemailer transporter
const transporter: Transporter = nodemailer.createTransport(emailConfig);

// Verify email configuration
async function verifyEmailConfig() {
  try {
    await transporter.verify();
    console.log('Email configuration verified successfully');
  } catch (error) {
    console.error('Email configuration error:', error);
  }
}

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: process.env.MAX_FILE_SIZE || '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Authentication middleware
const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied: No token provided'
      });
    }

    jwt.verify(token, process.env.JWT_SECRET!, async (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Invalid token'
        });
      }

      // Verify user still exists and has correct permissions
      const user = await prisma.user.findUnique({
        where: { id: (decoded as JWTPayload).id },
        include: { domain: true }
      });

      if (!user) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: User no longer exists'
        });
      }

      req.user = {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        domainId: user.domainId,
        domain: user.domain.name
      };

      next();
    });
  } catch (error) {
    next(error);
  }
};

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: 'connected',
    email: 'configured'
  });
});

// Auth routes
app.post('/api/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { domain: true }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        domainId: user.domainId,
        domain: user.domain.name
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
        companyName: user.domain.companyName
      }
    });
  } catch (error) {
    next(error);
  }
});

// Domain routes
app.post('/api/domains', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { companyName, domainName } = req.body;

    if (!companyName || !domainName) {
      return res.status(400).json({
        success: false,
        message: 'Company name and domain name are required'
      });
    }

    const domain = await prisma.domain.create({
      data: {
        name: domainName,
        companyName
      }
    });

    res.json({
      success: true,
      data: domain
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/domains', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const domains = await prisma.domain.findMany({
      include: {
        users: {
          select: {
            id: true,
            email: true,
            isAdmin: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: domains
    });
  } catch (error) {
    next(error);
  }
});

// Intervention routes
app.post('/api/intervention-requests', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    console.log('Processing intervention request:', req.body);

    const requiredFields = [
      'modality',
      'geography',
      'lowCarbonFuel',
      'feedstock',
      'additionality',
      'causality',
      'certificationScheme'
    ];

    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'User ID is required'
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
        notificationSent: false
      }
    });

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: process.env.ADMIN_NOTIFICATION_EMAIL,
        subject: 'New Intervention Request - CarbonBank',
        html: `
          <h2>New Intervention Request Received</h2>
          <p>A new intervention request has been submitted with the following details:</p>
          <ul>
            <li><strong>Company:</strong> ${req.body.companyDomain}</li>
            <li><strong>Modality:</strong> ${req.body.modality}</li>
            <li><strong>Geography:</strong> ${req.body.geography}</li>
            <li><strong>Low Carbon Fuel:</strong> ${req.body.lowCarbonFuel}</li>
            <li><strong>Scope 3 Emissions Abated:</strong> ${req.body.scope3EmissionsAbated || 'Not provided'}</li>
          </ul>
          <p>Please log in to the admin dashboard to review this request.</p>
        `
      });

      await prisma.interventionRequest.update({
        where: { id: interventionRequest.id },
        data: { notificationSent: true }
      });
    } catch (emailError) {
      console.error('Email notification failed:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Request submitted successfully',
      requestId: interventionRequest.id,
      data: interventionRequest
    });

  } catch (error) {
    next(error);
  }
});

// Admin intervention request handling
app.get('/api/admin/intervention-requests', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const requests = await prisma.interventionRequest.findMany({
      orderBy: {
        submissionDate: 'desc'
      },
      include: {
        user: {
          select: {
            email: true,
            domain: {
              select: {
                companyName: true
              }
            }
          }
        }
      }
    });

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    next(error);
  }
});

// Error handling for unhandled routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
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
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
});

// Server error handler
server.on('error', (error: Error) => {
  console.error('Server error:', error);
  process.exit(1);
});

export default app;