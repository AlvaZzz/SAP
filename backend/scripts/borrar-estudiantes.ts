/**
 * BORRADO DE TODOS LOS ESTUDIANTES — para empezar la recolección real con la
 * base limpia de estudiantes.
 *
 *   npx tsx scripts/borrar-estudiantes.ts                                        → SIMULACIÓN (no borra)
 *   npx tsx scripts/borrar-estudiantes.ts --aplicar --confirmar BORRAR-ESTUDIANTES → borra
 *
 * Qué borra: TODAS las cuentas con rol `estudiante` y, por `onDelete: Cascade`,
 * todo lo suyo (intentos, progreso, diagnósticos, exámenes, logs del motor,
 * encuestas, ranking, entregas, notificaciones, solicitudes…).
 *
 * Qué NO toca: docentes, investigadores, administradores, materias, paralelos
 * (quedan vacíos, con su docente), unidades, temas, ejercicios, retos ni la
 * configuración.
 *
 * Es irreversible: haz antes un respaldo con pg_dump (ver docs/BASE_DE_DATOS.md).
 * El rol se comprueba en el WHERE y otra vez sobre cada fila antes de borrar.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const iConf = process.argv.indexOf('--confirmar');
const CONFIRMACION = iConf >= 0 ? process.argv[iConf + 1] : null;
const FRASE = 'BORRAR-ESTUDIANTES';

/** Host de la base, sin usuario ni contraseña: para que se vea CONTRA QUÉ base se trabaja. */
function hostDeLaBase(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? '').host || '(sin DATABASE_URL)';
  } catch {
    return '(DATABASE_URL ilegible)';
  }
}

async function main() {
  console.log(`\n══ BORRADO DE ESTUDIANTES ══  modo: ${APLICAR ? 'APLICAR (borra)' : 'SIMULACIÓN'}`);
  console.log(`   base: ${hostDeLaBase()}`);

  const estudiantes = await prisma.usuario.findMany({
    where: { rol: 'estudiante' },
    select: { id: true, rol: true, paralelo: true, estadoInscripcion: true },
    orderBy: { id: 'asc' },
  });
  // Segunda comprobación, ya sobre los datos reales.
  const objetivo = estudiantes.filter((u) => u.rol === 'estudiante');
  const ids = objetivo.map((u) => u.id);

  const porParalelo = new Map<string, number>();
  for (const u of objetivo) {
    const p = u.paralelo ?? 'Sin paralelo';
    porParalelo.set(p, (porParalelo.get(p) ?? 0) + 1);
  }
  const otrosRoles = await prisma.usuario.groupBy({ by: ['rol'], where: { rol: { not: 'estudiante' } }, _count: { _all: true } });

  console.log(`\n  Estudiantes a borrar: ${objetivo.length}`);
  for (const [p, n] of [...porParalelo.entries()].sort()) console.log(`     - paralelo ${p}: ${n}`);
  if (objetivo.length) {
    const [intentos, logs, examenes, evaluaciones] = await Promise.all([
      prisma.intento.count({ where: { usuarioId: { in: ids } } }),
      prisma.logAdaptacion.count({ where: { usuarioId: { in: ids } } }),
      prisma.examenUnidad.count({ where: { usuarioId: { in: ids } } }),
      prisma.evaluacion.count({ where: { usuarioId: { in: ids } } }),
    ]);
    console.log(`\n  Se borran con ellos: ${intentos} intentos, ${logs} decisiones del motor, ${examenes} exámenes de unidad, ${evaluaciones} diagnósticos/evaluaciones (y el resto de sus datos).`);
  }
  console.log(`\n  Se CONSERVAN: ${otrosRoles.map((r) => `${r._count._all} ${r.rol}`).join(', ') || 'ninguna otra cuenta'}, y todo el contenido y los paralelos.`);

  if (objetivo.length === 0) {
    console.log('\n  ✔ No hay estudiantes que borrar.\n');
    return;
  }
  if (!APLICAR) {
    console.log(`\n  SIMULACIÓN: no se borró nada. Para borrar: --aplicar --confirmar ${FRASE}\n`);
    return;
  }
  if (CONFIRMACION !== FRASE) {
    console.error(`\n  ✖ Falta la confirmación. Agrega: --confirmar ${FRASE}\n`);
    process.exit(1);
  }

  const { count } = await prisma.usuario.deleteMany({ where: { id: { in: ids }, rol: 'estudiante' } });
  const quedan = await prisma.usuario.count({ where: { rol: 'estudiante' } });
  console.log(`\n  ✔ ${count} estudiante(s) eliminados con sus datos. Estudiantes que quedan: ${quedan}.\n`);
}

main()
  .catch((e) => {
    console.error('✖ Falló el borrado:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
