// src/services/PDFTemplateService.ts

import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

interface TemplateSection {
  title: string;
  fields: {
    key: string;
    label: string;
    format?: 'date' | 'number' | 'percentage' | 'text';
    required?: boolean;
  }[];
}

interface TemplateConfig {
  name: string;
  headerImage?: string;
  logo?: string;
  primaryColor: { r: number; g: number; b: number };
  secondaryColor: { r: number; g: number; b: number };
  fontFamily?: string;
  sections: TemplateSection[];
  layout: {
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    headerHeight: number;
    footerHeight: number;
  };
  footer?: {
    text: string;
    includeQR?: boolean;
    includeLogo?: boolean;
  };
  watermark?: {
    text: string;
    opacity: number;
  };
}

export class PDFTemplateService {
  private templatesPath: string;
  private defaultTemplate: TemplateConfig = {
    name: "Default Template",
    primaryColor: { r: 0.063, g: 0.239, b: 0.369 }, // #103D5E
    secondaryColor: { r: 0.725, g: 0.875, b: 0.851 }, // #B9DFD9
    fontFamily: StandardFonts.Helvetica,
    sections: [
      {
        title: "Claim Information",
        fields: [
          { key: "claimId", label: "Claim ID", required: true },
          { key: "claimDate", label: "Issue Date", format: "date", required: true },
          { key: "expiryDate", label: "Valid Until", format: "date", required: true },
          { key: "amount", label: "Amount Claimed", format: "number", required: true }
        ]
      },
      {
        title: "Intervention Details",
        fields: [
          { key: "interventionId", label: "Intervention ID", required: true },
          { key: "modality", label: "Type", required: true },
          { key: "geography", label: "Location", required: true },
          { key: "certificationScheme", label: "Certification", required: true },
          { key: "vintage", label: "Vintage", format: "number", required: true }
        ]
      },
      {
        title: "Client Information",
        fields: [
          { key: "clientName", label: "Client Name", required: true },
          { key: "deliveryTicketNumber", label: "Delivery Ticket" },
          { key: "materialName", label: "Material" },
          { key: "vendorName", label: "Vendor" }
        ]
      }
    ],
    layout: {
      marginTop: 50,
      marginBottom: 50,
      marginLeft: 50,
      marginRight: 50,
      headerHeight: 100,
      footerHeight: 80
    },
    footer: {
      text: "This claim statement is electronically generated and validated.",
      includeQR: true
    },
    watermark: {
      text: "VERIFIED CARBON CLAIM",
      opacity: 0.1
    }
  };

  constructor() {
    this.templatesPath = path.join(process.cwd(), 'templates');
  }

  private formatValue(value: any, format?: string): string {
    if (value === null || value === undefined) return 'N/A';
    
    switch (format) {
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'number':
        return typeof value === 'number' ? value.toFixed(2) : value.toString();
      case 'percentage':
        return `${(Number(value) * 100).toFixed(1)}%`;
      default:
        return value.toString();
    }
  }

  async generateClaimStatement(claim: any, intervention: any, domain: any): Promise<Uint8Array> {
    const template = await this.loadDomainTemplate(domain.id);
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.276, 841.890]); // A4 size
    
    const { width, height } = page.getSize();
    const { layout } = template;
    
    // Load fonts
    const font = await pdfDoc.embedFont(template.fontFamily || StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Add header image and logo if exists
    let currentY = height - layout.marginTop;
    if (template.headerImage) {
      const headerImageBytes = await fs.readFile(template.headerImage);
      const headerImage = await pdfDoc.embedPng(headerImageBytes);
      const headerDims = headerImage.scale(0.5);
      page.drawImage(headerImage, {
        x: width / 2 - headerDims.width / 2,
        y: currentY - headerDims.height,
        width: headerDims.width,
        height: headerDims.height,
      });
      currentY -= (headerDims.height + 20);
    }

    // Add title
    page.drawText('Carbon Reduction Claim Statement', {
      x: layout.marginLeft,
      y: currentY,
      size: 24,
      font: boldFont,
      color: rgb(template.primaryColor.r, template.primaryColor.g, template.primaryColor.b),
    });
    currentY -= 40;

    // Add company info
    page.drawText(domain.companyName, {
      x: layout.marginLeft,
      y: currentY,
      size: 16,
      font: font,
      color: rgb(template.primaryColor.r, template.primaryColor.g, template.primaryColor.b),
    });
    currentY -= 30;

    // Combine data sources
    const data = {
      ...claim,
      ...intervention,
      amount: `${claim.amount.toFixed(2)} tCO2e`
    };

    // Draw sections
    for (const section of template.sections) {
      // Draw section title
      page.drawText(section.title, {
        x: layout.marginLeft,
        y: currentY,
        size: 16,
        font: boldFont,
        color: rgb(template.primaryColor.r, template.primaryColor.g, template.primaryColor.b),
      });
      currentY -= 25;

      // Draw fields
      for (const field of section.fields) {
        const value = this.formatValue(data[field.key], field.format);
        
        // Label
        page.drawText(field.label + ':', {
          x: layout.marginLeft,
          y: currentY,
          size: 12,
          font: boldFont,
          color: rgb(template.primaryColor.r, template.primaryColor.g, template.primaryColor.b),
        });

        // Value
        page.drawText(value, {
          x: layout.marginLeft + 150,
          y: currentY,
          size: 12,
          font: font,
          color: rgb(0, 0, 0),
        });

        currentY -= 20;
      }

      currentY -= 20; // Space between sections
    }

    // Add watermark if configured
    if (template.watermark) {
      page.drawText(template.watermark.text, {
        x: width / 2 - 150,
        y: height / 2,
        size: 60,
        font: boldFont,
        color: rgb(
          template.secondaryColor.r,
          template.secondaryColor.g,
          template.secondaryColor.b,
          template.watermark.opacity
        ),
        rotate: degrees(-45),
      });
    }

    // Add footer
    if (template.footer) {
      // Footer text
      page.drawText(template.footer.text, {
        x: layout.marginLeft,
        y: layout.marginBottom,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });

      // QR Code if enabled
      if (template.footer.includeQR) {
        const qrCode = await this.generateQRCode(claim.id);
        const qrImage = await pdfDoc.embedPng(qrCode);
        page.drawImage(qrImage, {
          x: width - layout.marginRight - 100,
          y: layout.marginBottom,
          width: 80,
          height: 80,
        });
      }
    }

    return pdfDoc.save();
  }

  private async generateQRCode(claimId: string): Promise<Buffer> {
    const QRCode = require('qrcode');
    const verificationUrl = `${process.env.VERIFICATION_URL}/verify/${claimId}`;
    return QRCode.toBuffer(verificationUrl);
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

  async saveTemplate(domainId: number, template: Partial<TemplateConfig>): Promise<void> {
    const templatePath = path.join(this.templatesPath, `${domainId}.json`);
    const existingTemplate = await this.loadDomainTemplate(domainId);
    const updatedTemplate = { ...existingTemplate, ...template };
    await fs.writeFile(templatePath, JSON.stringify(updatedTemplate, null, 2));
  }

  async createDefaultTemplate(domainId: number): Promise<void> {
    await this.saveTemplate(domainId, this.defaultTemplate);
  }
}

export const pdfTemplateService = new PDFTemplateService();