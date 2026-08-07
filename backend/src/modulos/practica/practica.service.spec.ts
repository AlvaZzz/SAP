import { BadRequestException } from '@nestjs/common';
import { PracticaService } from './practica.service';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';

/**
 * La ejecución de Python se movió al NAVEGADOR (Pyodide). Aquí ya no se ejecuta
 * nada: el servicio solo persiste el código/salida y compara contra la salida
 * esperada del reto, SIN otorgar XP (la salida la produce el cliente y sería
 * falsificable — ver PracticaService.comprobarReto).
 */
describe('PracticaService (sin ejecución en servidor)', () => {
  let prisma: PrismaMock;
  let service: PracticaService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new PracticaService(prisma as never, {} as never);
  });

  describe('comprobarReto (autocomprobación)', () => {
    const reto = { id: 5, esBugHunt: true, autoCalificable: false, ejemploSalida: '15' };

    it('rechaza un reto que no es autocalificable ni bug-hunt', async () => {
      prisma.reto.findFirst.mockResolvedValue({ ...reto, esBugHunt: false, autoCalificable: false });
      await expect(service.comprobarReto(5, '15')).rejects.toThrow(BadRequestException);
    });

    it('marca CORRECTO si la salida del navegador coincide (ignorando espacios al borde)', async () => {
      prisma.reto.findFirst.mockResolvedValue(reto);
      const r = await service.comprobarReto(5, '15\n');
      expect(r.correcto).toBe(true);
      expect(r.esperado).toBe('15');
    });

    it('marca INCORRECTO si no coincide', async () => {
      prisma.reto.findFirst.mockResolvedValue(reto);
      const r = await service.comprobarReto(5, '14');
      expect(r.correcto).toBe(false);
    });

    it('NUNCA otorga XP ni emblemas, ni siquiera acertando', async () => {
      prisma.reto.findFirst.mockResolvedValue(reto);
      const r = await service.comprobarReto(5, '15');
      expect(r.correcto).toBe(true);
      expect(r.xp).toBe(0);
      expect(r.emblemas_nuevos).toEqual([]);
      // Tampoco toca el ranking ni el estado de la entrega.
      expect(prisma.ranking.upsert).not.toHaveBeenCalled();
      expect(prisma.retoUsuario.upsert).not.toHaveBeenCalled();
    });

    it('exige que el reto tenga salida esperada configurada', async () => {
      prisma.reto.findFirst.mockResolvedValue({ ...reto, ejemploSalida: null });
      await expect(service.comprobarReto(5, 'x')).rejects.toThrow(BadRequestException);
    });

    it('rechaza un reto inexistente', async () => {
      prisma.reto.findFirst.mockResolvedValue(null);
      await expect(service.comprobarReto(999, 'x')).rejects.toThrow(BadRequestException);
    });
  });

  describe('guardarEjecucion', () => {
    it('crea la fila si el estudiante aún no tenía código guardado', async () => {
      prisma.codigoPractica.findFirst.mockResolvedValue(null);
      await service.guardarEjecucion(7, 'print(1)', '1', 'reto' as never, 3);
      expect(prisma.codigoPractica.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ codigo: 'print(1)', ultimaSalida: '1' }) }),
      );
    });

    it('actualiza la existente conservando el contexto', async () => {
      prisma.codigoPractica.findFirst.mockResolvedValue({ id: 11 });
      await service.guardarEjecucion(7, 'print(2)', '2', 'reto' as never, 3);
      expect(prisma.codigoPractica.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 11 }, data: { codigo: 'print(2)', ultimaSalida: '2' } }),
      );
    });
  });
});
