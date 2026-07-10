'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { PageHeader, Card, Skeleton, Field, Input, Select } from '@/components/ui';
import { SlidersHorizontal, Gamepad2, Cpu, FlaskConical, Save, CheckCircle } from '@/components/icons';

interface Config {
  nombreSistema: string; institucion: string; periodo: string; logoUrl: string | null;
  xpPorEjercicio: number; xpBonusRacha: number; xpPorLogro: number; umbralPorcentaje: number; penalizacionPista: number;
  subirNivelPreguntas: number; subirNivelUmbral: number; subirNivelEsperaHoras: number; xpFactorIntermedio: number; xpFactorAvanzado: number;
  iaActiva: boolean; maxPistasIa: number; rateLimitIaHora: number; modoRetroalimentacion: string; modeloIa: string;
  postestDesdeNivel: number; gruposBloqueados: boolean; riesgoDiasInactivo: number; riesgoTasaAciertoMin: number; riesgoMinIntentos: number;
}
type Tab = 'general' | 'gamificacion' | 'ia' | 'investigacion';
const TABS: { id: Tab; label: string; icon: typeof Cpu }[] = [
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'gamificacion', label: 'Gamificación', icon: Gamepad2 },
  { id: 'ia', label: 'Inteligencia Artificial', icon: Cpu },
  { id: 'investigacion', label: 'Investigación', icon: FlaskConical },
];

export default function AdminSistemaPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [orig, setOrig] = useState<Config | null>(null);
  const [tab, setTab] = useState<Tab>('general');
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Config>('/admin/config').then((c) => { setCfg(c); setOrig(c); }).catch(() => undefined);
  }, []);

  function set<K extends keyof Config>(k: K, v: Config[K]) { setCfg((c) => (c ? { ...c, [k]: v } : c)); setMsg(''); }
  const numChg = cfg && orig ? Object.keys(cfg).filter((k) => (cfg as any)[k] !== (orig as any)[k]).length : 0;

  async function guardar() {
    if (!cfg || !orig) return;
    const diff = Object.fromEntries(Object.entries(cfg).filter(([k, v]) => v !== (orig as any)[k]));
    if (Object.keys(diff).length === 0) return;
    setGuardando(true); setError(''); setMsg('');
    try {
      const actualizada = await api.put<Config>('/admin/config', diff);
      setCfg(actualizada); setOrig(actualizada); setMsg('Cambios guardados. Se aplican en todo el sistema.');
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo guardar'); }
    finally { setGuardando(false); }
  }

  if (!cfg) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-80" /></div>;

  return (
    <div className="animate-fade-up">
      <PageHeader title="Configuración del sistema" subtitle="Parámetros centralizados. Todo el sistema (estudiante, docente e IA) los lee desde aquí."
        action={
          <button onClick={guardar} disabled={guardando || numChg === 0} className="btn-primary disabled:opacity-50">
            <Save className="h-4 w-4" /> {guardando ? 'Guardando…' : numChg > 0 ? `Guardar (${numChg})` : 'Guardar'}
          </button>
        } />

      {msg && <p className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-prexi-green"><CheckCircle className="h-4 w-4" /> {msg}</p>}
      {error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{error}</p>}

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === id ? 'bg-prexi-navy text-white shadow-soft' : 'border border-line text-muted hover:bg-subtle'}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <Card>
        {tab === 'general' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nombre del sistema"><Input value={cfg.nombreSistema} onChange={(e) => set('nombreSistema', e.target.value)} /></Field>
            <Field label="Institución"><Input value={cfg.institucion} onChange={(e) => set('institucion', e.target.value)} /></Field>
            <Field label="Periodo / semestre activo"><Input value={cfg.periodo} onChange={(e) => set('periodo', e.target.value)} placeholder="2026-I" /></Field>
            <Field label="Logo (URL, opcional)"><Input value={cfg.logoUrl ?? ''} onChange={(e) => set('logoUrl', e.target.value)} placeholder="https://…" /></Field>
          </div>
        )}
        {tab === 'gamificacion' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="XP por ejercicio correcto"><Input type="number" value={cfg.xpPorEjercicio} onChange={(e) => set('xpPorEjercicio', +e.target.value)} /></Field>
            <Field label="XP bonus por racha"><Input type="number" value={cfg.xpBonusRacha} onChange={(e) => set('xpBonusRacha', +e.target.value)} /></Field>
            <Field label="XP por logro"><Input type="number" value={cfg.xpPorLogro} onChange={(e) => set('xpPorLogro', +e.target.value)} /></Field>
            <Field label="Umbral de desbloqueo de nivel (%)" hint="Porcentaje de ejercicios del nivel para desbloquear el siguiente."><Input type="number" value={cfg.umbralPorcentaje} onChange={(e) => set('umbralPorcentaje', +e.target.value)} /></Field>
            <Field label="Penalización de XP por pista"><Input type="number" value={cfg.penalizacionPista} onChange={(e) => set('penalizacionPista', +e.target.value)} /></Field>
            <Field label="Subir de nivel: nº de preguntas" hint="Ítems del mini-diagnóstico para subir de nivel en un tema."><Input type="number" value={cfg.subirNivelPreguntas} onChange={(e) => set('subirNivelPreguntas', +e.target.value)} /></Field>
            <Field label="Subir de nivel: umbral (%)" hint="Porcentaje mínimo para aprobar y subir de nivel."><Input type="number" value={cfg.subirNivelUmbral} onChange={(e) => set('subirNivelUmbral', +e.target.value)} /></Field>
            <Field label="Subir de nivel: espera entre intentos (horas)" hint="0 = sin espera."><Input type="number" value={cfg.subirNivelEsperaHoras} onChange={(e) => set('subirNivelEsperaHoras', +e.target.value)} /></Field>
            <Field label="XP nivel Intermedio (%)" hint="XP relativo al Básico (100%). Más nivel = más XP."><Input type="number" value={cfg.xpFactorIntermedio} onChange={(e) => set('xpFactorIntermedio', +e.target.value)} /></Field>
            <Field label="XP nivel Avanzado (%)" hint="XP relativo al Básico (100%)."><Input type="number" value={cfg.xpFactorAvanzado} onChange={(e) => set('xpFactorAvanzado', +e.target.value)} /></Field>
          </div>
        )}
        {tab === 'ia' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><Toggle label="Tutor ALVARO activo" hint="Si se desactiva, ningún rol puede usar la IA." value={cfg.iaActiva} onChange={(v) => set('iaActiva', v)} /></div>
            <Field label="Máx. pistas por ejercicio"><Input type="number" value={cfg.maxPistasIa} onChange={(e) => set('maxPistasIa', +e.target.value)} /></Field>
            <Field label="Rate limit (consultas/hora por estudiante)"><Input type="number" value={cfg.rateLimitIaHora} onChange={(e) => set('rateLimitIaHora', +e.target.value)} /></Field>
            <Field label="Modo de retroalimentación"><Select value={cfg.modoRetroalimentacion} onChange={(e) => set('modoRetroalimentacion', e.target.value)}><option value="inmediata">Inmediata</option><option value="al_finalizar">Al finalizar</option></Select></Field>
            <Field label="Modelo configurado (informativo)"><Input value={cfg.modeloIa} disabled className="opacity-70" /></Field>
          </div>
        )}
        {tab === 'investigacion' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Postest se desbloquea desde el nivel" hint="Nivel que debe completarse para habilitar el postest."><Input type="number" value={cfg.postestDesdeNivel} onChange={(e) => set('postestDesdeNivel', +e.target.value)} /></Field>
            <div className="sm:col-span-2"><Toggle label="Bloquear cambios de grupo" hint="Congela control/experimental una vez iniciada la recolección." value={cfg.gruposBloqueados} onChange={(v) => set('gruposBloqueados', v)} /></div>
            <Field label="En riesgo: días sin actividad"><Input type="number" value={cfg.riesgoDiasInactivo} onChange={(e) => set('riesgoDiasInactivo', +e.target.value)} /></Field>
            <Field label="En riesgo: tasa de acierto mínima (%)"><Input type="number" value={cfg.riesgoTasaAciertoMin} onChange={(e) => set('riesgoTasaAciertoMin', +e.target.value)} /></Field>
            <Field label="En riesgo: intentos mínimos para evaluar"><Input type="number" value={cfg.riesgoMinIntentos} onChange={(e) => set('riesgoMinIntentos', +e.target.value)} /></Field>
          </div>
        )}
      </Card>
    </div>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line p-4">
      <div><p className="text-sm font-medium text-fg">{label}</p>{hint && <p className="text-xs text-muted">{hint}</p>}</div>
      <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${value ? 'bg-prexi-green' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
