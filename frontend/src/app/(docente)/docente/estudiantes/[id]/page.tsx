'use client';

/**
 * FICHA DEL ESTUDIANTE — todo lo que el docente necesita de una persona:
 * quién es, en qué curso y con qué docente está, su nivel actual, cómo le va en
 * los ejercicios y qué nota sacó en cada examen.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { NivelDificultad } from '@/lib/types';
import { Badge, Card, Modal, SectionTitle, Skeleton, Textarea } from '@/components/ui';
import { EstadoChip, FilaCurso, NivelChip, PromedioChip, fechaCorta } from '@/components/docente/curso';
import { AlertTriangle, ArrowLeft, CheckCircle, Edit, KeyRound, Power, Save } from '@/components/icons';

interface Ficha {
  estudiante: FilaCurso & {
    carrera: string | null; racha_dias: number; registrado_en: string;
    nivel_inicial: NivelDificultad | null; nivel_inicial_label: string | null;
  };
  niveles: {
    unidad_id: number; numero: number; titulo: string; nivel: NivelDificultad | null; nivel_label: string | null;
    examen: { puntaje: number; aprobado: boolean } | null;
    temas: {
      tema_id: number; numero: string; titulo: string; es_subtema: boolean; nivel: NivelDificultad | null;
      ejercicios_resueltos: number; intentos: number; tasa_acierto: number | null;
    }[];
  }[];
  ejercicios: {
    intentos: number; resueltos: number; tasa_acierto: number | null;
    por_nivel: { nivel: NivelDificultad; nivel_label: string; intentos: number; tasa_acierto: number | null }[];
    temas_debiles: { numero: string; titulo: string; tasa_acierto: number | null; intentos: number }[];
    patrones_error: { clave: string; descripcion: string; frecuencia: number }[];
  };
  examenes: {
    promedio: number | null;
    de_unidad: { unidad: number; titulo: string; nota: number; aciertos: number; total: number; aprobado: boolean; fecha: string }[];
    subida_nivel: { tema: string; titulo: string; desde: string; hacia: string; nota: number; aprobado: boolean; fecha: string }[];
    diagnostico: { nota: number; fecha: string } | null;
    evaluacion_final: { nota: number; fecha: string } | null;
  };
  actividad: { dia: string; intentos: number; aciertos: number }[];
  historial: { titulo: string; categoria: string; correcto: boolean; fecha: string }[];
  nota: string;
}

interface ParaleloOpcion { id: number; nombre: string; materia: string }

export default function FichaEstudiantePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [f, setF] = useState<Ficha | null>(null);
  const [error, setError] = useState('');
  const [nota, setNota] = useState('');
  const [guardada, setGuardada] = useState(false);
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(() => {
    api.get<Ficha>(`/docente/estudiantes/${id}`)
      .then((r) => { setF(r); setNota(r.nota); })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudo cargar la ficha.'));
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  async function guardarNota() {
    await api.put(`/docente/estudiantes/${id}/nota`, { texto: nota }).catch(() => undefined);
    setGuardada(true); setTimeout(() => setGuardada(false), 2000);
  }

  async function restablecer() {
    if (!f || !confirm(`¿Restablecer el acceso de ${f.estudiante.nombre}?\n\nSu contraseña volverá a ser su CI y deberá crear una nueva al entrar.`)) return;
    try { const r = await api.post<{ mensaje: string }>(`/docente/registro/estudiantes/${id}/restablecer-acceso`); setAviso(r.mensaje); }
    catch (e) { setAviso(e instanceof ApiError ? e.message : 'No se pudo restablecer.'); }
  }

  async function cambiarEstado() {
    if (!f) return;
    const baja = f.estudiante.activo;
    if (!confirm(baja
      ? `¿Dar de baja a ${f.estudiante.nombre}?\n\nNo podrá ingresar, pero se conserva todo su historial. Puedes reactivarlo cuando quieras.`
      : `¿Reactivar a ${f.estudiante.nombre}?`)) return;
    try { await api.patch(`/docente/registro/estudiantes/${id}/estado`, { activo: !baja }); cargar(); }
    catch (e) { setAviso(e instanceof ApiError ? e.message : 'No se pudo actualizar.'); }
  }

  if (error) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-prexi-amber" />
        <p className="mt-2 font-display text-lg font-bold text-fg">{error}</p>
        <button onClick={() => router.push('/docente/estudiantes')} className="btn-primary mt-4">Volver a mis estudiantes</button>
      </Card>
    );
  }
  if (!f) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;

  const e = f.estudiante;
  const maxDia = Math.max(1, ...f.actividad.map((a) => a.intentos));

  return (
    <div className="animate-fade-up">
      <button onClick={() => router.back()} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-prexi-blue-deep hover:underline">
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      {/* ── Identificación y curso ── */}
      <Card className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-prexi-blue text-2xl font-extrabold text-accent-on">{e.nombre.charAt(0)}</div>
            <div>
              <h1 className="font-display text-2xl font-extrabold text-fg">{e.nombre}</h1>
              <p className="text-sm text-muted">CI <b className="text-fg">{e.ci ?? '—'}</b> · RU <b className="text-fg">{e.ru ?? '—'}</b>{e.email ? ` · ${e.email}` : ''}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {e.activo ? <EstadoChip estado={e.estado} /> : <Badge tone="slate">Dado de baja</Badge>}
                <NivelChip nivel={e.nivel} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditando(true)} className="btn-ghost !px-3 !py-2 text-sm"><Edit className="h-4 w-4" /> Editar datos</button>
            <button onClick={restablecer} className="btn-ghost !px-3 !py-2 text-sm"><KeyRound className="h-4 w-4" /> Restablecer acceso</button>
            <button onClick={cambiarEstado} className="btn-ghost !px-3 !py-2 text-sm"><Power className="h-4 w-4" /> {e.activo ? 'Dar de baja' : 'Reactivar'}</button>
          </div>
        </div>

        {aviso && <p className="mt-3 rounded-xl bg-prexi-blue/10 px-4 py-2.5 text-sm text-fg">{aviso}</p>}

        <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Dato etiqueta="Materia" valor={e.paralelo.materia ? `${e.paralelo.materia}${e.paralelo.gestion ? ` · ${e.paralelo.gestion}` : ''}` : 'Sin materia'} />
          <Dato etiqueta="Paralelo" valor={e.paralelo.nombre} />
          <Dato etiqueta="Docente" valor={e.docente ?? 'Sin docente asignado'} />
          <Dato etiqueta="Última actividad" valor={fechaCorta(e.ultima_sesion)} />
        </div>

        {e.motivos_riesgo.length > 0 && e.activo && (
          <div className="mt-4 rounded-2xl border border-prexi-amber/40 bg-prexi-amber/10 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-fg"><AlertTriangle className="h-4 w-4 text-prexi-amber" /> Necesita tu atención</p>
            <ul className="space-y-0.5 text-sm text-fg">{e.motivos_riesgo.map((m) => <li key={m.clave}>• {m.detalle}</li>)}</ul>
          </div>
        )}
      </Card>

      {/* ── Resumen: nivel y promedio ── */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="!p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Nivel actual</p>
          <div className="mt-1"><NivelChip nivel={e.nivel} /></div>
          <p className="mt-1.5 text-xs text-muted">Inicial (diagnóstico): {e.nivel_inicial_label ?? 'sin diagnóstico'}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Promedio general</p>
          <div className="mt-1"><PromedioChip promedio={e.promedio} grande /></div>
          <p className="mt-1 text-xs text-muted">
            {e.situacion === 'aprobado' ? 'Alcanza el 80 requerido.' : e.situacion === 'cerca' ? 'Cerca del 80: evalúa habilitarlo.' : e.situacion === 'bajo' ? 'Por debajo del 80 requerido.' : 'Aún no rindió exámenes.'}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Ejercicios</p>
          <p className="mt-1 font-display text-2xl font-bold text-fg">{f.ejercicios.resueltos}<span className="text-sm font-normal text-muted"> resueltos</span></p>
          <p className="mt-1 text-xs text-muted">{f.ejercicios.intentos} intentos · {f.ejercicios.tasa_acierto ?? 0} % de acierto</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Evaluación final</p>
          {f.examenes.evaluacion_final
            ? <div className="mt-1"><PromedioChip promedio={f.examenes.evaluacion_final.nota} grande /></div>
            : <p className="mt-1 font-display text-lg font-bold text-muted">No rendida</p>}
          <p className="mt-1 text-xs text-muted">Diagnóstico inicial: {f.examenes.diagnostico ? `${f.examenes.diagnostico.nota}/100` : 'no rendido'}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* ── Exámenes ── */}
        <Card>
          <SectionTitle className="mb-1">Desempeño en exámenes</SectionTitle>
          <p className="mb-3 text-sm text-muted">Todas las notas sobre 100. Se aprueba con 80.</p>
          {f.examenes.de_unidad.length === 0 && f.examenes.subida_nivel.length === 0 ? (
            <p className="rounded-xl bg-subtle px-4 py-5 text-center text-sm text-muted">Todavía no rindió ningún examen.</p>
          ) : (
            <div className="space-y-4">
              {f.examenes.de_unidad.length > 0 && (
                <Tabla titulo="Exámenes de fin de unidad" filas={f.examenes.de_unidad.map((x) => ({
                  clave: `${x.unidad}-${x.fecha}`, nombre: `Unidad ${x.unidad} · ${x.titulo}`,
                  detalle: `${x.aciertos} de ${x.total} correctas · ${fechaCorta(x.fecha)}`, nota: x.nota, aprobado: x.aprobado,
                }))} />
              )}
              {f.examenes.subida_nivel.length > 0 && (
                <Tabla titulo="Evaluaciones para subir de nivel" filas={f.examenes.subida_nivel.map((x) => ({
                  clave: `${x.tema}-${x.fecha}`, nombre: `${x.tema} ${x.titulo}`,
                  detalle: `${x.desde} → ${x.hacia} · ${fechaCorta(x.fecha)}`, nota: x.nota, aprobado: x.aprobado,
                }))} />
              )}
            </div>
          )}
        </Card>

        {/* ── Ejercicios ── */}
        <Card>
          <SectionTitle className="mb-3">Desempeño en ejercicios</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {f.ejercicios.por_nivel.map((n) => (
              <div key={n.nivel} className="rounded-xl bg-subtle px-3 py-2 text-center">
                <NivelChip nivel={n.nivel} />
                <p className="mt-1 font-display text-lg font-bold text-fg">{n.tasa_acierto === null ? '—' : `${n.tasa_acierto} %`}</p>
                <p className="text-[11px] text-muted">{n.intentos} intentos</p>
              </div>
            ))}
          </div>

          <p className="mb-2 mt-4 text-sm font-semibold text-fg">Temas que más le cuestan</p>
          {f.ejercicios.temas_debiles.length === 0
            ? <p className="text-sm text-muted">Ningún tema con bajo acierto por ahora.</p>
            : (
              <ul className="space-y-1.5">
                {f.ejercicios.temas_debiles.map((t) => (
                  <li key={t.numero} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-fg">{t.numero} {t.titulo}</span>
                    <span className="shrink-0 font-semibold text-prexi-red">{t.tasa_acierto} % <span className="font-normal text-muted">en {t.intentos} intentos</span></span>
                  </li>
                ))}
              </ul>
            )}

          {f.ejercicios.patrones_error.length > 0 && (
            <>
              <p className="mb-2 mt-4 text-sm font-semibold text-fg">Errores que repite</p>
              <ul className="space-y-1 text-sm text-muted">
                {f.ejercicios.patrones_error.map((p) => <li key={p.clave}>• {p.descripcion} <span className="text-xs">({p.frecuencia} veces)</span></li>)}
              </ul>
            </>
          )}

          <p className="mb-2 mt-4 text-sm font-semibold text-fg">Últimos 7 días</p>
          <div className="flex h-20 items-end gap-1.5">
            {f.actividad.map((a) => (
              <div key={a.dia} className="flex flex-1 flex-col items-center gap-1" title={`${a.dia}: ${a.intentos} intentos, ${a.aciertos} correctos`}>
                <div className="flex w-full flex-1 items-end overflow-hidden rounded bg-subtle">
                  <div className="w-full rounded bg-prexi-blue" style={{ height: `${(a.intentos / maxDia) * 100}%` }} />
                </div>
                <span className="text-[10px] text-muted">{new Date(`${a.dia}T12:00:00`).toLocaleDateString('es-BO', { weekday: 'short' })}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Nivel por unidad y tema ── */}
        <Card className="xl:col-span-2">
          <SectionTitle className="mb-1">Nivel por unidad y tema</SectionTitle>
          <p className="mb-3 text-sm text-muted">El nivel de cada tema es el que el sistema usa para elegirle ejercicios.</p>
          {f.niveles.length === 0 ? <p className="text-sm text-muted">Aún no hay unidades publicadas.</p> : (
            <div className="space-y-3">
              {f.niveles.map((u) => (
                <details key={u.unidad_id} className="rounded-2xl border border-line" open={u.temas.some((t) => t.intentos > 0)}>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1 font-semibold text-fg">Unidad {u.numero} · {u.titulo}</span>
                    {u.nivel && <NivelChip nivel={u.nivel} />}
                    {u.examen
                      ? <Badge tone={u.examen.aprobado ? 'green' : 'amber'}>Examen: {u.examen.puntaje}/100</Badge>
                      : <Badge tone="slate">Examen sin rendir</Badge>}
                  </summary>
                  <ul className="divide-y divide-line border-t border-line">
                    {u.temas.map((t) => (
                      <li key={t.tema_id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm ${t.es_subtema ? 'pl-9' : ''}`}>
                        <span className="min-w-0 flex-1 truncate text-fg">{t.numero} {t.titulo}</span>
                        <span className="text-xs text-muted">{t.ejercicios_resueltos} resueltos{t.tasa_acierto !== null ? ` · ${t.tasa_acierto} % de acierto` : ''}</span>
                        {t.nivel ? <NivelChip nivel={t.nivel} /> : <span className="text-xs text-muted">Sin empezar</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </Card>

        {/* ── Actividad reciente ── */}
        <Card>
          <SectionTitle className="mb-3">Actividad reciente</SectionTitle>
          {f.historial.length === 0 ? <p className="text-sm text-muted">Sin intentos todavía.</p> : (
            <ul className="space-y-1.5">
              {f.historial.map((h, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${h.correcto ? 'bg-prexi-green' : 'bg-prexi-red'}`} />
                  <span className="min-w-0 flex-1 truncate text-fg">{h.titulo}</span>
                  <span className="shrink-0 text-xs text-muted">{fechaCorta(h.fecha)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ── Nota del docente ── */}
        <Card>
          <SectionTitle className="mb-1">Tu nota sobre este estudiante</SectionTitle>
          <p className="mb-3 text-sm text-muted">Solo tú la ves.</p>
          <Textarea rows={5} value={nota} onChange={(ev) => setNota(ev.target.value)} placeholder="Ej.: le cuesta la traza de bucles; reforzar con ejercicios de la unidad 3." />
          <div className="mt-3 flex items-center gap-3">
            <button onClick={guardarNota} className="btn-primary"><Save className="h-4 w-4" /> Guardar nota</button>
            {guardada && <span className="inline-flex items-center gap-1 text-sm text-prexi-green"><CheckCircle className="h-4 w-4" /> Guardada</span>}
          </div>
        </Card>
      </div>

      <p className="mt-5 text-xs text-muted">Registrado el {fechaCorta(e.registrado_en)}. <Link href="/docente/examenes" className="font-semibold text-prexi-blue-deep hover:underline">Ir a los exámenes de unidad</Link></p>

      {editando && <EditarDatos estudiante={e} onCerrar={() => setEditando(false)} onGuardado={() => { setEditando(false); cargar(); }} />}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-xl bg-subtle px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{etiqueta}</p>
      <p className="truncate text-sm font-semibold text-fg" title={valor}>{valor}</p>
    </div>
  );
}

function Tabla({ titulo, filas }: { titulo: string; filas: { clave: string; nombre: string; detalle: string; nota: number; aprobado: boolean }[] }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-fg">{titulo}</p>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
        {filas.map((x) => (
          <li key={x.clave} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{x.nombre}</p>
              <p className="text-xs text-muted">{x.detalle}</p>
            </div>
            <PromedioChip promedio={x.nota} />
            <Badge tone={x.aprobado ? 'green' : 'amber'}>{x.aprobado ? 'Aprobado' : 'No aprobado'}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditarDatos({ estudiante, onCerrar, onGuardado }: { estudiante: Ficha['estudiante']; onCerrar: () => void; onGuardado: () => void }) {
  const [form, setForm] = useState({
    apellidoPaterno: estudiante.apellido_paterno ?? '', apellidoMaterno: estudiante.apellido_materno ?? '',
    nombres: estudiante.nombres ?? '', ci: estudiante.ci ?? '', ru: estudiante.ru ?? '',
    paraleloId: estudiante.paralelo.id ? String(estudiante.paralelo.id) : '',
  });
  const [paralelos, setParalelos] = useState<ParaleloOpcion[]>([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.get<{ materias: { nombre: string; gestion: string; paralelos: { id: number; nombre: string }[] }[] }>('/docente/registro/materias')
      .then((r) => setParalelos(r.materias.flatMap((m) => m.paralelos.map((p) => ({ id: p.id, nombre: p.nombre, materia: `${m.nombre} ${m.gestion}` })))))
      .catch(() => undefined);
  }, []);

  async function guardar() {
    setGuardando(true); setError('');
    try {
      await api.patch(`/docente/registro/estudiantes/${estudiante.id}`, {
        apellidoPaterno: form.apellidoPaterno, apellidoMaterno: form.apellidoMaterno, nombres: form.nombres,
        ...(form.ci ? { ci: form.ci } : {}), ...(form.ru ? { ru: form.ru } : {}),
        ...(form.paraleloId ? { paraleloId: Number(form.paraleloId) } : {}),
      });
      onGuardado();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo guardar.'); setGuardando(false); }
  }

  const campo = (clave: keyof typeof form, etiqueta: string) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-fg">{etiqueta}</span>
      <input className="input" value={form[clave]} onChange={(e) => setForm({ ...form, [clave]: e.target.value })} />
    </label>
  );

  return (
    <Modal open onClose={onCerrar} title="Editar datos del estudiante"
      footer={<><button onClick={onCerrar} className="btn-ghost">Cancelar</button><button onClick={guardar} disabled={guardando} className="btn-primary disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar cambios'}</button></>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {campo('apellidoPaterno', 'Apellido paterno')}
        {campo('apellidoMaterno', 'Apellido materno')}
        <div className="sm:col-span-2">{campo('nombres', 'Nombres')}</div>
        {campo('ci', 'CI')}
        {campo('ru', 'RU')}
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-fg">Paralelo</span>
          <select className="input" value={form.paraleloId} onChange={(e) => setForm({ ...form, paraleloId: e.target.value })}>
            <option value="">— Sin cambios —</option>
            {paralelos.map((p) => <option key={p.id} value={p.id}>Paralelo {p.nombre} · {p.materia}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{error}</p>}
    </Modal>
  );
}
