// src/types/env.d.ts
declare global {
    namespace NodeJS {
      interface ProcessEnv {
        DATABASE_URL: string;
        PORT: string;
        NODE_ENV: 'development' | 'production' | 'test';
        JWT_SECRET: string;
        JWT_EXPIRY: string;
        OPENAI_API_KEY: string;
        OPENAI_MODEL?: string;
        MS_CLIENT_ID: string;
        MS_CLIENT_SECRET: string;
        MS_TENANT_ID: string;
        SMTP_USER: string;
        ADMIN_EMAIL: string;
        ADMIN_NOTIFICATION_EMAIL: string;
        LOG_LEVEL: string;
        DEBUG: string;
        CORS_ORIGIN: string;
        RATE_LIMIT_WINDOW_MS: string;
        RATE_LIMIT_MAX_REQUESTS: string;
        MAX_FILE_SIZE: string;
      }
    }
  }
  
  export {};