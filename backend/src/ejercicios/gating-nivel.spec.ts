import { ForbiddenException } from '@nestjs/common';
import { AdaptatividadService } from './adaptatividad.service';
import { crearPrismaMock, PrismaMock } from '../test-utils/prisma.mock';

/**
 * GATING ESTRICTO POR NIVEL — pruebas de regresión.
 *
 * El defecto que fijan: la regla "un estudiante con nivel N en un tema practica
 * solo los ítems de nivel N de ese tema" vivía únicamente en los listados. El
 * acceso directo por id y el envío de respuestas no la aplicaban, así que con un
 * id antiguo o desde las DevTools se podía resolver y GANAR XP por ejercicios de
 * otro nivel, contaminando XP, ranking, rangos y θ.
 *
 * Estas pruebas cubren las dos mitades del contrato:
 *   · lo que debe RECHAZARSE (ítem de otro nivel), y
 *   · lo que NO debe romperse (examen, pretest, postest, ítems sin tema, docente).
 */
describe('AdaptatividadService · gating estricto por nivel', () => {
  let prisma: PrismaMock;
  let service: AdaptatividadService;

  /** El estudiante 7 está en INTERMEDIO en el tema 30. */
  function estudianteIntermedioEnTema30() {
    prisma.progresoTema.findUnique.mockResolvedValue({ nivelActual: 'intermedio' });
    // `nivelServidoEnTema` cae a un nivel inferior solo si el actual no tiene
    // ejercicios; aquí sí los hay, así que se queda en intermedio.
    prisma.ejercicio.count.mockResolvedValue(10);
  }

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new AdaptatividadService(prisma as never);
    estudianteIntermedioEnTema30();
  });

  const ejercicio = (over: Partial<{ temaId: number | null; nivelDificultad: string; banco: string }> = {}) =>
    ({ temaId: 30, nivelDificultad: 'intermedio', banco: 'practica', ...over }) as never;
  const reto = (over: Partial<{ temaId: number | null; nivelDificultad: string }> = {}) =>
    ({ temaId: 30, nivelDificultad: 'intermedio', ...over }) as never;

  describe('lo que debe rechazarse', () => {
    it('rechaza un ejercicio de un nivel SUPERIOR al del estudiante', async () => {
      await expect(service.verificarAccesoEjercicio(7, ejercicio({ nivelDificultad: 'avanzado' })))
        .rejects.toThrow(ForbiddenException);
    });

    it('rechaza un ejercicio de un nivel INFERIOR (uno que ya superó)', async () => {
      await expect(service.verificarAccesoEjercicio(7, ejercicio({ nivelDificultad: 'basico' })))
        .rejects.toThrow(ForbiddenException);
    });

    it('rechaza un reto DOS niveles por encima del suyo', async () => {
      prisma.progresoTema.findUnique.mockResolvedValue({ nivelActual: 'basico' });
      await expect(service.verificarAccesoReto(7, reto({ nivelDificultad: 'avanzado' })))
        .rejects.toThrow(ForbiddenException);
    });

    it('el mensaje de rechazo no filtra información del ítem', async () => {
      const error = await service.verificarAccesoEjercicio(7, ejercicio({ nivelDificultad: 'avanzado' })).catch((e) => e);
      const mensaje = (error as ForbiddenException).message;
      expect(mensaje).toContain('no corresponde a tu nivel actual');
      // Dice en qué nivel está el estudiante, nunca en cuál está el ejercicio.
      expect(mensaje).toContain('Intermedio');
      expect(mensaje).not.toContain('Avanzado');
    });

    it('acepta el ejercicio del nivel que sí le toca', async () => {
      await expect(service.verificarAccesoEjercicio(7, ejercicio())).resolves.toBeUndefined();
    });
  });

  describe('lo que NO debe romperse', () => {
    it.each(['examen', 'pretest', 'postest'])(
      'el banco "%s" queda exento aunque el nivel no coincida',
      async (banco) => {
        await expect(service.verificarAccesoEjercicio(7, ejercicio({ banco, nivelDificultad: 'avanzado' })))
          .resolves.toBeUndefined();
      },
    );

    it('los ítems sin tema se permiten: no cuelgan de ningún ProgresoTema', async () => {
      await expect(service.verificarAccesoEjercicio(7, ejercicio({ temaId: null, nivelDificultad: 'avanzado' })))
        .resolves.toBeUndefined();
      await expect(service.verificarAccesoReto(7, reto({ temaId: null, nivelDificultad: 'avanzado' })))
        .resolves.toBeUndefined();
    });

    it.each(['docente', 'admin', 'investigador'])(
      'el rol "%s" puede ver cualquier ítem para gestionarlo',
      async (rol) => {
        await expect(service.verificarAccesoEjercicio(7, ejercicio({ nivelDificultad: 'avanzado' }), rol))
          .resolves.toBeUndefined();
        await expect(service.verificarAccesoReto(7, reto({ nivelDificultad: 'avanzado' }), rol))
          .resolves.toBeUndefined();
      },
    );

    it('el rol estudiante SÍ queda sujeto al gating', async () => {
      await expect(service.verificarAccesoEjercicio(7, ejercicio({ nivelDificultad: 'avanzado' }), 'estudiante'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('coherencia con lo que sirve la ruta', () => {
    /**
     * Trampa real: `ruta()` cae a un nivel inferior cuando el nivel del estudiante
     * no tiene ejercicios en el tema. Si el gate no hiciera la misma caída,
     * rechazaría ejercicios que la propia ruta acaba de ofrecerle.
     */
    it('acepta el nivel inferior cuando el nivel del estudiante no tiene ejercicios', async () => {
      prisma.progresoTema.findUnique.mockResolvedValue({ nivelActual: 'avanzado' });
      prisma.ejercicio.count
        .mockResolvedValueOnce(0)   // avanzado: sin ejercicios
        .mockResolvedValueOnce(12); // intermedio: sí hay → la ruta sirve intermedio

      await expect(service.verificarAccesoEjercicio(7, ejercicio({ nivelDificultad: 'intermedio' })))
        .resolves.toBeUndefined();
    });

    /**
     * Los retos NO tienen esa caída: `RetosService.disponibles()` compara contra
     * `ProgresoTema.nivelActual` a secas. El gate replica esa diferencia a
     * propósito, para no abrir una grieta entre listado y acceso directo.
     */
    it('en retos valen su nivel, los anteriores y el siguiente (igual que el listado)', async () => {
      prisma.progresoTema.findUnique.mockResolvedValue({ nivelActual: 'basico' });
      await expect(service.verificarAccesoReto(7, reto({ nivelDificultad: 'basico' }))).resolves.toBeUndefined();
      await expect(service.verificarAccesoReto(7, reto({ nivelDificultad: 'intermedio' }))).resolves.toBeUndefined();
      await expect(service.verificarAccesoReto(7, reto({ nivelDificultad: 'avanzado' }))).rejects.toThrow(ForbiddenException);

      prisma.progresoTema.findUnique.mockResolvedValue({ nivelActual: 'avanzado' });
      await expect(service.verificarAccesoReto(7, reto({ nivelDificultad: 'intermedio' }))).resolves.toBeUndefined();
    });

    it('sin ProgresoTema se usa la clasificación inicial del pretest', async () => {
      prisma.progresoTema.findUnique.mockResolvedValue(null);
      prisma.usuario.findUnique.mockResolvedValue({ nivelInicialAdaptativo: 'basico' });
      prisma.ejercicio.count.mockResolvedValue(5);

      await expect(service.verificarAccesoEjercicio(7, ejercicio({ nivelDificultad: 'basico' })))
        .resolves.toBeUndefined();
      await expect(service.verificarAccesoEjercicio(7, ejercicio({ nivelDificultad: 'intermedio' })))
        .rejects.toThrow(ForbiddenException);
    });
  });
});
