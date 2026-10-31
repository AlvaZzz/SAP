-- Seguimiento de cada reto por estudiante: apertura e intentos fallidos (sello Pendiente / Incompleto).
ALTER TABLE "retos_usuario" ADD COLUMN "iniciado_en" TIMESTAMP(3);
ALTER TABLE "retos_usuario" ADD COLUMN "intentos_fallidos" INTEGER NOT NULL DEFAULT 0;
