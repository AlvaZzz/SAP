-- CreateTable
CREATE TABLE "flashcards" (
    "id" SERIAL NOT NULL,
    "tema_id" INTEGER NOT NULL,
    "ejercicio_id" INTEGER,
    "frente" TEXT NOT NULL,
    "reverso" TEXT NOT NULL,
    "explicacion" TEXT,
    "codigo_python" TEXT,
    "nivel_dificultad" "NivelDificultad" NOT NULL DEFAULT 'basico',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flashcards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flashcards_tema_id_nivel_dificultad_idx" ON "flashcards"("tema_id", "nivel_dificultad");

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_tema_id_fkey" FOREIGN KEY ("tema_id") REFERENCES "temas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_ejercicio_id_fkey" FOREIGN KEY ("ejercicio_id") REFERENCES "ejercicios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

