// backend/src/services/PDFTemplateService.ts

import { PrismaClient } from '@prisma/client';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

export class PDFTemplateService {
  private prisma: PrismaClient;
  private readonly templateBasePath: string;

  constructor() {
    this.prisma = new PrismaClient();
    // Use path.join for cross-platform compatibility
    this.templateBasePath = path.join(__dirname, '..', 'data', 'templates', 'domains');
  }

  async loadDomainTemplate(domainId: number): Promise<any> {
    try {
      // Check if domain exists
      const domain = await this.prisma.domain.findUnique({
        where: { id: domainId }
      });

      if (!domain) {
        throw new Error(`Domain not found with ID: ${domainId}`);
      }

      // Convert domain name to folder-safe format
      const domainFolder = domain.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const templatePath = path.join(this.templateBasePath, domainFolder, 'template.json');

      // Check if template directory exists
      try {
        await fs.access(path.dirname(templatePath));
      } catch (error) {
        console.log(`Creating template directory for domain: ${domain.name}`);
        await fs.mkdir(path.dirname(templatePath), { recursive: true });
      }

      // Try to read template file
      try {
        const templateContent = await fs.readFile(templatePath, 'utf-8');
        return JSON.parse(templateContent);
      } catch (error) {
        // If template doesn't exist, create default template
        const defaultTemplate = {
          headerImage: null,
          companyName: domain.companyName,
          primaryColor: '#103D5E',
          secondaryColor: '#4A90E2',
          fontSize: {
            title: 24,
            heading: 18,
            body: 12
          },
          margins: {
            top: 50,
            right: 50,
            bottom: 50,
            left: 50
          }
        };

        await this.saveTemplate(domainId, defaultTemplate);
        return defaultTemplate;
      }
    } catch (error) {
      console.error('Error loading domain template:', error);
      throw new Error(`Failed to load template for domain ${domainId}: ${error.message}`);
    }
  }

  async generateClaimStatement(claim: any, intervention: any, domain: any): Promise<Uint8Array> {
    try {
      // Load domain template
      const template = await this.loadDomainTemplate(domain.id);

      // Create PDF document
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.276, 841.890]); // A4 size
      const { width, height } = page.getSize();
      
      try {
        // Load fonts
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Set initial position for content
        let currentY = height - template.margins.top;
        const leftMargin = template.margins.left;

        // Add header image if exists
        if (template.headerImage) {
          try {
            const imgData = template.headerImage.split(',')[1];
            const imageBytes = Buffer.from(imgData, 'base64');
            const image = await pdfDoc.embedPng(imageBytes);
            const imgDims = image.scale(0.5);
            
            page.drawImage(image, {
              x: (width - imgDims.width) / 2,
              y: currentY - imgDims.height,
              width: imgDims.width,
              height: imgDims.height,
            });
            
            currentY -= (imgDims.height + 20);
          } catch (imgError) {
            console.warn('Failed to embed header image:', imgError);
            // Continue without the image
          }
        }

        // Add title
        page.drawText('Carbon Reduction Claim Statement', {
          x: leftMargin,
          y: currentY,
          size: template.fontSize.title,
          font: boldFont,
          color: rgb(0.063, 0.239, 0.368) // #103D5E
        });

        currentY -= 40;

        // Add claim details
        const details = [
          { label: 'Claim ID:', value: claim.id },
          { label: 'Intervention ID:', value: intervention.interventionId },
          { label: 'Amount Claimed:', value: `${claim.amount.toFixed(2)} tCO2e` },
          { label: 'Vintage:', value: claim.vintage.toString() },
          { label: 'Valid Until:', value: new Date(claim.expiryDate).toLocaleDateString() },
          { label: 'Intervention Type:', value: intervention.modality },
          { label: 'Geography:', value: intervention.geography },
          { label: 'Certification:', value: intervention.certificationScheme || 'N/A' }
        ];

        for (const detail of details) {
          page.drawText(detail.label, {
            x: leftMargin,
            y: currentY,
            size: template.fontSize.body,
            font: boldFont,
            color: rgb(0.063, 0.239, 0.368)
          });

          page.drawText(detail.value, {
            x: leftMargin + 150,
            y: currentY,
            size: template.fontSize.body,
            font: font,
            color: rgb(0, 0, 0)
          });

          currentY -= 25;
        }

        // Add verification section
        currentY -= 20;
        page.drawText('Verification', {
          x: leftMargin,
          y: currentY,
          size: template.fontSize.heading,
          font: boldFont,
          color: rgb(0.063, 0.239, 0.368)
        });

        currentY -= 30;
        const verificationText = 
          'This document certifies that the above carbon reduction claim ' +
          'has been verified and recorded on the CarbonLeap platform. ' +
          'The claim is based on actual emission reductions achieved ' +
          'through the specified intervention.';

        // Word wrap the verification text
        const words = verificationText.split(' ');
        let line = '';
        const maxWidth = width - template.margins.left - template.margins.right;

        for (const word of words) {
          const testLine = line + word + ' ';
          const lineWidth = font.widthOfTextAtSize(testLine, template.fontSize.body);
          
          if (lineWidth > maxWidth && line.length > 0) {
            page.drawText(line, {
              x: leftMargin,
              y: currentY,
              size: template.fontSize.body,
              font: font,
              color: rgb(0, 0, 0)
            });
            line = word + ' ';
            currentY -= 20;
          } else {
            line = testLine;
          }
        }
        
        if (line.length > 0) {
          page.drawText(line, {
            x: leftMargin,
            y: currentY,
            size: template.fontSize.body,
            font: font,
            color: rgb(0, 0, 0)
          });
        }

        // Add QR code or other verification elements here

        return await pdfDoc.save();
      } catch (error) {
        console.error('Error generating PDF content:', error);
        throw new Error('Failed to generate PDF content');
      }
    } catch (error) {
      console.error('Error in generateClaimStatement:', error);
      throw new Error(`Failed to generate claim statement: ${error.message}`);
    }
  }

  async saveTemplate(domainId: number, templateData: any): Promise<void> {
    try {
      const domain = await this.prisma.domain.findUnique({
        where: { id: domainId }
      });

      if (!domain) {
        throw new Error(`Domain not found with ID: ${domainId}`);
      }

      const domainFolder = domain.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const templateDir = path.join(this.templateBasePath, domainFolder);
      const templatePath = path.join(templateDir, 'template.json');

      // Create directory if it doesn't exist
      await fs.mkdir(templateDir, { recursive: true });

      // Save template
      await fs.writeFile(templatePath, JSON.stringify(templateData, null, 2));
    } catch (error) {
      console.error('Error saving template:', error);
      throw new Error(`Failed to save template for domain ${domainId}: ${error.message}`);
    }
  }
}