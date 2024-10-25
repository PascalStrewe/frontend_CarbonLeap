// src/server.ts
import { Request, Response, NextFunction } from 'express';
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    isAdmin: boolean;
    domainId: number;
    domain: string;
  };
}

interface Intervention {
  clientName: string;
  emissionsAbated: number;
  date: Date;
  interventionId: string;
  modality?: string;
  geography?: string;
  additionality: boolean;
  causality: boolean;
  status: string;
  domainId: number;
}

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication middleware
const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, process.env.JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Auth routes
app.post('/api/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { domain: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        isAdmin: user.isAdmin,
        domainId: user.domainId,
        domain: user.domain.name 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: {
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      domain: user.domain.name,
      companyName: user.domain.companyName
    }});
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Domain routes
app.post('/api/domains', async (req: Request, res: Response) => {
  const { companyName, domainName } = req.body;

  try {
    const domain = await prisma.domain.create({
      data: {
        name: domainName,
        companyName
      }
    });

    res.json(domain);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/domains', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const domains = await prisma.domain.findMany();
    res.json(domains);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Intervention routes
app.post('/api/interventions', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { interventions, domainId } = req.body;

  try {
    const result = await prisma.intervention.createMany({
      data: interventions.map((intervention: Intervention) => ({
        ...intervention,
        domainId
      }))
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/interventions', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const interventions = await prisma.intervention.findMany({
      where: req.user?.isAdmin ? undefined : {
        domain: {
          id: req.user?.domainId
        }
      },
      include: {
        domain: true
      }
    });

    res.json(interventions);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});