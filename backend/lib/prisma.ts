// frontend_CarbonLeap/lib/prisma.ts

import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// frontend_CarbonLeap/lib/storage.ts

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

interface StorageConfig {
  basePath: string;
  baseUrl: string;
}

interface StorageOptions {
  visibility?: 'public' | 'private';
  metadata?: Record<string, string>;
}

class StorageService {
  private config: StorageConfig;

  constructor() {
    // Use environment variables or default paths
    this.config = {
      basePath: process.env.STORAGE_PATH || path.join(process.cwd(), 'storage'),
      baseUrl: process.env.STORAGE_URL || 'http://localhost:3001/storage'
    };
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await fs.access(this.config.basePath);
    } catch {
      await fs.mkdir(this.config.basePath, { recursive: true });
      // Create necessary subdirectories
      await Promise.all([
        fs.mkdir(path.join(this.config.basePath, 'claims'), { recursive: true }),
        fs.mkdir(path.join(this.config.basePath, 'templates'), { recursive: true }),
        fs.mkdir(path.join(this.config.basePath, 'temp'), { recursive: true })
      ]);
    }
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private generateFileName(originalName: string): string {
    const hash = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName);
    return `${hash}${ext}`;
  }

  async uploadToStorage(
    buffer: Buffer | Uint8Array,
    filePath: string,
    mimeType: string,
    options: StorageOptions = {}
  ): Promise<string> {
    const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    
    // Sanitize file path to prevent directory traversal
    const sanitizedPath = filePath.replace(/^\/+/, '').replace(/\.\./g, '');
    const fullPath = path.join(this.config.basePath, sanitizedPath);
    const dirPath = path.dirname(fullPath);

    // Ensure directory exists
    await this.ensureDirectory(dirPath);

    // Write file
    await fs.writeFile(fullPath, fileBuffer);

    // Write metadata if provided
    if (options.metadata) {
      const metadataPath = `${fullPath}.meta.json`;
      await fs.writeFile(
        metadataPath,
        JSON.stringify({
          ...options.metadata,
          mimeType,
          visibility: options.visibility || 'private',
          createdAt: new Date().toISOString()
        })
      );
    }

    // Return public URL
    return `${this.config.baseUrl}/${sanitizedPath}`;
  }

  async deleteFromStorage(filePath: string): Promise<void> {
    // Sanitize file path
    const sanitizedPath = filePath.replace(/^\/+/, '').replace(/\.\./g, '');
    const fullPath = path.join(this.config.basePath, sanitizedPath);
    
    try {
      // Delete the file
      await fs.unlink(fullPath);
      
      // Try to delete metadata if it exists
      try {
        await fs.unlink(`${fullPath}.meta.json`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error('Error deleting metadata:', error);
        }
      }
      
      // Clean up empty directories
      const dirPath = path.dirname(fullPath);
      const files = await fs.readdir(dirPath);
      if (files.length === 0) {
        await fs.rmdir(dirPath);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async getMetadata(filePath: string): Promise<Record<string, any> | null> {
    const sanitizedPath = filePath.replace(/^\/+/, '').replace(/\.\./g, '');
    const metadataPath = path.join(this.config.basePath, `${sanitizedPath}.meta.json`);
    
    try {
      const metadata = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(metadata);
    } catch {
      return null;
    }
  }

  async cleanTempFiles(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    const tempDir = path.join(this.config.basePath, 'temp');
    try {
      const files = await fs.readdir(tempDir);
      const now = Date.now();

      await Promise.all(files.map(async (file) => {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          await this.deleteFromStorage(`temp/${file}`);
        }
      }));
    } catch (error) {
      console.error('Error cleaning temp files:', error);
    }
  }
}

export const storageService = new StorageService();
export const uploadToStorage = storageService.uploadToStorage.bind(storageService);
export const deleteFromStorage = storageService.deleteFromStorage.bind(storageService);
export const getStorageMetadata = storageService.getMetadata.bind(storageService);

// frontend_CarbonLeap/lib/utils.ts

export function sanitizeFilePath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\.\./g, '');
}

export function generateUniqueFileName(originalName: string): string {
  const hash = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName);
  return `${hash}${ext}`;
}

export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}