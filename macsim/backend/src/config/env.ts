import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const env = {
  ENVIRONMENT: process.env.ENVIRONMENT || 'development',
  DEBUG: process.env.DEBUG === 'true' || process.env.DEBUG === 'True',
  PORT: parseInt(process.env.PORT || '8000', 10),
  HOST: process.env.HOST || '127.0.0.1',
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map(origin => origin.trim()),
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  ENGINE_VERSION: process.env.ENGINE_VERSION || '1.0.0',
};

