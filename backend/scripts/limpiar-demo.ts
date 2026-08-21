/**
 * LIMPIEZA DEL RESIDUO DE DEMOSTRACIÓN.
 *
 *   npx tsx scripts/limpiar-demo.ts            → SIMULACIÓN (no escribe)
 *   npx tsx scripts/limpiar-demo.ts --aplicar  → escribe (en transacción)
 *
 * Qué arregla: dos reglas de la auditoría fallaban por CONTENIDO sembrado para
 * demostrar el sistema, no por defectos del contenido real:
 *
 *   · Regla 4  — ejercicios "Ejercicio de relleno N" con 2 opciones en vez de 4.
 *                Un ítem de opción múltiple con dos opciones da un 50 % de
 *                acierto al azar: no mide nada y contamina θ si alguien lo
 *                responde.
 *   · Reglas 6/7 — retos anteriores al generador de retos derivados, sin
 *                `origenEjercicioId`. Sin ejercicio de origen no se puede
 *                validar la entrega ni plantar el bug de una misión de
 *                depuración.
 *
 * DESACTIVA, NO BORRA (`activo = false`). Es deliberado: tres de esos retos
 * tienen ENTREGAS de estudiantes y los ejercicios podrían tener intentos.
 * Borrarlos destruiría datos del estudio; desactivarlos los saca de la vista del
 * estudiante y de la auditoría conservando todo el historial.
 *
 * Es IDEMPOTENTE y solo toca filas que encajan en un patrón muy estrecho: nunca
 * desactiva un ejercicio con tema asignado ni un reto que tenga origen.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');

async function main() {
  console.log(`\n══ LIMPIEZA DEL RESIDUO DE DEMOSTRACIÓN ══  modo: ${APLICAR ? 'APLICAR (escribe)' : 'SIMULACIÓN'}\n`);

  /* ── 1. Ejercicios de opción con menos de 4 opciones ──
     Se exige ADEMÁS que no tengan tema: el contenido real del plan siempre
     cuelga de un tema, así que esta condición sola ya excluye el banco oficial
     y protege de paso las reglas 1 y 2 (distribución 15/10/5 por tema). */
  const candidatos = await prisma.ejercicio.findMany({
    where: { activo: true, temaId: null, tipo: { in: ['opcion_multiple', 'predecir_salida'] } },
    select: { id: true, enunciado: true, opciones: true, banco: true },
  });
  const malos = candidatos.filter((e) => !Array.isArray(e.opciones) || (e.opciones as unknown[]).length !== 4);

  console.log(`── Ejercicios de opción sin tema y sin 4 opciones: ${malos.length}`);
  for (const e of malos.slice(0, 5)) {
    console.log(`     #${e.id} [${e.banco}] "${e.enunciado.slice(0, 50)}" · ${(e.opciones as unknown[])?.length ?? 0} opciones`);
  }
  if (malos.length > 5) console.log(`     … y ${malos.length - 5} más`);

  /* ── 2. Retos activos sin ejercicio de origen ── */
  const retos = await prisma.reto.findMany({
    where: { activo: true, origenEjercicioId: null },
    select: { id: true, titulo: true, esBugHunt: true, _count: { select: { resueltos: true } } },
    orderBy: { id: 'asc' },
  });
  console.log(`\n── Retos activos sin ejercicio de origen: ${retos.length}`);
  for (const r of retos) {
    console.log(`     #${r.id} "${r.titulo}"${r.esBugHunt ? ' (depuración)' : ''} · ${r._count.resueltos} entrega(s) — se CONSERVAN`);
  }

  if (malos.length === 0 && retos.length === 0) {
    console.log('\n  ✔ No queda residuo de demostración. Nada que hacer.\n');
    return;
  }

  if (!APLICAR) {
    console.log('\n  SIMULACIÓN: no se escribió nada. Ejecuta con --aplicar para confirmar.\n');
    return;
  }

  const [ejUpd, retoUpd] = await prisma.$transaction([
    prisma.ejercicio.updateMany({ where: { id: { in: malos.map((e) => e.id) } }, data: { activo: false } }),
    prisma.reto.updateMany({ where: { id: { in: retos.map((r) => r.id) } }, data: { activo: false } }),
  ]);
  console.log(`\n  ✔ ${ejUpd.count} ejercicio(s) y ${retoUpd.count} reto(s) DESACTIVADOS (ninguna fila borrada).\n`);
}

main()
  .catch((e) => {
    console.error('✖ Falló la limpieza:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
