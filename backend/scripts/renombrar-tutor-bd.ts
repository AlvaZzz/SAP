/**
 * MIGRACIÓN DE DATOS: el tutor deja de llamarse ALVARO y pasa a llamarse PREXI.
 *
 *   npx tsx scripts/renombrar-tutor-bd.ts            → SIMULACIÓN (no escribe)
 *   npx tsx scripts/renombrar-tutor-bd.ts --aplicar  → escribe (en transacción)
 *
 * Por qué hace falta además del renombrado en el código: hay texto YA ESCRITO en
 * la base que menciona al tutor por su nombre —notificaciones enviadas, notas del
 * docente, feedback de revisiones, descripciones de logros, el nombre del sistema
 * en la configuración—. Cambiar el código no reescribe esas filas: un estudiante
 * seguiría leyendo "ALVARO" en su bandeja de notificaciones.
 *
 * QUÉ NO TOCA, y esto es lo importante:
 *   · `usuarios.nombre` y `usuarios.email` — ahí vive el nombre de PERSONAS
 *     REALES (el titular del proyecto se llama Alvaro Daniel Acarapi). Renombrar
 *     ahí corrompería datos del estudio. Esas columnas están excluidas por
 *     lista blanca: el script solo mira las columnas que enumera abajo.
 *   · Cualquier tabla o columna no listada.
 *
 * La sustitución es por PALABRA COMPLETA (`\m…\M` en PostgreSQL) y solo de las
 * formas del NOMBRE del tutor: ALVARO / Alvaro / ALEX / Alex. NO toca "Álvaro"
 * (con tilde), que en el sistema solo aparece como nombre de pila de personas.
 *
 * El UPDATE va con `regexp_replace` sobre la columna entera y no fila a fila por
 * su id: `notas_docente` no tiene columna `id` y `retos_usuario` usa clave
 * compuesta, así que depender de una clave primaria única no funcionaría en la
 * mitad de las tablas. Además así cada columna se actualiza de una sola vez.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');

/** Tablas y columnas de TEXTO que pueden mencionar al tutor por su nombre. */
const OBJETIVOS: { tabla: string; columnas: string[] }[] = [
  { tabla: 'notificaciones', columnas: ['titulo', 'mensaje'] },
  { tabla: 'notas_docente', columnas: ['texto'] },
  { tabla: 'retos_usuario', columnas: ['feedback_docente'] },
  { tabla: 'logros', columnas: ['nombre', 'descripcion'] },
  { tabla: 'ejercicios', columnas: ['explicacion_ia'] },
  { tabla: 'configuracion_sistema', columnas: ['nombre_sistema'] },
];

/** ALVARO/Alvaro/ALEX/Alex como palabra completa. `Álvaro` (con tilde) NO entra. */
const PATRON_SQL = String.raw`\m(ALVARO|Alvaro|ALEX|Alex)\M`;

async function main() {
  console.log('\n══ RENOMBRADO DEL TUTOR EN LA BASE (ALVARO/ALEX → PREXI) ══');
  console.log(`   modo: ${APLICAR ? 'APLICAR (escribe)' : 'SIMULACIÓN (no escribe)'}\n`);

  interface Pendiente { tabla: string; columna: string; filas: number }
  const pendientes: Pendiente[] = [];

  for (const obj of OBJETIVOS) {
    for (const col of obj.columnas) {
      let filas: { n: bigint }[];
      try {
        filas = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*)::bigint AS n FROM "${obj.tabla}" WHERE "${col}" ~ $1`,
          PATRON_SQL,
        );
      } catch (e) {
        console.log(`  ✖ ${obj.tabla}.${col}: NO CONSULTABLE — ${(e as Error).message.split('\n').slice(-2).join(' ').slice(0, 120)}`);
        process.exitCode = 1;
        continue;
      }
      const n = Number(filas[0]?.n ?? 0);
      console.log(`  · ${`${obj.tabla}.${col}`.padEnd(38)} ${n} fila(s) con el nombre viejo`);
      if (n > 0) pendientes.push({ tabla: obj.tabla, columna: col, filas: n });
    }
  }

  if (pendientes.length === 0) {
    console.log('\n  ✔ No hay texto con el nombre viejo en la base. Nada que migrar.\n');
    return;
  }

  // Muestra concreta de lo que cambiaría, para poder revisarlo antes de escribir.
  console.log('\n── Muestra de los cambios ──');
  for (const p of pendientes) {
    const ejemplos = await prisma.$queryRawUnsafe<{ antes: string; despues: string }[]>(
      `SELECT "${p.columna}" AS antes, regexp_replace("${p.columna}", $1, 'PREXI', 'g') AS despues
       FROM "${p.tabla}" WHERE "${p.columna}" ~ $1 LIMIT 3`,
      PATRON_SQL,
    );
    console.log(`\n  ${p.tabla}.${p.columna} (${p.filas} fila(s))`);
    for (const e of ejemplos) {
      console.log(`     antes  : ${e.antes.slice(0, 150)}`);
      console.log(`     después: ${e.despues.slice(0, 150)}`);
    }
  }

  if (!APLICAR) {
    console.log('\n  SIMULACIÓN: no se escribió nada. Ejecuta con --aplicar para confirmar.\n');
    return;
  }

  let total = 0;
  await prisma.$transaction(
    async (tx) => {
      for (const p of pendientes) {
        total += await tx.$executeRawUnsafe(
          `UPDATE "${p.tabla}" SET "${p.columna}" = regexp_replace("${p.columna}", $1, 'PREXI', 'g') WHERE "${p.columna}" ~ $1`,
          PATRON_SQL,
        );
      }
    },
    { timeout: 120_000 },
  );
  console.log(`\n  ✔ ${total} fila(s) actualizadas en ${pendientes.length} columna(s).\n`);
}

main()
  .catch((e) => {
    console.error('✖ Falló la migración (la transacción se revierte entera):', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
