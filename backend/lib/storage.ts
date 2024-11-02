// lib/storage.ts

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

interface StorageConfig {
  basePath: string;
  baseUrl: string;
}

class StorageService {
  private config: StorageConfig;

  constructor() {
    this.config = {
      basePath: process.env.STORAGE_PATH || path.join(process.cwd(), 'storage'),
      baseUrl: process.env.STORAGE_URL || 'http://localhost:3001/storage'
    };
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
    mimeType: string
  ): Promise<string> {
    // Convert Uint8Array to Buffer if necessary
    const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    
    // Create full path
    const fullPath = path.join(this.config.basePath, filePath);
    const dirPath = path.dirname(fullPath);

    // Ensure directory exists
    await this.ensureDirectory(dirPath);

    // Write file
    await fs.writeFile(fullPath, fileBuffer);

    // Return public URL
    return `${this.config.baseUrl}/${filePath}`;
  }

  async deleteFromStorage(filePath: string): Promise<void> {
    const fullPath = path.join(this.config.basePath, filePath);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

export const storageService = new StorageService();
export const uploadToStorage = storageService.uploadToStorage.bind(storageService);
export const deleteFromStorage = storageService.deleteFromStorage.bind(storageService);