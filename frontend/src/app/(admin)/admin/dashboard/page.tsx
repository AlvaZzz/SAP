'use client';

/**
 * PANEL DEL ADMINISTRADOR. Como el del docente: saludo, lo que requiere su
 * atención (cada aviso lleva a donde se resuelve), los números del sistema,
 * accesos directos, el estado de la IA y la actividad reciente.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { nombreDePila } from '@/lib/prexi-amable';
import { useAuth } from '@/providers/auth-provider';
import { Card, StatCard, StatGrid, SectionTitle, Skeleton, Badge, EmptyState } from '@/components/ui';
import {
  Users, UserCheck, Code, Settings, ClipboardList, GraduationCap, Layers, Bot, AlertTriangle, CheckCircle, ArrowRight,
  KeyRound, Target, FlaskConical, BookOpen,
} from '@/components/icons';
import { etiquetaAccion, tonoAccion } from '@/components/admin/acciones';

interface Pendiente { clave: string; tono: 'rojo' | 'ambar' | 'azul'; titulo: string; detalle: string; enlace: string; accion: string }
interface Dashboard {
  stats: {
    total_usuarios: number; estudiantes_activos: number; ejercicios: number; retos: number; docentes: number; admins: number;
    investigadores: number; estudiantes: number; contrasenas_temporales: number; inactivos: number;
  };
  distribucion_roles: { rol: string; total: number }[];
  registros_por_semana: { semana: string; nuevos: number }[];
  actividad_reciente: { id: number; actor: string; accion: string; detalle: string; fecha: string }[];
  pendientes: Pendiente[];
  salud: { ia: { clave_configurada: boolean; activa: boolean; modelo: string | null; consultas_7_dias: number }; periodo: string | null; institucion: string | null; fase_evaluacion: boolean };
  contenido: { temas: number; temas_completos: number; ejercicios: number; faltan: number; retos: number };
}

const ROL: Record<string, { nombre: string; color: string; href: string }> = {
  estudiante: { nombre: 'Estudiantes', color: '#3B82F6', href: '/admin/usuarios?rol=estudiante' },
  docente: { nombre: 'Docentes', color: '#10B981', href: '/admin/usuarios?rol=docente' },
  investigador: { nombre: 'Investigadores', color: '#8B5CF6', href: '/admin/usuarios?rol=investigador' },
  admin: { nombre: 'Administradores', color: '#F59E0B', href: '/admin/usuarios?rol=admin' },
};
const TONO = {
  rojo: { borde: 'border-red-500/40', fondo: 'bg-red-500/10', icono: 'text-prexi-red' },
  ambar: { borde: 'border-amber-500/40', fondo: 'bg-amber-500/10', icono: 'text-prexi-amber' },
  azul: { borde: 'border-prexi-blue/35', fondo: 'bg-prexi-blue/10', icono: 'text-prexi-blue-deep' },
};
const ACCESOS = [
  { href: '/admin/usuarios?nuevo=1', titulo: 'Crear un usuario', texto: 'Docentes, investigadores o administradores', icon: Users, color: '#3B82F6' },
  { href: '/admin/cursos', titulo: 'Asignar docentes', texto: 'Materias, paralelos y quién los dicta', icon: GraduationCap, color: '#10B981' },
  { href: '/admin/contenido', titulo: 'Revisar el contenido', texto: 'Ejercicios, exámenes y retos por tema', icon: Layers, color: '#8B5CF6' },
  { href: '/admin/sistema', titulo: 'Configurar el sistema', texto: 'Reglas de avance, IA y evaluación', icon: Settings, color: '#F59E0B' },
];

export default function AdminDashboardPage() {
  const { usuario } = useAuth();
  const [d, setD] = useState<Dashboard | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<Dashboard>('/admin/dashboard').then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  const maxReg = d ? Math.max(1, ...d.registros_por_semana.map((r) => r.nuevos)) : 1;
  const totalRoles = d ? Math.max(1, d.distribucion_roles.reduce((s, r) => s + r.total, 0)) : 1;
  const hora = (f: string) => new Date(f).toLocaleString('es-BO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl lg:text-4xl">Hola, {nombreDePila(usuario)}</h1>
      <p className="mb-6 mt-1 text-base text-muted">
        Así está PREXI hoy{d?.salud.institucion ? ` en ${d.salud.institucion}` : ''}{d?.salud.periodo ? ` · gestión ${d.salud.periodo}` : ''}. Empieza por lo que requiere tu atención.
      </p>

      {/* ── Qué requiere atención ── */}
      <section aria-labelledby="atencion" className="mb-6">
        {cargando ? <Skeleton className="h-24" /> : !d || d.pendientes.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-prexi-green/40 bg-prexi-green/10 px-5 py-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-prexi-green text-white"><CheckCircle className="h-6 w-6" /></span>
            <div>
              <p id="atencion" className="font-display text-lg font-bold text-fg">Todo en orden</p>
              <p className="text-sm text-muted">Cada paralelo tiene docente, la IA está configurada y el contenido está completo.</p>
            </div>
          </div>
        ) : (
          <>
            <h2 id="atencion" className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-fg">
              <AlertTriangle className="h-5 w-5 text-prexi-amber" /> Requiere tu atención <Badge tone="amber">{d.pendientes.length}</Badge>
            </h2>
            <ul className="grid gap-3 lg:grid-cols-2">
              {d.pendientes.map((p) => {
                const t = TONO[p.tono];
                return (
                  <li key={p.clave} className={`flex flex-wrap items-center gap-3 rounded-2xl border ${t.borde} ${t.fondo} px-4 py-3.5`}>
                    <AlertTriangle className={`h-5 w-5 shrink-0 ${t.icono}`} />
                    <div className="min-w-[200px] flex-1">
                      <p className="font-semibold text-fg">{p.titulo}</p>
                      <p className="text-sm text-muted">{p.detalle}</p>
                    </div>
                    <Link href={p.enlace} className="btn-ghost shrink-0 !py-2 text-sm">{p.accion} <ArrowRight className="h-4 w-4" /></Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* ── Números del sistema ── */}
      <StatGrid className="mb-6">
        {cargando ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />) : (
          <>
            <StatCard icon={<Users className="h-7 w-7" />} accent="blue" label="Usuarios" value={d?.stats.total_usuarios ?? 0} />
            <StatCard icon={<UserCheck className="h-7 w-7" />} accent="green" label="Estudiantes activos (7 días)" value={`${d?.stats.estudiantes_activos ?? 0} de ${d?.stats.estudiantes ?? 0}`} />
            <StatCard icon={<Code className="h-7 w-7" />} accent="navy" label="Ejercicios de práctica" value={d?.stats.ejercicios ?? 0} />
            <StatCard icon={<Target className="h-7 w-7" />} accent="amber" label="Retos publicados" value={d?.stats.retos ?? 0} />
          </>
        )}
      </StatGrid>

      {/* ── Accesos directos ── */}
      <h2 className="mb-3 font-display text-lg font-bold text-fg">¿Qué quieres hacer?</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ACCESOS.map(({ href, titulo, texto, icon: Icon, color }) => (
          <Link key={href} href={href} className="group flex items-start gap-3 rounded-2xl border border-line bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-prexi-blue/40">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ color, backgroundColor: `${color}1F` }}><Icon className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 font-semibold text-fg">{titulo} <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" /></span>
              <span className="block text-sm text-muted">{texto}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Personas por rol */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>Personas en el sistema</SectionTitle>
            <Link href="/admin/usuarios" className="text-sm font-semibold text-prexi-blue-deep hover:underline">Gestionar usuarios</Link>
          </div>
          {cargando ? <Skeleton className="h-32" /> : (
            <>
              {/* Barra apilada: cuánto pesa cada rol */}
              <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-subtle">
                {d?.distribucion_roles.map((r) => <span key={r.rol} style={{ width: `${(r.total / totalRoles) * 100}%`, backgroundColor: ROL[r.rol].color }} />)}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {d?.distribucion_roles.map((r) => (
                  <Link key={r.rol} href={ROL[r.rol].href} className="rounded-xl border border-line px-3 py-3 transition hover:bg-subtle">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-muted"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ROL[r.rol].color }} />{ROL[r.rol].nombre}</span>
                    <span className="mt-1 block font-display text-2xl font-extrabold text-fg">{r.total}</span>
                  </Link>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <Link href="/admin/usuarios?estado=temporal" className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-3 py-1.5 text-muted hover:text-fg">
                  <KeyRound className="h-4 w-4" /> {d?.stats.contrasenas_temporales ?? 0} aún no cambian su contraseña inicial
                </Link>
                {(d?.stats.inactivos ?? 0) > 0 && (
                  <Link href="/admin/usuarios?estado=inactivo" className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-3 py-1.5 text-muted hover:text-fg">
                    {d?.stats.inactivos} cuenta(s) desactivada(s)
                  </Link>
                )}
              </div>
            </>
          )}
        </Card>

        {/* Estado del sistema */}
        <Card>
          <SectionTitle className="mb-4">Estado del sistema</SectionTitle>
          {cargando || !d ? <Skeleton className="h-32" /> : (
            <ul className="space-y-3 text-sm">
              <Estado ok={d.salud.ia.clave_configurada && d.salud.ia.activa} icon={Bot} titulo="Tutor PREXI (IA)"
                texto={!d.salud.ia.clave_configurada ? 'Sin clave: no responde' : !d.salud.ia.activa ? 'Apagado por el administrador' : `${d.salud.ia.consultas_7_dias} consultas en 7 días${d.salud.ia.modelo ? ` · ${d.salud.ia.modelo}` : ''}`} />
              <Estado ok={d.contenido.faltan === 0} icon={Layers} titulo="Contenido"
                texto={d.contenido.faltan === 0 ? `${d.contenido.temas} temas completos (10 por nivel)` : `${d.contenido.temas_completos} de ${d.contenido.temas} temas completos`} />
              <Estado ok icon={FlaskConical} titulo="Evaluación del sistema"
                texto={d.salud.fase_evaluacion ? 'Abierta: estudiantes y docentes ven los cuestionarios' : 'Cerrada'} />
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Registros por semana */}
        <Card className="lg:col-span-2">
          <SectionTitle className="mb-5">Cuentas nuevas por semana</SectionTitle>
          {cargando ? <Skeleton className="h-40" /> : (
            <div className="flex h-40 items-end gap-3">
              {d?.registros_por_semana.map((r) => (
                <div key={r.semana} className="flex flex-1 flex-col items-center gap-2" title={`${r.nuevos} cuentas nuevas`}>
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div className="w-full max-w-[44px] rounded-t-lg bg-prexi-blue transition-all duration-700" style={{ height: `${(r.nuevos / maxReg) * 100}%`, minHeight: r.nuevos ? '6px' : '0' }} />
                  </div>
                  <span className="text-2xs font-semibold text-fg">{r.nuevos}</span>
                  <span className="text-2xs text-muted">{new Date(r.semana + 'T00:00').toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Otras áreas */}
        <Card>
          <SectionTitle className="mb-1">Entrar como…</SectionTitle>
          <p className="mb-4 text-sm text-muted">Como administrador puedes ver las demás áreas.</p>
          <div className="space-y-2">
            <Link href="/docente/dashboard" className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 transition hover:bg-subtle">
              <BookOpen className="h-5 w-5 text-prexi-green" /><span className="flex-1 text-sm font-semibold text-fg">Área docente</span><ArrowRight className="h-4 w-4 text-muted" />
            </Link>
            <Link href="/investigador/indice" className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 transition hover:bg-subtle">
              <FlaskConical className="h-5 w-5 text-violet-500" /><span className="flex-1 text-sm font-semibold text-fg">Investigación</span><ArrowRight className="h-4 w-4 text-muted" />
            </Link>
          </div>
        </Card>
      </div>

      {/* Actividad reciente */}
      <Card className="mt-6">
        <div className="mb-4 flex items-center justify-between"><SectionTitle>Actividad reciente</SectionTitle><Link href="/admin/auditoria" className="text-sm font-semibold text-prexi-blue-deep hover:underline">Ver todo</Link></div>
        {cargando ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          : d && d.actividad_reciente.length > 0 ? (
            <div className="divide-y divide-line">
              {d.actividad_reciente.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <Badge tone={tonoAccion(a.accion)}>{etiquetaAccion(a.accion)}</Badge>
                  <span className="shrink-0 text-xs text-muted sm:order-last">{hora(a.fecha)}</span>
                  {/* En celular el detalle va en su propia línea, para que no se comprima. */}
                  <p className="w-full min-w-0 break-words text-sm text-fg sm:w-auto sm:flex-1">{a.detalle} <span className="text-muted">· {a.actor}</span></p>
                </div>
              ))}
            </div>
          ) : <EmptyState icon={<ClipboardList className="h-7 w-7" />} title="Sin actividad todavía" hint="Aquí aparecen las acciones importantes: cuentas creadas, cambios de rol, configuración…" />}
      </Card>
    </div>
  );
}

function Estado({ ok, icon: Icon, titulo, texto }: { ok: boolean; icon: typeof Bot; titulo: string; texto: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${ok ? 'bg-prexi-green/15 text-prexi-green' : 'bg-red-500/15 text-prexi-red'}`}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-semibold text-fg">{titulo} {ok ? <CheckCircle className="h-4 w-4 text-prexi-green" /> : <AlertTriangle className="h-4 w-4 text-prexi-red" />}</span>
        <span className="block text-muted">{texto}</span>
      </span>
    </li>
  );
}
