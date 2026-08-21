// ============================================================
//  Deteccion de patrones de error recurrentes
//  Analiza los intentos FALLIDOS del estudiante y detecta errores tipicos de
//  principiantes en Python (confundir = con ==, for con while, olvidar los dos
//  puntos, etc.). PREXI usa estos patrones para abordar la debilidad concreta;
//  tambien nutren el seguimiento del docente.
//  PURO y determinista -> testeable y auditable para la tesis.
// ============================================================

/** Intento simplificado que necesita el detector (subconjunto de Intento + Ejercicio). */
export interface IntentoParaPatron {
  correcto: boolean;
  respuestaDada: string;
  categoria: string;
  tipo: string; // TipoEjercicio como string
  respuestaCorrecta: string;
}

/** Un patron de error detectado, con su frecuencia (cuantos intentos lo evidencian). */
export interface PatronError {
  clave: string;
  descripcion: string;
  frecuencia: number;
}

const contiene = (s: string, re: RegExp) => re.test(s);

/** Reglas lexicas sobre respuestas de texto libre (completar_codigo, sobre todo). */
const REGLAS: {
  clave: string;
  descripcion: string;
  test: (dada: string, correcta: string) => boolean;
}[] = [
  {
    clave: 'confunde_asignacion_comparacion',
    descripcion: 'Confunde el operador de asignacion (=) con el de comparacion (==).',
    test: (dada, correcta) =>
      contiene(correcta, /==/) && contiene(dada, /[^=!<>]=[^=]/) && !contiene(dada, /==/),
  },
  {
    clave: 'confunde_for_while',
    descripcion: 'Mezcla los bucles for y while.',
    test: (dada, correcta) =>
      (contiene(correcta, /\bfor\b/) && contiene(dada, /\bwhile\b/) && !contiene(dada, /\bfor\b/)) ||
      (contiene(correcta, /\bwhile\b/) && contiene(dada, /\bfor\b/) && !contiene(dada, /\bwhile\b/)),
  },
  {
    clave: 'olvida_dos_puntos',
    descripcion: 'Olvida los dos puntos (:) al terminar la cabecera de un bloque.',
    test: (dada, correcta) =>
      contiene(correcta, /:\s*$/) && dada.trim().length > 0 && !contiene(dada, /:\s*$/),
  },
  {
    clave: 'error_range',
    descripcion: 'No usa range() correctamente al recorrer con for.',
    test: (dada, correcta) =>
      contiene(correcta, /range\s*\(/) && !contiene(dada, /range\s*\(/),
  },
  {
    clave: 'confunde_print_return',
    descripcion: 'Confunde mostrar en pantalla (print) con devolver un valor (return).',
    test: (dada, correcta) =>
      (contiene(correcta, /\bprint\b/) && contiene(dada, /\breturn\b/) && !contiene(dada, /\bprint\b/)) ||
      (contiene(correcta, /\breturn\b/) && contiene(dada, /\bprint\b/) && !contiene(dada, /\breturn\b/)),
  },
];

/** Minimo de fallos en una misma categoria para considerarla debilidad recurrente. */
const MIN_FALLOS_CATEGORIA = 2;

/**
 * Detecta patrones de error a partir de los intentos. Considera solo los
 * fallidos. Devuelve los patrones ordenados por frecuencia (desc), acotados.
 */
export function detectarPatrones(intentos: IntentoParaPatron[], maxPatrones = 3): PatronError[] {
  const fallos = intentos.filter((i) => !i.correcto);
  if (fallos.length === 0) return [];

  const conteo = new Map<string, PatronError>();
  const bump = (clave: string, descripcion: string) => {
    const p = conteo.get(clave) ?? { clave, descripcion, frecuencia: 0 };
    p.frecuencia++;
    conteo.set(clave, p);
  };

  // 1) Reglas lexicas sobre el texto de la respuesta.
  for (const it of fallos) {
    const dada = (it.respuestaDada ?? '').toLowerCase();
    const correcta = (it.respuestaCorrecta ?? '').toLowerCase();
    if (!dada || !correcta) continue;
    for (const regla of REGLAS) {
      if (regla.test(dada, correcta)) bump(regla.clave, regla.descripcion);
    }
  }

  // 2) Debilidad por categoria: muchos fallos en el mismo tema/categoria.
  const porCategoria = new Map<string, number>();
  for (const it of fallos) {
    const cat = (it.categoria ?? '').trim();
    if (cat) porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + 1);
  }
  for (const [cat, n] of porCategoria) {
    if (n >= MIN_FALLOS_CATEGORIA) {
      conteo.set(`debilidad_${cat.toLowerCase()}`, {
        clave: `debilidad_${cat.toLowerCase()}`,
        descripcion: `Errores repetidos en "${cat}".`,
        frecuencia: n,
      });
    }
  }

  return [...conteo.values()]
    .sort((a, b) => b.frecuencia - a.frecuencia || a.clave.localeCompare(b.clave))
    .slice(0, maxPatrones);
}
