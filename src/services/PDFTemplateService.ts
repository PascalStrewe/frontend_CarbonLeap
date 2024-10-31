// src/services/PDFTemplateService.ts

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

interface TemplateConfig {
  headerImage?: string;
  primaryColor: { r: number; g: number; b: number };
  secondaryColor: { r: number; g: number; b: number };
  fontFamily?: string;
  customFields?: string[];
}

export class PDFTemplateService {
  private templatesPath: string;
  private defaultTemplate: TemplateConfig = {
    primaryColor: { r: 0.063, g: 0.239, b: 0.369 }, // #103D5E
    secondaryColor: { r: 0.725, g: 0.875, b: 0.851 }, // #B9DFD9
    fontFamily: StandardFonts.Helvetica,
  };

  constructor() {
    this.templatesPath = path.join(process.cwd(), 'templates');
  }

  async loadDomainTemplate(domainId: number): Promise<TemplateConfig> {
    try {
      const templatePath = path.join(this.templatesPath, `${domainId}.json`);
      const templateData = await fs.readFile(templatePath, 'utf-8');
      return { ...this.defaultTemplate, ...JSON.parse(templateData) };
    } catch (error) {
      return this.defaultTemplate;
    }
  }

  async generateClaimStatement(claim: any, intervention: any, domain: any): Promise<Uint8Array> {
    const template = await this.loadDomainTemplate(domain.id);
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.276, 841.890]); // A4 size
    
    const { width, height } = page.getSize();
    const margin = 50;

    // Load fonts
    const font = await pdfDoc.embedFont(template.fontFamily || StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Add header image if exists
    if (template.headerImage) {
      const headerImageBytes = await fs.readFile(template.headerImage);
      const headerImage = await pdfDoc.embedPng(headerImageBytes);
      const headerDims = headerImage.scale(0.5);
      page.drawImage(headerImage, {
        x: width / 2 - headerDims.width / 2,
        y: height - margin - headerDims.height,
        width: headerDims.width,
        height: headerDims.height,
      });
    }

    // Add title
    page.drawText('Carbon Reduction Claim Statement', {
      x: margin,
      y: height - margin - (template.headerImage ? 100 : 50),
      size: 24,
      font: boldFont,
      color: rgb(template.primaryColor.r, template.primaryColor.g, template.primaryColor.b),
    });

    // Add company info
    page.drawText(domain.companyName, {
      x: margin,
      y: height - margin - (template.headerImage ? 140 : 90),
      size: 16,
      font: font,
      color: rgb(template.primaryColor.r, template.primaryColor.g, template.primaryColor.b),
    });

    // Add claim details
    const claimDetails = [
      { label: 'Claim ID:', value: claim.id },
      { label: 'Intervention ID:', value: intervention.interventionId },
      { label: 'Amount Claimed:', value: `${claim.amount.toFixed(2)} tCO2e` },
      { label: 'Vintage:', value: intervention.vintage },
      { label: 'Valid Until:', value: claim.expiryDate.toLocaleDateString() },
      { label: 'Issue Date:', value: new Date().toLocaleDateString() },
    ];

    // Add custom fields if defined in template
    if (template.customFields) {
      template.customFields.forEach(field => {
        if (intervention[field]) {
          claimDetails.push({
            label: field.replace(/([A-Z])/g, ' $1').trim() + ':',
            value: intervention[field].toString()
          });
        }
      });
    }

    // Draw claim details
    claimDetails.forEach((detail, index) => {
      const yPos = height - margin - (template.headerImage ? 180 : 130) - (index * 25);
      
      // Label
      page.drawText(detail.label, {
        x: margin,
        y: yPos,
        size: 12,
        font: boldFont,
        color: rgb(template.primaryColor.r, template.primaryColor.g, template.primaryColor.b),
      });

      // Value
      page.drawText(detail.value, {
        x: margin + 150,
        y: yPos,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
    });

    // Add intervention details
    const interventionDetails = [
      { label: 'Intervention Type:', value: intervention.modality },
      { label: 'Geography:', value: intervention.geography },
      { label: 'Certification:', value: intervention.certificationScheme },
    ];

    page.drawText('Intervention Details', {
      x: margin,
      y: height - margin - (template.headerImage ? 350 : 300),
      size: 16,
      font: boldFont,
      color: rgb(template.primaryColor.r, template.primaryColor.g, template.primaryColor.b),
    });

    interventionDetails.forEach((detail, index) => {
      const yPos = height - margin - (template.headerImage ? 380 : 330) - (index * 25);
      
      page.drawText(detail.label, {
        x: margin,
        y: yPos,
        size: 12,
        font: boldFont,
        color: rgb(template.primaryColor.r, template.primaryColor.g, template.primaryColor.b),
      });

      page.drawText(detail.value, {
        x: margin + 150,
        y: yPos,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
    });

    // Add footer
    page.drawText('This claim statement is electronically generated and validated.', {
      x: margin,
      y: margin,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Add verification QR code placeholder
    const qrCode = await this.generateQRCode(claim.id);
    const qrImage = await pdfDoc.embedPng(qrCode);
    page.drawImage(qrImage, {
      x: width - margin - 100,
      y: margin,
      width: 100,
      height: 100,
    });

    // Add watermark
    page.drawText('VERIFIED CARBON CLAIM', {
      x: width / 2 - 150,
      y: height / 2,
      size: 60,
      font: boldFont,
      color: rgb(
        template.secondaryColor.r,
        template.secondaryColor.g,
        template.secondaryColor.b,
        0.1
      ),
      rotate: {
        type: 'degrees',
        angle: -45,
      },
    });

    return pdfDoc.save();
  }

  private async generateQRCode(claimId: string): Promise<Buffer> {
    const QRCode = require('qrcode');
    const verificationUrl = `${process.env.VERIFICATION_URL}/verify/${claimId}`;
    return QRCode.toBuffer(verificationUrl);
  }

  async saveTemplate(domainId: number, template: Partial<TemplateConfig>): Promise<void> {
    const templatePath = path.join(this.templatesPath, `${domainId}.json`);
    const existingTemplate = await this.loadDomainTemplate(domainId);
    const updatedTemplate = { ...existingTemplate, ...template };
    await fs.writeFile(templatePath, JSON.stringify(updatedTemplate, null, 2));
  }

  async deleteTemplate(domainId: number): Promise<void> {
    const templatePath = path.join(this.templatesPath, `${domainId}.json`);
    try {
      await fs.unlink(templatePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

export const pdfTemplateService = new PDFTemplateService();