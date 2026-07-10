#!/bin/sh
set -e

# Regenera el cliente Prisma en runtime: el volumen `api_node_modules` enmascara
# el node_modules de la imagen, así que hay que generarlo aquí para que el client
# refleje el schema actual (p. ej. campos nuevos como `activo`).
echo "[api] Generando cliente Prisma..."
npx prisma generate

echo "[api] Aplicando esquema Prisma (db push)..."
npx prisma db push --skip-generate

# Siembra solo si la base está vacía (idempotente).
COUNT=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.usuario.count().then(n=>{console.log(n);return p.\$disconnect()}).catch(()=>{console.log(0)})")
if [ "$COUNT" = "0" ]; then
  echo "[api] Base vacía → ejecutando seed Python..."
  npm run seed
else
  echo "[api] Base ya inicializada ($COUNT usuarios). Omitiendo seed."
fi

echo "[api] Iniciando NestJS..."
exec npm run dev
