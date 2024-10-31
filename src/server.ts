// server.ts

import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { emailService } from './emailService';
import 'dotenv/config';
import { SecureSQLQueryService } from './services/SecureSQLQueryService';
import multer from 'multer';
import { parse as csvParse } from 'csv-parse';
import { Readable } from 'stream';
import { PDFDocument, rgb } from 'pdf-lib';
import path from 'path';
import { ClaimsExpirationService } from './services/ClaimsExpirationService';
import { PDFTemplateService } from './services/PDFTemplateService';
import fs from 'fs/promises';

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

interface CustomError extends Error {
  code?: string;
  status?: number;
}

interface InterventionRecord {
  clientName?: string;
  emissionsAbated?: string;
  date: string;
  interventionId: string;
  modality: string;
  geography: string;
  additionality?: string;
  causality?: string;
  lowCarbonFuel?: string;
  feedstock?: string;
  certificationScheme?: string;
}


const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});

// Initialize Express app
const app = express();
const pdfTemplateService = new PDFTemplateService();
const claimsExpirationService = new ClaimsExpirationService();

// Configure multer with file filter
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'text/csv') {
      cb(new Error('Only CSV files are allowed'));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

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

// Start the claims expiration service when the server starts
claimsExpirationService.start();

// Prisma logging
prisma.$on('query', (e) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Query: ' + e.query);
    console.log('Duration: ' + e.duration + 'ms');
  }
});

// Email configuration verification
async function verifyEmailConfig() {
  try {
    await emailService.verifyConfiguration();
    console.log('Email configuration verified successfully');
  } catch (error) {
    console.error('Email configuration error:', error);
    // Optional: throw error if email is critical for your application
    // throw new Error('Failed to configure email service');
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
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access denied: No token provided',
      });
      return;
    }

    jwt.verify(token, process.env.JWT_SECRET!, async (err, decoded) => {
      if (err) {
        res.status(403).json({
          success: false,
          message: 'Access denied: Invalid token',
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: (decoded as JWTPayload).id },
        include: { domain: true },
      });

      if (!user) {
        res.status(403).json({
          success: false,
          message: 'Access denied: User no longer exists',
        });
        return;
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

// Validation middleware for intervention requests
const validateInterventionRequest = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
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
    (field) => req.body[field] === undefined || req.body[field] === null
  );

  if (missingFields.length > 0) {
    res.status(400).json({
      success: false,
      message: `Missing required fields: ${missingFields.join(', ')}`,
    });
    return;
  }

  next();
};

// Error handling middleware
app.use(
  (
    err: CustomError,
    _req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
      success: false,
      message:
        process.env.NODE_ENV === 'development'
          ? err.message
          : 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
);

app.use('/storage', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const filePath = path.join(process.cwd(), 'storage', req.path);
    
    // Prevent directory traversal
    if (!filePath.startsWith(path.join(process.cwd(), 'storage'))) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      // Check if file is metadata
      if (filePath.endsWith('.meta.json')) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Check metadata for access control
      const metadataPath = `${filePath}.meta.json`;
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);
        
        // Check if user has access to this file
        if (metadata.domainId && metadata.domainId !== req.user?.domainId && !req.user?.isAdmin) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      } catch (error) {
        // If no metadata exists, continue serving the file
      }

      // Set appropriate headers
      res.setHeader('Content-Type', getMimeType(filePath));
      if (process.env.NODE_ENV === 'production') {
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
      }

      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'File not found' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    next(error);
  }
});

// Helper function for MIME types
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response): void => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: 'connected',
    email: 'configured',
  });
});

// Test email endpoint
app.post('/api/test-email', async (_req: Request, res: Response): Promise<void> => {
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
app.post('/api/login', async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { domain: true },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
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
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
        return;
      }

      const { companyName, domainName } = req.body;

      if (!companyName || !domainName) {
        res.status(400).json({
          success: false,
          message: 'Company name and domain name are required',
        });
        return;
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
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
        return;
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
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
        return;
      }

      const { email, password, isAdmin, domainId } = req.body;

      if (!email || !password || !domainId) {
        res.status(400).json({
          success: false,
          message: 'Email, password, and domainId are required',
        });
        return;
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
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
        return;
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
  validateInterventionRequest,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      console.log('Processing intervention request:', req.body);

      // Determine userId
      let userId = req.user!.id;

      if (req.user!.isAdmin && (req.body.userId || req.body.domainId)) {
        if (req.body.userId) {
          userId = req.body.userId;
        } else if (req.body.domainId) {
          const domainUsers = await prisma.user.findMany({
            where: { domainId: req.body.domainId },
            select: { id: true },
          });
          if (domainUsers.length > 0) {
            userId = domainUsers[0].id;
          } else {
            res.status(400).json({
              success: false,
              message: 'No users found for the specified domainId',
            });
            return;
          }
        }
      } else if ((req.body.userId || req.body.domainId) && !req.user!.isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Access denied: Cannot specify userId or domainId',
        });
        return;
      }

      // Parse and validate vintage
      const vintage = parseInt(req.body.vintage);
      if (isNaN(vintage)) {
        res.status(400).json({
          success: false,
          message: 'Invalid vintage year provided',
        });
        return;
      }

      // Prepare data for creation with all required fields
      const interventionRequestData = {
        userId: userId,
        clientName: req.body.clientName || 'Unknown Client',
        emissionsAbated: parseFloat(req.body.emissionsAbated) || 0,
        date: new Date(req.body.date),
        interventionId: req.body.interventionId,
        modality: req.body.modality,
        geography: req.body.geography,
        additionality: req.body.additionality === true || req.body.additionality === 'true' || req.body.additionality === 'Yes',
        causality: req.body.causality === true || req.body.causality === 'true' || req.body.causality === 'Yes',
        status: req.body.status || 'Verified',
        // Include all required fields with proper defaults
        lowCarbonFuel: req.body.lowCarbonFuel || 'n/a',
        feedstock: req.body.feedstock || 'n/a',
        certificationScheme: req.body.certificationScheme || 'n/a',
        ghgEmissionSaving: req.body.ghgEmissionSaving || '0',
        vintage: vintage, // Add the parsed vintage field
        thirdPartyVerification: req.body.thirdPartyVerification || 'Pending',
        // Optional fields
        deliveryTicketNumber: req.body.deliveryTicketNumber,
        materialName: req.body.materialName,
        materialId: req.body.materialId,
        vendorName: req.body.vendorName,
        quantity: parseFloat(req.body.quantity) || 0,
        unit: req.body.unit,
        amount: parseFloat(req.body.amount) || 0,
        materialSustainabilityStatus: req.body.materialSustainabilityStatus === true,
        interventionType: req.body.interventionType,
        standards: req.body.standards,
        // Set default amounts
        totalAmount: parseFloat(req.body.emissionsAbated) || 0,
        remainingAmount: parseFloat(req.body.emissionsAbated) || 0
      };

      console.log('Creating intervention with data:', interventionRequestData);

      const interventionRequest = await prisma.interventionRequest.create({
        data: interventionRequestData,
      });

      console.log('Intervention request created:', interventionRequest);

      res.status(200).json({
        success: true,
        message: 'Request submitted successfully',
        requestId: interventionRequest.id,
        data: interventionRequest,
      });
    } catch (error) {
      console.error('Error creating intervention request:', error);
      next(error);
    }
  }
);

app.get(
  '/api/intervention-requests',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
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

      // Transform the data to match frontend expectations exactly
      const transformedRequests = requests.map((request) => ({
        clientName: request.clientName || '',
        emissionsAbated: request.emissionsAbated || 0,
        date: request.date ? request.date.toLocaleDateString() : '',
        interventionId: request.interventionId || '',
        modality: request.modality || '',
        geography: request.geography || '',
        additionality: request.additionality ? 'Yes' : 'No',
        causality: request.causality ? 'Yes' : 'No',
        status: (request.status || '').toLowerCase(),
        deliveryTicketNumber: request.deliveryTicketNumber || '',
        materialName: request.materialName || '',
        materialId: request.materialId || '',
        vendorName: request.vendorName || '',
        quantity: request.quantity || 0,
        unit: request.unit || '',
        amount: request.amount || 0,
        materialSustainabilityStatus: request.materialSustainabilityStatus || false,
        interventionType: request.interventionType || '',
        biofuelProduct: request.lowCarbonFuel || '',
        baselineFuelProduct: request.baselineFuelProduct || '',
        typeOfVehicle: request.typeOfVehicle || '',
        year: request.date ? new Date(request.date).getFullYear().toString() : '',
        typeOfFeedstock: request.feedstock || '',
        emissionReductionPercentage: request.emissionReductionPercentage || 0,
        intensityOfBaseline: request.intensityOfBaseline || '',
        intensityLowCarbonFuel: request.intensityLowCarbonFuel || '',
        certification: request.certificationScheme || '',
        scope: request.scope || '',
        thirdPartyVerifier: request.thirdPartyVerifier || '',
        standards: request.standards || ''
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
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
        return;
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
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
        return;
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

      res.json({
        success: true,
        data: updatedRequest,
      });
    } catch (error) {
      next(error);
    }
  }
);


// Template management routes
app.get(
  '/api/templates/:domainId',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { domainId } = req.params;
      
      // Check authorization
      if (!req.user?.isAdmin && req.user?.domainId !== parseInt(domainId)) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to access this template',
        });
        return;
      }

      const template = await pdfTemplateService.loadDomainTemplate(parseInt(domainId));
      
      res.json({
        success: true,
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  '/api/templates/:domainId',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { domainId } = req.params;
      const templateData = req.body;
      
      // Check authorization
      if (!req.user?.isAdmin && req.user?.domainId !== parseInt(domainId)) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to modify this template',
        });
        return;
      }

      // Validate template data
      if (templateData.headerImage) {
        // Simple validation based on base64 mime type
        if (!templateData.headerImage.startsWith('data:image/')) {
          res.status(400).json({
            success: false,
            message: 'Header image must be a valid image file',
          });
          return;
        }

        const mimeType = templateData.headerImage.split(';')[0].split(':')[1];
        const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        
        if (!allowedMimeTypes.includes(mimeType)) {
          res.status(400).json({
            success: false,
            message: 'Header image must be PNG or JPEG',
          });
          return;
        }
      }

      await pdfTemplateService.saveTemplate(parseInt(domainId), templateData);
      
      res.json({
        success: true,
        message: 'Template updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Add template preview route
app.post(
  '/api/templates/:domainId/preview',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { domainId } = req.params;
      const { templateData } = req.body;

      // Check authorization
      if (!req.user?.isAdmin && req.user?.domainId !== parseInt(domainId)) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to preview this template',
        });
        return;
      }

      // Create a sample claim and intervention for preview
      const sampleData = {
        claim: {
          id: 'PREVIEW-CLAIM-001',
          amount: 100.50,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
        intervention: {
          interventionId: 'PREVIEW-INT-001',
          modality: 'Sample Intervention',
          geography: 'Sample Location',
          certificationScheme: 'Sample Certification',
          vintage: new Date().getFullYear(),
        },
        domain: await prisma.domain.findUnique({
          where: { id: parseInt(domainId) },
        }),
      };

      // Generate preview PDF with sample data
      const pdfBytes = await pdfTemplateService.generateClaimStatement(
        sampleData.claim,
        sampleData.intervention,
        sampleData.domain
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename=template-preview.pdf');
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      next(error);
    }
  }
);

// Claims routes
app.post(
  '/api/claims',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    console.log('Received claim request:', {
      body: req.body,
      path: req.path,
      method: req.method,
      user: req.user
    });

    try {
      const { interventionId, amount } = req.body;
      
      if (!interventionId || !amount) {
        console.log('Missing required fields:', { interventionId, amount });
        res.status(400).json({
          success: false,
          message: 'InterventionId and amount are required',
        });
        return;
      }

      // Start transaction
      const result = await prisma.$transaction(async (tx) => {
        // Find intervention
        const interventionRequest = await tx.interventionRequest.findFirst({
          where: {
            OR: [
              { id: interventionId },
              { interventionId: interventionId }
            ]
          },
          include: {
            claims: true
          }
        });

        if (!interventionRequest) {
          throw new Error(`Intervention not found with ID: ${interventionId}`);
        }

        // Calculate available amount
        const totalClaimed = interventionRequest.claims
          .filter(claim => claim.status === 'active')
          .reduce((sum, claim) => sum + claim.amount, 0);
        
        const available = interventionRequest.emissionsAbated - totalClaimed;

        if (amount > available) {
          throw new Error(`Insufficient available amount. Available: ${available} tCO2e`);
        }

        // Get domain for PDF generation
        const domain = await tx.domain.findUnique({
          where: { id: req.user!.domainId }
        });

        if (!domain) {
          throw new Error('Domain not found');
        }

        // Create claim
        const claim = await tx.carbonClaim.create({
          data: {
            interventionId: interventionRequest.interventionId,
            claimingDomainId: req.user!.domainId,
            amount: parseFloat(amount.toString()),
            vintage: parseInt(interventionRequest.vintage.toString()),
            expiryDate: new Date(Date.now() + (2 * 365 * 24 * 60 * 60 * 1000)),
            status: 'active'
          }
        });

        // Generate PDF statement
        const pdfBuffer = await pdfTemplateService.generateClaimStatement(
          claim,
          interventionRequest,
          domain
        );

        // Create directory if it doesn't exist
        const storageDir = path.join(process.cwd(), 'storage', 'claims', domain.id.toString());
        await fs.mkdir(storageDir, { recursive: true });

        // Save PDF file
        const pdfPath = path.join('claims', domain.id.toString(), `${claim.id}.pdf`);
        const fullPath = path.join(process.cwd(), 'storage', pdfPath);
        await fs.writeFile(fullPath, pdfBuffer);

        // Save metadata
        await fs.writeFile(
          `${fullPath}.meta.json`,
          JSON.stringify({
            domainId: domain.id,
            createdAt: new Date().toISOString(),
            createdBy: req.user!.id,
            mimeType: 'application/pdf',
            visibility: 'private'
          })
        );

        // Create statement record
        await tx.claimStatement.create({
          data: {
            claimId: claim.id,
            pdfUrl: `/storage/${pdfPath}`,
            templateVersion: '1.0',
            metadata: {
              generatedAt: new Date(),
              generatedBy: req.user!.id,
              template: await pdfTemplateService.loadDomainTemplate(domain.id)
            }
          }
        });

        // Update intervention's remaining amount
        await tx.interventionRequest.update({
          where: { id: interventionRequest.id },
          data: {
            remainingAmount: available - amount
          }
        });

        // Return complete claim data
        return tx.carbonClaim.findUnique({
          where: { id: claim.id },
          include: {
            intervention: true,
            statement: true
          }
        });
      });

      console.log('Transaction completed successfully');

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Error creating claim:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Insufficient available amount')) {
          res.status(400).json({
            success: false,
            message: error.message,
            errorType: 'INSUFFICIENT_AMOUNT'
          });
        } else if (error.message.includes('Intervention not found')) {
          res.status(404).json({
            success: false,
            message: error.message,
            errorType: 'INTERVENTION_NOT_FOUND'
          });
        } else {
          res.status(400).json({
            success: false,
            message: error.message,
            errorType: 'UNKNOWN_ERROR'
          });
        }
      } else {
        next(error);
      }
    }
  }
);

app.get(
  '/api/claims',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const claims = await prisma.carbonClaim.findMany({
        where: {
          claimingDomainId: req.user!.domainId,
        },
        include: {
          intervention: true,
          statement: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json({
        success: true,
        data: claims,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Helper function to generate PDF statement
async function generateClaimStatement(claim: any, intervention: any): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.276, 841.890]); // A4 size

  // Add content
  const { width, height } = page.getSize();
  
  page.drawText('Carbon Reduction Claim Statement', {
    x: 50,
    y: height - 50,
    size: 20,
  });

  const content = [
    `Claim ID: ${claim.id}`,
    `Intervention ID: ${intervention.interventionId}`,
    `Amount Claimed: ${claim.amount} tCO2e`,
    `Vintage: ${intervention.vintage}`,
    `Valid Until: ${claim.expiryDate.toLocaleDateString()}`,
    '',
    'Intervention Details:',
    `Type: ${intervention.modality}`,
    `Geography: ${intervention.geography}`,
    `Certification: ${intervention.certificationScheme}`,
  ];

  content.forEach((text, index) => {
    page.drawText(text, {
      x: 50,
      y: height - 100 - (index * 25),
      size: 12,
      color: rgb(0, 0, 0),
    });
  });

  return pdfDoc.save();
}

// File upload endpoint for interventions
app.post(
  '/api/admin/upload-interventions',
  authenticateToken,
  upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
        return;
      }

      const domainId = parseInt(req.body.domainId);
      if (isNaN(domainId)) {
        res.status(400).json({
          success: false,
          message: 'Valid domainId is required',
        });
        return;
      }

      console.log('Processing file upload for domainId:', domainId);

      // Process CSV file
      const records: Array<{[key: string]: string}> = [];
      const parser = csvParse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        skip_records_with_empty_values: true,
        bom: true,
        delimiter: ';', // Explicitly set semicolon as delimiter
        relaxColumnCount: true, // Add some flexibility to column counting
        fromLine: 1 // Start from first line
      });

      // Add record validation
      let currentLine = 1;
      parser.on('readable', () => {
        let record;
        while ((record = parser.read())) {
          currentLine++;
          // Validate record has required fields
          if (!record['INTERVENTION ID'] || !record['DELIVERY DATE']) {
            console.warn(`Skipping line ${currentLine} due to missing required fields`);
            continue;
          }
          records.push(record);
        }
      });

      parser.on('error', (error) => {
        console.error('CSV parsing error on line', currentLine, ':', error);
      });

      const processPromise = new Promise<void>((resolve, reject) => {
        parser.on('readable', () => {
          let record;
          while ((record = parser.read())) {
            records.push(record);
          }
        });
        
        parser.on('error', (error) => {
          console.error('CSV parsing error:', error);
          reject(error);
        });
        
        parser.on('end', () => resolve());
      });

      // Create readable stream from buffer
      const bufferStream = new Readable();
      bufferStream.push(req.file.buffer);
      bufferStream.push(null);
      bufferStream.pipe(parser);

      await processPromise;
      
      console.log('Parsed records:', records.length);
      if (records.length > 0) {
        console.log('Sample record:', JSON.stringify(records[0], null, 2));
      }

      // Function to parse date in MM/DD/YYYY format
      const parseDate = (dateStr: string): Date => {
        try {
          if (!dateStr) throw new Error('Date string is empty');
          const [month, day, year] = dateStr.split('/').map(num => parseInt(num));
          const date = new Date(year, month - 1, day);
          if (isNaN(date.getTime())) throw new Error('Invalid date');
          return date;
        } catch (err) {
          console.error('Date parsing error for:', dateStr);
          throw err;
        }
      };

      // Validate and transform records
      const interventions = records.map((record) => {
        try {
          const interventionId = record['INTERVENTION ID'];
          if (!interventionId) {
            throw new Error('INTERVENTION ID is required');
          }

          const dateStr = record['DELIVERY DATE'];
          if (!dateStr) {
            throw new Error('DELIVERY DATE is required');
          }

          // Map CSV columns to database fields with proper type conversion
          const interventionData = {
            userId: req.user!.id,
            clientName: record['CLIENT NAME'] || 'Unknown Client',
            emissionsAbated: parseFloat(record['EMISSIONS ABATED'] || '0'),
            date: parseDate(dateStr),
            interventionId,
            deliveryTicketNumber: record['DELIVERY TICKET NUMBER'] || '',
            materialName: record['MATERIAL NAME'] || '',
            materialId: record['MATERIAL ID'] || '',
            vendorName: record['VENDOR NAME'] || '',
            quantity: parseFloat(record['QUANTITY'] || '0'),
            unit: record['UNIT'] || '',
            amount: parseFloat(record['AMOUNT [L]'] || '0'),
            materialSustainabilityStatus: record['MATERIAL SUSTAINABILITY STATUS']?.toLowerCase() === 'true',
            modality: record['MODALITY'] || 'Unknown',
            interventionType: record['INTERVENTION TYPE'] || '',
            lowCarbonFuel: record['BIOFUEL PRODUCT'] || 'n/a',
            baselineFuelProduct: record['BASELINE FUEL PRODUCT'] || '',
            typeOfVehicle: record['TYPE OF VEHICLE'] || '',
            feedstock: record['TYPE OF FEEDSTOCK'] || 'n/a',
            geography: record['GEOGRAPHY'] || 'Unknown',
            emissionReductionPercentage: parseFloat(record['%_EMISSION_REDUCTION'] || '0'),
            intensityOfBaseline: record['INTENSITY_OF_BASELINE'] || '',
            intensityLowCarbonFuel: record['INTENSITY_LOW-CARBON_FUEL'] || '',
            certificationScheme: record['CERTIFICATION'] || 'n/a',
            scope: record['SCOPE'] || '',
            thirdPartyVerifier: record['THIRD PARTY VERIFIER'] || '',
            causality: /^(yes|true|1)$/i.test(record['CAUSALITY'] || ''),
            additionality: /^(yes|true|1)$/i.test(record['ADDITIONALITY'] || ''),
            standards: record['STANDARDS'] || '',
            status: 'Verified',
            submissionDate: new Date(),
            ghgEmissionSaving: '0',
            vintage: new Date().getFullYear().toString(),
            thirdPartyVerification: 'Pending',
            remainingAmount: '0'
          };

          return interventionData;
        } catch (err) {
          console.error('Error processing record:', record);
          throw err;
        }
      });

      console.log('Processed interventions:', interventions.length);
      
      try {
        const createdInterventions = await prisma.interventionRequest.createMany({
          data: interventions,
          skipDuplicates: true,
        });
        
        console.log('Successfully created interventions:', createdInterventions.count);
        
        res.json({
          success: true,
          message: `Successfully created ${createdInterventions.count} interventions`,
          data: createdInterventions,
        });
      } catch (err) {
        console.error('Database error:', err);
        throw err;
      }
    } catch (error) {
      console.error('Error processing file upload:', error);
      if (error instanceof Error) {
        res.status(500).json({
          success: false,
          message: 'Error processing file upload',
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      } else {
        next(error);
      }
    }
  }
);

// Chat with data route
app.post(
  '/api/chat-with-data',
  authenticateToken,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { question } = req.body;

      if (!question) {
        res.status(400).json({
          success: false,
          message: 'Question is required',
        });
        return;
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
app.use((_req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Initialize email configuration
verifyEmailConfig().catch(console.error);

// Graceful shutdown handler
const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Stop the claims expiration service
  claimsExpirationService.stop();

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