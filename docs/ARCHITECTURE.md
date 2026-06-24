# Arquitectura — PREXI UPEA

## Visión general

```
┌─────────────┐   /api/*    ┌──────────────────┐   SQL    ┌────────────┐
│ React (Vite)│ ──────────▶ │ Express + TS     │ ───────▶ │ PostgreSQL │
│  client/    │ ◀────────── │  server/         │ ◀─────── │            │
└─────────────┘    JSON     └────────┬─────────┘          └────────────┘
                                     │ GEMINI_API_KEY (solo servidor)
                                     ▼
                              ┌──────────────┐
                              │ Google Gemini│
                              └──────────────┘
```

El frontend **nunca** contacta a Gemini. Solo llama a `/api/ai/*`; el servidor
adjunta la `GEMINI_API_KEY` (variable de entorno) y reenvía la petición.

## Capas del backend

- **routes/** — definición de endpoints + validación con Zod.
- **services/** — lógica de negocio reutilizable:
  - `aiTutorService` — prompts de ALEX, llamada a Gemini, caché.
  - `adaptiveService` — motor adaptativo (reglas) y desbloqueo de niveles.
  - `gamificationService` — XP, multiplicador de racha, ranking, logros.
  - `reportService` / `exportService` — reportes agregados y export PDF/Excel.
  - `configService` — fila única `configuracion_sistema`.
- **middleware/** — `auth` (JWT + roles), `rateLimitAI` (20/h por estudiante), `error`.
- **config/** — `env` (única lectura de secretos) y `db` (pool de `pg`).

## Reglas de negocio clave

### Motor adaptativo (NO IA generativa)
Se mira la racha de los últimos intentos:
- **≥3 aciertos consecutivos** → sube la dificultad sugerida.
- **≥2 fallos consecutivos** → baja la dificultad + sugiere pista nivel 2.

### Desbloqueo de niveles
`ejercicios_completados >= umbral` (configurable, default 8). Al completarse, se
marca `desbloqueado = true` en el nivel siguiente (`progreso_niveles`).

### Gamificación
- **XP otorgado** = `xp_ejercicio × multiplicador_racha`.
- **Multiplicador**: 0-2 días ×1.0 · 3-6 ×1.2 · 7-13 ×1.5 · 14+ ×2.0.
- **Racha**: +1 si hay actividad en día consecutivo; se resetea tras un día sin actividad.
- **Insignias**: evaluadas por evento (primer acierto, nivel completado, top 5, racha 7, sin pistas).

### Control de costos de IA
- Rate limit por estudiante: `AI_RATE_LIMIT_PER_HOUR` (default 20), auditado en `ia_uso`.
- Caché de respuestas frecuentes en `ia_cache` (hash del prompt).
- `max_pistas_ia` (admin) acota el `nivel_pista` máximo, junto al `max_pistas` del ejercicio.

## Endpoints

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` `/login` | público | Alta/login (JWT) |
| GET | `/api/auth/me` | auth | Usuario actual |
| GET/POST/PUT/DELETE | `/api/ejercicios` | ver/CRUD | Estudiante ve sin respuesta; docente/admin CRUD |
| GET | `/api/niveles` | auth | Niveles con progreso del usuario |
| POST | `/api/intentos` | auth | Registra intento, otorga XP, recomienda |
| GET | `/api/intentos/mios` | auth | Historial |
| POST | `/api/pretest` · GET `/comparativa` | auth | Pre/postest + ganancia |
| POST | `/api/ai/asistente` `/retroalimentacion` `/pista` | estudiante (rate-limited) | Tutor ALEX |
| GET | `/api/ranking` | auth | Tabla de ranking |
| GET | `/api/dashboard` `/logros` | auth | Resumen e insignias |
| GET | `/api/reportes/*` (+ export excel/pdf) | docente/admin | Reportes |
| GET/PUT | `/api/admin/config` · GET `/ia/uso` | admin | Configuración y auditoría IA |
