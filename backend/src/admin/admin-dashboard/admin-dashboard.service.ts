import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminUsuariosService } from '../admin-usuarios/admin-usuarios.service';
import { AdminAuditoriaService } from '../admin-auditoria/admin-auditoria.service';
import { AdminContenidoService } from '../admin-contenido/admin-contenido.service';

const MS_DIA = 86_400_000;
const MS_SEMANA = 7 * MS_DIA;

/** Algo que el administrador debería revisar, con el lugar donde se resuelve. */
export interface Pendiente {
  clave: string;
  tono: 'rojo' | 'ambar' | 'azul';
  titulo: string;
  detalle: string;
  enlace: string;
  accion: string;
}

/**
 * PANEL DEL ADMINISTRADOR: cómo está el sistema y qué requiere su atención.
 * Compone conteos de usuarios, cursos, contenido, IA y auditoría (todo sale de
 * la base: nada se calcula en el navegador).
 */
@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usuarios: AdminUsuariosService,
    private readonly auditoria: AdminAuditoriaService,
    private readonly contenido: AdminContenidoService,
    private readonly config: ConfigService,
  ) {}

  async resumen() {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const hace7 = new Date(Date.now() - MS_SEMANA);
    const ahora = new Date();

    const [
      porRol, ejercicios, estudiantes, activosRows, auditoria,
      sinDocente, solicitudes, bloqueadas, temporales, inactivos, cfg, consultasIa, contenido, retos,
    ] = await Promise.all([
      this.usuarios.conteos(),
      this.prisma.ejercicio.count({ where: { activo: true, banco: 'practica' } }),
      this.prisma.usuario.findMany({ where: { rol: 'estudiante' }, select: { activo: true } }),
      this.prisma.intento.findMany({ where: { fecha: { gte: hace7 } }, distinct: ['usuarioId'], select: { usuarioId: true } }),
      this.auditoria.listar({ limit: 8 }),
      this.prisma.paralelo.findMany({ where: { docenteId: null }, select: { nombre: true, materia: { select: { nombre: true, gestion: true } } } }),
      this.prisma.usuario.count({ where: { rol: 'estudiante', estadoInscripcion: 'pendiente' } }),
      this.prisma.usuario.count({ where: { lockedUntil: { gt: ahora } } }),
      this.prisma.usuario.count({ where: { mustChangePassword: true, activo: true } }),
      this.prisma.usuario.count({ where: { activo: false } }),
      this.prisma.configuracionSistema.findUnique({ where: { id: 1 } }),
      this.prisma.consultaIa.count({ where: { fecha: { gte: hace7 } } }),
      this.contenido.resumen(),
      this.prisma.reto.count({ where: { activo: true } }),
    ]);

    const totalUsuarios = Object.values(porRol).reduce((a, b) => a + b, 0);
    const estudio = { estudiantes: estudiantes.length, activos: estudiantes.filter((e) => e.activo).length };

    // Nuevos registros por semana (últimas 6 semanas).
    const desde6 = new Date(hoy.getTime() - 6 * MS_SEMANA);
    const nuevos = await this.prisma.usuario.findMany({ where: { creadoEn: { gte: desde6 } }, select: { creadoEn: true } });
    const registros: { semana: string; nuevos: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const ini = new Date(hoy.getTime() - i * MS_SEMANA - 6 * MS_DIA);
      const fin = new Date(hoy.getTime() - i * MS_SEMANA + MS_DIA);
      registros.push({ semana: ini.toISOString().slice(0, 10), nuevos: nuevos.filter((u) => u.creadoEn >= ini && u.creadoEn < fin).length });
    }

    // ── Estado del sistema ──
    const iaClave = !!this.config.get<string>('GEMINI_API_KEY')?.trim();
    const iaActiva = cfg?.iaActiva ?? true;
    const salud = {
      ia: {
        clave_configurada: iaClave,
        activa: iaActiva,
        // El modelo del entorno manda sobre el de la base (ver TutorIaService).
        modelo: this.config.get<string>('GEMINI_MODEL')?.trim() || cfg?.modeloIa || null,
        consultas_7_dias: consultasIa,
      },
      periodo: cfg?.periodo ?? null,
      institucion: cfg?.institucion ?? null,
      fase_evaluacion: cfg?.faseEvaluacionActiva ?? false,
    };

    // ── Qué requiere atención (de lo más urgente a lo informativo) ──
    const pendientes: Pendiente[] = [];
    if (!iaClave) {
      pendientes.push({
        clave: 'ia_clave', tono: 'rojo', titulo: 'La IA (PREXI) no tiene clave configurada',
        detalle: 'Falta GEMINI_API_KEY en el servidor: el tutor, las pistas y la generación de ejercicios no responden.',
        enlace: '/admin/sistema?seccion=ia', accion: 'Ver la IA',
      });
    } else if (!iaActiva) {
      pendientes.push({
        clave: 'ia_apagada', tono: 'ambar', titulo: 'PREXI está apagado',
        detalle: 'Ningún rol puede usar la IA hasta que la vuelvas a encender.', enlace: '/admin/sistema?seccion=ia', accion: 'Encender',
      });
    }
    if (sinDocente.length) {
      pendientes.push({
        clave: 'sin_docente', tono: 'rojo', titulo: `${sinDocente.length} paralelo(s) sin docente`,
        detalle: `Nadie acepta las solicitudes ni sigue a esos estudiantes: ${sinDocente.slice(0, 3).map((p) => `${p.materia.nombre} ${p.materia.gestion} · ${p.nombre}`).join(', ')}${sinDocente.length > 3 ? '…' : ''}.`,
        enlace: '/admin/cursos', accion: 'Asignar docente',
      });
    }
    if (solicitudes) {
      pendientes.push({
        clave: 'solicitudes', tono: 'ambar', titulo: `${solicitudes} solicitud(es) de inscripción esperan respuesta`,
        detalle: 'Estudiantes que se registraron solos y esperan que su docente los acepte para rendir el diagnóstico.',
        enlace: '/admin/cursos', accion: 'Ver por paralelo',
      });
    }
    if (bloqueadas) {
      pendientes.push({
        clave: 'bloqueadas', tono: 'ambar', titulo: `${bloqueadas} cuenta(s) bloqueada(s) por intentos fallidos`,
        detalle: 'Se desbloquean solas a los 15 minutos, o al restablecer la contraseña.', enlace: '/admin/usuarios?estado=bloqueado', accion: 'Ver cuentas',
      });
    }
    const temasIncompletos = contenido.totales.temas - contenido.totales.temas_completos;
    if (temasIncompletos > 0) {
      pendientes.push({
        clave: 'contenido', tono: 'azul', titulo: `${temasIncompletos} tema(s) sin los 10 ejercicios por nivel`,
        detalle: `Faltan ${contenido.totales.faltan} ejercicios en total. Los docentes los completan desde Unidades.`,
        enlace: '/admin/contenido', accion: 'Ver el contenido',
      });
    }
    if (contenido.totales.unidades_sin_examen_completo) {
      pendientes.push({
        clave: 'examen', tono: 'azul', titulo: `${contenido.totales.unidades_sin_examen_completo} unidad(es) con examen de menos de 10 preguntas`,
        detalle: 'El examen de unidad debe tener 10 preguntas.', enlace: '/admin/contenido', accion: 'Ver el contenido',
      });
    }

    return {
      stats: {
        total_usuarios: totalUsuarios,
        estudiantes_activos: activosRows.length,
        ejercicios,
        retos,
        docentes: porRol.docente,
        admins: porRol.admin,
        investigadores: porRol.investigador,
        estudiantes: porRol.estudiante,
        contrasenas_temporales: temporales,
        inactivos,
      },
      distribucion_roles: [
        { rol: 'estudiante', total: porRol.estudiante },
        { rol: 'docente', total: porRol.docente },
        { rol: 'investigador', total: porRol.investigador },
        { rol: 'admin', total: porRol.admin },
      ],
      estudio,
      registros_por_semana: registros,
      actividad_reciente: auditoria.logs,
      pendientes,
      salud,
      contenido: contenido.totales,
    };
  }
}
