import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();
(async () => {
  const existe = await prisma.usuario.findUnique({ where: { email: 'juan@upea.edu.bo' } });
  if (existe) { console.log('ya existe #' + existe.id); return; }
  const u = await prisma.usuario.create({
    data: {
      nombre: 'Juan Mamani', email: 'juan@upea.edu.bo', cedula: '8001001',
      rol: 'estudiante', carrera: 'Ingeniería de Sistemas',
      passwordHash: await bcrypt.hash('Prexi123*', 10),
      introduccionCompletada: true, repasoPostestCompletado: true,
      pretestCompletado: true, grupo: 'control', institucion: 'UPEA',
    },
  });
  console.log('creado #' + u.id + ' ' + u.email);
})().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
