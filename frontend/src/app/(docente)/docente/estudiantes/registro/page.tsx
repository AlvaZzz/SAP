'use client';

/**
 * REGISTRO DE ESTUDIANTES — asistente de 4 pasos para el docente.
 *
 *   1. Materia y paralelo   →  2. Cargar la lista   →  3. Revisar columnas
 *   →  4. Vista previa y organización  →  resultado con el reporte de acceso.
 *
 * Toda la lectura del archivo, el reconocimiento de columnas y la validación
 * viven en el backend; esta pantalla solo muestra y deja corregir.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Badge, Card, PageHeader, Skeleton } from '@/components/ui';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle, Download, FileText, Plus, Search, Sparkles, Trash2, Upload, Users,
} from '@/components/icons';

interface ParaleloInfo { id: number; nombre: string; docente: { id: number; nombre: string } | null; es_mio: boolean; estudiantes: number }
interface Materia { id: number; nombre: string; sigla: string | null; gestion: string; paralelos: ParaleloInfo[] }

type Campo = 'apellidoPaterno' | 'apellidoMaterno' | 'nombres' | 'nombreCompleto' | 'ci' | 'ru' | 'paralelo';
type Mapeo = Record<Campo, number | null>;
interface Analisis {
  archivo: string; hoja: string; fila_encabezado: number; encabezados: string[];
  campos: { clave: Campo; etiqueta: string }[]; mapeo: Mapeo; faltantes: string[];
  uso_ia: boolean; total_filas: number; filas: string[][];
}

type Estado = 'nuevo' | 'existe' | 'error';
interface Fila {
  fila: number; apellidoPaterno: string; apellidoMaterno: string; nombres: string; ci: string; ru: string; paralelo: string;
  nombreCompleto?: string; estado?: Estado; errores?: string[]; camposConError?: string[];
}
interface Resumen { total: number; nuevos: number; existentes: number; con_error: number; por_paralelo: { paralelo: string; n: number }[] }
interface Preview { filas: Fila[]; resumen: Resumen; paralelos_nuevos: string[] }
interface Resultado {
  registrados: number; actualizados: number; omitidos: number; acceso: string;
  reporte: { nombre: string; ru: string; paralelo: string; resultado: string; usuario: string; contrasena_inicial: string }[];
}

const PASOS = ['Materia y paralelo', 'Cargar la lista', 'Revisar columnas', 'Vista previa'];
const gestionSugerida = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() < 6 ? 'I' : 'II'}`; };
const soloDatos = (f: Fila): Fila => ({
  fila: f.fila, apellidoPaterno: f.apellidoPaterno, apellidoMaterno: f.apellidoMaterno, nombres: f.nombres, ci: f.ci, ru: f.ru, paralelo: f.paralelo,
});
const mensaje = (e: unknown, porDefecto: string) => (e instanceof ApiError ? e.message : porDefecto);

export default function RegistroEstudiantesPage() {
  const [paso, setPaso] = useState(0);
  const [materias, setMaterias] = useState<Materia[] | null>(null);
  const [materiaId, setMateriaId] = useState<number | null>(null);
  const [soyDocente, setSoyDocente] = useState(true);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [mapeo, setMapeo] = useState<Mapeo | null>(null);
  const [paraleloDefecto, setParaleloDefecto] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const cargarMaterias = useCallback(async () => {
    try {
      const r = await api.get<{ materias: Materia[] }>('/docente/registro/materias');
      setMaterias(r.materias);
      setMateriaId((actual) => actual ?? r.materias[0]?.id ?? null);
    } catch { setMaterias([]); }
  }, []);
  useEffect(() => { cargarMaterias(); }, [cargarMaterias]);

  const materia = materias?.find((m) => m.id === materiaId) ?? null;

  async function subir(archivo: File) {
    setOcupado(true); setError('');
    try {
      const fd = new FormData();
      fd.append('archivo', archivo);
      const a = await api.upload<Analisis>('/docente/registro/analizar', fd);
      setAnalisis(a); setMapeo(a.mapeo); setPaso(2);
    } catch (e) { setError(mensaje(e, 'No se pudo leer el archivo.')); }
    finally { setOcupado(false); }
  }

  async function convertir() {
    if (!analisis || !mapeo || !materiaId) return;
    setOcupado(true); setError('');
    try {
      const p = await api.post<Preview>('/docente/registro/convertir', {
        materiaId, filas: analisis.filas, filaEncabezado: analisis.fila_encabezado, mapeo,
        paraleloPorDefecto: paraleloDefecto || undefined,
      });
      setPreview(p); setPaso(3);
    } catch (e) { setError(mensaje(e, 'No se pudo armar la vista previa.')); }
    finally { setOcupado(false); }
  }

  function empezarAMano() {
    setAnalisis(null);
    setPreview({
      filas: [{ fila: 1, apellidoPaterno: '', apellidoMaterno: '', nombres: '', ci: '', ru: '', paralelo: materia?.paralelos[0]?.nombre ?? '' }],
      resumen: { total: 1, nuevos: 0, existentes: 0, con_error: 0, por_paralelo: [] }, paralelos_nuevos: [],
    });
    setError(''); setPaso(3);
  }

  function reiniciar() {
    setPaso(0); setAnalisis(null); setMapeo(null); setPreview(null); setResultado(null); setError(''); setParaleloDefecto('');
    cargarMaterias();
  }

  if (resultado) return <PasoResultado r={resultado} materia={materia} onOtra={reiniciar} />;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Registro de estudiantes"
        subtitle="Crea las cuentas de tu curso desde la lista que ya tienes. Cada estudiante entrará con su RU y su CI."
        action={<Link href="/docente/estudiantes" className="btn-ghost"><Users className="h-4 w-4" /> Ver estudiantes</Link>}
      />

      {/* Indicador de pasos */}
      <ol className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PASOS.map((nombre, i) => (
          <li key={nombre} aria-current={i === paso ? 'step' : undefined}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${i === paso ? 'border-prexi-blue bg-prexi-blue/10 font-semibold text-fg' : i < paso ? 'border-line bg-card text-fg' : 'border-line bg-card text-muted'}`}>
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${i < paso ? 'bg-prexi-green text-white' : i === paso ? 'bg-prexi-blue text-accent-on' : 'bg-subtle text-muted'}`}>
              {i < paso ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="min-w-0 truncate">{nombre}</span>
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-prexi-red">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {paso === 0 && (
        <PasoMateria
          materias={materias} materiaId={materiaId} setMateriaId={setMateriaId}
          soyDocente={soyDocente} setSoyDocente={setSoyDocente}
          recargar={cargarMaterias} setError={setError}
          onSiguiente={() => { setError(''); setPaso(1); }}
        />
      )}

      {paso === 1 && materia && (
        <PasoCargar materia={materia} ocupado={ocupado} onArchivo={subir} onManual={empezarAMano} onAtras={() => setPaso(0)} />
      )}

      {paso === 2 && analisis && mapeo && materia && (
        <PasoColumnas
          analisis={analisis} mapeo={mapeo} setMapeo={setMapeo} materia={materia}
          paraleloDefecto={paraleloDefecto} setParaleloDefecto={setParaleloDefecto}
          ocupado={ocupado} onAtras={() => setPaso(1)} onSiguiente={convertir}
        />
      )}

      {paso === 3 && preview && materia && (
        <PasoPreview
          materia={materia} inicial={preview} soyDocente={soyDocente}
          onAtras={() => setPaso(analisis ? 2 : 1)} onListo={setResultado} setError={setError}
        />
      )}
    </div>
  );
}

/* ════════════════════════ Paso 1 · Materia y paralelo ════════════════════════ */

function PasoMateria({ materias, materiaId, setMateriaId, soyDocente, setSoyDocente, recargar, setError, onSiguiente }: {
  materias: Materia[] | null; materiaId: number | null; setMateriaId: (id: number) => void;
  soyDocente: boolean; setSoyDocente: (v: boolean) => void;
  recargar: () => Promise<void>; setError: (e: string) => void; onSiguiente: () => void;
}) {
  const [nueva, setNueva] = useState({ nombre: 'Programación I', sigla: 'PRG-111', gestion: gestionSugerida() });
  const [creando, setCreando] = useState(false);
  const [paralelo, setParalelo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  if (materias === null) return <Skeleton className="h-56" />;
  const materia = materias.find((m) => m.id === materiaId) ?? null;
  const mostrarFormulario = creando || materias.length === 0;

  async function crearMateria() {
    setOcupado(true); setError('');
    try {
      const m = await api.post<{ id: number }>('/docente/registro/materias', nueva);
      await recargar(); setMateriaId(m.id); setCreando(false);
    } catch (e) { setError(mensaje(e, 'No se pudo crear la materia.')); }
    finally { setOcupado(false); }
  }

  async function crearParalelo() {
    if (!materia || !paralelo.trim()) return;
    setOcupado(true); setError('');
    try {
      await api.post('/docente/registro/paralelos', { materiaId: materia.id, nombre: paralelo, soyDocente });
      setParalelo(''); await recargar();
    } catch (e) { setError(mensaje(e, 'No se pudo crear el paralelo.')); }
    finally { setOcupado(false); }
  }

  async function asignarme(p: ParaleloInfo, asignar: boolean) {
    setOcupado(true); setError('');
    try { await api.patch(`/docente/registro/paralelos/${p.id}/docente`, { asignar }); await recargar(); }
    catch (e) { setError(mensaje(e, 'No se pudo actualizar el paralelo.')); }
    finally { setOcupado(false); }
  }

  return (
    <Card>
      <h2 className="font-display text-xl font-bold text-fg">¿En qué materia vas a registrar estudiantes?</h2>
      <p className="mb-4 mt-1 text-sm text-muted">La materia agrupa tus paralelos. Solo se crea una vez por gestión.</p>

      {!mostrarFormulario && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[240px] flex-1">
            <span className="mb-1.5 block text-sm font-medium text-fg">Materia</span>
            <select className="input" value={materiaId ?? ''} onChange={(e) => setMateriaId(Number(e.target.value))}>
              {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}{m.sigla ? ` (${m.sigla})` : ''} · {m.gestion}</option>)}
            </select>
          </label>
          <button onClick={() => setCreando(true)} className="btn-ghost"><Plus className="h-4 w-4" /> Otra materia</button>
        </div>
      )}

      {mostrarFormulario && (
        <div className="mb-4 rounded-2xl border border-line p-4">
          <p className="mb-3 text-sm font-semibold text-fg">{materias.length === 0 ? 'Crea tu primera materia' : 'Nueva materia'}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label><span className="mb-1.5 block text-sm font-medium text-fg">Nombre</span>
              <input className="input" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} placeholder="Programación I" /></label>
            <label><span className="mb-1.5 block text-sm font-medium text-fg">Sigla (opcional)</span>
              <input className="input" value={nueva.sigla} onChange={(e) => setNueva({ ...nueva, sigla: e.target.value })} placeholder="PRG-111" /></label>
            <label><span className="mb-1.5 block text-sm font-medium text-fg">Gestión</span>
              <input className="input" value={nueva.gestion} onChange={(e) => setNueva({ ...nueva, gestion: e.target.value })} placeholder="2026-II" /></label>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={crearMateria} disabled={ocupado || nueva.nombre.trim().length < 2 || nueva.gestion.trim().length < 2} className="btn-primary disabled:opacity-50">Crear materia</button>
            {materias.length > 0 && <button onClick={() => setCreando(false)} className="btn-ghost">Cancelar</button>}
          </div>
        </div>
      )}

      {materia && !mostrarFormulario && (
        <>
          <h3 className="mb-1 mt-6 font-display text-lg font-bold text-fg">Paralelos de {materia.nombre}</h3>
          <p className="mb-3 text-sm text-muted">
            Si tu lista ya trae una columna de paralelo, no hace falta crearlos aquí: se crean solos al registrar.
          </p>

          {materia.paralelos.length === 0 ? (
            <p className="mb-3 rounded-xl bg-subtle px-4 py-3 text-sm text-muted">Esta materia todavía no tiene paralelos.</p>
          ) : (
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {materia.paralelos.map((p) => (
                <div key={p.id} className="rounded-2xl border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-lg font-bold text-fg">Paralelo {p.nombre}</p>
                    <Badge tone="blue">{p.estudiantes} est.</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">
                    {p.es_mio ? 'Tú eres el docente' : p.docente ? `Docente: ${p.docente.nombre}` : 'Sin docente asignado'}
                  </p>
                  {p.es_mio
                    ? <button onClick={() => asignarme(p, false)} disabled={ocupado} className="mt-2 text-xs font-semibold text-muted hover:text-prexi-red">Dejar este paralelo</button>
                    : !p.docente && <button onClick={() => asignarme(p, true)} disabled={ocupado} className="mt-2 text-xs font-semibold text-prexi-blue-deep hover:underline">Soy el docente de este paralelo</button>}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label>
              <span className="mb-1.5 block text-sm font-medium text-fg">Agregar paralelo</span>
              <input className="input w-40" value={paralelo} onChange={(e) => setParalelo(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') crearParalelo(); }} placeholder="A" maxLength={10} />
            </label>
            <button onClick={crearParalelo} disabled={ocupado || !paralelo.trim()} className="btn-ghost disabled:opacity-50"><Plus className="h-4 w-4" /> Agregar</button>
          </div>

          <label className="mt-5 flex cursor-pointer select-none items-start gap-2.5 rounded-2xl border border-line p-3 text-sm">
            <input type="checkbox" checked={soyDocente} onChange={(e) => setSoyDocente(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-prexi-blue" />
            <span>
              <b className="text-fg">Soy el docente de los paralelos que registre</b>
              <span className="block text-muted">Tus estudiantes verán tu nombre como su docente, y solo tú les harás seguimiento.</span>
            </span>
          </label>

          <div className="mt-6 flex justify-end">
            <button onClick={onSiguiente} className="btn-primary">Continuar <ArrowRight className="h-4 w-4" /></button>
          </div>
        </>
      )}
    </Card>
  );
}

/* ════════════════════════ Paso 2 · Cargar la lista ════════════════════════ */

function PasoCargar({ materia, ocupado, onArchivo, onManual, onAtras }: {
  materia: Materia; ocupado: boolean; onArchivo: (f: File) => void; onManual: () => void; onAtras: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  return (
    <Card>
      <h2 className="font-display text-xl font-bold text-fg">Sube la lista de {materia.nombre}</h2>
      <p className="mb-5 mt-1 text-sm text-muted">
        Sirve cualquier Excel o CSV que ya tengas, con las columnas en cualquier orden. PREXI reconoce cuál es cuál.
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => { e.preventDefault(); setEncima(false); const f = e.dataTransfer.files?.[0]; if (f) onArchivo(f); }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${encima ? 'border-prexi-blue bg-prexi-blue/10' : 'border-line bg-subtle/50'}`}
      >
        <Upload className="mx-auto h-9 w-9 text-prexi-blue-deep" />
        <p className="mt-3 font-display text-lg font-bold text-fg">{ocupado ? 'Leyendo tu archivo…' : 'Arrastra aquí tu archivo'}</p>
        <p className="text-sm text-muted">Excel (.xlsx) o CSV · hasta 1000 estudiantes</p>
        <input ref={input} type="file" accept=".xlsx,.csv,.txt" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onArchivo(f); e.target.value = ''; }} />
        <button onClick={() => input.current?.click()} disabled={ocupado} className="btn-primary mt-4 disabled:opacity-50">
          <FileText className="h-4 w-4" /> Elegir archivo
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <a href="/api/docente/registro/plantilla.xlsx" className="flex items-start gap-3 rounded-2xl border border-line p-4 transition hover:bg-subtle">
          <Download className="mt-0.5 h-5 w-5 shrink-0 text-prexi-blue-deep" />
          <span>
            <span className="block font-semibold text-fg">¿No tienes una lista? Descarga la plantilla</span>
            <span className="block text-sm text-muted">Excel con las columnas AP. PATERNO, AP. MATERNO, NOMBRES, CI, RU y PARALELO.</span>
          </span>
        </a>
        <button onClick={onManual} className="flex items-start gap-3 rounded-2xl border border-line p-4 text-left transition hover:bg-subtle">
          <Plus className="mt-0.5 h-5 w-5 shrink-0 text-prexi-blue-deep" />
          <span>
            <span className="block font-semibold text-fg">Registrar a mano</span>
            <span className="block text-sm text-muted">Para agregar uno o pocos estudiantes escribiendo sus datos.</span>
          </span>
        </button>
      </div>

      <div className="mt-6"><button onClick={onAtras} className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Atrás</button></div>
    </Card>
  );
}

/* ════════════════════════ Paso 3 · Revisar columnas ════════════════════════ */

function PasoColumnas({ analisis, mapeo, setMapeo, materia, paraleloDefecto, setParaleloDefecto, ocupado, onAtras, onSiguiente }: {
  analisis: Analisis; mapeo: Mapeo; setMapeo: (m: Mapeo) => void; materia: Materia;
  paraleloDefecto: string; setParaleloDefecto: (p: string) => void;
  ocupado: boolean; onAtras: () => void; onSiguiente: () => void;
}) {
  const muestra = analisis.filas.slice(analisis.fila_encabezado + 1, analisis.fila_encabezado + 4);
  const hayNombre = mapeo.nombreCompleto !== null || (mapeo.apellidoPaterno !== null && mapeo.nombres !== null);
  const faltan = [!hayNombre && 'el nombre', mapeo.ci === null && 'el CI', mapeo.ru === null && 'el RU'].filter(Boolean) as string[];
  const faltaParalelo = mapeo.paralelo === null && !paraleloDefecto.trim();

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-fg">Revisa que las columnas estén bien reconocidas</h2>
          <p className="mt-1 text-sm text-muted">
            Archivo <b className="text-fg">{analisis.archivo}</b> · {analisis.total_filas} filas. Corrige con los selectores lo que no coincida.
          </p>
        </div>
        {analisis.uso_ia && <Badge tone="blue"><Sparkles className="h-3 w-3" /> PREXI ayudó a reconocerlas</Badge>}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {analisis.campos.map((c) => {
          const idx = mapeo[c.clave];
          const obligatorio = c.clave === 'ci' || c.clave === 'ru';
          return (
            <label key={c.clave} className="rounded-2xl border border-line p-3">
              <span className="mb-1.5 flex items-center justify-between gap-2 text-sm font-medium text-fg">
                {c.etiqueta}
                {idx !== null ? <CheckCircle className="h-4 w-4 text-prexi-green" /> : obligatorio ? <AlertTriangle className="h-4 w-4 text-prexi-amber" /> : null}
              </span>
              <select className="input text-sm" value={idx ?? ''} onChange={(e) => setMapeo({ ...mapeo, [c.clave]: e.target.value === '' ? null : Number(e.target.value) })}>
                <option value="">— No está en mi archivo —</option>
                {analisis.encabezados.map((h, i) => <option key={i} value={i}>{h}</option>)}
              </select>
              <span className="mt-1.5 block truncate text-xs text-muted">
                {idx !== null ? `Ej.: ${muestra.map((f) => f[idx]).filter(Boolean).slice(0, 2).join(' · ') || '(vacío)'}` : ' '}
              </span>
            </label>
          );
        })}
      </div>

      {mapeo.nombreCompleto !== null && (
        <p className="mt-4 rounded-xl bg-subtle px-4 py-3 text-sm text-muted">
          Tu archivo trae el nombre en una sola columna. PREXI lo separa así: <b className="text-fg">paterno · materno · nombres</b>.
          Podrás corregir cualquier caso en la vista previa.
        </p>
      )}

      {mapeo.paralelo === null && (
        <label className="mt-4 block rounded-2xl border border-prexi-amber/40 bg-prexi-amber/10 p-4">
          <span className="block text-sm font-semibold text-fg">Tu archivo no tiene columna de paralelo</span>
          <span className="mb-2 block text-sm text-muted">¿A qué paralelo van todos estos estudiantes? Luego podrás mover a los que quieras.</span>
          <input className="input w-40" list="paralelos-existentes" value={paraleloDefecto} maxLength={10}
            onChange={(e) => setParaleloDefecto(e.target.value.toUpperCase())} placeholder="A" />
          <datalist id="paralelos-existentes">{materia.paralelos.map((p) => <option key={p.id} value={p.nombre} />)}</datalist>
        </label>
      )}

      {faltan.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-prexi-red">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Falta indicar qué columna tiene {faltan.join(', ')}.
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-between gap-2">
        <button onClick={onAtras} className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Subir otro archivo</button>
        <button onClick={onSiguiente} disabled={ocupado || faltan.length > 0 || faltaParalelo} className="btn-primary disabled:opacity-50">
          {ocupado ? 'Preparando…' : 'Ver vista previa'} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}

/* ════════════════════════ Paso 4 · Vista previa y organización ════════════════════════ */

type Filtro = 'todos' | 'error' | 'nuevo' | 'existe';
const COLUMNAS: { clave: keyof Fila; etiqueta: string; ancho: string }[] = [
  { clave: 'apellidoPaterno', etiqueta: 'Ap. paterno', ancho: 'min-w-[130px]' },
  { clave: 'apellidoMaterno', etiqueta: 'Ap. materno', ancho: 'min-w-[130px]' },
  { clave: 'nombres', etiqueta: 'Nombres', ancho: 'min-w-[150px]' },
  { clave: 'ci', etiqueta: 'CI', ancho: 'min-w-[110px]' },
  { clave: 'ru', etiqueta: 'RU', ancho: 'min-w-[120px]' },
  { clave: 'paralelo', etiqueta: 'Paralelo', ancho: 'min-w-[90px]' },
];

function PasoPreview({ materia, inicial, soyDocente, onAtras, onListo, setError }: {
  materia: Materia; inicial: Preview; soyDocente: boolean;
  onAtras: () => void; onListo: (r: Resultado) => void; setError: (e: string) => void;
}) {
  // Cada fila lleva una clave estable propia: el índice cambia al ordenar o quitar.
  const [filas, setFilas] = useState<(Fila & { k: number })[]>(() => inicial.filas.map((f, i) => ({ ...f, k: i })));
  const [resumen, setResumen] = useState<Resumen>(inicial.resumen);
  const [nuevosParalelos, setNuevosParalelos] = useState<string[]>(inicial.paralelos_nuevos);
  const [sucio, setSucio] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [orden, setOrden] = useState<'archivo' | 'apellido' | 'paralelo'>('archivo');
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [destino, setDestino] = useState('');
  const [existentes, setExistentes] = useState<'omitir' | 'actualizar'>('omitir');
  const [ocupado, setOcupado] = useState(false);
  const siguienteK = useRef(inicial.filas.length);

  const validar = useCallback(async (lista: (Fila & { k: number })[]) => {
    if (lista.length === 0) { setResumen({ total: 0, nuevos: 0, existentes: 0, con_error: 0, por_paralelo: [] }); setSucio(false); return; }
    setOcupado(true); setError('');
    try {
      const p = await api.post<Preview>('/docente/registro/previsualizar', { materiaId: materia.id, filas: lista.map(soloDatos) });
      setFilas(p.filas.map((f, i) => ({ ...f, k: lista[i].k })));
      setResumen(p.resumen); setNuevosParalelos(p.paralelos_nuevos); setSucio(false);
    } catch (e) { setError(mensaje(e, 'No se pudo validar la lista.')); }
    finally { setOcupado(false); }
  }, [materia.id, setError]);

  // La carga manual empieza con una fila vacía sin validar.
  useEffect(() => { if (inicial.resumen.total === 1 && !inicial.filas[0].estado) setSucio(true); }, [inicial]);

  const editar = (k: number, campo: keyof Fila, valor: string) => {
    setFilas((fs) => fs.map((f) => (f.k === k ? { ...f, [campo]: campo === 'paralelo' ? valor.toUpperCase() : valor, estado: undefined } : f)));
    setSucio(true);
  };
  const agregar = () => {
    const k = siguienteK.current++;
    setFilas((fs) => [{ k, fila: 0, apellidoPaterno: '', apellidoMaterno: '', nombres: '', ci: '', ru: '', paralelo: destino || fs[0]?.paralelo || '' }, ...fs]);
    setSucio(true); setFiltro('todos'); setOrden('archivo');
  };
  const quitar = (ks: Set<number>) => { const r = filas.filter((f) => !ks.has(f.k)); setMarcadas(new Set()); validar(r); setFilas(r); };
  const mover = () => {
    if (!destino.trim() || marcadas.size === 0) return;
    const r = filas.map((f) => (marcadas.has(f.k) ? { ...f, paralelo: destino.trim().toUpperCase() } : f));
    setMarcadas(new Set()); setFilas(r); validar(r);
  };

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let v = filas.filter((f) => (filtro === 'todos' ? true : f.estado === filtro));
    if (q) v = v.filter((f) => `${f.apellidoPaterno} ${f.apellidoMaterno} ${f.nombres} ${f.ci} ${f.ru}`.toLowerCase().includes(q));
    if (orden === 'apellido') v = [...v].sort((a, b) => `${a.apellidoPaterno} ${a.apellidoMaterno} ${a.nombres}`.localeCompare(`${b.apellidoPaterno} ${b.apellidoMaterno} ${b.nombres}`, 'es'));
    if (orden === 'paralelo') v = [...v].sort((a, b) => a.paralelo.localeCompare(b.paralelo) || a.apellidoPaterno.localeCompare(b.apellidoPaterno, 'es'));
    return v;
  }, [filas, filtro, busca, orden]);

  const todasMarcadas = visibles.length > 0 && visibles.every((f) => marcadas.has(f.k));
  const alternarTodas = () => setMarcadas(todasMarcadas ? new Set() : new Set(visibles.map((f) => f.k)));
  const alternar = (k: number) => setMarcadas((m) => { const n = new Set(m); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const aRegistrar = resumen.nuevos + (existentes === 'actualizar' ? resumen.existentes : 0);
  const puedeRegistrar = !sucio && !ocupado && resumen.con_error === 0 && resumen.total > 0 && aRegistrar > 0;

  async function registrar() {
    if (!puedeRegistrar) return;
    const detalle = `${resumen.nuevos} estudiante(s) nuevo(s)` + (resumen.existentes ? ` y ${existentes === 'actualizar' ? 'actualizar' : 'omitir'} ${resumen.existentes} que ya existen` : '');
    if (!confirm(`Vas a registrar ${detalle} en ${materia.nombre} (${materia.gestion}).\n\nCada estudiante entrará con su RU y su CI como contraseña inicial. ¿Continuar?`)) return;
    setOcupado(true); setError('');
    try {
      onListo(await api.post<Resultado>('/docente/registro/registrar', { materiaId: materia.id, filas: filas.map(soloDatos), existentes, soyDocente }));
    } catch (e) { setError(mensaje(e, 'No se pudo registrar a los estudiantes.')); setOcupado(false); }
  }

  const paralelosConocidos = [...new Set([...materia.paralelos.map((p) => p.nombre), ...resumen.por_paralelo.map((p) => p.paralelo)])].sort();

  return (
    <div>
      {/* Resumen */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-display text-xl font-bold text-fg">Revisa antes de registrar</h2>
          <Badge tone="green">{resumen.nuevos} nuevos</Badge>
          {resumen.con_error > 0 && <Badge tone="red">{resumen.con_error} con error</Badge>}
          {resumen.existentes > 0 && <Badge tone="amber">{resumen.existentes} ya existen</Badge>}
          {sucio && <Badge tone="slate">cambios sin validar</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted">
          {materia.nombre} · {materia.gestion}. Puedes corregir cualquier dato escribiendo sobre la tabla.
        </p>
        {resumen.por_paralelo.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {resumen.por_paralelo.map((p) => (
              <span key={p.paralelo} className="rounded-xl bg-subtle px-3 py-1.5 text-sm text-fg">
                Paralelo <b>{p.paralelo}</b>: {p.n}{nuevosParalelos.includes(p.paralelo) && <span className="ml-1 text-xs text-prexi-blue-deep">(se creará)</span>}
              </span>
            ))}
          </div>
        )}
        {resumen.existentes > 0 && (
          <div className="mt-4 rounded-2xl border border-line p-3 text-sm">
            <p className="mb-2 font-semibold text-fg">{resumen.existentes} estudiante(s) ya tienen cuenta (mismo RU). ¿Qué hago con ellos?</p>
            <label className="mr-5 inline-flex cursor-pointer items-center gap-2 text-fg">
              <input type="radio" name="existentes" checked={existentes === 'omitir'} onChange={() => setExistentes('omitir')} className="accent-prexi-blue" /> Dejarlos como están
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-fg">
              <input type="radio" name="existentes" checked={existentes === 'actualizar'} onChange={() => setExistentes('actualizar')} className="accent-prexi-blue" /> Actualizar su nombre y paralelo
            </label>
            <p className="mt-1 text-xs text-muted">En ningún caso se toca su contraseña ni su avance.</p>
          </div>
        )}
      </Card>

      {/* Herramientas */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input !py-2 pl-9 text-sm" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nombre, CI o RU" />
        </div>
        <select className="input !w-auto !py-2 text-sm" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} aria-label="Filtrar">
          <option value="todos">Todos ({resumen.total})</option>
          <option value="error">Con error ({resumen.con_error})</option>
          <option value="nuevo">Nuevos ({resumen.nuevos})</option>
          <option value="existe">Ya existen ({resumen.existentes})</option>
        </select>
        <select className="input !w-auto !py-2 text-sm" value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)} aria-label="Ordenar">
          <option value="archivo">Orden del archivo</option>
          <option value="apellido">Por apellido</option>
          <option value="paralelo">Por paralelo</option>
        </select>
        <button onClick={agregar} className="btn-ghost !py-2 text-sm"><Plus className="h-4 w-4" /> Agregar estudiante</button>
      </div>

      {/* Acción masiva */}
      {marcadas.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-prexi-blue/40 bg-prexi-blue/10 px-4 py-2.5 text-sm">
          <b className="text-fg">{marcadas.size} seleccionado(s)</b>
          <span className="text-muted">→ mover al paralelo</span>
          <input className="input !w-24 !py-1.5 text-sm" list="destinos" value={destino} maxLength={10} onChange={(e) => setDestino(e.target.value.toUpperCase())} placeholder="B" />
          <datalist id="destinos">{paralelosConocidos.map((p) => <option key={p} value={p} />)}</datalist>
          <button onClick={mover} disabled={!destino.trim() || ocupado} className="btn-primary !px-3 !py-1.5 text-sm disabled:opacity-50">Mover</button>
          <button onClick={() => quitar(marcadas)} disabled={ocupado} className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-prexi-red hover:underline">
            <Trash2 className="h-4 w-4" /> Quitar de la lista
          </button>
        </div>
      )}

      {/* Tabla editable */}
      <Card className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="w-10 px-3 py-3"><input type="checkbox" checked={todasMarcadas} onChange={alternarTodas} aria-label="Seleccionar todos" className="h-4 w-4 accent-prexi-blue" /></th>
                {COLUMNAS.map((c) => <th key={c.clave} className={`px-2 py-3 ${c.ancho}`}>{c.etiqueta}</th>)}
                <th className="min-w-[200px] px-3 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">No hay estudiantes que coincidan con el filtro.</td></tr>
              )}
              {visibles.map((f) => (
                <tr key={f.k} className={`border-b border-line last:border-0 ${f.estado === 'error' ? 'bg-red-500/5' : ''}`}>
                  <td className="px-3 py-1.5"><input type="checkbox" checked={marcadas.has(f.k)} onChange={() => alternar(f.k)} aria-label={`Seleccionar ${f.apellidoPaterno} ${f.nombres}`} className="h-4 w-4 accent-prexi-blue" /></td>
                  {COLUMNAS.map((c) => {
                    const conError = f.camposConError?.includes(c.clave as string);
                    return (
                      <td key={c.clave} className="px-1 py-1.5">
                        <input
                          value={String(f[c.clave] ?? '')}
                          onChange={(e) => editar(f.k, c.clave, e.target.value)}
                          aria-label={c.etiqueta} aria-invalid={conError || undefined}
                          className={`w-full rounded-lg border bg-transparent px-2 py-1.5 text-fg outline-none transition focus:border-prexi-blue focus:bg-card ${conError ? 'border-prexi-red bg-red-500/10' : 'border-transparent hover:border-line'}`}
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5">
                    {f.estado === 'nuevo' && <Badge tone="green">Nuevo</Badge>}
                    {f.estado === 'existe' && <Badge tone="amber">Ya existe</Badge>}
                    {f.estado === 'error' && <span className="text-xs font-medium text-prexi-red">{f.errores?.join(' ')}</span>}
                    {!f.estado && <span className="text-xs text-muted">Sin validar</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Acciones */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button onClick={onAtras} className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Atrás</button>
        <div className="flex flex-wrap items-center gap-3">
          {!sucio && resumen.con_error > 0 && <span className="text-sm text-prexi-red">Corrige las {resumen.con_error} fila(s) en rojo para continuar.</span>}
          {sucio
            ? <button onClick={() => validar(filas)} disabled={ocupado} className="btn-primary disabled:opacity-50">{ocupado ? 'Validando…' : 'Validar cambios'}</button>
            : <button onClick={registrar} disabled={!puedeRegistrar} className="btn-primary disabled:opacity-50"><CheckCircle className="h-4 w-4" /> {ocupado ? 'Registrando…' : `Registrar ${aRegistrar} estudiante(s)`}</button>}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════ Resultado ════════════════════════ */

function PasoResultado({ r, materia, onOtra }: { r: Resultado; materia: Materia | null; onOtra: () => void }) {
  function descargar() {
    const esc = (s: string) => (/[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lineas = [
      ['Nombre', 'Paralelo', 'Usuario (RU)', 'Contraseña inicial', 'Resultado'].join(','),
      ...r.reporte.map((f) => [f.nombre, f.paralelo, f.usuario, f.contrasena_inicial, f.resultado].map(esc).join(',')),
    ];
    // BOM para que Excel abra los acentos correctamente.
    const blob = new Blob([String.fromCharCode(0xfeff) + lineas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `prexi_estudiantes_registrados${materia ? `_${materia.gestion}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="animate-fade-up">
      <Card className="mx-auto max-w-3xl">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-prexi-green/15 text-prexi-green"><CheckCircle className="h-8 w-8" /></div>
          <div>
            <h1 className="font-display text-2xl font-extrabold text-fg">¡Listo! {r.registrados} estudiante(s) registrado(s)</h1>
            <p className="mt-1 text-sm text-muted">
              {r.actualizados > 0 && `${r.actualizados} actualizado(s). `}{r.omitidos > 0 && `${r.omitidos} ya existían y se dejaron como estaban. `}
              {materia && `${materia.nombre} · ${materia.gestion}.`}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-prexi-blue/30 bg-prexi-blue/10 p-4 text-sm">
          <p className="font-semibold text-fg">Cómo entran tus estudiantes</p>
          <p className="mt-1 text-muted">
            Usuario: su <b className="text-fg">RU</b> · Contraseña inicial: su <b className="text-fg">CI</b>. La primera vez el sistema les pide crear su propia contraseña.
          </p>
        </div>

        <div className="mt-5 max-h-80 overflow-auto rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2.5">Estudiante</th><th className="px-3 py-2.5">Paralelo</th><th className="px-3 py-2.5">Usuario (RU)</th><th className="px-3 py-2.5">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {r.reporte.map((f) => (
                <tr key={f.ru} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-medium text-fg">{f.nombre}</td>
                  <td className="px-3 py-2 text-muted">{f.paralelo}</td>
                  <td className="px-3 py-2 font-mono text-muted">{f.usuario}</td>
                  <td className="px-3 py-2"><Badge tone={f.resultado === 'Registrado' ? 'green' : f.resultado === 'Actualizado' ? 'blue' : 'slate'}>{f.resultado}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={descargar} className="btn-primary"><Download className="h-4 w-4" /> Descargar reporte</button>
          <Link href="/docente/estudiantes" className="btn-ghost"><Users className="h-4 w-4" /> Ver mis estudiantes</Link>
          <button onClick={onOtra} className="btn-ghost"><Plus className="h-4 w-4" /> Registrar otra lista</button>
        </div>
      </Card>
    </div>
  );
}
