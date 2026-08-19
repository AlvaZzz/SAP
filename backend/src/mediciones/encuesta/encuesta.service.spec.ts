/**
 * Pruebas del módulo de encuesta (MSLQ).
 *
 * Lo que fijan, en orden de importancia:
 *  1. Que el sistema se NIEGUE a aplicar la encuesta si los ítems oficiales no
 *     están cargados. Es la garantía de que nunca se recogerá un dato con un
 *     instrumento vacío o de prueba.
 *  2. Que la escala sea de 7 puntos y la recodificación de inversos sea 8−v.
 *  3. Que el puntaje use la MEDIA por subescala, para que las subescalas de
 *     distinta longitud pesen igual.
 */

import { ServiceUnavailableException } from '@nestjs/common';
import { EncuestaService } from './encuesta.service';
import {
  ESCALA_MAX, ESCALA_MIN, ITEMS, SUBESCALAS, instrumentoCargado, puntuar,
  type ItemMslq,
} from './instrumento';
import { crearPrismaMock } from '../../test-utils/prisma.mock';

describe('instrumento MSLQ — configuración', () => {
  it('la escala es de 1 a 7 (la del MSLQ), no de 1 a 5', () => {
    // Cambiar esto rompería la comparabilidad con los baremos publicados.
    expect(ESCALA_MIN).toBe(1);
    expect(ESCALA_MAX).toBe(7);
  });

  it('declara las tres subescalas de motivación que usa la tesis', () => {
    expect(SUBESCALAS.map((s) => s.clave).sort()).toEqual(
      ['autoeficacia', 'metas_intrinsecas', 'valoracion_tarea'],
    );
  });

  it('NO contiene ítems inventados: la lista está vacía hasta cargar el oficial', () => {
    // Si esta prueba falla es porque alguien cargó ítems. Está bien —
    // entonces hay que actualizarla y comprobar que son los del MSLQ real.
    // Lo que NUNCA debe pasar es que vuelvan ítems redactados por IA.
    expect(ITEMS).toHaveLength(0);
    expect(instrumentoCargado()).toBe(false);
  });

  it('el alfa de referencia solo se declara donde hay una fuente citable', () => {
    // No se inventa un número para rellenar la comparación con la literatura.
    for (const s of SUBESCALAS) {
      if (s.alfaReferencia === null) expect(s.fuenteAlfa).toBeNull();
      else expect(typeof s.fuenteAlfa).toBe('string');
    }
  });

  it('recodifica los ítems inversos como 8 − valor (escala de 7)', () => {
    const directo: ItemMslq = { codigo: 'x', subescala: 'autoeficacia', texto: '', numeroOriginal: 1 };
    const inverso: ItemMslq = { ...directo, inverso: true };
    expect(puntuar(directo, 6)).toBe(6);
    expect(puntuar(inverso, 6)).toBe(2);   // 8 − 6
    expect(puntuar(inverso, 1)).toBe(7);   // extremo → extremo opuesto
    expect(puntuar(inverso, 4)).toBe(4);   // el centro se mantiene
  });
});

describe('EncuestaService sin instrumento cargado', () => {
  const prisma = crearPrismaMock();
  const service = new EncuestaService(prisma as never);

  it('NO entrega el cuestionario y explica qué falta', async () => {
    await expect(service.cuestionario(1, 'pre')).rejects.toThrow(ServiceUnavailableException);
    await expect(service.cuestionario(1, 'pre')).rejects.toThrow(/items-mslq\.ts/);
  });

  it('NO acepta respuestas', async () => {
    await expect(service.responder(1, 'pre', [{ itemId: 'vt1', valor: 5 }]))
      .rejects.toThrow(ServiceUnavailableException);
  });

  it('el estado lo declara en vez de mentir diciendo "completada"', async () => {
    prisma.respuestaEncuesta.count.mockResolvedValue(0);
    const e = await service.estado(1);
    expect(e.instrumento_cargado).toBe(false);
    expect(e.pre_completada).toBe(false);
    expect(e.post_completada).toBe(false);
  });

  it('info() informa del problema con un mensaje accionable', () => {
    const i = service.info();
    expect(i.cargado).toBe(false);
    expect(i.total_items).toBe(0);
    expect(i.mensaje).toContain('items-mslq.ts');
  });
});

describe('EncuestaService — puntuación', () => {
  const prisma = crearPrismaMock();
  const service = new EncuestaService(prisma as never);

  it('con el instrumento vacío no inventa un puntaje', () => {
    const r = service.puntuar([{ itemId: 'inexistente', valor: 7 }]);
    expect(r.puntaje_total).toBeNull();
    expect(r.items_respondidos).toBe(0);
  });

  it('devuelve siempre las tres subescalas, aunque estén sin datos', () => {
    // La pantalla debe poder mostrar la estructura completa desde el principio.
    const r = service.puntuar([]);
    expect(r.por_subescala).toHaveLength(3);
    expect(r.por_subescala.every((s) => s.media === null)).toBe(true);
  });
});

describe('referencia bibliográfica', () => {
  it('cita el instrumento original y deja la adaptación parametrizada', async () => {
    const { REFERENCIA } = await import('./instrumento');
    expect(REFERENCIA.original).toContain('Pintrich');
    expect(REFERENCIA.original).toContain('1991');
    // La adaptación al español la aprueba la tutora: hasta entonces, pendiente.
    expect(typeof REFERENCIA.adaptacion).toBe('string');
    expect(REFERENCIA.uso).toContain('University of Michigan');
  });
});
