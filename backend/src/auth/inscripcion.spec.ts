import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { DocenteRegistroService } from '../docente/docente-registro/docente-registro.service';
import { estudiantesDelDocente } from '../docente/docente-registro/docente-registro.service';
import { crearPrismaMock, PrismaMock } from '../test-utils/prisma.mock';

/**
 * INSCRIPCIÓN POR SOLICITUD — el estudiante que se registra solo no entra al
 * curso hasta que el docente del paralelo lo acepta.
 */
describe('Registro por cuenta propia → solicitud de inscripción', () => {
  let prisma: PrismaMock;
  let auth: AuthService;
  const base = { apellidoPaterno: 'Quispe', apellidoMaterno: 'Mamani', nombres: 'Ana', cedula: '9876543', ru: '200099001', password: 'secreta123', paraleloId: 4, aceptaTerminos: true };
  const creado = () => (prisma.usuario.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;

  beforeEach(() => {
    prisma = crearPrismaMock();
    auth = new AuthService(prisma as never, new JwtService({ secret: 'test' }), {} as never, {} as never);
    prisma.usuario.findUnique.mockResolvedValue(null);
    prisma.usuario.findFirst.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({ id: 1, rol: 'estudiante' });
    prisma.paralelo.findUnique.mockResolvedValue({ id: 4, nombre: 'A' });
  });

  it('con paralelo elegido, la cuenta nace PENDIENTE y enlazada a ese paralelo', async () => {
    await auth.register(base as never);
    expect(creado()).toMatchObject({
      nombre: 'Quispe Mamani Ana', apellidoPaterno: 'Quispe', nombres: 'Ana', ru: '200099001',
      paraleloId: 4, paralelo: 'A', estadoInscripcion: 'pendiente', email: null,
    });
    expect(creado().inscripcionSolicitada).toBeInstanceOf(Date);
  });

  it('el correo es opcional: basta el RU para iniciar sesión', async () => {
    await expect(auth.register(base as never)).resolves.toBeTruthy();
  });

  it('rechaza un RU que ya existe (probablemente ya lo registró su docente)', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ id: 7 });
    await expect(auth.register(base as never)).rejects.toThrow('Ya existe un usuario con ese RU');
    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });

  it('rechaza un paralelo que no existe', async () => {
    prisma.paralelo.findUnique.mockResolvedValue(null);
    await expect(auth.register(base as never)).rejects.toThrow('El curso elegido ya no existe');
  });

  it('un rechazado puede volver a pedir inscripción en otro paralelo', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ rol: 'estudiante', estadoInscripcion: 'rechazada' });
    prisma.paralelo.findUnique.mockResolvedValue({ id: 5, nombre: 'B' });
    prisma.usuario.update.mockResolvedValue({ id: 1 });
    await auth.solicitarInscripcion(1, 5);
    expect(prisma.usuario.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ paraleloId: 5, paralelo: 'B', estadoInscripcion: 'pendiente', inscripcionMotivo: null }),
    }));
  });

  it('quien ya fue aceptado no puede volver a solicitar', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ rol: 'estudiante', estadoInscripcion: 'aprobada' });
    await expect(auth.solicitarInscripcion(1, 5)).rejects.toThrow('ya fue aceptada');
  });
});

describe('El docente resuelve las solicitudes', () => {
  let prisma: PrismaMock;
  let service: DocenteRegistroService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new DocenteRegistroService(prisma as never, {} as never);
    prisma.usuario.findFirst.mockResolvedValue({ id: 30, paraleloId: 4 });
    prisma.usuario.update.mockResolvedValue({ id: 30 });
  });

  it('las listas del curso solo cuentan a los ya aceptados', () => {
    expect(estudiantesDelDocente(9, 'docente')).toMatchObject({ estadoInscripcion: 'aprobada' });
    expect(estudiantesDelDocente(1, 'admin')).toMatchObject({ estadoInscripcion: 'aprobada' });
  });

  it('aceptar deja al estudiante aprobado en el paralelo que pidió', async () => {
    prisma.paralelo.findUnique.mockResolvedValue({ id: 4, nombre: 'A', docenteId: 9 });
    await service.aceptarSolicitud(30, 9, 'docente');
    expect(prisma.usuario.update).toHaveBeenCalledWith({ where: { id: 30 }, data: { estadoInscripcion: 'aprobada', inscripcionMotivo: null, paraleloId: 4, paralelo: 'A' } });
  });

  it('puede aceptarlo en OTRO de sus paralelos', async () => {
    prisma.paralelo.findUnique.mockResolvedValue({ id: 6, nombre: 'C', docenteId: 9 });
    await service.aceptarSolicitud(30, 9, 'docente', 6);
    expect(prisma.usuario.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paraleloId: 6, paralelo: 'C' }) }));
  });

  it('no puede meterlo en el paralelo de otro docente', async () => {
    prisma.paralelo.findUnique.mockResolvedValue({ id: 8, nombre: 'D', docenteId: 55 });
    await expect(service.aceptarSolicitud(30, 9, 'docente', 8)).rejects.toThrow('tus propios paralelos');
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('rechazar guarda el motivo que verá el estudiante', async () => {
    await service.rechazarSolicitud(30, 9, 'docente', '  No perteneces a este paralelo ');
    expect(prisma.usuario.update).toHaveBeenCalledWith({ where: { id: 30 }, data: { estadoInscripcion: 'rechazada', inscripcionMotivo: 'No perteneces a este paralelo' } });
  });

  it('una solicitud ajena o ya resuelta no se puede tocar', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    await expect(service.rechazarSolicitud(30, 9, 'docente')).rejects.toThrow('ya fue resuelta');
  });
});
