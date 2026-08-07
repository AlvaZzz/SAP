#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════
#  PREXI — Respaldo de la base de datos
#
#  Genera un dump COMPRIMIDO con fecha en el nombre y conserva los últimos N.
#  Funciona contra Neon (producción) o contra la base local de Docker.
#
#  Uso:
#    # Producción (Neon) — usa la cadena DIRECTA, no la pooled:
#    DATABASE_URL='postgresql://…neon.tech/prexi?sslmode=require' ./scripts/respaldo-bd.sh
#
#    # Local (Docker):
#    ./scripts/respaldo-bd.sh --local
#
#  Requiere `pg_dump` (viene con el cliente de PostgreSQL). En Windows puedes
#  usar el que ya está dentro del contenedor: ./scripts/respaldo-bd.sh --local
#
#  RESTAURACIÓN: ver docs/BASE_DE_DATOS.md
# ════════════════════════════════════════════════════════════
set -euo pipefail

DESTINO="${DESTINO:-backups}"
CONSERVAR="${CONSERVAR:-14}"   # cuántos respaldos mantener
FECHA="$(date +%Y-%m-%d-%H%M%S)"

mkdir -p "$DESTINO"

if [ "${1:-}" = "--local" ]; then
  ARCHIVO="$DESTINO/prexi-local-$FECHA.dump"
  echo "[respaldo] Base local (contenedor prexi-db) → $ARCHIVO"
  # --format=custom permite restaurar tablas sueltas y comprime de serie.
  docker exec prexi-db pg_dump -U prexi -d prexi --format=custom > "$ARCHIVO"
else
  : "${DATABASE_URL:?Define DATABASE_URL (cadena DIRECTA de Neon) o usa --local}"
  ARCHIVO="$DESTINO/prexi-neon-$FECHA.dump"
  echo "[respaldo] Base remota → $ARCHIVO"
  pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges > "$ARCHIVO"
fi

TAMANO="$(du -h "$ARCHIVO" | cut -f1)"
echo "[respaldo] Listo: $ARCHIVO ($TAMANO)"

# Un dump de 0 bytes es un fallo silencioso: mejor enterarse ahora.
if [ ! -s "$ARCHIVO" ]; then
  echo "[respaldo] ERROR: el archivo está vacío. El respaldo NO es válido." >&2
  exit 1
fi

# ── Rotación: conserva los $CONSERVAR más recientes del mismo tipo ──
PATRON="$(basename "$ARCHIVO" | sed 's/-[0-9-]*\.dump$//')"
SOBRAN="$(ls -1t "$DESTINO/$PATRON"-*.dump 2>/dev/null | tail -n +"$((CONSERVAR + 1))" || true)"
if [ -n "$SOBRAN" ]; then
  echo "$SOBRAN" | while read -r viejo; do
    echo "[respaldo] Rotación: elimino $viejo"
    rm -f "$viejo"
  done
fi

echo "[respaldo] Respaldos guardados: $(ls -1 "$DESTINO/$PATRON"-*.dump | wc -l)"
