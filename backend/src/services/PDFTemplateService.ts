import { PrismaClient } from '@prisma/client';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import QRCode from 'qrcode';

export class PDFTemplateService {
  private prisma: PrismaClient;
  private readonly templateBasePath: string;
  private readonly privateKeyPath: string;
  private readonly publicKeyPath: string;

  constructor() {
    this.prisma = new PrismaClient();
    this.templateBasePath = path.join(process.cwd(), 'src', 'data', 'templates', 'domains');
    this.privateKeyPath = path.join(process.cwd(), 'private', 'private.pem');
    this.publicKeyPath = path.join(process.cwd(), 'private', 'public.pem');
  }

  private async ensureKeyPair() {
    try {
      await fs.access(this.privateKeyPath);
      await fs.access(this.publicKeyPath);
    } catch {
      // Generate new key pair if they don't exist
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      await fs.mkdir(path.dirname(this.privateKeyPath), { recursive: true });
      await fs.writeFile(this.privateKeyPath, privateKey);
      await fs.writeFile(this.publicKeyPath, publicKey);
    }
  }

  private async signPDF(pdfBytes: Uint8Array, metadata: any): Promise<{ signature: string; verificationUrl: string }> {
    const hash = crypto.createHash('sha256');
    hash.update(pdfBytes);
    hash.update(JSON.stringify(metadata));
    const contentHash = hash.digest('hex');

    const privateKey = await fs.readFile(this.privateKeyPath, 'utf-8');
    const signer = crypto.createSign('SHA256');
    signer.update(contentHash);
    signer.end();
    
    const signature = signer.sign(privateKey, 'base64');
    
    // Create verification URL
    const verificationData = {
      hash: contentHash,
      signature,
      timestamp: new Date().toISOString(),
      metadata
    };

    // In production, this would be your verification endpoint
    const verificationUrl = `https://verify.carbonleap.com/verify?data=${encodeURIComponent(JSON.stringify(verificationData))}`;
    
    return { signature, verificationUrl };
  }

  private async generateQRCode(url: string): Promise<string> {
    return await QRCode.toDataURL(url);
  }

  private async importTemplate(domainName: string) {
    try {
      const domainFolder = domainName.toLowerCase();
      const defaultDomainFolder = '@carbonleap.nl';
      
      // Try domain-specific template
      const domainTemplatePath = path.join(this.templateBasePath, domainFolder, 'template.js');
      
      try {
        await fs.access(domainTemplatePath);
        delete require.cache[require.resolve(domainTemplatePath)];
        const domainTemplate = require(domainTemplatePath);
        
        if (domainTemplate && typeof domainTemplate.generatePDF === 'function') {
          return domainTemplate;
        }
      } catch (error) {
        console.log('No domain-specific template found, falling back to default');
      }
  
      // Fall back to default template
      const defaultTemplatePath = path.join(this.templateBasePath, defaultDomainFolder, 'template.js');
      
      delete require.cache[require.resolve(defaultTemplatePath)];
      const defaultTemplate = require(defaultTemplatePath);
      
      if (defaultTemplate && typeof defaultTemplate.generatePDF === 'function') {
        return defaultTemplate;
      }
      
      throw new Error('Invalid template format');
    } catch (error) {
      throw new Error(`Failed to import template: ${error.message}`);
    }
  }

  async generateClaimStatement(claim: any, intervention: any, domain: any): Promise<Uint8Array> {
    try {
      await this.ensureKeyPair();
      
      // Load domain template
      const template = await this.importTemplate(domain.name);
      
      // Create PDF document
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.276, 841.890]); // A4 size
  
      // Prepare fonts
      const fonts = {
        regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
        bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      };
  
      // Metadata for verification
      const metadata = {
        claimId: claim.id,
        interventionId: intervention.interventionId,
        domainId: domain.id,
        timestamp: new Date().toISOString(),
        amount: claim.amount,
        vintage: claim.vintage
      };

      // Generate base PDF
      await template.generatePDF(pdfDoc, page, {
        claim,
        intervention,
        domain,
        fonts
      });

      // Get initial PDF bytes for signing
      const initialBytes = await pdfDoc.save();

      // Sign the PDF
      const { signature, verificationUrl } = await this.signPDF(initialBytes, metadata);

      // Generate QR code for verification
      const qrCodeDataUrl = await this.generateQRCode(verificationUrl);

      // Add verification information to the PDF
      const verificationPage = pdfDoc.addPage([595.276, 841.890]);
      const { width, height } = verificationPage.getSize();

      // Add QR code
      const qrCodeImage = await pdfDoc.embedPng(qrCodeDataUrl);
      const qrDimensions = 200;
      verificationPage.drawImage(qrCodeImage, {
        x: (width - qrDimensions) / 2,
        y: height - 300,
        width: qrDimensions,
        height: qrDimensions
      });

      // Add verification text
      verificationPage.drawText('Verification Information', {
        x: 50,
        y: height - 50,
        size: 16,
        font: fonts.bold
      });

      verificationPage.drawText('This document is digitally signed and can be verified online.', {
        x: 50,
        y: height - 80,
        size: 12,
        font: fonts.regular
      });

      verificationPage.drawText(`Document ID: ${claim.id}`, {
        x: 50,
        y: height - 400,
        size: 10,
        font: fonts.regular
      });

      verificationPage.drawText(`Digital Signature: ${signature.substring(0, 64)}...`, {
        x: 50,
        y: height - 420,
        size: 10,
        font: fonts.regular
      });

      verificationPage.drawText(`Generated: ${new Date().toISOString()}`, {
        x: 50,
        y: height - 440,
        size: 10,
        font: fonts.regular
      });

      // Save final PDF
      return await pdfDoc.save({
        addDefaultPage: false,
        useObjectStreams: true
      });
    } catch (error) {
      console.error('Error generating claim statement:', error);
      throw new Error(`Failed to generate claim statement: ${error.message}`);
    }
  }
}