'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { UnidadDocente, TemaDocente, NIVEL_LABEL } from '@/lib/types';
import { PageHeader, Card, Skeleton, Badge, EmptyState } from '@/components/ui';
import { NIVELES } from '@/components/nivel-badge';
import { Check, ChevronLeft, ArrowRight, Layers, CheckCircle, AlertTriangle } from '@/components/icons';
import { PasoEstructura } from '@/components/docente/unidad/paso-estructura';
import { SelectorTema, aplanar } from '@/components/docente/unidad/selector-tema';
import { FlashcardsTema } from '@/components/docente/unidad/paso-flashcards';
import { BancoEjercicios } from '@/components/docente/banco-ejercicios';

const PASOS = ['Unidad y temas', 'Ejercicios', 'Flashcards', 'Examen y publicación'];
const META = 10;

/**
 * Asistente de una unidad, en cuatro pasos y una pantalla por paso:
 * 1) la unidad y sus temas, 2) los ejercicios de cada tema, 3) sus flashcards
 * y 4) el examen de la unidad y la publicación. `/docente/unidades/nueva`
 * abre el paso 1 vacío.
 */
export default function UnidadAsistentePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const esNueva = id === 'nueva';
  const paso = esNueva ? 0 : Math.min(3, Math.max(0, Number(search.get('paso') ?? '1') - 1));

  const [unidades, setUnidades] = useState<UnidadDocente[] | null>(null);
  const [temaId, setTemaId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    const r = await api.get<{ unidades: UnidadDocente[] }>('/docente/unidades').catch(() => null);
    setUnidades(r?.unidades ?? []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const unidad = useMemo(() => (esNueva ? null : unidades?.find((u) => String(u.id) === id) ?? null), [unidades, id, esNueva]);
  const temas = useMemo(() => aplanar(unidad?.temas ?? []), [unidad]);
  const temaActual = temas.find((t) => t.tema.id === temaId)?.tema ?? temas[0]?.tema ?? null;
  const numeroNuevo = unidades?.length ? Math.max(...unidades.map((u) => u.numero)) + 1 : 1;

  const irA = (n: number) => router.push(`/docente/unidades/${id}?paso=${n + 1}`);

  if (unidades === null) return <Skeleton className="h-64" />;
  if (!esNueva && !unidad) {
    return <EmptyState icon={<Layers className="h-7 w-7" />} title="No encontramos esta unidad" hint="Puede que haya sido eliminada. Vuelve a la lista de unidades." />;
  }

  const sinTemas = temas.length === 0;
  const navegacion = (anterior: number | null, siguiente: number | null, etiquetaSiguiente?: string) => (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      {anterior !== null ? <button onClick={() => irA(anterior)} className="btn-ghost"><ChevronLeft className="h-4 w-4" /> Atrás</button> : <span />}
      {siguiente !== null
        ? <button onClick={() => irA(siguiente)} className="btn-primary">{etiquetaSiguiente} <ArrowRight className="h-4 w-4" /></button>
        : <Link href="/docente/unidades" className="btn-primary"><Check className="h-4 w-4" /> Terminar</Link>}
    </div>
  );

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={unidad ? `Unidad ${unidad.numero}: ${unidad.titulo}` : 'Nueva unidad'}
        subtitle="Arma la unidad paso a paso. Todo se guarda al momento: puedes salir y continuar después."
        action={<Link href="/docente/unidades" className="btn-ghost"><ChevronLeft className="h-4 w-4" /> Todas las unidades</Link>}
      />

      {/* Indicador de pasos: también sirve para saltar de uno a otro */}
      <ol className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PASOS.map((nombre, i) => {
          const bloqueado = i > 0 && (esNueva || sinTemas);
          return (
            <li key={nombre}>
              <button onClick={() => irA(i)} disabled={bloqueado} aria-current={i === paso ? 'step' : undefined}
                title={bloqueado ? 'Primero crea la unidad y al menos un tema' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${i === paso ? 'border-prexi-blue bg-prexi-blue/10 font-semibold text-fg' : 'border-line bg-card text-muted hover:bg-subtle'}`}>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${i < paso ? 'bg-prexi-green text-white' : i === paso ? 'bg-prexi-blue text-accent-on' : 'bg-subtle text-muted'}`}>
                  {i < paso ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="min-w-0 truncate">{nombre}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {paso === 0 && (
        <PasoEstructura unidad={unidad} numeroNuevo={numeroNuevo} onCambio={cargar}
          onCreada={(nuevoId) => { cargar(); router.replace(`/docente/unidades/${nuevoId}?paso=1`); }}
          onSiguiente={() => irA(1)} />
      )}

      {paso === 1 && unidad && temaActual && (
        <>
          <Intro titulo="Paso 2 · Ejercicios de cada tema"
            texto={`Cada tema necesita ${META} ejercicios en cada nivel (Básico, Intermedio y Avanzado). Elige un tema, elige el nivel y escribe los ejercicios o pídeselos a PREXI: él propone ${META} y tú decides cuáles se quedan.`} />
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <SelectorTema temas={temas} seleccionado={temaActual.id} onSeleccionar={setTemaId} avance={avanceEjercicios} />
            <div className="min-w-0">
              <h2 className="mb-3 font-display text-xl font-bold text-fg">{temaActual.numero} {temaActual.titulo}</h2>
              <BancoEjercicios key={temaActual.id} destino={{ tipo: 'tema', temaId: temaActual.id, etiqueta: `${temaActual.numero} ${temaActual.titulo}` }} onCambio={cargar} />
            </div>
          </div>
          {navegacion(0, 2, 'Siguiente: flashcards')}
        </>
      )}

      {paso === 2 && unidad && temaActual && (
        <>
          <Intro titulo="Paso 3 · Flashcards de cada tema"
            texto={`Las flashcards son tarjetas de repaso: una pregunta al frente y su respuesta al reverso. Prepara ${META} por tema. Lo más rápido es «Generar desde mis ejercicios»: PREXI convierte en tarjeta cada ejercicio del paso 2, y luego puedes editarlas.`} />
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <SelectorTema temas={temas} seleccionado={temaActual.id} onSeleccionar={setTemaId}
              avance={(t) => ({ texto: `${t.flashcards} de ${META} flashcards`, listo: t.flashcards >= META })} />
            <div className="min-w-0"><FlashcardsTema tema={temaActual} onCambio={cargar} /></div>
          </div>
          {navegacion(1, 3, 'Siguiente: examen')}
        </>
      )}

      {paso === 3 && unidad && (
        <>
          <Intro titulo="Paso 4 · Examen de la unidad"
            texto={`El examen tiene ${META} preguntas de nivel intermedio y cada una combina 2 o 3 temas de la unidad. El estudiante lo aprueba con 80 sobre 100 y recién entonces pasa a la unidad siguiente.`} />
          <BancoEjercicios destino={{ tipo: 'examen', unidadId: unidad.id, etiqueta: `Examen de la Unidad ${unidad.numero}`, temas: temas.map(({ tema }) => ({ id: tema.id, etiqueta: `${tema.numero} ${tema.titulo}` })),
            otrosTemas: unidades.filter((u) => u.id !== unidad.id).flatMap((u) => aplanar(u.temas)).map(({ tema }) => ({ id: tema.id, etiqueta: `${tema.numero} ${tema.titulo}` })) }} onCambio={cargar} />
          <Publicacion unidad={unidad} onCambio={cargar} />
          {navegacion(2, null)}
        </>
      )}

      {paso > 0 && unidad && sinTemas && (
        <Card><p className="text-sm text-muted">Esta unidad aún no tiene temas. Vuelve al paso 1 para agregarlos.</p></Card>
      )}
    </div>
  );
}

function avanceEjercicios(t: TemaDocente) {
  const listos = NIVELES.filter((n) => t.por_nivel[n] >= t.ejercicios_minimos).length;
  return listos === 3
    ? { texto: 'Completo: 10 por nivel', listo: true }
    : { texto: NIVELES.map((n) => `${NIVEL_LABEL[n][0]} ${t.por_nivel[n]}`).join(' · ') + ` (meta ${t.ejercicios_minimos})`, listo: false };
}

function Intro({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="mb-5 rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-lg font-bold text-fg">{titulo}</h2>
      <p className="mt-1 text-sm text-muted">{texto}</p>
    </div>
  );
}

/** Cierre del asistente: qué temas ya pueden verse y cuáles no, con el motivo. */
function Publicacion({ unidad, onCambio }: { unidad: UnidadDocente; onCambio: () => Promise<void> | void }) {
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [error, setError] = useState('');
  const temas = aplanar(unidad.temas);

  async function cambiar(t: TemaDocente, datos: { publicado?: boolean; enDiagnostico?: boolean }) {
    setOcupado(t.id); setError('');
    try { await api.put(`/docente/unidades/temas/${t.id}`, datos); await onCambio(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo actualizar el tema.'); }
    finally { setOcupado(null); }
  }

  return (
    <Card className="mt-5">
      <h2 className="font-display text-xl font-bold text-fg">Publicar los temas</h2>
      <p className="mt-1 text-sm text-muted">Un tema en borrador no lo ve ningún estudiante. Publícalo cuando tenga sus {META} ejercicios por nivel.</p>
      {error && <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red" role="alert"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</p>}
      <ul className="mt-4 space-y-2">
        {temas.map(({ tema: t, esSubtema }) => (
          <li key={t.id} className={`flex flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2.5 ${esSubtema ? 'ml-6' : ''}`}>
            <div className="min-w-[200px] flex-1">
              <p className="text-sm font-semibold text-fg">{t.numero} {t.titulo}</p>
              {t.publicado
                ? <p className="flex items-center gap-1 text-xs font-medium text-prexi-green"><CheckCircle className="h-3.5 w-3.5" /> Los estudiantes ya lo ven</p>
                : t.puede_publicarse
                  ? <p className="text-xs font-medium text-prexi-green">Listo para publicar</p>
                  : <p className="text-xs text-prexi-amber">Faltan ejercicios: {t.faltan.join(', ')}</p>}
            </div>
            {t.puede_diagnosticar && (
              <label className="flex items-center gap-1.5 text-xs text-muted" title="Incluye este tema en el diagnóstico inicial del estudiante">
                <input type="checkbox" checked={t.en_diagnostico} disabled={ocupado !== null} onChange={() => cambiar(t, { enDiagnostico: !t.en_diagnostico })} className="h-4 w-4 accent-prexi-blue" />
                En el diagnóstico inicial
              </label>
            )}
            {t.publicado ? <Badge tone="green">Publicado</Badge> : <Badge tone="slate">Borrador</Badge>}
            <button onClick={() => cambiar(t, { publicado: !t.publicado })} disabled={ocupado !== null || (!t.publicado && !t.puede_publicarse)}
              className={`${t.publicado ? 'btn-ghost' : 'btn-primary'} !py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50`}>
              {ocupado === t.id ? 'Guardando…' : t.publicado ? 'Despublicar' : 'Publicar'}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
