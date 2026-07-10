import {
  probabilidadAcierto,
  informacionItem,
  dificultadDesdeNivel,
  dificultadDesdeEstrellas,
  nivelDesdeTheta,
  logVerosimilitud,
  estimarTheta,
  gananciaTheta,
  redondearTheta,
  RespuestaIrt,
  THETA_MIN,
  THETA_MAX,
} from './irt';

describe('IRT — modelo de Rasch (matemática pura)', () => {
  describe('probabilidadAcierto — curva característica del ítem P(θ)=1/(1+e^-(θ-b))', () => {
    it('θ = b → P = 0.5 (propiedad central del modelo de Rasch)', () => {
      expect(probabilidadAcierto(0, 0)).toBeCloseTo(0.5, 10);
      expect(probabilidadAcierto(1.3, 1.3)).toBeCloseTo(0.5, 10);
      expect(probabilidadAcierto(-2, -2)).toBeCloseTo(0.5, 10);
    });

    it('θ > b → P > 0.5 ; θ < b → P < 0.5', () => {
      expect(probabilidadAcierto(2, 0)).toBeGreaterThan(0.5);
      expect(probabilidadAcierto(-2, 0)).toBeLessThan(0.5);
    });

    it('es monótona creciente en θ y decreciente en b', () => {
      expect(probabilidadAcierto(1, 0)).toBeGreaterThan(probabilidadAcierto(0, 0));
      expect(probabilidadAcierto(0, 1)).toBeLessThan(probabilidadAcierto(0, 0));
    });

    it('siempre está en (0, 1)', () => {
      for (const theta of [-4, -1, 0, 1, 4]) {
        const p = probabilidadAcierto(theta, 0);
        expect(p).toBeGreaterThan(0);
        expect(p).toBeLessThan(1);
      }
    });

    it('diferencia (θ−b) de +1 logit ≈ 0.731 de probabilidad', () => {
      expect(probabilidadAcierto(1, 0)).toBeCloseTo(1 / (1 + Math.exp(-1)), 10);
    });
  });

  describe('informacionItem — información de Fisher I(θ)=P(1−P)', () => {
    it('es máxima (0.25) cuando b = θ', () => {
      expect(informacionItem(0, 0)).toBeCloseTo(0.25, 10);
    });
    it('decae cuando el ítem se aleja de la habilidad', () => {
      expect(informacionItem(0, 2)).toBeLessThan(informacionItem(0, 0));
      expect(informacionItem(0, -2)).toBeLessThan(informacionItem(0, 0));
    });
  });

  describe('dificultad b de los ítems', () => {
    it('mapea niveles: básico=-1, intermedio=0, avanzado=+1', () => {
      expect(dificultadDesdeNivel('basico')).toBe(-1);
      expect(dificultadDesdeNivel('intermedio')).toBe(0);
      expect(dificultadDesdeNivel('avanzado')).toBe(1);
    });
    it('mapea estrellas 1..5 a b creciente y acotado', () => {
      expect(dificultadDesdeEstrellas(3)).toBe(0);
      expect(dificultadDesdeEstrellas(1)).toBeCloseTo(-1.5);
      expect(dificultadDesdeEstrellas(5)).toBeCloseTo(1.5);
      expect(dificultadDesdeEstrellas(1)).toBeLessThan(dificultadDesdeEstrellas(5));
      // acotado a [-3, 3] ante valores atípicos.
      expect(dificultadDesdeEstrellas(100)).toBe(3);
      expect(dificultadDesdeEstrellas(-100)).toBe(-3);
    });
  });

  describe('nivelDesdeTheta — mapeo θ → nivel adaptativo', () => {
    it('θ < -0.5 → básico', () => {
      expect(nivelDesdeTheta(-0.51)).toBe('basico');
      expect(nivelDesdeTheta(-3)).toBe('basico');
    });
    it('-0.5 ≤ θ ≤ 0.5 → intermedio', () => {
      expect(nivelDesdeTheta(-0.5)).toBe('intermedio');
      expect(nivelDesdeTheta(0)).toBe('intermedio');
      expect(nivelDesdeTheta(0.5)).toBe('intermedio');
    });
    it('θ > 0.5 → avanzado', () => {
      expect(nivelDesdeTheta(0.51)).toBe('avanzado');
      expect(nivelDesdeTheta(3)).toBe('avanzado');
    });
  });

  describe('logVerosimilitud', () => {
    it('el θ estimado por MLE maximiza la log-verosimilitud', () => {
      const resp: RespuestaIrt[] = [
        { b: -1, correcto: true },
        { b: 0, correcto: true },
        { b: 1, correcto: false },
        { b: 2, correcto: false },
      ];
      const theta = estimarTheta(resp);
      const llMax = logVerosimilitud(theta, resp);
      // Cualquier desplazamiento del θ estimado NO debe aumentar la verosimilitud.
      expect(logVerosimilitud(theta + 0.5, resp)).toBeLessThan(llMax);
      expect(logVerosimilitud(theta - 0.5, resp)).toBeLessThan(llMax);
    });
  });

  describe('estimarTheta — MLE por Newton-Raphson', () => {
    it('sin respuestas → 0 (habilidad neutra, sin evidencia)', () => {
      expect(estimarTheta([])).toBe(0);
    });

    it('patrón simétrico → θ ≈ 0 (habilidad = dificultad media)', () => {
      const resp: RespuestaIrt[] = [
        { b: -1, correcto: true },
        { b: 1, correcto: false },
      ];
      expect(estimarTheta(resp)).toBeCloseTo(0, 1);
    });

    it('acierta ítems difíciles y falla fáciles → θ alto', () => {
      const resp: RespuestaIrt[] = [
        { b: -1, correcto: true },
        { b: 0, correcto: true },
        { b: 1, correcto: true },
        { b: 2, correcto: false },
      ];
      expect(estimarTheta(resp)).toBeGreaterThan(0.5);
    });

    it('falla casi todo → θ bajo (negativo)', () => {
      const resp: RespuestaIrt[] = [
        { b: -1, correcto: true },
        { b: 0, correcto: false },
        { b: 1, correcto: false },
        { b: 2, correcto: false },
      ];
      expect(estimarTheta(resp)).toBeLessThan(-0.5);
    });

    it('a mayor proporción de aciertos, mayor θ (monotonía)', () => {
      const items = [-1, 0, 1, 2];
      const pocos = estimarTheta(items.map((b, i) => ({ b, correcto: i < 1 })));
      const medios = estimarTheta(items.map((b, i) => ({ b, correcto: i < 2 })));
      const muchos = estimarTheta(items.map((b, i) => ({ b, correcto: i < 3 })));
      expect(pocos).toBeLessThan(medios);
      expect(medios).toBeLessThan(muchos);
    });

    it('todo correcto → THETA_MAX ; todo incorrecto → THETA_MIN (patrones extremos)', () => {
      const items: RespuestaIrt[] = [
        { b: -1, correcto: true },
        { b: 0, correcto: true },
        { b: 1, correcto: true },
      ];
      expect(estimarTheta(items)).toBe(THETA_MAX);
      expect(estimarTheta(items.map((r) => ({ ...r, correcto: false })))).toBe(THETA_MIN);
    });

    it('el resultado queda acotado a [THETA_MIN, THETA_MAX]', () => {
      const resp: RespuestaIrt[] = [
        { b: 3, correcto: true },
        { b: -3, correcto: false },
      ];
      const theta = estimarTheta(resp);
      expect(theta).toBeGreaterThanOrEqual(THETA_MIN);
      expect(theta).toBeLessThanOrEqual(THETA_MAX);
    });

    it('converge de forma estable independientemente del punto inicial', () => {
      const resp: RespuestaIrt[] = [
        { b: -1, correcto: true },
        { b: 0, correcto: true },
        { b: 1, correcto: false },
        { b: 2, correcto: false },
      ];
      const desde0 = estimarTheta(resp, { thetaInicial: 0 });
      const desdeAlto = estimarTheta(resp, { thetaInicial: 3 });
      const desdeBajo = estimarTheta(resp, { thetaInicial: -3 });
      expect(desde0).toBeCloseTo(desdeAlto, 3);
      expect(desde0).toBeCloseTo(desdeBajo, 3);
    });
  });

  describe('gananciaTheta y redondearTheta', () => {
    it('Δθ = θ_final − θ_inicial', () => {
      expect(gananciaTheta(-1, 0.5)).toBeCloseTo(1.5);
    });
    it('null si falta alguno de los dos', () => {
      expect(gananciaTheta(null, 0.5)).toBeNull();
      expect(gananciaTheta(-1, null)).toBeNull();
    });
    it('redondea a 3 decimales', () => {
      expect(redondearTheta(0.123456)).toBe(0.123);
    });
  });
});
