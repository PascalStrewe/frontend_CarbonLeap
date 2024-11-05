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
      // Fetch domain name for the user's domainId
      const domain = await this.prisma.domain.findUnique({
        where: { id: this.userContext.domainId },
        select: { name: true },
      });
  
      if (!this.userContext.isAdmin && !domain) {
        throw new Error('Domain not found');
      }

      // Special handling for verified interventions count
      if (question.toLowerCase().includes('verified') && question.toLowerCase().includes('intervention')) {
        const verifiedCount = await this.getVerifiedInterventionsCount(domain?.name);
        return `This query counts verified interventions following the dashboard logic. Result: ${verifiedCount}`;
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-2024-08-06',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that converts natural language to Prisma READ queries.
      Always prefix queries with 'this.prisma.' and only use findMany, findFirst, or count methods.
      Never include passwords or sensitive data.
      
      When the user refers to "pending" status, interpret it as "pending_review".
      
      Examples of valid queries:
      this.prisma.interventionRequest.count({ "where": { "status": "pending_review" } })
      this.prisma.interventionRequest.findMany({ "where": { "status": "pending_review" } })
      
      Available fields for InterventionRequest:
      - status (string): Possible values are "pending_review", "Verified", "rejected", etc.
      - modality (string): Type of intervention including 'transfer from' and 'transfer to'
      - remainingAmount (number): Remaining amount of emissions
      - interventionId (string): Unique identifier
      - claims (relation): Related carbon claims
      
      Always use double quotes for property names and string values in the parameters.`,
          },
          {
            role: 'user',
            content: question,
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
  
      const methodMatch = prismaQuery.match(/this\.prisma\.(\w+)\.(findMany|findFirst|count)\(([\s\S]*)\)/);
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
  
      if (!this.userContext.isAdmin && domain) {
        if (!params.where) {
          params.where = {};
        }
        if (!params.where.user) {
          params.where.user = {};
        }
        if (!params.where.user.domain) {
          params.where.user.domain = {};
        }
        params.where.user.domain.name = domain.name;
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

  private async getVerifiedInterventionsCount(domainName?: string): Promise<number> {
    const interventions = await this.prisma.interventionRequest.findMany({
      where: {
        ...(this.userContext.isAdmin || !domainName
          ? {}
          : { user: { domain: { name: domainName } } }),
        OR: [
          { status: { equals: 'Verified', mode: 'insensitive' } },
          { status: { equals: 'completed', mode: 'insensitive' } }
        ]
      },
      include: {
        claims: {
          where: {
            status: 'active'
          }
        }
      }
    });

    return interventions.filter(intervention => {
      const isTransferFrom = intervention.modality?.toLowerCase().includes('transfer from');
      const isTransferTo = 
        intervention.modality?.toLowerCase().includes('transfer to') || 
        (intervention.interventionId?.includes('transfer_') && !isTransferFrom);

      if (isTransferFrom) return true;
      if (isTransferTo) return false;

      return intervention.remainingAmount > 0 || intervention.claims.length > 0;
    }).length;
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

  private async getTransferredCount(domainName?: string): Promise<number> {
    const interventions = await this.prisma.interventionRequest.findMany({
      where: {
        ...(this.userContext.isAdmin || !domainName
          ? {}
          : { user: { domain: { name: domainName } } }),
        OR: [
          { modality: { contains: 'transfer to', mode: 'insensitive' } },
          { interventionId: { contains: 'transfer_' } }
        ],
        NOT: {
          modality: { contains: 'transfer from', mode: 'insensitive' }
        }
      }
    });

    return interventions.length;
}

  async cleanup() {
    await this.prisma.$disconnect();
  }
}