# PREXI UPEA

Sistema adaptativo con **Inteligencia Artificial (ALEX/Gemini)** y **gamificación** para aprender **programación en Python** — UPEA, Ingeniería de Sistemas.

> **Rama `rewrite/nest-next-prisma`** — reescritura completa del rol estudiante.
> El stack anterior (Express + pg + React/Vite) permanece en `master`.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | **Next.js 14** (App Router) + TailwindCSS + CodeMirror 6 |
| Backend | **NestJS** (Screaming Architecture) + TypeScript |
| ORM / BD | **Prisma** + PostgreSQL |
| Auth | JWT en **cookie httpOnly** + bcrypt |
| IA | **Google Gemini** (`gemini-2.0-flash`), solo en el backend |
| Sandbox de código | **Piston** self-hosted (ejecuta el Python del estudiante aislado) |

Monorepo: [`apps/api`](apps/api) (NestJS) y [`apps/web`](apps/web) (Next.js).

## Arquitectura (Screaming Architecture)

El backend se organiza **por dominio**, no por capas técnicas. Cada módulo NestJS tiene su controller, service y DTOs:

```
apps/api/src/
  auth/          estudiantes (en auth)   pretest/       ejercicios/
  practica/      tutor-ia/               documentos/    retos/
  ranking/       progreso/               gamificacion/  common/ (prisma, guards)
```

Regla clave: **toda** decisión (corrección de respuestas, XP, desbloqueo de nivel, ranking) se calcula en el backend. El frontend solo muestra. El código del estudiante **nunca** se ejecuta en el backend: va al contenedor **Piston** aislado (límites de tiempo/memoria).

## Puesta en marcha (Docker — recomendado)

Requisitos: Docker Desktop.

```bash
cp .env.docker.example .env     # define JWT_SECRET y (opcional) GEMINI_API_KEY
docker compose up --build
```

| Servicio | URL |
|---|---|
| Frontend (Next.js) | http://localhost:3000 |
| API (NestJS)       | http://localhost:4000/api/health |
| Postgres           | localhost:**5433** (`prexi`/`prexi`) |
| Piston (sandbox)   | http://localhost:2000 |

> El puerto **5433** evita chocar con un PostgreSQL local en el 5432.

El contenedor `api` aplica el esquema (`prisma db push`) y **siembra el contenido Python** (69 ejercicios + bancos pretest/postest) solo si la BD está vacía. La primera ejecución de código instala el runtime de Python en Piston (warm-up automático).

### Cuentas demo (clave `Prexi123*`)
`juan@upea.edu.bo` (estudiante) · `docente@upea.edu.bo` · `admin@upea.edu.bo`

Para probar el flujo nuevo de pretest, **regístrate** con cualquier correo (se acepta Gmail).

## Variables de entorno

`.env` en la raíz (leído por docker-compose):

```
JWT_SECRET=...                 # secreto para firmar JWT
GEMINI_API_KEY=...             # opcional; sin ella ALEX usa respaldo. NUNCA se expone al cliente
GEMINI_MODEL=gemini-2.0-flash
AI_RATE_LIMIT_PER_HOUR=20
```

> **Seguridad:** la `GEMINI_API_KEY` solo vive en el backend. El frontend nunca la ve. Si la expusiste, **regénerala**.

## Desarrollo local (sin Docker)

```bash
# API
cd apps/api && npm install && npx prisma generate
cp .env.example .env           # DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, PISTON_URL
npx prisma db push && npm run seed && npm run dev   # :4000

# Web
cd apps/web && npm install && npm run dev           # :3000 (proxy /api → :4000)
```

> **Nota (Windows):** los watchers en contenedores a veces no detectan cambios del bind mount. Si editas el backend y no se refleja, `docker compose restart api`.

## Investigación (pretest/postest)

`GET /api/progreso/export.csv` (rol docente/admin) exporta por estudiante:
`puntaje_pretest, puntaje_postest, ganancia, tiempo, grupo (control/experimental)`
— para la prueba t de Student, que se realiza fuera del sistema.

## Mapa de la reescritura

| Fase | Entregable |
|---|---|
| R1–R2 | Scaffold NestJS + schema Prisma + auth |
| R3 | pretest + ejercicios + seed Python |
| R4 | Zona de Práctica + tutor-ia (Gemini) + sandbox Piston |
| R5 | gamificación, ranking, progreso, documentos, retos + export CSV |
| R6 | Frontend Next.js — 11 vistas del estudiante |
