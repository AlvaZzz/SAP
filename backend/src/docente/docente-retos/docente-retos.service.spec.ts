import { BadRequestException } from '@nestjs/common';
import { DocenteRetosService } from './docente-retos.service';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';

describe('DocenteRetosService (asociación de tema)', () => {
  let prisma: PrismaMock;
  let service: DocenteRetosService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new DocenteRetosService(prisma as never);
    prisma.nivel.findUnique.mockResolvedValue(null);
    prisma.reto.create.mockResolvedValue({ id: 1 });
    prisma.reto.update.mockResolvedValue({ id: 1 });
    prisma.reto.findUnique.mockResolvedValue({ id: 1, autorId: 7 });
  });

  const baseCrear = {
    titulo: 'Reto', categoria: 'Bucles', estrellas: 3, enunciado: 'Haz algo', xp: 50,
  } as never;

  it('crear con un tema INEXISTENTE es rechazado', async () => {
    prisma.tema.findUnique.mockResolvedValue(null);
    await expect(service.crear(7, { ...(baseCrear as object), temaId: 999 } as never))
      .rejects.toThrow(BadRequestException);
    expect(prisma.reto.create).not.toHaveBeenCalled();
  });

  it('crear con un tema VÁLIDO guarda temaId', async () => {
    prisma.tema.findUnique.mockResolvedValue({ id: 5 });
    await service.crear(7, { ...(baseCrear as object), temaId: 5 } as never);
    expect(prisma.reto.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ temaId: 5 }) }),
    );
  });

  it('crear SIN tema guarda temaId null (queda en "General")', async () => {
    await service.crear(7, baseCrear);
    expect(prisma.tema.findUnique).not.toHaveBeenCalled();
    expect(prisma.reto.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ temaId: null }) }),
    );
  });

  it('editar con temaId=null DESASIGNA el tema', async () => {
    await service.editar(1, 7, { temaId: null } as never);
    expect(prisma.reto.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ temaId: null }) }),
    );
  });

  it('editar sin tocar temaId NO cambia el campo', async () => {
    await service.editar(1, 7, { titulo: 'Nuevo' } as never);
    const arg = prisma.reto.update.mock.calls[0][0];
    expect(arg.data).not.toHaveProperty('temaId');
  });
});
