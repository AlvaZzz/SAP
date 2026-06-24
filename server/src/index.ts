import { createApp } from './app';
import { env } from './config/env';
import { pool } from './config/db';

async function main() {
  const app = createApp();

  // Verifica conexión a la BD al arrancar (falla rápido si está mal).
  try {
    await pool.query('SELECT 1');
    console.log('[db] conexión establecida');
  } catch (err) {
    console.error('[db] ⚠️  No se pudo conectar a PostgreSQL. ¿Está corriendo y DATABASE_URL es correcto?');
    console.error(err);
  }

  if (!env.geminiApiKey) {
    console.warn('[ia] ⚠️  GEMINI_API_KEY no configurada: los endpoints /api/ai fallarán hasta definirla.');
  }

  app.listen(env.port, () => {
    console.log(`[server] PREXI UPEA API escuchando en http://localhost:${env.port}`);
    console.log(`[server] entorno: ${env.nodeEnv} | CORS origin: ${env.clientOrigin}`);
  });
}

main();
