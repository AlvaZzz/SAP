#!/bin/sh
set -e

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
