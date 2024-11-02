// src/data/templates/domains/@carbonleap.nl/template.ts

import { PDFDocument, PDFPage, rgb } from 'pdf-lib';

interface TemplateData {
  claim: any;
  intervention: any;
  domain: any;
  fonts: {
    regular: any;
    bold: any;
  };
}

export const generatePDF = async (
  pdfDoc: PDFDocument,
  page: PDFPage,
  data: TemplateData
): Promise<void> => {
  const { width, height } = page.getSize();
  const { claim, intervention, domain, fonts } = data;

  // Header
  page.drawText('Carbon Reduction Claim Statement', {
    x: 50,
    y: height - 50,
    size: 24,
    font: fonts.bold,
    color: rgb(0.063, 0.239, 0.369) // #103D5E
  });

  // Company Information
  page.drawText(domain.companyName, {
    x: 50,
    y: height - 100,
    size: 16,
    font: fonts.bold
  });

  // Claim Details
  const claimDetails = [
    ['Claim ID:', claim.id],
    ['Amount:', `${claim.amount.toFixed(2)} tCO2e`],
    ['Vintage:', claim.vintage.toString()],
    ['Issue Date:', new Date().toLocaleDateString()],
    ['Expiry Date:', new Date(claim.expiryDate).toLocaleDateString()]
  ];

  claimDetails.forEach(([label, value], index) => {
    page.drawText(label, {
      x: 50,
      y: height - 150 - (index * 25),
      size: 12,
      font: fonts.bold
    });

    page.drawText(value.toString(), {
      x: 200,
      y: height - 150 - (index * 25),
      size: 12,
      font: fonts.regular
    });
  });

  // Intervention Details
  page.drawText('Intervention Details', {
    x: 50,
    y: height - 300,
    size: 16,
    font: fonts.bold
  });

  const interventionDetails = [
    ['Intervention ID:', intervention.interventionId],
    ['Modality:', intervention.modality],
    ['Geography:', intervention.geography],
    ['Certification:', intervention.certificationScheme || 'N/A']
  ];

  interventionDetails.forEach(([label, value], index) => {
    page.drawText(label, {
      x: 50,
      y: height - 340 - (index * 25),
      size: 12,
      font: fonts.bold
    });

    page.drawText(value.toString(), {
      x: 200,
      y: height - 340 - (index * 25),
      size: 12,
      font: fonts.regular
    });
  });

  // Disclaimer
  page.drawText('This statement certifies the claim of carbon emissions reduction in accordance with', {
    x: 50,
    y: 100,
    size: 10,
    font: fonts.regular
  });
  
  page.drawText('CarbonLeap's verification standards and procedures.', {
    x: 50,
    y: 85,
    size: 10,
    font: fonts.regular
  });
};

export default { generatePDF };