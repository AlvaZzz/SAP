import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

// Aplica el mismo esquema que usa Postgres en su initdb (un solo origen).
const SCHEMA = path.resolve(__dirname, 'initdb/01-schema.sql');

async function main() {
  const schema = fs.readFileSync(SCHEMA, 'utf-8');
  console.log('[db:setup] Aplicando esquema (initdb/01-schema.sql)...');
  await pool.query(schema);
  console.log('[db:setup] ✅ Esquema creado correctamente.');
  await pool.end();
}

main().catch((err) => {
  console.error('[db:setup] ❌ Error:', err);
  process.exit(1);
});
