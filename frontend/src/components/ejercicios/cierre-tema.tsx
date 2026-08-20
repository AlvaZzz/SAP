'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { NIVEL_COLOR, UnidadEstudiante, TemaEstudiante, ProgresoNivel } from '@/lib/types';
import { Trophy, TrendingUp, ArrowRight, RotateCcw, Sparkles, CheckCircle } from '@/components/icons';

/**
 * CIERRE DE TEMA: qué se le ofrece al estudiante cuando agota los ejercicios de
 * su nivel en un tema.
 *
 * Antes no había cierre: al resolver el último pendiente el botón pasaba a
 * "Finalizar" y devolvía a la lista de unidades sin decir nada. El estudiante no
 * se enteraba de que había completado el nivel ni de que podía repetir el tema
 * en el nivel superior — justo el paso que sostiene la adaptatividad.
 *
 * Ahora se felicita SIEMPRE indicando el nivel alcanzado, y se ofrece de forma
 * activa el paso siguiente:
 *   · Básico/Intermedio → repetir el tema en el nivel superior (mini-diagnóstico).
 *   · Avanzado          → dominio completo del tema y salto al siguiente tema.
 */
export function CierreTema({ temaId, tituloTema, progreso }: {
  temaId: number;
  tituloTema: string;
  progreso: ProgresoNivel | null;
}) {
  const router = useRouter();
  // Tema siguiente dentro de la misma unidad, para poder ofrecerlo por su nombre
  // en vez de mandar al estudiante de vuelta a buscarlo en la lista.
  const [siguiente, setSiguiente] = useState<{ tema: TemaEstudiante; unidadId: number } | null>(null);
  const [unidadId, setUnidadId] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    api.get<{ unidades: UnidadEstudiante[] }>('/unidades').then((r) => {
      if (!vivo) return;
      for (const u of r.unidades) {
        // Los subtemas cuentan como temas del recorrido: se aplana igual que en
        // la vista de unidad para que "el siguiente" sea el siguiente de verdad.
        const planos = u.temas.flatMap((t) => [t, ...(t.subtemas ?? [])]);
        const i = planos.findIndex((t) => t.id === temaId);
        if (i < 0) continue;
        setUnidadId(u.id);
        const sig = planos.slice(i + 1).find((t) => t.desbloqueado && t.total_ejercicios > 0);
        if (sig) setSiguiente({ tema: sig, unidadId: u.id });
        return;
      }
    }).catch(() => undefined);
    return () => { vivo = false; };
  }, [temaId]);

  const nivel = progreso?.nivel ?? 'basico';
  const nivelLabel = progreso?.nivel_label ?? 'Básico';
  const esAvanzado = nivel === 'avanzado';
  const color = NIVEL_COLOR[nivel];

  /** Abre el mini-diagnóstico para repetir el tema en el nivel superior. */
  const subirNivel = () => router.push(`/ejercicios/subir-nivel/${temaId}`);
  const irASiguiente = () => {
    if (siguiente) router.push(`/ejercicios/unidad/${siguiente.unidadId}?tema=${siguiente.tema.id}`);
    else if (unidadId) router.push(`/ejercicios/unidad/${unidadId}`);
    else router.push('/ejercicios');
  };

  return (
    <div className="card animate-fade-up border-l-4" style={{ borderLeftColor: esAvanzado ? '#10B981' : color }}>
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
          style={{ color: esAvanzado ? '#10B981' : color, backgroundColor: `${esAvanzado ? '#10B981' : color}26` }}>
          <Trophy className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          {esAvanzado ? (
            <>
              <h2 className="font-display text-xl font-bold text-fg">¡Dominio completo de este tema!</h2>
              <p className="mt-1 text-sm text-muted">
                Terminaste <b className="text-fg">{tituloTema}</b> en nivel <b style={{ color }}>Avanzado</b>, que es el
                máximo. No queda nada por encima: has demostrado que lo dominas.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl font-bold text-fg">¡Completaste el tema en nivel {nivelLabel}!</h2>
              <p className="mt-1 text-sm text-muted">
                Resolviste los {progreso?.total ?? 0} ejercicios de nivel <b style={{ color }}>{nivelLabel}</b> de{' '}
                <b className="text-fg">{tituloTema}</b>. El paso natural ahora es repetir el tema en el nivel superior:
                los mismos contenidos, con ejercicios más exigentes y más XP.
              </p>
            </>
          )}

          <div className="mt-4 flex flex-wrap gap-2.5">
            {!esAvanzado && (
              <button onClick={subirNivel} className="btn-primary !py-2">
                <TrendingUp className="h-4 w-4" /> Repetir en nivel superior
              </button>
            )}
            <button onClick={irASiguiente} className={esAvanzado ? 'btn-primary !py-2' : 'btn-ghost'}>
              {siguiente ? <>Siguiente tema: {siguiente.tema.titulo} <ArrowRight className="h-4 w-4" /></> : <>Volver a la unidad <ArrowRight className="h-4 w-4" /></>}
            </button>
            <button onClick={() => router.push(`/flashcards/tema/${temaId}`)} className="btn-ghost">
              <Sparkles className="h-4 w-4" /> Repasar con flashcards
            </button>
          </div>

          {!esAvanzado && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
              <CheckCircle className="h-3.5 w-3.5 text-prexi-green" />
              Subir de nivel es opcional: también puedes seguir con el siguiente tema y volver más adelante.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Aviso de RACHA. Dos mensajes opuestos, y ese es justamente el arreglo:
 * con aciertos se anima a SEGUIR, y solo con fallos se ofrece parar.
 */
export function AvisoRacha({ tipo, aciertos, temaId, onSeguir }: {
  tipo: 'racha' | 'atasco';
  aciertos: number;
  temaId: number | null;
  onSeguir: () => void;
}) {
  const router = useRouter();

  if (tipo === 'racha') {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-prexi-amber/40 bg-prexi-amber/10 p-3.5 animate-fade-up">
        <Sparkles className="h-5 w-5 shrink-0 text-prexi-amber" />
        <p className="min-w-0 flex-1 text-sm font-semibold text-fg">
          ¡{aciertos} seguidas! Estás en racha — este es el mejor momento para seguir.
        </p>
        <button onClick={onSeguir} className="btn-primary !py-1.5 !text-xs">
          Seguir practicando <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-subtle/60 p-3.5 animate-fade-up">
      <p className="text-sm font-semibold text-fg">Llevas tres seguidas sin acertar. No pasa nada.</p>
      <p className="mt-0.5 text-sm text-muted">
        Cuando se acumulan los fallos, insistir cansa más de lo que enseña. Puedes repasar la teoría del tema o parar un
        rato y volver: el progreso queda guardado.
      </p>
      <div className="mt-3 flex flex-wrap gap-2.5">
        {temaId != null && (
          <button onClick={() => router.push(`/flashcards/tema/${temaId}`)} className="btn-primary !py-1.5 !text-xs">
            <RotateCcw className="h-3.5 w-3.5" /> Repasar el tema
          </button>
        )}
        <button onClick={() => router.push('/dashboard')} className="btn-ghost !py-1.5 !text-xs">
          Tomar una pausa
        </button>
        <button onClick={onSeguir} className="btn-ghost !py-1.5 !text-xs">
          Seguir intentando
        </button>
      </div>
    </div>
  );
}
