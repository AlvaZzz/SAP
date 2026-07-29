/**
 * EXPORTA temas/retos YA EXISTENTES de una unidad al formato de prisma/data/unidad<N>.json.
 *
 *   npx tsx scripts/exportar-tema-existente.ts --unidad 2 --temas 2.5 --retos
 *
 * Sirve para PRESERVAR contenido vigente al re-sembrar una unidad con material
 * oficial nuevo que no lo cubre: el seed borra e inserta desde el JSON, así que lo
 * que no esté en el archivo desaparece. Este script vuelca esos temas/retos a
 * stdout como JSON listo para pegar en el archivo de contenido.
 *
 * Marca lo exportado con `fuenteDoc.origen: "preexistente"` para que el reporte de
 * trazabilidad no lo confunda con material citado del módulo oficial.
 */
import { PrismaClient, Banco } from '@prisma/client';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const arg = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const NUM_UNIDAD = Number(arg('--unidad') ?? 1);
const NUMEROS = (arg('--temas') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const CON_RETOS = args.includes('--retos');

type Opcion = { id: string; texto: string };

async function main() {
  const unidad = await prisma.unidad.findFirst({ where: { numero: NUM_UNIDAD }, orderBy: { id: 'asc' } });
  if (!unidad) throw new Error(`No existe la Unidad ${NUM_UNIDAD}`);

  const temas = await prisma.tema.findMany({
    where: { unidadId: unidad.id, ...(NUMEROS.length ? { numero: { in: NUMEROS } } : {}) },
    orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
  });

  const salidaTemas = [];
  for (const t of temas) {
    const ejercicios = await prisma.ejercicio.findMany({
      where: { temaId: t.id, banco: Banco.practica },
      orderBy: [{ nivelDificultad: 'asc' }, { id: 'asc' }],
    });
    salidaTemas.push({
      numero: t.numero,
      titulo: t.titulo,
      descripcion: t.descripcion ?? undefined,
      umbral: t.umbral,
      publicado: t.publicado,
      ejercicios: ejercicios.map((e) => ({
        categoria: e.categoria,
        tipo: e.tipo,
        nivel: e.nivelDificultad,
        b: e.dificultadB,
        enunciado: e.enunciado,
        ...(e.codigoPython ? { codigoPython: e.codigoPython } : {}),
        ...(Array.isArray(e.opciones) && (e.opciones as Opcion[]).length ? { opciones: e.opciones as Opcion[] } : {}),
        respuestaCorrecta: e.respuestaCorrecta,
        xp: e.xp,
        explicacion: e.explicacionIa ?? '',
        fuenteDoc: {
          unidad: String(NUM_UNIDAD),
          tema: t.numero,
          citaBreve: (e.explicacionIa ?? e.enunciado).slice(0, 160),
          // Distingue este contenido del citado del módulo oficial.
          origen: 'preexistente',
        },
      })),
      retos: [],
    });
  }

  const retos = CON_RETOS
    ? await prisma.reto.findMany({
        where: { tema: { unidadId: unidad.id } },
        orderBy: { id: 'asc' },
        include: { tema: { select: { numero: true } } },
      })
    : [];

  const salidaRetos = retos.map((r) => ({
    _tema: r.tema?.numero,
    titulo: r.titulo,
    categoria: r.categoria,
    nivelSugerido: r.estrellas >= 4 ? 'avanzado' : 'intermedio',
    enunciado: r.enunciado,
    ...(r.codigoInicial ? { codigoInicial: r.codigoInicial } : {}),
    ...(r.ejemploEntrada ? { ejemploEntrada: r.ejemploEntrada } : {}),
    ...(r.ejemploSalida ? { ejemploSalida: r.ejemploSalida } : {}),
    ...(r.respuestaCorrecta ? { solucionReferencia: r.respuestaCorrecta } : {}),
    xp: r.xp,
    esBugHunt: r.esBugHunt,
    activo: r.activo,
    fuenteDoc: {
      unidad: String(NUM_UNIDAD),
      tema: r.tema?.numero ?? '',
      citaBreve: r.titulo.slice(0, 160),
      origen: 'preexistente',
    },
  }));

  console.log(JSON.stringify({ temas: salidaTemas, retos: salidaRetos }, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
