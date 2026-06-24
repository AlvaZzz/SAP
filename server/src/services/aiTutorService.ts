import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import { queryOne, query } from '../config/db';
import { getConfig } from './configService';

/**
 * ALEX — Tutor IA de PREXI.
 *
 * La GEMINI_API_KEY se lee SOLO aquí (servidor). El frontend nunca la ve:
 * solo invoca /api/ai/* y este servicio habla con Gemini en su nombre.
 */

let genAI: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI {
  if (!env.geminiApiKey) {
    throw new Error('GEMINI_API_KEY no está configurada en el servidor');
  }
  if (!genAI) genAI = new GoogleGenerativeAI(env.geminiApiKey);
  return genAI;
}

/** Identidad y reglas comunes a todas las respuestas de ALEX. */
const PERSONA_BASE = `Eres ALEX, tutor de programación para estudiantes de primer
semestre de la carrera de Ingeniería de Sistemas de la UPEA (Bolivia).
Responde SIEMPRE en español, de forma clara, breve y didáctica.
NO des el código completo de tareas ni la respuesta literal del ejercicio.
Cuando muestres lógica, usa pseudocódigo en español con la forma
Algoritmo / Definir / Si-Sino / Para / Mientras / Fin.
Usa un tono cercano y de apoyo, sin sermonear.`;

/** Llamada interna a Gemini. Devuelve el texto plano de la respuesta. */
async function pedirAyudaIA(systemPrompt: string, mensajeUsuario: string): Promise<string> {
  const cfg = await getConfig();
  const model = getClient().getGenerativeModel({ model: cfg.modelo_ia || env.geminiModel });

  try {
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: mensajeUsuario },
    ]);
    return result.response.text().trim();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ia] Error al llamar a Gemini:', message);

    // Error 429 — cuota excedida (free tier o rate limit de Google)
    if (message.includes('429') || message.toLowerCase().includes('quota')) {
      const { HttpError } = await import('../utils/httpError');
      throw new HttpError(
        429,
        'Se alcanzó el límite de uso de la IA de Google. Intenta de nuevo en unos minutos o contacta al administrador.',
      );
    }

    // Error 403 / 401 — API key inválida o sin permisos
    if (message.includes('403') || message.includes('401') || message.toLowerCase().includes('api key')) {
      const { HttpError } = await import('../utils/httpError');
      throw new HttpError(
        503,
        'La clave de la IA no es válida o no tiene permisos. Contacta al administrador.',
      );
    }

    // Cualquier otro error de Gemini
    const { HttpError } = await import('../utils/httpError');
    throw new HttpError(
      503,
      'El servicio de IA no está disponible temporalmente. Intenta de nuevo más tarde.',
    );
  }
}

/**
 * Generación genérica de texto con Gemini, reutilizable por otros servicios
 * (p. ej. el diagnóstico inicial). Mantiene el manejo de errores 429/503.
 */
export async function generarTexto(systemPrompt: string, mensaje: string): Promise<string> {
  return pedirAyudaIA(systemPrompt, mensaje);
}

// ── Caché simple en BD (para preguntas frecuentes) ──────────
function hashClave(...partes: string[]): string {
  return crypto.createHash('sha256').update(partes.join('')).digest('hex');
}

async function desdeCache(clave: string): Promise<string | null> {
  const row = await queryOne<{ respuesta: string }>(
    `SELECT respuesta FROM ia_cache WHERE clave = $1`,
    [clave],
  );
  return row?.respuesta ?? null;
}

async function guardarCache(clave: string, respuesta: string): Promise<void> {
  await query(
    `INSERT INTO ia_cache (clave, respuesta) VALUES ($1, $2)
     ON CONFLICT (clave) DO UPDATE SET respuesta = EXCLUDED.respuesta, creado_en = now()`,
    [clave, respuesta],
  );
}

// ════════════════════════════════════════════════════════════
//  1) Asistente conversacional
// ════════════════════════════════════════════════════════════
export async function asistente(pregunta: string, contextoTema?: string): Promise<string> {
  const system = `${PERSONA_BASE}
${contextoTema ? `El estudiante está estudiando el tema: "${contextoTema}".` : ''}
Responde su duda en máximo 4-5 frases.`;

  // Cachea preguntas frecuentes (misma pregunta + tema).
  const clave = hashClave('asistente', contextoTema ?? '', pregunta.toLowerCase().trim());
  const cacheado = await desdeCache(clave);
  if (cacheado) return cacheado;

  const respuesta = await pedirAyudaIA(system, pregunta);
  await guardarCache(clave, respuesta);
  return respuesta;
}

// ════════════════════════════════════════════════════════════
//  2) Retroalimentación sobre una respuesta incorrecta
// ════════════════════════════════════════════════════════════
export interface RetroInput {
  ejercicioId: number;
  respuestaEstudiante: string;
  respuestaCorrecta: string;
  codigoPseudocodigo?: string;
}

export interface RetroOutput {
  explicacion: string;
  area_debil: string;
}

export async function retroalimentacion(input: RetroInput): Promise<RetroOutput> {
  const system = `${PERSONA_BASE}
El estudiante respondió "${input.respuestaEstudiante}" y la respuesta correcta es
"${input.respuestaCorrecta}". Explica el error específico en 2-3 frases, en tono de
apoyo, SIN sermonear y SIN repetir la respuesta correcta literalmente al inicio.
Al final, en una línea aparte, escribe exactamente:
AREA_DEBIL: <concepto puntual a reforzar en pocas palabras>`;

  const mensaje = input.codigoPseudocodigo
    ? `Pseudocódigo del ejercicio:\n${input.codigoPseudocodigo}`
    : `Ejercicio #${input.ejercicioId}`;

  const texto = await pedirAyudaIA(system, mensaje);

  // Extrae el marcador AREA_DEBIL del final.
  const match = texto.match(/AREA_DEBIL:\s*(.+)\s*$/i);
  const areaDebil = match?.[1]?.trim() ?? 'concepto general del ejercicio';
  const explicacion = texto.replace(/AREA_DEBIL:.*$/i, '').trim();

  return { explicacion, area_debil: areaDebil };
}

// ════════════════════════════════════════════════════════════
//  3) Pistas escalonadas (nivel 1, 2, 3)
// ════════════════════════════════════════════════════════════
const INSTRUCCION_PISTA: Record<1 | 2 | 3, string> = {
  1: 'Da una pista GENERAL sobre el concepto involucrado, sin mencionar el resultado.',
  2: 'Da una pista sobre DÓNDE suele estar el error en este tipo de problema.',
  3: 'Da una pista de casi-solución que guíe paso a paso, pero SIN escribir la respuesta literal.',
};

export interface PistaInput {
  ejercicioId: number;
  intentosFallidos: number;
  nivelPista: 1 | 2 | 3;
  enunciado?: string;
  pseudocodigo?: string;
}

export async function pista(input: PistaInput): Promise<string> {
  const system = `${PERSONA_BASE}
Vas a dar una pista de nivel ${input.nivelPista} de 3.
${INSTRUCCION_PISTA[input.nivelPista]}
El estudiante lleva ${input.intentosFallidos} intento(s) fallido(s).
Máximo 3 frases. Nunca escribas la respuesta final literal.`;

  const mensaje = [
    input.enunciado ? `Enunciado: ${input.enunciado}` : `Ejercicio #${input.ejercicioId}`,
    input.pseudocodigo ? `Pseudocódigo:\n${input.pseudocodigo}` : '',
  ].filter(Boolean).join('\n');

  return pedirAyudaIA(system, mensaje);
}
