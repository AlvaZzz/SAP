'use client';

/**
 * AGREGAR UN ESTUDIANTE (el que se inscribió tarde y no estaba en la lista).
 *
 * Antes había que recorrer el asistente de carga entero —materia, «cargar»,
 * «a mano», tabla, vista previa, registrar— para UNA persona. Aquí es un solo
 * formulario: curso, apellidos, nombres y CI. Mientras se escribe se ve el
 * usuario con el que entrará; al guardar, usuario y contraseña quedan listos
 * para copiar y dárselos.
 *
 * Usa los MISMOS endpoints que la carga por lista (previsualizar → registrar),
 * así que las reglas son idénticas: nombres solo con letras, CI de 5 a 10
 * dígitos, CI no repetido, y el paralelo debe ser del docente.
 */

import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { Field, Input, Modal, Select } from '@/components/ui';
import { CheckCircle, UserPlus, AlertTriangle } from '@/components/icons';
import { errorNombrePersona, usuarioDeAcceso } from '@/lib/usuario-acceso';

interface ParaleloMio { materiaId: number; materia: string; gestion: string; paralelo: string }
interface MateriaApi { id: number; nombre: string; gestion: string; paralelos: { id: number; nombre: string; es_mio: boolean }[] }
interface FilaPreview { estado?: 'nuevo' | 'existe' | 'error'; errores?: string[]; camposConError?: string[] }
interface Registro { reporte: { nombre: string; usuario: string; contrasena_inicial: string; paralelo: string; resultado: string }[] }

const VACIO = { curso: '', apellidoPaterno: '', apellidoMaterno: '', nombres: '', ci: '', ru: '' };
type Clave = keyof typeof VACIO;

export function AgregarEstudiante({ open, onClose, onListo }: { open: boolean; onClose: () => void; onListo?: () => void }) {
  const { usuario: yo } = useAuth();
  const esAdmin = yo?.rol === 'admin';
  const [cursos, setCursos] = useState<ParaleloMio[] | null>(null);
  const [f, setF] = useState(VACIO);
  const [tocado, setTocado] = useState<Partial<Record<Clave, boolean>>>({});
  const [errServidor, setErrServidor] = useState<{ general: string; campos: string[] }>({ general: '', campos: [] });
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<Registro['reporte'][number] | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(VACIO); setTocado({}); setErrServidor({ general: '', campos: [] }); setHecho(null); setCopiado(false);
    api.get<{ materias: MateriaApi[] }>('/docente/registro/materias').then((r) => {
      // El docente ve solo sus paralelos; el admin (que también entra aquí) ve todos.
      const lista = r.materias.flatMap((m) => m.paralelos.filter((p) => p.es_mio || esAdmin)
        .map((p) => ({ materiaId: m.id, materia: m.nombre, gestion: m.gestion, paralelo: p.nombre })));
      setCursos(lista);
      // Con un solo paralelo no hay nada que elegir.
      if (lista.length === 1) setF((x) => ({ ...x, curso: `${lista[0].materiaId}|${lista[0].paralelo}` }));
    }).catch(() => setCursos([]));
  }, [open, esAdmin]);

  const ci = f.ci.replace(/\s+/g, '');
  const errores: Record<Clave, string> = {
    curso: !f.curso ? 'Elige el paralelo.' : '',
    apellidoPaterno: errorNombrePersona(f.apellidoPaterno, 'el apellido paterno'),
    apellidoMaterno: f.apellidoMaterno.trim() ? errorNombrePersona(f.apellidoMaterno, 'el apellido materno') : '',
    nombres: errorNombrePersona(f.nombres, 'los nombres'),
    ci: !/^\d{5,10}$/.test(ci) ? 'Solo los números del CI (5 a 10 dígitos).' : '',
    ru: f.ru && !/^\d{4,12}$/.test(f.ru) ? 'El RU lleva solo números (4 a 12). Es opcional.' : '',
  };
  const valido = Object.values(errores).every((e) => !e);
  const err = (k: Clave) => (tocado[k] ? errores[k] : '');
  const usuario = useMemo(() => (/^\d{5,10}$/.test(ci) ? usuarioDeAcceso({ nombres: f.nombres, ci }) : ''), [f.nombres, ci]);
  const set = (k: Clave) => (e: { target: { value: string } }) => {
    setF((x) => ({ ...x, [k]: e.target.value }));
    setErrServidor({ general: '', campos: [] });
  };
  const toca = (k: Clave) => () => setTocado((t) => ({ ...t, [k]: true }));

  async function guardar() {
    setTocado({ curso: true, apellidoPaterno: true, apellidoMaterno: true, nombres: true, ci: true, ru: true });
    if (!valido || !cursos) return;
    const [materiaId, paralelo] = [Number(f.curso.split('|')[0]), f.curso.split('|').slice(1).join('|')];
    const filas = [{
      fila: 1, apellidoPaterno: f.apellidoPaterno.trim(), apellidoMaterno: f.apellidoMaterno.trim(),
      nombres: f.nombres.trim(), ci, ru: f.ru.trim(), paralelo,
    }];
    setEnviando(true); setErrServidor({ general: '', campos: [] });
    try {
      // 1) Las mismas reglas que la carga por lista, marcadas en el campo exacto.
      const p = await api.post<{ filas: FilaPreview[] }>('/docente/registro/previsualizar', { materiaId, filas });
      const fila = p.filas[0];
      if (fila?.estado === 'error') {
        setErrServidor({ general: (fila.errores ?? []).join(' '), campos: fila.camposConError ?? [] });
        return;
      }
      if (fila?.estado === 'existe') {
        setErrServidor({ general: 'Ya hay una cuenta de estudiante con ese CI. Búscala en Seguimiento: si está en otro paralelo, muévela desde su ficha.', campos: ['ci'] });
        return;
      }
      // 2) Registrar.
      const r = await api.post<Registro>('/docente/registro/registrar', { materiaId, filas, existentes: 'omitir', soyDocente: true });
      setHecho(r.reporte[0] ?? null);
      onListo?.();
    } catch (e) {
      setErrServidor({ general: e instanceof ApiError ? e.message : 'No se pudo registrar. Inténtalo de nuevo.', campos: [] });
    } finally { setEnviando(false); }
  }

  async function copiar() {
    if (!hecho) return;
    try {
      await navigator.clipboard.writeText(`Usuario: ${hecho.usuario}\nContraseña: ${hecho.contrasena_inicial}\nEntra en https://prexi.lat y cambia tu contraseña la primera vez.`);
      setCopiado(true);
    } catch { /* el portapapeles puede estar bloqueado: los datos siguen a la vista */ }
  }

  const marca = (k: Clave) => (errServidor.campos.includes(k === 'ci' ? 'ci' : k) ? ' !border-prexi-red' : '');

  return (
    <Modal open={open} onClose={onClose} title={hecho ? '¡Estudiante agregado!' : 'Agregar un estudiante'}
      footer={hecho ? (
        <div className="flex w-full flex-wrap justify-end gap-2">
          <button onClick={() => { setF((x) => ({ ...VACIO, curso: x.curso })); setTocado({}); setHecho(null); setCopiado(false); }} className="btn-ghost">
            <UserPlus className="h-4 w-4" /> Agregar otro
          </button>
          <button onClick={onClose} className="btn-primary">Listo</button>
        </div>
      ) : (
        <div className="flex w-full justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={guardar} disabled={enviando || cursos?.length === 0} className="btn-primary disabled:opacity-50">
            <UserPlus className="h-4 w-4" /> {enviando ? 'Registrando…' : 'Registrar estudiante'}
          </button>
        </div>
      )}>
      {hecho ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-prexi-green/40 bg-prexi-green/10 p-4">
            <CheckCircle className="h-8 w-8 shrink-0 text-prexi-green" />
            <div>
              <p className="font-semibold text-fg">{hecho.nombre}</p>
              <p className="text-sm text-muted">Quedó en el paralelo {hecho.paralelo} y ya puede entrar.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-line p-4">
            <p className="mb-2 text-sm font-semibold text-fg">Dale estos datos para entrar:</p>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <span className="text-muted">Usuario</span><b className="font-mono text-fg">{hecho.usuario}</b>
              <span className="text-muted">Contraseña</span><b className="font-mono text-fg">{hecho.contrasena_inicial}</b>
            </div>
            <p className="mt-2 text-xs text-muted">Es su CI. La primera vez que entre, el sistema le pedirá cambiarla.</p>
            <button onClick={copiar} className="btn-ghost mt-3 !py-1.5 text-sm">{copiado ? '¡Copiado!' : 'Copiar usuario y contraseña'}</button>
          </div>
        </div>
      ) : cursos === null ? (
        <p className="py-6 text-center text-sm text-muted">Cargando tus paralelos…</p>
      ) : cursos.length === 0 ? (
        <p className="rounded-xl bg-subtle p-4 text-sm text-fg">
          Todavía no tienes un paralelo a tu cargo. Créalo en <b>Registro</b> (paso «Materia y paralelo») o pide al administrador que te asigne uno.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">Para el estudiante que se inscribió tarde y no estaba en tu lista.</p>
          <Field label="Paralelo" error={err('curso')}>
            <Select value={f.curso} onChange={set('curso')} onBlur={toca('curso')} disabled={cursos.length === 1}>
              <option value="">Elige el paralelo…</option>
              {cursos.map((c) => (
                <option key={`${c.materiaId}|${c.paralelo}`} value={`${c.materiaId}|${c.paralelo}`}>
                  {c.materia} · {c.gestion} · Paralelo {c.paralelo}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Apellido paterno" error={err('apellidoPaterno')}>
              <Input value={f.apellidoPaterno} onChange={set('apellidoPaterno')} onBlur={toca('apellidoPaterno')} placeholder="Ej.: Mamani" autoFocus className={marca('apellidoPaterno')} />
            </Field>
            <Field label="Apellido materno (opcional)" error={err('apellidoMaterno')}>
              <Input value={f.apellidoMaterno} onChange={set('apellidoMaterno')} onBlur={toca('apellidoMaterno')} placeholder="Ej.: Quispe" className={marca('apellidoMaterno')} />
            </Field>
          </div>
          <Field label="Nombres" error={err('nombres')}>
            <Input value={f.nombres} onChange={set('nombres')} onBlur={toca('nombres')} placeholder="Ej.: Juan Carlos" className={marca('nombres')} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="CI" error={err('ci')} hint="Solo números. Será su contraseña inicial.">
              <Input value={f.ci} onChange={set('ci')} onBlur={toca('ci')} inputMode="numeric" placeholder="Ej.: 9876543" className={marca('ci')} />
            </Field>
            <Field label="RU (opcional)" error={err('ru')}>
              <Input value={f.ru} onChange={set('ru')} onBlur={toca('ru')} inputMode="numeric" placeholder="Ej.: 200012345" className={marca('ru')} />
            </Field>
          </div>
          {usuario && (
            <p className="rounded-xl bg-prexi-blue/10 px-4 py-2.5 text-sm text-fg">
              Entrará con el usuario <b className="font-mono">{usuario}</b> y su CI como contraseña.
            </p>
          )}
          {errServidor.general && (
            <p className="flex items-start gap-2 rounded-xl border border-prexi-red/30 bg-prexi-red/10 px-4 py-2.5 text-sm text-fg" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-prexi-red" /> {errServidor.general}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
