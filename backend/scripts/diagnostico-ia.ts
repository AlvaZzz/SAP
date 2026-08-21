/**
 * DIAGNÓSTICO DE PREXI (Gemini) — responde en un solo paso por qué la IA no
 * funciona, sin tener que reproducir el fallo a mano ni leer logs a ciegas.
 *
 *   npx tsx scripts/diagnostico-ia.ts
 *
 * Comprueba, en el orden en que las cosas fallan de verdad:
 *   1. GEMINI_API_KEY presente y con forma razonable.
 *   2. ConfiguracionSistema: `iaActiva` (interruptor del administrador) y
 *      `modeloIa` (el valor de la BD), más el modelo EFECTIVO según la
 *      precedencia real del código: entorno > BD > defecto.
 *   3. La clave contra la API: distingue clave inválida, permiso denegado,
 *      cuota agotada y restricción regional.
 *   4. Que el modelo efectivo exista y admita generateContent — el fallo más
 *      silencioso, porque Google retira modelos y el 404 llega en tiempo de uso.
 *   5. Una generación mínima de prueba, con el consumo real de tokens.
 *
 * Apunta DATABASE_URL a la base que quieras auditar (Neon en producción) y
 * define GEMINI_API_KEY / GEMINI_MODEL con los mismos valores del despliegue.
 * No escribe nada: es solo lectura.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API = 'https://generativelanguage.googleapis.com/v1beta';
/** Debe coincidir con TutorIaService.MODELO_DEFECTO. */
const MODELO_DEFECTO = 'gemini-2.5-flash-lite';

const ok = (m: string) => console.log(`  ✔ ${m}`);
const mal = (m: string) => console.log(`  ✖ ${m}`);
const info = (m: string) => console.log(`    ${m}`);

async function main() {
  console.log(`\n══ DIAGNÓSTICO DE PREXI (Gemini) · ${new Date().toISOString()} ══\n`);
  let problemas = 0;

  /* ── 1) Clave ── */
  console.log('1) Clave de API');
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    mal('GEMINI_API_KEY no está definida. PREXI responde 503 "La IA no está configurada en el servidor".');
    info('Defínela en el entorno del backend (en Render: Environment → Add Environment Variable).');
    await prisma.$disconnect();
    process.exit(1);
  }
  ok(`GEMINI_API_KEY presente (${key.length} caracteres, empieza por "${key.slice(0, 4)}…").`);

  /* ── 2) Configuración del sistema ── */
  console.log('\n2) Configuración del sistema (tabla configuracion_sistema)');
  const cfg = await prisma.configuracionSistema.findUnique({ where: { id: 1 } }).catch(() => null);
  if (!cfg) {
    info('No hay fila de configuración (id=1). Se usarán los valores por defecto del código.');
  } else {
    if (cfg.iaActiva === false) {
      mal('iaActiva = false → PREXI está APAGADO por el administrador. Ese es todo el problema.');
      info('Actívalo desde el panel de administración o con: UPDATE configuracion_sistema SET ia_activa = true WHERE id = 1;');
      problemas++;
    } else {
      ok('iaActiva = true.');
    }
    info(`modeloIa (BD) = "${cfg.modeloIa}" · rateLimitIaHora = ${cfg.rateLimitIaHora} · maxPistasIa = ${cfg.maxPistasIa}`);
  }

  const envModelo = process.env.GEMINI_MODEL?.trim();
  const modelo = envModelo || cfg?.modeloIa?.trim() || MODELO_DEFECTO;
  const origen = envModelo ? 'entorno GEMINI_MODEL' : cfg?.modeloIa?.trim() ? 'BD (configuracion_sistema.modelo_ia)' : 'defecto del código';
  console.log(`\n   MODELO EFECTIVO: "${modelo}"  ← ${origen}`);
  if (envModelo && cfg?.modeloIa && cfg.modeloIa !== envModelo) {
    info(`Aviso: el entorno pisa al valor de la BD ("${cfg.modeloIa}"). Es la precedencia esperada.`);
  }

  /* ── 3) La clave contra la API ── */
  console.log('\n3) Validez de la clave contra la API');
  const res = await fetch(`${API}/models?key=${key}`).catch((e: unknown) => e as Error);
  if (res instanceof Error) {
    mal(`No se pudo alcanzar ${API}: ${res.message}`);
    info('Fallo de red del servidor hacia Google. Revisa la salida a internet del despliegue.');
    await prisma.$disconnect();
    process.exit(1);
  }
  const cuerpo = (await res.json().catch(() => ({}))) as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }>; error?: { message?: string; status?: string } };
  if (!res.ok) {
    const detalle = cuerpo.error?.message ?? `HTTP ${res.status}`;
    const s = `${cuerpo.error?.status ?? ''} ${detalle}`;
    if (/API_KEY_INVALID|api key not valid|expired/i.test(s)) mal(`CLAVE INVÁLIDA: ${detalle}`);
    else if (/PERMISSION_DENIED/i.test(s) || res.status === 403) mal(`PERMISO DENEGADO: ${detalle}`);
    else if (res.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(s)) mal(`CUOTA AGOTADA: ${detalle}`);
    else if (/location is not supported|FAILED_PRECONDITION/i.test(s)) mal(`RESTRICCIÓN REGIONAL: ${detalle}`);
    else mal(`HTTP ${res.status}: ${detalle}`);
    await prisma.$disconnect();
    process.exit(1);
  }
  const disponibles = (cuerpo.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
  ok(`Clave válida. ${disponibles.length} modelos admiten generateContent.`);

  /* ── 4) ¿Existe el modelo efectivo? ── */
  console.log('\n4) Disponibilidad del modelo efectivo');
  if (disponibles.includes(modelo)) {
    ok(`"${modelo}" está disponible.`);
  } else {
    mal(`"${modelo}" NO está disponible para esta clave (Google lo retiró o el nombre es incorrecto).`);
    problemas++;
    const sugeridos = disponibles.filter((m) => /flash/.test(m) && !/preview|image|tts|omni/.test(m)).slice(0, 8);
    info(`Alternativas económicas vigentes: ${sugeridos.join(', ') || disponibles.slice(0, 8).join(', ')}`);
    info(`Arreglo: define GEMINI_MODEL=<modelo vigente> en el entorno (manda sobre la BD).`);
  }

  /* ── 5) Generación de prueba ── */
  console.log('\n5) Generación de prueba');
  const prueba = await fetch(`${API}/models/${modelo}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Responde solo con la palabra: listo' }] }],
      generationConfig: { maxOutputTokens: 16 },
    }),
  }).catch((e: unknown) => e as Error);

  if (prueba instanceof Error) {
    mal(`Fallo de red en la generación: ${prueba.message}`);
    problemas++;
  } else {
    const datos = (await prueba.json().catch(() => ({}))) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
      error?: { message?: string };
    };
    if (!prueba.ok) {
      mal(`HTTP ${prueba.status}: ${datos.error?.message ?? 'sin detalle'}`);
      problemas++;
    } else {
      const texto = datos.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '(vacío)';
      ok(`Gemini respondió: "${texto}"`);
      const u = datos.usageMetadata;
      if (u) info(`Tokens: entrada ${u.promptTokenCount} · salida ${u.candidatesTokenCount} · total ${u.totalTokenCount}`);
    }
  }

  console.log(
    problemas === 0
      ? '\n✔ PREXI está operativo con esta configuración.\n'
      : `\n✖ ${problemas} problema(s) detectado(s). Ver el detalle arriba.\n`,
  );
  await prisma.$disconnect();
  process.exit(problemas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('✖ El diagnóstico falló con un error no controlado:', e);
  await prisma.$disconnect();
  process.exit(1);
});
