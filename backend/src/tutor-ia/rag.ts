// ============================================================
//  RAG simple sobre el material del docente
//  Recuperacion lexica (sin embeddings ni servicios externos): trocea el texto
//  del PDF del docente y devuelve los fragmentos mas relevantes para la consulta
//  del estudiante. Asi ALVARO responde con la sintaxis y los ejemplos que enseno
//  el docente en clase, no solo con conocimiento generico.
//  Es PURO y determinista -> testeable y auditable para la tesis.
// ============================================================

/** Palabras vacias que no aportan a la relevancia (espanol + ruido comun). */
const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'a',
  'y', 'o', 'u', 'e', 'que', 'como', 'con', 'sin', 'por', 'para', 'en', 'es',
  'son', 'ser', 'este', 'esta', 'esto', 'ese', 'esa', 'eso', 'se', 'su', 'sus',
  'lo', 'le', 'mi', 'me', 'te', 'no', 'si', 'mas', 'pero', 'porque',
  'cuando', 'donde', 'cual', 'cuales', 'muy', 'todo', 'toda', 'hay', 'ya',
]);

/** Minusculas + sin acentos, para comparar de forma robusta. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Tokens significativos de la consulta (>=3 letras, sin stopwords). */
function tokenizar(consulta: string): string[] {
  const vistos = new Set<string>();
  for (const raw of normalizar(consulta).split(/[^a-z0-9_]+/)) {
    if (raw.length >= 3 && !STOPWORDS.has(raw)) vistos.add(raw);
  }
  return [...vistos];
}

/** Divide el material en fragmentos manejables (por parrafos y, si son largos, por oraciones). */
function trocear(texto: string, tam = 320): string[] {
  const chunks: string[] = [];
  for (const parrafoRaw of texto.split(/\n\s*\n/)) {
    const parrafo = parrafoRaw.trim();
    if (!parrafo) continue;
    if (parrafo.length <= tam * 1.5) {
      chunks.push(parrafo);
      continue;
    }
    let buf = '';
    for (const oracion of parrafo.split(/(?<=[.!?])\s+/)) {
      if (buf && (buf.length + oracion.length) > tam) {
        chunks.push(buf.trim());
        buf = '';
      }
      buf += (buf ? ' ' : '') + oracion;
    }
    if (buf.trim()) chunks.push(buf.trim());
  }
  return chunks;
}

export interface OpcionesRag {
  /** Maximo de caracteres del texto recuperado. */
  maxChars?: number;
  /** Maximo de fragmentos a concatenar. */
  maxFragmentos?: number;
}

/**
 * Devuelve los fragmentos del material mas relevantes para la consulta.
 * - Si no hay material -> cadena vacia.
 * - Si la consulta no tiene tokens utiles (o no hay coincidencias) -> el inicio
 *   del material (mejor que nada, mantiene el estilo del docente).
 */
export function recuperarFragmentos(
  texto: string | null | undefined,
  consulta: string,
  { maxChars = 1600, maxFragmentos = 3 }: OpcionesRag = {},
): string {
  const material = (texto ?? '').trim();
  if (!material) return '';

  const tokens = tokenizar(consulta);
  if (tokens.length === 0) return material.slice(0, maxChars);

  const chunks = trocear(material);
  const puntuados = chunks.map((chunk, i) => {
    const norm = normalizar(chunk);
    let score = 0;
    for (const t of tokens) score += norm.split(t).length - 1;
    return { chunk, score, i };
  });

  const relevantes = puntuados
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, maxFragmentos);

  if (relevantes.length === 0) return material.slice(0, maxChars);

  // Reordena por posicion original para que el fragmento se lea coherente.
  relevantes.sort((a, b) => a.i - b.i);
  return relevantes.map((r) => r.chunk).join('\n...\n').slice(0, maxChars);
}
