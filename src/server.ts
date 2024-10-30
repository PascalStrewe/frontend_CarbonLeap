// server.ts

import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { emailService } from './emailService';
import 'dotenv/config';
import { SecureSQLQueryService } from './services/SecureSQLQueryService';

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
});

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

// Test email endpoint
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
      result,
    });
  } catch (error) {
    console.error('Test email failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: (error as Error).message,
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

// User routes
app.post(
  '/api/users',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
      }

      const { email, password, isAdmin, domainId } = req.body;

      if (!email || !password || !domainId) {
        return res.status(400).json({
          success: false,
          message: 'Email, password, and domainId are required',
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          isAdmin: isAdmin || false,
          domainId,
        },
      });

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
);

app.get(
  '/api/users',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
      }

      const users = await prisma.user.findMany({
        include: {
          domain: true,
        },
      });

      res.json({
        success: true,
        data: users,
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
        'additionality',
        'causality',
        'clientName',
        'emissionsAbated',
        'date',
        'interventionId',
      ];

      const missingFields = requiredFields.filter(
        (field) =>
          req.body[field] === undefined || req.body[field] === null
      );

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`,
        });
      }

      // Determine userId
      let userId = req.user!.id; // Default to authenticated user

      if (req.user!.isAdmin && (req.body.userId || req.body.domainId)) {
        // Admin can specify userId or domainId
        if (req.body.userId) {
          userId = req.body.userId;
        } else if (req.body.domainId) {
          // Find a user in the specified domain
          const domainUsers = await prisma.user.findMany({
            where: { domainId: req.body.domainId },
            select: { id: true },
          });
          if (domainUsers.length > 0) {
            userId = domainUsers[0].id; // Use the first user in the domain
          } else {
            return res.status(400).json({
              success: false,
              message: 'No users found for the specified domainId',
            });
          }
        }
      } else if ((req.body.userId || req.body.domainId) && !req.user!.isAdmin) {
        // Non-admins cannot specify userId or domainId
        return res.status(403).json({
          success: false,
          message: 'Access denied: Cannot specify userId or domainId',
        });
      }

      // Prepare data for creation
      const interventionRequestData = {
        userId: userId,
        clientName: req.body.clientName,
        emissionsAbated: req.body.emissionsAbated,
        date: new Date(req.body.date),
        interventionId: req.body.interventionId,
        modality: req.body.modality,
        geography: req.body.geography,
        additionality: req.body.additionality,
        causality: req.body.causality,
        status: req.body.status || 'Verified',
        lowCarbonFuel: req.body.lowCarbonFuel || 'n/a',
        feedstock: req.body.feedstock || 'n/a',
        certificationScheme: req.body.certificationScheme || 'n/a',
        // Include any other fields as necessary
      };

      const interventionRequest = await prisma.interventionRequest.create({
        data: interventionRequestData,
      });

      console.log('Intervention request created:', interventionRequest);

      // Send email notification directly using the emailService
      // (Optional: Implement email notifications if needed)

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
      // If not, only get requests for their user
      const requests = await prisma.interventionRequest.findMany({
        where: req.user?.isAdmin
          ? {}
          : { userId: req.user?.id },
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

      // Transform the data to match your frontend expectations
      const transformedRequests = requests.map((request) => ({
        clientName: request.clientName || request.user.domain.companyName,
        emissionsAbated: parseFloat(request.emissionsAbated || '0'),
        date: request.date ? new Date(request.date).toLocaleDateString() : '',
        interventionId: request.interventionId,
        modality: request.modality,
        geography: request.geography,
        additionality: request.additionality,
        causality: request.causality,
        status: request.status.toLowerCase(),
        standards: request.standards,
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
      // (Optional: Implement email notifications if needed)

      res.json({
        success: true,
        data: updatedRequest,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Chat with data route
app.post(
  '/api/chat-with-data',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { question } = req.body;

      if (!question) {
        return res.status(400).json({
          success: false,
          message: 'Question is required',
        });
      }

      const queryService = new SecureSQLQueryService({
        id: req.user!.id,
        domainId: req.user!.domainId,
        isAdmin: req.user!.isAdmin,
      });

      try {
        const answer = await queryService.query(question);
        res.json({
          success: true,
          answer,
        });
      } finally {
        await queryService.cleanup();
      }
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
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
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
