/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  GUARDIÁN: EL ROL DOCENTE NO PUEDE REVELAR EL GRUPO DEL ESTUDIO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Si el docente supiera quién está en el grupo control y quién en el
 *  experimental, podría tratarlos distinto sin proponérselo (sesgo del
 *  experimentador) y la diferencia final dejaría de ser atribuible a la
 *  intervención. Es una amenaza a la validez interna que NO se puede corregir
 *  a posteriori: o el docente está ciego al grupo, o el estudio queda
 *  comprometido.
 *
 *  Esta prueba NO se limita a los tres puntos donde se detectó la fuga el
 *  2026-08-08 (ficha del estudiante, filas del reporte y CSV exportable).
 *  RECORRE TODO `backend/src/docente` y falla si `grupo` reaparece en
 *  cualquier lugar desde el que pueda llegar a una respuesta. Está escrita así
 *  a propósito: los tres de entonces ya están corregidos; lo que hay que
 *  atrapar es el cuarto que alguien agregue dentro de seis meses.
 *
 *  QUÉ HACER SI ESTA PRUEBA FALLA
 *  No la relajes ni añadas tu caso a una lista de excepciones. Quita el campo.
 *  Si de verdad necesitas el grupo para algo, ese algo pertenece al rol
 *  INVESTIGADOR, que trabaja sobre datos anonimizados.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const RAIZ_DOCENTE = join(__dirname);

/** Recorre recursivamente el árbol y devuelve los .ts que no son pruebas. */
function archivosFuente(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      salida.push(...archivosFuente(ruta));
      continue;
    }
    if (!entrada.endsWith('.ts')) continue;
    if (entrada.endsWith('.spec.ts')) continue; // las pruebas sí pueden nombrarlo
    salida.push(ruta);
  }
  return salida;
}

/**
 * Quita comentarios y textos literales simples ('…' y "…").
 *
 * POR QUÉ SE IGNORAN ESOS DOS Y NO MÁS. La fuga que importa es la del DATO: un
 * campo `grupo:` en una respuesta o una lectura `usuario.grupo`. Mencionar la
 * palabra en una explicación dirigida al docente ("si el abandono se concentra
 * en un grupo, sesga la comparación") no revela la asignación de nadie.
 *
 * Un guardián que castiga documentar el motivo no dura ni una semana: alguien
 * lo relaja con prisa y deja de proteger nada. Así que se ignora la prosa y se
 * sigue vigilando TODO lo demás.
 *
 * Las plantillas (backticks) NO se ignoran a propósito: ahí sí puede colarse una
 * interpolación real como `${u.grupo}`.
 */
function sinComentariosNiTextos(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
}

/**
 * Palabras que contienen "grupo" pero NO se refieren al grupo del estudio.
 * `grupos`/`agrupar` son agrupaciones de UI (ejercicios por unidad, etc.).
 */
const FALSOS_POSITIVOS = /\b(grupos|agrupa\w*|agrupar\w*|subgrupo\w*)\b/gi;

describe('el rol DOCENTE es ciego al grupo del estudio', () => {
  const fuentes = archivosFuente(RAIZ_DOCENTE);

  it('encuentra archivos que auditar (si no, la prueba no está probando nada)', () => {
    expect(fuentes.length).toBeGreaterThan(5);
  });

  /**
   * El guardián solo sirve si sigue detectando las formas REALES de fuga
   * después de haberlo afinado para ignorar la prosa. Estos casos lo prueban.
   */
  it('sigue detectando las formas reales de fuga pese a ignorar los textos', () => {
    const detecta = (codigo: string) => /\bgrupo\b/i.test(
      sinComentariosNiTextos(codigo).replace(FALSOS_POSITIVOS, ''),
    );
    // Lo que DEBE seguir cazando:
    expect(detecta('return { id: u.id, grupo: u.grupo };')).toBe(true);
    expect(detecta('const g = usuario.grupo;')).toBe(true);
    expect(detecta('select: { grupo: true }')).toBe(true);
    expect(detecta('const s = `asignado a ${u.grupo}`;')).toBe(true); // plantilla
    // Lo que puede pasar (prosa y documentación):
    expect(detecta("mensaje: 'el abandono por grupo sesga la comparación'")).toBe(false);
    expect(detecta('// no exponer el grupo del estudio')).toBe(false);
    expect(detecta('/* el grupo pertenece al rol investigador */')).toBe(false);
    // Y las agrupaciones de UI, que no tienen nada que ver:
    expect(detecta('const grupos = agruparPorUnidad(x);')).toBe(false);
  });

  it.each(fuentes.map((f) => [f.replace(RAIZ_DOCENTE, 'docente'), f]))(
    '%s no menciona el grupo del estudio',
    (_etiqueta, ruta) => {
      const codigo = sinComentariosNiTextos(readFileSync(ruta, 'utf8')).replace(FALSOS_POSITIVOS, '');
      const lineas = codigo.split('\n');
      const ofensivas = lineas
        .map((l, i) => ({ n: i + 1, texto: l }))
        .filter(({ texto }) => /\bgrupo\b/i.test(texto));

      if (ofensivas.length > 0) {
        const detalle = ofensivas.map((o) => `    línea ${o.n}: ${o.texto.trim()}`).join('\n');
        throw new Error(
          `El rol docente NO puede exponer el grupo control/experimental.\n` +
          `Encontrado en ${ruta}:\n${detalle}\n\n` +
          `Quita el campo. Si necesitas el grupo, eso pertenece al rol investigador.`,
        );
      }
      expect(ofensivas).toHaveLength(0);
    },
  );
});

/**
 * Segunda capa: las FORMAS de respuesta. La comprobación anterior es estática y
 * no vería un `...usuario` que arrastrase `grupo` sin nombrarlo. Aquí se
 * verifica sobre objetos reales que ninguna respuesta del rol lo incluya.
 */
describe('las respuestas del rol docente no arrastran el campo grupo', () => {
  /** Busca la clave `grupo` en cualquier profundidad de la estructura. */
  function contieneGrupo(valor: unknown, ruta = '$'): string | null {
    if (Array.isArray(valor)) {
      for (let i = 0; i < valor.length; i++) {
        const r = contieneGrupo(valor[i], `${ruta}[${i}]`);
        if (r) return r;
      }
      return null;
    }
    if (valor && typeof valor === 'object') {
      for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
        if (k.toLowerCase() === 'grupo') return `${ruta}.${k}`;
        const r = contieneGrupo(v, `${ruta}.${k}`);
        if (r) return r;
      }
    }
    return null;
  }

  it('detecta la clave a cualquier profundidad (la propia comprobación funciona)', () => {
    expect(contieneGrupo({ a: [{ b: { grupo: 'control' } }] })).toBe('$.a[0].b.grupo');
    expect(contieneGrupo({ a: [{ b: { nombre: 'x' } }] })).toBeNull();
  });

  it('una ficha de estudiante como la que devuelve el servicio no lo incluye', () => {
    // Forma real devuelta por DocenteEstudiantesService.detalle().
    const fichaTipica = {
      estudiante: {
        id: 1, nombre: 'Ana Quispe', email: 'a@x.bo', carrera: 'Sistemas',
        estado: 'en_progreso', xp: 300, racha_dias: 3,
        ejercicios_completados: 12, total_intentos: 20, tasa_acierto: 60,
        ultima_sesion: new Date(),
      },
      progreso_niveles: [{ numero: 1, ejercicios_completados: 5, umbral: 12 }],
      actividad: [{ dia: '2026-08-01', intentos: 2, aciertos: 1 }],
      historial: [{ titulo: 'x', correcto: true }],
      pretest: { puntaje: 60 }, postest: { puntaje: 80 }, ganancia: 20,
    };
    expect(contieneGrupo(fichaTipica)).toBeNull();
  });

  it('una fila de reporte como la que devuelve el servicio no lo incluye', () => {
    const filaTipica = {
      id: 1, nombre: 'Ana Quispe', pretest: 60, postest: 80,
      ganancia: 20, categoria_mas_debil: 'Bucles',
    };
    expect(contieneGrupo(filaTipica)).toBeNull();
  });
});
