/**
 * REINICIO DE RESPUESTAS — deja a un grupo de cuentas como si nunca hubieran
 * respondido, para poder equilibrar la clave y que vuelvan a rendir el pretest
 * con el instrumento ya corregido.
 *
 *   npx tsx scripts/reiniciar-respuestas.ts                 → SIMULACIÓN
 *   npx tsx scripts/reiniciar-respuestas.ts --aplicar       → escribe
 *   npx tsx scripts/reiniciar-respuestas.ts --ids 1,2,3     → acota a esas cuentas
 *
 * Por qué hace falta borrar MÁS que `Intento` y `PretestRespuesta`: el resultado
 * del pretest NO se recalcula desde las respuestas, se lee de la `Evaluacion`
 * persistida. Si se borran solo las respuestas, el estudiante sigue viendo su
 * 100/100, sigue con `pretestCompletado = true` y conserva el nivel adaptativo
 * que le asignó el instrumento roto — que es justo lo que se quería anular.
 *
 * Por eso el reinicio es COHERENTE: respuestas, evaluaciones, diagnóstico por
 * tema, θ (histórico y persistida), progreso derivado y ranking. Todo lo que se
 * calculó a partir de respuestas que dejan de existir.
 *
 * LAS CUENTAS NO SE BORRAN. Se conservan el usuario, su correo, su
 * consentimiento y su fecha de registro: se borra lo que MIDIÓ mal, no a quien
 * fue medido.
 *
 * SIEMPRE respalda antes de escribir, a un JSON con marca de tiempo. Sin ese
 * archivo no se ejecuta el borrado.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const iIds = process.argv.indexOf('--ids');
const IDS = iIds >= 0 && process.argv[iIds + 1]
  ? process.argv[iIds + 1].split(',').map((s) => Number(s.trim())).filter(Number.isInteger)
  : null;

async function main() {
  console.log(`\n══ REINICIO DE RESPUESTAS ══  modo: ${APLICAR ? 'APLICAR (escribe)' : 'SIMULACIÓN'}`);

  const usuarios = await prisma.usuario.findMany({
    where: IDS
      ? { id: { in: IDS } }
      : { OR: [{ intentos: { some: {} } }, { pretestRespuestas: { some: {} } }] },
    select: {
      id: true, nombre: true, email: true, rol: true,
      pretestCompletado: true, nivelInicialAdaptativo: true, thetaInicial: true,
      _count: { select: { intentos: true, pretestRespuestas: true, evaluaciones: true } },
    },
    orderBy: { id: 'asc' },
  });

  if (usuarios.length === 0) {
    console.log('\n  ✔ No hay cuentas con respuestas. Nada que reiniciar.\n');
    return;
  }

  const ids = usuarios.map((u) => u.id);
  console.log(`   cuentas afectadas: ${ids.length}\n`);
  for (const u of usuarios) {
    console.log(`   #${String(u.id).padStart(3)} ${u.nombre.slice(0, 32).padEnd(32)} ${u.rol.padEnd(11)} ` +
      `int=${String(u._count.intentos).padStart(4)} pre=${String(u._count.pretestRespuestas).padStart(4)} ` +
      `ev=${String(u._count.evaluaciones).padStart(2)} nivel=${u.nivelInicialAdaptativo ?? '-'}`);
  }

  /* ── Qué se va a borrar, contado antes de tocar nada ── */
  const donde = { usuarioId: { in: ids } };
  const [intentos, pretest, evaluaciones, diagnosticos, thetas, pasos, subidas, examenes, repasos, progTema, progNivel, rankings] =
    await Promise.all([
      prisma.intento.count({ where: donde }),
      prisma.pretestRespuesta.count({ where: donde }),
      prisma.evaluacion.count({ where: donde }),
      prisma.diagnosticoTema.count({ where: donde }),
      prisma.historialTheta.count({ where: donde }),
      prisma.pasoRuta.count({ where: donde }),
      prisma.intentoSubidaNivel.count({ where: donde }),
      prisma.examenUnidad.count({ where: donde }),
      prisma.repasoUnidad.count({ where: donde }),
      prisma.progresoTema.count({ where: donde }),
      prisma.progresoNivel.count({ where: donde }),
      prisma.ranking.count({ where: donde }),
    ]);

  console.log('\n── Filas que se eliminan ──');
  const filas: [string, number][] = [
    ['Intento', intentos], ['PretestRespuesta', pretest], ['Evaluacion', evaluaciones],
    ['DiagnosticoTema', diagnosticos], ['HistorialTheta', thetas], ['PasoRuta', pasos],
    ['IntentoSubidaNivel', subidas], ['ExamenUnidad', examenes], ['RepasoUnidad', repasos],
    ['ProgresoTema', progTema], ['ProgresoNivel', progNivel], ['Ranking', rankings],
  ];
  for (const [n, c] of filas) console.log(`   ${n.padEnd(20)} ${String(c).padStart(5)}`);
  console.log(`   ${'TOTAL'.padEnd(20)} ${String(filas.reduce((a, [, c]) => a + c, 0)).padStart(5)}`);

  console.log('\n── Campos que se reinician en `usuarios` ──');
  console.log('   pretestCompletado → false · nivelInicialAdaptativo → null');
  console.log('   thetaInicial / thetaActual / thetaFinal → null');
  console.log('   introduccionCompletada y repasoPostestCompletado → false');
  console.log('   (nombre, correo, contraseña, consentimiento y fecha de registro: INTACTOS)');

  if (!APLICAR) {
    console.log('\n  SIMULACIÓN: no se escribió nada. Ejecuta con --aplicar para confirmar.\n');
    return;
  }

  /* ── Respaldo OBLIGATORIO antes de escribir ── */
  const dir = path.join(__dirname, '..', '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `respaldo-respuestas-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const respaldo = {
    generado: new Date().toISOString(),
    usuarios,
    intentos: await prisma.intento.findMany({ where: donde }),
    pretestRespuestas: await prisma.pretestRespuesta.findMany({ where: donde }),
    evaluaciones: await prisma.evaluacion.findMany({ where: donde }),
    diagnosticoTemas: await prisma.diagnosticoTema.findMany({ where: donde }),
    historialTheta: await prisma.historialTheta.findMany({ where: donde }),
    intentosSubidaNivel: await prisma.intentoSubidaNivel.findMany({ where: donde }),
    examenesUnidad: await prisma.examenUnidad.findMany({ where: donde }),
    progresoTemas: await prisma.progresoTema.findMany({ where: donde }),
    progresoNiveles: await prisma.progresoNivel.findMany({ where: donde }),
    rankings: await prisma.ranking.findMany({ where: donde }),
  };
  fs.writeFileSync(archivo, JSON.stringify(respaldo, null, 2));
  console.log(`\n  ✔ Respaldo escrito: ${path.relative(process.cwd(), archivo)}`);
  console.log(`    (${(fs.statSync(archivo).size / 1024).toFixed(1)} KB · la carpeta backups/ está en .gitignore)`);

  await prisma.$transaction(
    async (tx) => {
      // El orden importa donde hay claves foráneas: primero lo que depende.
      await tx.pasoRuta.deleteMany({ where: donde });
      await tx.historialTheta.deleteMany({ where: donde });
      await tx.diagnosticoTema.deleteMany({ where: donde });
      await tx.intentoSubidaNivel.deleteMany({ where: donde });
      await tx.examenUnidad.deleteMany({ where: donde });
      await tx.repasoUnidad.deleteMany({ where: donde });
      await tx.intento.deleteMany({ where: donde });
      await tx.pretestRespuesta.deleteMany({ where: donde });
      await tx.evaluacion.deleteMany({ where: donde });
      await tx.progresoTema.deleteMany({ where: donde });
      await tx.progresoNivel.deleteMany({ where: donde });
      await tx.ranking.deleteMany({ where: donde });
      await tx.usuario.updateMany({
        where: { id: { in: ids } },
        data: {
          pretestCompletado: false,
          nivelInicialAdaptativo: null,
          thetaInicial: null,
          thetaActual: null,
          thetaFinal: null,
          introduccionCompletada: false,
          repasoPostestCompletado: false,
        },
      });
    },
    { timeout: 120_000 },
  );

  console.log(`\n  ✔ ${ids.length} cuenta(s) reiniciadas. Ninguna cuenta fue borrada.\n`);
}

main()
  .catch((e) => { console.error('✖ Falló el reinicio (la transacción se revierte entera):', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
