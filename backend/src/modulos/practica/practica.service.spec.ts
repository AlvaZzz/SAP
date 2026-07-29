import { BadRequestException } from '@nestjs/common';
import { PracticaService } from './practica.service';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';

describe('PracticaService (bug‑hunt + traza)', () => {
  let prisma: PrismaMock;
  let piston: { ejecutar: jest.Mock };
  let emblemas: { otorgarClaves: jest.Mock };
  let service: PracticaService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    piston = { ejecutar: jest.fn() };
    emblemas = { otorgarClaves: jest.fn().mockResolvedValue([]) };
    service = new PracticaService(prisma as never, piston as never, {} as never, emblemas as never);
  });

  describe('verificarReto (misión de depuración)', () => {
    const reto = { id: 5, titulo: 'Bug', esBugHunt: true, ejemploSalida: '15', xp: 70 };

    it('rechaza un reto que no es bug‑hunt', async () => {
      prisma.reto.findFirst.mockResolvedValue({ ...reto, esBugHunt: false });
      await expect(service.verificarReto(7, 5, 'print(1)')).rejects.toThrow(BadRequestException);
    });

    it('APRUEBA si la salida coincide: otorga XP y el emblema, marca aprobado', async () => {
      prisma.reto.findFirst.mockResolvedValue(reto);
      prisma.retoUsuario.findUnique.mockResolvedValue(null); // no resuelto antes
      piston.ejecutar.mockResolvedValue({ ok: true, stdout: '15\n', stderr: '', code: 0 });
      emblemas.otorgarClaves.mockResolvedValue([{ clave: 'cazador_de_bugs', nombre: 'Cazador de Bugs', descripcion: '', svgKey: 'diana', icono: '🐛' }]);

      const r = await service.verificarReto(7, 5, 'total=0\nfor n in range(1,6): total+=n\nprint(total)');

      expect(r.correcto).toBe(true);
      expect(r.xp).toBe(70);
      expect(r.emblemas_nuevos).toHaveLength(1);
      expect(prisma.retoUsuario.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ estado: 'aprobado', xpObtenido: 70 }) }),
      );
      expect(prisma.ranking.upsert).toHaveBeenCalled();
      expect(emblemas.otorgarClaves).toHaveBeenCalledWith(7, ['cazador_de_bugs']);
    });

    it('NO aprueba si la salida difiere: no persiste ni otorga', async () => {
      prisma.reto.findFirst.mockResolvedValue(reto);
      piston.ejecutar.mockResolvedValue({ ok: true, stdout: '10\n', stderr: '', code: 0 });

      const r = await service.verificarReto(7, 5, 'print(10)');

      expect(r.correcto).toBe(false);
      expect(r.xp).toBe(0);
      expect(prisma.retoUsuario.upsert).not.toHaveBeenCalled();
      expect(emblemas.otorgarClaves).not.toHaveBeenCalled();
    });

    it('si ya lo había resuelto, no vuelve a otorgar XP', async () => {
      prisma.reto.findFirst.mockResolvedValue(reto);
      prisma.retoUsuario.findUnique.mockResolvedValue({ estado: 'aprobado', xpObtenido: 70 });
      piston.ejecutar.mockResolvedValue({ ok: true, stdout: '15', stderr: '', code: 0 });

      const r = await service.verificarReto(7, 5, 'print(15)');

      expect(r.correcto).toBe(true);
      expect(r.xp).toBe(70);
      expect(prisma.retoUsuario.upsert).not.toHaveBeenCalled();
      expect(emblemas.otorgarClaves).not.toHaveBeenCalled();
    });
  });

  describe('traza (visualizador)', () => {
    it('si no hay centinela (error de sintaxis) devuelve el error y sin pasos', async () => {
      piston.ejecutar.mockResolvedValue({ ok: false, stdout: '', stderr: 'SyntaxError: invalid syntax', code: 1 });
      const r = await service.traza('for i in range(3)\n  print(i)');
      expect(r.ok).toBe(false);
      expect(r.error).toContain('SyntaxError');
      expect(r.pasos).toEqual([]);
    });

    it('parsea el centinela, devuelve stdout y filtra pasos fuera del rango del alumno', async () => {
      // Un paso con línea altísima (del propio harness) debe filtrarse.
      const payload = JSON.stringify({ stdout: 'hola\n', pasos: [{ linea: 9999, locals: { x: '1' } }], error: null });
      piston.ejecutar.mockResolvedValue({ ok: true, stdout: 'PREXI_TRACE::' + payload, stderr: '', code: 0 });
      const r = await service.traza('x = 1\nprint("hola")');
      expect(r.ok).toBe(true);
      expect(r.stdout).toBe('hola\n');
      expect(r.pasos).toEqual([]); // el paso 9999 queda fuera del rango [1..2]
    });

    it('ante un fallo del sandbox devuelve un error reintentable, no la salida cruda', async () => {
      piston.ejecutar.mockResolvedValue({ ok: false, stdout: '', stderr: '', code: -1, timeout: false, sandboxError: 'El entorno de ejecución tuvo un problema temporal. Intenta de nuevo en unos segundos.' });
      const r = await service.traza('print(1)');
      expect(r.ok).toBe(false);
      expect(r.reintentable).toBe(true);
      expect(r.error).toContain('problema temporal');
      expect(r.pasos).toEqual([]);
    });
  });

  describe('robustez del sandbox', () => {
    it('verificarReto no penaliza si el sandbox falla: pide reintento', async () => {
      prisma.reto.findFirst.mockResolvedValue({ id: 5, titulo: 'Bug', esBugHunt: true, ejemploSalida: '15', xp: 70 });
      piston.ejecutar.mockResolvedValue({ ok: false, stdout: '', stderr: '', code: -1, timeout: false, sandboxError: 'El entorno de ejecución tuvo un problema temporal. Intenta de nuevo en unos segundos.' });
      const r = await service.verificarReto(7, 5, 'print(15)') as { correcto: boolean; reintentable?: boolean };
      expect(r.correcto).toBe(false);
      expect(r.reintentable).toBe(true);
      expect(prisma.retoUsuario.upsert).not.toHaveBeenCalled();
    });
  });
});
