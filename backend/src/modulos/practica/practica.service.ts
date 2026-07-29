import { Injectable, BadRequestException } from '@nestjs/common';
import { ContextoCodigo } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PistonService } from './piston.service';
import { TutorIaService } from '../../tutor-ia/tutor-ia.service';
import { EmblemasService } from '../../gamificacion/emblemas.service';

// Harness de traza: el código del alumno se ejecuta dentro de `_main()`, que se
// llama DESPUÉS de sys.settrace (settrace no instrumenta el frame ya en curso, por
// eso no puede ser código de módulo). Se capturan, por cada línea de `_main`, el nº
// de línea y las variables locales. El nº se remapea al del alumno restando el
// offset (líneas del prefijo, hasta `def _main():` inclusive).
const TRAZA_PREFIJO = [
  'import sys, json, io',
  '_pasos = []',
  '_MAX = 300',
  'def _main():',
  '',
].join('\n');
const TRAZA_SUFIJO = [
  '',
  'def _t(f, e, a):',
  "    if e == 'line' and f.f_code.co_name == '_main':",
  '        if len(_pasos) < _MAX:',
  '            _l = {}',
  '            for _k, _v in list(f.f_locals.items()):',
  "                if _k.startswith('__'): continue",
  '                try: _l[_k] = repr(_v)[:80]',
  "                except Exception: _l[_k] = '<?>'",
  "            _pasos.append({'linea': f.f_lineno, 'locals': _l})",
  '    return _t',
  '_buf = io.StringIO()',
  '_out = sys.stdout',
  'sys.stdout = _buf',
  '_err = None',
  'sys.settrace(_t)',
  'try:',
  '    _main()',
  'except Exception:',
  '    import traceback; _err = traceback.format_exc()',
  'finally:',
  '    sys.settrace(None)',
  '    sys.stdout = _out',
  'print("PREXI_TRACE::" + json.dumps({"stdout": _buf.getvalue(), "pasos": _pasos, "error": _err}))',
].join('\n');
const TRAZA_MARCA = 'PREXI_TRACE::';

interface PasoTraza { linea: number; locals: Record<string, string> }

@Injectable()
export class PracticaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly piston: PistonService,
    private readonly tutor: TutorIaService,
    private readonly emblemas: EmblemasService,
  ) {}

  async cargarCodigo(usuarioId: number, contexto: ContextoCodigo, refId?: number) {
    return this.prisma.codigoPractica.findFirst({
      where: { usuarioId, contexto, refId: refId ?? null },
      orderBy: { actualizadoEn: 'desc' },
    });
  }

  async guardarCodigo(usuarioId: number, contexto: ContextoCodigo, codigo: string, refId?: number) {
    const existe = await this.prisma.codigoPractica.findFirst({
      where: { usuarioId, contexto, refId: refId ?? null },
    });
    if (existe) {
      return this.prisma.codigoPractica.update({ where: { id: existe.id }, data: { codigo } });
    }
    return this.prisma.codigoPractica.create({ data: { usuarioId, contexto, refId: refId ?? null, codigo } });
  }

  /** Ejecuta el código en el sandbox Piston y guarda la última salida. */
  async ejecutar(usuarioId: number, codigo: string, contexto: ContextoCodigo, refId?: number, stdin = '') {
    const resultado = await this.piston.ejecutar(codigo, stdin);
    // Fallo del sandbox (no del alumno): no sobrescribe la última salida buena;
    // el frontend muestra el mensaje reintentable.
    if (resultado.sandboxError) return { ...resultado, reintentable: true };

    const salida = resultado.timeout
      ? 'Tu código tardó demasiado (posible bucle infinito). Revisa la condición de corte.'
      : resultado.ok ? resultado.stdout : resultado.stderr || resultado.stdout;

    // Persiste el código y su última salida (mejor esfuerzo).
    const existe = await this.prisma.codigoPractica.findFirst({ where: { usuarioId, contexto, refId: refId ?? null } });
    if (existe) await this.prisma.codigoPractica.update({ where: { id: existe.id }, data: { codigo, ultimaSalida: salida } });
    else await this.prisma.codigoPractica.create({ data: { usuarioId, contexto, refId: refId ?? null, codigo, ultimaSalida: salida } });

    return { ...resultado, salida };
  }

  /** ALVARO revisa el código actual y guía sin resolver. */
  asistir(codigo: string, enunciado?: string, pregunta?: string) {
    return this.tutor.asistirCodigo({ codigo, enunciado, pregunta }).then((respuesta) => ({ respuesta }));
  }

  /**
   * VISUALIZADOR DE TRAZA: ejecuta el código instrumentado en el sandbox y
   * devuelve la ejecución PASO A PASO (línea actual + variables locales), para
   * mostrar las "cajas etiquetadas" en el editor. Captura solo el nivel de módulo.
   */
  async traza(codigo: string, stdin = ''): Promise<{ ok: boolean; stdout: string; error: string | null; reintentable?: boolean; pasos: PasoTraza[] }> {
    const nLineas = codigo.split('\n').length;
    const indentado = codigo.split('\n').map((l) => '    ' + l).join('\n');
    const harness = TRAZA_PREFIJO + indentado + TRAZA_SUFIJO;
    const offset = TRAZA_PREFIJO.split('\n').length - 1; // líneas antes del código del alumno

    const r = await this.piston.ejecutar(harness, stdin);
    // Fallo del sandbox (no del alumno): mensaje claro y reintentable, nunca la salida cruda.
    if (r.sandboxError) return { ok: false, stdout: '', error: r.sandboxError, reintentable: true, pasos: [] };
    if (r.timeout) return { ok: false, stdout: '', error: 'Tu código tardó demasiado (posible bucle infinito). Revisa la condición de corte e inténtalo de nuevo.', pasos: [] };
    const idx = r.stdout.lastIndexOf(TRAZA_MARCA);
    if (idx === -1) {
      // Sin centinela → el código no compiló (p. ej. error de sintaxis): muestra el error.
      return { ok: false, stdout: '', error: (r.stderr || r.stdout || 'No se pudo generar la traza.').trim(), pasos: [] };
    }
    let data: { stdout?: string; pasos?: { linea: number; locals: Record<string, string> }[]; error?: string | null };
    try {
      data = JSON.parse(r.stdout.slice(idx + TRAZA_MARCA.length));
    } catch {
      return { ok: false, stdout: '', error: 'No se pudo leer la traza.', pasos: [] };
    }
    // Remapea al nº de línea del alumno y descarta los pasos del propio harness.
    const pasos: PasoTraza[] = (data.pasos ?? [])
      .map((p) => ({ linea: p.linea - offset, locals: p.locals }))
      .filter((p) => p.linea >= 1 && p.linea <= nLineas);
    return { ok: !data.error, stdout: data.stdout ?? '', error: data.error ?? null, pasos };
  }

  /**
   * MISIÓN DE DEPURACIÓN (bug‑hunt): ejecuta el código corregido y lo AUTO‑VALIDA
   * comparando la salida con la esperada del reto. Si acierta, marca el reto
   * aprobado, otorga XP (ranking) y el emblema "Cazador de Bugs".
   */
  async verificarReto(usuarioId: number, retoId: number, codigo: string) {
    const reto = await this.prisma.reto.findFirst({
      where: { id: retoId, activo: true },
      select: { id: true, titulo: true, esBugHunt: true, autoCalificable: true, ejemploSalida: true, xp: true },
    });
    if (!reto) throw new BadRequestException('El reto no existe o no está disponible');
    // Se corrigen aquí (sin revisión docente) las misiones de depuración y los
    // retos DERIVADOS del banco, cuya salida esperada viene del ejercicio origen.
    if (!reto.esBugHunt && !reto.autoCalificable) {
      throw new BadRequestException('Este reto lo revisa tu docente; usa "Entregar reto".');
    }
    if (!reto.ejemploSalida) throw new BadRequestException('Este reto no tiene salida esperada configurada.');

    const r = await this.piston.ejecutar(codigo);
    // El sandbox falló: no penalizar al alumno marcando incorrecto; pedir reintento.
    if (r.sandboxError) return { correcto: false, salida: '', esperado: reto.ejemploSalida, xp: 0, emblemas_nuevos: [], sandboxError: r.sandboxError, reintentable: true };
    const salida = r.timeout ? 'Tu código tardó demasiado (posible bucle infinito).' : r.ok ? r.stdout : r.stderr || r.stdout;
    const correcto = r.ok && salida.trim() === reto.ejemploSalida.trim();

    let xp = 0;
    let emblemas_nuevos: { clave: string; nombre: string; descripcion: string; svgKey: string; icono: string }[] = [];
    if (correcto) {
      const previo = await this.prisma.retoUsuario.findUnique({ where: { usuarioId_retoId: { usuarioId, retoId } } });
      if (previo?.estado === 'aprobado') {
        xp = previo.xpObtenido; // ya lo había resuelto: no vuelve a otorgar XP
      } else {
        xp = reto.xp;
        await this.prisma.$transaction(async (tx) => {
          await tx.retoUsuario.upsert({
            where: { usuarioId_retoId: { usuarioId, retoId } },
            create: { usuarioId, retoId, estado: 'aprobado', resuelto: true, xpObtenido: xp, codigoEntregado: codigo, entregadoEn: new Date(), revisadoEn: new Date() },
            update: { estado: 'aprobado', resuelto: true, xpObtenido: xp, codigoEntregado: codigo, revisadoEn: new Date() },
          });
          await tx.ranking.upsert({ where: { usuarioId }, create: { usuarioId, xpTotal: xp }, update: { xpTotal: { increment: xp } } });
          const orden = await tx.ranking.findMany({ orderBy: [{ xpTotal: 'desc' }, { usuarioId: 'asc' }], select: { usuarioId: true } });
          for (let i = 0; i < orden.length; i++) {
            await tx.ranking.update({ where: { usuarioId: orden[i].usuarioId }, data: { posicion: i + 1 } });
          }
        });
        // El emblema es de DEPURACIÓN: solo lo gana quien caza un bug, no quien
        // resuelve un reto de resolución autocalificable.
        if (reto.esBugHunt) {
          emblemas_nuevos = await this.emblemas.otorgarClaves(usuarioId, ['cazador_de_bugs']).catch(() => []);
        }
      }
    }
    return { correcto, salida, esperado: reto.ejemploSalida, xp, emblemas_nuevos };
  }
}
