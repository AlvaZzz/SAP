'use client';

import { IconoFlashcard } from '@/components/flashcards/boton-flashcards';
import { useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { Markdown } from '@/components/markdown';
import { CodeBlock } from '@/components/code-block';
import { FlowDiagram } from '@/components/flow-diagram';
import { BotonVoz } from '@/components/boton-voz';
import { colorUnidad } from '@/lib/types';
import {
  Target, Layers, Lightbulb, Code, ArrowRight, ChevronLeft, ChevronDown, BookOpen,
  Sparkles, Zap, Lock, BarChart3, Play, Bot, Search, Users, RotateCcw, GraduationCap, Bell, FileText, Star,
} from '@/components/icons';

/* ── Gancho de APLICACIÓN REAL por unidad (breve y con sustancia: 3 ejemplos
     concretos de "¿para qué me sirve esto?"; da paso rápido a la teoría). ── */
type App = { icon: ComponentType<{ className?: string }>; titulo: string; desc: string };
const APLICACIONES: Record<number, App[]> = {
  1: [
    { icon: Bot, titulo: 'Un cajero automático', desc: 'Sigue un algoritmo paso a paso: pide tu PIN, lo valida y entrega el dinero.' },
    { icon: Zap, titulo: 'Tu billetera móvil', desc: 'Convierte el texto "15" en número para poder sumar tu saldo (tipos de datos).' },
    { icon: Search, titulo: 'Un formulario web', desc: 'Usa operadores para validar que tu correo y tu edad tengan sentido.' },
  ],
  2: [
    { icon: Lock, titulo: 'El login de una app', desc: 'Con condicionales decide si tu contraseña es correcta… o no.' },
    { icon: BarChart3, titulo: 'Notas de todo un curso', desc: 'Con bucles, un sistema procesa las notas de decenas de estudiantes en segundos.' },
    { icon: Play, titulo: 'Un videojuego', desc: 'Repite turnos con while hasta que alguien gana la partida.' },
  ],
  3: [
    { icon: Users, titulo: 'WhatsApp', desc: 'Reutiliza la función "enviar mensaje" millones de veces al día: eso es modularidad.' },
    { icon: Target, titulo: 'Una calculadora', desc: 'Separa sumar, restar y multiplicar en funciones pequeñas y ordenadas.' },
    { icon: RotateCcw, titulo: 'El GPS', desc: 'Recalcula la ruta una y otra vez sobre el mismo problema: recursividad.' },
  ],
  4: [
    { icon: Play, titulo: 'Tu playlist', desc: 'Spotify guarda tus canciones en una LISTA que recorre una por una.' },
    { icon: GraduationCap, titulo: 'Las notas del curso', desc: 'Viven en una MATRIZ: cada fila un estudiante, cada columna una nota.' },
    { icon: Search, titulo: 'Un buscador', desc: 'Recorre CADENAS de texto para encontrar justo lo que escribiste.' },
  ],
  5: [
    { icon: Bell, titulo: 'Cada clic que haces', desc: 'Dispara un EVENTO que tu código escucha y responde al instante.' },
    { icon: FileText, titulo: 'Un formulario de registro', desc: 'Es una ventana con campos y botones: interfaz gráfica pura.' },
    { icon: Star, titulo: 'Una app de notas', desc: 'Es una interfaz (tkinter) sobre tus datos: ventana, etiquetas y botones.' },
  ],
};
const APLICACIONES_DEFAULT: App[] = [
  { icon: Zap, titulo: 'Apps que usas a diario', desc: 'Aplican exactamente lo que vas a aprender en esta unidad.' },
  { icon: Target, titulo: 'Problemas reales', desc: 'Vas a resolverlos paso a paso con código Python.' },
  { icon: Users, titulo: 'Trabajo profesional', desc: 'Estas habilidades son la base del desarrollo de software.' },
];
/** Habilidades en lenguaje motivador y concreto (no lista fría de objetivos). */
const LEAD: Record<number, string> = {
  1: 'vas a entender cómo "piensa" una computadora: algoritmos, datos y operaciones — la base de todo lo demás.',
  2: 'vas a lograr que tus programas DECIDAN y REPITAN: condicionales y bucles, el corazón de cualquier app.',
  3: 'vas a partir problemas grandes en funciones pequeñas y reutilizables, como lo hacen los equipos profesionales.',
  4: 'vas a manejar muchos datos a la vez con listas y matrices: playlists, notas de curso, tableros.',
  5: 'vas a construir ventanas y botones reales con Python (tkinter): programas que la gente puede tocar.',
};
const LEAD_DEFAULT = 'vas a sumar habilidades concretas de programación que usarás en todo el curso.';

type Nivel = 'basico' | 'intermedio' | 'avanzado';
interface NodoMapa { id: number; tipo: 'tema' | 'subtema'; numero: string; titulo: string; nivel: Nivel; nivel_label: string }
interface Ejemplo { titulo: string; codigo: string; diagrama: string; salida: string }

/** Payload de `/unidades/:id/dashboard`: material de estudio de la unidad. */
export interface TeoriaData {
  unidad: { id: number; numero: number; titulo: string };
  objetivos_md: string | null;
  analogias_md: string | null;
  ejemplos: Ejemplo[];
  minutos: number;
  progreso_pct: number;
  mapa: { nodos: NodoMapa[]; aristas: { de: number; a: number; tipo: string }[] };
}

interface Pagina { clave: string; titulo: string; icono: React.ReactNode; voz?: string; contenido: React.ReactNode }

/**
 * MATERIAL DE ESTUDIO de la unidad, navegable POR PÁGINAS (mismo patrón que la
 * introducción del diagnóstico inicial): una página lógica a la vez, Anterior /
 * Siguiente e indicador "2 de 5". Sustituye al bloque único y larguísimo que
 * antes vivía dentro de la vista de la unidad. Es OPCIONAL y on-demand: el
 * estudiante entra cuando quiere y vuelve a la unidad al salir.
 *
 * Solo se arman las páginas que TIENEN contenido real (sin relleno): una unidad
 * sin analogías simplemente no muestra esa página.
 */
export function TeoriaUnidad({ data, onSalir }: { data: TeoriaData; onSalir: () => void }) {
  const [activa, setActiva] = useState(0);

  // Objetivos: quita los marcadores [ ]/[x] para renderizar una lista limpia.
  const objetivos = data.objetivos_md?.replace(/-\s*\[[ xX]\]\s*/g, '- ') ?? '';

  const paginas = useMemo<Pagina[]>(() => {
    const p: Pagina[] = [];
    const cU = colorUnidad(data.unidad.numero);
    const apps = APLICACIONES[data.unidad.numero] ?? APLICACIONES_DEFAULT;
    const lead = LEAD[data.unidad.numero] ?? LEAD_DEFAULT;

    // 1) "¿Qué vas a lograr y para qué te sirve?" — SIEMPRE primero y lo más
    //    pulido: habilidades en tono motivador + 2–3 aplicaciones reales. Los
    //    OBJETIVOS formales bajan a un acordeón colapsable (tienen valor, pero
    //    no el protagonismo).
    p.push({
      clave: 'logros', titulo: '¿Qué vas a lograr?', icono: <Sparkles className="h-5 w-5" />,
      voz: `Al terminar esta unidad, ${lead} ¿Dónde se usa en la vida real? ${apps.map((a) => `${a.titulo}: ${a.desc}`).join(' ')}`,
      contenido: (
        <>
          <p className="text-base leading-relaxed text-fg">Al terminar esta unidad, <b>{lead}</b></p>

          <p className="mb-3 mt-6 text-2xs font-bold uppercase tracking-wide text-muted">¿Dónde se usa esto en la vida real?</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {apps.map(({ icon: Icon, titulo, desc }) => (
              <div key={titulo} className="rounded-xl border border-line bg-subtle/60 p-4" style={{ borderTop: `3px solid ${cU}` }}>
                <div className="mb-2 grid h-10 w-10 place-items-center rounded-xl" style={{ color: cU, backgroundColor: `${cU}1f` }}><Icon className="h-5 w-5" /></div>
                <p className="text-sm font-bold text-fg">{titulo}</p>
                <p className="mt-1 text-sm leading-snug text-muted">{desc}</p>
              </div>
            ))}
          </div>

          {objetivos.trim() && (
            <details className="group mt-5 rounded-xl border border-line bg-subtle/60 px-4 py-3">
              <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-semibold text-fg [&::-webkit-details-marker]:hidden">
                <Target className="h-4 w-4 text-prexi-blue-deep" /> Al final podrás… (objetivos)
                <ChevronDown className="ml-auto h-4 w-4 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="prose-teoria mt-3 border-t border-line pt-3"><Markdown content={objetivos} /></div>
            </details>
          )}

        </>
      ),
    });

    if (data.analogias_md) {
      p.push({
        clave: 'analogias', titulo: 'Analogías del mundo real', icono: <Lightbulb className="h-5 w-5" />,
        voz: data.analogias_md,
        contenido: <div className="prose-teoria"><Markdown content={data.analogias_md} /></div>,
      });
    }

    // Cada ejemplo es su PROPIA página: en móvil, código→flujo→salida de tres
    // ejemplos en una sola página sería otra vez un muro de scroll.
    data.ejemplos.forEach((e, i) => {
      p.push({
        clave: `ejemplo-${i}`,
        titulo: data.ejemplos.length > 1 ? `Ejemplo ${i + 1}: ${e.titulo}` : `Ejemplo: ${e.titulo}`,
        icono: <Code className="h-5 w-5" />,
        contenido: (
          <div className="space-y-4">
            <Bloque etiqueta="El código"><CodeBlock code={e.codigo} /></Bloque>
            <Bloque etiqueta="Lo que muestra al ejecutarse">
              <pre className="overflow-x-auto rounded-xl bg-[#04162E] p-3.5 font-mono text-sm leading-relaxed text-green-300">{e.salida}</pre>
            </Bloque>
            <details className="group rounded-xl border border-line bg-subtle/60 px-4 py-3">
              <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-semibold text-fg [&::-webkit-details-marker]:hidden">
                <Layers className="h-4 w-4 text-prexi-blue-deep" /> Ver el diagrama de flujo
                <ChevronDown className="ml-auto h-4 w-4 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3 border-t border-line pt-3"><FlowDiagram source={e.diagrama} color={colorUnidad(data.unidad.numero)} /></div>
            </details>
          </div>
        ),
      });
    });

    // Cierre: CONSOLIDACIÓN con flashcards integradas (leer → entender → fijar).
    // Las flashcards son repaso libre: no puntúan ni cambian el θ (IRT).
    p.push({
      clave: 'fijar', titulo: 'Ahora fíjalo en tu memoria', icono: <Star className="h-5 w-5" />,
      contenido: (
        <div className="py-4 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl" style={{ color: cU, backgroundColor: `${cU}1f` }}><Sparkles className="h-7 w-7" /></div>
          <h3 className="font-display text-xl font-extrabold text-fg">Leer → entender → fijar</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Ya viste la teoría. Consolida lo aprendido con unas flashcards <b className="text-fg">de tu nivel</b>.
            Es repaso libre: no puntúa ni cambia tu nivel.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Link href={`/flashcards/unidad/${data.unidad.id}?volver=/ejercicios/unidad/${data.unidad.id}`} className="btn-primary justify-center">
              <IconoFlashcard className="h-5 w-5" /> Repasar con flashcards
            </Link>
            <button onClick={onSalir} className="btn-ghost justify-center">Ir a los temas <ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      ),
    });

    return p;
  }, [data.analogias_md, data.ejemplos, data.unidad.numero, data.unidad.id, objetivos, onSalir]);

  if (!paginas.length) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-card px-4 py-20 text-center">
        <BookOpen className="mb-3 h-10 w-10 text-muted" />
        <h2 className="font-display text-lg font-bold text-fg">Aún no hay material de estudio</h2>
        <p className="mt-1 max-w-sm text-sm text-muted">Tu docente todavía no publicó la teoría de esta unidad. Puedes seguir practicando con los ejercicios.</p>
        <button onClick={onSalir} className="btn-primary mt-5"><ChevronLeft className="h-4 w-4" /> Volver a la unidad</button>
      </div>
    );
  }

  const total = paginas.length;
  const pag = paginas[Math.min(activa, total - 1)];
  const ir = (i: number) => { setActiva(i); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Saltar la teoría es SIEMPRE posible (no se fuerza en cada visita). */}
      <button onClick={onSalir} className="btn-ghost mb-4"><ChevronLeft className="h-4 w-4" /> Saltar la teoría e ir a los temas</button>

      {/* Cabecera: qué unidad es y por dónde voy. Los puntos también sirven para saltar. */}
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wide text-prexi-blue-deep">Teoría · Unidad {data.unidad.numero}</p>
        <h1 className="font-display text-xl font-extrabold text-fg sm:text-2xl">{data.unidad.titulo}</h1>
        <div className="mt-4 flex items-center gap-1.5" role="tablist" aria-label="Partes de la teoría">
          {paginas.map((p, i) => (
            <button key={p.clave} role="tab" aria-selected={i === activa} aria-label={`Parte ${i + 1}: ${p.titulo}`} title={p.titulo} onClick={() => ir(i)}
              className={`h-2 rounded-full transition-all ${i === activa ? 'w-10 bg-prexi-blue' : i < activa ? 'w-5 bg-prexi-blue/50' : 'w-5 bg-subtle hover:bg-line'}`} />
          ))}
          <span className="ml-2 text-xs font-semibold text-muted">Parte {activa + 1} de {total}</span>
        </div>
      </div>

      {/* Página activa — una sola columna, texto grande, cómodo en teléfono */}
      <article key={pag.clave} className="card animate-fade-up !p-6 sm:!p-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-prexi-blue/10 text-prexi-blue-deep">{pag.icono}</div>
          <h2 className="min-w-0 flex-1 font-display text-xl font-bold text-fg sm:text-2xl">{pag.titulo}</h2>
          {/* Escuchar la página (accesibilidad; oculto si el navegador no soporta voz) */}
          {pag.voz && <BotonVoz texto={pag.voz} variante="boton" className="shrink-0" />}
        </div>
        {pag.contenido}
      </article>

      {/* Navegación por páginas */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <button onClick={() => ir(Math.max(0, activa - 1))} disabled={activa === 0} className="btn-ghost disabled:opacity-40">
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>
        {activa === total - 1
          ? <button onClick={onSalir} className="btn-primary !px-6">Ir a practicar <ArrowRight className="h-4 w-4" /></button>
          : <button onClick={() => ir(activa + 1)} className="btn-primary !px-6">Siguiente: {paginas[activa + 1].titulo.length > 26 ? 'continuar' : paginas[activa + 1].titulo.toLowerCase()} <ArrowRight className="h-4 w-4" /></button>}
      </div>
    </div>
  );
}

function Bloque({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-muted">{etiqueta}</p>
      {children}
    </div>
  );
}
