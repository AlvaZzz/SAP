-- Práctica mínima por nivel antes de habilitar el mini-diagnóstico de subida.
-- Hasta ahora no existía ningún mínimo: el botón "¿Intentar subir a nivel X?"
-- aparecía en cuanto el tema tenía ejercicios del nivel objetivo, así que se
-- podía saltar el nivel sin practicarlo. Los valores por defecto van contra la
-- composición del banco (15/10/5 por tema).
ALTER TABLE "configuracion_sistema"
  ADD COLUMN "min_practica_basico"     INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "min_practica_intermedio" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN "min_practica_avanzado"   INTEGER NOT NULL DEFAULT 5;
