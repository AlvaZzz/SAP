/**
 * VALIDACIÓN COMPLETA — la red de seguridad previa a desplegar.
 *
 *   npm run validar
 *
 * Un solo comando que corre TODO lo que puede fallar y resume el resultado.
 * Sale con código distinto de cero si algo falla, para que sirva en CI y para
 * que la regla "no fusionar a main sin validar en verde" sea comprobable y no
 * un acuerdo de palabra.
 *
 * Además de lo evidente (tipos, lint, pruebas, e2e, auditoría), incluye tres
 * comprobaciones que existen porque su defecto correspondiente YA llegó a
 * producción sin que nada lo detectara:
 *
 *   · RECURSOS  — `/python-logo.svg` se pedía en cada visita al login y devolvía
 *                 404: el archivo nunca existió. Ni el compilador ni ESLint miran
 *                 dentro de una cadena de texto.
 *   · TEXTO     — la pantalla de registro llegó a producción con 73 caracteres
 *                 U+FFFD: seguía siendo UTF-8 válido y compilaba sin una queja.
 *   · ENTORNO   — una variable ausente o con el valor de ejemplo no rompe la
 *                 compilación, rompe el arranque (o la primera petición real).
 *
 * Los pasos marcados como `requiereStack` necesitan la base de datos local. Si
 * no está accesible se informan como OMITIDOS y la validación sale DISTINTO DE
 * CERO: una red de seguridad que se salta pasos en silencio no es una red.
 */
import { spawnSync } from 'child_process';
import * as net from 'net';
import * as path from 'path';

const RAIZ = path.join(__dirname, '..');
const BACKEND = path.join(RAIZ, 'backend');
const FRONTEND = path.join(RAIZ, 'frontend');

/** Puerto que docker-compose publica para PostgreSQL en la máquina del usuario. */
const BD_HOST = '127.0.0.1';
const BD_PUERTO = 5433;
const BD_URL_LOCAL = `postgresql://prexi:prexi@${BD_HOST}:${BD_PUERTO}/prexi?schema=public`;

interface Paso {
  nombre: string;
  cwd: string;
  cmd: string;
  args: string[];
  /** Necesita la base de datos local levantada. */
  requiereStack?: boolean;
  env?: Record<string, string>;
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const PASOS: Paso[] = [
  // ── Comprobaciones propias (rápidas, sin dependencias) ──
  { nombre: 'Integridad del texto (U+FFFD / mojibake)', cwd: RAIZ, cmd: npx, args: ['--no-install', 'tsx', 'scripts/verificar-texto.ts'] },
  { nombre: 'Recursos estáticos referenciados', cwd: RAIZ, cmd: npx, args: ['--no-install', 'tsx', 'scripts/verificar-recursos.ts'] },
  { nombre: 'Variables de entorno', cwd: RAIZ, cmd: npx, args: ['--no-install', 'tsx', 'scripts/verificar-entorno.ts'] },

  // ── Tipos y estilo ──
  { nombre: 'Backend · comprobación de tipos', cwd: BACKEND, cmd: npx, args: ['--no-install', 'tsc', '--noEmit', '-p', 'tsconfig.json'] },
  { nombre: 'Backend · lint', cwd: BACKEND, cmd: npm, args: ['run', 'lint'] },
  { nombre: 'Frontend · comprobación de tipos', cwd: FRONTEND, cmd: npx, args: ['--no-install', 'tsc', '--noEmit'] },
  // `next lint` carga next.config.js, que exige API_URL y aborta sin ella.
  { nombre: 'Frontend · lint', cwd: FRONTEND, cmd: npm, args: ['run', 'lint'], env: { API_URL: process.env.API_URL ?? 'http://localhost:4000' } },

  // ── Pruebas ──
  { nombre: 'Backend · pruebas unitarias', cwd: BACKEND, cmd: npx, args: ['--no-install', 'jest', '--ci'] },
  { nombre: 'Backend · pruebas end-to-end', cwd: BACKEND, cmd: npm, args: ['run', 'test:e2e'], requiereStack: true },

  // ── Contenido ──
  { nombre: 'Auditoría del contenido', cwd: BACKEND, cmd: npx, args: ['--no-install', 'tsx', 'scripts/auditoria-completa.ts'], requiereStack: true },
];

/** ¿Responde el PostgreSQL local? Se comprueba abriendo el socket, sin cliente. */
function bdAccesible(): Promise<boolean> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    const cerrar = (ok: boolean) => { s.destroy(); resolve(ok); };
    s.setTimeout(2000);
    s.once('connect', () => cerrar(true));
    s.once('timeout', () => cerrar(false));
    s.once('error', () => cerrar(false));
    s.connect(BD_PUERTO, BD_HOST);
  });
}

type Estado = 'OK' | 'FALLO' | 'OMITIDO';
interface Resultado { nombre: string; estado: Estado; ms: number; detalle?: string }

function ejecutar(p: Paso): Resultado {
  const t0 = Date.now();
  process.stdout.write(`\n──────────────────────────────────────────────────────────────\n▶ ${p.nombre}\n`);
  const r = spawnSync(p.cmd, p.args, {
    cwd: p.cwd,
    stdio: 'inherit',
    // `shell: true` es obligatorio en Windows: desde la corrección de
    // CVE-2024-27980, Node se niega a lanzar archivos .cmd (npm.cmd, npx.cmd)
    // sin shell y devuelve EINVAL. Ningún argumento viene del exterior —son
    // literales de PASOS—, así que no hay superficie de inyección.
    shell: true,
    env: {
      ...process.env,
      // Los pasos contra la base usan el puerto que publica docker-compose,
      // salvo que el usuario ya traiga su propia DATABASE_URL.
      DATABASE_URL: process.env.DATABASE_URL ?? BD_URL_LOCAL,
      DIRECT_URL: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? BD_URL_LOCAL,
      ...(p.env ?? {}),
    },
  });
  const ms = Date.now() - t0;
  if (r.error) return { nombre: p.nombre, estado: 'FALLO', ms, detalle: r.error.message };
  return { nombre: p.nombre, estado: r.status === 0 ? 'OK' : 'FALLO', ms, detalle: r.status === 0 ? undefined : `código ${r.status}` };
}

async function main() {
  const t0 = Date.now();
  const hayBd = await bdAccesible();

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  PREXI · VALIDACIÓN COMPLETA                                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Base de datos local (${BD_HOST}:${BD_PUERTO}): ${hayBd ? 'accesible' : 'NO accesible'}`);
  if (!hayBd) console.log('  → los pasos que la necesitan se OMITEN y la validación NO puede darse por buena.');

  const resultados: Resultado[] = [];
  for (const p of PASOS) {
    if (p.requiereStack && !hayBd) {
      resultados.push({ nombre: p.nombre, estado: 'OMITIDO', ms: 0, detalle: 'sin base de datos local' });
      console.log(`\n──────────────────────────────────────────────────────────────\n⃠ ${p.nombre} — OMITIDO (sin base de datos local)`);
      continue;
    }
    resultados.push(ejecutar(p));
  }

  const icono: Record<Estado, string> = { OK: '✔', FALLO: '✖', OMITIDO: '⃠' };
  const fallos = resultados.filter((r) => r.estado === 'FALLO');
  const omitidos = resultados.filter((r) => r.estado === 'OMITIDO');

  console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  RESUMEN                                                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  for (const r of resultados) {
    const t = r.ms ? `${(r.ms / 1000).toFixed(1)}s`.padStart(7) : '      —';
    console.log(`  ${icono[r.estado]} ${r.nombre.padEnd(44)} ${t}  ${r.detalle ?? ''}`);
  }
  console.log(`\n  ${resultados.length} pasos · ${resultados.length - fallos.length - omitidos.length} en verde · ${fallos.length} con fallo · ${omitidos.length} omitidos`);
  console.log(`  Tiempo total: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (fallos.length === 0 && omitidos.length === 0) {
    console.log('\n  ✔ VALIDACIÓN COMPLETA EN VERDE — se puede fusionar a main y desplegar.\n');
    return;
  }
  if (fallos.length === 0) {
    console.log('\n  ⚠ VALIDACIÓN INCOMPLETA: nada falló, pero quedaron pasos sin ejecutar.');
    console.log('    Levanta el stack local (docker compose up -d) y vuelve a ejecutarla.');
    console.log('    NO despliegues con la validación incompleta.\n');
    process.exit(2);
  }
  console.log('\n  ✖ VALIDACIÓN CON FALLOS — no fusiones a main hasta resolverlos.\n');
  process.exit(1);
}

main();
