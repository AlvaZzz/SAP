import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ExamenUnidadService } from './examen-unidad.service';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';

describe('ExamenUnidadService (gate de repaso, IRT y aprobación)', () => {
  let prisma: PrismaMock;
  let service: ExamenUnidadService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new ExamenUnidadService(prisma as never);
    prisma.unidad.findUnique.mockResolvedValue({ id: 1, numero: 1, titulo: 'U1' });
    prisma.configuracionSistema.findUnique.mockResolvedValue({ examenUnidadPreguntas: 8, examenUnidadEsperaHoras: 0 });
    prisma.tema.findMany.mockResolvedValue([{ id: 10 }, { id: 11 }]);
    // Por defecto, un estudiante que YA cumple los requisitos de cierre de unidad
    // (todos los temas completos y dominio Intermedio). Las pruebas del gate lo
    // sobreescriben con `temasConProgreso`.
    temasConProgreso([
      { completados: 10, umbral: 10, nivel: 'intermedio' },
      { completados: 10, umbral: 10, nivel: 'intermedio' },
    ]);
  });

  /**
   * Configura los temas de la unidad y el progreso del estudiante en cada uno.
   * `tema.findMany` se usa en dos sitios (los ids para el banco y los requisitos),
   * así que el mock devuelve filas que sirven a ambos.
   */
  function temasConProgreso(defs: Array<{ completados: number; umbral: number; nivel: string }>) {
    prisma.tema.findMany.mockResolvedValue(
      defs.map((d, i) => ({
        id: 10 + i,
        numero: `1.${i + 1}`,
        titulo: `Tema ${i + 1}`,
        umbral: d.umbral,
        progreso: [{ ejerciciosCompletados: d.completados, nivelActual: d.nivel }],
      })) as never,
    );
  }

  it('completarRepaso registra el repaso de la unidad', async () => {
    prisma.repasoUnidad.upsert.mockResolvedValue({});
    const r = await service.completarRepaso(7, 1);
    expect(r).toEqual({ completado: true });
    expect(prisma.repasoUnidad.upsert).toHaveBeenCalled();
  });

  it('iniciar exige haber revisado el repaso de la unidad', async () => {
    prisma.repasoUnidad.findUnique.mockResolvedValue(null); // sin repaso
    await expect(service.iniciar(7, 1)).rejects.toThrow('Revisa el repaso');
  });

  it('iniciar sirve preguntas del banco de examen sin la respuesta correcta', async () => {
    prisma.repasoUnidad.findUnique.mockResolvedValue({ usuarioId: 7, unidadId: 1 });
    prisma.examenUnidad.findFirst.mockResolvedValue(null); // no aprobado aún
    prisma.ejercicio.findMany.mockResolvedValue([
      { id: 100, titulo: 'P1', tipo: 'opcion_multiple', enunciado: 'e', opciones: [] },
      { id: 101, titulo: 'P2', tipo: 'opcion_multiple', enunciado: 'e', opciones: [] },
    ]);
    const r = await service.iniciar(7, 1);
    expect(r.total).toBe(2);
    expect(JSON.stringify(r)).not.toMatch(/respuestaCorrecta/);
  });

  it('iniciar falla si la unidad no tiene banco de examen', async () => {
    prisma.repasoUnidad.findUnique.mockResolvedValue({ usuarioId: 7, unidadId: 1 });
    prisma.examenUnidad.findFirst.mockResolvedValue(null);
    prisma.ejercicio.findMany.mockResolvedValue([]);
    await expect(service.iniciar(7, 1)).rejects.toThrow('Aún no hay preguntas');
  });

  it('evaluar APRUEBA (θ ≥ Intermedio) cuando acierta ítems de dificultad media/alta', async () => {
    prisma.examenUnidad.findFirst.mockResolvedValue(null); // sin aprobado previo ni cooldown
    prisma.ejercicio.findMany.mockResolvedValue([
      { id: 100, tipo: 'opcion_multiple', respuestaCorrecta: 'A', dificultadB: 0.5, temaId: 10, tema: { numero: '1.1', titulo: 'T1' } },
      { id: 101, tipo: 'opcion_multiple', respuestaCorrecta: 'A', dificultadB: 1.0, temaId: 10, tema: { numero: '1.1', titulo: 'T1' } },
      { id: 102, tipo: 'opcion_multiple', respuestaCorrecta: 'A', dificultadB: 0.0, temaId: 11, tema: { numero: '1.2', titulo: 'T2' } },
    ]);
    const respuestas = [
      { ejercicioId: 100, respuesta: 'A' },
      { ejercicioId: 101, respuesta: 'A' },
      { ejercicioId: 102, respuesta: 'A' },
    ];
    const r = await service.evaluar(7, 1, respuestas);
    expect(r.puntaje).toBe(100);
    expect(r.aprobado).toBe(true);
    expect(['intermedio', 'avanzado']).toContain(r.nivel);
    // Registra el intento y el punto de evolución de θ (origen examen_unidad).
    expect(prisma.examenUnidad.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ aprobado: true, unidadId: 1 }) }),
    );
    expect(prisma.historialTheta.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ origen: 'examen_unidad' }) }),
    );
  });

  it('evaluar NO aprueba y retroalimenta los temas flojos cuando falla', async () => {
    prisma.examenUnidad.findFirst.mockResolvedValue(null);
    prisma.ejercicio.findMany.mockResolvedValue([
      { id: 100, tipo: 'opcion_multiple', respuestaCorrecta: 'A', dificultadB: 0.0, temaId: 10, tema: { numero: '1.1', titulo: 'Algoritmos' } },
      { id: 101, tipo: 'opcion_multiple', respuestaCorrecta: 'A', dificultadB: 0.5, temaId: 10, tema: { numero: '1.1', titulo: 'Algoritmos' } },
    ]);
    const r = await service.evaluar(7, 1, [
      { ejercicioId: 100, respuesta: 'B' },
      { ejercicioId: 101, respuesta: 'B' },
    ]);
    expect(r.aprobado).toBe(false);
    expect(r.temas_reforzar).toContain('1.1 Algoritmos');
  });

  it('evaluar rechaza si ya aprobó el examen de la unidad', async () => {
    prisma.examenUnidad.findFirst.mockResolvedValue({ id: 1 }); // ya aprobado
    await expect(service.evaluar(7, 1, [{ ejercicioId: 100, respuesta: 'A' }])).rejects.toThrow('Ya aprobaste');
  });

  it('respeta el cooldown entre reintentos no aprobados', async () => {
    prisma.configuracionSistema.findUnique.mockResolvedValue({ examenUnidadPreguntas: 8, examenUnidadEsperaHoras: 24 });
    prisma.repasoUnidad.findUnique.mockResolvedValue({ usuarioId: 7, unidadId: 1 }); // repaso hecho
    // 1ª llamada (aprobado?) → null; 2ª (cooldown, último no aprobado) → intento reciente.
    prisma.examenUnidad.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ fecha: new Date() });
    await expect(service.iniciar(7, 1)).rejects.toThrow(ForbiddenException);
  });

  it('iniciar rechaza si ya aprobó el examen', async () => {
    prisma.repasoUnidad.findUnique.mockResolvedValue({ usuarioId: 7, unidadId: 1 });
    prisma.examenUnidad.findFirst.mockResolvedValue({ id: 1 }); // aprobado
    await expect(service.iniciar(7, 1)).rejects.toThrow(BadRequestException);
  });

  /**
   * GATE DE CIERRE DE UNIDAD — pruebas de regresión.
   *
   * Antes bastaba con haber marcado el repaso como visto: con uno o tres temas
   * hechos ya se habilitaba el examen que desbloquea la unidad siguiente. La
   * regla correcta exige LAS DOS condiciones — todos los temas completos y
   * dominio al menos Intermedio.
   */
  describe('gate: temas completos + dominio Intermedio', () => {
    beforeEach(() => {
      prisma.repasoUnidad.findUnique.mockResolvedValue({ usuarioId: 7, unidadId: 1 });
      prisma.examenUnidad.findFirst.mockResolvedValue(null);
      prisma.ejercicio.findMany.mockResolvedValue([
        { id: 100, titulo: 'P1', tipo: 'opcion_multiple', enunciado: 'e', opciones: [] },
      ]);
      prisma.ejercicio.count.mockResolvedValue(1);
    });

    it('sin temas completos → rechazado, y dice cuántos y cuáles faltan', async () => {
      temasConProgreso([
        { completados: 10, umbral: 10, nivel: 'avanzado' },
        { completados: 3, umbral: 10, nivel: 'avanzado' },
      ]);
      const error = await service.iniciar(7, 1).catch((e) => e);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.message).toContain('Te falta completar 1 tema(s)');
      expect(error.message).toContain('1.2 Tema 2');
    });

    it('con temas completos pero en Básico → rechazado, y dice qué nivel le falta', async () => {
      temasConProgreso([
        { completados: 10, umbral: 10, nivel: 'basico' },
        { completados: 10, umbral: 10, nivel: 'basico' },
      ]);
      const error = await service.iniciar(7, 1).catch((e) => e);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.message).toContain('al menos nivel Intermedio');
      expect(error.message).toContain('Básico (0%)');
    });

    it('con ambas condiciones → permitido', async () => {
      temasConProgreso([
        { completados: 10, umbral: 10, nivel: 'intermedio' },
        { completados: 12, umbral: 10, nivel: 'avanzado' },
      ]);
      await expect(service.iniciar(7, 1)).resolves.toMatchObject({ total: 1 });
    });

    it('un tema nunca tocado cuenta como Básico, no como ausente', async () => {
      prisma.tema.findMany.mockResolvedValue([
        { id: 10, numero: '1.1', titulo: 'Tema 1', umbral: 10, progreso: [{ ejerciciosCompletados: 10, nivelActual: 'avanzado' }] },
        { id: 11, numero: '1.2', titulo: 'Tema 2', umbral: 0, progreso: [] },
      ] as never);
      // Tema 2 tiene umbral 0 (se considera completo) pero sin progreso → Básico.
      // Promedio: (1 + 0) / 2 = 50% → Intermedio, justo en el límite: pasa.
      await expect(service.iniciar(7, 1)).resolves.toMatchObject({ total: 1 });
    });

    it('el repaso sigue siendo requisito, y se comprueba antes que el resto', async () => {
      prisma.repasoUnidad.findUnique.mockResolvedValue(null);
      temasConProgreso([{ completados: 0, umbral: 10, nivel: 'basico' }]);
      await expect(service.iniciar(7, 1)).rejects.toThrow('Revisa el repaso');
    });

    it('estado() expone el avance hacia el examen antes de intentarlo', async () => {
      temasConProgreso([
        { completados: 10, umbral: 10, nivel: 'intermedio' },
        { completados: 4, umbral: 10, nivel: 'basico' },
      ]);
      const e = await service.estado(7, 1);
      expect(e.puede_intentar).toBe(false);
      expect(e.requisitos).toMatchObject({
        temas_total: 2, temas_completos: 1, temas_ok: false,
        nivel_requerido: 'intermedio', nivel_ok: false,
      });
      expect(e.requisitos.temas_pendientes).toEqual(['1.2 Tema 2']);
      expect(e.motivo_bloqueo).toContain('Te falta completar');
    });
  });
});
