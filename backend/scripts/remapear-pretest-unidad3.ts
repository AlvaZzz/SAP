/**
 * REMAPEO DEL PRETEST DE LA UNIDAD 3 (corrección puntual de integridad).
 *
 *   npx tsx scripts/remapear-pretest-unidad3.ts --dry     → muestra qué haría
 *   npx tsx scripts/remapear-pretest-unidad3.ts --aplicar → lo aplica
 *
 * POR QUÉ: al re-sembrar la Unidad 3 con el banco oficial, el temario pasó de 3 a
 * 8 temas y los números 3.2 y 3.3 cambiaron de significado:
 *
 *   3.2  "Funciones y procedimientos"        → "Ventajas de la Modularización"
 *   3.3  "Técnica de programación recursiva" → "Cohesión y Acoplamiento"
 *
 * El banco `pretest` NO se toca al sembrar (es instrumento de medición), así que
 * sus ítems quedaron colgando de temas que ya no tratan de eso: 3 preguntas de
 * FUNCIONES midiendo "Ventajas de la Modularización" y 3 de RECURSIVIDAD midiendo
 * "Cohesión y Acoplamiento". El diagnóstico por tema (DiagnosticoTema) habría
 * reportado un nivel sobre un tema evaluándolo con preguntas de otro.
 *
 * QUÉ HACE:
 *  1. Los 3 ítems de funciones se mueven al tema 3.6 "Definición de Funciones en
 *     Python", que es su contenido real, y 3.6 se marca `enDiagnostico`.
 *  2. Los 3 ítems de recursividad se DESACTIVAN (`activo=false`): el temario nuevo
 *     de la Unidad 3 ya no cubre recursividad. No se borran: quedan recuperables
 *     si el docente reincorpora el tema.
 *  3. 3.2 y 3.3 dejan de ser temas de diagnóstico (se quedan sin ítems propios).
 *
 * Es idempotente: re-ejecutarlo no vuelve a mover nada.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APLICAR = process.argv.includes('--aplicar');

/** Los 6 ítems de pretest de la U3, identificados por su enunciado. */
const FUNCIONES = [
  '¿Qué palabra clave define una función en Python?',
  '¿Qué imprime este programa?',
  '¿Qué imprime el código?',
];
const RECURSIVIDAD = [
  'Una función recursiva es aquella que:',
  '¿Qué elemento es IMPRESCINDIBLE en toda función recursiva para que termine?',
  '¿Qué devuelve factorial(3)?',
];

async function main() {
  const unidad = await prisma.unidad.findFirst({ where: { numero: 3 }, orderBy: { id: 'asc' } });
  if (!unidad) throw new Error('No existe la Unidad 3');

  const temas = await prisma.tema.findMany({ where: { unidadId: unidad.id }, select: { id: true, numero: true, titulo: true } });
  const porNumero = new Map(temas.map((t) => [t.numero, t]));
  const destino = porNumero.get('3.6');
  if (!destino) throw new Error('No existe el tema 3.6 (siembra primero la Unidad 3).');

  const pretest = await prisma.ejercicio.findMany({
    where: { banco: 'pretest', tema: { unidadId: unidad.id } },
    select: { id: true, enunciado: true, activo: true, temaId: true },
  });

  const esFunciones = (e: { enunciado: string }) => FUNCIONES.includes(e.enunciado.trim());
  const esRecursividad = (e: { enunciado: string }) => RECURSIVIDAD.includes(e.enunciado.trim());

  const aMover = pretest.filter((e) => esFunciones(e) && e.temaId !== destino.id);
  const aDesactivar = pretest.filter((e) => esRecursividad(e) && e.activo);
  const sinClasificar = pretest.filter((e) => !esFunciones(e) && !esRecursividad(e));

  console.log(`\n══ REMAPEO DEL PRETEST · Unidad 3 ══\n`);
  console.log(`Ítems de pretest en la unidad: ${pretest.length}`);
  console.log(`\n1) Mover al tema 3.6 «${destino.titulo}» (contenido: funciones): ${aMover.length}`);
  for (const e of aMover) console.log(`   · [${e.id}] ${e.enunciado.slice(0, 70)}`);
  console.log(`\n2) Desactivar (recursividad, fuera del temario nuevo): ${aDesactivar.length}`);
  for (const e of aDesactivar) console.log(`   · [${e.id}] ${e.enunciado.slice(0, 70)}`);
  if (sinClasificar.length) {
    console.log(`\n⚠ Sin clasificar (revísalos a mano): ${sinClasificar.length}`);
    for (const e of sinClasificar) console.log(`   · [${e.id}] ${e.enunciado.slice(0, 70)}`);
  }

  if (!APLICAR) {
    console.log('\n(dry-run) Nada se modificó. Re-ejecuta con --aplicar para confirmar.\n');
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (aMover.length) {
      await tx.ejercicio.updateMany({ where: { id: { in: aMover.map((e) => e.id) } }, data: { temaId: destino.id } });
      // Las respuestas ya registradas apuntan al tema viejo: se alinean al nuevo
      // para que el diagnóstico por tema siga cuadrando con el ítem.
      await tx.pretestRespuesta.updateMany({ where: { ejercicioId: { in: aMover.map((e) => e.id) } }, data: { temaId: destino.id } });
    }
    if (aDesactivar.length) {
      await tx.ejercicio.updateMany({ where: { id: { in: aDesactivar.map((e) => e.id) } }, data: { activo: false } });
    }
    // 3.6 pasa a ser tema de diagnóstico; 3.2 y 3.3 dejan de serlo.
    await tx.tema.update({ where: { id: destino.id }, data: { enDiagnostico: true } });
    for (const n of ['3.2', '3.3']) {
      const t = porNumero.get(n);
      if (t) await tx.tema.update({ where: { id: t.id }, data: { enDiagnostico: false } });
    }
  });

  console.log('\n✔ Aplicado.\n');
}

main()
  .catch((e) => { console.error('✖', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
