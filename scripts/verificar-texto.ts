/**
 * VERIFICACIÓN DE INTEGRIDAD DEL TEXTO FUENTE.
 *
 *   npx tsx scripts/verificar-texto.ts
 *
 * Por qué existe: `frontend/src/app/(auth)/registro/page.tsx` llegó a producción
 * con 73 caracteres de reemplazo (U+FFFD). Alguna herramienta leyó el archivo
 * como CP1252 y lo reescribió como UTF-8, destruyendo cada acento y cada eñe. El
 * archivo seguía siendo UTF-8 válido y compilaba sin una sola queja, así que ni
 * el compilador, ni ESLint, ni las 468 pruebas unitarias lo detectaron: los
 * estudiantes leían "Correo electr<?>nico" en la pantalla de registro.
 *
 * Detecta tres formas del mismo daño:
 *
 *   1. U+FFFD — sustitución con pérdida. El carácter original ya no existe y hay
 *      que reescribirlo a mano (o recuperarlo del historial de Git).
 *   2. Mojibake — secuencias tipo "Ã©", "Ã±", "â€”": UTF-8 leído como Latin-1 y
 *      vuelto a guardar. Aquí el texto SÍ es recuperable de forma automática.
 *   3. UTF-8 inválido — el archivo ni siquiera decodifica.
 *
 * Lo que NO puede detectar, y conviene saberlo: un carácter sustituido por otro
 * ASCII válido. En el mismo incidente, una flecha "→" acabó como un signo "?"
 * corriente; ninguna comprobación automática distingue eso de un "?" legítimo.
 * Para esos casos, la red de seguridad es revisar el diff antes de commitear.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const RAIZ = path.join(__dirname, '..');

/** Extensiones binarias: su contenido no es texto y daría falsos positivos. */
const EXT_BINARIAS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.pdf',
  '.woff', '.woff2', '.ttf', '.otf', '.eot', '.zip', '.gz', '.tar',
  '.docx', '.xlsx', '.pptx', '.db', '.sqlite', '.node', '.wasm', '.mp3', '.wav',
]);

/**
 * Archivos exentos: contienen los ejemplos del propio incidente, así que
 * mencionan U+FFFD a propósito. Se listan uno a uno, nunca por patrón amplio.
 */
const EXENTOS = new Set([
  'scripts/verificar-texto.ts',
  '.claude/settings.local.json',
]);

/**
 * Firmas de mojibake: la representación en CP1252 de secuencias UTF-8 comunes en
 * español. "Ã©" es lo que se ve cuando "é" (C3 A9) se lee byte a byte como Latin-1.
 */
const MOJIBAKE = /Ã[¡©­³º±]|Â[°ª©¿¡]|â€[™œ"“”]|â€”|Ã‘|Ãš|Ã“|Ã/;

interface Hallazgo {
  archivo: string;
  linea: number;
  tipo: 'U+FFFD' | 'mojibake' | 'UTF-8 inválido';
  muestra: string;
}

/**
 * Solo se revisan los archivos QUE GIT SIGUE. Es el criterio correcto para una
 * comprobación previa al despliegue: lo que no está en el repositorio no se
 * despliega, y así los borradores locales del autor no ensucian el resultado.
 */
function archivosSeguidos(): string[] {
  const salida = execFileSync('git', ['ls-files', '-z'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return salida
    .split('\0')
    .filter(Boolean)
    .filter((rel) => !EXT_BINARIAS.has(path.extname(rel).toLowerCase()));
}

function main() {
  const hallazgos: Hallazgo[] = [];
  let revisados = 0;

  for (const rel of archivosSeguidos()) {
    if (EXENTOS.has(rel)) continue;
    const ruta = path.join(RAIZ, rel);
    if (!fs.existsSync(ruta)) continue; // archivo borrado y aún no commiteado

    const bytes = fs.readFileSync(ruta);
    // Heurística mínima para no leer binarios sin extensión conocida.
    if (bytes.includes(0)) continue;
    revisados++;

    const texto = bytes.toString('utf8');
    // Node sustituye los bytes inválidos por U+FFFD al decodificar; para
    // distinguir "archivo mal codificado" de "archivo que contiene U+FFFD",
    // se comprueba si el ida y vuelta conserva los bytes.
    const utf8Valido = Buffer.from(texto, 'utf8').equals(bytes);

    const lineas = texto.split('\n');
    lineas.forEach((linea, i) => {
      const tipo: Hallazgo['tipo'] | null = linea.includes('�')
        ? (utf8Valido ? 'U+FFFD' : 'UTF-8 inválido')
        : MOJIBAKE.test(linea)
          ? 'mojibake'
          : null;
      if (!tipo) return;
      hallazgos.push({
        archivo: rel,
        linea: i + 1,
        tipo,
        muestra: linea.trim().slice(0, 100).replace(/�/g, '<?>'),
      });
    });
  }

  console.log(`\n══ INTEGRIDAD DEL TEXTO FUENTE ══  ${revisados} archivos de texto seguidos por Git\n`);

  if (hallazgos.length === 0) {
    console.log('  ✔ Sin caracteres corruptos.\n');
    process.exit(0);
  }

  const porArchivo = new Map<string, Hallazgo[]>();
  for (const h of hallazgos) {
    const arr = porArchivo.get(h.archivo);
    if (arr) arr.push(h);
    else porArchivo.set(h.archivo, [h]);
  }

  for (const [archivo, hs] of [...porArchivo.entries()].sort()) {
    console.log(`  ✖ ${archivo} — ${hs.length} línea(s) con ${[...new Set(hs.map((h) => h.tipo))].join(' + ')}`);
    for (const h of hs.slice(0, 6)) console.log(`      L${String(h.linea).padEnd(5)} ${h.muestra}`);
    if (hs.length > 6) console.log(`      … y ${hs.length - 6} línea(s) más`);
  }

  console.log(
    `\n  ${hallazgos.length} línea(s) dañada(s) en ${porArchivo.size} archivo(s).\n` +
      '  U+FFFD es una sustitución CON PÉRDIDA: el carácter original no se puede\n' +
      '  reconstruir de forma automática. Recupera el texto correcto del historial\n' +
      '  de Git (git show HEAD:<ruta>) o vuelve a escribirlo a mano.\n',
  );
  process.exit(1);
}

main();
