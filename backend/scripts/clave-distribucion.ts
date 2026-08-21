/**
 * DISTRIBUCIÓN DE LA CLAVE DE RESPUESTAS EN LOS BANCOS DE ORIGEN.
 *
 *   npx tsx scripts/clave-distribucion.ts
 *
 * Informe reproducible (no toca nada) de la posición de la respuesta correcta
 * en cada banco de contenido, ANTES y DESPUÉS de aplicar el equilibrado
 * (src/common/banco/clave-equilibrada). Sirve de evidencia documentable: un
 * banco con la clave concentrada en una posición no mide conocimiento.
 */
import * as fs from 'fs';
import * as path from 'path';
import { DIAGNOSTICO } from '../prisma/diagnostico';
import { EXAMEN_UNIDAD } from '../prisma/repaso';
import { POSTEST, PRETEST, NIVEL1, NIVEL2, NIVEL3, NIVEL4, NIVEL5, Def } from '../prisma/data';
import { PLAN_UPEA, EXTRA_AVANZADO, EjPlan, TemaPlan } from '../prisma/plan-upea';
import { DiagTema } from '../prisma/diagnostico';
import { equilibrarClavesLetras, distribucionClave, ItemLetra, LETRAS, SEMILLA_BANCO } from '../src/common/banco/clave-equilibrada';

/** Ítems con clave por letra; los demás tipos no participan del equilibrado. */
const CON_LETRA = new Set(['opcion_multiple', 'predecir_salida']);

function desdeDiag(temas: DiagTema[]): ItemLetra[] {
  return temas.flatMap((t) =>
    t.items.map((it) => ({
      enunciado: it.enunciado,
      opciones: it.opciones.map((texto, i) => ({ id: LETRAS[i], texto })),
      respuestaCorrecta: LETRAS[it.correcta],
    })),
  );
}

function desdeDef(defs: Def[]): ItemLetra[] {
  return defs
    .filter((d) => CON_LETRA.has(d.tipo) && d.opciones.length >= 2)
    .map((d) => ({
      enunciado: d.enunciado,
      opciones: d.opciones.map((texto, i) => ({ id: LETRAS[i], texto })),
      respuestaCorrecta: LETRAS[d.respuesta_correcta],
    }));
}

function ejerciciosDelPlan(): EjPlan[] {
  const out: EjPlan[] = [];
  const rec = (t: TemaPlan) => {
    out.push(...t.ejercicios, ...(EXTRA_AVANZADO[t.numero] ?? []));
    (t.subtemas ?? []).forEach(rec);
  };
  PLAN_UPEA.forEach((u) => u.temas.forEach(rec));
  return out;
}

function desdePlan(): ItemLetra[] {
  return ejerciciosDelPlan()
    .filter((e) => CON_LETRA.has(e.tipo) && e.opciones.length >= 2)
    .map((e) => ({ enunciado: e.enunciado, opciones: e.opciones, respuestaCorrecta: e.respuestaCorrecta }));
}

function desdeJson(archivo: string): ItemLetra[] {
  const ruta = path.join(__dirname, '..', 'prisma', 'data', archivo);
  const raw = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const items: ItemLetra[] = [];
  for (const tema of raw.temas ?? []) {
    for (const ej of tema.ejercicios ?? []) {
      if (!CON_LETRA.has(ej.tipo) || !(ej.opciones?.length >= 2)) continue;
      items.push({ enunciado: ej.enunciado, opciones: ej.opciones, respuestaCorrecta: ej.respuestaCorrecta });
    }
    for (const sub of tema.subtemas ?? []) {
      for (const ej of sub.ejercicios ?? []) {
        if (!CON_LETRA.has(ej.tipo) || !(ej.opciones?.length >= 2)) continue;
        items.push({ enunciado: ej.enunciado, opciones: ej.opciones, respuestaCorrecta: ej.respuestaCorrecta });
      }
    }
  }
  return items;
}

function fila(nombre: string, letras: string[]): { nombre: string; n: number; conteo: Record<string, number>; maxPct: number } {
  const conteo = distribucionClave(letras);
  const n = letras.length;
  const maxPct = n === 0 ? 0 : Math.max(...Object.values(conteo)) / n;
  return { nombre, n, conteo, maxPct };
}

function imprimir(titulo: string, filas: ReturnType<typeof fila>[]) {
  console.log(`\n── ${titulo} ──`);
  console.log(`${'Banco'.padEnd(34)}${'n'.padStart(5)}   ${['A', 'B', 'C', 'D'].map((l) => l.padStart(9)).join('')}   máx`);
  for (const f of filas) {
    const cols = ['A', 'B', 'C', 'D']
      .map((l) => {
        const c = f.conteo[l] ?? 0;
        return `${c} (${f.n ? Math.round((c / f.n) * 100) : 0}%)`.padStart(9);
      })
      .join('');
    const alerta = f.maxPct > 0.35 ? ' ✖' : f.maxPct > 0.3 ? ' ⚠' : ' ✔';
    console.log(`${f.nombre.padEnd(34)}${String(f.n).padStart(5)}   ${cols}   ${Math.round(f.maxPct * 100)}%${alerta}`);
  }
}

const bancos: Array<[string, ItemLetra[]]> = [
  ['diagnóstico (diagnostico.ts)', desdeDiag(DIAGNOSTICO)],
  ['examen de unidad (repaso.ts)', desdeDiag(EXAMEN_UNIDAD)],
  ['pretest legado (data.ts)', desdeDef(PRETEST)],
  ['postest (data.ts)', desdeDef(POSTEST)],
  ['niveles 1-5 (data.ts)', desdeDef([...NIVEL1, ...NIVEL2, ...NIVEL3, ...NIVEL4, ...NIVEL5])],
  ['práctica (plan-upea.ts)', desdePlan()],
  ['unidad1.json', desdeJson('unidad1.json')],
  ['unidad2.json', desdeJson('unidad2.json')],
  ['unidad3.json', desdeJson('unidad3.json')],
];

console.log(`\n══ DISTRIBUCIÓN DE LA CLAVE · semilla "${SEMILLA_BANCO}" ══`);
imprimir('ANTES (contenido tal como está hoy en el repositorio)', bancos.map(([n, its]) => fila(n, its.map((i) => i.respuestaCorrecta))));
imprimir('DESPUÉS (equilibrado determinista aplicado en el seed)', bancos.map(([n, its]) => fila(n, equilibrarClavesLetras(its, SEMILLA_BANCO).map((r) => r.respuestaCorrecta))));

const total = bancos.flatMap(([, its]) => its);
imprimir('TOTAL DEL SISTEMA', [
  fila('todos los bancos · antes', total.map((i) => i.respuestaCorrecta)),
  fila('todos los bancos · después', bancos.flatMap(([, its]) => equilibrarClavesLetras(its, SEMILLA_BANCO).map((r) => r.respuestaCorrecta))),
]);
console.log('');
