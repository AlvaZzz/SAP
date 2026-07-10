'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Card, Badge, Skeleton, Select, Input, EmptyState } from '@/components/ui';
import { ClipboardList, Filter } from '@/components/icons';

interface Log { id: number; actor: string; actor_rol: string; accion: string; entidad: string; entidadId: number | null; detalle: string; fecha: string }
interface Respuesta { total: number; acciones: string[]; logs: Log[] }

const ACCION_LABEL: Record<string, string> = {
  usuario_crear: 'Creó usuario', usuario_editar: 'Editó usuario', usuario_estado: 'Cambió estado',
  rol_cambiar: 'Cambió rol', grupo_cambiar: 'Cambió grupo', config_cambiar: 'Cambió config', password_reset: 'Reseteó contraseña',
};
const ACCION_TONE: Record<string, 'blue' | 'green' | 'amber' | 'red' | 'slate'> = {
  usuario_crear: 'green', usuario_editar: 'blue', usuario_estado: 'amber',
  rol_cambiar: 'amber', grupo_cambiar: 'blue', config_cambiar: 'slate', password_reset: 'red',
};

export default function AdminAuditoriaPage() {
  const [d, setD] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [accion, setAccion] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (accion) params.set('accion', accion);
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      setD(await api.get<Respuesta>(`/admin/auditoria?${params.toString()}`));
    } catch { /* noop */ } finally { setCargando(false); }
  }, [accion, desde, hasta]);
  useEffect(() => { cargar(); }, [cargar]);

  const fecha = (f: string) => new Date(f).toLocaleString('es-BO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="animate-fade-up">
      <PageHeader title="Auditoría del sistema" subtitle="Registro de acciones sensibles: usuarios, roles, grupos y configuración. Trazabilidad para el estudio." />

      {/* Filtros */}
      <Card className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted"><Filter className="h-4 w-4" /> Filtros</div>
        <label className="text-sm"><span className="mb-1 block text-xs text-muted">Acción</span>
          <Select value={accion} onChange={(e) => setAccion(e.target.value)} className="!w-52"><option value="">Todas</option>{d?.acciones.map((a) => <option key={a} value={a}>{ACCION_LABEL[a] ?? a}</option>)}</Select>
        </label>
        <label className="text-sm"><span className="mb-1 block text-xs text-muted">Desde</span><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="!w-40" /></label>
        <label className="text-sm"><span className="mb-1 block text-xs text-muted">Hasta</span><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="!w-40" /></label>
        {(accion || desde || hasta) && <button onClick={() => { setAccion(''); setDesde(''); setHasta(''); }} className="btn-ghost text-sm">Limpiar</button>}
      </Card>

      {cargando ? <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        : !d || d.logs.length === 0 ? <EmptyState icon={<ClipboardList className="h-7 w-7" />} title="Sin registros" hint="No hay acciones que coincidan con los filtros." />
          : (
            <>
              <p className="mb-3 text-sm text-muted">{d.total} registro(s){d.logs.length < d.total ? ` · mostrando ${d.logs.length}` : ''}</p>
              <Card className="!p-0">
                <div className="divide-y divide-line">
                  {d.logs.map((l) => (
                    <div key={l.id} className="flex items-start gap-3 px-5 py-3.5">
                      <Badge tone={ACCION_TONE[l.accion] ?? 'slate'}>{ACCION_LABEL[l.accion] ?? l.accion}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-fg">{l.detalle}</p>
                        <p className="mt-0.5 text-xs text-muted">{l.actor} · <span className="capitalize">{l.actor_rol}</span></p>
                      </div>
                      <span className="shrink-0 text-xs text-muted">{fecha(l.fecha)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
    </div>
  );
}
