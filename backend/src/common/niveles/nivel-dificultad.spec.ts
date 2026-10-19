import * as nivelDificultad from './nivel-dificultad';
import {
  clasificarDominio,
  siguienteNivel,
  nivelInferior,
  nivelAlMenos,
  nivelDominioAgregado,
  factorXpNivel,
  valorXpEjercicio,
  ORDEN_NIVEL,
} from './nivel-dificultad';

describe('nivel-dificultad (lógica pura de niveles adaptativos)', () => {
  describe('regla ÚNICA de clasificación del estudiante', () => {
    /**
     * `clasificarNivel(puntaje)` clasificaba por % del pretest (40/70) y
     * contradecía a `nivelDesdeTheta`. Se eliminó el 2026-08-07. Este test
     * impide que reaparezca: si alguien la vuelve a añadir aquí, falla y obliga
     * a leer docs/CLASIFICACION_NIVELES.md antes de introducir una segunda regla.
     */
    it('este módulo NO clasifica estudiantes por porcentaje', () => {
      expect('clasificarNivel' in nivelDificultad).toBe(false);
    });

    it('solo expone clasificación de DOMINIO agregado, no de personas', () => {
      const exportadas = Object.keys(nivelDificultad).filter((k) => k.startsWith('clasificar'));
      expect(exportadas).toEqual(['clasificarDominio']);
    });
  });

  describe('navegación de niveles', () => {
    it('siguienteNivel avanza y se detiene en avanzado', () => {
      expect(siguienteNivel('basico')).toBe('intermedio');
      expect(siguienteNivel('intermedio')).toBe('avanzado');
      expect(siguienteNivel('avanzado')).toBeNull();
    });
    it('nivelInferior desciende y se detiene en básico', () => {
      expect(nivelInferior('avanzado')).toBe('intermedio');
      expect(nivelInferior('intermedio')).toBe('basico');
      expect(nivelInferior('basico')).toBeNull();
    });
    it('nivelAlMenos compara por orden', () => {
      expect(nivelAlMenos('intermedio', 'intermedio')).toBe(true);
      expect(nivelAlMenos('avanzado', 'intermedio')).toBe(true);
      expect(nivelAlMenos('basico', 'intermedio')).toBe(false);
    });
  });

  describe('nivelDominioAgregado (dominio = promedio del NIVEL por tema, no del progreso)', () => {
    it('unidad sin temas → 0 / básico', () => {
      expect(nivelDominioAgregado([])).toEqual({ dominioPct: 0, nivelDominio: 'basico' });
    });

    it('todos los temas en BÁSICO → 0 → básico (NO desbloquea la siguiente unidad)', () => {
      const r = nivelDominioAgregado(['basico', 'basico']);
      expect(r.dominioPct).toBe(0);
      expect(r.nivelDominio).toBe('basico');
    });

    it('todos los temas en INTERMEDIO → 50 → intermedio (ya puede avanzar)', () => {
      const r = nivelDominioAgregado(['intermedio', 'intermedio']);
      expect(r.dominioPct).toBe(50);
      expect(r.nivelDominio).toBe('intermedio');
    });

    it('todos los temas en AVANZADO → 100 → avanzado (NUNCA básico)', () => {
      const r = nivelDominioAgregado(['avanzado', 'avanzado']);
      expect(r.dominioPct).toBe(100);
      expect(r.nivelDominio).toBe('avanzado');
    });

    it('coherencia: si el estudiante está en Avanzado en sus temas, el dominio no es Básico', () => {
      // Caso del bug: un único tema visible en Avanzado no puede dar dominio Básico.
      const r = nivelDominioAgregado(['avanzado']);
      expect(r.nivelDominio).toBe('avanzado');
      expect(r.nivelDominio).not.toBe('basico');
    });

    it('promedia niveles mixtos (básico + intermedio) → 25 → básico', () => {
      // (0 + 0.5) / 2 = 0.25 → 25
      expect(nivelDominioAgregado(['basico', 'intermedio']).dominioPct).toBe(25);
    });

    it('el dominio NO depende del progreso de ejercicios, solo del nivel', () => {
      // Mismo nivel (avanzado) → mismo dominio, sin importar cuántos ejercicios se hicieron.
      expect(nivelDominioAgregado(['avanzado']).dominioPct).toBe(100);
    });
  });

  describe('clasificarDominio (umbrales del gate de unidad)', () => {
    it('promedio de Básico (0) queda en básico', () => {
      expect(clasificarDominio(0)).toBe('basico');
      expect(clasificarDominio(33)).toBe('basico');
    });
    it('≥34 (promedio de Intermedio) alcanza intermedio', () => {
      expect(clasificarDominio(34)).toBe('intermedio');
      expect(clasificarDominio(50)).toBe('intermedio');
      expect(clasificarDominio(66)).toBe('intermedio');
    });
    it('≥67 (promedio de Avanzado) alcanza avanzado', () => {
      expect(clasificarDominio(67)).toBe('avanzado');
      expect(clasificarDominio(100)).toBe('avanzado');
    });
  });

  describe('factorXpNivel (más nivel = más XP)', () => {
    const cfg = { xpFactorIntermedio: 125, xpFactorAvanzado: 150 };
    it('básico = 100%', () => expect(factorXpNivel('basico', cfg)).toBe(1));
    it('intermedio aplica el factor configurado', () => expect(factorXpNivel('intermedio', cfg)).toBeCloseTo(1.25));
    it('avanzado aplica el factor configurado', () => expect(factorXpNivel('avanzado', cfg)).toBeCloseTo(1.5));
  });

  it('ORDEN_NIVEL es ascendente', () => {
    expect(ORDEN_NIVEL.basico).toBeLessThan(ORDEN_NIVEL.intermedio);
    expect(ORDEN_NIVEL.intermedio).toBeLessThan(ORDEN_NIVEL.avanzado);
  });
});

describe('valor XP de un ejercicio (Tabla 46)', () => {
  it('base menos penalización por pista, escalado por el nivel, con mínimo 5', () => {
    expect(valorXpEjercicio(20, 5, 0, 1.5)).toBe(30);
    expect(valorXpEjercicio(20, 5, 1, 1.5)).toBe(23);
    expect(valorXpEjercicio(20, 5, 3, 1)).toBe(5);
    expect(valorXpEjercicio(10, 5, 5, 1.25)).toBe(5);
  });
});
