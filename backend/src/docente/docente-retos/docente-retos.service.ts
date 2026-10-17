import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TutorIaService } from '../../tutor-ia/tutor-ia.service';
import { CrearRetoDto, EditarRetoDto, SugerirRetosDto } from './dto/reto.dto';
import { nivelDesdeEstrellas } from '../../common/niveles/nivel-dificultad';
import { retosDelDocente, puedeGestionarReto } from './alcance';

/** Cuántas propuestas trae PREXI cada vez que el docente le pide ayuda. */
export const RETOS_POR_PEDIDO = 3;

/**
 * Gestión de retos (rol docente). Cada docente solo administra SUS retos:
 * el autor se valida contra el JWT en editar/eliminar (no confía en el cliente).
 * La REVISIÓN de entregas vive en su propio dominio (docente-revisiones/).
 */
@Injectable()
export class DocenteRetosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tutorIa: TutorIaService,
  ) {}

  /**
   * PREXI propone retos para un tema o subtema, ubicándolo en su unidad. Solo
   * devuelve propuestas: el docente elige una, la corrige y la guarda él.
   */
  async sugerir(dto: SugerirRetosDto) {
    const tema = await this.prisma.tema.findUnique({
      where: { id: dto.temaId },
      include: { unidad: { select: { numero: true, titulo: true } }, padre: { select: { numero: true, titulo: true } } },
    });
    if (!tema) throw new BadRequestException('El tema seleccionado no existe');
    const propuestas = await this.tutorIa.proponerRetos({
      tipo: dto.tipo, nivel: dto.nivel, cantidad: RETOS_POR_PEDIDO,
      unidad: `Unidad ${tema.unidad.numero}: ${tema.unidad.titulo}`,
      tema: `${tema.numero} ${tema.titulo}`,
      temaPadre: tema.padre ? `${tema.padre.numero} ${tema.padre.titulo}` : null,
      descripcion: tema.descripcion, indicacion: dto.indicacion,
    });
    return { propuestas };
  }

  /** El tema (o subtema) asociado debe existir: de él cuelga la unidad con la que
   *  se agrupa el reto en la vista del estudiante. */
  private async validarTema(temaId?: number | null) {
    if (!temaId) return;
    const tema = await this.prisma.tema.findUnique({ where: { id: temaId } });
    if (!tema) throw new BadRequestException('El tema seleccionado no existe');
  }

  /**
   * Un reto de "encuentra el bug" se corrige solo, comparando la salida del
   * estudiante con la esperada: sin código con el error o sin esa salida no hay
   * nada que corregir ni contra qué comparar.
   */
  private validarBug(r: { esBugHunt?: boolean | null; codigoInicial?: string | null; ejemploSalida?: string | null }) {
    if (!r.esBugHunt) return;
    if (!r.codigoInicial?.trim()) throw new BadRequestException('Un reto de «Encuentra el bug» necesita el código con el error.');
    if (!r.ejemploSalida?.trim()) throw new BadRequestException('Un reto de «Encuentra el bug» necesita la salida correcta: con ella se corrige solo.');
  }

  async listar(autorId: number) {
    const retos = await this.prisma.reto.findMany({
      where: retosDelDocente(autorId),
      orderBy: { creadoEn: 'desc' },
      include: {
        nivel: { select: { numero: true, titulo: true } },
        tema: { select: { numero: true, titulo: true } },
        _count: { select: { resueltos: { where: { resuelto: true } } } },
      },
    });
    // Conteo de entregas pendientes por reto (para el badge "por revisar").
    const pendientesPorReto = await this.prisma.retoUsuario.groupBy({
      by: ['retoId'],
      where: { estado: 'pendiente_revision', reto: retosDelDocente(autorId) },
      _count: { _all: true },
    });
    const pendMap = new Map(pendientesPorReto.map((p) => [p.retoId, p._count._all]));
    return retos.map((r) => ({
      id: r.id, titulo: r.titulo, categoria: r.categoria,
      nivel: r.nivel?.numero ?? null, nivel_titulo: r.nivel?.titulo ?? null,
      temaId: r.temaId, tema_titulo: r.tema ? `${r.tema.numero} ${r.tema.titulo}` : null,
      estrellas: r.estrellas, nivel_dificultad: r.nivelDificultad, tipo: r.tipo, enunciado: r.enunciado, codigoInicial: r.codigoInicial,
      ejemploEntrada: r.ejemploEntrada, ejemploSalida: r.ejemploSalida,
      xp: r.xp, fechaLimite: r.fechaLimite, activo: r.activo, esBugHunt: r.esBugHunt,
      resueltos: r._count.resueltos, pendientes: pendMap.get(r.id) ?? 0, creadoEn: r.creadoEn,
    }));
  }

  /** Obtiene un reto verificando que el docente pueda gestionarlo (suyo o del banco del curso). */
  private async propio(id: number, autorId: number) {
    const r = await this.prisma.reto.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Reto no encontrado');
    if (!puedeGestionarReto(r, autorId)) throw new ForbiddenException('No puedes gestionar retos de otro docente');
    return r;
  }

  async crear(autorId: number, dto: CrearRetoDto) {
    await this.validarTema(dto.temaId);
    this.validarBug(dto);
    const r = await this.prisma.reto.create({
      data: {
        titulo: dto.titulo,
        categoria: dto.categoria,
        // `Reto.nivelId` es opcional: el reto ya no cuelga del modelo viejo.
        nivelId: null,
        temaId: dto.temaId ?? null,
        estrellas: dto.estrellas,
        // El nivel decide a QUÉ estudiantes se les muestra el reto (los que están
        // en ese nivel en el tema): sin esto todo reto quedaba como básico.
        nivelDificultad: nivelDesdeEstrellas(dto.estrellas),
        tipo: dto.tipo ?? 'completar_codigo',
        enunciado: dto.enunciado,
        codigoInicial: dto.codigoInicial ?? null,
        ejemploEntrada: dto.ejemploEntrada ?? null,
        ejemploSalida: dto.ejemploSalida ?? null,
        xp: dto.xp,
        fechaLimite: dto.fechaLimite ? new Date(dto.fechaLimite) : null,
        activo: dto.activo ?? true,
        esBugHunt: dto.esBugHunt ?? false,
        autorId,
      },
    });
    return { id: r.id };
  }

  async editar(id: number, autorId: number, dto: EditarRetoDto) {
    const actual = await this.propio(id, autorId);
    await this.validarTema(dto.temaId ?? undefined);
    this.validarBug({
      esBugHunt: dto.esBugHunt ?? actual.esBugHunt,
      codigoInicial: dto.codigoInicial ?? actual.codigoInicial,
      ejemploSalida: dto.ejemploSalida ?? actual.ejemploSalida,
    });
    await this.prisma.reto.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo } : {}),
        ...(dto.categoria !== undefined ? { categoria: dto.categoria } : {}),
        ...(dto.temaId !== undefined ? { temaId: dto.temaId } : {}),
        ...(dto.estrellas !== undefined ? { estrellas: dto.estrellas, nivelDificultad: nivelDesdeEstrellas(dto.estrellas) } : {}),
        ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
        ...(dto.enunciado !== undefined ? { enunciado: dto.enunciado } : {}),
        ...(dto.codigoInicial !== undefined ? { codigoInicial: dto.codigoInicial } : {}),
        ...(dto.ejemploEntrada !== undefined ? { ejemploEntrada: dto.ejemploEntrada } : {}),
        ...(dto.ejemploSalida !== undefined ? { ejemploSalida: dto.ejemploSalida } : {}),
        ...(dto.xp !== undefined ? { xp: dto.xp } : {}),
        ...(dto.fechaLimite !== undefined ? { fechaLimite: dto.fechaLimite ? new Date(dto.fechaLimite) : null } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        ...(dto.esBugHunt !== undefined ? { esBugHunt: dto.esBugHunt } : {}),
      },
    });
    return { ok: true };
  }

  async alternarActivo(id: number, autorId: number) {
    const r = await this.propio(id, autorId);
    await this.prisma.reto.update({ where: { id }, data: { activo: !r.activo } });
    return { ok: true, activo: !r.activo };
  }

  async eliminar(id: number, autorId: number) {
    await this.propio(id, autorId);
    await this.prisma.reto.delete({ where: { id } });
    return { ok: true };
  }

  // ── Habilitación del módulo RETOS (interruptor único del docente) ──
  //  El docente decide SI el módulo está activo; ya NO decide para qué niveles.
  //  Cada reto se muestra al estudiante cuyo nivel EN ESE TEMA coincide con el del
  //  reto (motor adaptativo, ver modulos/retos/retos.service.ts).
  async configuracion() {
    const cfg = await this.prisma.configuracionSistema.findUnique({
      where: { id: 1 },
      select: { retosHabilitado: true, retosIntermedioHabilitado: true, retosAvanzadoHabilitado: true },
    });
    return {
      habilitado: cfg?.retosHabilitado ?? false,
      // Se siguen devolviendo por compatibilidad con la interfaz anterior; ya no
      // gobiernan el acceso (ver nota en el esquema).
      intermedio: cfg?.retosIntermedioHabilitado ?? false,
      avanzado: cfg?.retosAvanzadoHabilitado ?? false,
    };
  }

  async actualizarConfiguracion(dto: { habilitado?: boolean; intermedio?: boolean; avanzado?: boolean }) {
    await this.prisma.configuracionSistema.update({
      where: { id: 1 },
      data: {
        ...(dto.habilitado !== undefined ? { retosHabilitado: dto.habilitado } : {}),
        // Compat: si una interfaz antigua manda solo los flags por nivel, se
        // interpreta que quiere el módulo activo.
        ...(dto.habilitado === undefined && (dto.intermedio || dto.avanzado) ? { retosHabilitado: true } : {}),
        ...(dto.intermedio !== undefined ? { retosIntermedioHabilitado: dto.intermedio } : {}),
        ...(dto.avanzado !== undefined ? { retosAvanzadoHabilitado: dto.avanzado } : {}),
      },
    });
    return this.configuracion();
  }
}
