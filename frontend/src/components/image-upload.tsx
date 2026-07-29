'use client';

import { useRef, useState, useEffect } from 'react';
import { ImageIcon, Upload, X } from '@/components/icons';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB (coincide con el backend)
const TIPOS: Record<string, true> = { 'image/jpeg': true, 'image/png': true, 'image/webp': true };

/**
 * Campo de imagen reutilizable: arrastrar/soltar o seleccionar, con VISTA PREVIA
 * y validación en tiempo real (formato JPG/PNG/WebP y tamaño ≤2 MB). No sube
 * nada por sí mismo: informa al padre el `File` elegido (o `null` al quitar) y si
 * la selección es válida; el padre decide cuándo persistir.
 *
 * `valorActual` = URL de la imagen ya guardada (para mostrarla al editar).
 */
export function ImageUpload({
  valorActual,
  onArchivo,
  disabled,
}: {
  valorActual?: string | null;
  onArchivo: (archivo: File | null) => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(valorActual ?? null);
  const [esArchivoNuevo, setEsArchivoNuevo] = useState(false);
  const [error, setError] = useState('');
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Si cambia la imagen guardada desde fuera (p. ej. al abrir otra unidad), sincroniza.
  useEffect(() => {
    setPreview(valorActual ?? null);
    setEsArchivoNuevo(false);
    setError('');
  }, [valorActual]);

  // Libera la URL de objeto cuando se reemplaza o se desmonta (evita fugas).
  useEffect(() => {
    return () => { if (esArchivoNuevo && preview) URL.revokeObjectURL(preview); };
  }, [esArchivoNuevo, preview]);

  function elegir(archivo: File | undefined) {
    if (!archivo) return;
    if (!TIPOS[archivo.type]) { setError('Formato no válido. Usa JPG, PNG o WebP.'); return; }
    if (archivo.size > MAX_BYTES) { setError(`La imagen pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB. El máximo es 2 MB.`); return; }
    if (esArchivoNuevo && preview) URL.revokeObjectURL(preview);
    setError('');
    setPreview(URL.createObjectURL(archivo));
    setEsArchivoNuevo(true);
    onArchivo(archivo);
  }

  function quitar() {
    if (esArchivoNuevo && preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setEsArchivoNuevo(false);
    setError('');
    onArchivo(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
        disabled={disabled}
        onChange={(e) => elegir(e.target.files?.[0])} />

      {preview ? (
        // Vista previa con acciones (reemplazar / quitar).
        <div className="group relative overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Vista previa de la portada" className="h-40 w-full object-cover" />
          <div className="absolute inset-0 flex items-end justify-end gap-2 bg-gradient-to-t from-black/55 via-transparent to-transparent p-2.5">
            <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-white disabled:opacity-50">
              Reemplazar
            </button>
            <button type="button" disabled={disabled} onClick={quitar} aria-label="Quitar imagen"
              className="grid h-8 w-8 place-items-center rounded-lg bg-red-500/90 text-white transition hover:bg-red-600 disabled:opacity-50">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        // Zona de arrastrar/soltar o clic para seleccionar.
        <button type="button" disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files?.[0]); }}
          className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition
            ${arrastrando ? 'border-prexi-blue bg-prexi-blue/10' : 'border-line bg-subtle hover:border-prexi-blue/50 hover:bg-subtle/70'}
            disabled:cursor-not-allowed disabled:opacity-50`}>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-prexi-blue/15 text-prexi-blue-deep">
            {arrastrando ? <Upload className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
          </span>
          <span className="text-sm font-semibold text-fg">Arrastra una imagen o haz clic para elegir</span>
          <span className="text-xs text-muted">JPG, PNG o WebP · máximo 2 MB</span>
        </button>
      )}

      {error && <p className="mt-1.5 text-xs text-prexi-red">{error}</p>}
    </div>
  );
}
