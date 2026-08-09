/**
 * Verificación de la medición de USO (dosis de la intervención).
 *
 * A diferencia de `inferencia.spec.ts`, aquí NO hay contraste contra scipy y no
 * es un olvido: días activos, sesiones y regularidad no son estadísticos
 * inferenciales sino recuentos deterministas sobre marcas de tiempo. No existe
 * una "función de referencia" en R o scipy con la que compararlos; lo que sí se
 * puede hacer —y es lo que se hace— es fijar casos con el resultado calculado a
 * mano, incluidos los bordes exactos del umbral de sesión, de modo que nadie
 * pueda cambiar el criterio sin que una prueba lo delate.
 */

import { calcularUso, claveSemana, UMBRAL_SESION_MIN, TOPE_HUECO_MIN } from './uso';

/** Construye una fecha local a partir de "YYYY-MM-DD HH:MM". */
const f = (s: string): Date => {
  const [fecha, hora] = s.split(' ');
  const [y, m, d] = fecha.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
};

describe('sin actividad', () => {
  it('devuelve ceros explícitos y regularidad null (no inventa una proporción)', () => {
    const u = calcularUso([]);
    expect(u.dias_activos).toBe(0);
    expect(u.eventos).toBe(0);
    expect(u.primer_dia).toBeNull();
    // null y no 0: sin periodo no hay proporción que calcular.
    expect(u.regularidad).toBeNull();
  });
});

describe('días activos', () => {
  it('cuenta FECHAS únicas, no eventos', () => {
    // 5 eventos repartidos en 3 días distintos.
    const u = calcularUso([
      f('2026-06-01 10:00'), f('2026-06-01 10:05'), f('2026-06-01 18:00'),
      f('2026-06-03 09:00'),
      f('2026-06-07 20:00'),
    ]);
    expect(u.eventos).toBe(5);
    expect(u.dias_activos).toBe(3);
  });

  it('un estudiante que entró una sola vez tiene 1 día activo y periodo 1', () => {
    const u = calcularUso([f('2026-06-01 10:00')]);
    expect(u.dias_activos).toBe(1);
    expect(u.periodo_dias).toBe(1); // inclusive: si fuera 0, la regularidad se indefiniría
    expect(u.regularidad).toBe(1);
    expect(u.sesiones).toBe(1);
  });
});

describe('periodo de participación', () => {
  it('cuenta días calendario inclusive entre el primero y el último evento', () => {
    // Del 1 al 10 de junio = 10 días inclusive.
    const u = calcularUso([f('2026-06-01 23:50'), f('2026-06-10 00:10')]);
    expect(u.periodo_dias).toBe(10);
    expect(u.primer_dia).toEqual(f('2026-06-01 23:50'));
    expect(u.ultimo_dia).toEqual(f('2026-06-10 00:10'));
  });

  it('no depende del orden en que lleguen las fechas', () => {
    const desordenado = calcularUso([f('2026-06-10 08:00'), f('2026-06-01 08:00'), f('2026-06-05 08:00')]);
    expect(desordenado.periodo_dias).toBe(10);
    expect(desordenado.dias_activos).toBe(3);
  });
});

describe('sesiones (umbral de 30 minutos)', () => {
  it('eventos separados por MENOS del umbral son la misma sesión', () => {
    const u = calcularUso([f('2026-06-01 10:00'), f('2026-06-01 10:20')]); // 20 min
    expect(u.sesiones).toBe(1);
  });

  it('eventos separados por MÁS del umbral abren una sesión nueva', () => {
    const u = calcularUso([f('2026-06-01 10:00'), f('2026-06-01 10:31')]); // 31 min
    expect(u.sesiones).toBe(2);
  });

  it('EN EL BORDE EXACTO (30 min) sigue siendo la misma sesión', () => {
    // Contrato explícito: el corte es ESTRICTAMENTE mayor que el umbral.
    // Fijarlo evita que alguien cambie > por >= y altere en silencio todas las
    // cifras de sesiones reportadas en la tesis.
    const u = calcularUso([f('2026-06-01 10:00'), f('2026-06-01 10:30')]);
    expect(UMBRAL_SESION_MIN).toBe(30);
    expect(u.sesiones).toBe(1);
  });

  it('cuenta una sesión por cada bloque, aunque sean el mismo día', () => {
    const u = calcularUso([
      f('2026-06-01 08:00'), f('2026-06-01 08:10'), // sesión 1
      f('2026-06-01 15:00'), f('2026-06-01 15:20'), // sesión 2 (7 h después)
      f('2026-06-01 21:00'),                         // sesión 3
    ]);
    expect(u.dias_activos).toBe(1);
    expect(u.sesiones).toBe(3);
  });
});

describe('tiempo estimado', () => {
  it('suma los huecos dentro de una sesión', () => {
    // 10 + 15 = 25 minutos, ambos por debajo del tope.
    const u = calcularUso([f('2026-06-01 10:00'), f('2026-06-01 10:10'), f('2026-06-01 10:25')]);
    expect(u.minutos_estimados).toBe(25);
  });

  it('NO cuenta el hueco entre sesiones distintas', () => {
    // 10 min de trabajo, 7 h de pausa, 5 min de trabajo → 15 min, no 435.
    const u = calcularUso([
      f('2026-06-01 08:00'), f('2026-06-01 08:10'),
      f('2026-06-01 15:00'), f('2026-06-01 15:05'),
    ]);
    expect(u.minutos_estimados).toBe(15);
    expect(u.sesiones).toBe(2);
  });

  it('acota cada hueco al tope, para que una pausa larga no infle el total', () => {
    // Hueco de 25 min (dentro de la sesión) → cuenta como TOPE_HUECO_MIN.
    const u = calcularUso([f('2026-06-01 10:00'), f('2026-06-01 10:25')]);
    expect(TOPE_HUECO_MIN).toBe(15);
    expect(u.minutos_estimados).toBe(15);
  });

  it('un único evento no genera tiempo (no hay hueco que medir)', () => {
    expect(calcularUso([f('2026-06-01 10:00')]).minutos_estimados).toBe(0);
  });
});

describe('regularidad', () => {
  it('vale 1 cuando hubo actividad TODOS los días del periodo', () => {
    const u = calcularUso([f('2026-06-01 10:00'), f('2026-06-02 10:00'), f('2026-06-03 10:00')]);
    expect(u.periodo_dias).toBe(3);
    expect(u.dias_activos).toBe(3);
    expect(u.regularidad).toBe(1);
  });

  it('distingue el uso sostenido del atracón concentrado', () => {
    // Sostenido: 5 días activos en un periodo de 9.
    const sostenido = calcularUso([
      f('2026-06-01 10:00'), f('2026-06-03 10:00'), f('2026-06-05 10:00'),
      f('2026-06-07 10:00'), f('2026-06-09 10:00'),
    ]);
    // Atracón: MÁS eventos, pero repartidos en 2 días de un periodo de 9.
    const atracon = calcularUso([
      f('2026-06-01 10:00'), f('2026-06-01 11:00'), f('2026-06-01 12:00'),
      f('2026-06-01 13:00'), f('2026-06-01 14:00'), f('2026-06-01 15:00'),
      f('2026-06-09 10:00'), f('2026-06-09 11:00'),
    ]);
    expect(atracon.eventos).toBeGreaterThan(sostenido.eventos);
    // …y aun así su regularidad es MENOR: es justo lo que el indicador debe captar.
    expect(atracon.regularidad!).toBeLessThan(sostenido.regularidad!);
    expect(sostenido.regularidad).toBeCloseTo(5 / 9, 3);
    expect(atracon.regularidad).toBeCloseTo(2 / 9, 3);
  });
});

describe('distribución temporal', () => {
  it('agrupa por día en orden cronológico', () => {
    const u = calcularUso([
      f('2026-06-03 10:00'), f('2026-06-01 10:00'), f('2026-06-01 11:00'),
    ]);
    expect(u.por_dia).toEqual([
      { dia: '2026-06-01', eventos: 2 },
      { dia: '2026-06-03', eventos: 1 },
    ]);
  });

  it('agrupa por semana ISO', () => {
    // 2026-06-01 es lunes; 2026-06-08 es el lunes siguiente → semanas distintas.
    const u = calcularUso([f('2026-06-01 10:00'), f('2026-06-03 10:00'), f('2026-06-08 10:00')]);
    expect(u.por_semana).toHaveLength(2);
    expect(u.por_semana[0].eventos).toBe(2);
    expect(u.por_semana[1].eventos).toBe(1);
  });

  it('la clave de semana sigue la norma ISO 8601', () => {
    // El 1 de enero de 2026 es jueves → pertenece a la semana 01 de 2026.
    expect(claveSemana(f('2026-01-01 12:00'))).toBe('2026-W01');
    // Domingo 2026-01-04 cierra esa misma semana ISO.
    expect(claveSemana(f('2026-01-04 12:00'))).toBe('2026-W01');
    // Lunes 2026-01-05 abre la semana 02.
    expect(claveSemana(f('2026-01-05 12:00'))).toBe('2026-W02');
  });
});
