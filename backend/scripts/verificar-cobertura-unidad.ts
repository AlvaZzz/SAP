/**
 * VERIFICACIÓN DE COBERTURA DEL BANCO DE UNA UNIDAD (salvaguarda post-seed).
 *
 *   npx tsx scripts/verificar-cobertura-unidad.ts        → Unidad 1
 *   npx tsx scripts/verificar-cobertura-unidad.ts 2      → Unidad 2
 *
 * Comprueba, sobre el estado REAL de la base, que el banco cumple las reglas de
 * negocio del sistema. Sale con código 1 y detalle si algo no cuadra.
 */
import { PrismaClient, Banco, NivelDificultad, TipoEjercicio } from '@prisma/client';

const prisma = new PrismaClient();

/** Ejercicios de práctica esperados por tema publicado, por nivel. */
const ESPERADO: Record<NivelDificultad, number> = { basico: 15, intermedio: 10, avanzado: 5 };
/** Mínimo absoluto por tema que exige el sistema para publicarlo. */
const MINIMO_POR_TEMA = 10;
const TIPOS_CON_OPCIONES: TipoEjercicio[] = ['opcion_multiple', 'predecir_salida'];

const numeroUnidad = Number(process.argv[2] ?? 1);
const fallos: string[] = [];

async function main() {
  const unidad = await prisma.unidad.findFirst({ where: { numero: numeroUnidad }, orderBy: { id: 'asc' } });
  if (!unidad) {
    console.error(`✖ No existe la Unidad ${numeroUnidad}.`);
    process.exit(1);
  }

  const temas = await prisma.tema.findMany({
    where: { unidadId: unidad.id, publicado: true },
    orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
    select: { id: true, numero: true, titulo: true },
  });
  const ejercicios = await prisma.ejercicio.findMany({
    where: { temaId: { in: temas.map((t) => t.id) }, activo: true },
    select: {
      id: true, temaId: true, banco: true, nivelDificultad: true, tipo: true,
      opciones: true, respuestaCorrecta: true, enunciado: true, xp: true, fuenteDoc: true, codigoPython: true,
    },
  });

  console.log(`\n══ COBERTURA · Unidad ${unidad.numero} — ${unidad.titulo} ══\n`);

  /* 1) Distribución por tema y nivel (solo banco de práctica). */
  const practica = ejercicios.filter((e) => e.banco === Banco.practica);
  console.log('Tema                                       Bás  Int  Avz  Total  Origen');
  for (const t of temas) {
    const delTema = practica.filter((e) => e.temaId === t.id);
    const n = (nivel: NivelDificultad) => delTema.filter((e) => e.nivelDificultad === nivel).length;
    // Un tema es PREEXISTENTE si su contenido no vino del banco oficial (se
    // conservó al re-sembrar la unidad). A esos solo se les exige el mínimo para
    // publicarse, no la distribución 15/10/5 del banco.
    const preexistente = delTema.length > 0
      && delTema.every((e) => ((e.fuenteDoc ?? {}) as { origen?: string }).origen === 'preexistente');
    const etiqueta = `${t.numero} ${t.titulo}`.padEnd(40).slice(0, 40);
    console.log(`${etiqueta}  ${String(n('basico')).padStart(3)}  ${String(n('intermedio')).padStart(3)}  ${String(n('avanzado')).padStart(3)}  ${String(delTema.length).padStart(5)}  ${preexistente ? 'preexistente' : 'banco oficial'}`);

    if (delTema.length < MINIMO_POR_TEMA) {
      fallos.push(`Tema ${t.numero} tiene ${delTema.length} ejercicios activos (mínimo ${MINIMO_POR_TEMA} para publicarse).`);
    }
    if (preexistente) continue;
    for (const nivel of Object.keys(ESPERADO) as NivelDificultad[]) {
      if (n(nivel) !== ESPERADO[nivel]) {
        fallos.push(`Tema ${t.numero} · nivel ${nivel}: ${n(nivel)} ejercicios (esperado ${ESPERADO[nivel]}).`);
      }
    }
  }
  console.log(`${''.padEnd(40)}  ${String(practica.length).padStart(20)} de práctica`);

  /* 2) Examen de fin de unidad: 10 ítems (5 intermedio + 5 avanzado). */
  const examen = ejercicios.filter((e) => e.banco === Banco.examen);
  const exInt = examen.filter((e) => e.nivelDificultad === 'intermedio').length;
  const exAvz = examen.filter((e) => e.nivelDificultad === 'avanzado').length;
  console.log(`\nExamen de unidad: ${examen.length} ítems (intermedio ${exInt} · avanzado ${exAvz})`);
  if (examen.length !== 10) fallos.push(`El examen de unidad tiene ${examen.length} ítems (esperado 10).`);
  if (exInt !== 5) fallos.push(`El examen tiene ${exInt} ítems intermedios (esperado 5).`);
  if (exAvz !== 5) fallos.push(`El examen tiene ${exAvz} ítems avanzados (esperado 5).`);
  if (examen.some((e) => e.nivelDificultad === 'basico')) fallos.push('El examen de unidad no debe incluir ítems de nivel básico.');

  /* 3) Integridad de cada ítem. */
  const codigosVistos = new Map<string, number>();
  for (const e of ejercicios) {
    const fd = (e.fuenteDoc ?? {}) as { codigo?: string };
    const ref = fd.codigo ? `${fd.codigo} (id ${e.id})` : `id ${e.id}`;

    if (!e.enunciado.trim()) fallos.push(`Ejercicio ${ref}: enunciado vacío.`);
    if (!e.respuestaCorrecta.trim()) fallos.push(`Ejercicio ${ref}: sin respuesta correcta.`);
    if (e.xp <= 0) fallos.push(`Ejercicio ${ref}: xp debe ser > 0 (es ${e.xp}).`);

    const opciones = Array.isArray(e.opciones) ? (e.opciones as { id: string; texto: string }[]) : [];
    if (TIPOS_CON_OPCIONES.includes(e.tipo)) {
      if (opciones.length !== 4) fallos.push(`Ejercicio ${ref} (${e.tipo}): ${opciones.length} opciones (esperado 4).`);
      if (!opciones.some((o) => o.id === e.respuestaCorrecta.trim())) {
        fallos.push(`Ejercicio ${ref}: la respuesta "${e.respuestaCorrecta}" no corresponde a ninguna opción.`);
      }
    }
    // El hueco debe estar A LA VISTA: en el código o en el enunciado. Si no, el
    // estudiante no sabe qué completar (ver components/ejercicios/completar-codigo).
    if (e.tipo === 'completar_codigo' && !/_{2,}/.test(`${e.codigoPython ?? ''}${e.enunciado}`)) {
      fallos.push(`Ejercicio ${ref} (completar_codigo): no tiene ningún hueco "____" ni en el código ni en el enunciado.`);
    }
    if (e.tipo === 'ordenar_lineas') {
      const ids = e.respuestaCorrecta.split(',').map((x) => x.trim()).filter(Boolean);
      if (ids.length !== opciones.length) {
        fallos.push(`Ejercicio ${ref} (ordenar_lineas): el orden tiene ${ids.length} ids y hay ${opciones.length} opciones.`);
      }
      const validos = new Set(opciones.map((o) => o.id));
      const huerfanos = ids.filter((x) => !validos.has(x));
      if (huerfanos.length) fallos.push(`Ejercicio ${ref} (ordenar_lineas): ids sin opción → ${huerfanos.join(', ')}.`);
      if (new Set(ids).size !== ids.length) fallos.push(`Ejercicio ${ref} (ordenar_lineas): ids repetidos en el orden.`);
    }

    if (fd.codigo) {
      const previo = codigosVistos.get(fd.codigo);
      if (previo != null) fallos.push(`Código de banco duplicado "${fd.codigo}" (ejercicios ${previo} y ${e.id}).`);
      else codigosVistos.set(fd.codigo, e.id);
    }
  }
  console.log(`Códigos de banco únicos: ${codigosVistos.size}/${ejercicios.length} ítems`);

  /* Veredicto. */
  if (fallos.length) {
    console.error(`\n✖ ${fallos.length} problema(s) de cobertura:`);
    for (const f of fallos) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('\n✔ Cobertura correcta: 15/10/5 por tema, examen de 10 ítems y todos los ítems íntegros.\n');
}

main()
  .catch((e) => { console.error('✖ Falló la verificación:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
