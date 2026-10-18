import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminCursosService } from './admin-cursos.service';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';

describe('AdminCursosService (cursos y docentes)', () => {
  let prisma: PrismaMock;
  let service: AdminCursosService;
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    prisma = crearPrismaMock();
    auditoria.registrar.mockClear();
    service = new AdminCursosService(prisma as never, auditoria as never);
    prisma.paralelo.findUnique.mockResolvedValue({ id: 3, nombre: 'A', materia: { nombre: 'Programación I', gestion: '2026-II' }, docente: null });
  });

  it('asigna un docente activo y lo deja en la auditoría', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ nombre: 'Ana Docente', rol: 'docente', activo: true });
    await service.asignarDocente(1, 3, 9);
    expect(prisma.paralelo.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { docenteId: 9 } });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'paralelo_docente', detalle: expect.stringContaining('sin docente → Ana Docente') }));
  });

  it('no deja poner a un estudiante ni a una cuenta desactivada como docente', async () => {
    prisma.usuario.findUnique.mockResolvedValueOnce({ nombre: 'Juan', rol: 'estudiante', activo: true });
    await expect(service.asignarDocente(1, 3, 5)).rejects.toThrow(BadRequestException);
    prisma.usuario.findUnique.mockResolvedValueOnce({ nombre: 'Ana', rol: 'docente', activo: false });
    await expect(service.asignarDocente(1, 3, 9)).rejects.toThrow(/desactivada/);
    expect(prisma.paralelo.update).not.toHaveBeenCalled();
  });

  it('permite dejar el paralelo sin docente (null)', async () => {
    await service.asignarDocente(1, 3, null);
    expect(prisma.paralelo.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { docenteId: null } });
  });

  it('el nombre del paralelo se normaliza ("par. b" → "B") y no se repite', async () => {
    prisma.materia.findUnique.mockResolvedValue({ id: 2, nombre: 'Programación I', gestion: '2026-II' });
    prisma.paralelo.findUnique.mockResolvedValueOnce(null);
    prisma.paralelo.create.mockResolvedValue({ id: 8 });
    await service.crearParalelo(1, { materiaId: 2, nombre: 'par. b' });
    expect(prisma.paralelo.create).toHaveBeenCalledWith({ data: { materiaId: 2, nombre: 'B', docenteId: null } });

    prisma.paralelo.findUnique.mockResolvedValueOnce({ id: 8 });
    await expect(service.crearParalelo(1, { materiaId: 2, nombre: 'B' })).rejects.toThrow(ConflictException);
  });

  it('la gestión de una materia debe tener la forma 2026-I / 2026-II', async () => {
    await expect(service.crearMateria(1, { nombre: 'Programación I', gestion: '2026' })).rejects.toThrow(/2026-I/);
  });
});
