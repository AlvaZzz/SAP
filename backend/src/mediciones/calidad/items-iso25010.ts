/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  CUESTIONARIO DE CALIDAD DEL PRODUCTO DE SOFTWARE — ISO/IEC 25010:2023
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ARCHIVO DE DATOS EDITABLE. Aquí vive el CONTENIDO del instrumento: las
 *  características seleccionadas en la tesis (Cap. III, Tabla 3), sus
 *  subcaracterísticas y los ítems Likert 1–5 de cada una.
 *
 *  ⚠ ESTADO: ÍTEMS PROVISIONALES. La redacción de abajo es un BORRADOR DE
 *  TRABAJO para que el flujo funcione de punta a punta. NO está validada por
 *  juicio de expertos (V de Aiken, apartado 3.7.1 de la tesis). Antes de
 *  recolectar datos reales:
 *    1. Reemplaza los textos por los del cuestionario validado.
 *    2. Pon `INSTRUMENTO_VALIDADO = true`.
 *    3. Sube `VERSION_ISO25010` (las respuestas de una versión no se mezclan
 *       con las de otra).
 *  Mientras `INSTRUMENTO_VALIDADO` sea false, el panel del investigador lo
 *  advierte junto a cada resultado de calidad.
 *
 *  Reglas para editar:
 *    · Máximo 10 ítems por característica (el cuestionario debe ser breve).
 *    · Cada `id` es único y estable: no lo reutilices para otro texto.
 *    · Todos los ítems se redactan en sentido POSITIVO (5 = mejor calidad).
 *
 *  Quién responde: docentes del área y evaluadores con formación en ingeniería
 *  de software (no los estudiantes, que responden el SUS).
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const VERSION_ISO25010 = 'ISO25010-2023-borrador-1';
export const INSTRUMENTO_VALIDADO = false;
export const MAX_ITEMS_POR_CARACTERISTICA = 10;

export interface ItemCalidad {
  id: string;
  texto: string;
}

export interface Subcaracteristica {
  clave: string;
  nombre: string;
  items: ItemCalidad[];
}

export interface Caracteristica {
  clave: string;
  nombre: string;
  /** Por qué se incluye (Tabla 3 del Capítulo III). */
  justificacion: string;
  subcaracteristicas: Subcaracteristica[];
}

export const CARACTERISTICAS_ISO25010: Caracteristica[] = [
  {
    clave: 'adecuacion_funcional',
    nombre: 'Adecuación funcional',
    justificacion: 'Verifica que el sistema cubra las funciones comprometidas y que sus resultados sean correctos.',
    subcaracteristicas: [
      {
        clave: 'completitud_funcional',
        nombre: 'Completitud funcional',
        items: [{ id: 'AF1', texto: 'PREXI ofrece las funciones necesarias para practicar y dar seguimiento al aprendizaje de programación.' }],
      },
      {
        clave: 'correccion_funcional',
        nombre: 'Corrección funcional',
        items: [{ id: 'AF2', texto: 'Los resultados que entrega PREXI (corrección de respuestas, puntajes y niveles) son correctos.' }],
      },
    ],
  },
  {
    clave: 'eficiencia_desempeno',
    nombre: 'Eficiencia de desempeño',
    justificacion: 'Evalúa los tiempos de respuesta del motor adaptativo y el consumo de recursos.',
    subcaracteristicas: [
      {
        clave: 'comportamiento_temporal',
        nombre: 'Comportamiento temporal',
        items: [{ id: 'ED1', texto: 'PREXI responde con rapidez al enviar una respuesta y al cargar el siguiente ejercicio.' }],
      },
      {
        clave: 'utilizacion_recursos',
        nombre: 'Utilización de recursos',
        items: [{ id: 'ED2', texto: 'PREXI funciona con fluidez en equipos y conexiones de características modestas.' }],
      },
    ],
  },
  {
    clave: 'capacidad_interaccion',
    nombre: 'Capacidad de interacción',
    justificacion: 'Complementa la medición del SUS desde la perspectiva del evaluador experto.',
    subcaracteristicas: [
      {
        clave: 'capacidad_aprendizaje',
        nombre: 'Capacidad de aprendizaje',
        items: [{ id: 'CI1', texto: 'Un usuario nuevo puede aprender a usar PREXI sin capacitación previa.' }],
      },
      {
        clave: 'operabilidad',
        nombre: 'Operabilidad',
        items: [{ id: 'CI2', texto: 'Las pantallas y controles de PREXI son fáciles de operar y de recorrer.' }],
      },
    ],
  },
  {
    clave: 'fiabilidad',
    nombre: 'Fiabilidad',
    justificacion: 'Comprueba la disponibilidad del servicio y su capacidad de recuperación ante fallos.',
    subcaracteristicas: [
      {
        clave: 'disponibilidad',
        nombre: 'Disponibilidad',
        items: [{ id: 'FI1', texto: 'PREXI está disponible y accesible cuando se necesita usarlo.' }],
      },
      {
        clave: 'recuperabilidad',
        nombre: 'Recuperabilidad',
        items: [{ id: 'FI2', texto: 'Tras un error o una interrupción, PREXI conserva el avance y permite continuar.' }],
      },
    ],
  },
  {
    clave: 'seguridad',
    nombre: 'Seguridad',
    justificacion: 'Examina el control de acceso y la protección de los datos académicos del estudiante.',
    subcaracteristicas: [
      {
        clave: 'confidencialidad',
        nombre: 'Confidencialidad',
        items: [{ id: 'SE1', texto: 'Cada usuario accede únicamente a la información que corresponde a su rol.' }],
      },
      {
        clave: 'autenticidad',
        nombre: 'Autenticidad',
        items: [{ id: 'SE2', texto: 'PREXI verifica adecuadamente la identidad de quien inicia sesión.' }],
      },
    ],
  },
  {
    clave: 'mantenibilidad',
    nombre: 'Mantenibilidad',
    justificacion: 'Valora la modularidad del código y la facilidad de incorporar modificaciones posteriores.',
    subcaracteristicas: [
      {
        clave: 'modularidad',
        nombre: 'Modularidad',
        items: [{ id: 'MA1', texto: 'El sistema está organizado en módulos claramente separados por responsabilidad.' }],
      },
      {
        clave: 'modificabilidad',
        nombre: 'Modificabilidad',
        items: [{ id: 'MA2', texto: 'Es posible incorporar cambios o contenidos nuevos sin afectar el resto del sistema.' }],
      },
    ],
  },
];

/** Todos los ítems en orden, con la característica y subcaracterística a la que pertenecen. */
export function itemsIso25010(): { id: string; texto: string; caracteristica: string; subcaracteristica: string }[] {
  return CARACTERISTICAS_ISO25010.flatMap((c) =>
    c.subcaracteristicas.flatMap((s) =>
      s.items.map((i) => ({ id: i.id, texto: i.texto, caracteristica: c.clave, subcaracteristica: s.clave })),
    ),
  );
}
