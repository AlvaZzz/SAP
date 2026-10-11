-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "apellido_materno" TEXT,
ADD COLUMN     "apellido_paterno" TEXT,
ADD COLUMN     "nombres" TEXT,
ADD COLUMN     "paralelo_id" INTEGER,
ADD COLUMN     "ru" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "materias" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "sigla" TEXT,
    "gestion" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paralelos" (
    "id" SERIAL NOT NULL,
    "materia_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "docente_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paralelos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "materias_nombre_gestion_key" ON "materias"("nombre", "gestion");

-- CreateIndex
CREATE INDEX "paralelos_docente_id_idx" ON "paralelos"("docente_id");

-- CreateIndex
CREATE UNIQUE INDEX "paralelos_materia_id_nombre_key" ON "paralelos"("materia_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_ru_key" ON "usuarios"("ru");

-- CreateIndex
CREATE INDEX "usuarios_paralelo_id_idx" ON "usuarios"("paralelo_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_paralelo_id_fkey" FOREIGN KEY ("paralelo_id") REFERENCES "paralelos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paralelos" ADD CONSTRAINT "paralelos_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paralelos" ADD CONSTRAINT "paralelos_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Migración de DATOS: el paralelo en texto pasa a la tabla nueva ──
-- Los estudiantes que ya tenían un paralelo escrito ("A", "B"…) se enlazan a un
-- Paralelo real dentro de una materia por defecto. No se borra ni se cambia el
-- texto original: `usuarios.paralelo` se conserva sincronizado.
INSERT INTO "materias" ("nombre", "sigla", "gestion")
SELECT 'Programación I', 'PRG-111',
       COALESCE(NULLIF((SELECT "periodo" FROM "configuracion_sistema" WHERE "id" = 1), ''), '2026-II')
WHERE EXISTS (
  SELECT 1 FROM "usuarios" WHERE "rol" = 'estudiante' AND "paralelo" IS NOT NULL AND btrim("paralelo") <> ''
);

INSERT INTO "paralelos" ("materia_id", "nombre")
SELECT m."id", p."nombre"
FROM (SELECT DISTINCT upper(btrim("paralelo")) AS "nombre"
      FROM "usuarios"
      WHERE "rol" = 'estudiante' AND "paralelo" IS NOT NULL AND btrim("paralelo") <> '') p
CROSS JOIN (SELECT "id" FROM "materias" ORDER BY "id" LIMIT 1) m;

UPDATE "usuarios" u
SET "paralelo_id" = p."id"
FROM "paralelos" p
WHERE u."rol" = 'estudiante' AND u."paralelo" IS NOT NULL AND upper(btrim(u."paralelo")) = p."nombre";
