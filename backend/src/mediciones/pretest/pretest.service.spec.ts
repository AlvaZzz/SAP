import { BadRequestException } from '@nestjs/common';
import { PretestService } from './pretest.service';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';

/** Fila de respuesta simulada (lo que devuelve pretestRespuesta.findMany con include). */
interface RespFake {
  temaId: number;
  correcto: boolean;
  ejercicio: { dificultadB: number };
  tema: { id: number; numero: string; titulo: string; unidad: { numero: number } };
}

describe('PretestService (diagnóstico por tema con IRT)', () => {
  let prisma: PrismaMock;
  let service: PretestService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new PretestService(prisma as never);
  });

  /** Arma un tema con sus respuestas simuladas. */
  function tema(temaId: number, numero: string, titulo: string, unidad: number, resp: { b: number; correcto: boolean }[]): RespFake[] {
    return resp.map((r) => ({
      temaId, correcto: r.correcto, ejercicio: { dificultadB: r.b },
      tema: { id: temaId, numero, titulo, unidad: { numero: unidad } },
    }));
  }

  /** Configura los mocks del flujo finalizar() con un conjunto de respuestas por tema. */
  function simular(filas: RespFake[]) {
    // count(respondidas) → cualquier valor > 0 pasa el candado anti-blanco.
    prisma.pretestRespuesta.count.mockResolvedValue(filas.length);
    prisma.pretestRespuesta.findMany.mockResolvedValue(filas);
    prisma.nivel.findMany.mockResolvedValue([]);
    prisma.usuario.findUnique.mockResolvedValue({ nivelInicialAdaptativo: null });
  }

  it('finaliza estimando θ y nivel POR TEMA y agrega el puntaje global', async () => {
    // Tema 1.1: acierta fáciles y falla el difícil → nivel bajo. Tema 2.4: acierta todo → alto.
    const filas = [
      ...tema(11, '1.1', 'Algoritmos', 1, [{ b: -1, correcto: true }, { b: 0, correcto: false }, { b: 1, correcto: false }]),
      ...tema(24, '2.4', 'Bucles', 2, [{ b: -1, correcto: true }, { b: 0, correcto: true }, { b: 1, correcto: true }]),
    ];
    simular(filas);

    const r = await service.finalizar(7, 300);

    expect(r.total).toBe(6);
    expect(r.aciertos).toBe(4);
    expect(r.puntaje).toBe(67); // 4/6
    expect(r.por_tema).toHaveLength(2);
    const t11 = r.por_tema.find((t) => t.numero === '1.1')!;
    const t24 = r.por_tema.find((t) => t.numero === '2.4')!;
    expect(t11.total).toBe(3);
    expect(t11.aciertos).toBe(1);
    expect(t24.aciertos).toBe(3);
    // El tema con todo correcto queda en nivel avanzado; el flojo, básico.
    expect(t24.nivel).toBe('avanzado');
    expect(t11.nivel).toBe('basico');
    // Persiste el diagnóstico por tema y siembra la adaptatividad (ProgresoTema).
    expect(prisma.diagnosticoTema.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.progresoTema.upsert).toHaveBeenCalledTimes(2);
    // Persiste la Evaluacion global y marca el diagnóstico completado.
    expect(prisma.evaluacion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ tipo: 'pre', puntajeTotal: 67 }) }),
    );
    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pretestCompletado: true }) }),
    );
  });

  it('clasifica fortalezas (no básico) y debilidades (básico) por tema', async () => {
    const filas = [
      ...tema(11, '1.1', 'Algoritmos', 1, [{ b: -1, correcto: false }, { b: 0, correcto: false }, { b: 1, correcto: false }]), // todo mal → básico
      ...tema(24, '2.4', 'Bucles', 2, [{ b: -1, correcto: true }, { b: 0, correcto: true }, { b: 1, correcto: true }]), // todo bien → avanzado
    ];
    simular(filas);
    const r = await service.finalizar(7);
    expect(r.debilidades).toContain('Algoritmos');
    expect(r.fortalezas).toContain('Bucles');
  });

  it('fija θ_inicial y nivel global PERMANENTES la primera vez (historialTheta origen pretest)', async () => {
    const filas = tema(24, '2.4', 'Bucles', 2, [{ b: -1, correcto: true }, { b: 0, correcto: true }, { b: 1, correcto: true }]);
    simular(filas);

    const r = await service.finalizar(7);

    expect(r.theta).not.toBeNull();
    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ thetaInicial: r.theta, nivelInicialAdaptativo: r.nivel_adaptativo }) }),
    );
    expect(prisma.historialTheta.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ origen: 'pretest' }) }),
    );
  });

  it('NO re-escribe θ_inicial ni el nivel global si ya estaban fijados (permanente)', async () => {
    const filas = tema(11, '1.1', 'Algoritmos', 1, [{ b: -1, correcto: true }, { b: 0, correcto: true }, { b: 1, correcto: false }]);
    simular(filas);
    prisma.usuario.findUnique.mockResolvedValue({ nivelInicialAdaptativo: 'basico' }); // ya fijado

    await service.finalizar(7);

    const dataUpdate = prisma.usuario.update.mock.calls[0][0].data;
    expect(dataUpdate.nivelInicialAdaptativo).toBeUndefined();
    expect(dataUpdate.thetaInicial).toBeUndefined();
    expect(dataUpdate.pretestCompletado).toBe(true);
    expect(prisma.historialTheta.create).not.toHaveBeenCalled();
  });

  it('nivel global avanzado arranca en nivel 2 y desbloquea niveles 1 y 2', async () => {
    const filas = tema(24, '2.4', 'Bucles', 2, [{ b: 0, correcto: true }, { b: 1, correcto: true }, { b: 2, correcto: true }]);
    simular(filas);
    prisma.nivel.findMany.mockResolvedValue([{ id: 1, numero: 1 }, { id: 2, numero: 2 }, { id: 3, numero: 3 }]);

    const r = await service.finalizar(7);

    expect(r.nivel_adaptativo).toBe('avanzado');
    expect(r.nivel_inicial).toBe(2);
    const desbloqueados = prisma.progresoNivel.upsert.mock.calls.map((c) => c[0].create.nivelId);
    expect(desbloqueados).toEqual([1, 2]);
  });

  it('estado de un diagnóstico completado se reconstruye desde DiagnosticoTema + Evaluacion', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      pretestCompletado: true, nivelInicial: 2, thetaInicial: 1.2, nivelInicialAdaptativo: 'avanzado',
    });
    prisma.diagnosticoTema.findMany.mockResolvedValue([
      { temaId: 24, aciertos: 3, total: 3, puntaje: 100, theta: 2.0, nivel: 'avanzado', tema: { numero: '2.4', titulo: 'Bucles', unidad: { numero: 2 } } },
    ]);
    prisma.evaluacion.findUnique.mockResolvedValue({ puntajeTotal: 100, porCategoria: [] });

    const { completado, resultado } = await service.estado(7);

    expect(completado).toBe(true);
    expect(resultado?.puntaje).toBe(100);
    expect(resultado?.nivel_adaptativo).toBe('avanzado');
    expect(resultado?.por_tema).toHaveLength(1);
    expect(resultado?.por_tema[0].titulo).toBe('Bucles');
  });

  it('finalizar rechaza un diagnóstico EN BLANCO (no persiste ni lo marca completado)', async () => {
    prisma.pretestRespuesta.count.mockResolvedValue(0);
    await expect(service.finalizar(7)).rejects.toThrow(BadRequestException);
    expect(prisma.evaluacion.upsert).not.toHaveBeenCalled();
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('responder rechaza una pregunta que no pertenece al diagnóstico del usuario', async () => {
    prisma.pretestRespuesta.findUnique.mockResolvedValue(null);
    await expect(service.responder(7, 999, 'A')).rejects.toThrow(BadRequestException);
  });

  it('responder evalúa la corrección en el backend (case-insensitive)', async () => {
    prisma.pretestRespuesta.findUnique.mockResolvedValue({ ejercicio: { respuestaCorrecta: 'B' } });
    await service.responder(7, 1, ' b ');
    expect(prisma.pretestRespuesta.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { opcionDada: ' b ', correcto: true } }),
    );
  });
});
