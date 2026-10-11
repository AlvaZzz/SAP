/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  SEED DE DEMOSTRACIÓN — 25 estudiantes SINTÉTICOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ SON ESTOS DATOS
 *  Estudiantes ficticios con actividad simulada. Existen para poblar el
 *  prototipo, verificar que el sistema calcula y grafica bien, tomar capturas y
 *  demostrarlo funcionando sin necesitar participantes reales.
 *
 *  QUÉ NO SON
 *  NO son participantes de la investigación. No pueden aparecer en el dataset
 *  del estudio ni en ningún resultado de la tesis. Si alguna captura se usa en
 *  el documento, debe rotularse como "entorno de demostración".
 *
 *  ── LOS TRES CANDADOS QUE MANTIENEN LA SEPARACIÓN ──────────────────────────
 *
 *  1. IDENTIFICACIÓN EN EL PROPIO DATO — correo `@demo.prexi.local` (dominio
 *     reservado, no enrutable) e `institucion = 'DEMO'`.
 *  2. EXCLUSIÓN EN EL ORIGEN — `SOLO_ESTUDIANTES_DEL_ESTUDIO` los descarta en
 *     `investigador-exportacion.service.ts`, la fuente única de verdad del
 *     estudio, así que quedan fuera de TODAS las pantallas de una sola vez.
 *  3. VISIBILIDAD EXPLÍCITA — el Panel del investigador avisa mientras existan
 *     cuentas demo en la base. Nada oculto.
 *
 *  ── CÓMO SE GENERA LA ACTIVIDAD (lo importante) ────────────────────────────
 *
 *  NO se escriben filas de estado derivado a mano. La primera versión de este
 *  seed lo hacía y el resultado fue un sistema a medio llenar: "Progreso por
 *  nivel" en 0/12 para estudiantes con 24 ejercicios resueltos, todos en rango
 *  Aprendiz, emblemas sin desbloquear — porque `ProgresoNivel`,
 *  `DesempenoUnidad` y `LogroUsuario` los calculan los SERVICIOS, y nadie los
 *  estaba llamando.
 *
 *  Ahora el seed levanta un contexto de aplicación de NestJS y simula a cada
 *  estudiante RESPONDIENDO DE VERDAD a través de los servicios reales
 *  (`PretestService`, `EjerciciosService`, `AdaptatividadService`,
 *  `ExamenUnidadService`, `PracticaService`, `RangosService`…). Cada llamada
 *  actualiza por sí sola todo el estado derivado, exactamente como lo haría un
 *  estudiante real. De paso, el seed se vuelve una prueba de integración: si un
 *  servicio se rompe, el seed falla en vez de producir datos plausibles pero
 *  inconsistentes.
 *
 *  ── ORDEN CAUSAL DE LAS FECHAS ─────────────────────────────────────────────
 *
 *  Los servicios sellan `new Date()`, así que toda la simulación ocurre "hoy".
 *  Para que la actividad parezca repartida en semanas se usa un CRONOGRAMA
 *  PLANIFICADO POR ADELANTADO: antes de simular se decide la fecha de cada
 *  evento en el orden correcto (pretest → práctica → subida de nivel → examen →
 *  postest), se simula, y después cada fila creada se sella con la fecha que ya
 *  tenía asignada. No se infiere nada a posteriori.
 *
 *  Al final, `verificarLineaDeTiempo()` recorre a cada estudiante y REVIENTA si
 *  encuentra una incoherencia (postest antes del pretest, intento antes del
 *  pretest, subida de nivel antes del primer intento del tema, examen después
 *  del postest). Preferimos que el seed falle a que deje datos que se ven bien
 *  pero rompen los cálculos de evolución.
 *
 *  ── USO ────────────────────────────────────────────────────────────────────
 *
 *     npm run seed:demo              → crea (o recrea) los 25 estudiantes
 *     npm run seed:demo -- --limpiar → elimina SOLO las cuentas demo
 *
 *  Idempotente · manual (nunca corre al arrancar) · contraseña de todas las
 *  cuentas: `Prexi123*`.
 *
 *  SOBRE EL DETERMINISMO: el PRNG tiene semilla fija, así que los perfiles,
 *  nombres, grupos, paralelos y el cronograma se reproducen igual en cada
 *  corrida. Los RESULTADOS no son idénticos entre ejecuciones, y no es un
 *  descuido: los propios servicios seleccionan las preguntas del pretest, del
 *  mini-diagnóstico y del examen con `ORDER BY random()`. Al ejercitar la
 *  lógica real —que es lo que se pidió— se hereda su aleatoriedad. Es el precio
 *  correcto: mejor un seed fiel al sistema que uno reproducible al dígito pero
 *  que simula un comportamiento que el sistema no tiene.
 *
 *  ⚠️ NO ejecutar contra producción con participantes reales sin consultarlo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { PrismaClient, NivelDificultad } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { PretestService } from '../src/mediciones/pretest/pretest.service';
import { PostestService } from '../src/mediciones/postest/postest.service';
import { EjerciciosController } from '../src/ejercicios/ejercicios.controller';
import { AdaptatividadService } from '../src/ejercicios/adaptatividad.service';
import { ExamenUnidadService } from '../src/modulos/examen-unidad/examen-unidad.service';
import { PracticaService } from '../src/modulos/practica/practica.service';
import { RangosService } from '../src/gamificacion/rangos.service';
import { RetosController } from '../src/modulos/retos/retos.controller';
import { DocenteRevisionesService } from '../src/docente/docente-revisiones/docente-revisiones.service';
import { probabilidadAcierto, dificultadDesdeEstrellas } from '../src/mediciones/irt/irt';

// ── Marcas de identificación (candado 1) ───────────────────────────────────
const DOMINIO_DEMO = '@demo.prexi.local';
const INSTITUCION_DEMO = 'DEMO';
const PASSWORD_DEMO = 'Prexi123*';
const TOTAL = 25;

/** Ventana temporal de la actividad simulada. */
const SEMANAS = 8;
const DIA_MS = 86_400_000;

// ── PRNG determinista (mulberry32) ─────────────────────────────────────────
function crearRng(semilla: number) {
  let a = semilla;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rnd = crearRng(20260807);
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

type ClavePerfil = 'alto' | 'medio' | 'bajo' | 'abandono';

interface Perfil {
  clave: ClavePerfil;
  /** θ "verdadera": de ella se simula cada respuesta según el modelo de Rasch. */
  thetaReal: number;
  mejora: number;
  sesiones: number;
  rindePostest: boolean;
  /** ¿Tiene actividad en los últimos 7 días? (ventana del gráfico del docente) */
  activoReciente: boolean;
  intentaSubirNivel: boolean;
  rindeExamen: boolean;
  entregaRetos: number;
  consultasIa: number;
}

/**
 * Reparto DELIBERADAMENTE DESIGUAL de perfiles: un curso donde todos progresan
 * parejo no sirve para probar nada y se nota artificial de inmediato. Hay
 * estudiantes intensos, medios, flojos y dos que abandonaron a mitad.
 */
function perfilPara(i: number): Perfil {
  // Los tres primeros son usuarios INTENSIVOS: hacen suficientes ejercicios
  // para completar la Unidad 1 (requiere ~80 aciertos repartidos en sus 8
  // temas) y así el seed ejercita también el desbloqueo de unidad
  // (`UnidadCompletada`), que con un uso moderado no se alcanza nunca.
  if (i < 3) {
    return {
      clave: 'alto', thetaReal: entre(1.0, 1.9), mejora: entre(0.4, 1.0),
      sesiones: enteroEntre(28, 34), rindePostest: true, activoReciente: true,
      intentaSubirNivel: true, rindeExamen: true,
      entregaRetos: enteroEntre(3, 5), consultasIa: enteroEntre(6, 14),
    };
  }
  if (i < 6) {
    return {
      clave: 'alto', thetaReal: entre(0.6, 1.8), mejora: entre(0.4, 1.1),
      sesiones: enteroEntre(10, 16), rindePostest: true, activoReciente: true,
      intentaSubirNivel: true, rindeExamen: true,
      entregaRetos: enteroEntre(2, 4), consultasIa: enteroEntre(4, 12),
    };
  }
  if (i < 16) {
    return {
      clave: 'medio', thetaReal: entre(-0.4, 0.6), mejora: entre(0.2, 0.9),
      sesiones: enteroEntre(5, 10), rindePostest: rnd() > 0.2, activoReciente: rnd() > 0.35,
      intentaSubirNivel: rnd() > 0.4, rindeExamen: rnd() > 0.3,
      entregaRetos: enteroEntre(0, 2), consultasIa: enteroEntre(2, 9),
    };
  }
  if (i < 23) {
    return {
      clave: 'bajo', thetaReal: entre(-1.8, -0.4), mejora: entre(-0.1, 0.6),
      sesiones: enteroEntre(2, 6), rindePostest: rnd() > 0.4, activoReciente: rnd() > 0.6,
      intentaSubirNivel: false, rindeExamen: rnd() > 0.7,
      entregaRetos: enteroEntre(0, 1), consultasIa: enteroEntre(3, 14),
    };
  }
  // Abandonos: pretest, un poco de práctica y desaparecen.
  return {
    clave: 'abandono', thetaReal: entre(-1.2, 0.3), mejora: 0,
    sesiones: enteroEntre(1, 3), rindePostest: false, activoReciente: false,
    intentaSubirNivel: false, rindeExamen: false, entregaRetos: 0, consultasIa: enteroEntre(0, 3),
  };
}

/**
 * CRONOGRAMA: todas las fechas del estudiante decididas ANTES de simular, ya en
 * orden causal. Después, cada fila creada se sella con la fecha que le toca.
 * Planificar primero y sellar después evita tener que inferir fechas a
 * posteriori, que es donde se cuelan las incoherencias.
 */
interface Cronograma {
  pretest: Date;
  /** Una fecha por sesión de práctica, ascendente. */
  sesiones: Date[];
  subidasNivel: Date[];
  repaso: Date | null;
  examen: Date | null;
  retos: Date[];
  consultas: Date[];
  postest: Date | null;
}

/** Hora de estudio verosímil: tarde/noche entre semana, más dispersa en fin de semana. */
function conHoraDeEstudio(d: Date): Date {
  const finDeSemana = d.getDay() === 0 || d.getDay() === 6;
  const hora = finDeSemana ? enteroEntre(10, 22) : enteroEntre(15, 23);
  const r = new Date(d);
  r.setHours(hora, enteroEntre(0, 59), enteroEntre(0, 59), 0);
  return r;
}

function construirCronograma(perfil: Perfil): Cronograma {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const diaBase = (diasAtras: number) => conHoraDeEstudio(new Date(hoy.getTime() - diasAtras * DIA_MS));

  // El pretest abre la ventana; el resto ocurre después, nunca antes.
  const inicio = SEMANAS * 7 - enteroEntre(0, 6);
  const pretest = diaBase(inicio);

  // Sesiones repartidas entre el pretest y el presente, con más densidad entre
  // semana. Quien está "activo reciente" llega hasta los últimos días.
  // El fin de la ventana marca hasta dónde llega el estudiante: quien sigue
  // activo tiene sesiones en los últimos días (es la ventana que consulta el
  // gráfico "Actividad (7 días)" del docente); quien abandonó, no.
  const finVentana = perfil.activoReciente ? enteroEntre(0, 4) : enteroEntre(12, 30);

  // Las sesiones se REPARTEN por toda la ventana en vez de avanzar con un paso
  // fijo: con paso fijo, un estudiante de pocas sesiones agotaba su cupo a mitad
  // de camino y nunca alcanzaba los días recientes, dejando el gráfico vacío.
  const sesiones: Date[] = [];
  // La práctica arranca al día SIGUIENTE del pretest como muy pronto: si una
  // sesión cayera el mismo día, la hora aleatoria podría situarla antes del
  // diagnóstico y romper el orden causal (lo detectó la verificación final).
  const arranque = inicio - 1;
  // Se divide entre (n − 1) y no entre n: con n el último tramo sobra y la
  // sesión final se quedaba a un tramo del presente, dejando sin actividad
  // reciente incluso a los estudiantes marcados como activos.
  const tramo = Math.max(1, (arranque - finVentana) / Math.max(1, perfil.sesiones - 1));
  for (let s = 0; s < perfil.sesiones; s++) {
    let dia = Math.round(arranque - s * tramo - entre(0, tramo * 0.6));
    if (dia < finVentana) dia = finVentana;
    if (dia > arranque) dia = arranque;
    const fecha = new Date(hoy.getTime() - dia * DIA_MS);
    // Menos probable estudiar en fin de semana: se corre un día.
    if ((fecha.getDay() === 0 || fecha.getDay() === 6) && rnd() < 0.6) dia = Math.max(finVentana, dia - 1);
    sesiones.push(diaBase(dia));
  }
  sesiones.sort((a, b) => a.getTime() - b.getTime());

  const ultimaSesion = sesiones.length ? sesiones[sesiones.length - 1] : pretest;
  const diasUltimaSesion = Math.round((hoy.getTime() - ultimaSesion.getTime()) / DIA_MS);

  // Las subidas de nivel ocurren DESPUÉS de haber practicado: se colocan sobre
  // sesiones ya transcurridas (nunca antes del primer intento del tema).
  const subidasNivel: Date[] = [];
  if (perfil.intentaSubirNivel && sesiones.length >= 3) {
    const cuantas = enteroEntre(1, 3);
    for (let k = 0; k < cuantas; k++) {
      const idx = Math.min(sesiones.length - 1, 2 + enteroEntre(0, sesiones.length - 3));
      const base = sesiones[idx];
      subidasNivel.push(new Date(base.getTime() + enteroEntre(1, 6) * 3600_000));
    }
    subidasNivel.sort((a, b) => a.getTime() - b.getTime());
  }

  // Repaso y examen, hacia el final del recorrido.
  const repaso = perfil.rindeExamen && sesiones.length >= 2
    ? diaBase(Math.max(diasUltimaSesion + 1, enteroEntre(3, 10)))
    : null;
  const examen = repaso ? new Date(repaso.getTime() + enteroEntre(2, 26) * 3600_000) : null;

  // Retos y consultas a PREXI, repartidos sobre las sesiones existentes.
  const sobreSesion = () => (sesiones.length
    ? new Date(elegir(sesiones).getTime() + enteroEntre(1, 5) * 3600_000)
    : new Date(pretest.getTime() + 3600_000));
  const retos = Array.from({ length: perfil.entregaRetos }, sobreSesion).sort((a, b) => a.getTime() - b.getTime());
  const consultas = Array.from({ length: perfil.consultasIa }, sobreSesion).sort((a, b) => a.getTime() - b.getTime());

  // El postest cierra: siempre después de todo lo anterior.
  const candidatosFin = [
    ultimaSesion.getTime(),
    ...(examen ? [examen.getTime()] : []),
    ...subidasNivel.map((d) => d.getTime()),
  ];
  const postest = perfil.rindePostest
    ? new Date(Math.max(...candidatosFin) + enteroEntre(12, 72) * 3600_000)
    : null;

  return { pretest, sesiones, subidasNivel, repaso, examen, retos, consultas, postest };
}

// ── Utilidades de sellado de fechas ────────────────────────────────────────

/**
 * Reescribe la fecha de las filas recién creadas. Los servicios sellan `now()`,
 * así que después de simular se sustituye por la fecha PLANIFICADA. Se hace por
 * SQL directo porque algunos campos son `@default(now())` y Prisma no siempre
 * permite fijarlos en el update del modelo.
 */
async function sellarFechas(
  prisma: PrismaClient, tabla: string, columna: string,
  ids: number[], fecha: Date,
) {
  if (ids.length === 0) return;
  await prisma.$executeRawUnsafe(
    `UPDATE ${tabla} SET ${columna} = $1 WHERE id = ANY($2::int[])`,
    fecha, ids,
  );
}

/**
 * Sella una tanda ESPACIÁNDOLA en el tiempo: cada fila queda unos minutos
 * después de la anterior, dentro de la misma sesión.
 *
 * Importa más de lo que parece. Si todos los intentos de una sesión comparten
 * la misma marca de tiempo, no hay huecos entre eventos y el tiempo estimado en
 * plataforma sale 0 para todo el mundo — la métrica se ve rota aunque el
 * cálculo sea correcto. Un estudiante real tarda minutos entre un ejercicio y
 * el siguiente, y así debe reflejarlo el dato.
 */
async function sellarTanda(
  prisma: PrismaClient, tabla: string, columna: string,
  ids: number[], inicio: Date, minutosPorPaso: () => number,
) {
  let t = inicio.getTime();
  for (const id of ids) {
    await prisma.$executeRawUnsafe(
      `UPDATE ${tabla} SET ${columna} = $1 WHERE id = $2`,
      new Date(t), id,
    );
    t += minutosPorPaso() * 60_000;
  }
}

/** Elimina TODAS las cuentas de demostración. Nunca puede tocar un usuario real. */
async function limpiar(prisma: PrismaClient): Promise<number> {
  // Filtro basado EXCLUSIVAMENTE en el dominio reservado del correo, que ninguna
  // cuenta real puede tener. Nunca se borra por nombre, grupo ni desempeño.
  const { count } = await prisma.usuario.deleteMany({
    where: { email: { endsWith: DOMINIO_DEMO } },
  });
  return count;
}

/**
 * VERIFICACIÓN DE LA LÍNEA DE TIEMPO — el seed revienta si algo quedó al revés.
 *
 * Una fecha incoherente (un postest anterior al pretest) no solo delata el
 * origen sintético: rompe los cálculos de evolución y produce resultados que
 * parecen válidos. Preferimos fallar ruidosamente.
 */
async function verificarLineaDeTiempo(prisma: PrismaClient): Promise<void> {
  const errores: string[] = [];

  const estudiantes = await prisma.usuario.findMany({
    where: { email: { endsWith: DOMINIO_DEMO } },
    select: {
      id: true, email: true,
      evaluaciones: { select: { tipo: true, fecha: true } },
      intentos: { select: { fecha: true }, orderBy: { fecha: 'asc' } },
      intentosSubidaNivel: { select: { temaId: true, fecha: true } },
      examenesUnidad: { select: { fecha: true } },
    },
  });

  for (const u of estudiantes) {
    const pre = u.evaluaciones.find((e) => e.tipo === 'pre')?.fecha ?? null;
    const post = u.evaluaciones.find((e) => e.tipo === 'post')?.fecha ?? null;

    if (!pre) { errores.push(`${u.email}: no tiene pretest`); continue; }

    if (post && post < pre) {
      errores.push(`${u.email}: POSTEST (${post.toISOString()}) anterior al PRETEST (${pre.toISOString()})`);
    }

    const primerIntento = u.intentos[0]?.fecha ?? null;
    if (primerIntento && primerIntento < pre) {
      errores.push(`${u.email}: primer INTENTO (${primerIntento.toISOString()}) anterior al PRETEST`);
    }

    for (const s of u.intentosSubidaNivel) {
      if (!primerIntento || s.fecha < primerIntento) {
        errores.push(`${u.email}: SUBIDA DE NIVEL (tema ${s.temaId}) anterior al primer intento`);
      }
    }

    if (post) {
      for (const e of u.examenesUnidad) {
        if (e.fecha > post) {
          errores.push(`${u.email}: EXAMEN DE UNIDAD (${e.fecha.toISOString()}) posterior al POSTEST`);
        }
      }
    }
  }

  if (errores.length > 0) {
    console.error('\n[seed-demo] ✗ LÍNEA DE TIEMPO INCOHERENTE:');
    for (const e of errores.slice(0, 20)) console.error(`  · ${e}`);
    if (errores.length > 20) console.error(`  … y ${errores.length - 20} más`);
    throw new Error(`Línea de tiempo incoherente en ${errores.length} caso(s). Los datos NO son utilizables.`);
  }
  console.log(`[seed-demo] ✓ Línea de tiempo coherente en los ${estudiantes.length} estudiantes.`);
}

// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const soloLimpiar = process.argv.includes('--limpiar');

  // Silencia el ruido de arranque de Nest: interesa la salida del seed.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService) as unknown as PrismaClient;

  try {
    if (soloLimpiar) {
      const n = await limpiar(prisma);
      console.log(`[seed-demo] Eliminadas ${n} cuentas de demostración (${DOMINIO_DEMO}).`);
      return;
    }

    const pretestSvc = app.get(PretestService);
    const postestSvc = app.get(PostestService);
    const ejerciciosCtrl = app.get(EjerciciosController);
    const adaptatividadSvc = app.get(AdaptatividadService);
    const examenSvc = app.get(ExamenUnidadService);
    const practicaSvc = app.get(PracticaService);
    const rangosSvc = app.get(RangosService);
    const retosCtrl = app.get(RetosController);
    const revisionesSvc = app.get(DocenteRevisionesService);

    // Idempotencia: se borra lo anterior y se recrea igual (PRNG determinista).
    rnd = crearRng(20260807);
    const borradas = await limpiar(prisma);
    if (borradas > 0) console.log(`[seed-demo] Recreando: se eliminaron ${borradas} cuentas demo previas.`);

    // ── Contenido base ──
    const [bancoPretestExiste, ejerciciosPractica, unidades, retosActivos, docente] = await Promise.all([
      prisma.ejercicio.findMany({ where: { banco: 'pretest' }, orderBy: { id: 'asc' } }),
      prisma.ejercicio.findMany({
        where: { banco: 'practica' },
        select: { id: true, estrellas: true, dificultadB: true, respuestaCorrecta: true, temaId: true, nivelDificultad: true },
        orderBy: { id: 'asc' },
      }),
      prisma.unidad.findMany({ orderBy: { orden: 'asc' }, select: { id: true, numero: true } }),
      prisma.reto.findMany({ where: { activo: true }, select: { id: true, autorId: true }, orderBy: { id: 'asc' } }),
      prisma.usuario.findFirst({ where: { rol: 'docente' }, select: { id: true } }),
    ]);

    if (bancoPretestExiste.length === 0 || ejerciciosPractica.length === 0) {
      console.error('[seed-demo] Falta el contenido base. Ejecuta primero: npm run seed');
      process.exitCode = 1;
      return;
    }

    // Temas en el ORDEN del temario: el estudiante los recorre en secuencia,
    // igual que en la aplicación (no puede saltar a un tema bloqueado).
    const temasOrdenados = (await prisma.tema.findMany({
      where: { padreId: null, ejercicios: { some: { banco: 'practica' } } },
      orderBy: [{ unidad: { orden: 'asc' } }, { orden: 'asc' }],
      select: { id: true },
    })).map((t) => t.id);

    // Claves de los ejercicios de práctica: solo para SIMULAR la respuesta.
    const clavesPractica = new Map(ejerciciosPractica.map((e) => [e.id, e]));

    // El postest está controlado por el docente (PostestControl). Se habilita
    // globalmente para poder simularlo, igual que haría el docente antes de
    // aplicarlo a su curso.
    // Se habilita POR PARALELO (así lo modela el sistema), solo en los dos que
    // usan las cuentas demo.
    for (const paralelo of ['A', 'B']) {
      await prisma.postestControl.upsert({
        where: { paralelo },
        create: { paralelo, habilitado: true, habilitadoEn: new Date() },
        update: { habilitado: true, habilitadoEn: new Date() },
      });
    }

    const passwordHash = await bcrypt.hash(PASSWORD_DEMO, 10);
    console.log(`[seed-demo] Creando ${TOTAL} estudiantes y simulando su actividad por los servicios reales...`);

    let totalIntentos = 0;

    for (let i = 0; i < TOTAL; i++) {
      const perfil = perfilPara(i);
      const crono = construirCronograma(perfil);

      const esM = rnd() > 0.5;
      const paterno = elegir(APELLIDOS);
      let materno = elegir(APELLIDOS);
      while (materno === paterno) materno = elegir(APELLIDOS);
      const nombre = `${elegir(esM ? NOMBRES_M : NOMBRES_F)} ${paterno} ${materno}`;
      const n3 = String(i + 1).padStart(3, '0');

      const usuario = await prisma.usuario.create({
        data: {
          nombre,
          email: `demo.${n3}${DOMINIO_DEMO}`,
          cedula: `DEMO${n3}${enteroEntre(1000, 9999)}`,
          carrera: 'Ingeniería de Sistemas',
          passwordHash,
          rol: 'estudiante',
          institucion: INSTITUCION_DEMO,        // candado 1
          paralelo: i % 3 === 0 ? 'B' : 'A',
          semestre: 1,
          introduccionCompletada: true,
          creadoEn: new Date(crono.pretest.getTime() - DIA_MS),
          consentimientoEn: new Date(crono.pretest.getTime() - DIA_MS),
          consentimientoVersion: '2026-10-v2',
        },
      });

      // ── 1. PRETEST por el servicio real ──
      // El diagnóstico es POR TEMA: el propio servicio decide qué ítems le
      // tocan a cada estudiante (`preguntas()` los fija en PretestRespuesta) y
      // `responder()` rechaza cualquier pregunta ajena a ese conjunto. Por eso
      // se pide primero el cuestionario y solo después se responde: es el mismo
      // camino que recorre un estudiante real.
      const cuestionario = await pretestSvc.preguntas(usuario.id);
      // Las claves no vienen en `preguntas()` —es un examen— así que se
      // consultan aparte solo para poder SIMULAR la respuesta.
      const claves = new Map(
        (await prisma.ejercicio.findMany({
          where: { id: { in: cuestionario.map((q) => q.id) } },
          select: { id: true, respuestaCorrecta: true, estrellas: true, dificultadB: true },
        })).map((e) => [e.id, e]),
      );

      for (const q of cuestionario) {
        const ej = claves.get(q.id);
        if (!ej) continue;
        // Cada respuesta se simula con la probabilidad que DICTA EL MODELO de
        // Rasch para la habilidad real del estudiante y la dificultad del ítem:
        // así el patrón es internamente coherente y el análisis de fiabilidad
        // del rol investigador tiene sentido.
        const b = ej.dificultadB ?? dificultadDesdeEstrellas(ej.estrellas);
        const acierta = rnd() < probabilidadAcierto(perfil.thetaReal, b);
        const opcion = acierta
          ? ej.respuestaCorrecta
          : (ej.respuestaCorrecta.trim().toUpperCase() === 'A' ? 'B' : 'A');
        await pretestSvc.responder(usuario.id, q.id, opcion);
      }
      await pretestSvc.finalizar(usuario.id, enteroEntre(600, 2400));

      // Sella el pretest y sus respuestas con la fecha planificada.
      await prisma.$executeRawUnsafe(
        `UPDATE pretest_postest SET fecha = $1 WHERE usuario_id = $2 AND tipo = 'pre'`,
        crono.pretest, usuario.id,
      );
      await prisma.$executeRawUnsafe(
        `UPDATE pretest_respuestas SET fecha = $1 WHERE usuario_id = $2 AND tipo = 'pre'`,
        crono.pretest, usuario.id,
      );
      // Ojo: esta tabla sella la fecha en `creado_en`, no en `fecha`.
      await prisma.$executeRawUnsafe(
        `UPDATE diagnostico_temas SET creado_en = $1 WHERE usuario_id = $2`,
        crono.pretest, usuario.id,
      );
      await prisma.$executeRawUnsafe(
        `UPDATE historial_theta SET fecha = $1 WHERE usuario_id = $2 AND origen = 'pretest'`,
        crono.pretest, usuario.id,
      );

      // ── 2. PRÁCTICA por el servicio real ──
      // `EjerciciosService.responder()` actualiza de una sola vez: Intento,
      // ProgresoNivel, ProgresoTema, XP, Ranking, PasoRuta, emblemas y el
      // desbloqueo de unidades. Es justo lo que la versión anterior del seed no
      // hacía y por eso el sistema se veía a medio llenar.
      // El estudiante avanza por el temario EN ORDEN, como en la aplicación
      // real: no puede saltar a un tema bloqueado. `ruta()` le entrega los
      // ejercicios de su tema actual ya ordenados por máxima información (IRT),
      // que es exactamente lo que ve en pantalla.
      let idxTema = 0;

      for (const fechaSesion of crono.sesiones) {
        const avance = crono.sesiones.length > 1
          ? crono.sesiones.indexOf(fechaSesion) / (crono.sesiones.length - 1)
          : 1;
        const thetaMomento = perfil.thetaReal + perfil.mejora * avance;
        // Los usuarios intensivos resuelven tandas más largas por sesión.
        const cuantos = perfil.sesiones > 20 ? enteroEntre(4, 9) : enteroEntre(2, 6);
        const idsSesion: number[] = [];
        let bloqueado = false;

        for (let k = 0; k < cuantos && idxTema < temasOrdenados.length; k++) {
          const temaId = temasOrdenados[idxTema];
          const ruta = await adaptatividadSvc.ruta(usuario.id, { temaId });
          const pendientes = ruta.ejercicios.slice(0, ruta.pendientes);
          if (pendientes.length === 0) { idxTema++; k--; continue; } // tema agotado

          const q = pendientes[0];
          const meta = clavesPractica.get(q.id);
          if (!meta) { idxTema++; continue; }

          const b = meta.dificultadB ?? dificultadDesdeEstrellas(meta.estrellas);
          const acierta = rnd() < probabilidadAcierto(thetaMomento, b);
          const respuesta = acierta ? meta.respuestaCorrecta : `${meta.respuestaCorrecta}_incorrecta`;

          try {
            // Se pasa por el CONTROLADOR y no por el servicio porque el registro
            // de `PasoRuta` —la evidencia de la ruta adaptativa que expone el rol
            // investigador— vive en el controlador, no en `responder()`.
            await ejerciciosCtrl.responder(usuario.id, {
              ejercicioId: q.id,
              respuestaDada: respuesta,
              tiempoSeg: enteroEntre(45, 420),
              pistasUsadas: acierta ? (rnd() < 0.25 ? enteroEntre(1, 2) : 0) : enteroEntre(0, 3),
            });
            totalIntentos++;
          } catch {
            // El sistema rechaza el intento por una regla REAL (nivel, tema o
            // unidad bloqueada). Se respeta: el estudiante no puede seguir
            // avanzando, así que termina aquí su recorrido del temario.
            bloqueado = true;
            break;
          }
        }

        // Sella los intentos de esta sesión con su fecha planificada.
        const nuevos = await prisma.intento.findMany({
          where: { usuarioId: usuario.id, fecha: { gt: new Date(Date.now() - 600_000) } },
          select: { id: true },
        });
        idsSesion.push(...nuevos.map((n) => n.id));
        // Espaciados 2–9 min entre ejercicios: dentro del umbral de sesión
        // (30 min), así que siguen contando como UNA sesión, pero generan los
        // huecos de los que se estima el tiempo en plataforma.
        await sellarTanda(prisma, 'intentos', 'fecha', idsSesion, fechaSesion,
          () => enteroEntre(2, 9));
        await prisma.$executeRawUnsafe(
          `UPDATE pasos_ruta SET fecha = $1 WHERE usuario_id = $2 AND fecha > $3`,
          fechaSesion, usuario.id, new Date(Date.now() - 600_000),
        );

        // Código guardado en el editor: lo que el estudiante dejó escrito.
        if (rnd() < 0.4) {
          await practicaSvc.guardarCodigo(usuario.id, 'libre', `# ${nombre.split(' ')[0]}\nprint("hola")\n`);
        }

        if (bloqueado) break;
      }

      // ── 3. SUBIDAS DE NIVEL por el servicio real ──
      for (const fecha of crono.subidasNivel) {
        const temas = await prisma.progresoTema.findMany({
          where: { usuarioId: usuario.id }, select: { temaId: true, nivelActual: true },
        });
        if (temas.length === 0) break;
        const objetivo = elegir(temas);

        // El mini-diagnóstico exige ≥80 % para aprobar. Se pide el cuestionario
        // al servicio (`iniciarSubida`), que es quien sabe qué ejercicios son
        // del NIVEL OBJETIVO: `evaluarSubida` rechaza cualquier otro.
        const apruebaObjetivo = perfil.clave === 'alto' ? rnd() < 0.7 : rnd() < 0.35;

        try {
          const mini = await adaptatividadSvc.iniciarSubida(usuario.id, objetivo.temaId);
          if (mini.preguntas.length === 0) continue;
          const clavesMini = new Map(
            (await prisma.ejercicio.findMany({
              where: { id: { in: mini.preguntas.map((p) => p.id) } },
              select: { id: true, respuestaCorrecta: true },
            })).map((e) => [e.id, e.respuestaCorrecta]),
          );

          await adaptatividadSvc.evaluarSubida(
            usuario.id, objetivo.temaId,
            mini.preguntas.map((p) => ({
              ejercicioId: p.id,
              // Quien aprueba responde bien casi todo; quien no, falla lo justo
              // para quedar por debajo del umbral. Decide el servicio, no el seed.
              respuesta: (apruebaObjetivo ? rnd() < 0.92 : rnd() < 0.5)
                ? (clavesMini.get(p.id) ?? '') : 'incorrecta',
            })),
          );
          await prisma.$executeRawUnsafe(
            `UPDATE intentos_subida_nivel SET fecha = $1 WHERE usuario_id = $2 AND fecha > $3`,
            fecha, usuario.id, new Date(Date.now() - 600_000),
          );
          await prisma.$executeRawUnsafe(
            `UPDATE historial_theta SET fecha = $1 WHERE usuario_id = $2 AND origen = 'subir_nivel' AND fecha > $3`,
            fecha, usuario.id, new Date(Date.now() - 600_000),
          );
        } catch {
          // Cooldown u otra regla del servicio: se respeta.
          continue;
        }
      }

      // ── 4. REPASO Y EXAMEN DE UNIDAD por el servicio real ──
      if (crono.examen && unidades.length > 0) {
        const unidad = unidades[0];
        try {
          await examenSvc.completarRepaso(usuario.id, unidad.id);
          if (crono.repaso) {
            // El repaso guarda su marca temporal en `revisado_en`.
            await prisma.$executeRawUnsafe(
              `UPDATE repasos_unidad SET revisado_en = $1 WHERE usuario_id = $2 AND unidad_id = $3`,
              crono.repaso, usuario.id, unidad.id,
            );
          }

          const examen = await examenSvc.iniciar(usuario.id, unidad.id);
          if (examen.preguntas.length > 0) {
            const clavesEx = await prisma.ejercicio.findMany({
              where: { id: { in: examen.preguntas.map((p) => p.id) } },
              select: { id: true, respuestaCorrecta: true },
            });
            // Aprobar exige nivel de dominio ≥ Intermedio: los buenos suelen
            // pasarlo. Corrige el servicio, no el seed.
            const aprueba = perfil.clave === 'alto' ? rnd() < 0.8 : rnd() < 0.4;
            await examenSvc.evaluar(
              usuario.id, unidad.id,
              clavesEx.map((c) => ({
                ejercicioId: c.id,
                respuesta: (aprueba ? rnd() < 0.85 : rnd() < 0.45) ? c.respuestaCorrecta : 'incorrecta',
              })),
            );
            await prisma.$executeRawUnsafe(
              `UPDATE examenes_unidad SET fecha = $1 WHERE usuario_id = $2 AND fecha > $3`,
              crono.examen, usuario.id, new Date(Date.now() - 600_000),
            );
          }
        } catch {
          // El examen puede estar bloqueado por reglas reales (unidad no
          // completada, cooldown). Es comportamiento legítimo del sistema.
        }
      }

      // ── 5. RETOS: entrega y revisión del docente, por sus rutas reales ──
      for (const fecha of crono.retos) {
        if (retosActivos.length === 0) break;
        const reto = elegir(retosActivos);
        try {
          await retosCtrl.entregar(usuario.id, 'estudiante', reto.id, { codigo: '# entrega demo\nprint("ok")\n' } as never);
          await prisma.$executeRawUnsafe(
            `UPDATE retos_usuario SET entregado_en = $1 WHERE usuario_id = $2 AND reto_id = $3`,
            fecha, usuario.id, reto.id,
          );

          // Una parte se deja PENDIENTE a propósito, para que el docente tenga
          // revisiones reales en su bandeja.
          if (docente && rnd() < 0.55) {
            const aprobado = rnd() < 0.7;
            await revisionesSvc.revisar(reto.id, usuario.id, reto.autorId ?? docente.id, {
              aprobado,
              comentario: aprobado
                ? 'Buen trabajo: la solución es correcta y está bien estructurada.'
                : 'Revisa el manejo del caso borde; el resto va bien encaminado.',
            } as never);
            await prisma.$executeRawUnsafe(
              `UPDATE retos_usuario SET revisado_en = $1 WHERE usuario_id = $2 AND reto_id = $3`,
              new Date(fecha.getTime() + DIA_MS), usuario.id, reto.id,
            );
          }
        } catch {
          continue; // Reto ya entregado o no disponible: regla real del sistema.
        }
      }

      // ── 6. CONSULTAS A PREXI — escritas directamente, a propósito ──
      // `ConsultaIa` es una tabla de BITÁCORA, no estado derivado: nada se
      // calcula a partir de ella, así que escribirla no rompe ningún cálculo.
      // NO se genera llamando a TutorIaService porque ese servicio invoca a
      // Gemini de verdad: simular cientos de consultas quemaría la cuota de la
      // API y costaría dinero, sin aportar nada que el log no represente igual.
      if (perfil.consultasIa > 0) {
        await prisma.consultaIa.createMany({
          data: crono.consultas.map((fecha) => ({
            usuarioId: usuario.id,
            tipo: rnd() < 0.45 ? 'pista' : 'asistente',
            pregunta: elegir([
              '¿Por qué mi bucle no termina?',
              '¿Cuál es la diferencia entre while y for?',
              'No entiendo el error de indentación',
              '¿Cómo recorro una lista al revés?',
              '¿Qué hace exactamente range(1, 10, 2)?',
            ]),
            respuesta: 'Respuesta simulada del tutor (registro de demostración).',
            fecha,
          })),
        });
      }

      // ── 7. POSTEST por el servicio real ──
      // Mismo camino que el pretest: `preguntas()` fija el cuestionario,
      // `responder()` corrige en el backend y `finalizar()` consolida el
      // resultado, estima θ_final y dispara los emblemas de cierre.
      if (crono.postest) {
        try {
          await postestSvc.completarRepaso(usuario.id);
          const cuestionarioPost = await postestSvc.preguntas(usuario.id);
          const clavesPost = new Map(
            (await prisma.ejercicio.findMany({
              where: { id: { in: cuestionarioPost.map((q) => q.id) } },
              select: { id: true, respuestaCorrecta: true, estrellas: true, dificultadB: true },
            })).map((e) => [e.id, e]),
          );
          const thetaFinal = perfil.thetaReal + perfil.mejora;

          for (const q of cuestionarioPost) {
            const ej = clavesPost.get(q.id);
            if (!ej) continue;
            const b = ej.dificultadB ?? dificultadDesdeEstrellas(ej.estrellas);
            const acierta = rnd() < probabilidadAcierto(thetaFinal, b);
            await postestSvc.responder(
              usuario.id, q.id,
              acierta ? ej.respuestaCorrecta : (ej.respuestaCorrecta.trim().toUpperCase() === 'A' ? 'B' : 'A'),
            );
          }
          await postestSvc.finalizar(usuario.id, enteroEntre(600, 2400));

          await prisma.$executeRawUnsafe(
            `UPDATE pretest_postest SET fecha = $1 WHERE usuario_id = $2 AND tipo = 'post'`,
            crono.postest, usuario.id,
          );
          await prisma.$executeRawUnsafe(
            `UPDATE pretest_respuestas SET fecha = $1 WHERE usuario_id = $2 AND tipo = 'post'`,
            crono.postest, usuario.id,
          );
          await prisma.$executeRawUnsafe(
            `UPDATE historial_theta SET fecha = $1 WHERE usuario_id = $2 AND origen = 'postest'`,
            crono.postest, usuario.id,
          );
        } catch (e) {
          // El postest puede estar deshabilitado por el docente (PostestControl):
          // es una regla real del sistema, no un fallo del seed.
          console.warn(`[seed-demo]   postest omitido para ${usuario.email}: ${(e as Error).message}`);
        }
      }

      // ── 8. RANGOS: estado derivado que solo calcula su servicio ──
      await rangosSvc.recalcular(usuario.id);

      // Racha coherente con las fechas REALES de actividad, no puesta a mano.
      const dias = [...new Set(crono.sesiones.map((f) => Math.floor(f.getTime() / DIA_MS)))].sort();
      let racha = dias.length ? 1 : 0;
      let mejor = racha;
      for (let k = 1; k < dias.length; k++) {
        racha = dias[k] - dias[k - 1] === 1 ? racha + 1 : 1;
        mejor = Math.max(mejor, racha);
      }
      const ultima = crono.sesiones.length ? crono.sesiones[crono.sesiones.length - 1] : crono.pretest;
      await prisma.ranking.updateMany({
        where: { usuarioId: usuario.id },
        data: { rachaDias: mejor, ultimaActividad: ultima },
      });

      if ((i + 1) % 5 === 0) console.log(`[seed-demo]   ${i + 1}/${TOTAL} estudiantes simulados...`);
    }

    // ── Verificación obligatoria ──
    await verificarLineaDeTiempo(prisma);

    // ── Resumen ──
    const resumen = await prisma.usuario.findMany({
      where: { email: { endsWith: DOMINIO_DEMO } },
      select: {
        thetaFinal: true, nivelInicialAdaptativo: true,
        ranking: { select: { xpTotal: true } },
      },
    });
    const conPostest = resumen.filter((u) => u.thetaFinal !== null).length;

    console.log(`\n[seed-demo] Listo: ${resumen.length} estudiantes de demostración.`);
    console.log(`[seed-demo]   intentos simulados por el servicio real: ${totalIntentos}`);
    console.log(`[seed-demo]   con postest: ${conPostest} · sin postest (a propósito): ${resumen.length - conPostest}`);
    console.log(`[seed-demo]   correo: demo.NNN${DOMINIO_DEMO} · contraseña: ${PASSWORD_DEMO}`);
    console.log('[seed-demo] EXCLUIDOS de todos los cálculos del estudio (ver los 3 candados arriba).');
  } finally {
    await app.close();
  }
}

Logger.overrideLogger(['error', 'warn']);
main().catch((e) => {
  console.error('[seed-demo] Error:', e);
  process.exitCode = 1;
});
