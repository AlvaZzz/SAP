import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ITEMS_SUS, interpretarSus, puntajeSus } from './sus';
import { InstrumentosService } from './instrumentos.service';
import { puntuarCalidad } from '../calidad/calidad';
import {
  CARACTERISTICAS_ISO25010, MAX_ITEMS_POR_CARACTERISTICA, itemsIso25010,
} from '../calidad/items-iso25010';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';

/** Construye { S01: v1, …, S10: v10 } a partir de los 10 valores en orden. */
const sus = (valores: number[]) => Object.fromEntries(ITEMS_SUS.map((it, i) => [it.id, valores[i]]));

describe('SUS — puntuación de Brooke (1996)', () => {
  it('tiene 10 ítems', () => {
    expect(ITEMS_SUS).toHaveLength(10);
  });

  it('coincide con un cálculo manual', () => {
    // Respuestas: 4 2 5 1 4 2 5 2 4 3
    //  impares (r−1): 3 + 4 + 3 + 4 + 3 = 17
    //  pares  (5−r):  3 + 4 + 3 + 3 + 2 = 15
    //  (17 + 15) × 2,5 = 80
    expect(puntajeSus(sus([4, 2, 5, 1, 4, 2, 5, 2, 4, 3]))).toBe(80);
  });

  it('los extremos dan 100 y 0', () => {
    expect(puntajeSus(sus([5, 1, 5, 1, 5, 1, 5, 1, 5, 1]))).toBe(100);
    expect(puntajeSus(sus([1, 5, 1, 5, 1, 5, 1, 5, 1, 5]))).toBe(0);
  });

  it('marcar todo "3" da 50, no 60: no es la simple suma de respuestas', () => {
    expect(puntajeSus(sus([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]))).toBe(50);
  });

  it('un cuestionario incompleto o con valores fuera de rango no se puntúa', () => {
    const incompleto = sus([4, 2, 5, 1, 4, 2, 5, 2, 4, 3]);
    delete incompleto.S07;
    expect(puntajeSus(incompleto)).toBeNull();
    expect(puntajeSus(sus([6, 2, 5, 1, 4, 2, 5, 2, 4, 3]))).toBeNull();
  });

  it('interpreta con la escala adjetival de la tesis (Bangor et al., 2009)', () => {
    expect(interpretarSus(45).calificativo).toBe('Deficiente');
    expect(interpretarSus(60).calificativo).toBe('Aceptable con reservas');
    expect(interpretarSus(69).calificativo).toBe('Bueno');
    expect(interpretarSus(80).calificativo).toBe('Bueno');
    expect(interpretarSus(85).calificativo).toBe('Excelente');
  });
});

describe('ISO/IEC 25010 — estructura y puntuación', () => {
  it('usa las 6 características seleccionadas en la tesis', () => {
    expect(CARACTERISTICAS_ISO25010.map((c) => c.clave)).toEqual([
      'adecuacion_funcional', 'eficiencia_desempeno', 'capacidad_interaccion',
      'fiabilidad', 'seguridad', 'mantenibilidad',
    ]);
  });

  it('ids de ítem únicos y como máximo 10 ítems por característica', () => {
    const ids = itemsIso25010().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CARACTERISTICAS_ISO25010) {
      const n = c.subcaracteristicas.reduce((a, s) => a + s.items.length, 0);
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThanOrEqual(MAX_ITEMS_POR_CARACTERISTICA);
    }
  });

  // Instrumento mínimo para verificar la aritmética a mano.
  const MINI = [
    {
      clave: 'c1', nombre: 'C1', justificacion: '',
      subcaracteristicas: [
        { clave: 's1', nombre: 'S1', items: [{ id: 'A', texto: '' }] },
        { clave: 's2', nombre: 'S2', items: [{ id: 'B', texto: '' }] },
      ],
    },
    {
      clave: 'c2', nombre: 'C2', justificacion: '',
      subcaracteristicas: [{ clave: 's3', nombre: 'S3', items: [{ id: 'C', texto: '' }] }],
    },
  ];

  it('media por característica y % de subcaracterísticas en nivel aceptable', () => {
    // Evaluador 1: A=5 B=3 C=4 · Evaluador 2: A=4 B=3 C=5
    //  s1 = (5+4)/2 = 4,5 ✔   s2 = 3 ✘   s3 = 4,5 ✔  → 2 de 3 = 66,7 %
    //  c1 = media de [(5+3)/2, (4+3)/2] = media de [4; 3,5] = 3,75 ✘
    //  c2 = 4,5 ✔
    const r = puntuarCalidad([{ A: 5, B: 3, C: 4 }, { A: 4, B: 3, C: 5 }], 4, MINI);
    expect(r.n_evaluadores).toBe(2);
    expect(r.caracteristicas[0].media).toBe(3.75);
    expect(r.caracteristicas[0].aceptable).toBe(false);
    expect(r.caracteristicas[1].media).toBe(4.5);
    expect(r.caracteristicas[0].subcaracteristicas.map((s) => s.media)).toEqual([4.5, 3]);
    expect(r.subcaracteristicas_aceptables).toBe(2);
    expect(r.pct_subcaracteristicas_aceptables).toBe(66.7);
    expect(r.todas_aceptables).toBe(false);
  });

  it('el nivel aceptable es configurable', () => {
    const r = puntuarCalidad([{ A: 5, B: 3, C: 4 }, { A: 4, B: 3, C: 5 }], 3, MINI);
    expect(r.pct_subcaracteristicas_aceptables).toBe(100);
    expect(r.todas_aceptables).toBe(true);
  });

  it('sin evaluadores no emite cifras', () => {
    const r = puntuarCalidad([], 4, MINI);
    expect(r.pct_subcaracteristicas_aceptables).toBeNull();
    expect(r.todas_aceptables).toBeNull();
    expect(r.caracteristicas[0].media).toBeNull();
  });
});

describe('InstrumentosService — una sola aplicación, con la fase habilitada', () => {
  let prisma: PrismaMock;
  let service: InstrumentosService;
  const completas = ITEMS_SUS.map((i) => ({ itemId: i.id, valor: 4 }));

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new InstrumentosService(prisma as never);
    prisma.configuracionSistema.findUnique.mockResolvedValue({ faseEvaluacionActiva: true });
    prisma.respuestaInstrumento.count.mockResolvedValue(0);
  });

  it('al estudiante le toca el SUS; al docente, ISO/IEC 25010', async () => {
    expect((await service.estado(7, 'estudiante')).instrumentos.map((i) => i.clave)).toEqual(['SUS']);
    expect((await service.estado(3, 'docente')).instrumentos.map((i) => i.clave)).toEqual(['ISO25010']);
    expect((await service.estado(9, 'investigador')).instrumentos).toEqual([]);
  });

  it('con la fase apagada no hay pendientes ni se puede responder', async () => {
    prisma.configuracionSistema.findUnique.mockResolvedValue({ faseEvaluacionActiva: false });
    expect((await service.estado(7, 'estudiante')).pendientes).toBe(0);
    await expect(service.responder(7, 'estudiante', 'SUS', completas, true)).rejects.toThrow(ForbiddenException);
  });

  it('guarda el SUS completo con su versión', async () => {
    const r = await service.responder(7, 'estudiante', 'SUS', completas, true);
    expect(r).toMatchObject({ guardado: true, total_items: 10 });
    const { data } = prisma.respuestaInstrumento.createMany.mock.calls[0][0];
    expect(data).toHaveLength(10);
    expect(data[0]).toMatchObject({ usuarioId: 7, instrumento: 'SUS', itemId: 'S01', valor: 4, version: 'SUS-es-1' });
  });

  it('no se puede responder dos veces', async () => {
    prisma.respuestaInstrumento.count.mockResolvedValue(10);
    await expect(service.responder(7, 'estudiante', 'SUS', completas, true)).rejects.toThrow(ConflictException);
    expect(prisma.respuestaInstrumento.createMany).not.toHaveBeenCalled();
  });

  it('rechaza un cuestionario incompleto, sin consentimiento o de otro rol', async () => {
    await expect(service.responder(7, 'estudiante', 'SUS', completas.slice(0, 9), true)).rejects.toThrow(BadRequestException);
    await expect(service.responder(7, 'estudiante', 'SUS', completas, false)).rejects.toThrow(BadRequestException);
    await expect(service.responder(7, 'estudiante', 'ISO25010', completas, true)).rejects.toThrow(ForbiddenException);
    await expect(service.responder(3, 'docente', 'SUS', completas, true)).rejects.toThrow(ForbiddenException);
  });
});
