import { RetosController } from './retos.controller';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';

/**
 * El detalle del reto muestra el ejercicio ORIGEN para que el estudiante repase
 * de dónde salió. Lo que nunca puede viajar es la SOLUCIÓN: ni la del reto ni la
 * del ejercicio origen (esta última resolvería el reto de un vistazo).
 */
describe('RetosController.detalle · trazabilidad sin filtrar soluciones', () => {
  let prisma: PrismaMock;
  let controller: RetosController;

  beforeEach(() => {
    prisma = crearPrismaMock();
    // El gating por nivel se prueba aparte; aquí se deja pasar para aislar la trazabilidad.
    const adaptatividad = { verificarAccesoReto: jest.fn().mockResolvedValue(undefined) };
    controller = new RetosController(prisma as never, {} as never, {} as never, {} as never, adaptatividad as never);
    prisma.retoUsuario.findUnique.mockResolvedValue(null);
  });

  const retoBase = {
    id: 7, titulo: 'Caza el bug', categoria: 'Cat', enunciado: 'Corrige el error',
    codigoInicial: 'S = 5', esBugHunt: true, autoCalificable: true,
    // Solución de referencia DEL RETO (se destructura fuera del payload).
    respuestaCorrecta: 'S = 5\nprint(S)',
    pistas: ['p1', 'p2', 'p3'],
    autor: { nombre: 'Docente' },
    tema: { numero: '1.5', titulo: 'Operadores', unidad: { numero: 1 } },
    origenEjercicio: {
      id: 99,
      enunciado: '¿Cuál es la salida del siguiente código?',
      fuenteDoc: { codigo: 'E1.5.I.06' },
      tipo: 'predecir_salida',
      codigoPython: 'S = 5\nprint(S)',
      opciones: [{ id: 'A', texto: '5 15 25' }],
      nivelDificultad: 'intermedio',
      tema: { numero: '1.5', titulo: 'Operadores', unidad: { numero: 1 } },
    },
  };

  it('expone el ejercicio origen con lo necesario para MOSTRARLO', async () => {
    prisma.reto.findFirst.mockResolvedValue(retoBase);
    const r = await controller.detalle(1, 'estudiante', 7);

    expect(r.reto!.origen).toMatchObject({
      ejercicio_id: 99,
      codigo: 'E1.5.I.06',
      tipo: 'predecir_salida',
      codigo_python: 'S = 5\nprint(S)',
      unidad: 1,
      tema: '1.5 Operadores',
    });
    // El enunciado va COMPLETO (la tarjeta ya no lo recorta).
    expect(r.reto!.origen!.enunciado).toBe('¿Cuál es la salida del siguiente código?');
  });

  it('NUNCA incluye la respuesta correcta (ni del reto ni del origen)', async () => {
    prisma.reto.findFirst.mockResolvedValue(retoBase);
    const r = await controller.detalle(1, 'estudiante', 7);

    const payload = JSON.stringify(r);
    expect(payload).not.toMatch(/respuestaCorrecta/);
    expect(payload).not.toMatch(/explicacionIa/);
    // Tampoco las pistas en crudo: se sirven de a una desde PREXI.
    expect(payload).not.toMatch(/"pistas"/);
    expect(r.reto!.total_pistas).toBe(3);
  });

  it('no se consulta la respuesta del ejercicio origen en la BD', async () => {
    prisma.reto.findFirst.mockResolvedValue(retoBase);
    await controller.detalle(1, 'estudiante', 7);

    const select = JSON.stringify(prisma.reto.findFirst.mock.calls[0][0]);
    expect(select).toMatch(/origenEjercicio/);
    expect(select).not.toMatch(/respuestaCorrecta/);
  });

  it('un reto sin origen (escrito por el docente) devuelve origen null', async () => {
    prisma.reto.findFirst.mockResolvedValue({ ...retoBase, origenEjercicio: null });
    const r = await controller.detalle(1, 'estudiante', 7);
    expect(r.reto!.origen).toBeNull();
  });
});
