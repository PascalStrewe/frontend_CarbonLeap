// pages/api/domains/[domainId]/template.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '../../../../middleware/authMiddleware';
import { pdfTemplateService } from '../../../../services/PDFTemplateService';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: './templates/assets',
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await verifyToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { domainId } = req.query;

    if (req.method === 'GET') {
      const template = await pdfTemplateService.loadDomainTemplate(Number(domainId));
      res.status(200).json(template);
    }
    else if (req.method === 'POST' || req.method === 'PUT') {
      // Handle file upload first
      await new Promise((resolve, reject) => {
        upload.fields([
          { name: 'headerImage', maxCount: 1 },
          { name: 'logo', maxCount: 1 }
        ])(req as any, res as any, (err) => {
          if (err) reject(err);
          else resolve(undefined);
        });
      });

      const templateData = JSON.parse(req.body.template);
      
      // Update file paths if files were uploaded
      if (req.files) {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        if (files.headerImage) {
          templateData.headerImage = `/templates/assets/${files.headerImage[0].filename}`;
        }
        if (files.logo) {
          templateData.logo = `/templates/assets/${files.logo[0].filename}`;
        }
      }

      await pdfTemplateService.saveTemplate(Number(domainId), templateData);
      res.status(200).json({ message: 'Template updated successfully' });
    }
    else if (req.method === 'DELETE') {
      await pdfTemplateService.deleteTemplate(Number(domainId));
      res.status(200).json({ message: 'Template deleted successfully' });
    }
    else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in template API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}