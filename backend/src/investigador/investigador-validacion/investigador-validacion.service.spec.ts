import { InvestigadorValidacionService } from './investigador-validacion.service';
import { ITEMS_SUS } from '../../mediciones/instrumentos/sus';
import { itemsIso25010 } from '../../mediciones/calidad/items-iso25010';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';

const sus = (valores: number[]) => Object.fromEntries(ITEMS_SUS.map((it, i) => [it.id, valores[i]]));
const iso = (valor: number) => Object.fromEntries(itemsIso25010().map((it) => [it.id, valor]));

/** Fila de LogAdaptacion con lo mínimo que usa el panel. */
const log = (usuarioId: number, enRango: boolean | null, extra: Record<string, unknown> = {}) => ({
  usuarioId, temaId: 4, ejercicioId: 10, thetaAntes: 0, thetaDespues: 0.1, dificultadB: -1, probAcierto: 0.73,
  nivelAntes: 'basico', nivelDespues: 'basico', enRangoObjetivo: enRango, personalizado: true, correcto: true,
  latenciaMs: 20, tiempoRespuestaMs: 40, fecha: new Date('2026-10-01T12:00:00Z'),
  tema: { numero: '1.2', titulo: 'Variables' }, ...extra,
});

describe('InvestigadorValidacionService (panel de validación de la tesis)', () => {
  let prisma: PrismaMock;
  let service: InvestigadorValidacionService;
  const instrumentos = { respuestasPorPersona: jest.fn() };

  const ESTUDIANTES = [
    { id: 11, nombre: 'Ana Privada', paralelo: 'A', creadoEn: new Date(), ranking: { xpTotal: 100, rachaDias: 2 } },
    { id: 12, nombre: 'Luis Privado', paralelo: 'A', creadoEn: new Date(), ranking: { xpTotal: 50, rachaDias: 0 } },
  ];

  beforeEach(() => {
    prisma = crearPrismaMock();
    instrumentos.respuestasPorPersona.mockReset();
    service = new InvestigadorValidacionService(prisma as never, instrumentos as never);
    prisma.usuario.findMany.mockResolvedValue(ESTUDIANTES);
    prisma.configuracionSistema.findUnique.mockResolvedValue({
      institucion: 'UPEA', rangoObjetivoMin: 50, rangoObjetivoMax: 85,
      criterioPrecisionMin: 70, criterioSusMin: 69, nivelAceptableCalidad: 4,
    });
    prisma.retoUsuario.count.mockResolvedValue(3);
    prisma.historialRanking.count.mockResolvedValue(5);
    prisma.consultaRanking.count.mockResolvedValue(7);
    prisma.logAdaptacion.findMany.mockResolvedValue([]);
    instrumentos.respuestasPorPersona.mockResolvedValue(new Map());
  });

  it('sin datos no emite cifras ni declara la hipótesis', async () => {
    const r = await service.resumen();
    expect(r.precision.en_rango.estimacion).toBeNull();
    expect(r.usabilidad.media.estimacion).toBeNull();
    expect(r.calidad.todas_aceptables).toBeNull();
    expect(r.criterios.pendientes).toBe(3);
    expect(r.criterios.sistema_validado).toBeNull();
    expect(r.hipotesis.aceptada).toBeNull();
    expect(r.rendimiento.media).toBeNull();
    expect(r.rendimiento.contraste.calculado).toBe(false);
  });

  it('precisión: % en rango con IC, excluyendo las asignaciones no evaluables', async () => {
    prisma.logAdaptacion.findMany.mockResolvedValue([
      ...Array.from({ length: 9 }, () => log(11, true)),
      log(12, false),
      log(12, null), // sin θ previa: fuera del denominador
    ]);
    const r = await service.resumen();
    expect(r.precision.n_asignaciones).toBe(11);
    expect(r.precision.n_evaluables).toBe(10);
    expect(r.precision.n_no_evaluables).toBe(1);
    expect(r.precision.en_rango.estimacion).toBe(90);
    expect(r.precision.en_rango.inferior).not.toBeNull();
    expect(r.precision.en_rango.remuestreos).toBeGreaterThanOrEqual(2000);
    // Latencia en SEGUNDOS: 20 ms = 0,02 s.
    expect(r.precision.latencia.media_s).toBe(0.02);
    expect(r.precision.por_tema).toEqual([{ tema: '1.2', titulo: 'Variables', n: 10, pct_en_rango: 90 }]);
    expect(r.variable_independiente.adaptabilidad.pct_personalizacion).toBe(100);
    expect(r.variable_independiente.gamificacion).toEqual({
      retos_completados: 3, cambios_posicion_ranking: 5, consultas_ranking: 7,
    });
  });

  it('usabilidad: media SUS solo de los estudiantes del estudio', async () => {
    instrumentos.respuestasPorPersona.mockImplementation(async (clave: string) =>
      clave === 'SUS'
        ? new Map([
            [11, sus([4, 2, 5, 1, 4, 2, 5, 2, 4, 3])], // 80
            [12, sus([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])], // 100
            [99, sus([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])], // cuenta ajena al estudio: se ignora
          ])
        : new Map(),
    );
    const r = await service.resumen();
    expect(r.usabilidad.n_respuestas).toBe(2);
    expect(r.usabilidad.media.estimacion).toBe(90);
    expect(r.usabilidad.interpretacion?.calificativo).toBe('Excelente');
  });

  it('criterios: el sistema queda validado solo si los TRES se cumplen a la vez', async () => {
    prisma.logAdaptacion.findMany.mockResolvedValue(Array.from({ length: 40 }, () => log(11, true)));
    instrumentos.respuestasPorPersona.mockImplementation(async (clave: string) =>
      clave === 'SUS'
        ? new Map([[11, sus([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])], [12, sus([4, 2, 5, 1, 4, 2, 5, 2, 4, 3])]])
        : new Map([[5, iso(5)], [6, iso(4)]]),
    );
    const todos = await service.resumen();
    expect(todos.criterios.filas.map((c) => c.cumple)).toEqual([true, true, true]);
    expect(todos.criterios.satisfechos).toBe(3);
    expect(todos.criterios.sistema_validado).toBe(true);
    // Sin exámenes de unidad la hipótesis no se decide, aunque el producto esté validado.
    expect(todos.hipotesis.aceptada).toBeNull();

    // Basta con que falle la calidad para que el sistema NO quede validado.
    instrumentos.respuestasPorPersona.mockImplementation(async (clave: string) =>
      clave === 'SUS'
        ? new Map([[11, sus([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])], [12, sus([4, 2, 5, 1, 4, 2, 5, 2, 4, 3])]])
        : new Map([[5, iso(3)], [6, iso(3)]]),
    );
    const falla = await service.resumen();
    expect(falla.criterios.filas.map((c) => c.cumple)).toEqual([true, true, false]);
    expect(falla.criterios.sistema_validado).toBe(false);
  });

  it('rendimiento: decide la hipótesis con el PRIMER intento de cada unidad', async () => {
    const ex = (usuarioId: number, unidad: number, puntaje: number, dia: number) => ({
      usuarioId, unidadId: unidad, puntaje, fecha: new Date(`2026-10-${String(dia).padStart(2, '0')}T12:00:00Z`),
      unidad: { numero: unidad, titulo: `Unidad ${unidad}` },
    });
    prisma.usuario.findMany.mockResolvedValue([
      ...ESTUDIANTES,
      { id: 13, nombre: 'Eva Privada', paralelo: 'B', creadoEn: new Date(), ranking: null },
    ]);
    prisma.examenUnidad.findMany.mockResolvedValue([
      ex(11, 1, 90, 1), ex(11, 2, 80, 5),
      ex(12, 1, 60, 1), ex(12, 1, 100, 3), // el reintento con 100 NO cuenta
      ex(13, 1, 85, 2),
    ]);
    const r = await service.resumen();
    expect(r.rendimiento.n_estudiantes).toBe(3);
    expect(r.rendimiento.n_reintentos_excluidos).toBe(1);
    // promedios: 85, 60, 85 → media 76,7
    expect(r.rendimiento.media).toBe(76.7);
    expect(r.rendimiento.pct_80).toBe(66.7);
    expect(r.rendimiento.por_unidad[0]).toEqual({ unidad: 1, titulo: 'Unidad 1', n: 3, media: 78.3, pct_80: 66.7 });
    expect(r.rendimiento.contraste.calculado).toBe(true);
    expect(r.hipotesis.aceptada).toBe(false);

    const csv = await service.rendimientoCsv();
    const lineas = csv.split('\n');
    expect(lineas[0]).toBe('id_anonimo,paralelo,n_examenes,n_intentos_totales,u1_primer_intento,u2_primer_intento,promedio,alcanza_80');
    expect(lineas[2]).toBe('E-002,A,1,2,60,,60,0');
    expect(csv).not.toMatch(/Privad/);
  });

  it('los CSV salen anonimizados: sin nombre ni id interno', async () => {
    prisma.logAdaptacion.findMany.mockResolvedValue([log(11, true)]);
    instrumentos.respuestasPorPersona.mockResolvedValue(new Map([[11, sus([4, 2, 5, 1, 4, 2, 5, 2, 4, 3])]]));
    prisma.retoUsuario.groupBy.mockResolvedValue([]);
    prisma.historialRanking.groupBy.mockResolvedValue([]);
    prisma.consultaRanking.groupBy.mockResolvedValue([]);

    const csvLog = await service.logAdaptacionCsv();
    const csvSus = await service.susCsv();
    const csvUso = await service.usoGamificacionCsv();

    expect(csvLog.split('\n')[0]).toContain('id_anonimo,paralelo,tema,ejercicio_id');
    expect(csvLog.split('\n')[1].startsWith('E-001,A,1.2,10,')).toBe(true);
    expect(csvSus.split('\n')[1]).toBe('E-001,A,4,2,5,1,4,2,5,2,4,3,80,SUS-es-1');
    for (const csv of [csvLog, csvSus, csvUso]) {
      expect(csv).not.toMatch(/Privad|nombre|email|cedula/i);
    }
  });
});
