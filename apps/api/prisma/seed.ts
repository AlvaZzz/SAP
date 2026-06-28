import { PrismaClient, Banco } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Def, NIVEL1, NIVEL2, NIVEL3, NIVEL4, NIVEL5, PRETEST, POSTEST } from './data';

/**
 * Seed Prisma — contenido 100% Python (69 práctica + 20 pretest + 20 postest).
 * Reutiliza el banco curado en ./data.ts. Ejecutar: npm run seed
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
    prisma.pretestRespuesta.deleteMany(),
    prisma.evaluacion.deleteMany(),
    prisma.intento.deleteMany(),
    prisma.progresoNivel.deleteMany(),
    prisma.ranking.deleteMany(),
    prisma.ejercicio.deleteMany(),
    prisma.nivel.deleteMany(),
    prisma.usuario.deleteMany(),
    prisma.configuracionSistema.deleteMany(),
  ]);

  await prisma.configuracionSistema.create({ data: { id: 1 } });

  // ── Usuarios demo ──
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const usuariosDef: Array<[string, string, string, 'estudiante' | 'docente' | 'admin']> = [
    ['Juan Mamani', 'juan@upea.edu.bo', '8001001', 'estudiante'],
    ['Ana Quispe', 'ana@upea.edu.bo', '8001002', 'estudiante'],
    ['Carlos Mamani', 'carlos@upea.edu.bo', '8001003', 'estudiante'],
    ['Maria Vera', 'maria@upea.edu.bo', '8001004', 'estudiante'],
    ['Docente Demo', 'docente@upea.edu.bo', '8002001', 'docente'],
    ['Admin PREXI', 'admin@upea.edu.bo', '8003001', 'admin'],
  ];
  const uid: Record<string, number> = {};
  for (const [nombre, email, cedula, rol] of usuariosDef) {
    const u = await prisma.usuario.create({
      data: {
        nombre, email, cedula, rol, carrera: 'Ingeniería de Sistemas',
        passwordHash: hash, pretestCompletado: true,
        grupo: rol === 'estudiante' ? 'experimental' : 'control',
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

  // ── Ejercicios ──
  const idsPorNivel: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  async function insertar(d: Def, banco: Banco): Promise<number> {
    const numeroNivel = d.nivel ?? CAT_A_NIVEL[d.categoria] ?? 1;
    const ej = await prisma.ejercicio.create({
      data: {
        titulo: tituloDe(d.codigo_python, d.enunciado),
        categoria: d.categoria,
        nivelId: nid[numeroNivel],
        estrellas: d.dificultad,
        tipo: d.tipo,
        enunciado: d.enunciado,
        codigoPython: d.codigo_python,
        opciones: d.opciones.map((t, i) => ({ id: LETRAS[i], texto: t })),
        respuestaCorrecta: LETRAS[d.respuesta_correcta],
        xp: d.xp ?? d.dificultad * 5,
        explicacionIa: d.expl ?? 'Analiza paso a paso la ejecución del código.',
        banco,
      },
    });
    return ej.id;
  }

  for (const banco of [NIVEL1, NIVEL2, NIVEL3, NIVEL4, NIVEL5]) {
    for (const d of banco) idsPorNivel[d.nivel!].push(await insertar(d, 'practica'));
  }
  for (const d of PRETEST) await insertar(d, 'pretest');
  for (const d of POSTEST) await insertar(d, 'postest');

  const practica = NIVEL1.length + NIVEL2.length + NIVEL3.length + NIVEL4.length + NIVEL5.length;
  console.log(`[seed] práctica=${practica} | pretest=${PRETEST.length} | postest=${POSTEST.length}`);

  // ── Logros ──
  await prisma.logro.createMany({
    data: [
      { clave: 'primer_acierto', nombre: 'Primer Acierto', condicion: 'Responde correctamente tu primer ejercicio', icono: '🎯' },
      { clave: 'nivel_completado', nombre: 'Nivel Conquistado', condicion: 'Completa un nivel al 80%', icono: '🏆' },
      { clave: 'top_5', nombre: 'Top 5', condicion: 'Entra al top 5 del ranking', icono: '⭐' },
      { clave: 'racha_7', nombre: 'Racha de Fuego', condicion: 'Mantén una racha de 7 días', icono: '🔥' },
      { clave: 'sin_pistas', nombre: 'Mente Brillante', condicion: 'Acierta 5 ejercicios sin usar pistas', icono: '💡' },
      { clave: 'funciones_5', nombre: 'Funcional', condicion: 'Resuelve 5 ejercicios de Funciones', icono: '🧩' },
    ],
  });

  // ── Demo: progreso real de Juan ──
  const juan = uid['juan@upea.edu.bo'];
  let xpJuan = 0;
  const resolver = async (ids: number[], cuantos: number) => {
    for (const id of ids.slice(0, cuantos)) {
      const ej = await prisma.ejercicio.findUnique({ where: { id }, select: { xp: true } });
      const xp = ej?.xp ?? 0;
      xpJuan += xp;
      await prisma.intento.create({
        data: {
          usuarioId: juan, ejercicioId: id, respuestaDada: 'A', correcto: true,
          tiempoSeg: 45, xpOtorgado: xp,
          fecha: new Date(Date.now() - Math.random() * 6 * 86_400_000),
        },
      });
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

  // ── Evaluaciones demo de Juan (pre/post para comparativa) ──
  const porCatPre = [
    { categoria: 'Variables', aciertos: 3, total: 5, porcentaje: 60 },
    { categoria: 'Condicionales', aciertos: 3, total: 5, porcentaje: 55 },
    { categoria: 'Bucles', aciertos: 2, total: 5, porcentaje: 40 },
    { categoria: 'Funciones', aciertos: 2, total: 5, porcentaje: 50 },
  ];
  await prisma.evaluacion.create({
    data: { usuarioId: juan, tipo: 'pre', puntajeTotal: 50, tiempoSeg: 900, porCategoria: porCatPre },
  });
  const porCatPost = [
    { categoria: 'Variables', aciertos: 5, total: 5, porcentaje: 90 },
    { categoria: 'Condicionales', aciertos: 4, total: 5, porcentaje: 85 },
    { categoria: 'Bucles', aciertos: 4, total: 5, porcentaje: 75 },
    { categoria: 'Funciones', aciertos: 4, total: 5, porcentaje: 80 },
  ];
  await prisma.evaluacion.create({
    data: { usuarioId: juan, tipo: 'post', puntajeTotal: 82, tiempoSeg: 780, porCategoria: porCatPost },
  });

  // ── Documentos demo (subidos por el docente) ──
  const docente = uid['docente@upea.edu.bo'];
  const docs: Array<[string, number, number]> = [
    // [titulo, nivelNumero, MB]
    ['Introducción a Variables y Tipos de Datos', 1, 1.8],
    ['Ejercicios resueltos de Condicionales', 2, 3.2],
    ['Guía de Bucles FOR y WHILE', 3, 2.4],
    ['Funciones en Python — Teoría y práctica', 4, 4.1],
  ];
  for (const [titulo, nivelN, mb] of docs) {
    await prisma.documento.create({
      data: {
        titulo, descripcion: 'Material compartido por tus docentes.',
        archivo: `/docs/${titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
        tamanoBytes: Math.round(mb * 1024 * 1024), nivelId: nid[nivelN], subidoPorId: docente,
      },
    });
  }

  // ── Retos demo (ejercicios extra del docente) ──
  await prisma.reto.createMany({
    data: [
      {
        titulo: 'FizzBuzz', categoria: 'Bucles', estrellas: 3, tipo: 'completar_codigo', autorId: docente, xp: 80,
        enunciado: 'Imprime los números del 1 al 20. Para múltiplos de 3 imprime "Fizz", de 5 "Buzz", y de ambos "FizzBuzz".',
        codigoInicial: 'for i in range(1, 21):\n    # tu código aquí\n    pass',
      },
      {
        titulo: 'Invertir una cadena', categoria: 'Estructuras', estrellas: 2, tipo: 'completar_codigo', autorId: docente, xp: 60,
        enunciado: 'Escribe una función que reciba un texto y devuelva la cadena invertida (sin usar reversed).',
        codigoInicial: 'def invertir(texto):\n    # tu código aquí\n    return ""\n\nprint(invertir("python"))',
      },
      {
        titulo: 'Número primo', categoria: 'Funciones', estrellas: 4, tipo: 'completar_codigo', autorId: docente, xp: 100,
        enunciado: 'Escribe una función es_primo(n) que devuelva True si n es primo y False en caso contrario.',
        codigoInicial: 'def es_primo(n):\n    # tu código aquí\n    return False\n\nprint(es_primo(7))',
      },
    ],
  });

  console.log(`[seed] Juan XP=${xpJuan}; ranking, progreso, documentos y retos demo listos.`);
  console.log(`[seed] ✅ Usuarios @upea.edu.bo (clave ${DEFAULT_PASSWORD})`);
}

main()
  .catch((e) => { console.error('[seed] ❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
