import { BadRequestException } from '@nestjs/common';
import { AdaptatividadService } from './adaptatividad.service';
import { crearPrismaMock, PrismaMock } from '../test-utils/prisma.mock';

describe('AdaptatividadService (niveles Básico/Intermedio/Avanzado por tema)', () => {
  let prisma: PrismaMock;
  let service: AdaptatividadService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new AdaptatividadService(prisma as never);
  });

  describe('nivelDeTema', () => {
    it('usa el nivel guardado en ProgresoTema si existe', async () => {
      prisma.progresoTema.findUnique.mockResolvedValue({ nivelActual: 'intermedio' });
      expect(await service.nivelDeTema(7, 3)).toBe('intermedio');
    });
    it('cae al nivel inicial del pretest si el tema no tiene progreso aún', async () => {
      prisma.progresoTema.findUnique.mockResolvedValue(null);
      prisma.usuario.findUnique.mockResolvedValue({ nivelInicialAdaptativo: 'avanzado' });
      expect(await service.nivelDeTema(7, 3)).toBe('avanzado');
    });
    it('básico por defecto si no hay clasificación', async () => {
      prisma.progresoTema.findUnique.mockResolvedValue(null);
      prisma.usuario.findUnique.mockResolvedValue({ nivelInicialAdaptativo: null });
      expect(await service.nivelDeTema(7, 3)).toBe('basico');
    });
  });

  describe('ruta: filtra por el nivel actual del estudiante en el tema', () => {
    it('sirve solo los ejercicios del nivel actual, pendientes primero', async () => {
      prisma.progresoTema.findUnique.mockResolvedValue({ nivelActual: 'intermedio' });
      // nivelConEjercicios: hay ejercicios del nivel intermedio.
      prisma.ejercicio.count.mockResolvedValue(3);
      prisma.ejercicio.findMany.mockResolvedValue([
        { id: 10, nivelDificultad: 'intermedio' },
        { id: 11, nivelDificultad: 'intermedio' },
        { id: 12, nivelDificultad: 'intermedio' },
      ]);
      prisma.intento.findMany.mockResolvedValue([{ ejercicioId: 10 }]); // 10 resuelto

      const r = await service.ruta(7, { temaId: 3 });

      // Filtró por nivel intermedio.
      const where = prisma.ejercicio.findMany.mock.calls[0][0].where;
      expect(where.nivelDificultad).toBe('intermedio');
      expect(r.nivel_actual).toBe('intermedio');
      expect(r.pendientes).toBe(2);
      // El resuelto (10) queda al final.
      expect(r.ejercicios[r.ejercicios.length - 1].id).toBe(10);
    });

    it('IRT: ordena los pendientes por máxima información (b más cercano a θ primero)', async () => {
      prisma.progresoTema.findUnique.mockResolvedValue({ nivelActual: 'intermedio' });
      prisma.ejercicio.count.mockResolvedValue(3);
      prisma.ejercicio.findMany.mockResolvedValue([
        { id: 1, nivelDificultad: 'intermedio', dificultadB: 2 },
        { id: 2, nivelDificultad: 'intermedio', dificultadB: 0 },
        { id: 3, nivelDificultad: 'intermedio', dificultadB: -2 },
      ]);
      prisma.intento.findMany.mockResolvedValue([]); // sin práctica previa
      prisma.usuario.findUnique.mockResolvedValue({ thetaInicial: 0 }); // θ = 0

      const r = await service.ruta(7, { temaId: 3 });

      expect(r.theta).toBe(0);
      // Con θ=0, el ítem más informativo es el de b=0 (id 2) → va primero.
      expect(r.ejercicios[0].id).toBe(2);
    });

    it('si el nivel actual no tiene ejercicios, cae al nivel inferior disponible', async () => {
      prisma.progresoTema.findUnique.mockResolvedValue({ nivelActual: 'avanzado' });
      // avanzado: 0 ejercicios; intermedio: 4 ejercicios.
      prisma.ejercicio.count
        .mockResolvedValueOnce(0)  // avanzado
        .mockResolvedValueOnce(4); // intermedio
      prisma.ejercicio.findMany.mockResolvedValue([{ id: 1, nivelDificultad: 'intermedio' }]);
      prisma.intento.findMany.mockResolvedValue([]);

      const r = await service.ruta(7, { temaId: 3 });
      expect(r.nivel_usado).toBe('intermedio');
      expect(prisma.ejercicio.findMany.mock.calls[0][0].where.nivelDificultad).toBe('intermedio');
    });
  });

  describe('registrarIntento: evidencia de la ruta (best-effort)', () => {
    it('crea un PasoRuta con el orden del nivel', async () => {
      await service.registrarIntento(7, 10, true, 'avanzado', 5);
      expect(prisma.pasoRuta.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ usuarioId: 7, ejercicioId: 10, correcto: true, dificultadObjetivo: 3 }),
        }),
      );
    });
    it('no propaga errores (best-effort)', async () => {
      prisma.pasoRuta.create.mockRejectedValue(new Error('db'));
      await expect(service.registrarIntento(7, 10, true, 'basico', 1)).resolves.toBeUndefined();
    });
  });

  describe('iniciarSubida: mini-diagnóstico del nivel objetivo', () => {
    it('rechaza si ya está en Avanzado', async () => {
      prisma.tema.findUnique.mockResolvedValue({ id: 3, titulo: 'T', numero: '1.1' });
      prisma.progresoTema.findUnique.mockResolvedValue({ nivelActual: 'avanzado' });
      await expect(service.iniciarSubida(7, 3)).rejects.toThrow(BadRequestException);
    });

    it('devuelve preguntas del nivel objetivo (siguiente al actual)', async () => {
      prisma.tema.findUnique.mockResolvedValue({ id: 3, titulo: 'T', numero: '1.1' });
      prisma.progresoTema.findUnique.mockResolvedValue({ nivelActual: 'basico' });
      prisma.configuracionSistema.findUnique.mockResolvedValue({ subirNivelPreguntas: 5, subirNivelUmbral: 80, subirNivelEsperaHoras: 0 });
      prisma.ejercicio.findMany.mockResolvedValue([
        { id: 1, nivelDificultad: 'intermedio' }, { id: 2, nivelDificultad: 'intermedio' },
      ]);

      const r = await service.iniciarSubida(7, 3);
      expect(r.nivel_objetivo).toBe('intermedio');
      expect(prisma.ejercicio.findMany.mock.calls[0][0].where.nivelDificultad).toBe('intermedio');
      expect(r.total).toBe(2);
    });

    it('rechaza si no hay ejercicios del nivel objetivo', async () => {
      prisma.tema.findUnique.mockResolvedValue({ id: 3, titulo: 'T', numero: '1.1' });
      prisma.progresoTema.findUnique.mockResolvedValue({ nivelActual: 'basico' });
      prisma.configuracionSistema.findUnique.mockResolvedValue({ subirNivelPreguntas: 5, subirNivelUmbral: 80, subirNivelEsperaHoras: 0 });
      prisma.ejercicio.findMany.mockResolvedValue([]);
      await expect(service.iniciarSubida(7, 3)).rejects.toThrow(BadRequestException);
    });
  });

  describe('evaluarSubida: sube de nivel solo con ≥ umbral', () => {
    const setup = (umbral: number) => {
      prisma.tema.findUnique.mockResolvedValue({ id: 3 });
      prisma.progresoTema.findUnique.mockResolvedValue({ nivelActual: 'basico' });
      prisma.configuracionSistema.findUnique.mockResolvedValue({ subirNivelPreguntas: 5, subirNivelUmbral: umbral, subirNivelEsperaHoras: 0 });
    };

    it('aprueba (≥80%) → sube el nivel del tema y registra el intento', async () => {
      setup(80);
      prisma.ejercicio.findMany.mockResolvedValue([
        { id: 1, tipo: 'opcion_multiple', respuestaCorrecta: 'A' },
        { id: 2, tipo: 'opcion_multiple', respuestaCorrecta: 'B' },
      ]);
      const r = await service.evaluarSubida(7, 3, [
        { ejercicioId: 1, respuesta: 'A' }, { ejercicioId: 2, respuesta: 'B' },
      ]);
      expect(r.puntaje).toBe(100);
      expect(r.aprobado).toBe(true);
      expect(r.nivel_actual).toBe('intermedio');
      expect(prisma.intentoSubidaNivel.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ desde: 'basico', hacia: 'intermedio', aprobado: true }) }),
      );
      expect(prisma.progresoTema.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: expect.objectContaining({ nivelActual: 'intermedio' }) }),
      );
    });

    it('IRT: re-estima θ del mini-diagnóstico y lo registra en la evolución (origen subir_nivel)', async () => {
      setup(80);
      prisma.ejercicio.findMany.mockResolvedValue([
        { id: 1, tipo: 'opcion_multiple', respuestaCorrecta: 'A', dificultadB: 0 },
        { id: 2, tipo: 'opcion_multiple', respuestaCorrecta: 'B', dificultadB: 0 },
      ]);
      await service.evaluarSubida(7, 3, [
        { ejercicioId: 1, respuesta: 'A' }, { ejercicioId: 2, respuesta: 'B' },
      ]);
      expect(prisma.historialTheta.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ origen: 'subir_nivel', temaId: 3 }) }),
      );
      expect(prisma.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ thetaActual: expect.any(Number) }) }),
      );
    });

    it('no aprueba (<80%) → mantiene el nivel, registra el intento fallido', async () => {
      setup(80);
      prisma.ejercicio.findMany.mockResolvedValue([
        { id: 1, tipo: 'opcion_multiple', respuestaCorrecta: 'A' },
        { id: 2, tipo: 'opcion_multiple', respuestaCorrecta: 'B' },
      ]);
      const r = await service.evaluarSubida(7, 3, [
        { ejercicioId: 1, respuesta: 'A' }, { ejercicioId: 2, respuesta: 'Z' },
      ]);
      expect(r.puntaje).toBe(50);
      expect(r.aprobado).toBe(false);
      expect(r.nivel_actual).toBe('basico');
      expect(prisma.progresoTema.upsert).not.toHaveBeenCalled();
    });
  });
});
