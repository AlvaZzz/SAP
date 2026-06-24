import { execSync } from 'child_process';
import { pool } from '../config/db';

/**
 * Inicialización idempotente para Docker Compose.
 * - Si la tabla `usuarios` no existe o está vacía → aplica schema + seed.
 * - Si ya hay datos → no toca nada (preserva el progreso entre reinicios).
 */
async function main() {
  let necesitaInit = false;
  try {
    const { rows } = await pool.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM usuarios');
    if (rows[0].n === 0) necesitaInit = true;
  } catch {
    necesitaInit = true; // la tabla aún no existe
  } finally {
    await pool.end();
  }

  if (!necesitaInit) {
    console.log('[db:init] La base ya está inicializada. Omitiendo schema/seed.');
    return;
  }

  console.log('[db:init] Base vacía → aplicando schema y seed...');
  execSync('npm run db:setup', { stdio: 'inherit' });
  execSync('npm run db:seed', { stdio: 'inherit' });
  console.log('[db:init] ✅ Listo.');
}

main().catch((err) => {
  console.error('[db:init] ❌ Error:', err);
  process.exit(1);
});
