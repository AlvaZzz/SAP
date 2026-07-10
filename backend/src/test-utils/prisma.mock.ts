/**
 * Mock profundo de PrismaService para pruebas unitarias (sin base de datos).
 * Cada modelo expone jest.fn() por operación; $transaction ejecuta el callback
 * pasándole el propio mock (simula el TransactionClient).
 */
type AnyFn = jest.Mock;

function delegate(): Record<string, AnyFn> {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    aggregate: jest.fn(),
  };
}

export function crearPrismaMock() {
  const mock = {
    usuario: delegate(),
    nivel: delegate(),
    ejercicio: delegate(),
    intento: delegate(),
    progresoNivel: delegate(),
    evaluacion: delegate(),
    pretestRespuesta: delegate(),
    ranking: delegate(),
    logro: delegate(),
    logroUsuario: delegate(),
    consultaIa: delegate(),
    documento: delegate(),
    reto: delegate(),
    retoUsuario: delegate(),
    notificacion: delegate(),
    notaDocente: delegate(),
    codigoPractica: delegate(),
    configuracionSistema: delegate(),
    logAuditoria: delegate(),
    unidad: delegate(),
    tema: delegate(),
    progresoTema: delegate(),
    unidadCompletada: delegate(),
    preguntaGenerada: delegate(),
    rango: delegate(),
    desempenoUnidad: delegate(),
    postestControl: delegate(),
    perfilAdaptativo: delegate(),
    pasoRuta: delegate(),
    intentoSubidaNivel: delegate(),
    tokenRecuperacion: delegate(),
    historialTheta: delegate(),
    diagnosticoTema: delegate(),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn(),
  };
  // $transaction(cb) → ejecuta el callback con el propio mock como tx.
  mock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') return (arg as (tx: unknown) => Promise<unknown>)(mock);
    return Promise.all(arg as Promise<unknown>[]);
  });
  return mock;
}

export type PrismaMock = ReturnType<typeof crearPrismaMock>;
