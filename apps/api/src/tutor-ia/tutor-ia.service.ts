import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * ALEX — Tutor IA (Gemini). La GEMINI_API_KEY se lee SOLO aquí (backend),
 * nunca se expone al cliente. ALEX GUÍA, no resuelve: no entrega el código
 * completo de la tarea ni la respuesta literal. Todos los ejemplos en Python.
 */
@Injectable()
export class TutorIaService {
  private readonly logger = new Logger(TutorIaService.name);
  private client: GoogleGenerativeAI | null = null;

  constructor(private readonly config: ConfigService) {}

  private get persona(): string {
    return `Eres ALEX, tutor de programación en Python para estudiantes de primer
semestre de Ingeniería de Sistemas de la UPEA (Bolivia). Responde SIEMPRE en
español, claro, breve y didáctico. NUNCA entregues el código completo de la
tarea ni la respuesta literal: GUÍA con preguntas, conceptos y pistas. Todos los
ejemplos de código deben ser Python 3 válido.`;
  }

  private getModel() {
    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key) throw new HttpException('La IA no está configurada en el servidor', HttpStatus.SERVICE_UNAVAILABLE);
    if (!this.client) this.client = new GoogleGenerativeAI(key);
    const modelo = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
    return this.client.getGenerativeModel({ model: modelo });
  }

  private async generar(systemPrompt: string, mensaje: string): Promise<string> {
    try {
      const model = this.getModel();
      const result = await model.generateContent([{ text: systemPrompt }, { text: mensaje }]);
      return result.response.text().trim();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Gemini: ${msg}`);
      if (msg.includes('429') || msg.toLowerCase().includes('quota'))
        throw new HttpException('Se alcanzó el límite de uso de la IA. Intenta en unos minutos.', HttpStatus.TOO_MANY_REQUESTS);
      throw new HttpException('El servicio de IA no está disponible temporalmente.', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  // ── Asistente conversacional ──
  asistente(pregunta: string, contextoTema?: string) {
    const system = `${this.persona}
${contextoTema ? `El estudiante estudia el tema: "${contextoTema}".` : ''}
Responde su duda en máximo 4-5 frases.`;
    return this.generar(system, pregunta);
  }

  // ── Retroalimentación sobre una respuesta incorrecta ──
  async retroalimentacion(input: { respuestaEstudiante: string; respuestaCorrecta: string; codigo?: string }) {
    const system = `${this.persona}
El estudiante respondió "${input.respuestaEstudiante}" y la correcta es
"${input.respuestaCorrecta}". Explica el error específico en 2-3 frases, en tono
de apoyo, SIN repetir la respuesta correcta literalmente al inicio. Al final, en
una línea aparte, escribe exactamente: AREA_DEBIL: <concepto a reforzar>`;
    const texto = await this.generar(system, input.codigo ? `Código:\n${input.codigo}` : 'Ejercicio de opción múltiple');
    const m = texto.match(/AREA_DEBIL:\s*(.+)\s*$/i);
    return {
      explicacion: texto.replace(/AREA_DEBIL:.*$/i, '').trim(),
      area_debil: m?.[1]?.trim() ?? 'concepto general',
    };
  }

  // ── Pistas escalonadas (1-3) ──
  pista(input: { nivelPista: 1 | 2 | 3; enunciado?: string; codigo?: string }) {
    const instr = {
      1: 'Da una pista GENERAL sobre el concepto, sin mencionar el resultado.',
      2: 'Da una pista sobre DÓNDE suele estar el error.',
      3: 'Da una pista de casi-solución paso a paso, SIN escribir la respuesta literal.',
    }[input.nivelPista];
    const system = `${this.persona}
Vas a dar una pista de nivel ${input.nivelPista} de 3. ${instr} Máximo 3 frases.`;
    const msg = [input.enunciado ? `Enunciado: ${input.enunciado}` : '', input.codigo ? `Código:\n${input.codigo}` : '']
      .filter(Boolean).join('\n');
    return this.generar(system, msg);
  }

  // ── Asistencia contextual sobre el código del estudiante (Zona de Práctica) ──
  asistirCodigo(input: { codigo: string; enunciado?: string; pregunta?: string }) {
    const system = `${this.persona}
Estás revisando el CÓDIGO ACTUAL del estudiante en la zona de práctica. Detecta
errores, responde su pregunta sobre SU propio código y orienta el siguiente paso.
NO escribas la solución completa ni el código final corregido: explica el qué y
el porqué para que él lo escriba. Si hay un error, señala la línea/idea, no lo
reescribas entero. Máximo 5 frases.`;
    const msg = [
      input.enunciado ? `Reto: ${input.enunciado}` : '',
      `Código actual del estudiante:\n\`\`\`python\n${input.codigo}\n\`\`\``,
      input.pregunta ? `Pregunta del estudiante: ${input.pregunta}` : 'El estudiante pide orientación.',
    ].filter(Boolean).join('\n\n');
    return this.generar(system, msg);
  }
}
