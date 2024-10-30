import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { z } from 'zod';

const QueryResponseSchema = z.object({
  prismaQuery: z.string(),
  explanation: z.string(),
});

interface UserContext {
  id: number;
  domainId: number;
  isAdmin: boolean;
}

export class SecureSQLQueryService {
  private prisma: PrismaClient;
  private openai: OpenAI;
  private userContext: UserContext;

  constructor(userContext: UserContext) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    this.prisma = new PrismaClient();
    this.openai = new OpenAI({
      apiKey,
      baseURL: 'https://api.openai.com/v1',
    });
    this.userContext = userContext;
  }

  async query(question: string): Promise<string> {
    try {
      // First, get the domain name for the user's domainId
      console.log('Looking up domain for ID:', this.userContext.domainId);
      const domain = await this.prisma.domain.findUnique({
        where: { id: this.userContext.domainId },
        select: { name: true }
      });
      console.log('Found domain:', domain);

      if (!this.userContext.isAdmin && !domain) {
        throw new Error('Domain not found');
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-2024-08-06',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that converts natural language to Prisma READ queries.
            Always prefix queries with 'this.prisma.' and only use findMany, findFirst, or count methods.
            For non-admin users, include a where clause filtering by companyDomain with the domain name.
            Never include passwords or sensitive data.
            
            Examples of valid queries:
            this.prisma.interventionRequest.count({ "where": { "status": "pending_review" } })
            this.prisma.interventionRequest.findMany({ "where": { "companyDomain": "example.com", "status": "pending_review" } })
            
            Available fields for InterventionRequest:
            - id (string)
            - userId (number)
            - companyDomain (string)
            - intervention (string)
            - modality (string)
            - vesselType (string, optional)
            - geography (string)
            - lowCarbonFuelLiters (string, optional)
            - lowCarbonFuelMT (string, optional)
            - scope3EmissionsAbated (string, optional)
            - ghgEmissionSaving (string)
            - vintage (string)
            - lowCarbonFuel (string)
            - feedstock (string)
            - causality (string)
            - additionality (string)
            - thirdPartyVerification (string)
            - certificationScheme (string)
            - otherCertificationScheme (string, optional)
            - standards (string)
            - status (string)
            - notificationSent (boolean)
            - submissionDate (DateTime)
            - reviewedAt (DateTime, optional)
            - reviewedBy (string, optional)
            - comments (string, optional)
            
            Always use double quotes for property names and string values in the parameters.
            
            Your response must be valid JSON with:
            - prismaQuery: The full Prisma query string starting with 'this.prisma.'
            - explanation: A clear description of what the query does`,
          },
          {
            role: 'user',
            content: this.userContext.isAdmin
              ? question
              : `${question} (filter for company domain "${domain?.name}" only)`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "QueryResponseSchema",
            schema: {
              type: "object",
              properties: {
                prismaQuery: { type: "string" },
                explanation: { type: "string" }
              },
              required: ["prismaQuery", "explanation"],
              additionalProperties: false
            }
          }
        }
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content returned from the model');
      }

      console.log('OpenAI Raw Response:', content);
      
      const jsonResponse = JSON.parse(content);
      console.log('Parsed JSON Response:', jsonResponse);

      const parsedResponse = QueryResponseSchema.parse(jsonResponse);
      console.log('Zod Parsed Response:', parsedResponse);

      const { prismaQuery, explanation } = parsedResponse;
      console.log('Extracted Query:', prismaQuery);

      if (!prismaQuery.startsWith('this.prisma.')) {
        throw new Error('Invalid query format: Must use this.prisma');
      }

      const methodMatch = prismaQuery.match(/this\.prisma\.(\w+)\.(findMany|findFirst|count)\((.*)\)/);
      if (!methodMatch) {
        console.log('Failed to match query pattern:', prismaQuery);
        throw new Error('Invalid prismaQuery format');
      }

      const [, modelName, method, paramsString] = methodMatch;
      console.log('Extracted parts:', { modelName, method, paramsString });

      let params;
      try {
        params = JSON.parse(paramsString);
        console.log('Successfully parsed params:', params);
      } catch (err) {
        console.error('JSON Parse Error:', err);
        console.error('Failed to parse params string:', paramsString);
        throw new Error('Invalid JSON parameters in prismaQuery');
      }

      // For non-admin users, ensure companyDomain is included in where clause
      if (!this.userContext.isAdmin && domain) {
        params.where = {
          ...params.where,
          companyDomain: domain.name
        };
      }

      const model = (this.prisma as any)[modelName];
      if (!model) {
        throw new Error(`Model '${modelName}' does not exist in Prisma Client`);
      }

      console.log('Executing Query:', { modelName, method, params });
      const result = await model[method](params);
      console.log('Query result:', result);
      return this.formatResponse(result, explanation);
    } catch (error) {
      console.error('Service error:', error);
      return `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
      await this.cleanup();
    }
  }

  private formatResponse(data: any, explanation: string): string {
    if (!data) return `${explanation}\n\nNo data found.`;
    if (typeof data === 'number') return `${explanation}\n\nResult: ${data}`;

    let response = `${explanation}\n\n`;
    if (Array.isArray(data)) {
      if (data.length === 0) return `${response}No matching records found.`;
      response += `Found ${data.length} results:\n\n${JSON.stringify(data, null, 2)}`;
    } else {
      response += JSON.stringify(data, null, 2);
    }
    return response;
  }

  async cleanup() {
    await this.prisma.$disconnect();
  }
}