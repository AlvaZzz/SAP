/**
 * VERIFICACIÓN DE VARIABLES DE ENTORNO.
 *
 *   npx tsx scripts/verificar-entorno.ts             → perfil "local"
 *   npx tsx scripts/verificar-entorno.ts --produccion → perfil "producción"
 *
 * Por qué existe: una variable ausente o con el valor de ejemplo no rompe la
 * compilación —rompe el ARRANQUE, y a veces ni eso: el sistema levanta y falla
 * más tarde, en la primera petición real. `JWT_SECRET` con el valor de ejemplo
 * es peor todavía, porque funciona: firma tokens perfectamente válidos con un
 * secreto que está publicado en el repositorio.
 *
 * Comprueba tres cosas distintas, y las tres importan:
 *   1. que la variable EXISTA;
 *   2. que su FORMATO sea el esperado (una URL es una URL, un número es un
 *      número, el secreto tiene largo suficiente);
 *   3. que NO conserve el valor de EJEMPLO copiado de `.env.*.example`.
 */
import * as fs from 'fs';
import * as path from 'path';

const RAIZ = path.join(__dirname, '..');
const PRODUCCION = process.argv.includes('--produccion');

interface Regla {
  nombre: string;
  descripcion: string;
  /** Solo se exige en el perfil de producción. */
  soloProduccion?: boolean;
  valida: (v: string) => string | null; // null = correcto, string = motivo del fallo
}

/** Valores de los `.env.*.example`: si alguno sobrevive, no se configuró nada. */
const EJEMPLOS = [
  'cambia_esto_por_un_secreto_largo_y_aleatorio',
  'CAMBIA_ESTO_por_un_secreto_largo_y_aleatorio',
  'cambia_esta_clave_de_bd',
  'tu_clave_aqui',
  'tu_clave_de_gemini',
  'tuprexi.duckdns.org',
];

const esEjemplo = (v: string) => (EJEMPLOS.includes(v.trim()) ? 'conserva el valor de EJEMPLO del .env.example' : null);

const url = (v: string) => {
  const e = esEjemplo(v);
  if (e) return e;
  try {
    const u = new URL(v);
    if (!/^https?:$/.test(u.protocol)) return `protocolo no soportado (${u.protocol})`;
    if (v.endsWith('/')) return 'no debe terminar en barra';
    return null;
  } catch {
    return 'no es una URL válida';
  }
};

const postgres = (v: string) => {
  const e = esEjemplo(v);
  if (e) return e;
  if (!/^postgres(ql)?:\/\//.test(v)) return 'debe empezar por postgresql://';
  if (PRODUCCION && !/sslmode=require/.test(v)) return 'en producción (Neon) exige sslmode=require';
  return null;
};

const entero = (min: number, max: number) => (v: string) => {
  const e = esEjemplo(v);
  if (e) return e;
  if (!/^\d+$/.test(v.trim())) return 'debe ser un número entero';
  const n = Number(v);
  if (n < min || n > max) return `fuera de rango (${min}-${max})`;
  return null;
};

const secreto = (largoMin: number) => (v: string) => {
  const e = esEjemplo(v);
  if (e) return e;
  if (v.trim().length < largoMin) return `demasiado corto (${v.trim().length} caracteres, mínimo ${largoMin})`;
  return null;
};

const noVacia = (v: string) => esEjemplo(v) ?? (v.trim() ? null : 'está vacía');

const REGLAS: Regla[] = [
  // En LOCAL, docker-compose define DATABASE_URL por servicio (no vive en el
  // .env de la raíz), así que ausente no es un fallo; en producción sí lo es.
  { nombre: 'DATABASE_URL', descripcion: 'Conexión a PostgreSQL (en Neon, la cadena POOLED).', soloProduccion: true, valida: postgres },
  { nombre: 'DIRECT_URL', descripcion: 'Conexión directa para migraciones y seed.', soloProduccion: true, valida: postgres },
  // El largo mínimo sí depende del perfil: un secreto corto de desarrollo es
  // aceptable, uno corto en producción es una vulnerabilidad.
  { nombre: 'JWT_SECRET', descripcion: 'Secreto de firma de los JWT.', valida: secreto(PRODUCCION ? 32 : 8) },
  { nombre: 'GEMINI_API_KEY', descripcion: 'Clave de Google Gemini (solo backend).', valida: secreto(20) },
  { nombre: 'GEMINI_MODEL', descripcion: 'Modelo de Gemini con cuota disponible.', valida: noVacia },
  { nombre: 'AI_RATE_LIMIT_PER_HOUR', descripcion: 'Consultas al tutor por estudiante/hora.', valida: entero(1, 1000) },
  { nombre: 'API_URL', descripcion: 'URL pública del backend (la usa el frontend).', soloProduccion: true, valida: url },
];

/** Lee un `.env` si existe, sin pisar lo que ya venga del proceso. */
function cargarEnv(archivo: string) {
  const p = path.join(RAIZ, archivo);
  if (!fs.existsSync(p)) return false;
  for (const linea of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const valor = m[2].replace(/^["']|["']$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = valor;
  }
  return true;
}

function main() {
  console.log('\n══ VARIABLES DE ENTORNO ══');
  console.log(`   perfil: ${PRODUCCION ? 'PRODUCCIÓN' : 'local'}`);
  const leido = cargarEnv('.env');
  console.log(`   .env del repositorio: ${leido ? 'leído' : 'no existe (se usan las del proceso)'}\n`);

  const fallos: string[] = [];
  const avisos: string[] = [];

  for (const r of REGLAS) {
    const exigida = PRODUCCION || !r.soloProduccion;
    const v = process.env[r.nombre];

    if (v === undefined || v === '') {
      const linea = `${r.nombre.padEnd(24)} ausente — ${r.descripcion}`;
      if (exigida) fallos.push(linea);
      else avisos.push(linea);
      continue;
    }
    const motivo = r.valida(v);
    if (motivo) {
      const linea = `${r.nombre.padEnd(24)} ${motivo}`;
      if (exigida) fallos.push(linea);
      else avisos.push(linea);
    } else {
      console.log(`   ✔ ${r.nombre}`);
    }
  }

  if (avisos.length) {
    console.log(`\n   Avisos (solo se exigen en producción):`);
    for (const a of avisos) console.log(`     · ${a}`);
  }

  if (fallos.length === 0) {
    console.log('\n   ✔ Entorno correcto.\n');
    return;
  }

  console.log(`\n   ✖ ${fallos.length} problema(s):`);
  for (const f of fallos) console.log(`     - ${f}`);
  console.log('');
  process.exit(1);
}

main();
