/**
 * Asigna un PARALELO COMPLETO a un grupo de investigación, replicando lo que
 * hace AdminGruposService.asignarPorParalelo (incluida la entrada en
 * LogAuditoria), para poder hacerlo contra producción sin credenciales de admin.
 *
 *   npx tsx scripts/asignar-paralelo.ts A control            → SIMULACIÓN
 *   npx tsx scripts/asignar-paralelo.ts A control --aplicar  → escribe
 *
 * Por paralelo COMPLETO y no estudiante a estudiante: si compañeros de la misma
 * aula quedan en grupos distintos se cuentan lo que ven y el experimento se
 * contamina. La asignación por conglomerado lo evita.
 */
import { PrismaClient, Grupo } from '@prisma/client';
const prisma = new PrismaClient();
const [paraleloArg, grupoArg] = process.argv.slice(2);
const APLICAR = process.argv.includes('--aplicar');

async function main() {
  if (!paraleloArg || !['control', 'experimental'].includes(grupoArg ?? '')) {
    console.error('uso: asignar-paralelo.ts <PARALELO> <control|experimental> [--aplicar]');
    process.exit(1);
  }
  const paralelo = paraleloArg.trim().toUpperCase();
  const grupo = grupoArg as Grupo;

  const cfg = await prisma.configuracionSistema.findUnique({ where: { id: 1 }, select: { gruposBloqueados: true } });
  if (cfg?.gruposBloqueados) {
    console.error('\n✖ Los grupos están BLOQUEADOS. Desbloquéalos en el panel de admin antes de reasignar.\n');
    process.exit(1);
  }

  const est = await prisma.usuario.findMany({
    where: { rol: 'estudiante', paralelo },
    select: { id: true, nombre: true, grupo: true, consentimientoEn: true },
    orderBy: { id: 'asc' },
  });

  console.log(`\n══ PARALELO "${paralelo}" → grupo ${grupo.toUpperCase()} ══  ${APLICAR ? '(APLICA)' : '(SIMULACIÓN)'}\n`);
  if (est.length === 0) {
    console.log(`  No hay estudiantes en el paralelo "${paralelo}". Nada que asignar.\n`);
    return;
  }
  for (const u of est) {
    const cambia = u.grupo !== grupo;
    console.log(`  #${String(u.id).padStart(3)} ${u.nombre.slice(0, 30).padEnd(30)} ${u.grupo} → ${grupo}` +
      `${cambia ? '' : '  (sin cambio)'}${u.consentimientoEn ? '' : '  · SIN CONSENTIMIENTO'}`);
  }

  if (!APLICAR) {
    console.log('\n  SIMULACIÓN: no se escribió nada. Añade --aplicar.\n');
    return;
  }

  const admin = await prisma.usuario.findFirst({ where: { rol: 'admin' }, select: { id: true, email: true } });
  if (!admin) { console.error('\n✖ No hay ningún usuario admin para registrar la auditoría.\n'); process.exit(1); }

  await prisma.$transaction(async (tx) => {
    await tx.usuario.updateMany({ where: { id: { in: est.map((e) => e.id) } }, data: { grupo } });
    await tx.logAuditoria.create({
      data: {
        actorId: admin.id, accion: 'grupo_cambiar', entidad: 'grupo',
        detalle: `Asignó el paralelo "${paralelo}" completo (${est.length} estudiantes) al grupo ${grupo} [vía scripts/asignar-paralelo.ts]`,
      },
    });
  });
  console.log(`\n  ✔ ${est.length} estudiante(s) asignados a ${grupo}. Auditoría registrada (actor: ${admin.email}).\n`);
}
main().catch((e) => { console.error('✖', e.message); process.exit(1); }).finally(() => prisma.$disconnect());
