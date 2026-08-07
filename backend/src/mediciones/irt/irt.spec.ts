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
  THETA_UMBRAL_BASICO,
  THETA_UMBRAL_AVANZADO,
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

  /**
   * BORDES EXACTOS DE LA CLASIFICACIÓN — contrato explícito y verificado.
   *
   * Los límites son CERRADOS hacia Intermedio: θ = −0.5 y θ = +0.5 pertenecen
   * ambos a Intermedio, no a los extremos. Es una decisión, no un accidente: en
   * el borde exacto el estudiante está equidistante de las dos anclas de
   * dificultad, y ante el empate se prefiere el nivel central (ni se le sube de
   * golpe a contenido para el que no hay evidencia, ni se le retiene abajo).
   *
   * Estos tests existen para que nadie cambie el criterio sin darse cuenta:
   * mover un `<` a un `<=` reclasificaría estudiantes en silencio.
   */
  describe('bordes exactos de la clasificación (contrato)', () => {
    it('θ = -0.5 exacto pertenece a INTERMEDIO (límite cerrado por abajo)', () => {
      expect(nivelDesdeTheta(THETA_UMBRAL_BASICO)).toBe('intermedio');
    });

    it('θ = +0.5 exacto pertenece a INTERMEDIO (límite cerrado por arriba)', () => {
      expect(nivelDesdeTheta(THETA_UMBRAL_AVANZADO)).toBe('intermedio');
    });

    it('apenas por debajo de -0.5 ya es básico', () => {
      expect(nivelDesdeTheta(THETA_UMBRAL_BASICO - 1e-9)).toBe('basico');
    });

    it('apenas por encima de +0.5 ya es avanzado', () => {
      expect(nivelDesdeTheta(THETA_UMBRAL_AVANZADO + 1e-9)).toBe('avanzado');
    });

    it('los umbrales son SIMÉTRICOS respecto del cero', () => {
      // La simetría no es estética: refleja que Intermedio es el ancla central
      // (b = 0) y que básico (−1) y avanzado (+1) están a la misma distancia.
      expect(THETA_UMBRAL_BASICO).toBe(-THETA_UMBRAL_AVANZADO);
    });

    it('cada umbral es el PUNTO MEDIO entre las anclas de dificultad contiguas', () => {
      // Es la justificación de por qué ±0.5 y no otro número: ver el bloque de
      // documentación sobre THETA_UMBRAL_* en irt.ts y docs/CLASIFICACION_NIVELES.md
      const bBasico = dificultadDesdeNivel('basico');       // -1
      const bIntermedio = dificultadDesdeNivel('intermedio'); //  0
      const bAvanzado = dificultadDesdeNivel('avanzado');    // +1
      expect(THETA_UMBRAL_BASICO).toBeCloseTo((bBasico + bIntermedio) / 2, 10);
      expect(THETA_UMBRAL_AVANZADO).toBeCloseTo((bIntermedio + bAvanzado) / 2, 10);
    });

    it('en el umbral avanzado, P(acierto) de un ítem intermedio supera el 50 %', () => {
      // Traducción del corte a una afirmación sobre lo que el estudiante PUEDE
      // hacer, que es el argumento central ante un tribunal.
      const p = probabilidadAcierto(THETA_UMBRAL_AVANZADO, dificultadDesdeNivel('intermedio'));
      expect(p).toBeGreaterThan(0.5);
      // Y exactamente 50 % frente a un ítem cuya dificultad iguale su habilidad.
      expect(probabilidadAcierto(THETA_UMBRAL_AVANZADO, THETA_UMBRAL_AVANZADO)).toBeCloseTo(0.5, 12);
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
