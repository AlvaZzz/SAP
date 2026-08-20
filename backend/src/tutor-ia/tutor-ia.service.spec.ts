import { HttpException } from '@nestjs/common';
import { TutorIaService } from './tutor-ia.service';
import { crearPrismaMock, PrismaMock } from '../test-utils/prisma.mock';

/** ConfigService simulado: expone la clave de Gemini para el test. */
function crearConfig(overrides: Record<string, string | undefined> = {}) {
  const valores: Record<string, string | undefined> = { GEMINI_API_KEY: 'test-key', ...overrides };
  return { get: (k: string) => valores[k] } as never;
}

/** Cliente de Gemini simulado (sin red): responde texto fijo y un stream fijo. */
function inyectarGeminiFake(service: TutorIaService, texto = 'Guía simulada. AREA_DEBIL: bucles') {
  const model = {
    generateContent: jest.fn().mockResolvedValue({ response: { text: () => texto } }),
    generateContentStream: jest.fn().mockResolvedValue({
      stream: (async function* () { yield { text: () => 'Hola ' }; yield { text: () => 'mundo' }; })(),
    }),
  };
  (service as unknown as { client: unknown }).client = { getGenerativeModel: () => model };
  return model;
}

describe('TutorIaService (ALVARO enriquecido)', () => {
  let prisma: PrismaMock;
  let service: TutorIaService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    // Config central: IA activa. getModel hace .catch() → debe resolver.
    prisma.configuracionSistema.findUnique.mockResolvedValue({ iaActiva: true, modeloIa: 'gemini-2.5-flash-lite', maxPistasIa: 3 });
    // Perfil del estudiante. El nivel sale de la clasificación YA PERSISTIDA
    // (derivada de θ), NO del % del pretest: ALVARO no clasifica por su cuenta.
    // Ver docs/CLASIFICACION_NIVELES.md.
    prisma.usuario.findUnique.mockResolvedValue({
      nombre: 'Juan Pérez', nivelInicialAdaptativo: 'basico', thetaActual: -1.2,
    });
    prisma.evaluacion.findUnique.mockResolvedValue({ puntajeTotal: 40, porCategoria: [{ categoria: 'Bucles', porcentaje: 20 }] });
    prisma.tema.findUnique.mockResolvedValue(null);
    prisma.documento.findFirst.mockResolvedValue(null);
    prisma.consultaIa.create.mockResolvedValue({});
    service = new TutorIaService(crearConfig(), prisma as never);
  });

  it('asistente: responde y registra la consulta en consultas_ia', async () => {
    const model = inyectarGeminiFake(service, 'Piensa en el concepto de bucle.');
    const r = await service.asistente(7, '¿Qué es un for?', 'Bucles');
    expect(r.respuesta).toBe('Piensa en el concepto de bucle.');
    // El system prompt incluye el perfil (nivel diagnosticado) y el tono por nivel.
    const systemEnviado = model.generateContent.mock.calls[0][0][0].text as string;
    expect(systemEnviado).toContain('NIVEL DEL ESTUDIANTE: principiante');
    expect(systemEnviado).toContain('Nivel diagnosticado: Bajo');
    expect(prisma.consultaIa.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'asistente' }) }),
    );
  });

  /**
   * REGLA ÚNICA DE CLASIFICACIÓN. ALVARO clasificaba antes por su cuenta con
   * cortes propios sobre el % del pretest (<50 / ≤75 / >75), lo que podía
   * contradecir al resto del sistema. Ahora lee la clasificación persistida.
   */
  it('usa la clasificación persistida y NO el porcentaje del pretest', async () => {
    // Pretest bajo (30 %) pero clasificado AVANZADO por θ: manda la clasificación.
    prisma.usuario.findUnique.mockResolvedValue({
      nombre: 'Ana', nivelInicialAdaptativo: 'avanzado', thetaActual: 1.4,
    });
    prisma.evaluacion.findUnique.mockResolvedValue({ puntajeTotal: 30, porCategoria: [] });

    const model = inyectarGeminiFake(service, 'ok');
    await service.asistente(7, '¿Qué es un for?', 'Bucles');
    const systemEnviado = model.generateContent.mock.calls[0][0][0].text as string;
    expect(systemEnviado).toContain('NIVEL DEL ESTUDIANTE: avanzado');
  });

  it('sin clasificación persistida deriva el nivel de θ', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      nombre: 'Luis', nivelInicialAdaptativo: null, thetaActual: -2,
    });
    prisma.evaluacion.findUnique.mockResolvedValue(null);

    const model = inyectarGeminiFake(service, 'ok');
    await service.asistente(7, 'hola', 'Bucles');
    const systemEnviado = model.generateContent.mock.calls[0][0][0].text as string;
    expect(systemEnviado).toContain('NIVEL DEL ESTUDIANTE: principiante');
  });

  it('sin ningún dato no asume nivel: trata al estudiante como intermedio', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      nombre: 'Sin diagnóstico', nivelInicialAdaptativo: null, thetaActual: null,
    });
    prisma.evaluacion.findUnique.mockResolvedValue(null);

    const model = inyectarGeminiFake(service, 'ok');
    await service.asistente(7, 'hola', 'Bucles');
    const systemEnviado = model.generateContent.mock.calls[0][0][0].text as string;
    expect(systemEnviado).toContain('NIVEL DEL ESTUDIANTE: intermedio');
  });

  it('asistenteStream: emite chunks en orden y registra el texto completo', async () => {
    inyectarGeminiFake(service);
    const chunks: string[] = [];
    for await (const c of service.asistenteStream(7, '¿Qué es un for?')) chunks.push(c);
    expect(chunks).toEqual(['Hola ', 'mundo']);
    expect(prisma.consultaIa.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'asistente', respuesta: 'Hola mundo' }) }),
    );
  });

  it('retroalimentación: prioriza el patrón de error detectado como área débil', async () => {
    inyectarGeminiFake(service, 'Revisa el operador. AREA_DEBIL: comparación');
    prisma.ejercicio.findUnique.mockResolvedValue({
      enunciado: 'Completa la condición', categoria: 'Condicionales', respuestaCorrecta: 'x == 5',
      explicacionIa: 'Compara con ==', codigoPython: null, temaId: null,
    });
    // Intentos con un error recurrente (= en vez de ==).
    prisma.intento.findMany.mockResolvedValue([
      { correcto: false, respuestaDada: 'if x = 5', tiempoSeg: 30, ejercicio: { categoria: 'Condicionales', tipo: 'completar_codigo', respuestaCorrecta: 'if x == 5' } },
    ]);
    const r = await service.retroalimentacion(7, 3, 'if x = 5');
    expect(r.explicacion).not.toContain('AREA_DEBIL');
    expect(r.area_debil).toContain('asignacion'); // viene del patrón detectado
  });

  it('pista: rechaza un nivel por encima del máximo permitido', async () => {
    inyectarGeminiFake(service);
    prisma.configuracionSistema.findUnique.mockResolvedValue({ iaActiva: true, modeloIa: 'gemini-2.5-flash-lite', maxPistasIa: 2 });
    prisma.ejercicio.findUnique.mockResolvedValue({ enunciado: 'x', codigoPython: null, categoria: 'Bucles', maxPistas: 3, temaId: null });
    await expect(service.pista(7, 3, 3)).rejects.toBeInstanceOf(HttpException);
  });

  it('pista: dentro del límite responde y registra el nivel', async () => {
    inyectarGeminiFake(service, 'Pista 1: piensa en el concepto.');
    prisma.ejercicio.findUnique.mockResolvedValue({ enunciado: 'x', codigoPython: null, categoria: 'Bucles', maxPistas: 3, temaId: null });
    const r = await service.pista(7, 3, 1);
    expect(r.pista).toContain('Pista 1');
    expect(prisma.consultaIa.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'pista', nivelPista: 1 }) }),
    );
  });

  it('si la IA está desactivada por el admin, lanza excepción y no llama a Gemini', async () => {
    prisma.configuracionSistema.findUnique.mockResolvedValue({ iaActiva: false });
    const model = inyectarGeminiFake(service);
    await expect(service.asistente(7, 'hola')).rejects.toBeInstanceOf(HttpException);
    expect(model.generateContent).not.toHaveBeenCalled();
  });

  it('reintenta UNA vez ante un 429 con espera CORTA y luego responde', async () => {
    let n = 0;
    const model = {
      generateContent: jest.fn().mockImplementation(() => {
        n++;
        if (n === 1) return Promise.reject(new Error('[429 Too Many Requests] quota exceeded. Please retry in 0.1s'));
        return Promise.resolve({ response: { text: () => 'Respuesta tras reintento' } });
      }),
      generateContentStream: jest.fn(),
    };
    (service as unknown as { client: unknown }).client = { getGenerativeModel: () => model };
    const r = await service.asistente(7, 'hola');
    expect(r.respuesta).toBe('Respuesta tras reintento');
    expect(model.generateContent).toHaveBeenCalledTimes(2); // 1 fallo + 1 reintento OK
  });

  it('NO reintenta ante un 429 con espera LARGA (>8s): mensaje amable de límite', async () => {
    const model = {
      generateContent: jest.fn().mockRejectedValue(new Error('[429 Too Many Requests] quota. Please retry in 40s')),
      generateContentStream: jest.fn(),
    };
    (service as unknown as { client: unknown }).client = { getGenerativeModel: () => model };
    await expect(service.asistente(7, 'hola')).rejects.toBeInstanceOf(HttpException);
    expect(model.generateContent).toHaveBeenCalledTimes(1); // sin reintento
  });
});

/**
 * PRECEDENCIA DEL MODELO Y DIAGNÓSTICO DE FALLOS.
 *
 * Estos casos fijan la corrección de la caída en producción: la BD mandaba sobre
 * el entorno, así que un modelo retirado guardado por el seed dejaba a ALVARO
 * caído aunque GEMINI_MODEL estuviera bien puesta en Render. Y todos los fallos
 * no-429 se registraban con el mismo texto, así que no había forma de saber la
 * causa sin reproducirla a mano.
 */
describe('TutorIaService · modelo efectivo y clasificación de errores', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = crearPrismaMock();
    prisma.usuario.findUnique.mockResolvedValue({ nombre: 'Ana', nivelInicialAdaptativo: 'basico', thetaActual: -1 });
    prisma.evaluacion.findUnique.mockResolvedValue(null);
    prisma.tema.findUnique.mockResolvedValue(null);
    prisma.documento.findFirst.mockResolvedValue(null);
    prisma.consultaIa.create.mockResolvedValue({});
  });

  /** Devuelve el nombre de modelo con el que se pidió el cliente de Gemini. */
  async function modeloUsado(envModelo: string | undefined, modeloBd: string | null) {
    prisma.configuracionSistema.findUnique.mockResolvedValue({ iaActiva: true, modeloIa: modeloBd, maxPistasIa: 3 });
    const service = new TutorIaService(crearConfig({ GEMINI_MODEL: envModelo }), prisma as never);
    const getGenerativeModel = jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({ response: { text: () => 'ok' } }),
    });
    (service as unknown as { client: unknown }).client = { getGenerativeModel };
    await service.asistente(1, '¿qué es una variable?');
    return getGenerativeModel.mock.calls[0][0].model as string;
  }

  it('el ENTORNO manda sobre el valor guardado en la base', async () => {
    expect(await modeloUsado('gemini-2.5-flash-lite', 'gemini-2.0-flash')).toBe('gemini-2.5-flash-lite');
  });

  it('usa el valor de la base cuando no hay variable de entorno', async () => {
    expect(await modeloUsado(undefined, 'gemini-2.5-flash')).toBe('gemini-2.5-flash');
  });

  it('cae al defecto del código cuando no hay ni entorno ni base', async () => {
    expect(await modeloUsado(undefined, null)).toBe(TutorIaService.MODELO_DEFECTO);
  });

  it('un modelo retirado NO se confunde con una caída genérica', async () => {
    prisma.configuracionSistema.findUnique.mockResolvedValue({ iaActiva: true, modeloIa: 'gemini-2.0-flash', maxPistasIa: 3 });
    const service = new TutorIaService(crearConfig(), prisma as never);
    (service as unknown as { client: unknown }).client = {
      getGenerativeModel: () => ({
        generateContent: jest.fn().mockRejectedValue(
          new Error('[GoogleGenerativeAI Error]: [404 Not Found] This model models/gemini-2.0-flash is no longer available.'),
        ),
      }),
    };
    const error = jest.spyOn((service as unknown as { logger: { error: (m: string) => void } }).logger, 'error').mockImplementation(() => undefined);

    await expect(service.asistente(1, '¿qué es un bucle?')).rejects.toThrow(HttpException);
    const registrado = error.mock.calls[0][0] as string;
    expect(registrado).toContain('MODELO INEXISTENTE O RETIRADO');
    // El log nombra el modelo y de dónde salió: es el dato que faltaba para diagnosticar.
    expect(registrado).toContain('gemini-2.0-flash');
    expect(registrado).toContain('Cómo se arregla');
  });

  it('distingue clave inválida, cuota y restricción regional', async () => {
    const casos: Array<[string, string]> = [
      ['API key not valid. Please pass a valid API key.', 'CLAVE DE API INVÁLIDA'],
      ['[429 Too Many Requests] You exceeded your current quota', 'CUOTA AGOTADA'],
      ['[400] User location is not supported for the API use.', 'RESTRICCIÓN REGIONAL'],
      ['fetch failed', 'FALLO DE RED HACIA GOOGLE'],
    ];
    for (const [mensaje, esperado] of casos) {
      prisma.configuracionSistema.findUnique.mockResolvedValue({ iaActiva: true, modeloIa: 'gemini-2.5-flash-lite', maxPistasIa: 3 });
      const service = new TutorIaService(crearConfig(), prisma as never);
      (service as unknown as { client: unknown }).client = {
        getGenerativeModel: () => ({ generateContent: jest.fn().mockRejectedValue(new Error(mensaje)) }),
      };
      const error = jest.spyOn((service as unknown as { logger: { error: (m: string) => void } }).logger, 'error').mockImplementation(() => undefined);
      await expect(service.asistente(1, 'hola profe')).rejects.toThrow(HttpException);
      expect(error.mock.calls.map((c) => String(c[0])).join('\n')).toContain(esperado);
    }
  });
});
