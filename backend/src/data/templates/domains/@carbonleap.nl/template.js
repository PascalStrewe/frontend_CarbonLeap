// src/data/templates/domains/@carbonleap.nl/template.js

const { rgb } = require('pdf-lib');

function validateRequiredFields(claim, intervention, domain) {
  const required = {
    claim: ['id', 'amount', 'vintage', 'expiryDate'],
    intervention: ['interventionId', 'modality', 'geography', 'certificationScheme'],
    domain: ['companyName']
  };

  const missing = {};

  for (const [entity, fields] of Object.entries(required)) {
    const missingFields = fields.filter(field => {
      const value = entity === 'claim' ? claim[field] :
                    entity === 'intervention' ? intervention[field] :
                    domain[field];
      return value === undefined || value === null;
    });
    if (missingFields.length > 0) {
      missing[entity] = missingFields;
    }
  }

  if (Object.keys(missing).length > 0) {
    throw new Error(`Missing required fields: ${JSON.stringify(missing)}`);
  }
}

module.exports = {
  generatePDF: async (pdfDoc, page, data) => {
    try {
      const { claim, intervention, domain, fonts } = data;

      // Validate required fields
      validateRequiredFields(claim, intervention, domain);

      console.log('Generating PDF with validated data:', {
        claim: {
          id: claim.id,
          amount: claim.amount,
          vintage: claim.vintage,
          expiryDate: claim.expiryDate
        },
        intervention: {
          interventionId: intervention.interventionId,
          modality: intervention.modality,
          geography: intervention.geography,
          certificationScheme: intervention.certificationScheme
        },
        domain: {
          companyName: domain.companyName
        }
      });

      const { width, height } = page.getSize();
      
      // Set margins
      const margins = {
        top: 50,
        right: 50,
        bottom: 50,
        left: 50
      };

      // Set colors from template
      const primaryColor = rgb(0.063, 0.239, 0.368);
      const secondaryColor = rgb(0.725, 0.875, 0.851);

      // Initial Y position
      let currentY = height - margins.top;

      // Draw header
      page.drawText('Carbon Reduction Claim Statement', {
        x: margins.left,
        y: currentY,
        size: 24,
        font: fonts.bold,
        color: primaryColor
      });

      currentY -= 40;

      // Draw company name
      page.drawText(domain.companyName || 'Unknown Company', {
        x: margins.left,
        y: currentY,
        size: 16,
        font: fonts.bold,
        color: primaryColor
      });

      currentY -= 30;

      // Draw claim details with safe value handling
      const details = [
        { label: 'Claim ID:', value: claim.id },
        { label: 'Intervention ID:', value: intervention.interventionId },
        { label: 'Amount Claimed:', value: `${(claim.amount || 0).toFixed(2)} tCO2e` },
        { label: 'Vintage:', value: (claim.vintage || 'N/A').toString() },
        { label: 'Valid Until:', value: claim.expiryDate ? new Date(claim.expiryDate).toLocaleDateString() : 'N/A' },
        { label: 'Intervention Type:', value: intervention.modality || 'N/A' },
        { label: 'Geography:', value: intervention.geography || 'N/A' },
        { label: 'Certification:', value: intervention.certificationScheme || 'N/A' }
      ];

      for (const detail of details) {
        // Ensure both label and value are strings
        const safeLabel = String(detail.label || '');
        const safeValue = String(detail.value || 'N/A');

        // Draw label
        page.drawText(safeLabel, {
          x: margins.left,
          y: currentY,
          size: 12,
          font: fonts.bold,
          color: primaryColor
        });

        // Draw value
        page.drawText(safeValue, {
          x: margins.left + 150,
          y: currentY,
          size: 12,
          font: fonts.regular,
          color: rgb(0, 0, 0)
        });

        currentY -= 25;
      }

      // Rest of the template remains the same...
      
    } catch (error) {
      console.error('Error in template generation:', error);
      console.error('Template data:', data);
      throw error;
    }
  }
};