import { BadRequestException, ValidationError } from '@nestjs/common';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  MENSAJES DE VALIDACIÓN EN ESPAÑOL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  class-validator responde en inglés cuando una regla no trae `message`
 *  ("nombre must be a string", "property x should not exist"). El frontend
 *  muestra ese texto tal cual al usuario, así que un formulario con un dato
 *  mal puesto terminaba en un error en inglés que nadie entiende.
 *
 *  Aquí se traducen SOLO los mensajes por defecto de la librería, de forma
 *  centralizada para todos los DTO. Un mensaje propio (ya escrito en español en
 *  el DTO) se respeta tal cual.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Cómo se nombra cada campo ante el usuario. Lo que no está aquí sale como «el campo x». */
const ETIQUETAS: Record<string, string> = {
  email: 'el usuario', password: 'la contraseña', nueva: 'la nueva contraseña', actual: 'la contraseña actual',
  nombre: 'el nombre', nombres: 'los nombres', apellidoPaterno: 'el apellido paterno', apellidoMaterno: 'el apellido materno',
  cedula: 'el CI', ru: 'el RU', carrera: 'la carrera', institucion: 'la institución', paralelo: 'el paralelo',
  paraleloId: 'el paralelo', semestre: 'el semestre', rol: 'el rol', usuario: 'el usuario',
  titulo: 'el título', descripcion: 'la descripción', enunciado: 'el enunciado', texto: 'el texto',
  categoria: 'la categoría', tipo: 'el tipo', nivel: 'el nivel', numero: 'el número', orden: 'el orden',
  xp: 'los puntos XP', estrellas: 'las estrellas', opciones: 'las opciones', respuestaCorrecta: 'la respuesta correcta',
  codigoPython: 'el código', codigoInicial: 'el código inicial', ejemploEntrada: 'el ejemplo de entrada',
  ejemploSalida: 'el ejemplo de salida', explicacionIa: 'la explicación', temaId: 'el tema', unidadId: 'la unidad',
  materiaId: 'la materia', docenteId: 'el docente', sigla: 'la sigla', fechaLimite: 'la fecha límite',
  umbral: 'el umbral', valor: 'el valor', motivo: 'el motivo', token: 'el código', respuestas: 'las respuestas',
  respuestaDada: 'la respuesta',
};

const etiqueta = (campo: string) => ETIQUETAS[campo] ?? `el campo «${campo}»`;
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const numero = (msg: string) => msg.match(/-?\d+(?:\.\d+)?/)?.[0] ?? '';

/**
 * Traduce un mensaje por defecto de class-validator. Devuelve null si el
 * mensaje NO es el de la librería (o sea, es uno propio que hay que respetar).
 */
export function traducirRestriccion(regla: string, mensaje: string, campo: string): string | null {
  const propio = !(
    mensaje.startsWith(`${campo} `) || mensaje.startsWith(`property ${campo} `) ||
    /^(each value in )?\S+ (must|should|has to)\b/.test(mensaje)
  );
  if (propio) return null;

  const c = etiqueta(campo);
  const n = numero(mensaje);
  switch (regla) {
    case 'whitelistValidation': return `No se esperaba ${c}. Recarga la página e inténtalo de nuevo.`;
    case 'isNotEmpty':
    case 'isDefined': return `Completa ${c}.`;
    case 'isString': return `${mayuscula(c)} debe ser un texto.`;
    case 'isInt': return `${mayuscula(c)} debe ser un número entero.`;
    case 'isNumber': return `${mayuscula(c)} debe ser un número.`;
    case 'isBoolean': return `${mayuscula(c)} debe ser sí o no.`;
    case 'isEmail': return `${mayuscula(c)} no tiene el formato de un correo.`;
    case 'minLength': return `${mayuscula(c)} debe tener al menos ${n} caracteres.`;
    case 'maxLength': return `${mayuscula(c)} puede tener como máximo ${n} caracteres.`;
    case 'min': return `${mayuscula(c)} no puede ser menor que ${n}.`;
    case 'max': return `${mayuscula(c)} no puede ser mayor que ${n}.`;
    case 'isEnum':
    case 'isIn': return `${mayuscula(c)} no es una opción válida.`;
    case 'isArray': return `${mayuscula(c)} debe ser una lista.`;
    case 'arrayMinSize': return `${mayuscula(c)} debe tener al menos ${n} elemento(s).`;
    case 'arrayMaxSize': return `${mayuscula(c)} puede tener como máximo ${n} elementos.`;
    case 'isDateString':
    case 'isDate': return `${mayuscula(c)} no es una fecha válida.`;
    case 'matches': return `${mayuscula(c)} no tiene el formato esperado.`;
    default: return `${mayuscula(c)} no es válido.`;
  }
}

/** Aplana los errores (incluidos los de objetos anidados) en mensajes en español. */
export function mensajesEnEspanol(errores: ValidationError[]): string[] {
  const out: string[] = [];
  const recorrer = (e: ValidationError) => {
    for (const [regla, mensaje] of Object.entries(e.constraints ?? {})) {
      out.push(traducirRestriccion(regla, mensaje, e.property) ?? mensaje);
    }
    for (const hijo of e.children ?? []) recorrer(hijo);
  };
  errores.forEach(recorrer);
  return out;
}

/** `exceptionFactory` del ValidationPipe global: misma forma de respuesta, mensajes en español. */
export const fabricaErroresValidacion = (errores: ValidationError[]) =>
  new BadRequestException(mensajesEnEspanol(errores));
