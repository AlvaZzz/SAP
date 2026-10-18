/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  LECTURA DE LA LISTA DE ESTUDIANTES — funciones puras
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  El docente sube el Excel que YA tiene (la nómina de la carrera, su lista de
 *  asistencia…), con las columnas en cualquier orden y con cualquier nombre.
 *  Este módulo:
 *    1. encuentra la fila de encabezados (las nóminas suelen traer títulos arriba);
 *    2. reconoce qué columna es cada dato por sus sinónimos;
 *    3. separa un "nombre completo" en paterno, materno y nombres;
 *    4. limpia y valida cada fila.
 *
 *  Sin Prisma ni Nest: se prueba fila a fila en lista.spec.ts.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { errorNombrePersona } from '../../common/usuario/usuario-acceso';

export type CampoLista = 'apellidoPaterno' | 'apellidoMaterno' | 'nombres' | 'nombreCompleto' | 'ci' | 'ru' | 'paralelo';

export const CAMPOS: { clave: CampoLista; etiqueta: string }[] = [
  { clave: 'apellidoPaterno', etiqueta: 'Apellido paterno' },
  { clave: 'apellidoMaterno', etiqueta: 'Apellido materno' },
  { clave: 'nombres', etiqueta: 'Nombres' },
  { clave: 'nombreCompleto', etiqueta: 'Nombre completo (una sola columna)' },
  { clave: 'ci', etiqueta: 'CI' },
  { clave: 'ru', etiqueta: 'RU' },
  { clave: 'paralelo', etiqueta: 'Paralelo' },
];

/** índice de columna (0-based) de cada campo, o null si no está en el archivo. */
export type Mapeo = Record<CampoLista, number | null>;

export const MAPEO_VACIO: Mapeo = {
  apellidoPaterno: null, apellidoMaterno: null, nombres: null, nombreCompleto: null, ci: null, ru: null, paralelo: null,
};

/** Minúsculas, sin acentos ni signos: "Ap. Paterno" → "ap paterno". */
export function normalizar(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

/**
 * Sinónimos de cada columna. El orden importa: se prueban de arriba abajo y la
 * primera coincidencia gana, así que "apellido paterno" se resuelve antes de
 * que "nombre" pueda quedarse con una columna que dice "apellidos y nombres".
 */
const SINONIMOS: { campo: CampoLista; patrones: RegExp[] }[] = [
  { campo: 'apellidoPaterno', patrones: [/\bpaterno\b/, /\bap pat\b/, /\bapellido pat\b/, /\bprimer apellido\b/, /\bapellido 1\b/] },
  { campo: 'apellidoMaterno', patrones: [/\bmaterno\b/, /\bap mat\b/, /\bapellido mat\b/, /\bsegundo apellido\b/, /\bapellido 2\b/] },
  { campo: 'nombreCompleto', patrones: [/\bapellidos? y nombres?\b/, /\bnombres? y apellidos?\b/, /\bnombre completo\b/, /^estudiantes?$/, /^alumnos?$/, /^universitarios?$/, /^postulantes?$/] },
  { campo: 'ru', patrones: [/^r u$/, /^ru$/, /\bregistro universitario\b/, /\bregistro univ\b/, /\bnro registro\b/, /\bn registro\b/, /^registro$/, /\bmatricula\b/, /^r u n$/] },
  { campo: 'ci', patrones: [/^c i$/, /^ci$/, /\bcedula\b/, /\bcarnet\b/, /\bcarne\b/, /\bdocumento\b/, /\bc i n\b/, /\bnro c i\b/, /\bidentidad\b/] },
  { campo: 'paralelo', patrones: [/\bparalelo\b/, /^par$/, /^grupo$/, /^curso$/, /^seccion$/] },
  { campo: 'nombres', patrones: [/^nombres?$/, /\bnombres?\b/] },
];

/** ¿A qué campo corresponde un encabezado? null si no se reconoce. */
export function campoDeEncabezado(encabezado: unknown): CampoLista | null {
  const n = normalizar(encabezado);
  if (!n) return null;
  for (const { campo, patrones } of SINONIMOS) {
    if (patrones.some((p) => p.test(n))) return campo;
  }
  // "Apellidos" a secas (sin paterno/materno): es un nombre completo parcial.
  if (/^apellidos?$/.test(n)) return 'apellidoPaterno';
  return null;
}

export interface Deteccion {
  /** Fila (0-based) donde están los encabezados; -1 si el archivo no trae. */
  filaEncabezado: number;
  encabezados: string[];
  mapeo: Mapeo;
  /** Campos obligatorios que no se pudieron ubicar. */
  faltantes: string[];
}

/** Mapea una fila de encabezados. La primera columna que coincide con un campo se lo queda. */
export function mapearEncabezados(encabezados: unknown[]): Mapeo {
  const mapeo: Mapeo = { ...MAPEO_VACIO };
  encabezados.forEach((e, i) => {
    const campo = campoDeEncabezado(e);
    if (campo && mapeo[campo] === null) mapeo[campo] = i;
  });
  return mapeo;
}

const camposMapeados = (m: Mapeo): number => Object.values(m).filter((v) => v !== null).length;

/** Qué le falta a un mapeo para poder armar a los estudiantes. */
export function faltantesDe(mapeo: Mapeo): string[] {
  const faltan: string[] = [];
  const hayNombre = mapeo.nombreCompleto !== null || (mapeo.apellidoPaterno !== null && mapeo.nombres !== null);
  if (!hayNombre) faltan.push('Nombre (apellidos y nombres)');
  if (mapeo.ci === null) faltan.push('CI');
  // El RU (matrícula) es opcional: el estudiante entra con su primer nombre y su CI.
  return faltan;
}

/**
 * Busca la fila de encabezados entre las primeras 20: la que más columnas
 * reconocibles tiene (mínimo 2). Las nóminas oficiales suelen empezar con el
 * nombre de la universidad, la carrera y la gestión antes de la tabla.
 */
export function detectarColumnas(filas: unknown[][]): Deteccion {
  let mejor = { fila: -1, mapeo: { ...MAPEO_VACIO }, n: 0 };
  filas.slice(0, 20).forEach((fila, i) => {
    const mapeo = mapearEncabezados(fila);
    const n = camposMapeados(mapeo);
    if (n > mejor.n) mejor = { fila: i, mapeo, n };
  });
  if (mejor.n < 2) {
    const ancho = Math.max(0, ...filas.slice(0, 20).map((f) => f.length));
    return {
      filaEncabezado: -1,
      encabezados: Array.from({ length: ancho }, (_, i) => `Columna ${i + 1}`),
      mapeo: { ...MAPEO_VACIO },
      faltantes: faltantesDe(MAPEO_VACIO),
    };
  }
  const encabezados = filas[mejor.fila].map((c, i) => String(c ?? '').trim() || `Columna ${i + 1}`);
  return { filaEncabezado: mejor.fila, encabezados, mapeo: mejor.mapeo, faltantes: faltantesDe(mejor.mapeo) };
}

/** "MAMANI QUISPE" → "Mamani Quispe" (respeta partículas como "de la"). */
export function capitalizar(texto: string): string {
  const particulas = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'di', 'van', 'von']);
  return texto
    .trim().replace(/\s+/g, ' ').toLowerCase().split(' ')
    .map((p, i) => (i > 0 && particulas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

export interface NombreSeparado {
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
}

/** Une partículas con el apellido que acompañan: ["de","la","cruz","juan"] → ["de la cruz","juan"]. */
function agruparParticulas(tokens: string[]): string[] {
  const particulas = new Set(['de', 'del', 'la', 'las', 'los', 'da', 'di', 'van', 'von', 'san', 'santa']);
  const out: string[] = [];
  let pendiente: string[] = [];
  for (const t of tokens) {
    if (particulas.has(t.toLowerCase())) { pendiente.push(t); continue; }
    out.push([...pendiente, t].join(' '));
    pendiente = [];
  }
  if (pendiente.length) out.push(pendiente.join(' '));
  return out;
}

/**
 * Separa un nombre completo. Dos formatos habituales en las listas:
 *   · "APELLIDOS, NOMBRES"  → la coma separa.
 *   · "PATERNO MATERNO NOMBRES" (formato de las nóminas): los dos primeros son
 *     apellidos y el resto, nombres. Con solo dos palabras: paterno + nombre.
 * Es una heurística: por eso el docente SIEMPRE revisa la vista previa.
 */
export function separarNombreCompleto(texto: unknown): NombreSeparado {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (!limpio) return { apellidoPaterno: '', apellidoMaterno: '', nombres: '' };

  if (limpio.includes(',')) {
    const [apellidos, ...resto] = limpio.split(',');
    const ap = agruparParticulas(apellidos.trim().split(' ').filter(Boolean));
    return {
      apellidoPaterno: capitalizar(ap[0] ?? ''),
      apellidoMaterno: capitalizar(ap.slice(1).join(' ')),
      nombres: capitalizar(resto.join(' ')),
    };
  }

  const partes = agruparParticulas(limpio.split(' '));
  if (partes.length === 1) return { apellidoPaterno: capitalizar(partes[0]), apellidoMaterno: '', nombres: '' };
  if (partes.length === 2) return { apellidoPaterno: capitalizar(partes[0]), apellidoMaterno: '', nombres: capitalizar(partes[1]) };
  return {
    apellidoPaterno: capitalizar(partes[0]),
    apellidoMaterno: capitalizar(partes[1]),
    nombres: capitalizar(partes.slice(2).join(' ')),
  };
}

/** CI: se conservan dígitos y el complemento ("1234567-1A", "1234567 LP" → "1234567"). */
export function limpiarCi(valor: unknown): string {
  const s = String(valor ?? '').trim().toUpperCase().replace(/\.0+$/, '');
  // Quita la extensión departamental (LP, CB, SC…) y puntos de miles.
  return s.replace(/\b(LP|CB|SC|OR|PT|CH|TJ|BE|PD|BN)\b\.?/g, '').replace(/[.\s]/g, '').replace(/[^0-9A-Z-]/g, '');
}

/** RU: solo dígitos (Excel a veces lo entrega como "200012345.0"). */
export function limpiarRu(valor: unknown): string {
  return String(valor ?? '').trim().replace(/\.0+$/, '').replace(/[^0-9]/g, '');
}

/** Paralelo: "paralelo a", "Par. B", " c " → "A", "B", "C". */
export function limpiarParalelo(valor: unknown): string {
  return String(valor ?? '').trim().toUpperCase().replace(/^PAR(ALELO)?\.?\s*/, '').replace(/\s+/g, ' ').slice(0, 10);
}

export interface FilaEstudiante {
  /** Nº de fila en el archivo original (para ubicar errores). 0 = cargado a mano. */
  fila: number;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
  ci: string;
  ru: string;
  paralelo: string;
}

/** Convierte las filas crudas del archivo en estudiantes, según el mapeo. Descarta filas vacías. */
export function aplicarMapeo(
  filas: unknown[][],
  filaEncabezado: number,
  mapeo: Mapeo,
  paraleloPorDefecto = '',
): FilaEstudiante[] {
  const celda = (fila: unknown[], i: number | null) => (i === null ? '' : String(fila[i] ?? '').trim());
  const out: FilaEstudiante[] = [];
  filas.forEach((fila, idx) => {
    if (idx <= filaEncabezado) return;
    let apellidoPaterno = capitalizar(celda(fila, mapeo.apellidoPaterno));
    let apellidoMaterno = capitalizar(celda(fila, mapeo.apellidoMaterno));
    let nombres = capitalizar(celda(fila, mapeo.nombres));

    if (mapeo.nombreCompleto !== null && !nombres) {
      const s = separarNombreCompleto(celda(fila, mapeo.nombreCompleto));
      apellidoPaterno ||= s.apellidoPaterno; apellidoMaterno ||= s.apellidoMaterno; nombres = s.nombres;
    } else if (mapeo.apellidoMaterno === null && apellidoPaterno.includes(' ') && mapeo.nombreCompleto === null) {
      // Columna "Apellidos" con los dos juntos: se parte en paterno y materno.
      const s = separarNombreCompleto(`${apellidoPaterno} x`);
      apellidoPaterno = s.apellidoPaterno; apellidoMaterno = s.apellidoMaterno;
    }

    const ci = limpiarCi(celda(fila, mapeo.ci));
    const ru = limpiarRu(celda(fila, mapeo.ru));
    const paralelo = limpiarParalelo(celda(fila, mapeo.paralelo)) || limpiarParalelo(paraleloPorDefecto);
    // Fila en blanco, o fila de totales/firmas al pie de la nómina.
    if (!apellidoPaterno && !nombres && !ci && !ru) return;
    if (!ci && !ru && !nombres) return;
    out.push({ fila: idx + 1, apellidoPaterno, apellidoMaterno, nombres, ci, ru, paralelo });
  });
  return out;
}

export type EstadoFila = 'nuevo' | 'existe' | 'error';

export interface FilaValidada extends FilaEstudiante {
  nombreCompleto: string;
  estado: EstadoFila;
  /** Mensajes para el docente, uno por problema. */
  errores: string[];
  /** Campos con problema, para pintarlos en rojo. */
  camposConError: string[];
  /** id del estudiante que ya existe con ese CI (si aplica). */
  existenteId: number | null;
}

export const nombreCompletoDe = (f: { apellidoPaterno: string; apellidoMaterno: string; nombres: string }): string =>
  [f.apellidoPaterno, f.apellidoMaterno, f.nombres].map((p) => p.trim()).filter(Boolean).join(' ');

export interface Existente { id: number; ci: string | null; ru: string | null; rol: string }

/**
 * Valida todas las filas: campos vacíos, formato, duplicados DENTRO del archivo
 * y coincidencias con cuentas que ya existen en la base.
 *
 *  · error  → no se puede registrar hasta corregirlo.
 *  · existe → ese CI ya es de un estudiante registrado (el docente decide: actualizar u omitir).
 *  · nuevo  → se creará la cuenta.
 */
export function validarFilas(filas: FilaEstudiante[], existentes: Existente[]): FilaValidada[] {
  const cuenta = (campo: 'ci' | 'ru') => {
    const m = new Map<string, number>();
    for (const f of filas) if (f[campo]) m.set(f[campo], (m.get(f[campo]) ?? 0) + 1);
    return m;
  };
  const ciEnArchivo = cuenta('ci');
  const ruEnArchivo = cuenta('ru');
  const porRu = new Map(existentes.filter((e) => e.ru).map((e) => [e.ru!, e]));
  const porCi = new Map(existentes.filter((e) => e.ci).map((e) => [e.ci!, e]));

  return filas.map((f): FilaValidada => {
    const errores: string[] = [];
    const campos = new Set<string>();
    const falla = (campo: string, mensaje: string) => { errores.push(mensaje); campos.add(campo); };

    if (!f.apellidoPaterno) falla('apellidoPaterno', 'Falta el apellido paterno.');
    else {
      const e = errorNombrePersona(f.apellidoPaterno, 'el apellido paterno');
      if (e) falla('apellidoPaterno', e);
    }
    if (f.apellidoMaterno) {
      const e = errorNombrePersona(f.apellidoMaterno, 'el apellido materno');
      if (e) falla('apellidoMaterno', e);
    }
    if (!f.nombres) falla('nombres', 'Faltan los nombres.');
    else {
      const e = errorNombrePersona(f.nombres, 'los nombres');
      if (e) falla('nombres', e);
    }
    if (!f.ci) falla('ci', 'Falta el CI.');
    else if (!/^\d{5,10}(-?[0-9A-Z]{1,3})?$/.test(f.ci)) falla('ci', 'El CI no tiene un formato válido (5 a 10 dígitos).');
    // RU opcional: si viene, debe tener formato de RU.
    if (f.ru && !/^\d{4,12}$/.test(f.ru)) falla('ru', 'El RU debe tener entre 4 y 12 dígitos (o déjalo vacío).');
    if (!f.paralelo) falla('paralelo', 'Falta el paralelo.');

    if (f.ci && (ciEnArchivo.get(f.ci) ?? 0) > 1) falla('ci', 'CI repetido en la lista.');
    if (f.ru && (ruEnArchivo.get(f.ru) ?? 0) > 1) falla('ru', 'RU repetido en la lista.');

    // La cuenta se reconoce por el CI (con él se arma el usuario "Nombre_CI").
    const mismoCi = f.ci ? porCi.get(f.ci) : undefined;
    const mismoRu = f.ru ? porRu.get(f.ru) : undefined;
    if (mismoCi && mismoCi.rol !== 'estudiante') falla('ci', 'Ese CI pertenece a una cuenta que no es de estudiante.');
    // El RU ya está en una cuenta distinta de la que tiene este CI: conflicto real.
    if (mismoRu && (!mismoCi || mismoRu.id !== mismoCi.id)) falla('ru', 'Ese RU ya está registrado en otra cuenta.');

    const existente = mismoCi && mismoCi.rol === 'estudiante' ? mismoCi : null;
    return {
      ...f,
      nombreCompleto: nombreCompletoDe(f),
      estado: errores.length ? 'error' : existente ? 'existe' : 'nuevo',
      errores,
      camposConError: [...campos],
      existenteId: existente?.id ?? null,
    };
  });
}
