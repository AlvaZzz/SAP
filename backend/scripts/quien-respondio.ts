/**
 * QUIÉN HA RESPONDIDO — inventario de las cuentas con datos registrados.
 *
 *   npx tsx scripts/quien-respondio.ts
 *
 * Solo lectura. Existe para poder decidir, con datos delante, qué cuentas son
 * de prueba y cuáles son participantes reales antes de una operación
 * destructiva (descartar respuestas para poder equilibrar la clave).
 *
 * Lo que importa mirar, y por qué:
 *   · consentimiento — sin él la cuenta NO puede formar parte del estudio, así
 *     que sus respuestas no son datos de investigación.
 *   · paralelo e institución — un participante real pertenece a un paralelo del
 *     curso; las cuentas de prueba suelen no tenerlo o tener uno inventado.
 *   · evaluaciones — un pretest COMPLETADO (fila en Evaluacion) es un dato del
 *     estudio; respuestas sueltas sin evaluación suelen ser una prueba a medias.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const us = await prisma.usuario.findMany({
    where: { OR: [{ intentos: { some: {} } }, { pretestRespuestas: { some: {} } }] },
    select: {
      id: true, nombre: true, email: true, rol: true, paralelo: true, grupo: true,
      institucion: true, consentimientoEn: true, creadoEn: true, pretestCompletado: true,
      _count: { select: { intentos: true, pretestRespuestas: true, evaluaciones: true } },
    },
    orderBy: { id: 'asc' },
  });

  console.log(`\n══ CUENTAS CON DATOS REGISTRADOS EN ESTA BASE (${us.length}) ══\n`);
  const cab = ['id', 'nombre', 'correo', 'rol', 'par', 'inst', 'consent', 'creada', 'int', 'pre', 'ev'];
  console.log(cab[0].padStart(3) + ' | ' + cab[1].padEnd(30) + ' | ' + cab[2].padEnd(34) + ' | ' +
    cab[3].padEnd(11) + ' | ' + cab[4].padEnd(3) + ' | ' + cab[5].padEnd(5) + ' | ' +
    cab[6].padEnd(10) + ' | ' + cab[7].padEnd(10) + ' | ' + cab[8].padStart(4) + ' | ' +
    cab[9].padStart(4) + ' | ' + cab[10].padStart(3));
  console.log('─'.repeat(140));

  for (const u of us) {
    console.log(
      String(u.id).padStart(3) + ' | ' +
      u.nombre.slice(0, 30).padEnd(30) + ' | ' +
      u.email.slice(0, 34).padEnd(34) + ' | ' +
      u.rol.padEnd(11) + ' | ' +
      String(u.paralelo ?? '-').padEnd(3) + ' | ' +
      String(u.institucion ?? '-').slice(0, 5).padEnd(5) + ' | ' +
      (u.consentimientoEn ? u.consentimientoEn.toISOString().slice(0, 10) : 'NO').padEnd(10) + ' | ' +
      u.creadoEn.toISOString().slice(0, 10).padEnd(10) + ' | ' +
      String(u._count.intentos).padStart(4) + ' | ' +
      String(u._count.pretestRespuestas).padStart(4) + ' | ' +
      String(u._count.evaluaciones).padStart(3),
    );
  }

  const conConsent = us.filter((u) => u.consentimientoEn);
  const conEval = us.filter((u) => u._count.evaluaciones > 0);
  console.log('\n── Resumen ──');
  console.log(`  Cuentas con datos           : ${us.length}`);
  console.log(`  Con consentimiento firmado  : ${conConsent.length}`);
  console.log(`  Con alguna evaluación (pre/post) cerrada: ${conEval.length}`);
  console.log(`  Total intentos              : ${us.reduce((a, u) => a + u._count.intentos, 0)}`);
  console.log(`  Total respuestas de pretest : ${us.reduce((a, u) => a + u._count.pretestRespuestas, 0)}`);
  console.log('');
}

main()
  .catch((e) => { console.error('✖', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
