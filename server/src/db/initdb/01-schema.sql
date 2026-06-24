-- ════════════════════════════════════════════════════════════
--  PREXI UPEA — Esquema de base de datos (PostgreSQL)
--
--  Postgres ejecuta automáticamente los archivos de este directorio
--  (montado en /docker-entrypoint-initdb.d) EN ORDEN ALFABÉTICO la
--  primera vez que el volumen de datos está vacío:
--    01-schema.sql  → crea tipos, tablas e índices (este archivo)
--    02-seed.sql    → inserta datos de ejemplo
-- ════════════════════════════════════════════════════════════

-- Para hashear contraseñas con bcrypt directamente en SQL (crypt/gen_salt).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Limpieza idempotente (orden inverso por dependencias)
DROP TABLE IF EXISTS diagnostico_inicial CASCADE;
DROP TABLE IF EXISTS logros_usuario      CASCADE;
DROP TABLE IF EXISTS logros              CASCADE;
DROP TABLE IF EXISTS ranking             CASCADE;
DROP TABLE IF EXISTS pretest_postest     CASCADE;
DROP TABLE IF EXISTS progreso_niveles    CASCADE;
DROP TABLE IF EXISTS intentos            CASCADE;
DROP TABLE IF EXISTS ia_uso              CASCADE;
DROP TABLE IF EXISTS ia_cache            CASCADE;
DROP TABLE IF EXISTS ejercicios          CASCADE;
DROP TABLE IF EXISTS niveles             CASCADE;
DROP TABLE IF EXISTS configuracion_sistema CASCADE;
DROP TABLE IF EXISTS usuarios            CASCADE;

DROP TYPE IF EXISTS rol_usuario   CASCADE;
DROP TYPE IF EXISTS tipo_test     CASCADE;
DROP TYPE IF EXISTS dificultad_ej CASCADE;

CREATE TYPE rol_usuario   AS ENUM ('estudiante', 'docente', 'admin');
CREATE TYPE tipo_test     AS ENUM ('pre', 'post');
CREATE TYPE dificultad_ej AS ENUM ('facil', 'media', 'dificil');

-- ── Usuarios ────────────────────────────────────────────────
CREATE TABLE usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  rol           rol_usuario NOT NULL DEFAULT 'estudiante',
  carrera       TEXT,
  password_hash TEXT        NOT NULL,
  -- Cuestionario diagnóstico inicial (solo aplica a estudiantes nuevos).
  diagnostico_completado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Diagnóstico inicial con IA (perfil del estudiante) ──────
CREATE TABLE diagnostico_inicial (
  id                 SERIAL PRIMARY KEY,
  usuario_id         INTEGER     NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  puntaje            INTEGER     NOT NULL,                  -- 0-100
  nivel              TEXT        NOT NULL,                  -- 'Principiante' | 'Intermedio' | 'Avanzado'
  fortalezas         JSONB       NOT NULL DEFAULT '[]',     -- ["Estructuras condicionales", ...]
  debilidades        JSONB       NOT NULL DEFAULT '[]',     -- ["Bucles anidados", ...]
  recomendaciones    JSONB       NOT NULL DEFAULT '[]',     -- [{ nivel_id, titulo, prioridad }]
  detalle_respuestas JSONB       NOT NULL DEFAULT '[]',     -- respuestas individuales del estudiante
  analisis_ia        TEXT,                                  -- análisis libre de Gemini
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Niveles (módulos de aprendizaje) ────────────────────────
CREATE TABLE niveles (
  id          SERIAL PRIMARY KEY,
  numero      INTEGER NOT NULL UNIQUE,           -- 1, 2, 3, ...
  titulo      TEXT    NOT NULL,
  descripcion TEXT,
  umbral      INTEGER NOT NULL DEFAULT 8          -- ejercicios para desbloquear el siguiente
);

-- ── Ejercicios ──────────────────────────────────────────────
CREATE TABLE ejercicios (
  id                 SERIAL PRIMARY KEY,
  titulo             TEXT          NOT NULL,
  categoria          TEXT          NOT NULL,       -- Lógica, Algoritmos, Estructuras, POO, Redes
  nivel_id           INTEGER       NOT NULL REFERENCES niveles(id) ON DELETE CASCADE,
  dificultad         dificultad_ej NOT NULL DEFAULT 'media',
  enunciado          TEXT          NOT NULL,
  pseudocodigo       TEXT,
  opciones           JSONB         NOT NULL DEFAULT '[]',   -- [{ id:"A", texto:"11" }, ...]
  respuesta_correcta TEXT          NOT NULL,                -- "B"
  xp                 INTEGER       NOT NULL DEFAULT 50,
  explicacion_ia     TEXT,                                  -- explicación base opcional
  max_pistas         INTEGER       NOT NULL DEFAULT 3,
  creado_en          TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_ejercicios_nivel     ON ejercicios(nivel_id);
CREATE INDEX idx_ejercicios_categoria ON ejercicios(categoria);

-- ── Intentos ────────────────────────────────────────────────
CREATE TABLE intentos (
  id            SERIAL PRIMARY KEY,
  usuario_id    INTEGER     NOT NULL REFERENCES usuarios(id)   ON DELETE CASCADE,
  ejercicio_id  INTEGER     NOT NULL REFERENCES ejercicios(id) ON DELETE CASCADE,
  respuesta_dada TEXT       NOT NULL,
  correcto      BOOLEAN     NOT NULL,
  tiempo_seg    INTEGER     NOT NULL DEFAULT 0,
  xp_otorgado   INTEGER     NOT NULL DEFAULT 0,
  fecha         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_intentos_usuario   ON intentos(usuario_id);
CREATE INDEX idx_intentos_ejercicio ON intentos(ejercicio_id);
CREATE INDEX idx_intentos_fecha     ON intentos(fecha);

-- ── Progreso por nivel ──────────────────────────────────────
CREATE TABLE progreso_niveles (
  usuario_id              INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nivel_id                INTEGER NOT NULL REFERENCES niveles(id)  ON DELETE CASCADE,
  ejercicios_completados  INTEGER NOT NULL DEFAULT 0,
  desbloqueado            BOOLEAN NOT NULL DEFAULT FALSE,
  actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, nivel_id)
);

-- ── Pretest / Postest ───────────────────────────────────────
CREATE TABLE pretest_postest (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo        tipo_test   NOT NULL,
  categoria   TEXT        NOT NULL,
  puntaje     INTEGER     NOT NULL,           -- 0-100
  fecha       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pretest_usuario ON pretest_postest(usuario_id);

-- ── Ranking (XP, racha, posición) ───────────────────────────
CREATE TABLE ranking (
  usuario_id  INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  xp_total    INTEGER     NOT NULL DEFAULT 0,
  racha_dias  INTEGER     NOT NULL DEFAULT 0,
  ultima_actividad DATE,
  posicion    INTEGER
);

-- ── Logros / insignias ──────────────────────────────────────
CREATE TABLE logros (
  id        SERIAL PRIMARY KEY,
  clave     TEXT NOT NULL UNIQUE,    -- 'primer_acierto', 'nivel_completado', 'top_5', ...
  nombre    TEXT NOT NULL,
  condicion TEXT NOT NULL,           -- descripción legible
  icono     TEXT NOT NULL DEFAULT '🏅'
);

CREATE TABLE logros_usuario (
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  logro_id       INTEGER NOT NULL REFERENCES logros(id)   ON DELETE CASCADE,
  fecha_obtenido TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, logro_id)
);

-- ── Configuración del sistema (fila única) ──────────────────
CREATE TABLE configuracion_sistema (
  id                SMALLINT PRIMARY KEY DEFAULT 1,
  xp_por_ejercicio  INTEGER NOT NULL DEFAULT 50,
  umbral_nivel      INTEGER NOT NULL DEFAULT 8,
  max_pistas_ia     INTEGER NOT NULL DEFAULT 3,
  modelo_ia         TEXT    NOT NULL DEFAULT 'gemini-2.0-flash',
  CONSTRAINT fila_unica CHECK (id = 1)
);

-- ── Soporte IA: uso (rate limit) y caché ────────────────────
CREATE TABLE ia_uso (
  id         SERIAL PRIMARY KEY,
  usuario_id INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL,
  fecha      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ia_uso_usuario_fecha ON ia_uso(usuario_id, fecha);

CREATE TABLE ia_cache (
  clave      TEXT PRIMARY KEY,        -- hash del prompt
  respuesta  TEXT NOT NULL,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
