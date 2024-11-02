// src/emailService.ts
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { ClientSecretCredential } from '@azure/identity';
import 'isomorphic-fetch';

class EmailService {
  private graphClient: Client;

  constructor() {
    try {
      console.log('Initializing email service...');
      
      // Check for required environment variables
      const requiredEnvVars = ['MS_TENANT_ID', 'MS_CLIENT_ID', 'MS_CLIENT_SECRET', 'SMTP_USER'];
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

      if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
      }

      const credential = new ClientSecretCredential(
        process.env.MS_TENANT_ID!,
        process.env.MS_CLIENT_ID!,
        process.env.MS_CLIENT_SECRET!
      );

      const authProvider = new TokenCredentialAuthenticationProvider(credential, {
        scopes: ['https://graph.microsoft.com/.default']
      });

      this.graphClient = Client.initWithMiddleware({
        authProvider,
        debugLogging: process.env.NODE_ENV === 'development'
      });

      console.log('Email service initialized successfully');
    } catch (error) {
      console.error('Email service initialization failed:', error);
      throw error;
    }
  }

  async sendEmail(subject: string, html: string): Promise<boolean> {
    try {
      console.log('Starting to send email...');
      console.log('Subject:', subject);
      console.log('Sending to:', process.env.ADMIN_NOTIFICATION_EMAIL);

      const message = {
        message: {
          subject,
          body: {
            contentType: 'HTML',
            content: html
          },
          toRecipients: [
            {
              emailAddress: {
                address: process.env.ADMIN_NOTIFICATION_EMAIL
              }
            }
          ]
        }
      };

      await this.graphClient
        .api(`/users/${process.env.SMTP_USER}/sendMail`)
        .post(message);

      console.log('Email sent successfully');
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }
}

// Export a singleton instance
const emailService = new EmailService();
export { emailService };