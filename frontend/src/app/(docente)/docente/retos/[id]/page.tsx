'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { DocenteReto, OpcionTema, NivelDificultad, NIVEL_LABEL, NIVEL_COLOR } from '@/lib/types';
import { PageHeader, Card, Skeleton, Field, Input, Textarea, EmptyState } from '@/components/ui';
import { SelectorTema } from '@/components/docente/selector-tema';
import { NIVELES, estrellasDesdeNivel } from '@/components/nivel-badge';
import { Check, ChevronLeft, ArrowRight, AlertTriangle, Target, Save } from '@/components/icons';
import { TIPOS_RETO, TipoReto, tipoDe } from '@/components/docente/retos/tipos';

const PASOS = ['Tipo y tema', 'El reto', 'Publicación'];
const XP_POR_NIVEL: Record<NivelDificultad, number> = { basico: 10, intermedio: 15, avanzado: 20 };
const QUIEN_LO_VE: Record<NivelDificultad, string> = {
  basico: 'Para quien recién empieza el tema.',
  intermedio: 'Para quien ya domina lo básico.',
  avanzado: 'Para quien busca un desafío mayor.',
};

interface Form {
  tipo: TipoReto; temaId: number | null; nivel: NivelDificultad;
  titulo: string; enunciado: string; codigoInicial: string; ejemploEntrada: string; ejemploSalida: string;
  xp: number; xpTocado: boolean; fechaLimite: string; publicar: boolean;
}

/**
 * Asistente de un reto en tres pasos: 1) qué tipo es y a qué tema pertenece,
 * 2) el contenido —distinto según el tipo— y 3) puntos, fecha y publicación.
 * `/docente/retos/nuevo` crea; `/docente/retos/:id` edita.
 */
export default function RetoAsistentePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const esNuevo = id === 'nuevo';

  const [temas, setTemas] = useState<OpcionTema[] | null>(null);
  const [listo, setListo] = useState(false);
  const [noExiste, setNoExiste] = useState(false);
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [f, setF] = useState<Form>({
    tipo: search.get('tipo') === 'codigo' ? 'codigo' : 'bug', temaId: null, nivel: 'basico',
    titulo: '', enunciado: '', codigoInicial: '', ejemploEntrada: '', ejemploSalida: '',
    xp: XP_POR_NIVEL.basico, xpTocado: false, fechaLimite: '', publicar: true,
  });
  const set = (cambios: Partial<Form>) => { setError(''); setF((v) => ({ ...v, ...cambios })); };

  useEffect(() => {
    (async () => {
      const [t, r] = await Promise.all([
        api.get<{ temas: OpcionTema[] }>('/docente/unidades/temas/opciones').catch(() => ({ temas: [] as OpcionTema[] })),
        esNuevo ? Promise.resolve(null) : api.get<{ retos: DocenteReto[] }>('/docente/retos').catch(() => null),
      ]);
      setTemas(t.temas);
      if (esNuevo) {
        // Llega con el tema (o la unidad) ya elegidos desde la lista.
        const tema = Number(search.get('tema')) || null;
        const unidad = Number(search.get('unidad')) || null;
        const primero = unidad ? t.temas.filter((x) => x.unidad_id === unidad && !x.padre_id).sort((a, b) => a.orden - b.orden)[0] : undefined;
        setF((v) => ({ ...v, temaId: tema ?? primero?.id ?? null }));
      } else {
        const reto = r?.retos.find((x) => String(x.id) === id);
        if (!reto) { setNoExiste(true); return; }
        setF({
          tipo: tipoDe(reto), temaId: reto.temaId, nivel: reto.nivel_dificultad,
          titulo: reto.titulo, enunciado: reto.enunciado, codigoInicial: reto.codigoInicial ?? '',
          ejemploEntrada: reto.ejemploEntrada ?? '', ejemploSalida: reto.ejemploSalida ?? '',
          xp: reto.xp, xpTocado: true, fechaLimite: reto.fechaLimite ? reto.fechaLimite.slice(0, 10) : '', publicar: reto.activo,
        });
      }
      setListo(true);
    })();
    // Solo al entrar: los parámetros de la URL son el punto de partida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const tema = useMemo(() => temas?.find((t) => t.id === f.temaId) ?? null, [temas, f.temaId]);
  const info = TIPOS_RETO[f.tipo];
  const esBug = f.tipo === 'bug';

  /** Qué le falta a cada paso para poder avanzar (vacío = completo). */
  function faltaEn(p: number): string {
    if (p === 0) return f.temaId ? '' : 'Elige la unidad y el tema del reto.';
    if (p === 1) {
      if (f.titulo.trim().length < 3) return 'Ponle un título al reto.';
      if (f.enunciado.trim().length < 3) return 'Escribe qué debe hacer el estudiante.';
      if (esBug && !f.codigoInicial.trim()) return 'Pega el código que tiene el error.';
      if (esBug && !f.ejemploSalida.trim()) return 'Escribe la salida correcta: con ella el sistema califica solo.';
      return '';
    }
    if (f.xp < 5 || f.xp > 25) return 'Los puntos van de 5 a 25.';
    return '';
  }
  function avanzar() {
    const falta = faltaEn(paso);
    if (falta) { setError(falta); return; }
    setError(''); setPaso(paso + 1);
  }

  async function guardar() {
    for (let p = 0; p < 3; p += 1) { const falta = faltaEn(p); if (falta) { setPaso(p); setError(falta); return; } }
    setGuardando(true); setError('');
    const opcional = (s: string) => s.trim() || (esNuevo ? undefined : '');
    const cuerpo = {
      titulo: f.titulo.trim(), categoria: (tema?.titulo ?? 'General').slice(0, 80), temaId: f.temaId,
      estrellas: estrellasDesdeNivel(f.nivel), enunciado: f.enunciado.trim(),
      codigoInicial: opcional(f.codigoInicial), ejemploEntrada: opcional(f.ejemploEntrada), ejemploSalida: opcional(f.ejemploSalida),
      xp: f.xp, fechaLimite: f.fechaLimite ? new Date(`${f.fechaLimite}T23:59:59`).toISOString() : (esNuevo ? undefined : ''),
      activo: f.publicar, esBugHunt: esBug,
    };
    try {
      if (esNuevo) await api.post('/docente/retos', cuerpo);
      else await api.put(`/docente/retos/${id}`, cuerpo);
      router.push(`/docente/retos?tipo=${f.tipo}`);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo guardar el reto.'); setGuardando(false); }
  }

  if (noExiste) return <EmptyState icon={<Target className="h-7 w-7" />} title="No encontramos este reto" hint="Puede que lo hayas eliminado, o que sea de otro docente." />;
  if (!listo || temas === null) return <Skeleton className="h-64" />;

  return (
    <div className="animate-fade-up">
      <PageHeader title={esNuevo ? 'Nuevo reto' : `Editar: ${f.titulo || 'reto'}`}
        subtitle="Tres pasos cortos. Nada se guarda hasta el final."
        action={<Link href={`/docente/retos?tipo=${f.tipo}`} className="btn-ghost"><ChevronLeft className="h-4 w-4" /> Todos los retos</Link>} />

      <ol className="mb-6 grid grid-cols-3 gap-2">
        {PASOS.map((nombre, i) => (
          <li key={nombre}>
            <button onClick={() => { if (i < paso) { setError(''); setPaso(i); } }} disabled={i > paso} aria-current={i === paso ? 'step' : undefined}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:cursor-default ${i === paso ? 'border-prexi-blue bg-prexi-blue/10 font-semibold text-fg' : i < paso ? 'border-line bg-card text-fg hover:bg-subtle' : 'border-line bg-card text-muted'}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${i < paso ? 'bg-prexi-green text-white' : i === paso ? 'bg-prexi-blue text-accent-on' : 'bg-subtle text-muted'}`}>
                {i < paso ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="min-w-0 truncate">{nombre}</span>
            </button>
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-prexi-red">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {/* ── Paso 1 ── */}
      {paso === 0 && (
        <div className="space-y-5">
          <Card>
            <h2 className="font-display text-xl font-bold text-fg">¿Qué tipo de reto es?</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(Object.keys(TIPOS_RETO) as TipoReto[]).map((t) => {
                const d = TIPOS_RETO[t];
                const sel = f.tipo === t;
                return (
                  <button key={t} type="button" onClick={() => set({ tipo: t })} aria-pressed={sel}
                    className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${sel ? '' : 'border-line hover:bg-subtle'}`}
                    style={sel ? { borderColor: d.color, backgroundColor: `${d.color}0F` } : undefined}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ color: d.color, backgroundColor: `${d.color}1F` }}><d.Icono className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-lg font-bold text-fg">{d.nombre}</span>
                      <span className="mt-0.5 block text-sm text-muted">{d.resumen}</span>
                      <span className="mt-1.5 block text-xs font-semibold text-fg">{d.calificacion}</span>
                    </span>
                    {sel && <Check className="h-5 w-5 shrink-0" style={{ color: d.color }} />}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-xl font-bold text-fg">¿De qué tema es?</h2>
            <p className="mb-4 mt-1 text-sm text-muted">El estudiante encontrará el reto junto a ese tema.</p>
            {temas.length === 0
              ? <p className="text-sm text-muted">Aún no hay temas. Créalos primero en <Link href="/docente/unidades" className="font-semibold text-prexi-blue-deep hover:underline">Unidades</Link>.</p>
              : <SelectorTema temas={temas} valor={f.temaId} onChange={(temaId) => set({ temaId })} />}
          </Card>

          <Card>
            <h2 className="font-display text-xl font-bold text-fg">¿Para qué nivel?</h2>
            <p className="mb-4 mt-1 text-sm text-muted">Solo lo verán los estudiantes que estén en ese nivel en el tema elegido.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {NIVELES.map((n) => {
                const sel = f.nivel === n;
                return (
                  <button key={n} type="button" aria-pressed={sel} onClick={() => set({ nivel: n, ...(f.xpTocado ? {} : { xp: XP_POR_NIVEL[n] }) })}
                    className={`rounded-2xl border-2 p-3 text-left transition ${sel ? '' : 'border-line hover:bg-subtle'}`}
                    style={sel ? { borderColor: NIVEL_COLOR[n], backgroundColor: `${NIVEL_COLOR[n]}14` } : undefined}>
                    <span className="block font-bold text-fg">{NIVEL_LABEL[n]}</span>
                    <span className="mt-0.5 block text-xs text-muted">{QUIEN_LO_VE[n]}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── Paso 2 ── */}
      {paso === 1 && (
        <Card>
          <div className="mb-4 flex items-start gap-3 rounded-xl p-3" style={{ backgroundColor: `${info.color}12` }}>
            <info.Icono className="mt-0.5 h-5 w-5 shrink-0" style={{ color: info.color }} />
            <p className="text-sm text-fg"><b>{info.nombre}</b> · {tema ? `${tema.numero} ${tema.titulo}` : ''} · nivel {NIVEL_LABEL[f.nivel]}. {info.calificacion}</p>
          </div>
          <div className="space-y-4">
            <Field label="Título del reto" hint="Corto y claro: es lo que el estudiante ve en la lista.">
              <Input value={f.titulo} onChange={(e) => set({ titulo: e.target.value })} placeholder={esBug ? 'Ej.: El promedio que no promedia' : 'Ej.: Suma de los números pares'} />
            </Field>
            <Field label={esBug ? '¿Qué debería hacer el programa?' : '¿Qué debe programar el estudiante?'}
              hint={esBug ? 'Explica el resultado esperado, sin decir dónde está el error.' : 'Describe el problema con sus datos de entrada y lo que debe mostrar.'}>
              <Textarea rows={4} value={f.enunciado} onChange={(e) => set({ enunciado: e.target.value })}
                placeholder={esBug ? 'Ej.: Este programa debería mostrar el promedio de tres notas, pero muestra un número equivocado. Encuentra el error y corrígelo.' : 'Ej.: Escribe un programa que sume todos los números pares del 1 al 20 y muestre el resultado.'} />
            </Field>

            {esBug ? (
              <>
                <Field label="Código con el error" hint="Pega el programa YA con el error puesto. El estudiante lo recibe así en su editor.">
                  <Textarea rows={8} className="font-mono text-sm" value={f.codigoInicial} onChange={(e) => set({ codigoInicial: e.target.value })}
                    placeholder={'a = 7\nb = 8\nc = 9\npromedio = a + b + c / 3\nprint(promedio)'} />
                </Field>
                <Field label="Salida correcta" hint="Lo que imprime el programa cuando ya está corregido. El sistema compara la salida del estudiante con esta y califica solo.">
                  <Textarea rows={2} className="font-mono text-sm" value={f.ejemploSalida} onChange={(e) => set({ ejemploSalida: e.target.value })} placeholder="8.0" />
                </Field>
              </>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Ejemplo de entrada (opcional)" hint="Datos con los que puede probar.">
                    <Textarea rows={3} className="font-mono text-sm" value={f.ejemploEntrada} onChange={(e) => set({ ejemploEntrada: e.target.value })} placeholder="n = 20" />
                  </Field>
                  <Field label="Salida esperada (opcional)" hint="Lo que debería mostrar con ese ejemplo.">
                    <Textarea rows={3} className="font-mono text-sm" value={f.ejemploSalida} onChange={(e) => set({ ejemploSalida: e.target.value })} placeholder="110" />
                  </Field>
                </div>
                <Field label="Código de partida (opcional)" hint="Si lo dejas vacío, el estudiante empieza con el editor en blanco.">
                  <Textarea rows={5} className="font-mono text-sm" value={f.codigoInicial} onChange={(e) => set({ codigoInicial: e.target.value })} placeholder={'# Escribe aquí tu solución\n'} />
                </Field>
              </>
            )}
          </div>
        </Card>
      )}

      {/* ── Paso 3 ── */}
      {paso === 2 && (
        <div className="space-y-5">
          <Card>
            <h2 className="font-display text-xl font-bold text-fg">Puntos y fecha</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Puntos (XP) que gana al resolverlo" hint={`De 5 a 25. Sugerido para nivel ${NIVEL_LABEL[f.nivel]}: ${XP_POR_NIVEL[f.nivel]}.`}>
                <Input type="number" min={5} max={25} value={f.xp} onChange={(e) => set({ xp: Number(e.target.value), xpTocado: true })} />
              </Field>
              <Field label="Fecha límite (opcional)" hint="Déjala vacía si se puede entregar en cualquier momento.">
                <Input type="date" value={f.fechaLimite} onChange={(e) => set({ fechaLimite: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-xl font-bold text-fg">¿Lo publicas ahora?</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {([[true, 'Publicar ahora', 'Los estudiantes de ese nivel lo ven de inmediato.'], [false, 'Guardar como borrador', 'Nadie lo ve hasta que lo publiques desde la lista.']] as const).map(([valor, titulo, texto]) => (
                <button key={titulo} type="button" aria-pressed={f.publicar === valor} onClick={() => set({ publicar: valor })}
                  className={`rounded-2xl border-2 p-4 text-left transition ${f.publicar === valor ? 'border-prexi-blue bg-prexi-blue/10' : 'border-line hover:bg-subtle'}`}>
                  <span className="block font-bold text-fg">{titulo}</span>
                  <span className="mt-0.5 block text-sm text-muted">{texto}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-bold text-fg">Resumen</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {[['Tipo', info.nombre], ['Tema', tema ? `${tema.numero} ${tema.titulo}` : '—'], ['Nivel', NIVEL_LABEL[f.nivel]], ['Título', f.titulo], ['Calificación', esBug ? 'Automática' : 'La revisas tú'], ['Puntos', `${f.xp} XP`]].map(([k, v]) => (
                <div key={k} className="flex gap-2"><dt className="w-24 shrink-0 text-muted">{k}</dt><dd className="min-w-0 font-semibold text-fg">{v}</dd></div>
              ))}
            </dl>
          </Card>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {paso > 0 ? <button onClick={() => { setError(''); setPaso(paso - 1); }} className="btn-ghost"><ChevronLeft className="h-4 w-4" /> Atrás</button> : <span />}
        {paso < 2
          ? <button onClick={avanzar} className="btn-primary">Siguiente: {PASOS[paso + 1].toLowerCase()} <ArrowRight className="h-4 w-4" /></button>
          : <button onClick={guardar} disabled={guardando} className="btn-primary disabled:opacity-60"><Save className="h-4 w-4" /> {guardando ? 'Guardando…' : f.publicar ? 'Guardar y publicar' : 'Guardar borrador'}</button>}
      </div>
    </div>
  );
}
