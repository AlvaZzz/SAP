import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return value;
}

export const env = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',

  databaseUrl: required('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/prexi'),

  jwtSecret: required('JWT_SECRET', 'dev_secret_no_usar_en_produccion'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',

  // La clave de Gemini se lee solo aquí, en el servidor. Nunca sale al cliente.
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',

  aiRateLimitPerHour: parseInt(process.env.AI_RATE_LIMIT_PER_HOUR ?? '20', 10),
} as const;

export const isProd = env.nodeEnv === 'production';
