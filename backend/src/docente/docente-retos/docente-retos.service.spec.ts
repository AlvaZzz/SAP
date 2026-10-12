import { BadRequestException } from '@nestjs/common';
import { DocenteRetosService } from './docente-retos.service';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';

describe('DocenteRetosService (asociación de tema)', () => {
  let prisma: PrismaMock;
  let service: DocenteRetosService;
  let proponerRetos: jest.Mock;

  beforeEach(() => {
    prisma = crearPrismaMock();
    proponerRetos = jest.fn();
    service = new DocenteRetosService(prisma as never, { proponerRetos } as never);
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
  describe('nivel y retos de «Encuentra el bug»', () => {
    it('el nivel del reto sale de la dificultad elegida (decide a quién se le muestra)', async () => {
      await service.crear(7, { ...(baseCrear as object), estrellas: 4 } as never);
      expect(prisma.reto.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ nivelDificultad: 'avanzado' }) }),
      );
    });

    it('un bug sin código con el error es rechazado', async () => {
      await expect(service.crear(7, { ...(baseCrear as object), esBugHunt: true, ejemploSalida: '15' } as never))
        .rejects.toThrow(BadRequestException);
    });

    it('un bug sin salida correcta es rechazado: no habría contra qué corregir', async () => {
      await expect(service.crear(7, { ...(baseCrear as object), esBugHunt: true, codigoInicial: 'print(1)' } as never))
        .rejects.toThrow(BadRequestException);
      expect(prisma.reto.create).not.toHaveBeenCalled();
    });

    it('un bug completo se guarda', async () => {
      await service.crear(7, { ...(baseCrear as object), esBugHunt: true, codigoInicial: 'print(1)', ejemploSalida: '2' } as never);
      expect(prisma.reto.create).toHaveBeenCalled();
    });

    it('convertir un reto existente en bug exige que ya tenga código y salida', async () => {
      prisma.reto.findUnique.mockResolvedValue({ id: 1, autorId: 7, esBugHunt: false, codigoInicial: null, ejemploSalida: null });
      await expect(service.editar(1, 7, { esBugHunt: true } as never)).rejects.toThrow(BadRequestException);
    });
  });
});

describe('DocenteRetosService · propuestas de PREXI', () => {
  it('ubica el subtema en su tema y su unidad, y no guarda nada', async () => {
    const prisma = crearPrismaMock();
    const proponerRetos = jest.fn().mockResolvedValue([{ titulo: 'Reto' }]);
    const service = new DocenteRetosService(prisma as never, { proponerRetos } as never);
    prisma.tema.findUnique.mockResolvedValue({
      id: 9, numero: '1.5.2', titulo: 'Operadores', descripcion: 'Aritméticos y lógicos',
      unidad: { numero: 1, titulo: 'Fundamentos' }, padre: { numero: '1.5', titulo: 'Tipos de datos' },
    });
    const r = await service.sugerir({ tipo: 'bug', temaId: 9, nivel: 'intermedio', indicacion: 'con notas' });
    expect(proponerRetos).toHaveBeenCalledWith({
      tipo: 'bug', nivel: 'intermedio', cantidad: 3,
      unidad: 'Unidad 1: Fundamentos', tema: '1.5.2 Operadores', temaPadre: '1.5 Tipos de datos',
      descripcion: 'Aritméticos y lógicos', indicacion: 'con notas',
    });
    expect(r.propuestas).toHaveLength(1);
    expect(prisma.reto.create).not.toHaveBeenCalled();
  });

  it('rechaza un tema que no existe sin llamar a la IA', async () => {
    const prisma = crearPrismaMock();
    const proponerRetos = jest.fn();
    const service = new DocenteRetosService(prisma as never, { proponerRetos } as never);
    prisma.tema.findUnique.mockResolvedValue(null);
    await expect(service.sugerir({ tipo: 'codigo', temaId: 404, nivel: 'basico' })).rejects.toThrow(BadRequestException);
    expect(proponerRetos).not.toHaveBeenCalled();
  });
});
