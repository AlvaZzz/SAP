# PREXI UPEA

Sistema Adaptativo con Inteligencia Artificial y Gamificación para el Aprendizaje de la Programación — UPEA, Ingeniería de Sistemas.

## Stack

- **Backend:** Node.js + Express + TypeScript
- **Base de datos:** PostgreSQL
- **Frontend:** React + Vite + TailwindCSS
- **IA:** Google Gemini (`@google/generative-ai`, modelo `gemini-2.0-flash`)
- **Auth:** JWT

Monorepo con npm workspaces: [`server/`](server) y [`client/`](client).

## Puesta en marcha

### Opción A — Docker Compose (recomendada)

Levanta Postgres + backend + frontend con un solo comando. No necesitas Node ni
Postgres instalados, solo Docker.

```bash
cp .env.docker.example .env     # define JWT_SECRET y GEMINI_API_KEY
docker compose up --build
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:4000/api/health |
| Postgres | localhost:5432 (prexi/prexi) |

Postgres ejecuta automáticamente los scripts de
[`server/src/db/initdb/`](server/src/db/initdb) **solo la primera vez** (cuando el
volumen de datos está vacío), en orden: `01-schema.sql` crea toda la base y
`02-seed.sql` la puebla. Los datos persisten en el volumen `pgdata` entre
reinicios. Para empezar de cero:

```bash
docker compose down -v && docker compose up --build
```

> **Seguridad:** `GEMINI_API_KEY` solo se inyecta en el contenedor `server`. El
> frontend nunca la ve — solo llama a `/api/ai/*`. Si tu key fue expuesta en el
> spec, **regenérala** antes de usarla.

### Opción B — Local sin Docker

**Requisitos:** Node.js >= 18, PostgreSQL >= 14 corriendo, una API key de Gemini.

```bash
npm install
cp server/.env.example server/.env   # DATABASE_URL, JWT_SECRET, GEMINI_API_KEY
npm run db:setup                      # crea tablas (initdb/01-schema.sql)
npm run db:seed                       # siembra datos (initdb/02-seed.sql)
npm run dev                           # server :4000 + client :5173
```

Usuarios de prueba (sembrados): `juan@upea.bo` (estudiante), `docente@upea.bo`,
`admin@upea.bo`. Contraseña por defecto `Prexi123*` para todos.

## Mapa de sprints

| Sprint | Entregable | Dónde |
|---|---|---|
| 1 | Auth + CRUD ejercicios + niveles | `auth`, `ejercicios`, `niveles` routes |
| 2 | Motor adaptativo + pretest/postest | `services/adaptiveService.ts`, `pretest` routes |
| 3 | Integración Gemini (3 endpoints IA) + rate limit | `services/aiTutorService.ts`, `routes/ai.ts` |
| 4 | Gamificación (XP, ranking, insignias) + dashboards | `services/gamificationService.ts` |
| 5 | Reportes docente/admin + exportación PDF/Excel | `services/reportService.ts` |

Ver [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) para detalle de las reglas de negocio.
