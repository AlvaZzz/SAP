/**
 * LIMPIEZA DE LAS CUENTAS DE LA PRUEBA DE HUMO.
 *
 *   npx tsx scripts/limpiar-smoke.ts                    → SIMULACIÓN (no borra)
 *   npx tsx scripts/limpiar-smoke.ts --aplicar          → borra
 *   npx tsx scripts/limpiar-smoke.ts --aplicar --email X → borra solo esa
 *
 * Por qué es un script aparte y no un endpoint: el sistema NO tiene borrado duro
 * de usuarios, y es una decisión de diseño, no un olvido. El administrador solo
 * puede DESACTIVAR una cuenta (soft-disable) para no perder los datos del
 * estudio. Añadir un `DELETE /auth/me` solo para poder limpiar tras una prueba
 * de humo abriría, en producción y para cualquier estudiante, la puerta a borrar
 * su propia participación en la investigación.
 *
 * Por eso la cuenta desechable se elimina desde FUERA de la API, contra la base,
 * y acotada por el patrón de correo que solo usa la prueba de humo.
 *
 * Alcance: SOLO correos `smoke+…@prexi.test`. El patrón se comprueba en el WHERE
 * y otra vez sobre cada fila antes de borrar: es una operación destructiva sobre
 * la base de producción y no debe depender de un solo filtro.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const iEmail = process.argv.indexOf('--email');
const EMAIL = iEmail >= 0 ? process.argv[iEmail + 1] : null;

/** Único patrón admitido. Cualquier cosa fuera de aquí NO se toca. */
const PATRON = /^smoke\+[a-z0-9]+@prexi\.test$/i;

async function main() {
  console.log(`\n══ LIMPIEZA DE CUENTAS DE PRUEBA DE HUMO ══  modo: ${APLICAR ? 'APLICAR (borra)' : 'SIMULACIÓN'}`);
  if (EMAIL) console.log(`   acotado a: ${EMAIL}`);

  if (EMAIL && !PATRON.test(EMAIL)) {
    console.error(`\n  ✖ "${EMAIL}" no es un correo de prueba de humo. No se toca nada.\n`);
    process.exit(1);
  }

  const candidatas = await prisma.usuario.findMany({
    where: EMAIL
      ? { email: EMAIL }
      : { email: { startsWith: 'smoke+', endsWith: '@prexi.test' } },
    select: { id: true, email: true, nombre: true, rol: true, creadoEn: true },
    orderBy: { id: 'asc' },
  });

  // Segunda comprobación del patrón, ya sobre los datos reales.
  const objetivo = candidatas.filter((u) => PATRON.test(u.email));
  const descartadas = candidatas.filter((u) => !PATRON.test(u.email));

  if (descartadas.length) {
    console.log(`\n  Descartadas por no encajar en el patrón exacto (${descartadas.length}):`);
    for (const u of descartadas) console.log(`     - #${u.id} <${u.email}>`);
  }

  if (objetivo.length === 0) {
    console.log('\n  ✔ No hay cuentas de prueba de humo que limpiar.\n');
    return;
  }

  console.log(`\n  Cuentas a eliminar (${objetivo.length}):`);
  for (const u of objetivo) console.log(`     - #${u.id} ${u.nombre} <${u.email}> (${u.rol}, ${u.creadoEn.toISOString().slice(0, 10)})`);

  if (!APLICAR) {
    console.log('\n  SIMULACIÓN: no se borró nada. Ejecuta con --aplicar para confirmar.\n');
    return;
  }

  // Las filas dependientes (intentos, progreso, ranking…) caen por `onDelete:
  // Cascade` del esquema; no hay que enumerarlas aquí.
  const { count } = await prisma.usuario.deleteMany({ where: { id: { in: objetivo.map((u) => u.id) } } });
  console.log(`\n  ✔ ${count} cuenta(s) eliminada(s) con sus datos asociados.\n`);
}

main()
  .catch((e) => {
    console.error('✖ Falló la limpieza:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
