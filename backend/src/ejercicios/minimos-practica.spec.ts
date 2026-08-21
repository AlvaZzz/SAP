import { BadRequestException } from '@nestjs/common';
import { AdaptatividadService } from './adaptatividad.service';
import { crearPrismaMock, PrismaMock } from '../test-utils/prisma.mock';

/**
 * PRÁCTICA MÍNIMA POR NIVEL — pruebas de regresión.
 *
 * El defecto que fijan: NO existía ningún mínimo. `UnidadesService` marcaba
 * `puede_subir` en cuanto el tema tenía ejercicios del nivel objetivo, y
 * `iniciarSubida` solo comprobaba que el estudiante no estuviera ya en Avanzado.
 * Resultado: se podía pasar de Básico a Avanzado sin resolver un solo ejercicio
 * del nivel que se decía haber superado — lo que invalida la adaptatividad y
 * contamina θ y el dominio de la unidad.
 *
 * La regla que fijan: para intentar la subida hay que haber RESUELTO un mínimo
 * de ejercicios DEL NIVEL VIGENTE en ESE tema. Los mínimos salen de
 * `ConfiguracionSistema` (10 / 7 / 5 por defecto), no de constantes incrustadas.
 */
describe('AdaptatividadService · práctica mínima por nivel', () => {
  let prisma: PrismaMock;
  let service: AdaptatividadService;

  /** El estudiante 7 está en BÁSICO en el tema 30, que tiene 15 ítems básicos. */
  function escenario({ resueltos, nivel = 'basico', totalNivel = 15 }: { resueltos: number; nivel?: string; totalNivel?: number }) {
    prisma.progresoTema.findUnique.mockResolvedValue({ nivelActual: nivel });
    prisma.ejercicio.count.mockResolvedValue(totalNivel); // el nivel actual sí tiene ejercicios
    prisma.configuracionSistema.findUnique.mockResolvedValue({
      subirNivelPreguntas: 5, subirNivelUmbral: 80, subirNivelEsperaHoras: 0,
      minPracticaBasico: 10, minPracticaIntermedio: 7, minPracticaAvanzado: 5,
    });
    // Ejercicios del nivel en el tema…
    prisma.ejercicio.findMany.mockResolvedValue(
      Array.from({ length: totalNivel }, (_, i) => ({ id: i + 1 })),
    );
    // …y los que el estudiante ya resolvió.
    prisma.intento.findMany.mockResolvedValue(
      Array.from({ length: resueltos }, (_, i) => ({ ejercicioId: i + 1 })),
    );
    prisma.tema.findUnique.mockResolvedValue({ id: 30, titulo: 'Variables', numero: '1.1' });
  }

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new AdaptatividadService(prisma as never);
  });

  describe('progresoNivel', () => {
    it('reporta cuántos faltan y NO da por cumplido el mínimo', async () => {
      escenario({ resueltos: 4 });
      const p = await service.progresoNivel(7, 30);
      expect(p).toMatchObject({ nivel: 'basico', resueltos: 4, minimo: 10, faltan: 6, cumplido: false });
    });

    it('da por cumplido el mínimo al alcanzarlo exactamente', async () => {
      escenario({ resueltos: 10 });
      const p = await service.progresoNivel(7, 30);
      expect(p).toMatchObject({ resueltos: 10, minimo: 10, faltan: 0, cumplido: true });
    });

    it('usa el mínimo de CADA nivel (intermedio = 7, avanzado = 5)', async () => {
      escenario({ resueltos: 7, nivel: 'intermedio', totalNivel: 10 });
      expect(await service.progresoNivel(7, 30)).toMatchObject({ minimo: 7, cumplido: true });

      escenario({ resueltos: 4, nivel: 'avanzado', totalNivel: 5 });
      expect(await service.progresoNivel(7, 30)).toMatchObject({ minimo: 5, faltan: 1, cumplido: false });
    });

    it('topa el mínimo al total disponible: un tema con poco contenido no atrapa al estudiante', async () => {
      // 6 ítems básicos en el tema, mínimo configurado 10 → el mínimo efectivo es 6.
      escenario({ resueltos: 6, totalNivel: 6 });
      const p = await service.progresoNivel(7, 30);
      expect(p).toMatchObject({ total: 6, minimo: 6, minimo_config: 10, cumplido: true });
    });

    it('respeta los mínimos CONFIGURADOS, no los valores por defecto', async () => {
      escenario({ resueltos: 3 });
      prisma.configuracionSistema.findUnique.mockResolvedValue({
        minPracticaBasico: 3, minPracticaIntermedio: 2, minPracticaAvanzado: 1,
      });
      expect(await service.progresoNivel(7, 30)).toMatchObject({ minimo: 3, cumplido: true });
    });
  });

  describe('el gate del mini-diagnóstico', () => {
    it('RECHAZA iniciar la subida sin la práctica mínima', async () => {
      escenario({ resueltos: 4 });
      await expect(service.iniciarSubida(7, 30)).rejects.toThrow(BadRequestException);
    });

    it('el mensaje dice cuánto lleva y cuánto necesita', async () => {
      escenario({ resueltos: 4 });
      await expect(service.iniciarSubida(7, 30)).rejects.toThrow(/llevas 4 de 10/);
    });

    it('RECHAZA también evaluar la subida — un POST directo no salta el gate', async () => {
      escenario({ resueltos: 4 });
      await expect(service.evaluarSubida(7, 30, [{ ejercicioId: 1, respuesta: 'A' }]))
        .rejects.toThrow(BadRequestException);
    });

    it('DEJA iniciar la subida cuando el mínimo está cumplido', async () => {
      escenario({ resueltos: 10 });
      // Ítems del nivel OBJETIVO (intermedio) que sirve el mini-diagnóstico.
      prisma.ejercicio.findMany
        .mockResolvedValueOnce(Array.from({ length: 15 }, (_, i) => ({ id: i + 1 })))  // progresoNivel
        .mockResolvedValueOnce([{ id: 101, tipo: 'opcion_multiple', enunciado: '¿?', nivelDificultad: 'intermedio' }]);
      const r = await service.iniciarSubida(7, 30);
      expect(r).toMatchObject({ nivel_actual: 'basico', nivel_objetivo: 'intermedio' });
    });

    it('no se pueden saltar niveles: desde Básico el objetivo es Intermedio, nunca Avanzado', async () => {
      escenario({ resueltos: 10 });
      prisma.ejercicio.findMany
        .mockResolvedValueOnce(Array.from({ length: 15 }, (_, i) => ({ id: i + 1 })))
        .mockResolvedValueOnce([{ id: 101, tipo: 'opcion_multiple', enunciado: '¿?', nivelDificultad: 'intermedio' }]);
      const r = await service.iniciarSubida(7, 30);
      expect(r.nivel_objetivo).toBe('intermedio');
    });
  });
});
