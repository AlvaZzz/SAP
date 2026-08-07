#!/bin/sh
# Arranque del contenedor de DESARROLLO (docker-compose.yml) y de la ruta VPS.
# La producción vigente (Render) NO usa este script: allí el arranque son los
# comandos declarados en render.yaml.
set -e

# Regenera el cliente Prisma en runtime: el volumen `api_node_modules` enmascara
# el node_modules de la imagen, así que hay que generarlo aquí para que el client
# refleje el schema actual (p. ej. campos nuevos como `activo`).
echo "[api] Generando cliente Prisma..."
npx prisma generate

# Aplica las migraciones VERSIONADAS de prisma/migrations. Nunca `db push`: ese
# comando no deja historial y puede reescribir el esquema a ciegas.
echo "[api] Aplicando migraciones (migrate deploy)..."
npx prisma migrate deploy

# Siembra solo si la base está vacía (idempotente). Es una comodidad de
# DESARROLLO: en producción la siembra se ejecuta UNA vez y a mano
# (ver docs/DESPLIEGUE_RENDER_VERCEL_NEON.md), nunca atada al arranque.
COUNT=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.usuario.count().then(n=>{console.log(n);return p.\$disconnect()}).catch(()=>{console.log(0)})")
if [ "$COUNT" = "0" ]; then
  echo "[api] Base vacía → ejecutando seed Python..."
  npm run seed
else
  echo "[api] Base ya inicializada ($COUNT usuarios). Omitiendo seed."
fi

echo "[api] Iniciando NestJS..."
exec npm run dev
