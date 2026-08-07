-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('estudiante', 'docente', 'admin', 'investigador');

-- CreateEnum
CREATE TYPE "TipoEjercicio" AS ENUM ('opcion_multiple', 'predecir_salida', 'completar_codigo', 'ordenar_lineas');

-- CreateEnum
CREATE TYPE "NivelDificultad" AS ENUM ('basico', 'intermedio', 'avanzado');

-- CreateEnum
CREATE TYPE "EstadoPreguntaIa" AS ENUM ('borrador', 'aprobada', 'rechazada');

-- CreateEnum
CREATE TYPE "Banco" AS ENUM ('practica', 'pretest', 'postest', 'examen');

-- CreateEnum
CREATE TYPE "TipoTest" AS ENUM ('pre', 'post');

-- CreateEnum
CREATE TYPE "Grupo" AS ENUM ('control', 'experimental');

-- CreateEnum
CREATE TYPE "ContextoCodigo" AS ENUM ('libre', 'ejercicio', 'reto');

-- CreateEnum
CREATE TYPE "EstadoEntrega" AS ENUM ('sin_entregar', 'pendiente_revision', 'aprobado', 'necesita_mejorar');

-- CreateEnum
CREATE TYPE "TipoBug" AS ENUM ('operador_aritmetico_invertido', 'operador_relacional_invertido', 'limite_rango_corrido', 'orden_lineas_intercambiado', 'variable_trocada');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cedula" TEXT,
    "rol" "Rol" NOT NULL DEFAULT 'estudiante',
    "carrera" TEXT,
    "institucion" TEXT,
    "password_hash" TEXT NOT NULL,
    "introduccion_completada" BOOLEAN NOT NULL DEFAULT false,
    "repaso_postest_completado" BOOLEAN NOT NULL DEFAULT false,
    "pretest_completado" BOOLEAN NOT NULL DEFAULT false,
    "nivel_inicial" INTEGER NOT NULL DEFAULT 1,
    "nivel_inicial_adaptativo" "NivelDificultad",
    "theta_inicial" DOUBLE PRECISION,
    "theta_actual" DOUBLE PRECISION,
    "theta_final" DOUBLE PRECISION,
    "grupo" "Grupo" NOT NULL DEFAULT 'experimental',
    "paralelo" TEXT,
    "semestre" INTEGER NOT NULL DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "tours_vistos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sonidos_activados" BOOLEAN NOT NULL DEFAULT true,
    "voz_automatica" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_theta" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "theta" DOUBLE PRECISION NOT NULL,
    "origen" TEXT NOT NULL,
    "n" INTEGER NOT NULL DEFAULT 0,
    "tema_id" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_theta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_recuperacion" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "usado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "revocado_en" TIMESTAMP(3),
    "recordado" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "introduccion" TEXT,
    "repaso" TEXT,
    "dash_objetivos" TEXT,
    "dash_analogias" TEXT,
    "dash_ejemplos" JSONB,
    "dash_minutos" INTEGER,
    "institucion" TEXT NOT NULL DEFAULT 'UPEA',
    "plan" TEXT NOT NULL DEFAULT 'PRG-111',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "imagen_url" TEXT,
    "imagen_datos" BYTEA,
    "imagen_mime" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temas" (
    "id" SERIAL NOT NULL,
    "unidad_id" INTEGER NOT NULL,
    "padre_id" INTEGER,
    "numero" VARCHAR(20) NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "repaso" TEXT,
    "institucion" TEXT NOT NULL DEFAULT 'UPEA',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "umbral" INTEGER NOT NULL DEFAULT 10,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "en_diagnostico" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "temas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progreso_temas" (
    "usuario_id" INTEGER NOT NULL,
    "tema_id" INTEGER NOT NULL,
    "ejercicios_completados" INTEGER NOT NULL DEFAULT 0,
    "desbloqueado" BOOLEAN NOT NULL DEFAULT false,
    "nivel_actual" "NivelDificultad" NOT NULL DEFAULT 'basico',
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progreso_temas_pkey" PRIMARY KEY ("usuario_id","tema_id")
);

-- CreateTable
CREATE TABLE "intentos_subida_nivel" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "tema_id" INTEGER NOT NULL,
    "desde" "NivelDificultad" NOT NULL,
    "hacia" "NivelDificultad" NOT NULL,
    "puntaje" INTEGER NOT NULL DEFAULT 0,
    "aprobado" BOOLEAN NOT NULL DEFAULT false,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentos_subida_nivel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil_adaptativo" (
    "usuario_id" INTEGER NOT NULL,
    "dificultad_objetivo" INTEGER NOT NULL DEFAULT 1,
    "racha_aciertos" INTEGER NOT NULL DEFAULT 0,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfil_adaptativo_pkey" PRIMARY KEY ("usuario_id")
);

-- CreateTable
CREATE TABLE "pasos_ruta" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "ejercicio_id" INTEGER NOT NULL,
    "estrellas" INTEGER NOT NULL DEFAULT 0,
    "dificultad_objetivo" INTEGER NOT NULL DEFAULT 1,
    "correcto" BOOLEAN NOT NULL DEFAULT false,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pasos_ruta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postest_control" (
    "paralelo" TEXT NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT false,
    "habilitado_en" TIMESTAMP(3),
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "postest_control_pkey" PRIMARY KEY ("paralelo")
);

-- CreateTable
CREATE TABLE "unidades_completadas" (
    "usuario_id" INTEGER NOT NULL,
    "unidad_id" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unidades_completadas_pkey" PRIMARY KEY ("usuario_id","unidad_id")
);

-- CreateTable
CREATE TABLE "preguntas_generadas" (
    "id" SERIAL NOT NULL,
    "tema_id" INTEGER NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "documento_id" INTEGER,
    "tipo" "TipoEjercicio" NOT NULL DEFAULT 'opcion_multiple',
    "categoria" TEXT NOT NULL DEFAULT 'General',
    "enunciado" TEXT NOT NULL,
    "codigo_python" TEXT,
    "opciones" JSONB NOT NULL DEFAULT '[]',
    "respuesta_correcta" TEXT NOT NULL,
    "explicacion_ia" TEXT,
    "estado" "EstadoPreguntaIa" NOT NULL DEFAULT 'borrador',
    "ejercicio_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preguntas_generadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "niveles" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "umbral" INTEGER NOT NULL DEFAULT 12,

    CONSTRAINT "niveles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ejercicios" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "nivel_id" INTEGER NOT NULL,
    "tema_id" INTEGER,
    "estrellas" INTEGER NOT NULL DEFAULT 3,
    "nivel_dificultad" "NivelDificultad" NOT NULL DEFAULT 'basico',
    "dificultad_b" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tipo" "TipoEjercicio" NOT NULL DEFAULT 'opcion_multiple',
    "enunciado" TEXT NOT NULL,
    "codigo_python" TEXT,
    "opciones" JSONB NOT NULL DEFAULT '[]',
    "respuesta_correcta" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 50,
    "explicacion_ia" TEXT,
    "max_pistas" INTEGER NOT NULL DEFAULT 3,
    "banco" "Banco" NOT NULL DEFAULT 'practica',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fuente_doc" JSONB,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ejercicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intentos" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "ejercicio_id" INTEGER NOT NULL,
    "respuesta_dada" TEXT NOT NULL,
    "correcto" BOOLEAN NOT NULL,
    "tiempo_seg" INTEGER NOT NULL DEFAULT 0,
    "pistas_usadas" INTEGER NOT NULL DEFAULT 0,
    "xp_otorgado" INTEGER NOT NULL DEFAULT 0,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progreso_niveles" (
    "usuario_id" INTEGER NOT NULL,
    "nivel_id" INTEGER NOT NULL,
    "ejercicios_completados" INTEGER NOT NULL DEFAULT 0,
    "desbloqueado" BOOLEAN NOT NULL DEFAULT false,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progreso_niveles_pkey" PRIMARY KEY ("usuario_id","nivel_id")
);

-- CreateTable
CREATE TABLE "pretest_postest" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "tipo" "TipoTest" NOT NULL,
    "puntaje_total" INTEGER NOT NULL,
    "tiempo_seg" INTEGER NOT NULL DEFAULT 0,
    "por_categoria" JSONB NOT NULL DEFAULT '[]',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pretest_postest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pretest_respuestas" (
    "usuario_id" INTEGER NOT NULL,
    "ejercicio_id" INTEGER NOT NULL,
    "tipo" "TipoTest" NOT NULL DEFAULT 'pre',
    "opcion_dada" TEXT NOT NULL DEFAULT '',
    "correcto" BOOLEAN NOT NULL DEFAULT false,
    "categoria" TEXT NOT NULL,
    "tema_id" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pretest_respuestas_pkey" PRIMARY KEY ("usuario_id","ejercicio_id","tipo")
);

-- CreateTable
CREATE TABLE "diagnostico_temas" (
    "usuario_id" INTEGER NOT NULL,
    "tema_id" INTEGER NOT NULL,
    "theta" DOUBLE PRECISION,
    "nivel" "NivelDificultad" NOT NULL DEFAULT 'basico',
    "aciertos" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "puntaje" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostico_temas_pkey" PRIMARY KEY ("usuario_id","tema_id")
);

-- CreateTable
CREATE TABLE "repasos_unidad" (
    "usuario_id" INTEGER NOT NULL,
    "unidad_id" INTEGER NOT NULL,
    "revisado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repasos_unidad_pkey" PRIMARY KEY ("usuario_id","unidad_id")
);

-- CreateTable
CREATE TABLE "examenes_unidad" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "unidad_id" INTEGER NOT NULL,
    "theta" DOUBLE PRECISION,
    "nivel" "NivelDificultad" NOT NULL DEFAULT 'basico',
    "puntaje" INTEGER NOT NULL DEFAULT 0,
    "aprobado" BOOLEAN NOT NULL DEFAULT false,
    "aciertos" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "examenes_unidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking" (
    "usuario_id" INTEGER NOT NULL,
    "xp_total" INTEGER NOT NULL DEFAULT 0,
    "racha_dias" INTEGER NOT NULL DEFAULT 0,
    "ultima_actividad" DATE,
    "posicion" INTEGER,

    CONSTRAINT "ranking_pkey" PRIMARY KEY ("usuario_id")
);

-- CreateTable
CREATE TABLE "logros" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "condicion" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "icono" TEXT NOT NULL DEFAULT '',
    "svgKey" TEXT NOT NULL DEFAULT 'estrella',
    "categoria" TEXT NOT NULL DEFAULT 'general',
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "logros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rangos" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "umbral" INTEGER NOT NULL,
    "svgKey" TEXT NOT NULL DEFAULT 'escudo_1',
    "color" TEXT NOT NULL DEFAULT '#3B6291',

    CONSTRAINT "rangos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "desempeno_unidad" (
    "usuario_id" INTEGER NOT NULL,
    "unidad_id" INTEGER NOT NULL,
    "ejercicios_resueltos" INTEGER NOT NULL DEFAULT 0,
    "ejercicios_total" INTEGER NOT NULL DEFAULT 0,
    "temas_completados" INTEGER NOT NULL DEFAULT 0,
    "temas_total" INTEGER NOT NULL DEFAULT 0,
    "acierto_pct" INTEGER NOT NULL DEFAULT 0,
    "postest_pct" INTEGER,
    "puntaje" INTEGER NOT NULL DEFAULT 0,
    "rango_clave" TEXT NOT NULL DEFAULT 'aprendiz',
    "dominio_pct" INTEGER NOT NULL DEFAULT 0,
    "nivel_dominio" "NivelDificultad" NOT NULL DEFAULT 'basico',
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "desempeno_unidad_pkey" PRIMARY KEY ("usuario_id","unidad_id")
);

-- CreateTable
CREATE TABLE "logros_usuario" (
    "usuario_id" INTEGER NOT NULL,
    "logro_id" INTEGER NOT NULL,
    "fecha_obtenido" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logros_usuario_pkey" PRIMARY KEY ("usuario_id","logro_id")
);

-- CreateTable
CREATE TABLE "consultas_ia" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'asistente',
    "endpoint" TEXT NOT NULL DEFAULT '',
    "pregunta" TEXT,
    "respuesta" TEXT,
    "ejercicio_id" INTEGER,
    "nivel_pista" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultas_ia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "archivo" TEXT NOT NULL,
    "contenido" BYTEA,
    "tamano_bytes" INTEGER NOT NULL,
    "nivel_id" INTEGER,
    "tema_id" INTEGER,
    "texto_extraido" TEXT,
    "subido_por_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retos" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT,
    "titulo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "nivel_id" INTEGER,
    "tema_id" INTEGER,
    "estrellas" INTEGER NOT NULL DEFAULT 3,
    "tipo" "TipoEjercicio" NOT NULL DEFAULT 'completar_codigo',
    "enunciado" TEXT NOT NULL,
    "codigo_inicial" TEXT,
    "ejemplo_entrada" TEXT,
    "ejemplo_salida" TEXT,
    "opciones" JSONB NOT NULL DEFAULT '[]',
    "respuesta_correcta" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 50,
    "fecha_limite" TIMESTAMP(3),
    "autor_id" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "es_bug_hunt" BOOLEAN NOT NULL DEFAULT false,
    "origen_ejercicio_id" INTEGER,
    "nivel_dificultad" "NivelDificultad" NOT NULL DEFAULT 'basico',
    "tipo_bug" "TipoBug",
    "pistas" JSONB NOT NULL DEFAULT '[]',
    "auto_calificable" BOOLEAN NOT NULL DEFAULT false,
    "fuente_doc" JSONB,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retos_usuario" (
    "usuario_id" INTEGER NOT NULL,
    "reto_id" INTEGER NOT NULL,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoEntrega" NOT NULL DEFAULT 'sin_entregar',
    "codigo_entregado" TEXT,
    "feedback_docente" TEXT,
    "xp_obtenido" INTEGER NOT NULL DEFAULT 0,
    "entregado_en" TIMESTAMP(3),
    "revisado_en" TIMESTAMP(3),
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retos_usuario_pkey" PRIMARY KEY ("usuario_id","reto_id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'reto_revisado',
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "enlace" TEXT,
    "ref_id" INTEGER,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_docente" (
    "estudiante_id" INTEGER NOT NULL,
    "docente_id" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notas_docente_pkey" PRIMARY KEY ("estudiante_id","docente_id")
);

-- CreateTable
CREATE TABLE "codigo_practica" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "contexto" "ContextoCodigo" NOT NULL DEFAULT 'libre',
    "ref_id" INTEGER,
    "codigo" TEXT NOT NULL,
    "ultima_salida" TEXT,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "codigo_practica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion_sistema" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nombre_sistema" TEXT NOT NULL DEFAULT 'PREXI',
    "institucion" TEXT NOT NULL DEFAULT 'UPEA',
    "periodo" TEXT NOT NULL DEFAULT '',
    "logo_url" TEXT,
    "xp_por_ejercicio" INTEGER NOT NULL DEFAULT 50,
    "xp_bonus_racha" INTEGER NOT NULL DEFAULT 10,
    "xp_por_logro" INTEGER NOT NULL DEFAULT 20,
    "umbral_porcentaje" INTEGER NOT NULL DEFAULT 80,
    "penalizacion_pista" INTEGER NOT NULL DEFAULT 5,
    "subir_nivel_preguntas" INTEGER NOT NULL DEFAULT 5,
    "subir_nivel_umbral" INTEGER NOT NULL DEFAULT 80,
    "subir_nivel_espera_horas" INTEGER NOT NULL DEFAULT 0,
    "examen_unidad_preguntas" INTEGER NOT NULL DEFAULT 8,
    "examen_unidad_espera_horas" INTEGER NOT NULL DEFAULT 0,
    "xp_factor_intermedio" INTEGER NOT NULL DEFAULT 125,
    "xp_factor_avanzado" INTEGER NOT NULL DEFAULT 150,
    "retos_habilitado" BOOLEAN NOT NULL DEFAULT false,
    "retos_intermedio_habilitado" BOOLEAN NOT NULL DEFAULT false,
    "retos_avanzado_habilitado" BOOLEAN NOT NULL DEFAULT false,
    "ia_activa" BOOLEAN NOT NULL DEFAULT true,
    "max_pistas_ia" INTEGER NOT NULL DEFAULT 3,
    "rate_limit_ia_hora" INTEGER NOT NULL DEFAULT 20,
    "modo_retroalimentacion" TEXT NOT NULL DEFAULT 'inmediata',
    "modelo_ia" TEXT NOT NULL DEFAULT 'gemini-2.5-flash-lite',
    "postest_desde_nivel" INTEGER NOT NULL DEFAULT 3,
    "grupos_bloqueados" BOOLEAN NOT NULL DEFAULT false,
    "riesgo_dias_inactivo" INTEGER NOT NULL DEFAULT 7,
    "riesgo_tasa_acierto_min" INTEGER NOT NULL DEFAULT 40,
    "riesgo_min_intentos" INTEGER NOT NULL DEFAULT 4,

    CONSTRAINT "configuracion_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_auditoria" (
    "id" SERIAL NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL DEFAULT '',
    "entidad_id" INTEGER,
    "detalle" TEXT NOT NULL DEFAULT '',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_cedula_key" ON "usuarios"("cedula");

-- CreateIndex
CREATE INDEX "historial_theta_usuario_id_fecha_idx" ON "historial_theta"("usuario_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_recuperacion_token_hash_key" ON "tokens_recuperacion"("token_hash");

-- CreateIndex
CREATE INDEX "tokens_recuperacion_usuario_id_idx" ON "tokens_recuperacion"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_usuario_id_revocado_en_idx" ON "refresh_tokens"("usuario_id", "revocado_en");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_institucion_numero_key" ON "unidades"("institucion", "numero");

-- CreateIndex
CREATE INDEX "temas_unidad_id_idx" ON "temas"("unidad_id");

-- CreateIndex
CREATE INDEX "temas_padre_id_idx" ON "temas"("padre_id");

-- CreateIndex
CREATE INDEX "intentos_subida_nivel_usuario_id_tema_id_fecha_idx" ON "intentos_subida_nivel"("usuario_id", "tema_id", "fecha");

-- CreateIndex
CREATE INDEX "pasos_ruta_usuario_id_fecha_idx" ON "pasos_ruta"("usuario_id", "fecha");

-- CreateIndex
CREATE INDEX "preguntas_generadas_tema_id_estado_idx" ON "preguntas_generadas"("tema_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "niveles_numero_key" ON "niveles"("numero");

-- CreateIndex
CREATE INDEX "ejercicios_nivel_id_idx" ON "ejercicios"("nivel_id");

-- CreateIndex
CREATE INDEX "ejercicios_tema_id_idx" ON "ejercicios"("tema_id");

-- CreateIndex
CREATE INDEX "ejercicios_tema_id_nivel_dificultad_idx" ON "ejercicios"("tema_id", "nivel_dificultad");

-- CreateIndex
CREATE INDEX "ejercicios_banco_idx" ON "ejercicios"("banco");

-- CreateIndex
CREATE INDEX "intentos_usuario_id_idx" ON "intentos"("usuario_id");

-- CreateIndex
CREATE INDEX "intentos_ejercicio_id_idx" ON "intentos"("ejercicio_id");

-- CreateIndex
CREATE INDEX "intentos_fecha_idx" ON "intentos"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "pretest_postest_usuario_id_tipo_key" ON "pretest_postest"("usuario_id", "tipo");

-- CreateIndex
CREATE INDEX "pretest_respuestas_tema_id_idx" ON "pretest_respuestas"("tema_id");

-- CreateIndex
CREATE INDEX "diagnostico_temas_tema_id_idx" ON "diagnostico_temas"("tema_id");

-- CreateIndex
CREATE INDEX "examenes_unidad_usuario_id_unidad_id_fecha_idx" ON "examenes_unidad"("usuario_id", "unidad_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "logros_clave_key" ON "logros"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "rangos_clave_key" ON "rangos"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "rangos_orden_key" ON "rangos"("orden");

-- CreateIndex
CREATE INDEX "consultas_ia_usuario_id_fecha_idx" ON "consultas_ia"("usuario_id", "fecha");

-- CreateIndex
CREATE INDEX "consultas_ia_usuario_id_ejercicio_id_tipo_idx" ON "consultas_ia"("usuario_id", "ejercicio_id", "tipo");

-- CreateIndex
CREATE INDEX "documentos_tema_id_idx" ON "documentos"("tema_id");

-- CreateIndex
CREATE UNIQUE INDEX "retos_codigo_key" ON "retos"("codigo");

-- CreateIndex
CREATE INDEX "retos_tema_id_idx" ON "retos"("tema_id");

-- CreateIndex
CREATE INDEX "retos_tema_id_nivel_dificultad_idx" ON "retos"("tema_id", "nivel_dificultad");

-- CreateIndex
CREATE INDEX "retos_origen_ejercicio_id_idx" ON "retos"("origen_ejercicio_id");

-- CreateIndex
CREATE INDEX "retos_usuario_reto_id_estado_idx" ON "retos_usuario"("reto_id", "estado");

-- CreateIndex
CREATE INDEX "notificaciones_usuario_id_leida_idx" ON "notificaciones"("usuario_id", "leida");

-- CreateIndex
CREATE INDEX "notificaciones_usuario_id_creado_en_idx" ON "notificaciones"("usuario_id", "creado_en");

-- CreateIndex
CREATE INDEX "notas_docente_docente_id_idx" ON "notas_docente"("docente_id");

-- CreateIndex
CREATE INDEX "codigo_practica_usuario_id_idx" ON "codigo_practica"("usuario_id");

-- CreateIndex
CREATE INDEX "log_auditoria_accion_fecha_idx" ON "log_auditoria"("accion", "fecha");

-- CreateIndex
CREATE INDEX "log_auditoria_fecha_idx" ON "log_auditoria"("fecha");

-- AddForeignKey
ALTER TABLE "historial_theta" ADD CONSTRAINT "historial_theta_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_recuperacion" ADD CONSTRAINT "tokens_recuperacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temas" ADD CONSTRAINT "temas_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temas" ADD CONSTRAINT "temas_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "temas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progreso_temas" ADD CONSTRAINT "progreso_temas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progreso_temas" ADD CONSTRAINT "progreso_temas_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "temas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentos_subida_nivel" ADD CONSTRAINT "intentos_subida_nivel_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentos_subida_nivel" ADD CONSTRAINT "intentos_subida_nivel_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "temas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil_adaptativo" ADD CONSTRAINT "perfil_adaptativo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pasos_ruta" ADD CONSTRAINT "pasos_ruta_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pasos_ruta" ADD CONSTRAINT "pasos_ruta_ejercicio_id_fkey" FOREIGN KEY ("ejercicio_id") REFERENCES "ejercicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_completadas" ADD CONSTRAINT "unidades_completadas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_completadas" ADD CONSTRAINT "unidades_completadas_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preguntas_generadas" ADD CONSTRAINT "preguntas_generadas_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "temas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preguntas_generadas" ADD CONSTRAINT "preguntas_generadas_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preguntas_generadas" ADD CONSTRAINT "preguntas_generadas_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejercicios" ADD CONSTRAINT "ejercicios_nivel_id_fkey" FOREIGN KEY ("nivel_id") REFERENCES "niveles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejercicios" ADD CONSTRAINT "ejercicios_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "temas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentos" ADD CONSTRAINT "intentos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentos" ADD CONSTRAINT "intentos_ejercicio_id_fkey" FOREIGN KEY ("ejercicio_id") REFERENCES "ejercicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progreso_niveles" ADD CONSTRAINT "progreso_niveles_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progreso_niveles" ADD CONSTRAINT "progreso_niveles_nivel_id_fkey" FOREIGN KEY ("nivel_id") REFERENCES "niveles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pretest_postest" ADD CONSTRAINT "pretest_postest_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pretest_respuestas" ADD CONSTRAINT "pretest_respuestas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pretest_respuestas" ADD CONSTRAINT "pretest_respuestas_ejercicio_id_fkey" FOREIGN KEY ("ejercicio_id") REFERENCES "ejercicios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pretest_respuestas" ADD CONSTRAINT "pretest_respuestas_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "temas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostico_temas" ADD CONSTRAINT "diagnostico_temas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostico_temas" ADD CONSTRAINT "diagnostico_temas_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "temas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repasos_unidad" ADD CONSTRAINT "repasos_unidad_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repasos_unidad" ADD CONSTRAINT "repasos_unidad_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examenes_unidad" ADD CONSTRAINT "examenes_unidad_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examenes_unidad" ADD CONSTRAINT "examenes_unidad_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking" ADD CONSTRAINT "ranking_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desempeno_unidad" ADD CONSTRAINT "desempeno_unidad_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desempeno_unidad" ADD CONSTRAINT "desempeno_unidad_unidad_id_fkey" FOREIGN KEY ("unidad_id") REFERENCES "unidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logros_usuario" ADD CONSTRAINT "logros_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logros_usuario" ADD CONSTRAINT "logros_usuario_logro_id_fkey" FOREIGN KEY ("logro_id") REFERENCES "logros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas_ia" ADD CONSTRAINT "consultas_ia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_nivel_id_fkey" FOREIGN KEY ("nivel_id") REFERENCES "niveles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "temas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_subido_por_id_fkey" FOREIGN KEY ("subido_por_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retos" ADD CONSTRAINT "retos_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retos" ADD CONSTRAINT "retos_nivel_id_fkey" FOREIGN KEY ("nivel_id") REFERENCES "niveles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retos" ADD CONSTRAINT "retos_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "temas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retos" ADD CONSTRAINT "retos_origen_ejercicio_id_fkey" FOREIGN KEY ("origen_ejercicio_id") REFERENCES "ejercicios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retos_usuario" ADD CONSTRAINT "retos_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retos_usuario" ADD CONSTRAINT "retos_usuario_reto_id_fkey" FOREIGN KEY ("reto_id") REFERENCES "retos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_docente" ADD CONSTRAINT "notas_docente_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_docente" ADD CONSTRAINT "notas_docente_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigo_practica" ADD CONSTRAINT "codigo_practica_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_auditoria" ADD CONSTRAINT "log_auditoria_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
