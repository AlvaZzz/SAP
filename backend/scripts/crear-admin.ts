/**
 * Crea (o promueve) el PRIMER ADMINISTRADOR en producción.
 *
 * Uso:
 *   npm run crear-admin -- --nombre "Nombre Apellido" --email admin@dominio.bo --password "ClaveSegura123*"
 *
 * Si el correo ya existe, solo lo promueve a admin (no cambia su contraseña
 * salvo que se pase --password).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const nombre = arg('nombre') ?? 'Administrador PREXI';
  const email = arg('email');
  const password = arg('password');
  if (!email) {
    console.error('Falta --email. Ejemplo:\n  npm run crear-admin -- --nombre "Ana Pérez" --email ana@dominio.bo --password "ClaveSegura123*"');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      await prisma.usuario.update({
        where: { email },
        data: { rol: 'admin', activo: true, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
      });
      console.log(`✔ Usuario ${email} promovido a admin${password ? ' (contraseña actualizada)' : ''}.`);
    } else {
      if (!password || password.length < 6) {
        console.error('Para crear un admin nuevo pasa --password con al menos 6 caracteres.');
        process.exit(1);
      }
      await prisma.usuario.create({
        data: { nombre, email, rol: 'admin', passwordHash: await bcrypt.hash(password, 10), pretestCompletado: true },
      });
      console.log(`✔ Admin ${email} creado.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
