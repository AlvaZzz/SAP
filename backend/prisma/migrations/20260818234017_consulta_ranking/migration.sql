-- CreateTable
CREATE TABLE "consultas_ranking" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "ambito" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultas_ranking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consultas_ranking_usuario_id_fecha_idx" ON "consultas_ranking"("usuario_id", "fecha");

-- AddForeignKey
ALTER TABLE "consultas_ranking" ADD CONSTRAINT "consultas_ranking_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
