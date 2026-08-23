/**
 * TOPE DE XP DEL CONTENIDO — ajusta los ítems que superan el máximo vigente.
 *
 *   npx tsx scripts/topar-xp.ts            → SIMULACIÓN (no escribe)
 *   npx tsx scripts/topar-xp.ts --aplicar  → escribe (en transacción)
 *
 * Por qué hace falta: el DTO del docente aceptaba hasta 500 XP por ejercicio,
 * veinte veces por encima del ítem más generoso del banco. Ese rango no validaba
 * nada. Al bajar el techo a 25, el contenido ya sembrado que lo supera quedaría
 * imposible de editar: el docente abriría un ejercicio de 50 XP, cambiaría el
 * enunciado y recibiría un error por un campo que no tocó. Este script alinea el
 * contenido con el techo para que eso no ocurra.
 *
 * NO ES RETROACTIVO PARA NADIE. El XP se acumula al responder
 * (`Ranking.xpTotal: { increment: xpOtorgado }`) y cada `Intento` guarda el
 * `xpOtorgado` con el que se calificó en su momento. Cambiar el XP de un
 * ejercicio afecta solo a los intentos FUTUROS: ningún estudiante pierde puntos
 * ya ganados ni se mueve el ranking.
 *
 * SE APLICA UN TOPE, NO UN REESCALADO. `xp = min(xp, 25)` toca solo a los ítems
 * por encima del techo y deja intacto al resto. La contrapartida, que conviene
 * conocer: los que estaban en 30, 40 y 50 quedan todos en 25, así que se pierde
 * el gradiente de recompensa en la franja alta. Reescalar en proporción lo
 * conservaría, pero movería el XP de TODO el banco, incluido el que ya cumple.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const iMax = process.argv.indexOf('--max');
const XP_MAX = iMax >= 0 && process.argv[iMax + 1] ? Number(process.argv[iMax + 1]) : 25;

async function main() {
  if (!Number.isInteger(XP_MAX) || XP_MAX < 1) {
    console.error('✖ --max debe ser un entero positivo.');
    process.exit(1);
  }
  console.log(`\n══ TOPE DE XP DEL CONTENIDO ══  máximo: ${XP_MAX} · modo: ${APLICAR ? 'APLICAR' : 'SIMULACIÓN'}\n`);

  const [ejercicios, retos] = await Promise.all([
    prisma.ejercicio.findMany({
      where: { xp: { gt: XP_MAX } },
      select: { id: true, banco: true, xp: true, titulo: true, activo: true },
      orderBy: [{ banco: 'asc' }, { xp: 'desc' }],
    }),
    prisma.reto.findMany({
      where: { xp: { gt: XP_MAX } },
      select: { id: true, xp: true, titulo: true, activo: true },
      orderBy: { xp: 'desc' },
    }),
  ]);

  if (ejercicios.length === 0 && retos.length === 0) {
    console.log(`  ✔ Nada supera los ${XP_MAX} XP. No hay que ajustar.\n`);
    return;
  }

  const porBanco = new Map<string, { n: number; max: number }>();
  for (const e of ejercicios) {
    const v = porBanco.get(e.banco) ?? { n: 0, max: 0 };
    v.n++; v.max = Math.max(v.max, e.xp);
    porBanco.set(e.banco, v);
  }

  console.log('── Ejercicios por encima del tope ──');
  for (const [banco, v] of [...porBanco.entries()].sort()) {
    console.log(`   ${banco.padEnd(10)} ${String(v.n).padStart(4)} ítem(s) · el más alto tenía ${v.max} XP → ${XP_MAX}`);
  }
  console.log(`   ${'TOTAL'.padEnd(10)} ${String(ejercicios.length).padStart(4)}`);
  console.log(`\n── Retos por encima del tope: ${retos.length} ──`);
  for (const r of retos.slice(0, 6)) console.log(`   #${r.id} "${r.titulo.slice(0, 40)}" ${r.xp} → ${XP_MAX}`);
  if (retos.length > 6) console.log(`   … y ${retos.length - 6} más`);

  console.log('\n  Ningún estudiante pierde XP ya ganado: el XP se acumula al responder');
  console.log('  y cada intento conserva el `xpOtorgado` con el que se calificó.');

  if (!APLICAR) {
    console.log('\n  SIMULACIÓN: no se escribió nada. Ejecuta con --aplicar para confirmar.\n');
    return;
  }

  const [e, r] = await prisma.$transaction([
    prisma.ejercicio.updateMany({ where: { xp: { gt: XP_MAX } }, data: { xp: XP_MAX } }),
    prisma.reto.updateMany({ where: { xp: { gt: XP_MAX } }, data: { xp: XP_MAX } }),
  ]);
  console.log(`\n  ✔ ${e.count} ejercicio(s) y ${r.count} reto(s) ajustados a ${XP_MAX} XP.\n`);
}

main()
  .catch((err) => { console.error('✖ Falló el ajuste:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
