/**
 * PRUEBA DE HUMO CONTRA PRODUCCIÓN.
 *
 *   npm run smoke                          → contra https://prexi.lat
 *   npm run smoke -- --url https://otra    → contra otra URL
 *   npm run smoke -- --api https://api...  → si el backend vive en otro host
 *
 * Se ejecuta DESPUÉS de desplegar. `npm run validar` comprueba el código; esto
 * comprueba que lo desplegado RESPONDE: son cosas distintas y las dos hacen
 * falta. Un despliegue puede estar en verde en CI y aun así servir 500 porque
 * faltó una variable de entorno en Render, que es exactamente el fallo que este
 * script existe para no descubrir a través de un estudiante.
 *
 * Recorre el camino real de un estudiante: registro → login (con cookies) →
 * renovación de sesión → ruta de ejercicios → responder → tutor → cierre.
 *
 * CUENTA DESECHABLE: se registra con un correo `smoke+<marca>@prexi.test`,
 * identificable a simple vista, y al terminar se BORRA a sí misma. Si el borrado
 * falla, el informe lo dice con el correo exacto para poder limpiarlo a mano: es
 * preferible un aviso ruidoso a dejar basura silenciosa en la base del estudio.
 *
 * ARRANQUE EN FRÍO: el plan gratuito de Render duerme el servicio tras un rato
 * de inactividad y la primera petición puede tardar ~60s. Por eso el primer
 * contacto reintenta con una espera generosa antes de dar nada por caído.
 */

import { spawnSync } from 'child_process';
import * as path from 'path';

const arg = (n: string, def: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};

const BASE = arg('url', 'https://prexi.lat').replace(/\/$/, '');
// La API se ataca A TRAVÉS del frontend (`prexi.lat/api/…`), no directamente
// contra `api.prexi.lat`. No es un atajo: es EXACTAMENTE el camino del
// navegador. Next reescribe `/api/:path*` hacia `${API_URL}/api/:path*`
// (frontend/next.config.js), y es esa reescritura la que mantiene las cookies
// de sesión como de primera parte con sameSite: 'strict'. Atacando el
// subdominio directamente se saltaría el rewrite —justo la pieza que más se
// rompe al desplegar— y las cookies vendrían de otro origen.
// Con `--api` se puede apuntar al backend directo si se quiere aislarlo.
const API = arg('api', `${BASE}/api`).replace(/\/$/, '');
const ESPERA_FRIO_MS = 120_000; // Render puede tardar ~60s en despertar

const marca = Date.now().toString(36);
const CUENTA = {
  nombre: 'Cuenta Smoke Desechable',
  email: `smoke+${marca}@prexi.test`,
  password: `Smoke${marca}123`,
  cedula: String(9_000_000 + (Date.now() % 999_999)),
  carrera: 'Ingeniería de Sistemas',
  paralelo: 'A',
  aceptaTerminos: true,
};

type Estado = 'OK' | 'FALLO' | 'AVISO';
interface Paso { nombre: string; estado: Estado; detalle: string; ms: number }
const pasos: Paso[] = [];

/** Cookies acumuladas entre peticiones (la sesión real usa cookies httpOnly). */
let cookies: Record<string, string> = {};
const cabeceraCookie = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');

function guardarCookies(res: Response) {
  const crudas = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const c of crudas) {
    const [par] = c.split(';');
    const i = par.indexOf('=');
    if (i > 0) cookies[par.slice(0, i).trim()] = par.slice(i + 1).trim();
  }
}

async function pedir(url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/json',
      ...(Object.keys(cookies).length ? { Cookie: cabeceraCookie() } : {}),
      ...(init.headers ?? {}),
    },
  });
  guardarCookies(res);
  return res;
}

async function paso(nombre: string, fn: () => Promise<string>, opcional = false) {
  const t0 = Date.now();
  try {
    const detalle = await fn();
    pasos.push({ nombre, estado: 'OK', detalle, ms: Date.now() - t0 });
    console.log(`  ✔ ${nombre.padEnd(38)} ${detalle}`);
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    pasos.push({ nombre, estado: opcional ? 'AVISO' : 'FALLO', detalle, ms: Date.now() - t0 });
    console.log(`  ${opcional ? '⚠' : '✖'} ${nombre.padEnd(38)} ${detalle}`);
  }
}

const cuerpo = async (res: Response) => {
  const t = await res.text();
  try { return JSON.parse(t) as Record<string, unknown>; } catch { return { _texto: t.slice(0, 200) }; }
};

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  PREXI · PRUEBA DE HUMO EN PRODUCCIÓN                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Frontend : ${BASE}`);
  console.log(`  API      : ${API}`);
  console.log(`  Cuenta   : ${CUENTA.email}\n`);

  // ── 1. El frontend responde (con tolerancia al arranque en frío) ──
  await paso('Frontend responde', async () => {
    const limite = Date.now() + ESPERA_FRIO_MS;
    let ultimo = '';
    for (let intento = 1; Date.now() < limite; intento++) {
      try {
        const res = await fetch(BASE, { redirect: 'manual' });
        if (res.status < 400 || res.status === 401) return `HTTP ${res.status} (intento ${intento})`;
        ultimo = `HTTP ${res.status}`;
      } catch (e) {
        ultimo = e instanceof Error ? e.message : String(e);
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error(`sin respuesta tras ${ESPERA_FRIO_MS / 1000}s (último: ${ultimo})`);
  });

  // ── 2. La API responde ──
  await paso('API /health responde', async () => {
    const limite = Date.now() + ESPERA_FRIO_MS;
    let ultimo = '';
    for (let intento = 1; Date.now() < limite; intento++) {
      try {
        const res = await fetch(`${API}/health`);
        if (res.ok) return `HTTP ${res.status} (intento ${intento})`;
        ultimo = `HTTP ${res.status}`;
      } catch (e) {
        ultimo = e instanceof Error ? e.message : String(e);
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error(`sin respuesta tras ${ESPERA_FRIO_MS / 1000}s (último: ${ultimo})`);
  });

  // ── 3. Registro ──
  let registrado = false;
  await paso('Registro de cuenta desechable', async () => {
    const res = await pedir(`${API}/auth/register`, { method: 'POST', body: JSON.stringify(CUENTA) });
    const b = await cuerpo(res);
    if (!res.ok) throw new Error(`HTTP ${res.status} · ${JSON.stringify(b).slice(0, 160)}`);
    registrado = true;
    return `HTTP ${res.status} · usuario creado`;
  });

  // ── 4. Login con cookies ──
  await paso('Login (cookies de sesión)', async () => {
    cookies = {}; // se fuerza un login limpio, sin arrastrar el del registro
    const res = await pedir(`${API}/auth/login`, {
      method: 'POST', body: JSON.stringify({ email: CUENTA.email, password: CUENTA.password }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} · ${JSON.stringify(await cuerpo(res)).slice(0, 160)}`);
    const nombres = Object.keys(cookies);
    if (nombres.length === 0) throw new Error('no llegó ninguna cookie de sesión');
    return `HTTP ${res.status} · cookies: ${nombres.join(', ')}`;
  });

  // ── 5. La sesión sirve para pedir datos propios ──
  await paso('Sesión válida (/auth/me)', async () => {
    const res = await pedir(`${API}/auth/me`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const b = await cuerpo(res);
    return `HTTP ${res.status} · ${(b.usuario as { email?: string })?.email ?? 'ok'}`;
  });

  // ── 6. Renovación de sesión ──
  await paso('Renovación de sesión (/auth/refresh)', async () => {
    const res = await pedir(`${API}/auth/refresh`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return `HTTP ${res.status} · sesión renovada`;
  });

  // ── 7. Cargar un ejercicio y responderlo ──
  let ejercicioId: number | null = null;
  await paso('Cargar un ejercicio', async () => {
    const res = await pedir(`${API}/ejercicios`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const b = await cuerpo(res);
    const lista = (b.ejercicios ?? []) as { id: number }[];
    if (!lista.length) throw new Error('la lista de ejercicios vino vacía');
    ejercicioId = lista[0].id;
    return `HTTP ${res.status} · ${lista.length} ejercicios · usando #${ejercicioId}`;
  });

  await paso('Responder el ejercicio', async () => {
    if (ejercicioId == null) throw new Error('no hubo ejercicio que responder');
    const res = await pedir(`${API}/intentos`, {
      method: 'POST',
      body: JSON.stringify({ ejercicioId, respuestaDada: 'A', tiempoSeg: 5 }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} · ${JSON.stringify(await cuerpo(res)).slice(0, 160)}`);
    const b = await cuerpo(res);
    return `HTTP ${res.status} · correcto=${b.correcto}`;
  });

  // ── 8. El tutor responde (opcional: depende de la cuota de Gemini) ──
  await paso('El tutor PREXI responde', async () => {
    const res = await pedir(`${API}/tutor-ia/asistente`, {
      method: 'POST',
      body: JSON.stringify({ pregunta: '¿Qué es una variable en Python?', ejercicio_id: ejercicioId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} · ${JSON.stringify(await cuerpo(res)).slice(0, 160)}`);
    const b = await cuerpo(res);
    const txt = String(b.respuesta ?? b.explicacion ?? '');
    if (!txt.trim()) throw new Error('respondió vacío');
    return `HTTP ${res.status} · ${txt.length} caracteres`;
  }, true);

  // ── 9. Cero 404 en los recursos estáticos que sirve el frontend ──
  await paso('Recursos estáticos sin 404', async () => {
    const html = await (await fetch(BASE, { redirect: 'follow' })).text();
    const rutas = new Set<string>();
    for (const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+\.(?:png|jpg|jpeg|svg|webp|ico|css|js|woff2?))["']/g)) {
      const r = m[1];
      if (r.startsWith('http') && !r.startsWith(BASE)) continue; // recursos de terceros
      rutas.add(r.startsWith('http') ? r : `${BASE}${r.startsWith('/') ? '' : '/'}${r}`);
    }
    const malos: string[] = [];
    for (const u of rutas) {
      try {
        const res = await fetch(u, { method: 'HEAD' });
        if (res.status === 404) malos.push(`${u} → 404`);
      } catch { /* un fallo de red no es un 404: no se cuenta */ }
    }
    if (malos.length) throw new Error(`${malos.length} recurso(s) con 404: ${malos.slice(0, 5).join(', ')}`);
    return `${rutas.size} recurso(s) comprobados, ninguno con 404`;
  });

  // ── 10. Limpieza de la cuenta desechable ──
  // El sistema NO expone borrado duro de usuarios, y es deliberado: el admin
  // solo puede desactivar (soft-disable) para no perder datos del estudio. Así
  // que la cuenta se elimina desde fuera de la API, contra la base, con un
  // script acotado al patrón de correo que solo usa esta prueba
  // (backend/scripts/limpiar-smoke.ts). Sin DATABASE_URL no se puede: entonces
  // se avisa con el correo exacto en vez de dejar basura en silencio.
  if (registrado) {
    await paso('Borrado de la cuenta desechable', async () => {
      if (!process.env.DATABASE_URL) {
        throw new Error(`sin DATABASE_URL — BÓRRALA A MANO: ${CUENTA.email}`);
      }
      const r = spawnSync(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['--no-install', 'tsx', 'scripts/limpiar-smoke.ts', '--aplicar', '--email', CUENTA.email],
        { cwd: path.join(__dirname, '..', 'backend'), encoding: 'utf8' },
      );
      const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
      if (r.status !== 0) throw new Error(`la limpieza falló — BÓRRALA A MANO: ${CUENTA.email}`);
      if (!/eliminada/.test(salida)) throw new Error(`no se confirmó el borrado — REVISA: ${CUENTA.email}`);
      return `${CUENTA.email} eliminada`;
    }, true);
  }

  // ── Resumen ──
  const fallos = pasos.filter((p) => p.estado === 'FALLO');
  const avisos = pasos.filter((p) => p.estado === 'AVISO');

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  RESUMEN                                                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  for (const p of pasos) {
    const ic = p.estado === 'OK' ? '✔' : p.estado === 'AVISO' ? '⚠' : '✖';
    console.log(`  ${ic} ${p.nombre.padEnd(38)} ${`${(p.ms / 1000).toFixed(1)}s`.padStart(7)}  ${p.detalle}`);
  }
  console.log(`\n  ${pasos.length} pasos · ${pasos.length - fallos.length - avisos.length} en verde · ${fallos.length} con fallo · ${avisos.length} con aviso`);

  if (avisos.some((a) => a.nombre.includes('Borrado'))) {
    console.log(`\n  ⚠ QUEDÓ UNA CUENTA SIN BORRAR: ${CUENTA.email} — elimínala desde el panel de admin.`);
  }

  if (fallos.length) {
    console.log('\n  ✖ HUMO CON FALLOS — considera revertir (Instant Rollback en Vercel / redespliegue anterior en Render).\n');
    process.exit(1);
  }
  console.log('\n  ✔ HUMO EN VERDE — lo desplegado responde.\n');
}

main().catch((e) => {
  console.error('\n✖ La prueba de humo se interrumpió:', e);
  process.exit(1);
});
