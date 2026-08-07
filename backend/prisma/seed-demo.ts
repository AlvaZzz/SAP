/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  SEED DE DEMOSTRACIÓN — 25 estudiantes SINTÉTICOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ SON ESTOS DATOS
 *  Estudiantes ficticios con actividad simulada. Existen para poblar el
 *  prototipo, verificar que el rol investigador calcula y grafica bien, tomar
 *  capturas y demostrar el sistema funcionando sin necesitar participantes
 *  reales.
 *
 *  QUÉ NO SON
 *  NO son participantes de la investigación. No pueden aparecer en el dataset
 *  del estudio, ni en ningún resultado, tabla o gráfico de la tesis. Si alguna
 *  captura de estas pantallas se usa en el documento, debe rotularse como
 *  "entorno de demostración", nunca como resultados del estudio.
 *
 *  ── LOS TRES CANDADOS QUE MANTIENEN LA SEPARACIÓN ──────────────────────────
 *
 *  1. IDENTIFICACIÓN EN EL PROPIO DATO
 *     Correo bajo `@demo.prexi.local` (dominio reservado, no enrutable) e
 *     `institucion = 'DEMO'`. Cualquiera que mire la tabla `usuarios` los
 *     reconoce de inmediato, sin necesidad de consultar este archivo.
 *
 *  2. EXCLUSIÓN EN EL ORIGEN DEL DATASET
 *     `SOLO_ESTUDIANTES_DEL_ESTUDIO` en
 *     `src/investigador/investigador-exportacion/investigador-exportacion.service.ts`
 *     los descarta. Como TODAS las pantallas del investigador derivan de ese
 *     servicio, quedan fuera de una sola vez: muestra, fiabilidad, equivalencia,
 *     resultados, validez, evidencia complementaria y CSV exportados.
 *     Se comprueban ambas marcas (correo E institución): si alguien editara una,
 *     la otra sigue excluyendo el registro.
 *
 *  3. VISIBILIDAD EXPLÍCITA
 *     El Panel del investigador muestra un aviso mientras existan cuentas demo
 *     en la base, indicando cuántas son y que están excluidas de los cálculos.
 *     Nada oculto: un tribunal puede pedir ver la base y encontrar datos de
 *     prueba claramente identificados. Lo que no puede encontrar es datos
 *     inventados mezclados con los reales.
 *
 *  ── USO ────────────────────────────────────────────────────────────────────
 *
 *     npm run seed:demo              → crea (o recrea) los 25 estudiantes
 *     npm run seed:demo -- --limpiar → elimina SOLO las cuentas demo
 *
 *  · Idempotente: correrlo dos veces no duplica. Borra las cuentas demo
 *    anteriores y las vuelve a crear.
 *  · Determinista: PRNG con semilla fija, así que dos ejecuciones producen
 *    exactamente el mismo conjunto y las capturas son reproducibles.
 *  · Manual: NUNCA se ejecuta al arrancar el sistema. Es un comando consciente.
 *  · Contraseña de todas las cuentas demo: `Prexi123*` (son cuentas de prueba;
 *    no existen en producción).
 *
 *  ⚠️ NO ejecutar contra la base de producción una vez que haya participantes
 *  reales sin consultarlo antes, aunque los candados lo hagan seguro.
 *
 *  COHERENCIA CON EL SISTEMA
 *  La actividad NO se inventa con números finales escritos a mano: se genera
 *  pasando por la MISMA lógica del sistema (`estimarTheta`, `nivelDesdeTheta`,
 *  `probabilidadAcierto`, `factorXpNivel`, la fórmula real de XP y racha). Si se
 *  escribieran los resultados directamente, el seed podría producir estados
 *  imposibles que el sistema real nunca generaría, y las pruebas dejarían de
 *  ser válidas.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { PrismaClient, NivelDificultad, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  dificultadDesdeEstrellas, estimarTheta, nivelDesdeTheta, probabilidadAcierto,
  redondearTheta, RespuestaIrt,
} from '../src/mediciones/irt/irt';
import { factorXpNivel } from '../src/common/niveles/nivel-dificultad';

const prisma = new PrismaClient();

// ── Marcas de identificación (candado 1) ───────────────────────────────────
const DOMINIO_DEMO = '@demo.prexi.local';
const INSTITUCION_DEMO = 'DEMO';
const PASSWORD_DEMO = 'Prexi123*';
const TOTAL = 25;

// ── PRNG determinista (mulberry32) ─────────────────────────────────────────
// Semilla fija: dos ejecuciones producen el mismo conjunto, de modo que las
// capturas de pantalla son reproducibles y los números no bailan entre corridas.
function crearRng(semilla: number) {
  let a = semilla;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = crearRng(20260807);
const entre = (min: number, max: number) => min + rnd() * (max - min);
const enteroEntre = (min: number, max: number) => Math.floor(entre(min, max + 1));
const elegir = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];

// ── Nombres verosímiles de La Paz / El Alto ────────────────────────────────
const NOMBRES_M = ['Juan Carlos', 'Luis Fernando', 'José Miguel', 'Marco Antonio', 'Edwin', 'Rodrigo', 'Álvaro', 'Freddy', 'Grover', 'Wilson', 'Rubén', 'Iván'];
const NOMBRES_F = ['María Elena', 'Ana Lucía', 'Gabriela', 'Rosmery', 'Nayra', 'Silvia', 'Vanesa', 'Karina', 'Lizeth', 'Miriam', 'Jhoselin', 'Daniela'];
const APELLIDOS = [
  'Mamani', 'Quispe', 'Condori', 'Choquehuanca', 'Apaza', 'Ticona', 'Callisaya',
  'Poma', 'Huanca', 'Laura', 'Cáceres', 'Villca', 'Chura', 'Yujra', 'Colque',
  'Ramos', 'Flores', 'Gutiérrez', 'Vargas', 'Aruquipa', 'Limachi', 'Nina',
];

/** Perfil de desempeño: define la habilidad real y la constancia del estudiante. */
interface Perfil {
  clave: 'alto' | 'medio' | 'bajo' | 'abandono';
  /** θ "verdadera" del estudiante, de la que se simulan sus respuestas. */
  thetaReal: number;
  /** Sesiones de práctica que llega a hacer. */
  sesiones: number;
  /** ¿Rinde el postest? Algunos NO, a propósito: para probar datos faltantes. */
  rindePostest: boolean;
  /** Cuánto mejora entre pretest y postest (en logits). */
  mejora: number;
}

/**
 * Reparto de perfiles. Deliberadamente DESIGUAL: un conjunto donde todos
 * progresan parejo no sirve para probar nada y además se nota artificial.
 * Se incluyen abandonos y estudiantes sin postest para ejercitar el flujo de
 * participantes y el tratamiento de datos faltantes del rol investigador.
 */
function perfilPara(i: number): Perfil {
  if (i < 6) return { clave: 'alto', thetaReal: entre(0.6, 1.8), sesiones: enteroEntre(12, 20), rindePostest: true, mejora: entre(0.4, 1.1) };
  if (i < 16) return { clave: 'medio', thetaReal: entre(-0.4, 0.6), sesiones: enteroEntre(6, 13), rindePostest: rnd() > 0.2, mejora: entre(0.2, 0.9) };
  if (i < 22) return { clave: 'bajo', thetaReal: entre(-1.8, -0.4), sesiones: enteroEntre(3, 8), rindePostest: rnd() > 0.35, mejora: entre(-0.1, 0.6) };
  // Abandonos: hacen el pretest, algo de práctica y desaparecen.
  return { clave: 'abandono', thetaReal: entre(-1.2, 0.3), sesiones: enteroEntre(1, 3), rindePostest: false, mejora: 0 };
}

/** Fecha desplazada N días (y una hora verosímil de estudio) hacia atrás desde hoy. */
function fechaHace(dias: number, hora?: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(hora ?? enteroEntre(8, 22), enteroEntre(0, 59), enteroEntre(0, 59), 0);
  return d;
}

/** Elimina TODAS las cuentas de demostración. Nunca puede tocar un usuario real. */
async function limpiar(): Promise<number> {
  // El filtro se basa EXCLUSIVAMENTE en el dominio reservado del correo, que
  // ninguna cuenta real puede tener. No se borra por nombre, grupo, institución
  // ni —bajo ningún concepto— por desempeño.
  const { count } = await prisma.usuario.deleteMany({
    where: { email: { endsWith: DOMINIO_DEMO } },
  });
  return count;
}

async function main() {
  const soloLimpiar = process.argv.includes('--limpiar');

  if (soloLimpiar) {
    const n = await limpiar();
    console.log(`[seed-demo] Eliminadas ${n} cuentas de demostración (${DOMINIO_DEMO}).`);
    return;
  }

  // ── Idempotencia: se borra lo anterior y se recrea igual (PRNG determinista) ──
  const borradas = await limpiar();
  if (borradas > 0) console.log(`[seed-demo] Recreando: se eliminaron ${borradas} cuentas demo previas.`);

  // ── Contenido necesario. El seed de contenido debe haberse corrido antes ──
  const [bancoPre, bancoPost, ejerciciosPractica, temas, cfg] = await Promise.all([
    prisma.ejercicio.findMany({ where: { banco: 'pretest' }, orderBy: { id: 'asc' } }),
    prisma.ejercicio.findMany({ where: { banco: 'postest' }, orderBy: { id: 'asc' } }),
    prisma.ejercicio.findMany({
      where: { banco: 'practica' },
      select: { id: true, xp: true, estrellas: true, nivelDificultad: true, temaId: true, dificultadB: true },
      orderBy: { id: 'asc' },
    }),
    prisma.tema.findMany({ where: { padreId: null }, orderBy: { orden: 'asc' }, select: { id: true } }),
    prisma.configuracionSistema.findFirst(),
  ]);

  if (bancoPre.length === 0 || ejerciciosPractica.length === 0) {
    console.error('[seed-demo] Falta el contenido base. Ejecuta primero: npm run seed');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD_DEMO, 10);
  const factores = {
    xpFactorIntermedio: cfg?.xpFactorIntermedio ?? 125,
    xpFactorAvanzado: cfg?.xpFactorAvanzado ?? 150,
  };
  const penalizacionPista = cfg?.penalizacionPista ?? 5;

  /** Multiplicador de XP por racha — misma tabla que `ejercicios.service.ts`. */
  const multiplicadorRacha = (dias: number) => (dias >= 14 ? 2.0 : dias >= 7 ? 1.5 : dias >= 3 ? 1.2 : 1.0);

  console.log(`[seed-demo] Creando ${TOTAL} estudiantes de demostración...`);

  for (let i = 0; i < TOTAL; i++) {
    const perfil = perfilPara(i);
    const esM = rnd() > 0.5;
    // Apellido paterno y materno DISTINTOS: "Laura Laura" delataría de inmediato
    // que los nombres se generaron al azar.
    const paterno = elegir(APELLIDOS);
    let materno = elegir(APELLIDOS);
    while (materno === paterno) materno = elegir(APELLIDOS);
    const nombre = `${elegir(esM ? NOMBRES_M : NOMBRES_F)} ${paterno} ${materno}`;
    const n3 = String(i + 1).padStart(3, '0');
    // Grupos y paralelos balanceados: ambos lados poblados para poder probar
    // las comparaciones del rol investigador.
    const grupo = i % 2 === 0 ? 'control' : 'experimental';
    const paralelo = i % 3 === 0 ? 'B' : 'A';
    const diaRegistro = 60 - Math.floor(i / 2);

    // ── 1. PRETEST: respuestas ítem por ítem ──
    // Se simula cada respuesta con la probabilidad que DICTA EL MODELO para la
    // habilidad real del estudiante y la dificultad del ítem. Así el patrón es
    // coherente con Rasch y la fiabilidad/análisis de ítems tiene sentido.
    const fechaPre = fechaHace(diaRegistro);
    const respuestasPre: RespuestaIrt[] = [];
    const detallePre: { ejercicioId: number; correcto: boolean; categoria: string }[] = [];
    for (const ej of bancoPre) {
      const b = ej.dificultadB ?? dificultadDesdeEstrellas(ej.estrellas);
      const correcto = rnd() < probabilidadAcierto(perfil.thetaReal, b);
      respuestasPre.push({ b, correcto });
      detallePre.push({ ejercicioId: ej.id, correcto, categoria: ej.categoria });
    }
    const thetaPre = redondearTheta(estimarTheta(respuestasPre));
    const nivelInicial: NivelDificultad = nivelDesdeTheta(thetaPre);
    const aciertosPre = detallePre.filter((r) => r.correcto).length;
    const puntajePre = Math.round((aciertosPre / detallePre.length) * 100);

    // Agregado por categoría, con la misma forma que produce el sistema.
    const porCategoria = (detalle: typeof detallePre) => {
      const m = new Map<string, { aciertos: number; total: number }>();
      for (const r of detalle) {
        const e = m.get(r.categoria) ?? { aciertos: 0, total: 0 };
        e.total++; if (r.correcto) e.aciertos++;
        m.set(r.categoria, e);
      }
      return [...m.entries()].map(([categoria, v]) => ({
        categoria, aciertos: v.aciertos, total: v.total,
        porcentaje: Math.round((v.aciertos / v.total) * 100),
      }));
    };

    // ── 2. POSTEST (solo algunos, a propósito) ──
    const thetaPostReal = perfil.thetaReal + perfil.mejora;
    let thetaPost: number | null = null;
    let detallePost: typeof detallePre = [];
    let puntajePost = 0;
    const fechaPost = fechaHace(Math.max(2, diaRegistro - 45));
    if (perfil.rindePostest && bancoPost.length > 0) {
      const respuestasPost: RespuestaIrt[] = [];
      for (const ej of bancoPost) {
        const b = ej.dificultadB ?? dificultadDesdeEstrellas(ej.estrellas);
        const correcto = rnd() < probabilidadAcierto(thetaPostReal, b);
        respuestasPost.push({ b, correcto });
        detallePost.push({ ejercicioId: ej.id, correcto, categoria: ej.categoria });
      }
      thetaPost = redondearTheta(estimarTheta(respuestasPost));
      puntajePost = Math.round((detallePost.filter((r) => r.correcto).length / detallePost.length) * 100);
    }

    // ── 3. PRÁCTICA: intentos escalonados en varias semanas ──
    // La habilidad crece progresivamente entre θ inicial y θ final, de modo que
    // el desempeño mejora con el tiempo en vez de ser plano.
    const intentos: Prisma.IntentoCreateManyInput[] = [];
    const historial: { theta: number; origen: string; n: number; temaId: number | null; fecha: Date }[] = [];
    let xpTotal = 0;
    let rachaMax = 0;
    const temasTocados = new Map<number, NivelDificultad>();

    let diaActual = diaRegistro - 2;
    let rachaActual = 0;
    let ultimoDia = -999;

    for (let s = 0; s < perfil.sesiones; s++) {
      // Sesiones repartidas: entre 1 y 5 días de separación → no todas el mismo
      // día ni a la misma hora.
      diaActual -= enteroEntre(1, 5);
      if (diaActual < 1) break;
      rachaActual = ultimoDia - diaActual === 1 ? rachaActual + 1 : 1;
      ultimoDia = diaActual;
      rachaMax = Math.max(rachaMax, rachaActual);

      const avance = perfil.sesiones > 1 ? s / (perfil.sesiones - 1) : 1;
      const thetaMomento = perfil.thetaReal + perfil.mejora * avance;
      const porSesion = enteroEntre(2, 6);

      for (let k = 0; k < porSesion; k++) {
        const ej = elegir(ejerciciosPractica);
        const b = ej.dificultadB ?? dificultadDesdeEstrellas(ej.estrellas);
        const correcto = rnd() < probabilidadAcierto(thetaMomento, b);
        const pistas = correcto ? (rnd() < 0.25 ? enteroEntre(1, 2) : 0) : enteroEntre(0, 3);
        const tiempoSeg = enteroEntre(45, 420);
        const fecha = fechaHace(diaActual);

        intentos.push({
          usuarioId: 0, // se corrige tras crear el usuario
          ejercicioId: ej.id, correcto, tiempoSeg, pistasUsadas: pistas,
          respuestaDada: correcto ? 'ok' : 'x', fecha,
        });

        if (correcto) {
          // XP con la MISMA fórmula del sistema (ejercicios.service.ts):
          // base − penalización por pistas, escalado por el nivel del ejercicio
          // y multiplicado por la racha.
          const penal = penalizacionPista * pistas;
          const xpBase = Math.max(5, Math.round((ej.xp - penal) * factorXpNivel(ej.nivelDificultad, factores)));
          xpTotal += Math.round(xpBase * multiplicadorRacha(rachaActual));
        }
        if (ej.temaId && !temasTocados.has(ej.temaId)) temasTocados.set(ej.temaId, nivelInicial);
      }

      // Re-estimación de θ tras la sesión (origen 'practica'), como hace el sistema.
      if (s % 3 === 2) {
        historial.push({
          theta: redondearTheta(thetaMomento), origen: 'practica',
          n: porSesion, temaId: null, fecha: fechaHace(diaActual),
        });
      }
    }

    // ── 4. Crear el usuario con todo su rastro ──
    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        email: `demo.${n3}${DOMINIO_DEMO}`,
        cedula: `DEMO${n3}${enteroEntre(1000, 9999)}`,
        carrera: 'Ingeniería de Sistemas',
        passwordHash,
        rol: 'estudiante',
        // CANDADO 1: la institución marca el registro como sintético.
        institucion: INSTITUCION_DEMO,
        paralelo,
        semestre: 1,
        grupo,
        nivelInicial: 1,
        nivelInicialAdaptativo: nivelInicial,
        thetaInicial: thetaPre,
        thetaActual: thetaPost ?? thetaPre,
        thetaFinal: thetaPost,
        pretestCompletado: true,
        introduccionCompletada: true,
        creadoEn: fechaHace(diaRegistro + 1),
        consentimientoEn: fechaHace(diaRegistro + 1),
        consentimientoVersion: '2026-08-v1',
        ranking: {
          create: {
            xpTotal,
            rachaDias: rachaMax,
            ultimaActividad: fechaHace(Math.max(1, diaActual)),
          },
        },
      },
    });

    // Evaluación agregada + respuestas ítem por ítem (necesarias para KR-20 y
    // el análisis de ítems: sin ellas la fiabilidad no se puede calcular).
    await prisma.evaluacion.create({
      data: {
        usuarioId: usuario.id, tipo: 'pre', puntajeTotal: puntajePre,
        tiempoSeg: enteroEntre(600, 2400), porCategoria: porCategoria(detallePre),
        fecha: fechaPre,
      },
    });
    await prisma.pretestRespuesta.createMany({
      data: detallePre.map((r) => ({
        usuarioId: usuario.id, ejercicioId: r.ejercicioId, tipo: 'pre' as const,
        opcionDada: r.correcto ? 'a' : 'b', correcto: r.correcto,
        categoria: r.categoria, fecha: fechaPre,
      })),
    });

    if (thetaPost !== null) {
      await prisma.evaluacion.create({
        data: {
          usuarioId: usuario.id, tipo: 'post', puntajeTotal: puntajePost,
          tiempoSeg: enteroEntre(600, 2400), porCategoria: porCategoria(detallePost),
          fecha: fechaPost,
        },
      });
      await prisma.pretestRespuesta.createMany({
        data: detallePost.map((r) => ({
          usuarioId: usuario.id, ejercicioId: r.ejercicioId, tipo: 'post' as const,
          opcionDada: r.correcto ? 'a' : 'b', correcto: r.correcto,
          categoria: r.categoria, fecha: fechaPost,
        })),
      });
    }

    if (intentos.length > 0) {
      await prisma.intento.createMany({
        data: intentos.map((it) => ({ ...it, usuarioId: usuario.id })),
      });
    }

    // ── 5. Progreso por tema y subidas de nivel ──
    const temasDelUsuario = [...temasTocados.keys()].slice(0, 6);
    for (const temaId of temasDelUsuario) {
      // Los mejores llegan a subir de nivel en algunos temas.
      const sube = perfil.clave === 'alto' ? rnd() < 0.6 : perfil.clave === 'medio' ? rnd() < 0.25 : false;
      const nivelActual: NivelDificultad = sube
        ? (nivelInicial === 'basico' ? 'intermedio' : 'avanzado')
        : nivelInicial;

      await prisma.progresoTema.create({
        data: {
          usuarioId: usuario.id, temaId, nivelActual, desbloqueado: true,
          ejerciciosCompletados: enteroEntre(1, 8),
          actualizadoEn: fechaHace(Math.max(1, diaActual)),
        },
      });

      // Mini-diagnóstico de subida de nivel: se registran APROBADOS y NO
      // aprobados, para que el dato refleje intentos fallidos como en la realidad.
      if (perfil.clave === 'alto' || perfil.clave === 'medio') {
        if (rnd() < 0.5) {
          const aprobado = sube;
          const fecha = fechaHace(Math.max(2, diaActual + enteroEntre(1, 10)));
          await prisma.intentoSubidaNivel.create({
            data: {
              usuarioId: usuario.id, temaId,
              desde: nivelInicial, hacia: nivelActual,
              // El umbral real de aprobación de la subida de nivel es 80 %:
              // los aprobados quedan por encima y los fallidos por debajo.
              puntaje: aprobado ? enteroEntre(80, 100) : enteroEntre(40, 79),
              aprobado, fecha,
            },
          });
          historial.push({
            theta: redondearTheta(perfil.thetaReal + perfil.mejora * 0.6),
            origen: 'subir_nivel', n: 5, temaId, fecha,
          });
        }
      }
    }

    // ── 6. Historial de θ (pretest → práctica → subir_nivel → postest) ──
    const puntos = [
      { theta: thetaPre, origen: 'pretest', n: detallePre.length, temaId: null, fecha: fechaPre },
      ...historial,
      ...(thetaPost !== null
        ? [{ theta: thetaPost, origen: 'postest', n: detallePost.length, temaId: null, fecha: fechaPost }]
        : []),
    ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    await prisma.historialTheta.createMany({
      data: puntos.map((p) => ({
        usuarioId: usuario.id, theta: p.theta, origen: p.origen,
        n: p.n, temaId: p.temaId, fecha: p.fecha,
      })),
    });
  }

  // ── Resumen ──
  const creados = await prisma.usuario.findMany({
    where: { email: { endsWith: DOMINIO_DEMO } },
    select: { grupo: true, thetaFinal: true, nivelInicialAdaptativo: true },
  });
  const conPostest = creados.filter((u) => u.thetaFinal !== null).length;
  const porNivel = creados.reduce<Record<string, number>>((acc, u) => {
    const k = u.nivelInicialAdaptativo ?? 'sin nivel';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`[seed-demo] Listo: ${creados.length} estudiantes de demostración.`);
  console.log(`[seed-demo]   control: ${creados.filter((u) => u.grupo === 'control').length} · experimental: ${creados.filter((u) => u.grupo === 'experimental').length}`);
  console.log(`[seed-demo]   con postest: ${conPostest} · sin postest (datos faltantes a propósito): ${creados.length - conPostest}`);
  console.log(`[seed-demo]   nivel inicial: ${JSON.stringify(porNivel)}`);
  console.log(`[seed-demo]   correo: demo.NNN${DOMINIO_DEMO} · contraseña: ${PASSWORD_DEMO}`);
  console.log('[seed-demo] EXCLUIDOS de todos los cálculos del estudio (ver los 3 candados en el encabezado).');
}

main()
  .catch((e) => { console.error('[seed-demo] Error:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
