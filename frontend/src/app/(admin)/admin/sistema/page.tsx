'use client';

/**
 * CONFIGURACIÓN DEL SISTEMA (administrador). Las mismas opciones de siempre,
 * agrupadas por tema y explicadas en lenguaje simple: qué hace cada una y a
 * quién afecta. Los cambios se acumulan y se guardan juntos desde una barra fija
 * (con opción de descartarlos). La sección abierta queda en la URL (?seccion=).
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { PageHeader, Card, Skeleton, Input } from '@/components/ui';
import { SlidersHorizontal, Gamepad2, Cpu, FlaskConical, Save, CheckCircle, TrendingUp, AlertTriangle, RotateCcw } from '@/components/icons';

interface Config {
  nombreSistema: string; institucion: string; periodo: string; logoUrl: string | null;
  xpPorEjercicio: number; xpBonusRacha: number; xpPorLogro: number; umbralPorcentaje: number; penalizacionPista: number;
  subirNivelPreguntas: number; subirNivelUmbral: number; subirNivelEsperaHoras: number; xpFactorIntermedio: number; xpFactorAvanzado: number;
  iaActiva: boolean; maxPistasIa: number; rateLimitIaHora: number; modoRetroalimentacion: string; modeloIa: string;
  postestDesdeNivel: number; encuestaMotivacionActiva: boolean; rangoObjetivoMin: number; rangoObjetivoMax: number;
  faseEvaluacionActiva: boolean; criterioPrecisionMin: number; criterioSusMin: number; nivelAceptableCalidad: number;
  riesgoDiasInactivo: number; riesgoTasaAciertoMin: number; riesgoMinIntentos: number;
}
type Seccion = 'general' | 'avance' | 'xp' | 'ia' | 'riesgo' | 'investigacion';
const SECCIONES: { id: Seccion; label: string; texto: string; icon: typeof Cpu }[] = [
  { id: 'general', label: 'Institución', texto: 'Nombre, institución y gestión', icon: SlidersHorizontal },
  { id: 'avance', label: 'Reglas de avance', texto: 'Cómo se sube de nivel', icon: TrendingUp },
  { id: 'xp', label: 'Puntos (XP)', texto: 'Cuánto vale cada logro', icon: Gamepad2 },
  { id: 'ia', label: 'Tutor PREXI (IA)', texto: 'Pistas y límites de uso', icon: Cpu },
  { id: 'riesgo', label: 'Alertas al docente', texto: 'Cuándo un estudiante necesita ayuda', icon: AlertTriangle },
  { id: 'investigacion', label: 'Evaluación e investigación', texto: 'Cuestionarios y criterios', icon: FlaskConical },
];

export default function AdminSistemaPage() {
  const router = useRouter();
  const params = useSearchParams();
  const seccion = (SECCIONES.find((s) => s.id === params.get('seccion'))?.id ?? 'general') as Seccion;
  const [cfg, setCfg] = useState<Config | null>(null);
  const [orig, setOrig] = useState<Config | null>(null);
  const [iaClave, setIaClave] = useState<boolean | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Config>('/admin/config').then((c) => { setCfg(c); setOrig(c); }).catch(() => undefined);
    api.get<{ salud: { ia: { clave_configurada: boolean } } }>('/admin/dashboard').then((d) => setIaClave(d.salud.ia.clave_configurada)).catch(() => undefined);
  }, []);

  function set<K extends keyof Config>(k: K, v: Config[K]) { setCfg((c) => (c ? { ...c, [k]: v } : c)); setMsg(''); }
  const cambios = useMemo(() => (cfg && orig ? (Object.keys(cfg) as (keyof Config)[]).filter((k) => cfg[k] !== orig[k]) : []), [cfg, orig]);

  async function guardar() {
    if (!cfg || cambios.length === 0) return;
    const diff = Object.fromEntries(cambios.map((k) => [k, cfg[k]]));
    setGuardando(true); setError(''); setMsg('');
    try {
      const actualizada = await api.put<Config>('/admin/config', diff);
      setCfg(actualizada); setOrig(actualizada);
      setMsg(`Se guardaron ${cambios.length} cambio(s). Ya rigen en todo el sistema.`);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo guardar'); }
    finally { setGuardando(false); }
  }

  if (!cfg) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-80" /></div>;
  const num = (k: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, (e.target.value === '' ? 0 : +e.target.value) as never);

  return (
    <div className="animate-fade-up pb-24">
      <PageHeader title="Configuración" subtitle="Todo el sistema (estudiantes, docentes y PREXI) usa estos valores. Cada opción explica qué cambia." />

      {msg && <p className="mb-4 flex items-center gap-2 rounded-xl border border-prexi-green/40 bg-prexi-green/10 px-3 py-2 text-sm text-fg"><CheckCircle className="h-4 w-4 text-prexi-green" /> {msg}</p>}
      {error && <p className="mb-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Secciones */}
        <nav aria-label="Secciones" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:self-start lg:overflow-visible">
          {SECCIONES.map(({ id, label, texto, icon: Icon }) => {
            const sel = seccion === id;
            return (
              <button key={id} onClick={() => router.replace(`/admin/sistema?seccion=${id}`, { scroll: false })} aria-current={sel ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition lg:w-full ${sel ? 'border-prexi-blue bg-prexi-blue/10' : 'border-line bg-card hover:bg-subtle'}`}>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${sel ? 'bg-prexi-blue text-accent-on' : 'bg-subtle text-muted'}`}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0"><span className={`block text-sm font-semibold ${sel ? 'text-prexi-blue-deep' : 'text-fg'}`}>{label}</span><span className="hidden text-xs text-muted lg:block">{texto}</span></span>
              </button>
            );
          })}
        </nav>

        <Card>
          {seccion === 'general' && (
            <Bloque titulo="Institución" texto="Datos que se muestran en el sistema y en los reportes.">
              <Opcion etiqueta="Nombre del sistema"><Input value={cfg.nombreSistema} onChange={(e) => set('nombreSistema', e.target.value)} /></Opcion>
              <Opcion etiqueta="Institución"><Input value={cfg.institucion} onChange={(e) => set('institucion', e.target.value)} /></Opcion>
              <Opcion etiqueta="Gestión actual" ayuda="Ej.: 2026-II. Se muestra en el panel y en los reportes."><Input value={cfg.periodo} onChange={(e) => set('periodo', e.target.value)} placeholder="2026-II" /></Opcion>
              <Opcion etiqueta="Logo (dirección web, opcional)"><Input value={cfg.logoUrl ?? ''} onChange={(e) => set('logoUrl', e.target.value)} placeholder="https://…" /></Opcion>
            </Bloque>
          )}

          {seccion === 'avance' && (
            <Bloque titulo="Reglas de avance" texto="Cómo pasa un estudiante de un tema al siguiente y de un nivel al otro. Afecta a todos los estudiantes desde que guardas.">
              <Opcion etiqueta="Preguntas de la prueba de nivel" ayuda="Cuántas preguntas tiene la prueba para pasar de Básico a Intermedio o de Intermedio a Avanzado.">
                <Numero valor={cfg.subirNivelPreguntas} onChange={num('subirNivelPreguntas')} unidad="preguntas" min={1} max={20} />
              </Opcion>
              <Opcion etiqueta="Nota para aprobar la prueba de nivel" ayuda="Sobre 100. El estudiante sube de nivel si la alcanza.">
                <Numero valor={cfg.subirNivelUmbral} onChange={num('subirNivelUmbral')} unidad="de 100" min={50} max={100} />
              </Opcion>
              <Opcion etiqueta="Espera entre intentos" ayuda="Horas que debe esperar si no aprueba la prueba. 0 = puede reintentar enseguida.">
                <Numero valor={cfg.subirNivelEsperaHoras} onChange={num('subirNivelEsperaHoras')} unidad="horas" min={0} max={168} />
              </Opcion>
              <Opcion etiqueta="Porcentaje para completar un nivel de juego" ayuda="Para los niveles de gamificación (1 a 5). Los temas se completan con sus 10 ejercicios.">
                <Numero valor={cfg.umbralPorcentaje} onChange={num('umbralPorcentaje')} unidad="%" min={10} max={100} />
              </Opcion>
              <Opcion etiqueta="Evaluación final desde el nivel" ayuda="Nivel de juego que debe completar el estudiante para que se le habilite la evaluación final.">
                <Numero valor={cfg.postestDesdeNivel} onChange={num('postestDesdeNivel')} unidad="nivel" min={1} max={5} />
              </Opcion>
            </Bloque>
          )}

          {seccion === 'xp' && (
            <Bloque titulo="Puntos (XP)" texto="Los puntos que gana el estudiante. Se ven en su panel y en el ranking.">
              <Opcion etiqueta="XP por ejercicio correcto"><Numero valor={cfg.xpPorEjercicio} onChange={num('xpPorEjercicio')} unidad="XP" min={0} max={1000} /></Opcion>
              <Opcion etiqueta="XP extra por racha" ayuda="Por practicar varios días seguidos."><Numero valor={cfg.xpBonusRacha} onChange={num('xpBonusRacha')} unidad="XP" min={0} max={500} /></Opcion>
              <Opcion etiqueta="XP por logro (emblema)"><Numero valor={cfg.xpPorLogro} onChange={num('xpPorLogro')} unidad="XP" min={0} max={500} /></Opcion>
              <Opcion etiqueta="Descuento por pista usada" ayuda="Porcentaje de XP que pierde un ejercicio si pidió pistas."><Numero valor={cfg.penalizacionPista} onChange={num('penalizacionPista')} unidad="%" min={0} max={100} /></Opcion>
              <Opcion etiqueta="XP en nivel Intermedio" ayuda="Comparado con Básico (100 %). Más nivel, más puntos."><Numero valor={cfg.xpFactorIntermedio} onChange={num('xpFactorIntermedio')} unidad="%" min={100} max={300} /></Opcion>
              <Opcion etiqueta="XP en nivel Avanzado" ayuda="Comparado con Básico (100 %)."><Numero valor={cfg.xpFactorAvanzado} onChange={num('xpFactorAvanzado')} unidad="%" min={100} max={400} /></Opcion>
            </Bloque>
          )}

          {seccion === 'ia' && (
            <Bloque titulo="Tutor PREXI (IA)" texto="El asistente que explica, da pistas y ayuda al docente a generar ejercicios.">
              {iaClave === false && (
                <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-fg">
                  <b>Falta la clave de la IA en el servidor</b> (GEMINI_API_KEY). Mientras falte, PREXI no responde aunque esté encendido. Se configura en el entorno del servidor (Render), no aquí.
                </p>
              )}
              <Interruptor etiqueta="PREXI encendido" ayuda="Si lo apagas, ningún rol puede usar la IA: ni el tutor, ni las pistas, ni la generación de ejercicios." valor={cfg.iaActiva} onChange={(v) => set('iaActiva', v)} />
              <Opcion etiqueta="Pistas por ejercicio" ayuda="Cuántas pistas puede pedir el estudiante en un mismo ejercicio."><Numero valor={cfg.maxPistasIa} onChange={num('maxPistasIa')} unidad="pistas" min={0} max={10} /></Opcion>
              <Opcion etiqueta="Consultas por hora" ayuda="Límite por estudiante, para cuidar el costo de la IA."><Numero valor={cfg.rateLimitIaHora} onChange={num('rateLimitIaHora')} unidad="por hora" min={1} max={500} /></Opcion>
              <Opcion etiqueta="Cuándo explica la respuesta">
                <div className="grid gap-2 sm:grid-cols-2">
                  {[{ v: 'inmediata', t: 'Al responder', d: 'El estudiante ve la explicación enseguida.' }, { v: 'al_finalizar', t: 'Al terminar', d: 'Ve las explicaciones al final de la práctica.' }].map((o) => (
                    <button key={o.v} type="button" onClick={() => set('modoRetroalimentacion', o.v)}
                      className={`rounded-xl border-2 px-3 py-2.5 text-left text-sm transition ${cfg.modoRetroalimentacion === o.v ? 'border-prexi-blue bg-prexi-blue/10' : 'border-line hover:bg-subtle'}`}>
                      <span className="block font-semibold text-fg">{o.t}</span><span className="text-muted">{o.d}</span>
                    </button>
                  ))}
                </div>
              </Opcion>
              <Opcion etiqueta="Modelo de IA" ayuda="Informativo. Si el servidor define GEMINI_MODEL, se usa ese."><Input value={cfg.modeloIa} disabled className="opacity-70" /></Opcion>
            </Bloque>
          )}

          {seccion === 'riesgo' && (
            <Bloque titulo="Alertas al docente" texto="Cuándo el panel del docente marca a un estudiante como «necesita atención».">
              <Opcion etiqueta="Días sin practicar" ayuda="Si pasa más de estos días sin actividad, se le avisa al docente."><Numero valor={cfg.riesgoDiasInactivo} onChange={num('riesgoDiasInactivo')} unidad="días" min={1} max={60} /></Opcion>
              <Opcion etiqueta="Aciertos mínimos" ayuda="Si acierta menos de este porcentaje, se le avisa al docente."><Numero valor={cfg.riesgoTasaAciertoMin} onChange={num('riesgoTasaAciertoMin')} unidad="%" min={0} max={100} /></Opcion>
              <Opcion etiqueta="Intentos antes de evaluar" ayuda="Con menos intentos todavía no se juzga su porcentaje de aciertos."><Numero valor={cfg.riesgoMinIntentos} onChange={num('riesgoMinIntentos')} unidad="intentos" min={1} max={50} /></Opcion>
            </Bloque>
          )}

          {seccion === 'investigacion' && (
            <Bloque titulo="Evaluación e investigación" texto="Los cuestionarios de evaluación del sistema y los criterios que usa el rol investigador.">
              <Interruptor etiqueta="Fase de evaluación abierta" ayuda="Los estudiantes ven el cuestionario SUS y los docentes el de calidad ISO/IEC 25010. Cada persona responde una sola vez." valor={cfg.faseEvaluacionActiva} onChange={(v) => set('faseEvaluacionActiva', v)} />
              <Opcion etiqueta="Criterio de precisión del motor" ayuda="El límite inferior del IC 95 % de asignaciones en el rango objetivo debe llegar a este valor."><Numero valor={cfg.criterioPrecisionMin} onChange={num('criterioPrecisionMin')} unidad="%" min={0} max={100} /></Opcion>
              <Opcion etiqueta="Criterio de usabilidad (SUS)" ayuda="Puntaje medio mínimo. 69 es el inicio del rango «bueno»."><Numero valor={cfg.criterioSusMin} onChange={num('criterioSusMin')} unidad="puntos" min={0} max={100} /></Opcion>
              <Opcion etiqueta="Calidad aceptable (1 a 5)" ayuda="Media mínima para que una característica ISO/IEC 25010 se considere aceptable."><Numero valor={cfg.nivelAceptableCalidad} onChange={num('nivelAceptableCalidad')} unidad="de 5" min={1} max={5} step={0.1} /></Opcion>
              <Opcion etiqueta="Rango objetivo del motor: mínimo" ayuda="Probabilidad de acierto esperada mínima para que un ejercicio cuente como «a su nivel»."><Numero valor={cfg.rangoObjetivoMin} onChange={num('rangoObjetivoMin')} unidad="%" min={0} max={100} /></Opcion>
              <Opcion etiqueta="Rango objetivo del motor: máximo" ayuda="Por encima, el ejercicio se considera demasiado fácil."><Numero valor={cfg.rangoObjetivoMax} onChange={num('rangoObjetivoMax')} unidad="%" min={0} max={100} /></Opcion>
              <Interruptor etiqueta="Encuesta de motivación (MSLQ)" ayuda="No forma parte de la investigación. Déjala apagada salvo que quieras usarla." valor={cfg.encuestaMotivacionActiva} onChange={(v) => set('encuestaMotivacionActiva', v)} />
            </Bloque>
          )}
        </Card>
      </div>

      {/* Barra fija de cambios sin guardar */}
      {cambios.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 px-4 py-3 shadow-lift backdrop-blur lg:left-[268px]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-fg"><b>{cambios.length}</b> cambio(s) sin guardar</p>
            <div className="flex gap-2">
              <button onClick={() => { setCfg(orig); setError(''); }} className="btn-ghost"><RotateCcw className="h-4 w-4" /> Descartar</button>
              <button onClick={guardar} disabled={guardando} className="btn-primary"><Save className="h-4 w-4" /> {guardando ? 'Guardando…' : 'Guardar cambios'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Bloque({ titulo, texto, children }: { titulo: string; texto: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold text-fg">{titulo}</h2>
      <p className="mb-5 mt-0.5 text-sm text-muted">{texto}</p>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

/** Una opción: a la izquierda qué es y qué cambia; a la derecha su valor. */
function Opcion({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,280px)] sm:items-center sm:gap-6">
      <div><p className="text-sm font-semibold text-fg">{etiqueta}</p>{ayuda && <p className="mt-0.5 text-xs text-muted">{ayuda}</p>}</div>
      <div>{children}</div>
    </div>
  );
}

function Numero({ valor, onChange, unidad, min, max, step }: { valor: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; unidad: string; min: number; max: number; step?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Input type="number" value={valor} onChange={onChange} min={min} max={max} step={step} className="!w-28" />
      <span className="text-sm text-muted">{unidad}</span>
    </div>
  );
}

function Interruptor({ etiqueta, ayuda, valor, onChange }: { etiqueta: string; ayuda?: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div><p className="text-sm font-semibold text-fg">{etiqueta}</p>{ayuda && <p className="mt-0.5 text-xs text-muted">{ayuda}</p>}</div>
      <button type="button" role="switch" aria-checked={valor} aria-label={etiqueta} onClick={() => onChange(!valor)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${valor ? 'bg-prexi-green' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${valor ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
