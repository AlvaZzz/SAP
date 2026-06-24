import { SchemaType } from '@google/generative-ai';
import { query, queryOne, withTransaction } from '../config/db';
import { generarTexto } from './aiTutorService';

/**
 * Diagnóstico inicial con IA.
 *
 * Flujo:
 *  1) generarPreguntas(usuarioId) → Gemini crea 10 preguntas (2 por categoría).
 *     Si Gemini falla / no hay cuota, se usa un banco estático de respaldo.
 *     Las preguntas (con su respuesta correcta) se guardan en memoria de sesión.
 *  2) evaluar(usuarioId, respuestas) → se califica localmente, se determina el
 *     nivel y Gemini redacta el perfil (fortalezas/debilidades/análisis). El
 *     resultado se persiste y se marca usuarios.diagnostico_completado = true.
 */

// Configurable: número total de preguntas del diagnóstico.
export const NUM_PREGUNTAS = 10;

interface CategoriaDef {
  key: string;
  nivelNumero: number;
}

// Las 5 categorías están alineadas con los 5 niveles del curso.
const CATEGORIAS: CategoriaDef[] = [
  { key: 'Fundamentos de C++', nivelNumero: 1 },
  { key: 'Control de Flujo', nivelNumero: 2 },
  { key: 'Funciones y Modularidad', nivelNumero: 3 },
  { key: 'Estructuras de Datos', nivelNumero: 4 },
  { key: 'Algoritmos', nivelNumero: 5 },
];
const POR_CATEGORIA = Math.max(1, Math.round(NUM_PREGUNTAS / CATEGORIAS.length));

export interface Opcion {
  id: string;
  texto: string;
}
export interface PreguntaInterna {
  id: number;
  categoria: string;
  enunciado: string;
  pseudocodigo?: string;
  opciones: Opcion[];
  correcta: string; // NO se envía al cliente
}
export type PreguntaPublica = Omit<PreguntaInterna, 'correcta'>;

export interface RespuestaEstudiante {
  pregunta_id: number;
  opcion: string;
}

export interface Recomendacion {
  nivel_id: number;
  titulo: string;
  prioridad: 'alta' | 'media' | 'baja';
}

export interface DiagnosticoResultado {
  puntaje: number;
  nivel: 'Principiante' | 'Intermedio' | 'Avanzado';
  fortalezas: string[];
  debilidades: string[];
  recomendaciones: Recomendacion[];
  analisis_ia: string;
}

// Caché en memoria de las preguntas generadas, por usuario (con respuestas).
const cachePreguntas = new Map<number, PreguntaInterna[]>();

// ── Banco de respaldo (si Gemini no está disponible) ────────
const BANCO: Omit<PreguntaInterna, 'id'>[] = [
  {
    categoria: 'Fundamentos de C++',
    enunciado: '¿Qué tipo de dato almacena la variable en: int edad = 20;?',
    pseudocodigo: 'int edad = 20;',
    opciones: [
      { id: 'A', texto: 'Texto (string)' },
      { id: 'B', texto: 'Número entero' },
      { id: 'C', texto: 'Número decimal' },
      { id: 'D', texto: 'Booleano' },
    ],
    correcta: 'B',
  },
  {
    categoria: 'Fundamentos de C++',
    enunciado: 'En C++, ¿qué imprime cout << 7 / 2; (división entera)?',
    pseudocodigo: 'cout << 7 / 2;',
    opciones: [
      { id: 'A', texto: '3.5' },
      { id: 'B', texto: '3' },
      { id: 'C', texto: '4' },
      { id: 'D', texto: 'Error' },
    ],
    correcta: 'B',
  },
  {
    categoria: 'Control de Flujo',
    enunciado: '¿Cuál será el valor de resultado al finalizar la ejecución?',
    pseudocodigo:
      'VAR numero1 = 15;\nVAR numero2 = 4;\nSI (numero1 % numero2 == 3) ENTONCES\n    resultado = numero1 + numero2;\nSINO\n    resultado = numero1 - numero2;\nFIN SI',
    opciones: [
      { id: 'A', texto: '11' },
      { id: 'B', texto: '19' },
      { id: 'C', texto: '3' },
      { id: 'D', texto: 'Error de Sintaxis' },
    ],
    correcta: 'B',
  },
  {
    categoria: 'Control de Flujo',
    enunciado: '¿Cuántas veces se imprime "Hola"?',
    pseudocodigo: 'PARA i DESDE 1 HASTA 5 HACER\n    ESCRIBIR "Hola";\nFIN PARA',
    opciones: [
      { id: 'A', texto: '4' },
      { id: 'B', texto: '5' },
      { id: 'C', texto: '6' },
      { id: 'D', texto: 'Infinitas' },
    ],
    correcta: 'B',
  },
  {
    categoria: 'Funciones y Modularidad',
    enunciado: '¿Qué devuelve factorial(4)?',
    pseudocodigo:
      'Algoritmo factorial(n)\n    Si n <= 1 Entonces\n        Devolver 1\n    Sino\n        Devolver n * factorial(n - 1)\n    Fin Si\nFin Algoritmo',
    opciones: [
      { id: 'A', texto: '12' },
      { id: 'B', texto: '24' },
      { id: 'C', texto: '16' },
      { id: 'D', texto: '4' },
    ],
    correcta: 'B',
  },
  {
    categoria: 'Funciones y Modularidad',
    enunciado: '¿Qué permite el paso de parámetros por referencia?',
    opciones: [
      { id: 'A', texto: 'Trabajar con una copia del valor' },
      { id: 'B', texto: 'Modificar la variable original fuera de la función' },
      { id: 'C', texto: 'Acelerar la compilación' },
      { id: 'D', texto: 'Convertir tipos de datos' },
    ],
    correcta: 'B',
  },
  {
    categoria: 'Estructuras de Datos',
    enunciado: 'Dado int v[] = {10,20,30,40}; ¿qué imprime ESCRIBIR v[2]?',
    pseudocodigo: 'int v[] = {10, 20, 30, 40};\nESCRIBIR v[2];',
    opciones: [
      { id: 'A', texto: '20' },
      { id: 'B', texto: '30' },
      { id: 'C', texto: '40' },
      { id: 'D', texto: '10' },
    ],
    correcta: 'B',
  },
  {
    categoria: 'Estructuras de Datos',
    enunciado: '¿Cuántos elementos tiene la matriz int m[3][4];?',
    pseudocodigo: 'int m[3][4];',
    opciones: [
      { id: 'A', texto: '7' },
      { id: 'B', texto: '12' },
      { id: 'C', texto: '34' },
      { id: 'D', texto: '1' },
    ],
    correcta: 'B',
  },
  {
    categoria: 'Algoritmos',
    enunciado: '¿Cuál es la complejidad de una búsqueda binaria sobre n elementos ordenados?',
    opciones: [
      { id: 'A', texto: 'O(n)' },
      { id: 'B', texto: 'O(log n)' },
      { id: 'C', texto: 'O(n²)' },
      { id: 'D', texto: 'O(1)' },
    ],
    correcta: 'B',
  },
  {
    categoria: 'Algoritmos',
    enunciado: '¿Qué hace el algoritmo de ordenamiento burbuja (bubble sort)?',
    opciones: [
      { id: 'A', texto: 'Busca un elemento dividiendo a la mitad' },
      { id: 'B', texto: 'Ordena intercambiando elementos adyacentes repetidamente' },
      { id: 'C', texto: 'Cuenta la frecuencia de cada valor' },
      { id: 'D', texto: 'Invierte el arreglo' },
    ],
    correcta: 'B',
  },
];

function bancoFallback(): PreguntaInterna[] {
  return BANCO.map((p, i) => ({ ...p, id: i + 1 }));
}

// ════════════════════════════════════════════════════════════
//  1) Generar preguntas
// ════════════════════════════════════════════════════════════
export async function generarPreguntas(usuarioId: number): Promise<PreguntaPublica[]> {
  let preguntas: PreguntaInterna[] | null = null;

  const system = `Eres ALEX, generador de cuestionarios de diagnóstico para estudiantes de
primer semestre de Ingeniería de Sistemas (UPEA, Bolivia). Genera EXACTAMENTE ${NUM_PREGUNTAS}
preguntas de opción múltiple (${POR_CATEGORIA} por cada categoría), en español, de dificultad
creciente. Categorías: ${CATEGORIAS.map((c) => c.key).join(', ')}.
Cuando uses lógica, escribe pseudocódigo en español (Algoritmo/Definir/Si-Sino/Para/Mientras).`;

  const schema = {
    type: SchemaType.ARRAY,
    description: `Lista de exactamente ${NUM_PREGUNTAS} preguntas de opción múltiple de diagnóstico.`,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        categoria: {
          type: SchemaType.STRING,
          description: 'Categoría de la pregunta.',
        },
        enunciado: {
          type: SchemaType.STRING,
          description: 'Pregunta o enunciado a responder.',
        },
        pseudocodigo: {
          type: SchemaType.STRING,
          description: 'Pseudocódigo del ejercicio (opcional).',
        },
        opciones: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              texto: { type: SchemaType.STRING },
            },
            required: ['id', 'texto'],
          },
        },
        correcta: {
          type: SchemaType.STRING,
          description: 'La letra de la opción correcta (A, B, C o D).',
        },
      },
      required: ['categoria', 'enunciado', 'opciones', 'correcta'],
    },
  };

  try {
    const texto = await generarTexto(
      system,
      'Genera el cuestionario de diagnóstico ahora.',
      {
        temperature: 0.2, // Temperatura baja para respuestas estructuradas más precisas
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    );

    const parsed = JSON.parse(texto) as Array<Omit<PreguntaInterna, 'id'>>;
    if (parsed && Array.isArray(parsed) && parsed.length >= 4) {
      preguntas = parsed.slice(0, NUM_PREGUNTAS).map((p, i) => ({
        id: i + 1,
        categoria: String(p.categoria ?? 'General'),
        enunciado: String(p.enunciado ?? ''),
        pseudocodigo: p.pseudocodigo ? String(p.pseudocodigo) : undefined,
        opciones: (p.opciones ?? []).slice(0, 4).map((o, j) => ({
          id: o.id ?? ['A', 'B', 'C', 'D'][j],
          texto: String(o.texto ?? ''),
        })),
        correcta: String(p.correcta ?? 'A').toUpperCase(),
      }));
    }
  } catch (error) {
    console.error('[diagnostico] Error al generar preguntas con Gemini:', error);
    // Gemini sin cuota / sin clave → respaldo silencioso.
  }

  if (!preguntas || preguntas.length === 0) {
    preguntas = bancoFallback();
  }

  cachePreguntas.set(usuarioId, preguntas);
  // Versión pública: sin la respuesta correcta.
  return preguntas.map(({ correcta, ...pub }) => pub);
}

// ════════════════════════════════════════════════════════════
//  2) Evaluar respuestas
// ════════════════════════════════════════════════════════════
function nivelDesdePuntaje(p: number): DiagnosticoResultado['nivel'] {
  if (p <= 40) return 'Principiante';
  if (p <= 70) return 'Intermedio';
  return 'Avanzado';
}

export async function evaluar(
  usuarioId: number,
  respuestas: RespuestaEstudiante[],
): Promise<DiagnosticoResultado> {
  // Recupera las preguntas generadas para este usuario; si la caché se perdió
  // (reinicio del server), usa el banco de respaldo como referencia.
  const preguntas = cachePreguntas.get(usuarioId) ?? bancoFallback();
  const porId = new Map(preguntas.map((p) => [p.id, p]));

  // Califica y agrega por categoría.
  const aciertosCat = new Map<string, { ok: number; total: number }>();
  const detalle: Array<{ categoria: string; enunciado: string; respuesta: string; correcto: boolean }> = [];
  let aciertos = 0;

  for (const p of preguntas) {
    const dada = respuestas.find((r) => r.pregunta_id === p.id)?.opcion?.toUpperCase() ?? '';
    const correcto = dada === p.correcta;
    if (correcto) aciertos++;
    const acc = aciertosCat.get(p.categoria) ?? { ok: 0, total: 0 };
    acc.total++;
    if (correcto) acc.ok++;
    aciertosCat.set(p.categoria, acc);
    detalle.push({ categoria: p.categoria, enunciado: p.enunciado, respuesta: dada, correcto });
  }
  void porId;

  const puntaje = Math.round((aciertos / preguntas.length) * 100);
  const nivel = nivelDesdePuntaje(puntaje);

  // Fortalezas/debilidades por desempeño (>=60% fuerte, <60% a reforzar).
  const fuertes: string[] = [];
  const debiles: { categoria: string; pct: number }[] = [];
  for (const [cat, { ok, total }] of aciertosCat) {
    const pct = total ? Math.round((ok / total) * 100) : 0;
    if (pct >= 60) fuertes.push(cat);
    else debiles.push({ categoria: cat, pct });
  }
  debiles.sort((a, b) => a.pct - b.pct); // las más débiles primero

  // Recomendaciones: niveles correspondientes a las categorías más débiles.
  const niveles = await query<{ id: number; numero: number; titulo: string }>(
    `SELECT id, numero, titulo FROM niveles ORDER BY numero`,
  );
  const nivelPorCategoria = (cat: string) => {
    const def = CATEGORIAS.find((c) => c.key === cat);
    return niveles.find((n) => n.numero === def?.nivelNumero);
  };
  const recomendaciones: Recomendacion[] = debiles
    .map((d, i) => {
      const n = nivelPorCategoria(d.categoria);
      if (!n) return null;
      return { nivel_id: n.id, titulo: n.titulo, prioridad: i === 0 ? 'alta' : 'media' } as Recomendacion;
    })
    .filter((r): r is Recomendacion => r !== null);

  // Si acertó todo, recomienda el siguiente nivel sin completar.
  if (recomendaciones.length === 0 && niveles[0]) {
    recomendaciones.push({ nivel_id: niveles[0].id, titulo: niveles[0].titulo, prioridad: 'baja' });
  }

  // Análisis narrativo con Gemini (con respaldo heurístico).
  let analisis_ia = `Obtuviste ${puntaje}/100, nivel ${nivel}. ` +
    (fuertes.length ? `Destacas en ${fuertes.join(', ')}. ` : '') +
    (debiles.length ? `Conviene reforzar ${debiles.map((d) => d.categoria).join(', ')}.` : '¡Excelente desempeño general!');

  try {
    const resumen = [...aciertosCat.entries()]
      .map(([c, v]) => `${c}: ${v.ok}/${v.total}`)
      .join('; ');
    const system = `Eres ALEX, tutor de programación de la UPEA. Con base en el desempeño por
categoría de un estudiante en su diagnóstico inicial, redacta un análisis breve (2-3 frases),
motivador y en español, que resuma sus fortalezas y qué reforzar. No uses listas ni markdown.`;
    const texto = await generarTexto(system, `Puntaje: ${puntaje}/100 (nivel ${nivel}). Desempeño: ${resumen}.`);
    if (texto && texto.length > 10) analisis_ia = texto;
  } catch {
    // Mantiene el análisis heurístico.
  }

  const fortalezas = fuertes.length ? fuertes : ['Disposición para aprender'];
  const debilidades = debiles.map((d) => d.categoria);

  // Persistencia + marcar diagnóstico completado.
  await withTransaction(async (c) => {
    await c.query(
      `INSERT INTO diagnostico_inicial
         (usuario_id, puntaje, nivel, fortalezas, debilidades, recomendaciones, detalle_respuestas, analisis_ia)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (usuario_id) DO UPDATE SET
         puntaje=EXCLUDED.puntaje, nivel=EXCLUDED.nivel, fortalezas=EXCLUDED.fortalezas,
         debilidades=EXCLUDED.debilidades, recomendaciones=EXCLUDED.recomendaciones,
         detalle_respuestas=EXCLUDED.detalle_respuestas, analisis_ia=EXCLUDED.analisis_ia,
         creado_en=now()`,
      [usuarioId, puntaje, nivel, JSON.stringify(fortalezas), JSON.stringify(debilidades),
       JSON.stringify(recomendaciones), JSON.stringify(detalle), analisis_ia],
    );
    await c.query(`UPDATE usuarios SET diagnostico_completado = TRUE WHERE id = $1`, [usuarioId]);
  });

  cachePreguntas.delete(usuarioId);

  return { puntaje, nivel, fortalezas, debilidades, recomendaciones, analisis_ia };
}

// ════════════════════════════════════════════════════════════
//  3) Estado del diagnóstico (sin IA)
// ════════════════════════════════════════════════════════════
export async function getEstado(
  usuarioId: number,
): Promise<{ completado: boolean; resultado: DiagnosticoResultado | null }> {
  const u = await queryOne<{ diagnostico_completado: boolean }>(
    `SELECT diagnostico_completado FROM usuarios WHERE id = $1`,
    [usuarioId],
  );
  const completado = u?.diagnostico_completado ?? false;
  if (!completado) return { completado: false, resultado: null };

  const r = await queryOne<DiagnosticoResultado>(
    `SELECT puntaje, nivel, fortalezas, debilidades, recomendaciones, analisis_ia
       FROM diagnostico_inicial WHERE usuario_id = $1`,
    [usuarioId],
  );
  return { completado: true, resultado: r };
}
