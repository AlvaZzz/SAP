/**
 * VERIFICACIÓN DE RECURSOS ESTÁTICOS.
 *
 *   npx tsx scripts/verificar-recursos.ts
 *
 * Por qué existe: `floating-icons.tsx` referenciaba `/python-logo.svg`, un
 * archivo que NUNCA existió. El navegador pedía el recurso y recibía un 404 en
 * cada visita al login, pero un probe de carga en el componente ocultaba el
 * fallo en pantalla: nada en la interfaz delataba el error. Ni el compilador ni
 * ESLint miran dentro de una cadena de texto, así que el 404 sobrevivió a todas
 * las revisiones hasta que alguien abrió la pestaña de red.
 *
 * Qué comprueba: toda cadena del código fuente que parezca la RUTA DE UN ARCHIVO
 * servido desde `public/` (empieza por "/" y termina en una extensión conocida)
 * tiene que existir en `frontend/public/`.
 *
 * Qué NO son recursos, y por eso se excluyen:
 *   · `/api/...`   — rutas del backend, las sirve NestJS.
 *   · `/_next/...` — las genera Next en tiempo de compilación.
 *   · rutas sin extensión (`/dashboard`, `/ejercicios/1`) — son páginas.
 */
import * as fs from 'fs';
import * as path from 'path';

const RAIZ = path.join(__dirname, '..');
const FUENTE = path.join(RAIZ, 'frontend', 'src');
const PUBLICO = path.join(RAIZ, 'frontend', 'public');
const EXT_FUENTE = ['.ts', '.tsx', '.css', '.js', '.jsx'];

/** Extensiones que identifican un ARCHIVO servido, no una ruta de página. */
const EXT_RECURSO = [
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico',
  '.mp3', '.wav', '.ogg', '.mp4', '.webm',
  '.woff', '.woff2', '.ttf', '.otf',
  '.pdf', '.json', '.txt', '.xml', '.js', '.wasm',
];
const EXCLUIR = [/^\/api\//, /^\/_next\//, /^\/\/+/];

/** Cadenas entre comillas simples, dobles o backticks, más `url(...)` de CSS. */
const CADENAS = /(?:'([^'\n]*)'|"([^"\n]*)"|`([^`\n$]*)`|url\(\s*['"]?([^'")]+)['"]?\s*\))/g;

/**
 * Sustituye el contenido de los COMENTARIOS por espacios, conservando los saltos
 * de línea (así los números de línea del informe siguen siendo los del archivo).
 *
 * Hace falta un escáner y no un `replace` con expresión regular porque las dos
 * cosas se confunden entre sí: `"https://x"` contiene `//` sin ser un comentario,
 * y un comentario puede contener comillas sin abrir una cadena. Sin esto, la
 * comprobación marcaba como rota una ruta citada en un JSDoc que precisamente
 * explicaba que esa referencia se había eliminado.
 */
function quitarComentarios(src: string): string {
  const out: string[] = [];
  let i = 0;
  let modo: 'codigo' | 'linea' | 'bloque' | 'cadena' = 'codigo';
  let comilla = '';

  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];

    if (modo === 'codigo') {
      if (c === '/' && d === '/') { modo = 'linea'; out.push('  '); i += 2; continue; }
      if (c === '/' && d === '*') { modo = 'bloque'; out.push('  '); i += 2; continue; }
      if (c === '"' || c === "'" || c === '`') { modo = 'cadena'; comilla = c; }
      out.push(c); i++; continue;
    }

    if (modo === 'cadena') {
      // Escape: se copia el par entero para no cerrar la cadena en un \" .
      if (c === '\\') { out.push(c, d ?? ''); i += 2; continue; }
      if (c === comilla) modo = 'codigo';
      out.push(c); i++; continue;
    }

    if (modo === 'linea') {
      if (c === '\n') { modo = 'codigo'; out.push('\n'); } else out.push(' ');
      i++; continue;
    }

    // bloque
    if (c === '*' && d === '/') { modo = 'codigo'; out.push('  '); i += 2; continue; }
    out.push(c === '\n' ? '\n' : ' ');
    i++;
  }
  return out.join('');
}

function archivosFuente(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) archivosFuente(p, acc);
    else if (EXT_FUENTE.includes(path.extname(e.name))) acc.push(p);
  }
  return acc;
}

interface Fallo { archivo: string; linea: number; ruta: string }

function main() {
  if (!fs.existsSync(PUBLICO)) {
    console.error(`✖ No existe ${PUBLICO}`);
    process.exit(1);
  }

  const fallos: Fallo[] = [];
  const vistos = new Set<string>();
  let referencias = 0;

  for (const archivo of archivosFuente(FUENTE)) {
    const lineas = quitarComentarios(fs.readFileSync(archivo, 'utf8')).split('\n');
    lineas.forEach((linea, i) => {
      for (const m of linea.matchAll(CADENAS)) {
        const valor = m[1] ?? m[2] ?? m[3] ?? m[4];
        if (!valor || !valor.startsWith('/')) continue;
        // Se corta en `?` y `#`: "/sonido.mp3?v=2" sigue siendo /sonido.mp3.
        const ruta = valor.split(/[?#]/)[0];
        if (EXCLUIR.some((rx) => rx.test(ruta))) continue;
        if (!EXT_RECURSO.includes(path.extname(ruta).toLowerCase())) continue;

        referencias++;
        vistos.add(ruta);
        const destino = path.join(PUBLICO, ruta);
        if (!fs.existsSync(destino)) {
          fallos.push({ archivo: path.relative(RAIZ, archivo), linea: i + 1, ruta });
        }
      }
    });
  }

  console.log('\n══ RECURSOS ESTÁTICOS ══');
  console.log(`   ${referencias} referencia(s) a ${vistos.size} recurso(s) distintos en frontend/src`);

  if (fallos.length === 0) {
    console.log('   ✔ Todos existen en frontend/public.\n');
    return;
  }

  console.log(`\n   ✖ ${fallos.length} referencia(s) a archivos que NO existen:`);
  for (const f of fallos) console.log(`     - ${f.ruta}\n         ${f.archivo}:${f.linea}`);
  console.log('');
  process.exit(1);
}

main();
