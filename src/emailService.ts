import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { ClientSecretCredential } from '@azure/identity';
import 'isomorphic-fetch'; // Required for the Microsoft Graph Client

class EmailService {
  private graphClient: Client;

  constructor() {
    // Initialize the Azure AD credential
    const credential = new ClientSecretCredential(
      process.env.MS_TENANT_ID!,
      process.env.MS_CLIENT_ID!,
      process.env.MS_CLIENT_SECRET!
    );

    // Create an authentication provider using the credential
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default']
    });

    // Initialize the Graph client
    this.graphClient = Client.initWithMiddleware({
      authProvider
    });
  }

  async sendEmail(to: string, subject: string, html: string) {
    try {
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
                address: to
              }
            }
          ],
          from: {
            emailAddress: {
              address: process.env.SMTP_USER,
              name: 'CarbonLeap'
            }
          }
        },
        saveToSentItems: true
      };

      await this.graphClient
        .api(`/users/${process.env.SMTP_USER}/sendMail`)
        .post(message);

      console.log('Email sent successfully to:', to);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async verifyConfiguration() {
    try {
      // Instead of using /me, test by getting the user profile directly
      await this.graphClient
        .api(`/users/${process.env.SMTP_USER}`)
        .get();
      console.log('Email configuration verified successfully');
      return true;
    } catch (error) {
      console.error('Email configuration error:', error);
      throw error;
    }
  }
}

export const emailService = new EmailService();