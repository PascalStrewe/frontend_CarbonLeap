// server.ts

import express, { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { emailService } from './emailService';
import 'dotenv/config';
import { SecureSQLQueryService } from './services/SecureSQLQueryService';
import { SupplyChainTransferService } from './services/SupplyChainTransferService'; // Add this line
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
// Find and replace the CORS configuration in server.ts
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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
          supplyChainLevel: req.body.supplyChainLevel || 1
        }
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
        select: {
          id: true,
          name: true,
          companyName: true,
          supplyChainLevel: true,
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
app.post('/api/claims', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  console.log('Starting claim creation process');
  const pdfTemplateService = new PDFTemplateService();
  
  try {
    const { interventionId, amount } = req.body;
    
    if (!interventionId || !amount) {
      throw new Error('InterventionId and amount are required');
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
        throw new Error(`Insufficient available amount. Available: ${available.toFixed(2)} tCO2e`);
      }

      // Get domain
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

      let pdfBuffer;
      try {
        // Generate PDF statement
        pdfBuffer = await pdfTemplateService.generateClaimStatement(
          claim,
          interventionRequest,
          domain
        );
      } catch (pdfError) {
        console.error('PDF generation failed:', pdfError);
        // Create claim without PDF, set status to indicate pending PDF
        claim.status = 'pending_pdf';
        await tx.carbonClaim.update({
          where: { id: claim.id },
          data: { status: 'pending_pdf' }
        });
        throw pdfError;
      }

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

      return tx.carbonClaim.findUnique({
        where: { id: claim.id },
        include: {
          intervention: true,
          statement: true
        }
      });
    });

    console.log('Claim creation completed successfully');
    res.json({ success: true, data: result });

  } catch (error) {
    console.error('Error in claim creation:', error);
    
    if (error instanceof Error) {
      const errorResponse = {
        success: false,
        message: error.message,
        errorType: error.message.includes('Insufficient available amount') ? 'INSUFFICIENT_AMOUNT' :
                  error.message.includes('Intervention not found') ? 'INTERVENTION_NOT_FOUND' :
                  error.message.includes('PDF generation failed') ? 'PDF_GENERATION_FAILED' :
                  'UNKNOWN_ERROR'
      };
      
      res.status(
        errorResponse.errorType === 'INTERVENTION_NOT_FOUND' ? 404 :
        errorResponse.errorType === 'PDF_GENERATION_FAILED' ? 500 :
        400
      ).json(errorResponse);
    } else {
      next(error);
    }
  }
});

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

          // Helper function to safely parse numbers
          const parseNumber = (value: any): number => {
            if (value === null || value === undefined || value === '') return 0;
            // Convert to string, replace comma with period, and remove any non-numeric characters except period
            const cleanValue = value.toString()
              .replace(',', '.')
              .replace(/[^\d.-]/g, '');
            const parsed = parseFloat(cleanValue);
            return isNaN(parsed) ? 0 : parsed;
          };

          // Helper function to parse boolean values
          const parseBoolean = (value: any): boolean => {
            if (typeof value === 'boolean') return value;
            if (typeof value === 'string') {
              return /^(yes|true|1|on)$/i.test(value.trim());
            }
            return false;
          };

          const interventionData = {
            userId: req.user!.id,
            clientName: record['CLIENT NAME']?.toString() || 'Unknown Client',
            emissionsAbated: parseNumber(record['EMISSIONS ABATED']),
            date: parseDate(dateStr),
            interventionId,
            deliveryTicketNumber: record['DELIVERY TICKET NUMBER']?.toString() || '',
            materialName: record['MATERIAL NAME']?.toString() || '',
            materialId: record['MATERIAL ID']?.toString() || '',
            vendorName: record['VENDOR NAME']?.toString() || '',
            quantity: parseNumber(record['QUANTITY']),
            unit: record['UNIT']?.toString() || '',
            amount: parseNumber(record['AMOUNT [L]']),
            materialSustainabilityStatus: parseBoolean(record['MATERIAL SUSTAINABILITY STATUS']),
            modality: record['MODALITY']?.toString() || 'Unknown',
            interventionType: record['INTERVENTION TYPE']?.toString() || '',
            lowCarbonFuel: record['BIOFUEL PRODUCT']?.toString() || 'n/a',
            baselineFuelProduct: record['BASELINE FUEL PRODUCT']?.toString() || '',
            typeOfVehicle: record['TYPE OF VEHICLE']?.toString() || '',
            feedstock: record['TYPE OF FEEDSTOCK']?.toString() || 'n/a',
            geography: record['GEOGRAPHY']?.toString() || 'Unknown',
            emissionReductionPercentage: parseNumber(record['%_EMISSION_REDUCTION']),
            intensityOfBaseline: record['INTENSITY_OF_BASELINE']?.toString() || '',
            intensityLowCarbonFuel: record['INTENSITY_LOW-CARBON_FUEL']?.toString() || '',
            certificationScheme: record['CERTIFICATION']?.toString() || 'n/a',
            scope: record['SCOPE']?.toString() || '',
            thirdPartyVerifier: record['THIRD PARTY VERIFIER']?.toString() || '',
            causality: parseBoolean(record['CAUSALITY']),
            additionality: parseBoolean(record['ADDITIONALITY']),
            standards: record['STANDARDS']?.toString() || '',
            status: 'Verified',
            submissionDate: new Date(),
            ghgEmissionSaving: record['GHG_EMISSION_SAVING']?.toString() || '0',
            vintage: parseInt(record['VINTAGE']?.toString().replace(',', '.')) || new Date().getFullYear(),
            thirdPartyVerification: record['THIRD_PARTY_VERIFICATION']?.toString() || 'Pending',
            // Convert numeric fields to proper floats
            totalAmount: parseNumber(record['EMISSIONS ABATED']), // Same as emissionsAbated
            remainingAmount: parseNumber(record['EMISSIONS ABATED']) // Initially same as emissionsAbated
          };

          // Additional validation to ensure all required fields are present and correctly typed
          if (isNaN(interventionData.emissionsAbated)) {
            console.warn(`Invalid emissions abated value for intervention ${interventionId}, defaulting to 0`);
            interventionData.emissionsAbated = 0;
          }

          if (!interventionData.interventionId) {
            throw new Error('Intervention ID is required');
          }

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

// Preview claim statement endpoint
// Add this BEFORE the error handling middleware
app.get('/api/claims/:id/preview-statement', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  console.log('Received preview request for claim:', req.params.id);
  try {
    const claimId = req.params.id;

    // Log the search criteria
    console.log('Searching for claim with criteria:', {
      id: claimId,
      domainId: req.user?.domainId
    });

    // First check if claim exists at all
    const claimExists = await prisma.carbonClaim.findUnique({
      where: { id: claimId },
    });

    console.log('Claim exists?:', !!claimExists);

    if (!claimExists) {
      console.log('Claim not found with ID:', claimId);
      res.status(404).json({
        success: false,
        message: 'Claim not found',
      });
      return;
    }

    // Fetch full claim data with relations
    const claim = await prisma.carbonClaim.findFirst({
      where: { 
        id: claimId,
        claimingDomainId: req.user!.domainId 
      },
      include: {
        intervention: true,
        claimingDomain: true,
        statement: true
      }
    });

    console.log('Found claim data:', {
      exists: !!claim,
      id: claim?.id,
      domainId: claim?.claimingDomainId,
      hasIntervention: !!claim?.intervention,
      hasDomain: !!claim?.claimingDomain
    });

    if (!claim) {
      res.status(403).json({
        success: false,
        message: 'Access denied or claim not found',
      });
      return;
    }

    // Get domain information
    const domain = await prisma.domain.findUnique({
      where: { id: req.user!.domainId },
    });

    if (!domain) {
      res.status(404).json({
        success: false,
        message: 'Domain not found',
      });
      return;
    }

    // Generate preview PDF
    const pdfBuffer = await pdfTemplateService.generateClaimStatement(
      claim,
      claim.intervention,
      claim.claimingDomain
    );

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=claim-preview.pdf');
    
    // Send the PDF
    res.send(Buffer.from(pdfBuffer));

  } catch (error) {
    console.error('Error in preview-statement endpoint:', error);
    next(error);
  }
});

app.get('/api/domains/available', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const domainPartnerships = await prisma.domainPartnership.findMany({
      where: {
        OR: [
          { domain1Id: req.user!.domainId },
          { domain2Id: req.user!.domainId }
        ],
        status: { in: ['active', 'pending'] }
      }
    });

    // Get IDs of domains that already have partnerships
    const partneredDomainIds = domainPartnerships.flatMap(p => [p.domain1Id, p.domain2Id]);

    // Get all domains except the current user's domain and those with existing partnerships
    const availableDomains = await prisma.domain.findMany({
      where: {
        AND: [
          // Exclude current user's domain
          { id: { not: req.user!.domainId } },
          // Exclude domains that already have partnerships
          { id: { notIn: partneredDomainIds } }
        ]
      },
      select: {
        id: true,
        name: true,
        companyName: true
      },
      orderBy: {
        companyName: 'asc'
      }
    });

    return res.status(200).json(availableDomains);
  } catch (error) {
    console.error('Available domains API error:', error);
    next(error);
  }
});

// Get domain's supply chain level
app.get('/api/domains/:id/supply-chain-level', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    
    const domain = await prisma.domain.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        name: true,
        companyName: true,
        supplyChainLevel: true
      }
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Only allow admins or users from the same domain to see the level
    if (!req.user?.isAdmin && req.user?.domainId !== domain.id) {
      return res.status(403).json({ error: 'Not authorized to view supply chain level' });
    }

    return res.json(domain);
  } catch (error) {
    next(error);
  }
});

// Add or update supply chain level descriptions
app.post('/api/supply-chain-levels', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Only admins can manage supply chain level descriptions' });
    }

    const { levels } = req.body;
    
    // Levels should be an array of { level: number, description: string }
    if (!Array.isArray(levels)) {
      return res.status(400).json({ error: 'Levels must be an array' });
    }

    // Store the level descriptions in a dedicated table
    const results = await prisma.$transaction(
      levels.map(level => 
        prisma.supplyChainLevelDescription.upsert({
          where: { level: level.level },
          update: { description: level.description },
          create: { level: level.level, description: level.description }
        })
      )
    );

    return res.json(results);
  } catch (error) {
    next(error);
  }
});

app.get('/api/supply-chain-levels', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const levels = await prisma.supplyChainLevelDescription.findMany({
      select: {
        level: true,
        description: true,
        examples: true
      },
      orderBy: { level: 'asc' }
    });

    // Add helper information about transportation companies
    const response = {
      levels,
      transportationNote: `
        Transportation companies can operate at multiple levels in the supply chain.
        Their level should be set based on their primary business activity:
        - Level 1: Raw material and primary goods transportation
        - Level 2: Inter-factory and manufacturing logistics
        - Level 3: Distribution and wholesale transportation
        - Level 4: Last-mile delivery and local transport
      `
    };

    return res.json(response);
  } catch (error) {
    next(error);
  }
});

// Partnerships endpoints
app.post('/api/partnerships', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { domainId, message } = req.body;

    if (!domainId) {
      return res.status(400).json({ error: 'Partner domain ID is required' });
    }

    // Check if partnership already exists
    const existingPartnership = await prisma.domainPartnership.findFirst({
      where: {
        OR: [
          {
            AND: [
              { domain1Id: req.user!.domainId },
              { domain2Id: domainId }
            ]
          },
          {
            AND: [
              { domain1Id: domainId },
              { domain2Id: req.user!.domainId }
            ]
          }
        ]
      },
      include: {
        domain1: {
          select: {
            id: true,
            name: true,
            companyName: true
          }
        },
        domain2: {
          select: {
            id: true,
            name: true,
            companyName: true
          }
        }
      }
    });

    if (existingPartnership) {
      if (existingPartnership.status === 'inactive') {
        // Reactivate partnership
        const updated = await prisma.domainPartnership.update({
          where: { id: existingPartnership.id },
          data: {
            status: 'pending',
            updatedAt: new Date()
          },
          include: {
            domain1: {
              select: {
                id: true,
                name: true,
                companyName: true
              }
            },
            domain2: {
              select: {
                id: true,
                name: true,
                companyName: true
              }
            }
          }
        });
        return res.status(200).json(updated);
      }
      return res.status(400).json({ error: 'Partnership already exists' });
    }

    // Create new partnership
    const partnership = await prisma.$transaction(async (tx) => {
      // Create partnership
      const newPartnership = await tx.domainPartnership.create({
        data: {
          domain1Id: req.user!.domainId,
          domain2Id: domainId,
          status: 'pending'
        },
        include: {
          domain1: {
            select: {
              id: true,
              name: true,
              companyName: true
            }
          },
          domain2: {
            select: {
              id: true,
              name: true,
              companyName: true
            }
          }
        }
      });

      // Create notification for target domain
      await tx.notification.create({
        data: {
          type: 'PARTNERSHIP_REQUEST',
          message: `New partnership request from ${newPartnership.domain1.companyName}${
            message ? `: ${message}` : ''
          }`,
          domainId,
          metadata: {
            partnershipId: newPartnership.id,
            sourceCompany: newPartnership.domain1.companyName
          }
        }
      });

      return newPartnership;
    });

    return res.status(201).json(partnership);
  } catch (error) {
    next(error);
  }
});

app.get('/api/partnerships', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerships = await prisma.domainPartnership.findMany({
      where: {
        OR: [
          { domain1Id: req.user!.domainId },
          { domain2Id: req.user!.domainId }
        ]
      },
      include: {
        domain1: {
          select: {
            id: true,
            name: true,
            companyName: true
          }
        },
        domain2: {
          select: {
            id: true,
            name: true,
            companyName: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return res.json(partnerships);
  } catch (error) {
    next(error);
  }
});

app.get('/api/trading-partners', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Find all active partnerships where the current domain is involved
    const partnerships = await prisma.domainPartnership.findMany({
      where: {
        OR: [
          { domain1Id: req.user!.domainId },
          { domain2Id: req.user!.domainId }
        ],
        status: 'active' // Only get active partnerships
      },
      include: {
        domain1: {
          select: {
            id: true,
            name: true,
            companyName: true
          }
        },
        domain2: {
          select: {
            id: true,
            name: true,
            companyName: true
          }
        }
      }
    });

    // Transform the partnerships into a list of trading partners
    const tradingPartners = partnerships.map(partnership => {
      // If current user is domain1, return domain2 as partner, and vice versa
      const partner = partnership.domain1Id === req.user!.domainId 
        ? partnership.domain2 
        : partnership.domain1;
        
      return {
        id: partner.id,
        name: partner.name,
        companyName: partner.companyName
      };
    });

    return res.json(tradingPartners);
  } catch (error) {
    console.error('Trading partners API error:', error);
    next(error);
  }
});

app.patch('/api/partnerships/:id', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const partnership = await prisma.$transaction(async (tx) => {
      // Get partnership
      const existing = await tx.domainPartnership.findUnique({
        where: { id: parseInt(id) },
        include: {
          domain1: true,
          domain2: true
        }
      });

      if (!existing) {
        throw new Error('Partnership not found');
      }

      // Verify authorization
      if (existing.domain1Id !== req.user!.domainId && existing.domain2Id !== req.user!.domainId) {
        throw new Error('Not authorized to update this partnership');
      }

      // Check if the user is trying to accept their own request
      if (existing.domain1Id === req.user!.domainId && status === 'active') {
        throw new Error('Cannot accept your own partnership request');
      }

      // Only domain2 (receiver) can accept/reject the partnership
      if (status === 'active' || status === 'inactive') {
        if (existing.domain2Id !== req.user!.domainId) {
          throw new Error('Only the receiving domain can accept or reject partnership requests');
        }
      }

      // Update partnership
      const updated = await tx.domainPartnership.update({
        where: { id: parseInt(id) },
        data: {
          status,
          updatedAt: new Date()
        },
        include: {
          domain1: {
            select: {
              id: true,
              name: true,
              companyName: true
            }
          },
          domain2: {
            select: {
              id: true,
              name: true,
              companyName: true
            }
          }
        }
      });

      // Create notification for the other party
      const notificationDomainId = 
        req.user!.domainId === existing.domain1Id 
          ? existing.domain2Id 
          : existing.domain1Id;

      await tx.notification.create({
        data: {
          type: `PARTNERSHIP_${status.toUpperCase()}`,
          message: `Partnership ${
            status === 'active' ? 'accepted' : 
            status === 'inactive' ? 'rejected' : 
            'updated'
          } by ${
            req.user!.domainId === existing.domain1Id 
              ? existing.domain1.companyName 
              : existing.domain2.companyName
          }`,
          domainId: notificationDomainId,
          metadata: {
            partnershipId: existing.id,
            status
          }
        }
      });

      return updated;
    });

    return res.json(partnership);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Partnership not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Not authorized to update this partnership') {
        return res.status(403).json({ error: error.message });
      }
      if (error.message === 'Cannot accept your own partnership request' || 
          error.message === 'Only the receiving domain can accept or reject partnership requests') {
        return res.status(403).json({ error: error.message });
      }
    }
    next(error);
  }
});

// Transfers endpoints
app.post('/api/transfers', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const supplyChainService = new SupplyChainTransferService(prisma);
  try {
    const { interventionId, targetDomainId, amount, notes } = req.body;

    // Validation
    if (!interventionId || !targetDomainId || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify intervention exists and belongs to user's domain
    const intervention = await prisma.interventionRequest.findFirst({
      where: {
        interventionId: interventionId,
        user: {
          domainId: req.user!.domainId
        }
      }
    });

    if (!intervention) {
      return res.status(404).json({ error: 'Intervention not found or unauthorized' });
    }

    // Check if there's an active partnership
    const partnership = await prisma.domainPartnership.findFirst({
      where: {
        OR: [
          {
            domain1Id: req.user!.domainId,
            domain2Id: targetDomainId
          },
          {
            domain1Id: targetDomainId,
            domain2Id: req.user!.domainId
          }
        ],
        status: 'active'
      }
    });

    if (!partnership) {
      return res.status(403).json({ error: 'No active partnership with target domain' });
    }

    // Check if there's enough remaining amount
    if (intervention.remainingAmount < parseFloat(amount)) {
      return res.status(400).json({ error: 'Insufficient remaining amount' });
    }

    // Validate supply chain transfer rules
    const validationResult = await supplyChainService.validateTransfer({
      sourceDomainId: req.user!.domainId,
      targetDomainId,
      interventionId,
      amount: parseFloat(amount)
    });

    if (!validationResult.isValid) {
      return res.status(400).json({ error: validationResult.error });
    }

    // Create transfer in transaction
    const transfer = await prisma.$transaction(async (tx) => {
      // Create the transfer
      const newTransfer = await tx.transfer.create({
        data: {
          sourceInterventionId: intervention.id,
          sourceDomainId: req.user!.domainId,
          targetDomainId: targetDomainId,
          amount: parseFloat(amount),
          status: 'pending',
          notes,
          createdById: req.user!.id
        },
        include: {
          sourceIntervention: true,
          sourceDomain: true,
          targetDomain: true,
          createdBy: true
        }
      });

      // Update intervention's remaining amount
      await tx.interventionRequest.update({
        where: { id: intervention.id },
        data: {
          remainingAmount: {
            decrement: parseFloat(amount)
          }
        }
      });

      // Create notification for target domain
      await tx.notification.create({
        data: {
          type: 'TRANSFER_REQUEST',
          message: `New transfer request for ${amount} tCO2e`,
          domainId: targetDomainId,
          metadata: {
            transferId: newTransfer.id,
            amount: amount,
            interventionId: interventionId
          }
        }
      });

      return newTransfer;
    });

    return res.status(201).json(transfer);
  } catch (error) {
    next(error);
  }
});

app.get('/api/transfers', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const transfers = await prisma.transfer.findMany({
      where: {
        OR: [
          { sourceDomainId: req.user!.domainId },
          { targetDomainId: req.user!.domainId }
        ]
      },
      include: {
        sourceIntervention: true,
        sourceDomain: {
          select: {
            id: true,
            name: true,
            companyName: true,
            supplyChainLevel: true
          }
        },
        targetDomain: {
          select: {
            id: true,
            name: true,
            companyName: true,
            supplyChainLevel: true
          }
        },
        createdBy: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.json(transfers);
  } catch (error) {
    next(error);
  }
});

app.post('/api/transfers/:id/approve', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: {
        sourceDomain: true,
        targetDomain: true
      }
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    // Only target domain can approve
    if (transfer.targetDomainId !== req.user!.domainId) {
      return res.status(403).json({ error: 'Not authorized to approve this transfer' });
    }

    if (transfer.status !== 'pending') {
      return res.status(400).json({ error: 'Transfer is not pending' });
    }

    const updatedTransfer = await prisma.$transaction(async (tx) => {
      // Update transfer status
      const updated = await tx.transfer.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: new Date()
        },
        include: {
          sourceIntervention: true,
          sourceDomain: true,
          targetDomain: true
        }
      });

      // Create notification for source domain
      await tx.notification.create({
        data: {
          type: 'TRANSFER_APPROVED',
          message: `Transfer of ${transfer.amount} tCO2e has been approved`,
          domainId: transfer.sourceDomainId,
          metadata: {
            transferId: transfer.id,
            amount: transfer.amount
          }
        }
      });

      return updated;
    });

    return res.json(updatedTransfer);
  } catch (error) {
    next(error);
  }
});

app.post('/api/transfers/:id/reject', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: {
        sourceIntervention: true,
        sourceDomain: true,
        targetDomain: true
      }
    });

    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    // Only target domain can reject
    if (transfer.targetDomainId !== req.user!.domainId) {
      return res.status(403).json({ error: 'Not authorized to reject this transfer' });
    }

    if (transfer.status !== 'pending') {
      return res.status(400).json({ error: 'Transfer is not pending' });
    }

    const updatedTransfer = await prisma.$transaction(async (tx) => {
      // Update transfer status
      const updated = await tx.transfer.update({
        where: { id },
        data: {
          status: 'cancelled'
        },
        include: {
          sourceIntervention: true,
          sourceDomain: true,
          targetDomain: true
        }
      });

      // Restore the amount to the intervention's remaining amount
      await tx.interventionRequest.update({
        where: { id: transfer.sourceInterventionId },
        data: {
          remainingAmount: {
            increment: transfer.amount
          }
        }
      });

      // Create notification for source domain
      await tx.notification.create({
        data: {
          type: 'TRANSFER_REJECTED',
          message: `Transfer of ${transfer.amount} tCO2e has been rejected`,
          domainId: transfer.sourceDomainId,
          metadata: {
            transferId: transfer.id,
            amount: transfer.amount
          }
        }
      });

      return updated;
    });

    return res.json(updatedTransfer);
  } catch (error) {
    next(error);
  }
});

// Add this to server.ts after the domain routes
app.patch('/api/domains/:id/supply-chain-level', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Only admins can modify supply chain levels' });
    }

    const { id } = req.params;
    const { level } = req.body;

    if (typeof level !== 'number' || level < 1) {
      return res.status(400).json({ error: 'Supply chain level must be a positive number' });
    }

    const updatedDomain = await prisma.domain.update({
      where: { id: parseInt(id) },
      data: {
        supplyChainLevel: level
      }
    });

    return res.json(updatedDomain);
  } catch (error) {
    next(error);
  }
});

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