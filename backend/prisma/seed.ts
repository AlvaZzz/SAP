import { PrismaClient, Banco, NivelDificultad, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Def, POSTEST } from './data';
import { PLAN_UPEA, EXTRA_AVANZADO, EjPlan, TemaPlan } from './plan-upea';
import { DIAGNOSTICO, INTRO_UNIDADES } from './diagnostico';
import { EXAMEN_UNIDAD, REPASO_UNIDADES, REPASO_TEMAS } from './repaso';
import { DASH_OBJETIVOS, DASH_ANALOGIAS, DASH_EJEMPLOS, DASH_MINUTOS } from './dashboard';
import { EMBLEMAS, RANGOS } from '../src/gamificacion/catalogo';
import { dificultadDesdeEstrellas, estimarTheta, nivelDesdeTheta, redondearTheta, RespuestaIrt } from '../src/mediciones/irt/irt';
import { claveEstable, equilibrarClavesLetras, ItemLetra, LETRAS as LETRAS_OPCION, OpcionLetra, SEMILLA_BANCO } from '../src/common/banco/clave-equilibrada';

/**
 * Seed Prisma — contenido 100% Python. Ejecutar: npm run seed
 *  · Estructura académica oficial UPEA (Programación I / PRG-111): 5 unidades,
 *    sus temas/subtemas y un banco masivo de ejercicios (≥10 por tema) → ./plan-upea.ts
 *  · Bancos pretest/postest (20 c/u, iguales para todos) → ./data.ts
 * Idempotente: limpia y recrea. Preparado para otras instituciones (EMI) sin
 * reescribir (unidades/temas llevan institucion/plan; numero único por institución).
 */

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = 'Prexi123*';
const LETRAS = ['A', 'B', 'C', 'D'];

// Categorías de los bancos pretest/postest → nivel temático.
const CAT_A_NIVEL: Record<string, number> = {
  Variables: 1, Condicionales: 2, Bucles: 3, Funciones: 4, Arreglos: 5, General: 1,
};

const tituloDe = (codigo: string, enun: string) => {
  const linea = codigo.split('\n').find((l) => l.trim()) ?? enun;
  return linea.length > 46 ? linea.slice(0, 45) + '…' : linea;
};

async function main() {
  console.log('[seed] Limpiando datos...');
  await prisma.$transaction([
    prisma.retoUsuario.deleteMany(),
    prisma.reto.deleteMany(),
    prisma.documento.deleteMany(),
    prisma.codigoPractica.deleteMany(),
    prisma.consultaIa.deleteMany(),
    prisma.logroUsuario.deleteMany(),
    prisma.logro.deleteMany(),
    prisma.rango.deleteMany(),
    prisma.examenUnidad.deleteMany(),
    prisma.repasoUnidad.deleteMany(),
    prisma.diagnosticoTema.deleteMany(),
    prisma.pretestRespuesta.deleteMany(),
    prisma.evaluacion.deleteMany(),
    prisma.pasoRuta.deleteMany(),
    prisma.intento.deleteMany(),
    prisma.perfilAdaptativo.deleteMany(),
    prisma.progresoTema.deleteMany(),
    prisma.progresoNivel.deleteMany(),
    prisma.unidadCompletada.deleteMany(),
    prisma.desempenoUnidad.deleteMany(),
    prisma.ranking.deleteMany(),
    prisma.preguntaGenerada.deleteMany(),
    prisma.ejercicio.deleteMany(),
    prisma.tema.deleteMany(),
    prisma.unidad.deleteMany(),
    prisma.nivel.deleteMany(),
    prisma.usuario.deleteMany(),
    prisma.configuracionSistema.deleteMany(),
  ]);

  // modeloIa: valor INICIAL, no autoritativo. En tiempo de ejecución manda
  // GEMINI_MODEL del entorno (ver TutorIaService.resolverModelo): así, si Google
  // retira el modelo sembrado, se corrige en Render sin tocar la base.
  await prisma.configuracionSistema.create({
    data: {
      id: 1,
      modeloIa: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite',
      // Demo: retos habilitados para Intermedio y Avanzado (el docente los controla).
      retosIntermedioHabilitado: true,
      retosAvanzadoHabilitado: true,
    },
  });

  // ── Usuarios demo ──
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  // [nombre, email, cédula, rol, grupo, institución] — grupo/institución alimentan al investigador.
  const usuariosDef: Array<[string, string, string, 'estudiante' | 'docente' | 'admin' | 'investigador', 'control' | 'experimental', string | null]> = [
    ['Juan Mamani', 'juan@upea.edu.bo', '8001001', 'estudiante', 'control', 'UPEA'],
    ['Ana Quispe', 'ana@upea.edu.bo', '8001002', 'estudiante', 'experimental', 'UPEA'],
    ['Carlos Mamani', 'carlos@upea.edu.bo', '8001003', 'estudiante', 'control', 'EMI'],
    ['Maria Vera', 'maria@upea.edu.bo', '8001004', 'estudiante', 'experimental', 'EMI'],
    ['Docente Demo', 'docente@upea.edu.bo', '8002001', 'docente', 'control', null],
    ['Admin PREXI', 'admin@upea.edu.bo', '8003001', 'admin', 'control', null],
    ['Investigador Demo', 'investigador@upea.edu.bo', '8004001', 'investigador', 'control', null],
  ];
  const uid: Record<string, number> = {};
  for (const [nombre, email, cedula, rol, grupo, institucion] of usuariosDef) {
    const u = await prisma.usuario.create({
      data: {
        nombre, email, cedula, rol, carrera: 'Ingeniería de Sistemas',
        passwordHash: hash, introduccionCompletada: true, repasoPostestCompletado: true, pretestCompletado: true, grupo, institucion,
      },
    });
    uid[email] = u.id;
  }

  // ── Niveles ──
  const nivelesDef: Array<[number, string, string, number]> = [
    [1, 'Fundamentos de Python', 'Variables, tipos de datos, operadores y conversión de tipos.', 12],
    [2, 'Estructuras condicionales', 'if / elif / else, comparaciones y operadores lógicos.', 15],
    [3, 'Bucles e iteraciones', 'for, while, range(), break, continue y acumuladores.', 15],
    [4, 'Funciones', 'def, parámetros, return, *args, alcance y recursividad.', 12],
    [5, 'Estructuras de datos', 'Listas, tuplas, diccionarios, conjuntos y comprensiones.', 15],
  ];
  const nid: Record<number, number> = {};
  for (const [numero, titulo, descripcion, umbral] of nivelesDef) {
    const n = await prisma.nivel.create({ data: { numero, titulo, descripcion, umbral } });
    nid[numero] = n.id;
  }

  // ── EQUILIBRADO DE LA CLAVE DE RESPUESTAS ────────────────────────────────
  //  La posición de la opción correcta se reparte de forma uniforme y
  //  determinista en CADA banco antes de sembrarlo. Sin esto, un estudiante que
  //  marque siempre la misma letra puntúa alto sin dominar el contenido, y esa
  //  puntuación contamina θ (IRT), el nivel adaptativo asignado y la comparación
  //  pre/post. El reordenamiento mueve el TEXTO correcto y su clave a la vez
  //  (src/common/banco/clave-equilibrada) y es reproducible con SEMILLA_BANCO.
  //  Solo aplica a los tipos cuya clave es una letra de opción: `ordenar_lineas`
  //  (clave "B,A,D,C") y `completar_codigo` (texto libre) quedan intactos.
  type Equilibrado = { opciones: OpcionLetra[]; respuestaCorrecta: string };
  const TIPOS_CON_LETRA = new Set(['opcion_multiple', 'predecir_salida']);

  /** Equilibra un banco y devuelve un buscador por identidad del ítem. */
  function equilibrador(items: ItemLetra[]): (enunciado: string, textos: string[]) => Equilibrado | null {
    const resultados = equilibrarClavesLetras(items, SEMILLA_BANCO);
    const mapa = new Map<string, Equilibrado>();
    items.forEach((it, i) => {
      if (!resultados[i].aplicado) return;
      mapa.set(claveEstable(it.enunciado, it.opciones.map((o) => o.texto)), {
        opciones: resultados[i].opciones,
        respuestaCorrecta: resultados[i].respuestaCorrecta,
      });
    });
    return (enunciado, textos) => mapa.get(claveEstable(enunciado, textos)) ?? null;
  }

  /** Ítem con opciones como texto plano + índice de la correcta → formato con letras. */
  const comoItemLetra = (enunciado: string, textos: string[], correcta: number): ItemLetra => ({
    enunciado,
    opciones: textos.map((texto, i) => ({ id: LETRAS_OPCION[i], texto })),
    respuestaCorrecta: LETRAS_OPCION[correcta],
  });

  // ── Ejercicios de PRÁCTICA: estructura académica UPEA (Unidad → Tema → Subtema) ──
  const idsPorNivel: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  const MIN_TEMA = 10; // mínimo de ejercicios activos para publicar un tema
  let totalPractica = 0;
  let totalTemas = 0;

  // Deriva el nivel adaptativo (discreto) desde la dificultad 1-5.
  const nivelDe = (d: number): 'basico' | 'intermedio' | 'avanzado' => (d <= 2 ? 'basico' : d === 3 ? 'intermedio' : 'avanzado');

  // Banco de práctica completo (plan UPEA, incluidos los extras avanzados).
  const ejerciciosPlan: EjPlan[] = [];
  {
    const recorrer = (t: TemaPlan) => {
      ejerciciosPlan.push(...t.ejercicios, ...(EXTRA_AVANZADO[t.numero] ?? []));
      (t.subtemas ?? []).forEach(recorrer);
    };
    PLAN_UPEA.forEach((u) => u.temas.forEach(recorrer));
  }
  const equilPractica = equilibrador(
    ejerciciosPlan
      .filter((e) => TIPOS_CON_LETRA.has(e.tipo) && e.opciones.length >= 2)
      .map((e) => ({ enunciado: e.enunciado, opciones: e.opciones, respuestaCorrecta: e.respuestaCorrecta })),
  );

  async function insertarPlan(ej: EjPlan, nivelId: number, temaId: number): Promise<number> {
    const eq = TIPOS_CON_LETRA.has(ej.tipo) ? equilPractica(ej.enunciado, ej.opciones.map((o) => o.texto)) : null;
    const creado = await prisma.ejercicio.create({
      data: {
        titulo: tituloDe(ej.codigo ?? '', ej.enunciado),
        categoria: ej.categoria,
        nivelId,
        temaId,
        estrellas: ej.dificultad,
        nivelDificultad: nivelDe(ej.dificultad),
        // Dificultad b (IRT/Rasch) derivada de las estrellas del ejercicio.
        dificultadB: dificultadDesdeEstrellas(ej.dificultad),
        tipo: ej.tipo,
        enunciado: ej.enunciado,
        codigoPython: ej.codigo,
        opciones: eq?.opciones ?? ej.opciones, // ya en formato { id, texto }
        respuestaCorrecta: eq?.respuestaCorrecta ?? ej.respuestaCorrecta,
        xp: ej.xp,
        explicacionIa: ej.expl,
        banco: 'practica',
      },
    });
    return creado.id;
  }

  // Mapa numero-de-tema → id, para asociar luego el banco de diagnóstico curado.
  const temaIdPorNumero: Record<string, number> = {};
  const nivelPorTema: Record<string, number> = {};

  async function crearTema(t: TemaPlan, unidadId: number, nivel: number, orden: number, padreId: number | null) {
    // Se añaden los ejercicios AVANZADOS que garantizan cobertura de los 3 niveles.
    const ejercicios = [...t.ejercicios, ...(EXTRA_AVANZADO[t.numero] ?? [])];
    const tema = await prisma.tema.create({
      data: {
        unidadId, padreId, numero: t.numero, titulo: t.titulo, descripcion: t.descripcion,
        repaso: REPASO_TEMAS[t.numero] ?? null,
        institucion: 'UPEA', orden, umbral: MIN_TEMA,
        publicado: ejercicios.length >= MIN_TEMA, // publicado solo si cumple el mínimo
      },
    });
    temaIdPorNumero[t.numero] = tema.id;
    nivelPorTema[t.numero] = nivel;
    totalTemas++;
    for (const ej of ejercicios) {
      idsPorNivel[nivel].push(await insertarPlan(ej, nid[nivel], tema.id));
      totalPractica++;
    }
    let subOrden = 0;
    for (const sub of t.subtemas ?? []) await crearTema(sub, unidadId, nivel, subOrden++, tema.id);
  }

  for (const u of PLAN_UPEA) {
    const unidad = await prisma.unidad.create({
      data: {
        numero: u.numero, titulo: u.titulo, descripcion: u.descripcion,
        introduccion: INTRO_UNIDADES[u.numero] ?? null,
        repaso: REPASO_UNIDADES[u.numero] ?? null,
        dashObjetivos: DASH_OBJETIVOS[u.numero] ?? null,
        dashAnalogias: DASH_ANALOGIAS[u.numero] ?? null,
        dashEjemplos: (DASH_EJEMPLOS[u.numero] ?? []) as unknown as object,
        dashMinutos: DASH_MINUTOS[u.numero] ?? null,
        institucion: u.institucion, plan: u.plan, orden: u.numero, xp: 100,
      },
    });
    let orden = 0;
    for (const t of u.temas) await crearTema(t, unidad.id, u.nivel, orden++, null);
  }

  // ── Banco de POSTEST (evaluación final, igual para todos; 5 categorías) ──
  const equilPostest = equilibrador(
    POSTEST.filter((d) => TIPOS_CON_LETRA.has(d.tipo) && d.opciones.length >= 2).map((d) =>
      comoItemLetra(d.enunciado, d.opciones, d.respuesta_correcta),
    ),
  );

  async function insertar(d: Def, banco: Banco): Promise<number> {
    const numeroNivel = d.nivel ?? CAT_A_NIVEL[d.categoria] ?? 1;
    const eq = TIPOS_CON_LETRA.has(d.tipo) ? equilPostest(d.enunciado, d.opciones) : null;
    const ej = await prisma.ejercicio.create({
      data: {
        titulo: tituloDe(d.codigo_python, d.enunciado),
        categoria: d.categoria,
        nivelId: nid[numeroNivel],
        estrellas: d.dificultad,
        nivelDificultad: nivelDe(d.dificultad),
        // Dificultad b (IRT/Rasch): da spread real a los ítems para estimar θ.
        dificultadB: dificultadDesdeEstrellas(d.dificultad),
        tipo: d.tipo,
        enunciado: d.enunciado,
        codigoPython: d.codigo_python,
        opciones: eq?.opciones ?? d.opciones.map((t, i) => ({ id: LETRAS[i], texto: t })),
        respuestaCorrecta: eq?.respuestaCorrecta ?? LETRAS[d.respuesta_correcta],
        xp: d.xp ?? d.dificultad * 5,
        explicacionIa: d.expl ?? 'Analiza paso a paso la ejecución del código.',
        banco,
      },
    });
    return ej.id;
  }
  for (const d of POSTEST) await insertar(d, 'postest');

  // ── Banco de DIAGNÓSTICO por TEMA (banco='pretest', asociado a temas curados) ──
  //  Instrumento por tema: 3–5 ítems por tema con spread de dificultad para estimar
  //  θ por tema (IRT). Marca cada tema curado como enDiagnostico=true.
  let totalDiag = 0;
  const temasDiagnostico: number[] = [];
  const equilDiag = equilibrador(
    DIAGNOSTICO.flatMap((dt) => dt.items.map((it) => comoItemLetra(it.enunciado, it.opciones, it.correcta))),
  );
  for (const dt of DIAGNOSTICO) {
    const temaId = temaIdPorNumero[dt.tema];
    if (!temaId) {
      console.warn(`[seed] ⚠ tema de diagnóstico ${dt.tema} no existe en el plan; se omite.`);
      continue;
    }
    const nivelNum = nivelPorTema[dt.tema] ?? 1;
    for (const it of dt.items) {
      await prisma.ejercicio.create({
        data: {
          titulo: tituloDe(it.codigo ?? '', it.enunciado),
          categoria: dt.categoria,
          nivelId: nid[nivelNum],
          temaId,
          estrellas: it.estrellas,
          nivelDificultad: nivelDe(it.estrellas),
          dificultadB: dificultadDesdeEstrellas(it.estrellas),
          tipo: 'opcion_multiple',
          enunciado: it.enunciado,
          codigoPython: it.codigo ?? null,
          opciones: equilDiag(it.enunciado, it.opciones)?.opciones ?? it.opciones.map((t, i) => ({ id: LETRAS[i], texto: t })),
          respuestaCorrecta: equilDiag(it.enunciado, it.opciones)?.respuestaCorrecta ?? LETRAS[it.correcta],
          xp: it.estrellas * 5,
          explicacionIa: it.expl,
          banco: 'pretest',
        },
      });
      totalDiag++;
    }
    await prisma.tema.update({ where: { id: temaId }, data: { enDiagnostico: true } });
    temasDiagnostico.push(temaId);
  }

  // ── Banco del EXAMEN DE FIN DE UNIDAD (banco='examen', por tema de la unidad) ──
  //  Preguntas propias distintas del diagnóstico/práctica; alimentan el examen que
  //  valida el avance a la siguiente unidad. El docente puede gestionarlas luego.
  let totalExamen = 0;
  const equilExamen = equilibrador(
    EXAMEN_UNIDAD.flatMap((et) => et.items.map((it) => comoItemLetra(it.enunciado, it.opciones, it.correcta))),
  );
  for (const et of EXAMEN_UNIDAD) {
    const temaId = temaIdPorNumero[et.tema];
    if (!temaId) {
      console.warn(`[seed] ⚠ tema de examen ${et.tema} no existe en el plan; se omite.`);
      continue;
    }
    const nivelNum = nivelPorTema[et.tema] ?? 1;
    for (const it of et.items) {
      await prisma.ejercicio.create({
        data: {
          titulo: tituloDe(it.codigo ?? '', it.enunciado),
          categoria: et.categoria,
          nivelId: nid[nivelNum],
          temaId,
          estrellas: it.estrellas,
          nivelDificultad: nivelDe(it.estrellas),
          dificultadB: dificultadDesdeEstrellas(it.estrellas),
          tipo: 'opcion_multiple',
          enunciado: it.enunciado,
          codigoPython: it.codigo ?? null,
          opciones: equilExamen(it.enunciado, it.opciones)?.opciones ?? it.opciones.map((t, i) => ({ id: LETRAS[i], texto: t })),
          respuestaCorrecta: equilExamen(it.enunciado, it.opciones)?.respuestaCorrecta ?? LETRAS[it.correcta],
          xp: it.estrellas * 5,
          explicacionIa: it.expl,
          banco: 'examen',
        },
      });
      totalExamen++;
    }
  }

  console.log(`[seed] UPEA: ${PLAN_UPEA.length} unidades, ${totalTemas} temas | práctica=${totalPractica} | diagnóstico=${totalDiag} (${temasDiagnostico.length} temas) | examen=${totalExamen} | postest=${POSTEST.length}`);

  // ── Emblemas (catálogo compartido) y rangos ──
  await prisma.logro.createMany({
    data: EMBLEMAS.map((e) => ({
      clave: e.clave, nombre: e.nombre, condicion: e.condicion,
      descripcion: e.descripcion, icono: e.icono, svgKey: e.svgKey,
      categoria: e.categoria, orden: e.orden,
    })),
  });
  await prisma.rango.createMany({
    data: RANGOS.map((r) => ({ clave: r.clave, nombre: r.nombre, orden: r.orden, umbral: r.umbral, svgKey: r.svgKey, color: r.color })),
  });

  // ── Demo: progreso real de Juan ──
  //  El historial se siembra como el de un estudiante REAL para que los
  //  indicadores de hábitos (autonomía/eficiencia) tengan algo que describir:
  //   · la fecha avanza en ORDEN (antes era aleatoria, así que la "tendencia"
  //     no guardaba relación con la secuencia de práctica y salía plana);
  //   · al principio necesita pistas y falla algún intento; al final resuelve solo;
  //   · el tiempo varía y se acorta un poco, sin ser monótono.
  //  Cada ejercicio termina SIEMPRE resuelto: los fallos son intentos previos, así
  //  el dominio/desbloqueo por ejercicios distintos correctos no cambia.
  const juan = uid['juan@upea.edu.bo'];
  let xpJuan = 0;
  const totalPrevisto = idsPorNivel[1].length + 6;
  const inicioHistorial = Date.now() - 6 * 86_400_000;
  let seq = 0;
  const resolver = async (ids: number[], cuantos: number) => {
    for (const id of ids.slice(0, cuantos)) {
      const ej = await prisma.ejercicio.findUnique({ where: { id }, select: { xp: true } });
      const xp = ej?.xp ?? 0;
      const avance = totalPrevisto > 1 ? seq / (totalPrevisto - 1) : 1; // 0 = primeros, 1 = últimos
      const fecha = new Date(inicioHistorial + avance * 6 * 86_400_000);
      // Pistas: de necesitar 2 al empezar a ninguna al final.
      const pistas = avance < 0.25 ? 2 : avance < 0.5 ? 1 : avance < 0.75 ? (seq % 3 === 0 ? 1 : 0) : 0;
      // Tiempo: ~95s → ~50s con oscilación determinista (sin Math.random: el seed
      // debe ser reproducible para la tesis).
      const tiempo = Math.round(95 - avance * 45 + ((seq * 37) % 19) - 9);

      // Intento fallido PREVIO en la primera mitad: así la tasa de acierto
      // arranca más baja y mejora, que es lo que el indicador debe mostrar.
      if (avance < 0.45 && seq % 3 === 0) {
        await prisma.intento.create({
          data: {
            usuarioId: juan, ejercicioId: id, respuestaDada: 'B', correcto: false,
            tiempoSeg: tiempo + 20, pistasUsadas: pistas, xpOtorgado: 0,
            fecha: new Date(fecha.getTime() - 120_000),
          },
        });
      }

      xpJuan += xp;
      await prisma.intento.create({
        data: {
          usuarioId: juan, ejercicioId: id, respuestaDada: 'A', correcto: true,
          tiempoSeg: tiempo, pistasUsadas: pistas, xpOtorgado: xp, fecha,
        },
      });

      // Consultas a PREXI coherentes con las pistas pedidas.
      for (let p = 1; p <= pistas; p++) {
        await prisma.consultaIa.create({
          data: { usuarioId: juan, tipo: 'pista', endpoint: '/tutor-ia/pista', ejercicioId: id, nivelPista: p, fecha },
        });
      }
      if (avance < 0.4 && seq % 5 === 0) {
        await prisma.consultaIa.create({
          data: { usuarioId: juan, tipo: 'asistente', endpoint: '/tutor-ia/asistente', ejercicioId: id, pregunta: '¿Por dónde empiezo?', fecha },
        });
      }
      seq++;
    }
  };
  await resolver(idsPorNivel[1], idsPorNivel[1].length);
  await resolver(idsPorNivel[2], 6);

  for (const [numero, comp, desbloqueado] of [
    [1, idsPorNivel[1].length, true], [2, 6, true], [3, 0, true], [4, 0, false], [5, 0, false],
  ] as Array<[number, number, boolean]>) {
    await prisma.progresoNivel.create({
      data: { usuarioId: juan, nivelId: nid[numero], ejerciciosCompletados: comp, desbloqueado },
    });
  }

  // ── Ranking ──
  const rankingDef: Array<[string, number, number]> = [
    ['juan@upea.edu.bo', xpJuan, 5],
    ['ana@upea.edu.bo', 1240, 7],
    ['carlos@upea.edu.bo', 1105, 4],
    ['maria@upea.edu.bo', 920, 3],
  ];
  for (const [email, xp, racha] of rankingDef) {
    await prisma.ranking.create({
      data: { usuarioId: uid[email], xpTotal: xp, rachaDias: racha, ultimaActividad: new Date() },
    });
  }
  for (const email of ['docente@upea.edu.bo', 'admin@upea.edu.bo']) {
    await prisma.ranking.create({ data: { usuarioId: uid[email], xpTotal: 0, rachaDias: 0 } });
  }
  // Posiciones por XP.
  const orden = await prisma.ranking.findMany({ orderBy: [{ xpTotal: 'desc' }, { usuarioId: 'asc' }] });
  for (let i = 0; i < orden.length; i++) {
    await prisma.ranking.update({ where: { usuarioId: orden[i].usuarioId }, data: { posicion: i + 1 } });
  }

  // ── POSTEST demo (evaluación final): 5 categorías genéricas, banco='postest' ──
  //  Genera filas pretest_respuestas (tipo='post') + la Evaluacion persistida.
  async function evalDemoPost(usuarioId: number, aciertos: number, tiempoSeg: number) {
    const ejs = await prisma.ejercicio.findMany({
      where: { banco: 'postest' }, orderBy: { id: 'asc' },
      select: { id: true, categoria: true, respuestaCorrecta: true, opciones: true },
    });
    const rows = ejs.map((e, i) => {
      const correcto = i < aciertos;
      const ops = (Array.isArray(e.opciones) ? e.opciones : []) as { id: string }[];
      const wrong = ops.map((o) => o.id).find((id) => id.toUpperCase() !== e.respuestaCorrecta.trim().toUpperCase()) ?? 'X';
      return {
        usuarioId, ejercicioId: e.id, tipo: 'post' as const, categoria: e.categoria,
        opcionDada: correcto ? e.respuestaCorrecta : wrong, correcto,
      };
    });
    await prisma.pretestRespuesta.createMany({ data: rows, skipDuplicates: true });

    const byCat = new Map<string, { aciertos: number; total: number }>();
    for (const r of rows) {
      const c = byCat.get(r.categoria) ?? { aciertos: 0, total: 0 };
      c.total++; if (r.correcto) c.aciertos++;
      byCat.set(r.categoria, c);
    }
    const porCategoria = [...byCat.entries()]
      .map(([categoria, v]) => ({ categoria, aciertos: v.aciertos, total: v.total, porcentaje: Math.round((v.aciertos / v.total) * 100) }))
      .sort((a, b) => a.categoria.localeCompare(b.categoria));
    const puntaje = rows.length ? Math.round((aciertos / rows.length) * 100) : 0;
    await prisma.evaluacion.create({ data: { usuarioId, tipo: 'post', puntajeTotal: puntaje, tiempoSeg, porCategoria } });
  }

  // ── DIAGNÓSTICO demo POR TEMA: replica el flujo real de finalizar() del pretest ──
  //  Para cada tema del diagnóstico estima θ (IRT/Rasch) y clasifica el nivel; deja
  //  DiagnosticoTema (permanente), ProgresoTema.nivelActual (arranque adaptativo) y la
  //  Evaluacion 'pre' global. `habilidad` (0-1) modela al estudiante: un ítem se acierta
  //  si su dificultad (★) no supera la habilidad → patrón realista con spread por nivel.
  async function evalDemoPre(usuarioId: number, habilidad: number, tiempoSeg: number) {
    const ejs = await prisma.ejercicio.findMany({
      where: { banco: 'pretest', temaId: { not: null } },
      orderBy: [{ temaId: 'asc' }, { estrellas: 'asc' }],
      select: { id: true, temaId: true, categoria: true, estrellas: true, dificultadB: true, respuestaCorrecta: true, opciones: true },
    });
    const porTema = new Map<number, typeof ejs>();
    for (const e of ejs) {
      const arr = porTema.get(e.temaId!) ?? [];
      arr.push(e);
      porTema.set(e.temaId!, arr);
    }

    const rows: { usuarioId: number; ejercicioId: number; tipo: 'pre'; categoria: string; temaId: number; opcionDada: string; correcto: boolean }[] = [];
    const allResp: RespuestaIrt[] = [];
    const porTemaAgg: { categoria: string; aciertos: number; total: number; porcentaje: number }[] = [];
    let aciertosGlobal = 0;
    let totalGlobal = 0;

    for (const [temaId, items] of porTema) {
      const respTema: RespuestaIrt[] = [];
      let aciertos = 0;
      for (const e of items) {
        const umbral = (e.estrellas - 1) / 5; // ★1→0.0 … ★5→0.8
        const correcto = habilidad >= umbral;
        if (correcto) aciertos++;
        const ops = (Array.isArray(e.opciones) ? e.opciones : []) as { id: string }[];
        const wrong = ops.map((o) => o.id).find((id) => id.toUpperCase() !== e.respuestaCorrecta.trim().toUpperCase()) ?? 'X';
        rows.push({ usuarioId, ejercicioId: e.id, tipo: 'pre', categoria: e.categoria, temaId, opcionDada: correcto ? e.respuestaCorrecta : wrong, correcto });
        const r: RespuestaIrt = { b: e.dificultadB, correcto };
        respTema.push(r);
        allResp.push(r);
      }
      const total = items.length;
      const theta = redondearTheta(estimarTheta(respTema));
      const nivel = nivelDesdeTheta(theta);
      const puntaje = total ? Math.round((aciertos / total) * 100) : 0;
      await prisma.diagnosticoTema.create({ data: { usuarioId, temaId, theta, nivel, aciertos, total, puntaje } });
      // Arranque de la adaptatividad: el tema queda desbloqueado en su nivel inicial.
      await prisma.progresoTema.upsert({
        where: { usuarioId_temaId: { usuarioId, temaId } },
        create: { usuarioId, temaId, nivelActual: nivel, desbloqueado: true },
        update: { nivelActual: nivel, desbloqueado: true },
      });
      aciertosGlobal += aciertos;
      totalGlobal += total;
      porTemaAgg.push({ categoria: items[0].categoria, aciertos, total, porcentaje: puntaje });
    }

    await prisma.pretestRespuesta.createMany({ data: rows, skipDuplicates: true });

    const puntajeGlobal = totalGlobal ? Math.round((aciertosGlobal / totalGlobal) * 100) : 0;
    const thetaGlobal = redondearTheta(estimarTheta(allResp));
    const nivelGlobal: NivelDificultad = nivelDesdeTheta(thetaGlobal);
    await prisma.evaluacion.create({ data: { usuarioId, tipo: 'pre', puntajeTotal: puntajeGlobal, tiempoSeg, porCategoria: porTemaAgg } });
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { thetaInicial: thetaGlobal, nivelInicialAdaptativo: nivelGlobal, nivelInicial: nivelGlobal === 'avanzado' ? 2 : 1 },
    });
    await prisma.historialTheta.create({ data: { usuarioId, theta: thetaGlobal, origen: 'pretest', n: allResp.length } });
  }

  // [email, habilidad_pre (0-1), pre_seg, post_aciertos/20, post_seg] — ganancia post positiva.
  const evalDef: Array<[string, number, number, number, number]> = [
    ['juan@upea.edu.bo', 0.4, 900, 16, 780],
    ['ana@upea.edu.bo', 0.7, 850, 17, 720],
    ['carlos@upea.edu.bo', 0.3, 1000, 12, 900],
    ['maria@upea.edu.bo', 0.55, 950, 15, 800],
  ];
  for (const [email, habilidad, preT, postA, postT] of evalDef) {
    await evalDemoPre(uid[email], habilidad, preT);
    await evalDemoPost(uid[email], postA, postT);
  }

  // ── Examen de fin de unidad demo: repaso + intento APROBADO de la Unidad 1 ──
  //  Con el nuevo gate, avanzar a la Unidad 2 exige un ExamenUnidad aprobado. Se
  //  siembra para los estudiantes demo un intento aprobado de la Unidad 1 (y de la
  //  Unidad 2 para Juan) para que su progreso siga siendo coherente.
  const unidad1 = await prisma.unidad.findFirst({ where: { numero: 1 }, select: { id: true } });
  const unidad2 = await prisma.unidad.findFirst({ where: { numero: 2 }, select: { id: true } });
  async function examenDemo(usuarioId: number, unidadId: number, theta: number) {
    const nivel = nivelDesdeTheta(theta);
    await prisma.repasoUnidad.upsert({
      where: { usuarioId_unidadId: { usuarioId, unidadId } },
      create: { usuarioId, unidadId },
      update: {},
    });
    await prisma.examenUnidad.create({
      data: { usuarioId, unidadId, theta: redondearTheta(theta), nivel, puntaje: 88, aprobado: true, aciertos: 7, total: 8 },
    });
  }
  for (const email of ['juan@upea.edu.bo', 'ana@upea.edu.bo', 'carlos@upea.edu.bo', 'maria@upea.edu.bo']) {
    if (unidad1) await examenDemo(uid[email], unidad1.id, 0.6);
  }
  if (unidad2) await examenDemo(uid['juan@upea.edu.bo'], unidad2.id, 0.4);

  // ── Documentos demo (subidos por el docente) ──
  //  Se asocian a un TEMA real del plan (por su `numero`): de ahí cuelga la unidad
  //  con la que el estudiante los ve agrupados. Uno apunta a un SUBTEMA (1.5.2) y
  //  otro se deja sin tema a propósito, para representar "General / Sin categoría".
  const docente = uid['docente@upea.edu.bo'];
  const docs: Array<[string, number, number, string | null, string]> = [
    // [titulo, nivelNumero, MB, numeroTema, descripcion]
    ['Introducción a Variables y Tipos de Datos', 1, 1.8, '1.5',
      'Qué es una variable, cómo se declara y los tipos básicos (int, float, str, bool) con ejemplos comentados.'],
    ['Tabla de operadores de Python', 1, 0.6, '1.5.2',
      'Referencia rápida de operadores aritméticos, de comparación y lógicos, con su precedencia.'],
    ['Ejercicios resueltos de Condicionales', 2, 3.2, '2.3',
      '20 ejercicios de if/elif/else resueltos paso a paso, con los errores más frecuentes al anidar condiciones.'],
    ['Guía de Bucles FOR y WHILE', 3, 2.4, '2.4',
      'Cuándo usar for y cuándo while, recorrido de secuencias, acumuladores y control de bucles infinitos.'],
    ['Funciones en Python — Teoría y práctica', 4, 4.1, '3.2',
      'Definición de funciones, parámetros, valores de retorno y alcance de las variables.'],
    ['Reglamento de laboratorio y guía de entregas', 1, 0.4, null,
      'Normas de las sesiones de laboratorio, formato de entrega y criterios de evaluación de la materia.'],
  ];
  for (const [titulo, nivelN, mb, numeroTema, descripcion] of docs) {
    const tema = numeroTema ? await prisma.tema.findFirst({ where: { numero: numeroTema } }) : null;
    await prisma.documento.create({
      data: {
        titulo, descripcion,
        archivo: `/docs/${titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
        tamanoBytes: Math.round(mb * 1024 * 1024), nivelId: nid[nivelN],
        temaId: tema?.id ?? null, subidoPorId: docente,
      },
    });
  }

  // ── Retos demo (ejercicios extra del docente) ──
  //  Se asocian a un TEMA real del plan (por su `numero`): de ahí cuelga la unidad
  //  con la que el estudiante los ve AGRUPADOS. Uno apunta a un SUBTEMA (2.5) y
  //  otro se deja sin tema (representa "General / Sin categoría").
  const retosDemo: Array<Prisma.RetoCreateManyInput & { numeroTema: string | null }> = [
    {
      numeroTema: '2.4',
      titulo: 'FizzBuzz', categoria: 'Bucles', estrellas: 3, tipo: 'completar_codigo', autorId: docente, xp: 80,
      enunciado: 'Imprime los números del 1 al 20. Para múltiplos de 3 imprime "Fizz", de 5 "Buzz", y de ambos "FizzBuzz".',
      codigoInicial: 'for i in range(1, 21):\n    # tu código aquí\n    pass',
    },
    {
      numeroTema: null,
      titulo: 'Invertir una cadena', categoria: 'Estructuras', estrellas: 2, tipo: 'completar_codigo', autorId: docente, xp: 60,
      enunciado: 'Escribe una función que reciba un texto y devuelva la cadena invertida (sin usar reversed).',
      codigoInicial: 'def invertir(texto):\n    # tu código aquí\n    return ""\n\nprint(invertir("python"))',
    },
    {
      numeroTema: '3.2',
      titulo: 'Número primo', categoria: 'Funciones', estrellas: 4, tipo: 'completar_codigo', autorId: docente, xp: 100,
      enunciado: 'Escribe una función es_primo(n) que devuelva True si n es primo y False en caso contrario.',
      codigoInicial: 'def es_primo(n):\n    # tu código aquí\n    return False\n\nprint(es_primo(7))',
    },
    // ── Misiones de depuración (bug‑hunt): auto‑validadas por salida esperada ──
    {
      numeroTema: '2.4',
      titulo: 'Bug: suma del 1 al 5', categoria: 'Bucles', estrellas: 2, autorId: docente, xp: 70, esBugHunt: true,
      enunciado: 'Este código debería imprimir la suma de 1 a 5 (=15), pero da otro resultado. Encuentra y corrige el bug.',
      codigoInicial: 'total = 0\nfor n in range(1, 5):\n    total = total + n\nprint(total)',
      ejemploSalida: '15',
    },
    {
      numeroTema: '2.3',
      titulo: 'Bug: contar pares', categoria: 'Condicionales', estrellas: 3, autorId: docente, xp: 80, esBugHunt: true,
      enunciado: 'Debe contar cuántos números pares hay en la lista (=3), pero el conteo está mal. Corrige el bug.',
      codigoInicial: 'nums = [4, 7, 10, 3, 8]\npares = 0\nfor x in nums:\n    if x % 2 == 1:\n        pares = pares + 1\nprint(pares)',
      ejemploSalida: '3',
    },
  ];
  for (const { numeroTema, ...reto } of retosDemo) {
    const tema = numeroTema ? await prisma.tema.findFirst({ where: { numero: numeroTema } }) : null;
    await prisma.reto.create({ data: { ...reto, temaId: tema?.id ?? null } });
  }

  // ── Demo: insignias desbloqueadas de Juan ──
  const logrosJuan = await prisma.logro.findMany({ where: { clave: { in: ['primer_acierto', 'tema_completado', 'mente_brillante'] } } });
  await prisma.logroUsuario.createMany({ data: logrosJuan.map((l) => ({ usuarioId: juan, logroId: l.id })) });

  console.log(`[seed] Juan XP=${xpJuan}; ranking, progreso, documentos, retos e insignias demo listos.`);
  console.log(`[seed] ✅ Usuarios @upea.edu.bo (clave ${DEFAULT_PASSWORD})`);
}

main()
  .catch((e) => { console.error('[seed] ❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
