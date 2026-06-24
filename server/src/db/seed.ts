import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

// Reutiliza el mismo seed SQL que ejecuta Postgres en su initdb.
// Requiere la extensión pgcrypto (creada por 01-schema.sql) para hashear
// las contraseñas con crypt()/gen_salt(). Contraseña por defecto: Prexi123*
const SEED = path.resolve(__dirname, 'initdb/02-seed.sql');

async function main() {
  const seed = fs.readFileSync(SEED, 'utf-8');
  console.log('[db:seed] Sembrando datos (initdb/02-seed.sql)...');
  await pool.query(seed);
  console.log('[db:seed] ✅ Datos sembrados.');
  console.log('[db:seed] Usuarios: juan/ana/carlos/maria@upea.bo, docente@upea.bo, admin@upea.bo');
  console.log('[db:seed] Contraseña por defecto: Prexi123*');
  await pool.end();
}

main().catch((err) => {
  console.error('[db:seed] ❌ Error:', err);
  process.exit(1);
});
