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
 *   · Cualquier tabla no listada.
 *
 * La sustitución es por PALABRA COMPLETA y solo de las formas en mayúsculas o
 * capitalizadas del NOMBRE del tutor (ALVARO / Alvaro / ALEX / Alex). No toca
 * "Álvaro" (con tilde), que en el sistema solo aparece como nombre de pila.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');

/** Tablas y columnas de TEXTO que pueden mencionar al tutor por su nombre. */
const OBJETIVOS: { modelo: string; tabla: string; columnas: string[] }[] = [
  { modelo: 'notificacion', tabla: 'notificaciones', columnas: ['titulo', 'mensaje'] },
  { modelo: 'notaDocente', tabla: 'notas_docente', columnas: ['texto'] },
  { modelo: 'retoUsuario', tabla: 'retos_usuario', columnas: ['feedback'] },
  { modelo: 'logro', tabla: 'logros', columnas: ['nombre', 'descripcion'] },
  { modelo: 'ejercicio', tabla: 'ejercicios', columnas: ['explicacionIa', 'explicacionBase'] },
  { modelo: 'configuracionSistema', tabla: 'configuracion_sistema', columnas: ['nombreSistema'] },
];

/** ALVARO/Alvaro/ALEX/Alex como palabra completa. `Álvaro` (con tilde) NO entra. */
const PATRON = /\b(ALVARO|Alvaro|ALEX|Alex)\b/g;
const renombrar = (t: string) => t.replace(PATRON, (m) => (m === m.toUpperCase() ? 'PREXI' : 'PREXI'));

async function main() {
  console.log(`\n══ RENOMBRADO DEL TUTOR EN LA BASE (ALVARO/ALEX → PREXI) ══`);
  console.log(`   modo: ${APLICAR ? 'APLICAR (escribe)' : 'SIMULACIÓN (no escribe)'}\n`);

  let totalFilas = 0;
  const escrituras: { tabla: string; columna: string; id: unknown; antes: string; despues: string }[] = [];

  for (const obj of OBJETIVOS) {
    for (const col of obj.columnas) {
      // Se consulta por SQL crudo para no depender de que cada modelo tenga `id`
      // (ConfiguracionSistema tiene id fijo 1) ni de los nombres del cliente.
      const columnaSql = col.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
      let filas: { id: unknown; valor: string }[] = [];
      try {
        filas = await prisma.$queryRawUnsafe<{ id: unknown; valor: string }[]>(
          `SELECT id, "${columnaSql}" AS valor FROM "${obj.tabla}" WHERE "${columnaSql}" ~ '\\m(ALVARO|Alvaro|ALEX|Alex)\\M'`,
        );
      } catch (e) {
        console.log(`  · ${obj.tabla}.${col}: no consultable (${(e as Error).message.split('\n')[0]})`);
        continue;
      }
      for (const f of filas) {
        const despues = renombrar(f.valor);
        if (despues !== f.valor) escrituras.push({ tabla: obj.tabla, columna: columnaSql, id: f.id, antes: f.valor, despues });
      }
      if (filas.length) console.log(`  · ${obj.tabla}.${col}: ${filas.length} fila(s) con el nombre viejo`);
      totalFilas += filas.length;
    }
  }

  if (escrituras.length === 0) {
    console.log('\n  ✔ No hay texto con el nombre viejo en la base. Nada que migrar.\n');
    return;
  }

  console.log(`\n── Cambios propuestos (${escrituras.length}) ──`);
  for (const e of escrituras.slice(0, 30)) {
    console.log(`  ${e.tabla}#${e.id} · ${e.columna}`);
    console.log(`     antes  : ${e.antes.slice(0, 140)}`);
    console.log(`     después: ${e.despues.slice(0, 140)}`);
  }
  if (escrituras.length > 30) console.log(`  … y ${escrituras.length - 30} más`);

  if (!APLICAR) {
    console.log('\n  SIMULACIÓN: no se escribió nada. Ejecuta con --aplicar para confirmar.\n');
    return;
  }

  await prisma.$transaction(
    escrituras.map((e) =>
      prisma.$executeRawUnsafe(`UPDATE "${e.tabla}" SET "${e.columna}" = $1 WHERE id = $2`, e.despues, e.id),
    ),
    { timeout: 120_000 },
  );
  console.log(`\n  ✔ ${escrituras.length} valores actualizados (${totalFilas} filas revisadas).\n`);
}

main()
  .catch((e) => {
    console.error('✖ Falló la migración (la transacción se revierte entera):', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
