import { Injectable, HttpException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TipoEjercicio } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  PERSONA, MAX_INPUT, sanitizar, tonoPorNivel, bloqueMaterial, bloquePerfil, bloqueMemoria,
} from './prompts';
import { construirPerfil, recuperarMemoria } from './perfil-estudiante';
import { recuperarFragmentos } from './rag';

/** Una pregunta PROPUESTA por ALVARO desde un PDF (siempre borrador, nunca se publica sola). */
export interface PreguntaPropuesta {
  categoria: string;
  enunciado: string;
  codigoPython: string | null;
  opciones: { id: string; texto: string }[];
  respuestaCorrecta: string;
  explicacionIa: string;
}

/**
 * ALVARO — Tutor IA (Gemini). La GEMINI_API_KEY se lee SOLO aquí (backend),
 * nunca se expone al cliente. ALVARO GUÍA, no resuelve: no entrega el código
 * completo de la tarea ni la respuesta literal. Todos los ejemplos en Python.
 *
 * Cada consulta se enriquece con el PERFIL REAL del estudiante (nivel del
 * pretest, desempeño reciente, patrones de error, pistas usadas), la MEMORIA de
 * la sesión y el MATERIAL DEL DOCENTE (RAG). La entrada del estudiante se sanea
 * y se limita. Cada consulta se registra en consultas_ia (auditoría + tesis).
 */
@Injectable()
export class TutorIaService {
  private readonly logger = new Logger(TutorIaService.name);
  private client: GoogleGenerativeAI | null = null;
  static readonly MAX_INPUT = MAX_INPUT;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Tope de tokens de SALIDA por tipo de llamada. Acota el costo y la latencia y
   * REFUERZA la brevedad que pide el prompt (ver ESTILO_RESPUESTA: 3-4 frases).
   * Se dejan con algo de holgura sobre esas 3-4 frases (~120-180 tokens) para no
   * truncar a media frase. La generación de preguntas (JSON) y el borrador de
   * feedback del docente NO son respuestas al estudiante y conservan su margen.
   */
  private static readonly MAX_OUTPUT: Record<string, number> = {
    asistente: 300,
    retroalimentacion: 260, // incluye la línea final AREA_DEBIL
    pista: 200,
    practica: 320, // puede incluir un fragmento mínimo de código
    feedback_docente: 450,
    preguntas: 2048,
  };

  private async getModel(maxOutputTokens?: number) {
    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key) throw new HttpException('La IA no está configurada en el servidor', HttpStatus.SERVICE_UNAVAILABLE);
    // El modelo y el interruptor global se centralizan en ConfiguracionSistema.
    const cfg = await this.prisma.configuracionSistema.findUnique({ where: { id: 1 } }).catch(() => null);
    if (cfg && cfg.iaActiva === false)
      throw new HttpException('ALVARO está desactivado por el administrador.', HttpStatus.SERVICE_UNAVAILABLE);
    if (!this.client) this.client = new GoogleGenerativeAI(key);
    // Variante FLASH (rápida y económica) por defecto; el admin puede cambiarla.
    const modelo = cfg?.modeloIa ?? this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash-lite';
    return this.client.getGenerativeModel({
      model: modelo,
      // Limitar la longitud de salida reduce tokens facturados y acelera la respuesta.
      generationConfig: maxOutputTokens ? { maxOutputTokens } : undefined,
    });
  }

  private async generar(systemPrompt: string, mensaje: string, maxOutputTokens?: number): Promise<string> {
    return this.conReintento(async () => {
      const model = await this.getModel(maxOutputTokens);
      const result = await model.generateContent([{ text: systemPrompt }, { text: mensaje }]);
      return result.response.text().trim();
    });
  }

  /**
   * Caché ligera de preguntas frecuentes del asistente: si ESTE estudiante ya
   * hizo una consulta idéntica en las últimas 24 h y ALVARO la respondió,
   * reutilizamos esa respuesta en vez de volver a llamar a Gemini. La respuesta
   * es personalizada por perfil, por eso la caché es por-usuario (no global).
   */
  private async respuestaCacheada(usuarioId: number, tipo: string, pregunta: string): Promise<string | null> {
    if (!usuarioId || !pregunta) return null;
    try {
      const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const prev = await this.prisma.consultaIa.findFirst({
        where: { usuarioId, tipo, pregunta, respuesta: { not: null }, fecha: { gt: desde } },
        orderBy: { fecha: 'desc' },
        select: { respuesta: true },
      });
      const r = prev?.respuesta?.trim();
      return r && r.length > 0 ? r : null;
    } catch {
      return null; // la caché nunca debe romper la respuesta
    }
  }

  /**
   * Ejecuta una llamada a Gemini. Si falla por CUOTA (429) y el propio Gemini
   * sugiere una espera CORTA (≤8s, típico del límite por minuto del free tier),
   * reintenta UNA vez tras esa espera. Así se absorben los picos transitorios de
   * cuota sin mostrarle un error al estudiante. Otros errores se traducen a un
   * mensaje amable. Las HttpException (IA desactivada/no configurada) no se
   * reintentan: se propagan tal cual.
   */
  private async conReintento<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      const espera = this.esperaSugerida(msg);
      const esCuota = msg.includes('429') || /quota|resource_exhausted/i.test(msg);
      if (esCuota && espera > 0 && espera <= 8000) {
        this.logger.warn(`Gemini 429: reintentando en ${espera + 300}ms`);
        await new Promise((r) => setTimeout(r, espera + 300));
        try { return await fn(); } catch (err2) { throw this.traducirError(err2); }
      }
      throw this.traducirError(err);
    }
  }

  /** Milisegundos de espera que Gemini sugiere en un 429 ("retry in 2.0s" / retryDelay:"2s"). 0 si no hay. */
  private esperaSugerida(msg: string): number {
    const m = msg.match(/retry in ([\d.]+)s/i) ?? msg.match(/retryDelay"?:\s*"?(\d+(?:\.\d+)?)s/i);
    return m ? Math.ceil(parseFloat(m[1]) * 1000) : 0;
  }

  /** Traduce un error de Gemini a una HttpException amable (nunca rompe la vista). */
  private traducirError(err: unknown): HttpException {
    if (err instanceof HttpException) return err;
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.error(`Gemini: ${msg}`);
    if (msg.includes('429') || msg.toLowerCase().includes('quota'))
      return new HttpException('Se alcanzó el límite de uso de ALVARO. Intenta en unos minutos.', HttpStatus.TOO_MANY_REQUESTS);
    return new HttpException('ALVARO no está disponible ahora, intenta de nuevo.', HttpStatus.SERVICE_UNAVAILABLE);
  }

  /**
   * Material del docente para el tema (RAG): recupera los fragmentos más
   * relevantes para `consulta` del PDF asociado, ya extraído a texto. ALVARO
   * responde con el MISMO estilo y sintaxis que enseñó el docente.
   */
  private async materialDocente(temaId: number | null | undefined, consulta: string): Promise<string> {
    if (!temaId) return '';
    const doc = await this.prisma.documento.findFirst({
      where: { temaId, textoExtraido: { not: null } },
      orderBy: { creadoEn: 'desc' },
      select: { textoExtraido: true },
    }).catch(() => null);
    return recuperarFragmentos(doc?.textoExtraido, consulta, { maxChars: 1600, maxFragmentos: 3 });
  }

  /** Registro en consultas_ia (mejor esfuerzo: nunca rompe la respuesta). */
  private async registrar(data: {
    usuarioId: number; tipo: string; pregunta?: string; respuesta?: string; ejercicioId?: number; nivelPista?: number;
  }) {
    if (!data.usuarioId) return;
    try {
      await this.prisma.consultaIa.create({
        data: {
          usuarioId: data.usuarioId,
          tipo: data.tipo,
          endpoint: `/tutor-ia/${data.tipo}`,
          pregunta: data.pregunta?.slice(0, 2000) ?? null,
          respuesta: data.respuesta?.slice(0, 4000) ?? null,
          ejercicioId: data.ejercicioId ?? null,
          nivelPista: data.nivelPista ?? null,
        },
      });
    } catch (e) {
      this.logger.warn(`No se pudo registrar la consulta IA: ${e instanceof Error ? e.message : e}`);
    }
  }

  // ── 1) Asistente conversacional ──
  //  Prepara el prompt enriquecido (perfil + memoria + RAG) UNA sola vez; lo
  //  reusan la variante normal y la de streaming.
  private async prepararAsistente(usuarioId: number, preguntaRaw: string, contextoTema?: string, ejercicioId?: number) {
    const pregunta = sanitizar(preguntaRaw);
    const ej = ejercicioId
      ? await this.prisma.ejercicio.findUnique({ where: { id: ejercicioId }, select: { temaId: true, categoria: true } }).catch(() => null)
      : null;
    const [material, perfil, memoria] = await Promise.all([
      this.materialDocente(ej?.temaId, pregunta),
      construirPerfil(this.prisma, usuarioId, { temaId: ej?.temaId, categoria: ej?.categoria ?? contextoTema, ejercicioId }),
      recuperarMemoria(this.prisma, usuarioId, ['asistente'], 4),
    ]);

    const system = `${PERSONA}
${tonoPorNivel(perfil.nivel)}
${contextoTema ? `El estudiante estudia el tema: "${sanitizar(contextoTema, 80)}".` : ''}
Responde su duda respetando el estilo (3-4 frases), aprovechando su perfil para personalizar${perfil.nombre ? ` (puedes llamarlo ${perfil.nombre}, sin saludos largos)` : ''}.${bloquePerfil(perfil.resumen)}${bloqueMemoria(memoria)}${bloqueMaterial(material)}`;

    return { system, pregunta, ejercicioId };
  }

  async asistente(usuarioId: number, preguntaRaw: string, contextoTema?: string, ejercicioId?: number) {
    const pregunta = sanitizar(preguntaRaw);
    // Caché de preguntas repetidas: evita una llamada a Gemini si ya se respondió.
    const cacheada = await this.respuestaCacheada(usuarioId, 'asistente', pregunta);
    if (cacheada) return { respuesta: cacheada };

    const { system } = await this.prepararAsistente(usuarioId, preguntaRaw, contextoTema, ejercicioId);
    const respuesta = await this.generar(system, pregunta, TutorIaService.MAX_OUTPUT.asistente);
    await this.registrar({ usuarioId, tipo: 'asistente', pregunta, respuesta, ejercicioId });
    return { respuesta };
  }

  /**
   * Variante en STREAMING del asistente: va emitiendo el texto conforme Gemini
   * lo genera (mejor experiencia: el estudiante ve a ALVARO "escribiendo").
   * getModel se llama fuera del try → si la IA está apagada/no configurada, la
   * HttpException se propaga ANTES de emitir nada (el cliente cae al no-stream).
   * Los fallos de red durante el stream emiten un mensaje amable y no rompen.
   */
  async *asistenteStream(usuarioId: number, preguntaRaw: string, contextoTema?: string, ejercicioId?: number): AsyncGenerator<string> {
    // Caché: si ya respondimos esta misma duda, la emitimos sin llamar a Gemini.
    const cacheada = await this.respuestaCacheada(usuarioId, 'asistente', sanitizar(preguntaRaw));
    if (cacheada) { yield cacheada; return; }

    const { system, pregunta } = await this.prepararAsistente(usuarioId, preguntaRaw, contextoTema, ejercicioId);
    const model = await this.getModel(TutorIaService.MAX_OUTPUT.asistente);
    let completo = '';
    try {
      // La creación del stream se reintenta ante un 429 transitorio (espera corta).
      const result = await this.conReintento(() => model.generateContentStream([{ text: system }, { text: pregunta }]));
      // `result.response` es una promesa aparte que se rechaza si el stream se
      // rompe (p. ej. el cliente cierra la pestaña a mitad). Si nadie la maneja,
      // Node la trata como unhandledRejection y TUMBA el proceso. La absorbemos.
      // Optional chaining: en tests el mock no trae response; en el SDK real sí.
      void result.response?.catch(() => undefined);
      for await (const chunk of result.stream) {
        const t = chunk.text();
        if (t) { completo += t; yield t; }
      }
    } catch (err) {
      // Log del error EXACTO de Gemini (status + mensaje) para depurar.
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Gemini stream: ${msg}`);
      if (!completo) {
        // Mensaje amable y específico: HttpException (ya traducida) trae su mensaje;
        // si es un 429 crudo (fallo a mitad del stream), avisamos del límite.
        completo = err instanceof HttpException ? err.message
          : (msg.includes('429') || /quota/i.test(msg))
            ? 'Se alcanzó el límite de uso de ALVARO. Intenta en unos minutos.'
            : 'ALVARO no está disponible ahora, intenta de nuevo.';
        yield completo;
      }
    }
    await this.registrar({ usuarioId, tipo: 'asistente', pregunta, respuesta: completo.trim(), ejercicioId });
  }

  // ── 2) Retroalimentación sobre una respuesta incorrecta (por ejercicio_id) ──
  async retroalimentacion(usuarioId: number, ejercicioId: number, respuestaEstudianteRaw: string) {
    const ej = await this.prisma.ejercicio.findUnique({
      where: { id: ejercicioId },
      select: { enunciado: true, categoria: true, respuestaCorrecta: true, explicacionIa: true, codigoPython: true, temaId: true },
    });
    if (!ej) throw new NotFoundException('Ejercicio no encontrado');
    const respuestaEstudiante = sanitizar(respuestaEstudianteRaw, 120);
    const [material, perfil] = await Promise.all([
      this.materialDocente(ej.temaId, `${ej.categoria} ${ej.enunciado}`),
      construirPerfil(this.prisma, usuarioId, { temaId: ej.temaId, categoria: ej.categoria, ejercicioId }),
    ]);

    const system = `${PERSONA}
${tonoPorNivel(perfil.nivel)}
El estudiante respondió "${respuestaEstudiante}" y NO es correcta. Usa como base
esta explicación del ejercicio: "${ej.explicacionIa ?? 'Analiza paso a paso la ejecución.'}".
Explica en 2-3 frases por qué su respuesta es incorrecta y guía hacia la correcta
SIN darla directamente al inicio. Tono de apoyo. Si sus patrones de error revelan
una confusión recurrente, menciónala con tacto. Al final, en una línea aparte,
escribe exactamente: AREA_DEBIL: <concepto a reforzar>${bloquePerfil(perfil.resumen)}${bloqueMaterial(material)}`;
    const msg = [
      `Enunciado: ${ej.enunciado}`,
      ej.codigoPython ? `Código:\n${ej.codigoPython}` : '',
    ].filter(Boolean).join('\n');

    const texto = await this.generar(system, msg, TutorIaService.MAX_OUTPUT.retroalimentacion);
    const m = texto.match(/AREA_DEBIL:\s*(.+)\s*$/i);
    const explicacion = texto.replace(/AREA_DEBIL:.*$/i, '').trim();
    // El área débil se prioriza desde los patrones detectados; si no hay, la IA o la categoría.
    const area_debil = perfil.patrones[0]?.descripcion ?? m?.[1]?.trim() ?? ej.categoria;
    await this.registrar({ usuarioId, tipo: 'retroalimentacion', pregunta: respuestaEstudiante, respuesta: explicacion, ejercicioId });
    return { explicacion, area_debil };
  }

  // ── 3) Pistas escalonadas (por ejercicio_id) — se registran para penalizar XP ──
  async pista(usuarioId: number, ejercicioId: number, nivelPista: 1 | 2 | 3) {
    const ej = await this.prisma.ejercicio.findUnique({
      where: { id: ejercicioId },
      select: { enunciado: true, codigoPython: true, categoria: true, maxPistas: true, temaId: true },
    });
    if (!ej) throw new NotFoundException('Ejercicio no encontrado');

    const cfg = await this.prisma.configuracionSistema.findUnique({ where: { id: 1 } }).catch(() => null);
    const maxPermitido = Math.min(ej.maxPistas ?? 3, cfg?.maxPistasIa ?? 3);
    if (nivelPista > maxPermitido)
      throw new HttpException(`Solo hay ${maxPermitido} pistas disponibles para este ejercicio.`, HttpStatus.FORBIDDEN);

    const [material, perfil] = await Promise.all([
      this.materialDocente(ej.temaId, `${ej.categoria} ${ej.enunciado}`),
      construirPerfil(this.prisma, usuarioId, { temaId: ej.temaId, categoria: ej.categoria, ejercicioId }),
    ]);

    const instr = {
      1: 'Da una pista GENERAL sobre el concepto, sin mencionar el resultado.',
      2: 'Da una pista sobre DÓNDE suele estar el error.',
      3: 'Da una pista de casi-solución paso a paso, SIN escribir la respuesta literal.',
    }[nivelPista];
    const system = `${PERSONA}
${tonoPorNivel(perfil.nivel)}
Vas a dar una pista de nivel ${nivelPista} de 3, que ESCALA sobre las anteriores.
${instr} No repitas pistas ya dadas. Máximo 3 frases.${bloquePerfil(perfil.resumen)}${bloqueMaterial(material)}`;
    const msg = [`Enunciado: ${ej.enunciado}`, ej.codigoPython ? `Código:\n${ej.codigoPython}` : '']
      .filter(Boolean).join('\n');

    const pista = await this.generar(system, msg, TutorIaService.MAX_OUTPUT.pista);
    await this.registrar({ usuarioId, tipo: 'pista', respuesta: pista, ejercicioId, nivelPista });
    return { pista };
  }

  // ── 4) Asistencia contextual sobre el código (Zona de Práctica / retos) ──
  /** Arma el prompt de práctica (compartido por la versión normal y la de streaming). */
  private async prepararPractica(usuarioId: number, codigoRaw: string, enunciadoReto?: string, preguntaRaw?: string) {
    const codigo = sanitizar(codigoRaw, 4000);
    const enunciado = sanitizar(enunciadoReto, 400);
    const pregunta = sanitizar(preguntaRaw);
    const [perfil, memoria] = await Promise.all([
      construirPerfil(this.prisma, usuarioId, {}),
      recuperarMemoria(this.prisma, usuarioId, ['practica'], 4),
    ]);
    const system = `${PERSONA}
${tonoPorNivel(perfil.nivel)}
Estás revisando el CÓDIGO ACTUAL del estudiante en la zona de práctica${enunciado ? ` para este reto: "${enunciado}"` : ''}.
Detecta errores, responde su pregunta sobre SU propio código y orienta el siguiente
paso mediante preguntas y pistas. NUNCA escribas la solución completa ni el código
final corregido: explica el qué y el porqué para que él lo escriba.${bloquePerfil(perfil.resumen)}${bloqueMemoria(memoria)}`;
    const msg = [
      `Código actual del estudiante:\n\`\`\`python\n${codigo}\n\`\`\``,
      pregunta ? `Pregunta del estudiante: ${pregunta}` : 'El estudiante pide orientación.',
    ].join('\n\n');
    return { system, msg, pregunta };
  }

  async practica(usuarioId: number, codigoRaw: string, enunciadoReto?: string, preguntaRaw?: string) {
    const { system, msg, pregunta } = await this.prepararPractica(usuarioId, codigoRaw, enunciadoReto, preguntaRaw);
    const respuesta = await this.generar(system, msg, TutorIaService.MAX_OUTPUT.practica);
    await this.registrar({ usuarioId, tipo: 'practica', pregunta: pregunta || '(orientación)', respuesta });
    return { respuesta };
  }

  /** Igual que practica pero en STREAMING (ALVARO "escribiendo" en el editor de retos). */
  async *practicaStream(usuarioId: number, codigoRaw: string, enunciadoReto?: string, preguntaRaw?: string): AsyncGenerator<string> {
    const { system, msg, pregunta } = await this.prepararPractica(usuarioId, codigoRaw, enunciadoReto, preguntaRaw);
    const model = await this.getModel(TutorIaService.MAX_OUTPUT.practica);
    let completo = '';
    try {
      const result = await this.conReintento(() => model.generateContentStream([{ text: system }, { text: msg }]));
      // Ver nota en asistenteStream: absorbe el rechazo tardío de result.response
      // para que un cliente que se desconecta a mitad no tumbe el proceso.
      // Optional chaining: en tests el mock no trae response; en el SDK real sí.
      void result.response?.catch(() => undefined);
      for await (const chunk of result.stream) {
        const t = chunk.text();
        if (t) { completo += t; yield t; }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Gemini stream (practica): ${errMsg}`);
      if (!completo) {
        completo = err instanceof HttpException ? err.message
          : (errMsg.includes('429') || /quota/i.test(errMsg))
            ? 'Se alcanzó el límite de uso de ALVARO. Intenta en unos minutos.'
            : 'ALVARO no está disponible ahora, intenta de nuevo.';
        yield completo;
      }
    }
    await this.registrar({ usuarioId, tipo: 'practica', pregunta: pregunta || '(orientación)', respuesta: completo.trim() });
  }

  /**
   * Pistas escalonadas para un RETO (misión/editor). A diferencia de las pistas
   * de ejercicio (que penalizan el XP del ejercicio), las de reto se REGISTRAN
   * como consulta a ALVARO —cuentan para el indicador de Autonomía— pero el XP
   * del reto lo decide el docente (o la auto‑validación del bug‑hunt). Son
   * CONTEXTUALES al código que el estudiante lleva escrito.
   */
  async pistaReto(usuarioId: number, retoId: number, nivelPista: 1 | 2 | 3, codigoRaw: string) {
    const reto = await this.prisma.reto.findFirst({
      where: { id: retoId, activo: true },
      select: {
        enunciado: true, categoria: true, ejemploSalida: true, esBugHunt: true,
        pistas: true, tipoBug: true,
        // ANCLAJE AL MATERIAL: el reto derivado nace de un ejercicio del banco.
        // ALVARO se apoya en ESA explicación y en el repaso del tema, en vez de
        // razonar desde su conocimiento general de Python.
        origenEjercicio: { select: { enunciado: true, explicacionIa: true } },
        tema: { select: { numero: true, titulo: true, repaso: true, unidad: { select: { numero: true, titulo: true } } } },
      },
    });
    if (!reto) throw new NotFoundException('Reto no encontrado');
    const codigo = sanitizar(codigoRaw, 4000);
    const perfil = await construirPerfil(this.prisma, usuarioId, { categoria: reto.categoria });

    // Las pistas redactadas del reto son el PLAN DE ESCALAMIENTO: la de este nivel
    // es la que ALVARO debe transmitir (reformulada), sin adelantar las siguientes.
    const pistasReto = Array.isArray(reto.pistas) ? (reto.pistas as unknown[]).map(String) : [];
    const pistaGuion = pistasReto[nivelPista - 1];

    const instr = {
      1: 'Da una pista GENERAL sobre el enfoque o el concepto, sin señalar la línea exacta.',
      2: `Da una pista sobre DÓNDE está el problema en SU código${reto.esBugHunt ? ' (recuerda: hay un bug plantado)' : ''}, sin corregirlo por él.`,
      3: 'Da una pista de casi-solución, paso a paso, SIN escribir el código corregido literal.',
    }[nivelPista];

    const alcance = reto.tema
      ? `Este reto pertenece a la Unidad ${reto.tema.unidad.numero} (${reto.tema.unidad.titulo}), tema ${reto.tema.numero} ${reto.tema.titulo}.`
      : '';

    const system = `${PERSONA}
${tonoPorNivel(perfil.nivel)}
Vas a dar una pista de nivel ${nivelPista} de 3 sobre el CÓDIGO del estudiante en un reto, que ESCALA sobre las anteriores.
${instr} No repitas pistas ya dadas. NUNCA escribas la solución completa. Máximo 3 frases.
${alcance}
CÍÑETE AL MATERIAL DEL MÓDULO que se te entrega abajo: no introduzcas funciones, librerías ni "buenas prácticas" que no se hayan visto en este tema. Si el estudiante pregunta algo fuera del alcance del tema, recondúcelo al concepto del módulo en vez de dar una respuesta general de programación.${bloquePerfil(perfil.resumen)}`;

    const msg = [
      `Reto: ${reto.enunciado}`,
      reto.ejemploSalida ? `Salida esperada: ${reto.ejemploSalida}` : '',
      // Material de origen: es lo que el estudiante ya estudió para este tema.
      reto.origenEjercicio ? `Ejercicio del módulo del que sale este reto: ${reto.origenEjercicio.enunciado}` : '',
      reto.origenEjercicio?.explicacionIa ? `Explicación del módulo: ${reto.origenEjercicio.explicacionIa}` : '',
      reto.tema?.repaso ? `Resumen del tema:\n${reto.tema.repaso.slice(0, 1200)}` : '',
      pistaGuion ? `Guion de la pista ${nivelPista} (reformúlala con tus palabras, NO la copies literal): ${pistaGuion}` : '',
      `Código actual del estudiante:\n\`\`\`python\n${codigo}\n\`\`\``,
    ].filter(Boolean).join('\n');

    const pista = await this.generar(system, msg, TutorIaService.MAX_OUTPUT.pista);
    await this.registrar({ usuarioId, tipo: 'pista', respuesta: pista, nivelPista });
    return { pista };
  }

  // Compat: la Zona de Práctica antigua (/practica/asistir) sigue funcionando.
  async asistirCodigo(input: { codigo: string; enunciado?: string; pregunta?: string }, usuarioId = 0) {
    return this.practica(usuarioId, input.codigo, input.enunciado, input.pregunta);
  }

  /**
   * Patrones de error recurrentes de un estudiante (para el seguimiento del
   * docente). Reusa el mismo detector que alimenta a ALVARO.
   */
  async patronesDeError(usuarioId: number, temaId?: number) {
    const perfil = await construirPerfil(this.prisma, usuarioId, temaId ? { temaId } : {});
    return { patrones: perfil.patrones, desempeno: perfil.desempenoTema };
  }

  // ── 6) Generación asistida de preguntas desde un PDF (SIEMPRE borrador) ──
  //  El docente pide N preguntas de un tipo a partir del texto extraído del
  //  PDF. ALVARO propone; NUNCA se publican solas (ver DocentePreguntasIaService).
  async generarPreguntas(texto: string, cantidad: number, tipo: TipoEjercicio): Promise<PreguntaPropuesta[]> {
    const material = texto.slice(0, 12_000);
    const formato = {
      opcion_multiple: `"opciones": [{"id":"A","texto":"..."}, {"id":"B","texto":"..."}, {"id":"C","texto":"..."}, {"id":"D","texto":"..."}], "respuestaCorrecta": "A"`,
      predecir_salida: `"opciones": [{"id":"A","texto":"..."}, {"id":"B","texto":"..."}, {"id":"C","texto":"..."}, {"id":"D","texto":"..."}], "respuestaCorrecta": "A" (una opción es la salida real del código en "codigoPython")`,
      completar_codigo: `"opciones": [], "respuestaCorrecta": "<valor exacto que falta, sin comillas de más>"`,
      ordenar_lineas: `"opciones": [{"id":"A","texto":"línea de código 1"}, {"id":"B","texto":"línea de código 2"}, ...] EN ORDEN ALEATORIO, "respuestaCorrecta": "<ids en el orden CORRECTO separados por coma, ej. C,A,D,B>"`,
    }[tipo];

    const system = `Eres ALVARO, asistente del DOCENTE. A partir del material de clase (Python,
primer semestre, UPEA) que se te entrega, propone ${cantidad} preguntas de tipo
"${tipo}" en español, fieles al contenido y a la sintaxis del material (no
inventes temas que no aparezcan). Nivel principiante.
Formato EXACTO por cada pregunta: ${formato}
Responde SOLO un JSON array (sin markdown, sin texto extra) con esta forma exacta:
[{"categoria":"...", "enunciado":"...", "codigoPython": "..." o null, ${formato}, "explicacionIa":"..."}]`;

    const texto_respuesta = await this.generar(system, `MATERIAL:\n"""\n${material}\n"""`, TutorIaService.MAX_OUTPUT.preguntas);
    return this.parsearPreguntas(texto_respuesta, tipo);
  }

  /** Parseo defensivo del JSON de Gemini: descarta preguntas mal formadas en vez de fallar todo. */
  private parsearPreguntas(texto: string, tipo: TipoEjercicio): PreguntaPropuesta[] {
    const limpio = texto.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    let data: unknown;
    try {
      data = JSON.parse(limpio);
    } catch {
      throw new HttpException('ALVARO no pudo generar preguntas válidas desde este material. Intenta de nuevo.', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    if (!Array.isArray(data)) throw new HttpException('Respuesta de ALVARO con formato inesperado.', HttpStatus.UNPROCESSABLE_ENTITY);

    const validas: PreguntaPropuesta[] = [];
    for (const item of data) {
      if (!item || typeof item !== 'object') continue;
      const p = item as Record<string, unknown>;
      const enunciado = typeof p.enunciado === 'string' ? p.enunciado.trim() : '';
      const respuestaCorrecta = typeof p.respuestaCorrecta === 'string' ? p.respuestaCorrecta.trim() : '';
      if (!enunciado || !respuestaCorrecta) continue;
      const opcionesRaw = Array.isArray(p.opciones) ? p.opciones : [];
      const opciones = opcionesRaw
        .filter((o): o is { id: unknown; texto: unknown } => !!o && typeof o === 'object')
        .map((o) => ({ id: String((o as { id: unknown }).id ?? '').trim(), texto: String((o as { texto: unknown }).texto ?? '').trim() }))
        .filter((o) => o.id && o.texto);
      if ((tipo === 'opcion_multiple' || tipo === 'predecir_salida' || tipo === 'ordenar_lineas') && opciones.length < 2) continue;

      validas.push({
        categoria: typeof p.categoria === 'string' && p.categoria.trim() ? p.categoria.trim() : 'General',
        enunciado,
        codigoPython: typeof p.codigoPython === 'string' && p.codigoPython.trim() ? p.codigoPython : null,
        opciones,
        respuestaCorrecta,
        explicacionIa: typeof p.explicacionIa === 'string' ? p.explicacionIa.trim() : '',
      });
    }
    if (validas.length === 0) {
      throw new HttpException('ALVARO no generó preguntas utilizables desde este material. Intenta con otro PDF o menos preguntas.', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    return validas;
  }

  // ── 5) Borrador de retroalimentación para el DOCENTE (revisión de un reto) ──
  //  ALVARO solo ASISTE: propone un borrador que el docente edita antes de enviar.
  //  No se registra en consultas_ia (es actividad del docente, no del estudiante).
  async sugerirFeedbackDocente(input: { enunciado: string; codigo: string; aprobado?: boolean }) {
    const enunciado = sanitizar(input.enunciado, 600);
    const codigo = sanitizar(input.codigo, 4000);
    const orientacion = input.aprobado === false
      ? 'El docente se inclina por "Necesita mejorar": señala con tacto qué falta o falla y cómo encaminarlo.'
      : input.aprobado === true
        ? 'El docente se inclina por "Aprobado": refuerza lo que hizo bien y sugiere una mejora opcional.'
        : 'Evalúa objetivamente si resuelve el problema y qué puede mejorar.';
    const system = `Eres ALVARO, asistente del DOCENTE para redactar retroalimentación a un
estudiante de Python (primer semestre, UPEA). Escribe en español un BORRADOR de
feedback de 3-5 frases, en segunda persona (dirigido al estudiante), concreto y
respetuoso. ${orientacion} Comenta la corrección, legibilidad y buenas prácticas.
No inventes requisitos que no estén en el enunciado. Devuelve SOLO el texto del feedback.`;
    const msg = [
      `Enunciado del reto: ${enunciado}`,
      `Código entregado por el estudiante:\n\`\`\`python\n${codigo}\n\`\`\``,
    ].join('\n\n');
    const sugerencia = await this.generar(system, msg, TutorIaService.MAX_OUTPUT.feedback_docente);
    return { sugerencia };
  }
}
