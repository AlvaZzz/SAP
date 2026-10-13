'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { CountUp } from '@/components/count-up';
import { Card, SectionTitle, ProgressBar } from '@/components/ui';
import { EmblemasGaleria } from '@/components/emblemas-galeria';
import { RadarIndicadores } from '@/components/radar-indicadores';
import { reproducir } from '@/lib/sonidos';
import { vozSoportada } from '@/lib/voz';
import { Star, Trophy, Flame, Lock, CheckCircle, Medal, Edit, X, Play } from '@/components/icons';

const CARRERAS = ['Ingeniería de Sistemas', 'Ingeniería de Software', 'Ingeniería Informática', 'Ingeniería Electrónica', 'Ingeniería Industrial', 'Otra'];

interface Resumen { puntos: number; posicion: number | null; racha_dias: number; ejercicios: { completados: number; total: number } }
interface NivelP { id: number; numero: number; titulo: string; umbral: number; ejercicios_completados: number; desbloqueado: boolean }

export default function PerfilPage() {
  const { usuario, refrescar, guardarAudio } = useAuth();
  const [res, setRes] = useState<Resumen | null>(null);
  const [niveles, setNiveles] = useState<NivelP[]>([]);
  const [nivelLabel, setNivelLabel] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ nombre: '', carrera: '' });
  const [pass, setPass] = useState({ actual: '', nueva: '' });
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');
  const [reiniciandoTours, setReiniciandoTours] = useState(false);

  // "Volver a ver los tutoriales": vacía los tours vistos en el backend y
  // recarga para que el tour del módulo actual aparezca de inmediato.
  async function reiniciarTutoriales() {
    setReiniciandoTours(true);
    try {
      await api.del('/auth/tours');
      window.location.reload();
    } catch {
      setReiniciandoTours(false);
    }
  }

  useEffect(() => {
    api.get<Resumen>('/gamificacion/resumen').then(setRes).catch(() => undefined);
    api.get<{ niveles: NivelP[] }>('/niveles').then((r) => setNiveles(r.niveles)).catch(() => undefined);
    api.get<{ resultado: { nivel: string } | null }>('/pretest/estado').then((r) => setNivelLabel(r.resultado?.nivel ?? null)).catch(() => undefined);
  }, []);

  const inicial = usuario?.nombre.charAt(0).toUpperCase() ?? '?';
  const idCodigo = usuario ? `EST-${String(usuario.id).padStart(4, '0')}` : '—';

  // Nivel actual y progreso hacia el siguiente (datos reales de /niveles).
  const { nivelActual, faltan, progresoNivel } = useMemo(() => {
    const orden = [...niveles].sort((a, b) => a.numero - b.numero);
    const actual = orden.find((n) => n.desbloqueado && n.ejercicios_completados < n.umbral) ?? orden.filter((n) => n.desbloqueado).pop();
    const num = actual?.numero ?? 1;
    const falt = actual ? Math.max(0, actual.umbral - actual.ejercicios_completados) : 0;
    const pct = actual && actual.umbral ? Math.min(100, Math.round((actual.ejercicios_completados / actual.umbral) * 100)) : 0;
    return { nivelActual: num, faltan: falt, progresoNivel: pct };
  }, [niveles]);

  function abrir() { setForm({ nombre: usuario?.nombre ?? '', carrera: usuario?.carrera ?? '' }); setPass({ actual: '', nueva: '' }); setMsg(''); setEditando(true); }
  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (form.nombre.trim().length < 2 || form.carrera.trim().length < 2) { setMsg('Completa nombre y carrera.'); return; }
    if (pass.nueva && (pass.nueva.length < 6 || !pass.actual)) { setMsg('Para cambiar la contraseña, ingresa la actual y una nueva de 6+ caracteres.'); return; }
    setGuardando(true);
    try {
      await api.put('/auth/perfil', form);
      if (pass.nueva) await api.put('/auth/password', { actual: pass.actual, nueva: pass.nueva });
      await refrescar();
      setEditando(false);
    } catch (err) { setMsg(err instanceof ApiError ? err.message : 'No se pudo guardar'); }
    finally { setGuardando(false); }
  }

  return (
    <div className="animate-fade-up">
      <h1 className="mb-6 font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">Perfil</h1>

      {/* Resumen de los 5 indicadores (radar): lo primero que se ve en el perfil. */}
      <RadarIndicadores />


      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        {/* ── Columna izquierda ── */}
        <div className="space-y-6">
          {/* Tarjeta de identidad */}
          <Card hover className="overflow-hidden !p-0 text-center">
            <div className="h-20 bg-gradient-to-r from-prexi-blue to-prexi-blue-hover" />
            <div className="-mt-12 px-5 pb-6">
              <div className="mx-auto grid h-24 w-24 place-items-center rounded-full border-4 border-card bg-prexi-blue text-3xl font-extrabold text-accent-on shadow-lift">{inicial}</div>
              <p className="mt-3 font-display text-xl font-extrabold text-fg">{usuario?.nombre}</p>
              <p className="text-xs text-muted">ID: {idCodigo}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-prexi-blue/10 px-3 py-1 text-xs font-semibold text-prexi-blue-deep">
                <Medal className="h-3.5 w-3.5" /> Nivel {nivelActual}{nivelLabel ? ` — ${nivelLabel}` : ''}
              </span>
              <p className="mt-3 text-xs leading-relaxed text-muted">{usuario?.carrera ?? 'Carrera no registrada'}</p>
              {usuario?.paraleloRef && (
                <div className="mt-3 rounded-xl bg-subtle px-3 py-2 text-left text-xs leading-relaxed">
                  <p className="font-semibold text-fg">{usuario.paraleloRef.materia.nombre} · Paralelo {usuario.paraleloRef.nombre}</p>
                  <p className="text-muted">{usuario.paraleloRef.docente ? `Docente: ${usuario.paraleloRef.docente.nombre}` : 'Docente por asignar'}</p>
                  {usuario.ru && <p className="text-muted">RU: {usuario.ru}</p>}
                </div>
              )}

              <div className="mt-4 flex border-t border-line pt-4 text-center">
                <div className="flex-1"><p className="font-display text-lg font-bold text-fg"><CountUp value={res?.puntos ?? 0} /></p><p className="text-2xs text-muted">XP</p></div>
                <div className="flex-1 border-l border-line"><p className="flex items-center justify-center gap-1 font-display text-lg font-bold text-prexi-amber"><Flame className="h-4 w-4" /> {res?.racha_dias ?? 0}</p><p className="text-2xs text-muted">Racha</p></div>
                <div className="flex-1 border-l border-line"><p className="font-display text-lg font-bold text-fg">{res?.posicion ? `#${res.posicion}` : '—'}</p><p className="text-2xs text-muted">Posición</p></div>
              </div>

              <button onClick={abrir} className="btn-primary mt-4 w-full">
                <Edit className="h-4 w-4" /> Editar perfil
              </button>
            </div>
          </Card>

          {/* Tutoriales */}
          <Card hover>
            <p className="mb-1 text-sm font-semibold text-fg">Tutoriales del sistema</p>
            <p className="mb-3 text-xs leading-relaxed text-muted">¿Quieres repasar cómo funciona cada módulo? Reinicia las guías paso a paso: volverán a aparecer al entrar a cada sección.</p>
            <button onClick={reiniciarTutoriales} disabled={reiniciandoTours}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-subtle py-2.5 text-sm font-semibold text-fg transition hover:bg-prexi-blue/10 hover:text-prexi-blue-deep active:scale-[0.98] disabled:opacity-60">
              <Play className="h-4 w-4" /> {reiniciandoTours ? 'Reiniciando…' : 'Volver a ver los tutoriales'}
            </button>
          </Card>

          {/* Audio y voz */}
          <Card hover>
            <p className="mb-1 text-sm font-semibold text-fg">Audio y voz</p>
            <p className="mb-3 text-xs leading-relaxed text-muted">Controla los sonidos de logros y si tu tutor PREXI te lee sus respuestas en voz alta.</p>
            <div className="space-y-2.5">
              <Interruptor
                titulo="Sonidos activados"
                detalle="Suena al ganar una medalla, subir de rango o de nivel."
                activo={usuario?.sonidosActivados ?? true}
                onChange={(v) => { if (v) reproducir('acierto', true); void guardarAudio({ sonidosActivados: v }); }}
              />
              {vozSoportada() && (
                <Interruptor
                  titulo="Leer respuestas en voz alta"
                  detalle="Tu tutor PREXI lee automáticamente cada respuesta. También puedes usar el botón de audio en cada una."
                  activo={usuario?.vozAutomatica ?? false}
                  onChange={(v) => void guardarAudio({ vozAutomatica: v })}
                />
              )}
            </div>
          </Card>

          {/* Tu nivel */}
          <Card hover>
            <p className="mb-3 text-sm font-semibold text-fg">Tu nivel</p>
            <ProgressBar value={progresoNivel} />
            <div className="mt-2.5 flex justify-between text-2xs text-muted">
              <span>Nivel {nivelActual}</span>
              <span className="font-semibold text-prexi-blue-deep">{faltan > 0 ? `${faltan} ejercicio${faltan > 1 ? 's' : ''} para Nivel ${nivelActual + 1}` : '¡Nivel completo!'}</span>
            </div>
          </Card>
        </div>

        {/* ── Columna derecha ── */}
        <div className="space-y-6">
          {/* Resumen de actividad */}
          <Card hover>
            <SectionTitle className="mb-4 !text-lg">Resumen de actividad</SectionTitle>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MiniStat icon={<Star className="h-5 w-5" />} tone="text-prexi-blue-deep" label="XP Total"><CountUp value={res?.puntos ?? 0} /></MiniStat>
              <MiniStat icon={<CheckCircle className="h-5 w-5" />} tone="text-prexi-green" label="Ejercicios"><CountUp value={res?.ejercicios.completados ?? 0} />/{res?.ejercicios.total ?? 69}</MiniStat>
              <MiniStat icon={<Flame className="h-5 w-5" />} tone="text-prexi-amber" label="Racha"><CountUp value={res?.racha_dias ?? 0} /> días</MiniStat>
              <MiniStat icon={<Trophy className="h-5 w-5" />} tone="text-prexi-amber" label="Mejor pos.">{res?.posicion ? `#${res.posicion}` : '—'}</MiniStat>
            </div>
          </Card>

          {/* Emblemas (galería con requisitos: desbloqueados a color, bloqueados en gris) */}
          <EmblemasGaleria />

          {/* Progreso por nivel */}
          <Card hover>
            <SectionTitle className="mb-4 !text-lg">Progreso por nivel</SectionTitle>
            <div className="space-y-4">
              {[...niveles].sort((a, b) => a.numero - b.numero).map((n) => {
                const completo = n.ejercicios_completados >= n.umbral;
                const enProg = n.desbloqueado && !completo;
                const pct = n.umbral ? Math.min(100, Math.round((n.ejercicios_completados / n.umbral) * 100)) : 0;
                const color = completo ? '#10B981' : enProg ? '#3B82F6' : 'rgb(var(--muted))';
                return (
                  <div key={n.id}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-fg">Nivel {n.numero} · {n.titulo}</span>
                      <span className="text-muted">{Math.min(n.ejercicios_completados, n.umbral)}/{n.umbral} · <span className="font-semibold" style={{ color }}>{completo ? 'Completado' : enProg ? 'En progreso' : 'Bloqueado'}</span></span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-subtle"><div className="h-full origin-left rounded-full animate-grow-x transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} /></div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Modal editar perfil ── */}
      {editando && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in" onClick={() => setEditando(false)}>
          <div className="w-full max-w-md animate-fade-up overflow-hidden rounded-2xl border border-line bg-card shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <p className="font-display font-bold text-fg">Editar perfil</p>
              <button onClick={() => setEditando(false)} aria-label="Cerrar" className="text-muted transition hover:text-fg"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={guardar} className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-prexi-blue text-xl font-extrabold text-accent-on">{inicial}</div>
                <p className="text-xs text-muted">Tu avatar usa tus iniciales.<br />La carga de foto llegará pronto.</p>
              </div>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-semibold text-fg">Nombre completo</span>
                <input className="input" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
              </label>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-semibold text-fg">Correo electrónico</span>
                <div className="flex items-center justify-between rounded-xl border border-line bg-subtle px-3 py-2.5 text-sm text-muted">{usuario?.email} <Lock className="h-4 w-4" /></div>
                <span className="text-2xs text-muted">El correo no se puede modificar.</span>
              </label>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-semibold text-fg">Carrera</span>
                <select className="input" value={form.carrera} onChange={(e) => setForm((f) => ({ ...f, carrera: e.target.value }))}>
                  <option value="">Selecciona…</option>
                  {CARRERAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>

              <div className="border-t border-line pt-3">
                <p className="mb-2 text-xs font-semibold text-muted">Cambiar contraseña (opcional)</p>
                <input type="password" autoComplete="current-password" placeholder="Contraseña actual" className="input mb-2 text-sm" value={pass.actual} onChange={(e) => setPass((p) => ({ ...p, actual: e.target.value }))} />
                <input type="password" autoComplete="new-password" placeholder="Nueva contraseña" className="input text-sm" value={pass.nueva} onChange={(e) => setPass((p) => ({ ...p, nueva: e.target.value }))} />
                {pass.nueva && (
                  <span className={`mt-1 flex items-center gap-1 text-2xs ${pass.nueva.length >= 6 ? 'text-prexi-green' : 'text-prexi-amber'}`}>
                    {pass.nueva.length >= 6 ? <><CheckCircle className="h-3.5 w-3.5" /> Contraseña válida</> : 'Mínimo 6 caracteres'}
                  </span>
                )}
              </div>
              {msg && <p className="mt-2 text-sm text-red-500">{msg}</p>}
              <div className="mt-5 flex gap-2.5">
                <button type="button" onClick={() => setEditando(false)} className="btn-ghost flex-1">Cancelar</button>
                <button className="btn-primary flex-1" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/** Interruptor accesible (switch) para una preferencia booleana. */
function Interruptor({ titulo, detalle, activo, onChange }: {
  titulo: string; detalle: string; activo: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button role="switch" aria-checked={activo} onClick={() => onChange(!activo)}
      className="flex w-full items-start gap-3 rounded-xl border border-line bg-subtle/60 p-3 text-left transition hover:border-prexi-blue/40">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">{titulo}</span>
        <span className="mt-0.5 block text-2xs leading-relaxed text-muted">{detalle}</span>
      </span>
      <span aria-hidden className={`mt-0.5 grid h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${activo ? 'bg-prexi-blue' : 'bg-line'}`}>
        <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </button>
  );
}

function MiniStat({ icon, tone, label, children }: { icon: React.ReactNode; tone: string; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-subtle p-3">
      <div className={tone}>{icon}</div>
      <p className="mt-1.5 font-display text-lg font-bold text-fg">{children}</p>
      <p className="text-2xs text-muted">{label}</p>
    </div>
  );
}
