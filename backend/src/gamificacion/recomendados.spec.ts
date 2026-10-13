import { GamificacionService } from './gamificacion.service';
import { crearPrismaMock, PrismaMock } from '../test-utils/prisma.mock';

/**
 * Motor de recomendación "Recomendado por PREXI" (reglas sobre datos reales):
 * prioriza temas con fallos / θ bajo / cercanía al umbral, solo de unidades y
 * temas DESBLOQUEADOS, con ejercicios del nivel actual aún no resueltos.
 */
describe('GamificacionService.recomendados (motor de reglas)', () => {
  let prisma: PrismaMock;
  let service: GamificacionService;

  const unidades = [
    {
      id: 1, numero: 1, temas: [
        {
          id: 10, numero: '1.1', titulo: 'Concepto de algoritmo', umbral: 10,
          // Tema 1.1 completo (10 de 10): abre el 1.2.
          progreso: [{ ejerciciosCompletados: 10, nivelActual: 'intermedio' }], subtemas: [],
        },
        {
          id: 11, numero: '1.2', titulo: 'Tipos de datos y variables', umbral: 10,
          progreso: [{ ejerciciosCompletados: 0, nivelActual: 'basico' }], subtemas: [],
        },
      ],
    },
    {
      // Unidad 2 BLOQUEADA: el examen de la U1 no está aprobado.
      id: 2, numero: 2, temas: [
        { id: 30, numero: '2.1', titulo: 'Condicionales', umbral: 10, progreso: [{ desbloqueado: true, nivelActual: 'basico' }], subtemas: [] },
      ],
    },
  ];

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new GamificacionService(prisma as never);
    prisma.usuario.findUnique.mockResolvedValue({ nivelInicialAdaptativo: 'basico' });
    prisma.unidad.findMany.mockResolvedValue(unidades);
    prisma.examenUnidad.findMany.mockResolvedValue([]); // U1 sin examen aprobado → U2 bloqueada
    prisma.intento.findMany.mockResolvedValue([
      { ejercicioId: 100, correcto: true, ejercicio: { temaId: 10 } },
      { ejercicioId: 101, correcto: false, ejercicio: { temaId: 11 } },
      { ejercicioId: 102, correcto: false, ejercicio: { temaId: 11 } },
    ]);
    prisma.historialTheta.findMany.mockResolvedValue([
      { temaId: 10, theta: 1.2 },
      { temaId: 11, theta: 0.3 },
    ]);
    prisma.ejercicio.findMany.mockResolvedValue([
      { id: 200, titulo: 'Asignación de variables de texto', xp: 40, temaId: 11, nivelDificultad: 'basico', tipo: 'opcion_multiple', categoria: 'Variables' },
      { id: 210, titulo: 'Pasos de un algoritmo (básico)', xp: 30, temaId: 10, nivelDificultad: 'basico', tipo: 'opcion_multiple', categoria: 'Algoritmo' },
      { id: 211, titulo: 'Ordenar un algoritmo (intermedio)', xp: 50, temaId: 10, nivelDificultad: 'intermedio', tipo: 'ordenar_lineas', categoria: 'Algoritmo' },
    ]);
  });

  it('prioriza el tema con fallos y explica la razón con los números reales', async () => {
    const r = await service.recomendados(7);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]).toMatchObject({
      id: 200,
      titulo: 'Asignación de variables de texto',
      nivel: 'basico',
      nivel_label: 'Básico',
      unidad_numero: 1,
      tema_numero: '1.2',
      tema_titulo: 'Tipos de datos y variables',
      razon: 'Fallaste 2 ejercicios de este tema',
      xp: 40,
    });
  });

  it('elige el ejercicio del NIVEL ACTUAL del estudiante en ese tema', async () => {
    const r = await service.recomendados(7);
    const deTema10 = r.find((x) => x.tema_numero === '1.1');
    // En el tema 1.1 el estudiante está en Intermedio → recomienda el intermedio (211), no el básico (210).
    expect(deTema10?.id).toBe(211);
    expect(deTema10?.nivel).toBe('intermedio');
  });

  it('excluye unidades bloqueadas y resueltos: la consulta pide solo temas desbloqueados y notIn resueltos', async () => {
    await service.recomendados(7);
    expect(prisma.ejercicio.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          temaId: { in: [10, 11] },      // el tema 30 (U2 bloqueada) NO entra
          id: { notIn: [100] },          // el ya resuelto correctamente NO entra
        }),
      }),
    );
    const r = await service.recomendados(7);
    expect(r.every((x) => x.unidad_numero === 1)).toBe(true);
  });

  it('sin temas candidatos devuelve lista vacía (estado "estás al día")', async () => {
    prisma.unidad.findMany.mockResolvedValue([]);
    const r = await service.recomendados(7);
    expect(r).toEqual([]);
  });

  it('si el título sembrado es un fragmento de código, muestra "tipo: categoría"', async () => {
    prisma.ejercicio.findMany.mockResolvedValue([
      { id: 300, titulo: 'x = 0', xp: 30, temaId: 11, nivelDificultad: 'basico', tipo: 'predecir_salida', categoria: 'Bucles' },
      { id: 301, titulo: 'def op(a, b):', xp: 40, temaId: 10, nivelDificultad: 'intermedio', tipo: 'completar_codigo', categoria: 'Funciones' },
    ]);
    const r = await service.recomendados(7);
    const titulos = r.map((x) => x.titulo);
    expect(titulos).toContain('Predecir la salida: Bucles');
    expect(titulos).toContain('Completar el código: Funciones');
    expect(titulos.some((t) => t.includes('='))).toBe(false); // nada de código suelto
  });
});
