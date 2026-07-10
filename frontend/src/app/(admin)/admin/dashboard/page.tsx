'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { Card, StatCard, SectionTitle, Skeleton, Badge, EmptyState } from '@/components/ui';
import { Users, UserCheck, Code, FlaskConical, Settings, ClipboardList, ArrowRight } from '@/components/icons';

interface Dashboard {
  stats: { total_usuarios: number; estudiantes_activos: number; ejercicios: number; docentes: number; admins: number; investigadores: number };
  distribucion_roles: { rol: string; total: number }[];
  estudio: { control: number; experimental: number };
  registros_por_semana: { semana: string; nuevos: number }[];
  actividad_reciente: { id: number; actor: string; accion: string; detalle: string; fecha: string }[];
}

const ROL_LABEL: Record<string, string> = { estudiante: 'Estudiantes', docente: 'Docentes', investigador: 'Investigadores', admin: 'Admins' };
const ACCESOS = [
  { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
  { href: '/admin/grupos', label: 'Grupos', icon: FlaskConical },
  { href: '/admin/sistema', label: 'Sistema', icon: Settings },
  { href: '/admin/auditoria', label: 'Auditoría', icon: ClipboardList },
];

function accionLabel(a: string): string {
  return ({
    usuario_crear: 'Creó usuario', usuario_editar: 'Editó usuario', usuario_estado: 'Cambió estado',
    rol_cambiar: 'Cambió rol', grupo_cambiar: 'Cambió grupo', config_cambiar: 'Cambió config', password_reset: 'Reseteó contraseña',
  } as Record<string, string>)[a] ?? a;
}

export default function AdminDashboardPage() {
  const { usuario } = useAuth();
  const [d, setD] = useState<Dashboard | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<Dashboard>('/admin/dashboard').then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  const maxRol = d ? Math.max(1, ...d.distribucion_roles.map((r) => r.total)) : 1;
  const maxReg = d ? Math.max(1, ...d.registros_por_semana.map((r) => r.nuevos)) : 1;
  const totalEstudio = d ? d.estudio.control + d.estudio.experimental : 0;
  const hora = (f: string) => new Date(f).toLocaleString('es-BO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl lg:text-4xl">Panel de administración</h1>
      <p className="mb-7 mt-1 text-[15px] text-muted">Estado técnico del sistema, {usuario?.nombre.split(' ')[0]}.</p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        {cargando ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />) : (
          <>
            <StatCard icon={<Users className="h-7 w-7" />} accent="blue" label="Usuarios totales" value={d?.stats.total_usuarios ?? 0} />
            <StatCard icon={<UserCheck className="h-7 w-7" />} accent="green" label="Estudiantes activos" value={d?.stats.estudiantes_activos ?? 0} />
            <StatCard icon={<Code className="h-7 w-7" />} accent="navy" label="Ejercicios" value={d?.stats.ejercicios ?? 0} />
            <StatCard icon={<Settings className="h-7 w-7" />} accent="blue" label="Docentes / Admins" value={`${d?.stats.docentes ?? 0} / ${d?.stats.admins ?? 0}`} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Distribución por rol */}
        <Card className="lg:col-span-2">
          <SectionTitle className="mb-5">Distribución de usuarios por rol</SectionTitle>
          {cargando ? <div className="space-y-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8" />)}</div> : (
            <div className="space-y-3.5">
              {d?.distribucion_roles.map((r) => (
                <div key={r.rol} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm font-medium text-fg">{ROL_LABEL[r.rol]}</span>
                  <div className="h-7 flex-1 overflow-hidden rounded-lg bg-subtle">
                    <div className="flex h-full items-center justify-end rounded-lg bg-gradient-to-r from-prexi-navy to-prexi-blue px-2 text-xs font-bold text-white transition-all duration-700" style={{ width: `${Math.max(6, (r.total / maxRol) * 100)}%` }}>
                      {r.total > 0 && r.total}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Estado del estudio (enlaza al investigador) */}
        <Card>
          <div className="mb-4 flex items-center gap-2"><FlaskConical className="h-5 w-5 text-prexi-blue-deep" /><SectionTitle>Estado del estudio</SectionTitle></div>
          {cargando ? <Skeleton className="h-28" /> : totalEstudio === 0 ? <p className="py-6 text-center text-sm text-muted">Sin estudiantes asignados a grupos.</p> : (
            <>
              <div className="mb-3 flex overflow-hidden rounded-xl">
                <div className="bg-prexi-navy py-3 text-center text-white transition-all" style={{ width: `${(d!.estudio.control / totalEstudio) * 100}%` }}><p className="text-lg font-extrabold">{d!.estudio.control}</p></div>
                <div className="bg-prexi-green py-3 text-center text-white transition-all" style={{ width: `${(d!.estudio.experimental / totalEstudio) * 100}%` }}><p className="text-lg font-extrabold">{d!.estudio.experimental}</p></div>
              </div>
              <div className="flex justify-between text-xs text-muted"><span>Control</span><span>Experimental</span></div>
              <Link href="/admin/grupos" className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-subtle py-2 text-sm font-semibold text-prexi-blue-deep transition hover:bg-prexi-blue/10">Gestionar grupos <ArrowRight className="h-4 w-4" /></Link>
              <p className="mt-2 text-center text-[11px] text-muted">El detalle y la exportación los ve el rol investigador.</p>
            </>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Registros por semana */}
        <Card className="lg:col-span-2">
          <SectionTitle className="mb-5">Nuevos registros por semana</SectionTitle>
          {cargando ? <Skeleton className="h-40" /> : (
            <div className="flex h-40 items-end gap-3">
              {d?.registros_por_semana.map((r) => (
                <div key={r.semana} className="flex flex-1 flex-col items-center gap-2" title={`${r.nuevos} nuevos`}>
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div className="w-full max-w-[44px] rounded-t-lg bg-gradient-to-t from-prexi-navy to-prexi-blue transition-all duration-700" style={{ height: `${(r.nuevos / maxReg) * 100}%`, minHeight: r.nuevos ? '6px' : '0' }} />
                  </div>
                  <span className="text-[11px] font-semibold text-fg">{r.nuevos}</span>
                  <span className="text-[10px] text-muted">{new Date(r.semana + 'T00:00').toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Accesos rápidos */}
        <Card>
          <SectionTitle className="mb-4">Accesos rápidos</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {ACCESOS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-xl border border-line p-4 text-center transition hover:border-prexi-blue/40 hover:bg-subtle">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-prexi-blue/10 text-prexi-blue-deep"><Icon className="h-5 w-5" /></div>
                <span className="text-sm font-medium text-fg">{label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Actividad reciente (auditoría) */}
      <Card className="mt-6">
        <div className="mb-4 flex items-center justify-between"><SectionTitle>Actividad reciente del sistema</SectionTitle><Link href="/admin/auditoria" className="text-sm font-semibold text-prexi-blue-deep hover:underline">Ver todo</Link></div>
        {cargando ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          : d && d.actividad_reciente.length > 0 ? (
            <div className="divide-y divide-line">
              {d.actividad_reciente.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2.5">
                  <Badge tone="blue">{accionLabel(a.accion)}</Badge>
                  <p className="min-w-0 flex-1 truncate text-sm text-fg">{a.detalle} · <span className="text-muted">{a.actor}</span></p>
                  <span className="shrink-0 text-xs text-muted">{hora(a.fecha)}</span>
                </div>
              ))}
            </div>
          ) : <EmptyState title="Sin actividad registrada" hint="Las acciones sensibles del admin aparecerán aquí." />}
      </Card>
    </div>
  );
}
