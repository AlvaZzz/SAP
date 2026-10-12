import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TutorIaService } from '../../tutor-ia/tutor-ia.service';
import {
  CAMPOS, FilaEstudiante, FilaValidada, Mapeo,
  aplicarMapeo, capitalizar, detectarColumnas, faltantesDe, limpiarCi, limpiarParalelo, limpiarRu,
  nombreCompletoDe, validarFilas,
} from './lista';

/** Tope de filas por archivo: una nómina real no pasa de unos cientos. */
export const MAX_FILAS_LISTA = 1000;
export const MAX_LISTA_BYTES = 5 * 1024 * 1024;

export type ModoExistentes = 'actualizar' | 'omitir';

/**
 * Filtro Prisma con los estudiantes que un docente puede ver: los de SUS
 * paralelos, más los que aún no tienen docente asignado (paralelos sin docente
 * o estudiantes sin paralelo), para que nadie quede invisible. El admin ve todo.
 */
export function estudiantesDelDocente(docenteId: number, rol: string): Prisma.UsuarioWhereInput {
  // Quien se registró solo y aún no fue aceptado NO es todavía estudiante del
  // curso: aparece en Solicitudes, no en las listas.
  if (rol === 'admin') return { rol: 'estudiante', estadoInscripcion: 'aprobada' };
  return {
    rol: 'estudiante', estadoInscripcion: 'aprobada',
    OR: [
      { paraleloRef: { docenteId } },
      { paraleloRef: { docenteId: null } },
      { paraleloId: null },
    ],
  };
}

/**
 * REGISTRO DE ESTUDIANTES (rol docente).
 *
 * El docente organiza su curso en Materia → Paralelo, sube la lista que ya
 * tiene (Excel o CSV), el sistema reconoce las columnas, le muestra una vista
 * previa con los problemas marcados y recién entonces crea las cuentas.
 *
 * Cada estudiante registrado entra con su RU como usuario y su CI como
 * contraseña inicial, y el sistema lo obliga a cambiarla en el primer ingreso.
 */
@Injectable()
export class DocenteRegistroService {
  private readonly logger = new Logger(DocenteRegistroService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ia: TutorIaService,
  ) {}

  // ══════════════════ Materias y paralelos ══════════════════

  /** Materias con sus paralelos, el docente de cada uno y cuántos estudiantes tiene. */
  async materias(docenteId: number) {
    const materias = await this.prisma.materia.findMany({
      orderBy: [{ gestion: 'desc' }, { nombre: 'asc' }],
      include: {
        paralelos: {
          orderBy: { nombre: 'asc' },
          include: {
            docente: { select: { id: true, nombre: true } },
            _count: { select: { estudiantes: { where: { rol: 'estudiante', activo: true } } } },
          },
        },
      },
    });
    return materias.map((m) => ({
      id: m.id, nombre: m.nombre, sigla: m.sigla, gestion: m.gestion,
      paralelos: m.paralelos.map((p) => ({
        id: p.id, nombre: p.nombre,
        docente: p.docente ? { id: p.docente.id, nombre: p.docente.nombre } : null,
        es_mio: p.docenteId === docenteId,
        estudiantes: p._count.estudiantes,
      })),
    }));
  }

  async crearMateria(dto: { nombre: string; sigla?: string; gestion: string }) {
    const nombre = dto.nombre.trim().replace(/\s+/g, ' ');
    const gestion = dto.gestion.trim();
    const existe = await this.prisma.materia.findUnique({ where: { nombre_gestion: { nombre, gestion } } });
    if (existe) throw new ConflictException(`Ya existe la materia "${nombre}" en la gestión ${gestion}.`);
    return this.prisma.materia.create({ data: { nombre, gestion, sigla: dto.sigla?.trim() || null } });
  }

  async crearParalelo(docenteId: number, dto: { materiaId: number; nombre: string; soyDocente?: boolean }) {
    const materia = await this.prisma.materia.findUnique({ where: { id: dto.materiaId } });
    if (!materia) throw new NotFoundException('Materia no encontrada.');
    const nombre = limpiarParalelo(dto.nombre);
    if (!nombre) throw new BadRequestException('Escribe el nombre del paralelo (por ejemplo: A).');
    const existe = await this.prisma.paralelo.findUnique({ where: { materiaId_nombre: { materiaId: materia.id, nombre } } });
    if (existe) throw new ConflictException(`El paralelo ${nombre} ya existe en ${materia.nombre}.`);
    return this.prisma.paralelo.create({
      data: { materiaId: materia.id, nombre, docenteId: dto.soyDocente === false ? null : docenteId },
    });
  }

  /** El docente se asigna (o se retira) como docente de un paralelo. */
  async asignarme(docenteId: number, paraleloId: number, asignar: boolean) {
    const p = await this.prisma.paralelo.findUnique({ where: { id: paraleloId }, include: { docente: { select: { nombre: true } } } });
    if (!p) throw new NotFoundException('Paralelo no encontrado.');
    if (asignar && p.docenteId && p.docenteId !== docenteId) {
      throw new ConflictException(`Este paralelo ya tiene docente: ${p.docente?.nombre}. Pide al administrador que lo cambie.`);
    }
    if (!asignar && p.docenteId !== docenteId) {
      throw new BadRequestException('No eres el docente de este paralelo.');
    }
    await this.prisma.paralelo.update({ where: { id: paraleloId }, data: { docenteId: asignar ? docenteId : null } });
    return { ok: true };
  }

  // ══════════════════ Plantilla Excel ══════════════════

  /** Plantilla .xlsx con las columnas esperadas, una fila de ejemplo y ayudas. */
  async plantilla(): Promise<Buffer> {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'PREXI';
    const hoja = libro.addWorksheet('Estudiantes', { views: [{ state: 'frozen', ySplit: 1 }] });
    hoja.columns = [
      { header: 'AP. PATERNO', key: 'paterno', width: 22 },
      { header: 'AP. MATERNO', key: 'materno', width: 22 },
      { header: 'NOMBRES', key: 'nombres', width: 28 },
      { header: 'CI', key: 'ci', width: 14 },
      { header: 'RU', key: 'ru', width: 14 },
      { header: 'PARALELO', key: 'paralelo', width: 12 },
    ];
    const cabecera = hoja.getRow(1);
    cabecera.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cabecera.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } };
    cabecera.alignment = { vertical: 'middle', horizontal: 'center' };
    cabecera.height = 22;

    hoja.addRow({ paterno: 'Mamani', materno: 'Quispe', nombres: 'Juan Carlos', ci: '1234567', ru: '200012345', paralelo: 'A' });
    hoja.getRow(2).font = { italic: true, color: { argb: 'FF888888' } };
    hoja.getCell('A2').note = 'Fila de EJEMPLO: bórrala o reemplázala por tu primer estudiante.';

    // CI y RU como TEXTO: Excel no les quita ceros ni los pasa a notación científica.
    for (const col of ['D', 'E']) hoja.getColumn(col).numFmt = '@';
    for (let fila = 2; fila <= 500; fila++) {
      hoja.getCell(`F${fila}`).dataValidation = {
        type: 'textLength', operator: 'between', formulae: [1, 10], allowBlank: true,
        showErrorMessage: true, errorTitle: 'Paralelo', error: 'Escribe el paralelo, por ejemplo: A',
      };
    }

    const ayuda = libro.addWorksheet('Cómo llenar');
    ayuda.getColumn(1).width = 100;
    [
      'CÓMO LLENAR LA PLANTILLA',
      '',
      '1. Escribe un estudiante por fila en la hoja "Estudiantes".',
      '2. AP. PATERNO, NOMBRES, CI y RU son obligatorios. AP. MATERNO puede quedar vacío.',
      '3. PARALELO: la letra o nombre del paralelo (A, B, C…). Si todos van al mismo, puedes dejarlo vacío y elegirlo en PREXI.',
      '4. No importa el orden de las columnas ni si usas mayúsculas: PREXI las reconoce.',
      '5. Si ya tienes tu lista en otro Excel, no hace falta copiarla aquí: súbela tal como está.',
      '',
      'Cada estudiante entrará a PREXI con su RU como usuario y su CI como contraseña inicial.',
      'En su primer ingreso el sistema le pedirá cambiarla.',
    ].forEach((linea, i) => {
      ayuda.getCell(`A${i + 1}`).value = linea;
      if (i === 0) ayuda.getCell('A1').font = { bold: true, size: 14 };
    });

    return Buffer.from(await libro.xlsx.writeBuffer());
  }

  // ══════════════════ Lectura del archivo ══════════════════

  /** Texto plano de una celda de ExcelJS (fórmulas, texto enriquecido, fechas…). */
  private textoCelda(valor: ExcelJS.CellValue): string {
    if (valor === null || valor === undefined) return '';
    if (typeof valor === 'object') {
      if (valor instanceof Date) return valor.toISOString().slice(0, 10);
      const v = valor as { result?: unknown; richText?: { text: string }[]; text?: unknown; error?: unknown };
      if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
      if (v.result !== undefined) return String(v.result ?? '');
      if (v.text !== undefined) return String(v.text ?? '');
      return '';
    }
    return String(valor);
  }

  /** CSV sencillo: separador , ; o tabulador (el que más aparezca), con comillas. */
  private leerCsv(texto: string): string[][] {
    // Quita la marca BOM con la que Excel guarda los CSV en UTF-8.
    const sinBom = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
    const lineas = sinBom.split(/\r?\n/).filter((l) => l.trim() !== '');
    const muestra = lineas.slice(0, 5).join('\n');
    const sep = [';', '\t', ','].map((s) => ({ s, n: muestra.split(s).length })).sort((a, b) => b.n - a.n)[0].s;
    return lineas.map((linea) => {
      const celdas: string[] = [];
      let actual = '';
      let enComillas = false;
      for (let i = 0; i < linea.length; i++) {
        const c = linea[i];
        if (c === '"') {
          if (enComillas && linea[i + 1] === '"') { actual += '"'; i++; } else enComillas = !enComillas;
        } else if (c === sep && !enComillas) { celdas.push(actual); actual = ''; } else actual += c;
      }
      celdas.push(actual);
      return celdas.map((x) => x.trim());
    });
  }

  private async leerArchivo(buffer: Buffer, nombre: string): Promise<{ hoja: string; filas: string[][] }> {
    const ext = nombre.toLowerCase().split('.').pop() ?? '';
    if (ext === 'csv' || ext === 'txt') {
      return { hoja: 'CSV', filas: this.leerCsv(buffer.toString('utf8')) };
    }
    if (ext !== 'xlsx') {
      throw new BadRequestException(
        ext === 'xls'
          ? 'El formato .xls (Excel 97-2003) no se puede leer. Ábrelo en Excel y guárdalo como "Libro de Excel (.xlsx)".'
          : 'Sube un archivo de Excel (.xlsx) o un CSV.',
      );
    }
    const libro = new ExcelJS.Workbook();
    try {
      await libro.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('No se pudo abrir el archivo. Comprueba que sea un Excel (.xlsx) válido y que no tenga contraseña.');
    }
    // La hoja con más filas es la que tiene la lista (las demás suelen ser portadas o notas).
    const hoja = [...libro.worksheets].sort((a, b) => b.actualRowCount - a.actualRowCount)[0];
    if (!hoja) throw new BadRequestException('El archivo no tiene ninguna hoja con datos.');
    const filas: string[][] = [];
    hoja.eachRow({ includeEmpty: false }, (row) => {
      const valores: string[] = [];
      for (let c = 1; c <= hoja.actualColumnCount; c++) valores.push(this.textoCelda(row.getCell(c).value).trim());
      if (valores.some((v) => v !== '')) filas.push(valores);
    });
    return { hoja: hoja.name, filas };
  }

  /**
   * Lee el archivo y reconoce las columnas. Si las reglas no encuentran algún
   * dato obligatorio, pide ayuda a la IA enviando SOLO los encabezados y la
   * FORMA de unas pocas celdas (letras → "A", dígitos → "9"): nunca nombres,
   * CI ni RU reales salen del servidor.
   */
  async analizar(archivo: { buffer: Buffer; originalname: string; size: number } | undefined) {
    if (!archivo?.buffer?.length) throw new BadRequestException('Selecciona el archivo con tu lista de estudiantes.');
    if (archivo.size > MAX_LISTA_BYTES) throw new BadRequestException('El archivo es demasiado grande (máximo 5 MB).');

    const { hoja, filas } = await this.leerArchivo(archivo.buffer, archivo.originalname);
    if (filas.length === 0) throw new BadRequestException('El archivo está vacío.');
    if (filas.length > MAX_FILAS_LISTA + 20) {
      throw new BadRequestException(`La lista tiene más de ${MAX_FILAS_LISTA} filas. Divídela por paralelos y súbela en partes.`);
    }

    const det = detectarColumnas(filas);
    let mapeo: Mapeo = det.mapeo;
    let usoIa = false;

    if (det.faltantes.length > 0) {
      const sugerido = await this.mapeoConIa(det.encabezados, filas.slice(det.filaEncabezado + 1, det.filaEncabezado + 4));
      if (sugerido) {
        // La IA solo RELLENA lo que las reglas no encontraron; nunca pisa una columna ya reconocida.
        const usadas = new Set(Object.values(mapeo).filter((v) => v !== null));
        const combinado: Mapeo = { ...mapeo };
        for (const { clave } of CAMPOS) {
          const idx = sugerido[clave];
          if (combinado[clave] === null && typeof idx === 'number' && idx >= 0 && idx < det.encabezados.length && !usadas.has(idx)) {
            combinado[clave] = idx;
            usadas.add(idx);
            usoIa = true;
          }
        }
        mapeo = combinado;
      }
    }

    return {
      archivo: archivo.originalname,
      hoja,
      fila_encabezado: det.filaEncabezado,
      encabezados: det.encabezados,
      campos: CAMPOS,
      mapeo,
      faltantes: faltantesDe(mapeo),
      uso_ia: usoIa,
      total_filas: Math.max(0, filas.length - (det.filaEncabezado + 1)),
      // Las filas viajan al navegador para que el docente ajuste el mapeo sin volver a subir el archivo.
      filas,
    };
  }

  /** Enmascara una celda conservando solo su forma: "Mamani 123" → "Aaaaaa 999". */
  private forma(valor: string): string {
    return valor.slice(0, 30).replace(/[A-ZÁÉÍÓÚÑ]/g, 'A').replace(/[a-záéíóúñ]/g, 'a').replace(/\d/g, '9');
  }

  private async mapeoConIa(encabezados: string[], muestra: string[][]): Promise<Partial<Mapeo> | null> {
    try {
      return await this.ia.sugerirMapeoColumnas(encabezados, muestra.map((f) => f.map((c) => this.forma(c))));
    } catch (e) {
      // La IA es una ayuda: si no está disponible, el docente mapea a mano.
      this.logger.warn(`Mapeo con IA no disponible: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }

  // ══════════════════ Vista previa y registro ══════════════════

  private sanear(filas: FilaEstudiante[]): FilaEstudiante[] {
    if (!Array.isArray(filas) || filas.length === 0) throw new BadRequestException('No hay estudiantes para revisar.');
    if (filas.length > MAX_FILAS_LISTA) throw new BadRequestException(`Máximo ${MAX_FILAS_LISTA} estudiantes por carga.`);
    return filas.map((f, i) => ({
      fila: Number.isInteger(f.fila) ? f.fila : i + 1,
      apellidoPaterno: capitalizar(String(f.apellidoPaterno ?? '')),
      apellidoMaterno: capitalizar(String(f.apellidoMaterno ?? '')),
      nombres: capitalizar(String(f.nombres ?? '')),
      ci: limpiarCi(f.ci),
      ru: limpiarRu(f.ru),
      paralelo: limpiarParalelo(f.paralelo),
    }));
  }

  private async validar(filas: FilaEstudiante[]): Promise<FilaValidada[]> {
    const cis = filas.map((f) => f.ci).filter(Boolean);
    const rus = filas.map((f) => f.ru).filter(Boolean);
    const existentes = await this.prisma.usuario.findMany({
      where: { OR: [{ cedula: { in: cis } }, { ru: { in: rus } }] },
      select: { id: true, cedula: true, ru: true, rol: true },
    });
    return validarFilas(filas, existentes.map((e) => ({ id: e.id, ci: e.cedula, ru: e.ru, rol: e.rol })));
  }

  private resumir(filas: FilaValidada[]) {
    const porParalelo = new Map<string, number>();
    for (const f of filas) if (f.paralelo) porParalelo.set(f.paralelo, (porParalelo.get(f.paralelo) ?? 0) + 1);
    return {
      total: filas.length,
      nuevos: filas.filter((f) => f.estado === 'nuevo').length,
      existentes: filas.filter((f) => f.estado === 'existe').length,
      con_error: filas.filter((f) => f.estado === 'error').length,
      por_paralelo: [...porParalelo.entries()].map(([paralelo, n]) => ({ paralelo, n })).sort((a, b) => a.paralelo.localeCompare(b.paralelo)),
    };
  }

  /**
   * Convierte las filas crudas del archivo en estudiantes según el mapeo que el
   * docente confirmó, y devuelve directamente la vista previa validada.
   */
  async convertir(dto: { materiaId: number; filas: string[][]; filaEncabezado: number; mapeo: Mapeo; paraleloPorDefecto?: string }) {
    const faltan = faltantesDe(dto.mapeo);
    if (faltan.length > 0) throw new BadRequestException(`Falta indicar la columna de: ${faltan.join(', ')}.`);
    const estudiantes = aplicarMapeo(dto.filas, dto.filaEncabezado, dto.mapeo, dto.paraleloPorDefecto ?? '');
    if (estudiantes.length === 0) throw new BadRequestException('No se encontró ningún estudiante en el archivo con esas columnas.');
    return this.previsualizar(dto.materiaId, estudiantes);
  }

  /** Vista previa: valida sin escribir nada. */
  async previsualizar(materiaId: number, filasCrudas: FilaEstudiante[]) {
    const materia = await this.prisma.materia.findUnique({ where: { id: materiaId }, include: { paralelos: { select: { nombre: true } } } });
    if (!materia) throw new NotFoundException('Elige primero la materia.');
    const filas = await this.validar(this.sanear(filasCrudas));
    const existentesParalelos = new Set(materia.paralelos.map((p) => p.nombre));
    const resumen = this.resumir(filas);
    return {
      materia: { id: materia.id, nombre: materia.nombre, gestion: materia.gestion },
      filas,
      resumen,
      // Paralelos que aparecen en la lista y todavía no existen: se crearán al registrar.
      paralelos_nuevos: resumen.por_paralelo.map((p) => p.paralelo).filter((p) => !existentesParalelos.has(p)),
    };
  }

  /**
   * Registra a los estudiantes en UNA transacción: o entran todos los válidos o
   * no entra ninguno. Vuelve a validar en el servidor (lo que llega del
   * navegador nunca se da por bueno) y rechaza la carga si queda algún error.
   */
  async registrar(
    docenteId: number,
    dto: { materiaId: number; filas: FilaEstudiante[]; existentes?: ModoExistentes; soyDocente?: boolean },
  ) {
    const materia = await this.prisma.materia.findUnique({ where: { id: dto.materiaId } });
    if (!materia) throw new NotFoundException('Elige primero la materia.');
    const modo: ModoExistentes = dto.existentes === 'actualizar' ? 'actualizar' : 'omitir';

    const filas = await this.validar(this.sanear(dto.filas));
    const conError = filas.filter((f) => f.estado === 'error');
    if (conError.length > 0) {
      throw new BadRequestException(`Hay ${conError.length} estudiante(s) con datos por corregir. Revisa las filas marcadas en rojo.`);
    }

    const cfg = await this.prisma.configuracionSistema.findUnique({ where: { id: 1 }, select: { institucion: true } });
    const nuevos = filas.filter((f) => f.estado === 'nuevo');
    // La contraseña inicial es el CI. Se hashea ANTES de abrir la transacción (bcrypt es lento a propósito).
    const hashes = new Map<string, string>();
    for (const f of nuevos) hashes.set(f.ru, await bcrypt.hash(f.ci, 10));

    const reporte = await this.prisma.$transaction(async (tx) => {
      // 1) Paralelos: se crean los que falten, con este docente a cargo si así lo indicó.
      const paralelos = new Map<string, number>();
      for (const nombre of new Set(filas.map((f) => f.paralelo))) {
        const p = await tx.paralelo.upsert({
          where: { materiaId_nombre: { materiaId: materia.id, nombre } },
          create: { materiaId: materia.id, nombre, docenteId: dto.soyDocente === false ? null : docenteId },
          update: {},
        });
        // Paralelo que existía sin docente: el docente que carga la lista se lo asigna.
        if (p.docenteId === null && dto.soyDocente !== false) {
          await tx.paralelo.update({ where: { id: p.id }, data: { docenteId } });
        }
        paralelos.set(nombre, p.id);
      }

      const out: { nombre: string; ru: string; paralelo: string; resultado: string; usuario: string; contrasena_inicial: string }[] = [];
      for (const f of filas) {
        const base = {
          nombre: f.nombreCompleto,
          apellidoPaterno: f.apellidoPaterno,
          apellidoMaterno: f.apellidoMaterno || null,
          nombres: f.nombres,
          paralelo: f.paralelo,
          paraleloId: paralelos.get(f.paralelo)!,
        };
        if (f.estado === 'nuevo') {
          await tx.usuario.create({
            data: {
              ...base,
              cedula: f.ci, ru: f.ru, rol: 'estudiante',
              carrera: 'Ingeniería de Sistemas',
              institucion: cfg?.institucion ?? 'UPEA',
              passwordHash: hashes.get(f.ru)!,
              mustChangePassword: true,
              ranking: { create: { xpTotal: 0, rachaDias: 0 } },
            },
          });
          out.push({ nombre: f.nombreCompleto, ru: f.ru, paralelo: f.paralelo, resultado: 'Registrado', usuario: f.ru, contrasena_inicial: 'Su CI' });
        } else if (modo === 'actualizar' && f.existenteId) {
          // Solo datos de identificación y paralelo: NUNCA se toca su contraseña ni su avance.
          await tx.usuario.update({ where: { id: f.existenteId }, data: { ...base, activo: true } });
          out.push({ nombre: f.nombreCompleto, ru: f.ru, paralelo: f.paralelo, resultado: 'Actualizado', usuario: f.ru, contrasena_inicial: '(conserva la suya)' });
        } else {
          out.push({ nombre: f.nombreCompleto, ru: f.ru, paralelo: f.paralelo, resultado: 'Ya existía (omitido)', usuario: f.ru, contrasena_inicial: '(conserva la suya)' });
        }
      }

      await tx.logAuditoria.create({
        data: {
          actorId: docenteId, accion: 'estudiantes_registrar', entidad: 'usuario',
          detalle: `Registró ${nuevos.length} estudiante(s) en ${materia.nombre} ${materia.gestion} ` +
            `(${out.filter((o) => o.resultado === 'Actualizado').length} actualizados, ` +
            `${out.filter((o) => o.resultado.startsWith('Ya')).length} omitidos)`,
        },
      });
      return out;
    }, { timeout: 60_000 });

    return {
      materia: { id: materia.id, nombre: materia.nombre, gestion: materia.gestion },
      registrados: reporte.filter((r) => r.resultado === 'Registrado').length,
      actualizados: reporte.filter((r) => r.resultado === 'Actualizado').length,
      omitidos: reporte.filter((r) => r.resultado.startsWith('Ya')).length,
      acceso: 'Cada estudiante entra con su RU como usuario y su CI como contraseña. En su primer ingreso deberá cambiarla.',
      reporte,
    };
  }

  // ══════════════════ Edición y baja de un estudiante ══════════════════

  private async estudianteVisible(docenteId: number, rol: string, id: number) {
    const u = await this.prisma.usuario.findFirst({ where: { id, ...estudiantesDelDocente(docenteId, rol) } });
    if (!u) throw new NotFoundException('Estudiante no encontrado en tus paralelos.');
    return u;
  }

  /** Corrige los datos de un estudiante o lo mueve de paralelo. */
  async editar(
    docenteId: number, rol: string, id: number,
    dto: { apellidoPaterno?: string; apellidoMaterno?: string; nombres?: string; ci?: string; ru?: string; paraleloId?: number },
  ) {
    const u = await this.estudianteVisible(docenteId, rol, id);
    const data: Prisma.UsuarioUncheckedUpdateInput = {};

    const paterno = dto.apellidoPaterno !== undefined ? capitalizar(dto.apellidoPaterno) : (u.apellidoPaterno ?? '');
    const materno = dto.apellidoMaterno !== undefined ? capitalizar(dto.apellidoMaterno) : (u.apellidoMaterno ?? '');
    const nombres = dto.nombres !== undefined ? capitalizar(dto.nombres) : (u.nombres ?? '');
    if (dto.apellidoPaterno !== undefined || dto.apellidoMaterno !== undefined || dto.nombres !== undefined) {
      if (!paterno || !nombres) throw new BadRequestException('El apellido paterno y los nombres son obligatorios.');
      Object.assign(data, {
        apellidoPaterno: paterno, apellidoMaterno: materno || null, nombres,
        nombre: nombreCompletoDe({ apellidoPaterno: paterno, apellidoMaterno: materno, nombres }),
      });
    }
    if (dto.ci !== undefined) {
      const ci = limpiarCi(dto.ci);
      if (!/^\d{5,10}(-?[0-9A-Z]{1,3})?$/.test(ci)) throw new BadRequestException('El CI no tiene un formato válido.');
      const otro = await this.prisma.usuario.findFirst({ where: { cedula: ci, id: { not: id } }, select: { id: true } });
      if (otro) throw new ConflictException('Ese CI ya está registrado en otra cuenta.');
      data.cedula = ci;
    }
    if (dto.ru !== undefined) {
      const ru = limpiarRu(dto.ru);
      if (!/^\d{4,12}$/.test(ru)) throw new BadRequestException('El RU debe tener entre 4 y 12 dígitos.');
      const otro = await this.prisma.usuario.findFirst({ where: { ru, id: { not: id } }, select: { id: true } });
      if (otro) throw new ConflictException('Ese RU ya está registrado en otra cuenta.');
      data.ru = ru;
    }
    if (dto.paraleloId !== undefined) {
      const p = await this.prisma.paralelo.findUnique({ where: { id: dto.paraleloId } });
      if (!p) throw new NotFoundException('Paralelo no encontrado.');
      data.paraleloId = p.id;
      data.paralelo = p.nombre;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('No se envió ningún cambio.');
    await this.prisma.usuario.update({ where: { id }, data });
    return { ok: true };
  }

  /** Baja lógica (o reactivación). Nunca se borra: se conserva todo su historial. */
  async cambiarEstado(docenteId: number, rol: string, id: number, activo: boolean) {
    await this.estudianteVisible(docenteId, rol, id);
    await this.prisma.usuario.update({ where: { id }, data: { activo } });
    await this.prisma.logAuditoria.create({
      data: { actorId: docenteId, accion: 'usuario_estado', entidad: 'usuario', entidadId: id, detalle: activo ? 'Reactivó al estudiante' : 'Dio de baja al estudiante' },
    });
    return { ok: true, activo };
  }

  /** Vuelve a dejar el CI como contraseña y obliga a cambiarla (estudiante que la olvidó). */
  async restablecerAcceso(docenteId: number, rol: string, id: number) {
    const u = await this.estudianteVisible(docenteId, rol, id);
    if (!u.cedula) throw new BadRequestException('Este estudiante no tiene CI registrado. Complétalo primero.');
    await this.prisma.usuario.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(u.cedula, 10), mustChangePassword: true, failedLoginCount: 0, lockedUntil: null },
    });
    await this.prisma.refreshToken.updateMany({ where: { usuarioId: id, revocadoEn: null }, data: { revocadoEn: new Date() } });
    await this.prisma.logAuditoria.create({
      data: { actorId: docenteId, accion: 'password_reset', entidad: 'usuario', entidadId: id, detalle: 'El docente restableció el acceso (contraseña = CI, cambio obligatorio)' },
    });
    return { ok: true, mensaje: 'El estudiante puede entrar con su RU y su CI; deberá elegir una contraseña nueva.' };
  }
  // ── Solicitudes de inscripción (estudiantes que se registraron solos) ──

  /** Solicitudes que le toca resolver a este docente: las de sus paralelos y las de paralelos sin docente. */
  private solicitudesDe(docenteId: number, rol: string): Prisma.UsuarioWhereInput {
    return {
      rol: 'estudiante', estadoInscripcion: 'pendiente',
      ...(rol === 'admin' ? {} : { OR: [{ paraleloRef: { docenteId } }, { paraleloRef: { docenteId: null } }, { paraleloId: null }] }),
    };
  }

  async solicitudes(docenteId: number, rol: string) {
    const [pendientes, paralelos] = await Promise.all([
      this.prisma.usuario.findMany({
        where: this.solicitudesDe(docenteId, rol),
        orderBy: { inscripcionSolicitada: 'asc' },
        select: {
          id: true, nombre: true, cedula: true, ru: true, email: true, inscripcionSolicitada: true, creadoEn: true,
          paraleloRef: { select: { id: true, nombre: true, materia: { select: { nombre: true, gestion: true } } } },
        },
      }),
      // Paralelos a los que el docente puede enviar al estudiante, con cuántos tiene ya.
      this.prisma.paralelo.findMany({
        where: rol === 'admin' ? {} : { OR: [{ docenteId }, { docenteId: null }] },
        orderBy: [{ materia: { gestion: 'desc' } }, { nombre: 'asc' }],
        select: {
          id: true, nombre: true, materia: { select: { nombre: true, gestion: true } },
          _count: { select: { estudiantes: { where: { estadoInscripcion: 'aprobada', activo: true } } } },
        },
      }),
    ]);
    return {
      solicitudes: pendientes.map((u) => ({
        id: u.id, nombre: u.nombre, ci: u.cedula, ru: u.ru, email: u.email,
        fecha: u.inscripcionSolicitada ?? u.creadoEn,
        paralelo: u.paraleloRef ? { id: u.paraleloRef.id, nombre: u.paraleloRef.nombre, materia: u.paraleloRef.materia.nombre, gestion: u.paraleloRef.materia.gestion } : null,
      })),
      paralelos: paralelos.map((p) => ({ id: p.id, nombre: p.nombre, materia: p.materia.nombre, gestion: p.materia.gestion, inscritos: p._count.estudiantes })),
    };
  }

  /** Cuántas solicitudes esperan respuesta (para el aviso del menú). */
  async conteoSolicitudes(docenteId: number, rol: string) {
    return { pendientes: await this.prisma.usuario.count({ where: this.solicitudesDe(docenteId, rol) }) };
  }

  private async solicitudPropia(id: number, docenteId: number, rol: string) {
    const u = await this.prisma.usuario.findFirst({ where: { id, ...this.solicitudesDe(docenteId, rol) }, select: { id: true, paraleloId: true } });
    if (!u) throw new NotFoundException('Esa solicitud ya fue resuelta o no es de tus paralelos');
    return u;
  }

  /** Acepta al estudiante, en el paralelo que pidió o en otro que el docente elija. */
  async aceptarSolicitud(id: number, docenteId: number, rol: string, paraleloId?: number) {
    const u = await this.solicitudPropia(id, docenteId, rol);
    const destino = paraleloId ?? u.paraleloId;
    if (!destino) throw new BadRequestException('Elige el paralelo en el que queda el estudiante');
    const paralelo = await this.prisma.paralelo.findUnique({ where: { id: destino }, select: { id: true, nombre: true, docenteId: true } });
    if (!paralelo) throw new BadRequestException('El paralelo elegido no existe');
    if (rol !== 'admin' && paralelo.docenteId !== null && paralelo.docenteId !== docenteId) {
      throw new BadRequestException('Solo puedes aceptar estudiantes en tus propios paralelos');
    }
    await this.prisma.usuario.update({
      where: { id },
      data: { estadoInscripcion: 'aprobada', inscripcionMotivo: null, paraleloId: paralelo.id, paralelo: paralelo.nombre },
    });
    try {
      await this.prisma.notificacion.create({
        data: { usuarioId: id, tipo: 'inscripcion_aceptada', titulo: 'Ya estás en el curso', mensaje: `Tu docente aceptó tu inscripción en el paralelo ${paralelo.nombre}.`, enlace: '/dashboard' },
      });
    } catch { /* el aviso no debe impedir aceptar */ }
    return { ok: true };
  }

  async rechazarSolicitud(id: number, docenteId: number, rol: string, motivo?: string) {
    await this.solicitudPropia(id, docenteId, rol);
    await this.prisma.usuario.update({
      where: { id },
      data: { estadoInscripcion: 'rechazada', inscripcionMotivo: motivo?.trim() || null },
    });
    return { ok: true };
  }
}
