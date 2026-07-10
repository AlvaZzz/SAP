# PREXI UPEA

Sistema adaptativo con **Inteligencia Artificial (ALVARO/Gemini)** y **gamificación** para aprender **programación en Python** — UPEA, Ingeniería de Sistemas.

> Sistema **adaptativo por un motor de reglas determinístico**; la IA (ALVARO, sobre Google Gemini) es de **apoyo** (explica, guía y acompaña), nunca decide calificación, adaptatividad ni desbloqueo. Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | **Next.js 14** (App Router) + TailwindCSS + CodeMirror 6 |
| Backend | **NestJS** (Screaming Architecture) + TypeScript |
| ORM / BD | **Prisma** + PostgreSQL |
| Auth | JWT en **cookie httpOnly** + bcrypt |
| IA | **Google Gemini** (variante Flash, `gemini-2.5-flash-lite`), solo en el backend |
| Sandbox de código | **Piston** self-hosted (ejecuta el Python del estudiante aislado) |

Backend y frontend **completamente separados**: [`backend/`](backend) (NestJS) y [`frontend/`](frontend) (Next.js).

## Arquitectura (Screaming Architecture)

El backend se organiza **por dominio**, no por capas técnicas. Cada módulo NestJS tiene su controller, service y DTOs:

```
backend/src/
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
GEMINI_API_KEY=...             # opcional; sin ella ALVARO queda deshabilitado. NUNCA se expone al cliente
GEMINI_MODEL=gemini-2.5-flash-lite
AI_RATE_LIMIT_PER_HOUR=20

# Recuperación de contraseña / correo (opcional; ver backend/.env.example)
APP_URL=http://localhost:3000  # base del enlace de restablecimiento
SMTP_HOST=                     # vacío → el enlace se imprime en los logs (dev)
```

> **Seguridad:** la `GEMINI_API_KEY` solo vive en el backend. El frontend nunca la ve. Si la expusiste, **regénerala**.
>
> **Correo:** si `SMTP_HOST` está vacío, el flujo de "recuperar contraseña" imprime el enlace en los logs del backend (útil en desarrollo). Para envío real: `npm i nodemailer` y completar las variables `SMTP_*` (documentadas en [`backend/.env.example`](backend/.env.example)).

## Desarrollo local (sin Docker)

```bash
# Backend
cd backend && npm install && npx prisma generate
cp .env.example .env           # DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, PISTON_URL
npx prisma db push && npm run seed && npm run dev   # :4000

# Frontend
cd frontend && npm install && npm run dev           # :3000 (proxy /api → :4000)
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

## Pruebas

```bash
cd backend
npm test          # 93 pruebas unitarias (services críticos y guards, sin BD)
npm run test:e2e  # pruebas e2e del flujo de la tesis (requiere: docker compose up -d)
```

- **Unitarias**: puntaje pretest/postest, ganancia, XP y penalización por pistas, racha, desbloqueo de nivel, ranking, guards de los 4 roles, login/bloqueo de cuenta, asignación de grupos, tutor IA (ALVARO) y recuperación de contraseña.
- **E2E** (contra el stack real): registro → pretest → ejercicios → postest → docente/investigador → CSV, más casos límite (doble envío, sesión sin token, examen sin iniciar, revisión bloqueada durante el examen).

El detalle está en [docs/REPORTE_PRUEBAS.md](docs/REPORTE_PRUEBAS.md).

## Calidad de código

El proyecto usa **TypeScript estricto** como primera línea de correctitud, más **ESLint** y **Prettier** (config compartida en la raíz: [`.prettierrc.json`](.prettierrc.json), [`.editorconfig`](.editorconfig)).

```bash
# En backend/ o frontend/:
npm run typecheck     # tsc --noEmit (tipado estricto)
npm run lint          # ESLint (backend: @typescript-eslint · frontend: next lint)
npm run format:check  # Prettier: verifica formato sin escribir
npm run format        # Prettier: aplica formato
```

## Despliegue a producción

### 1. Variables de entorno

```bash
cp backend/.env.example backend/.env      # editar TODOS los valores
cp frontend/.env.example frontend/.env
```

Obligatorio en producción:

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` (activa `secure` en la cookie del JWT → requiere HTTPS) |
| `JWT_SECRET` | secreto largo y aleatorio (`openssl rand -base64 48`) |
| `DATABASE_URL` | PostgreSQL de producción |
| `GEMINI_API_KEY` | clave real de Google AI Studio (sin ella, ALVARO queda deshabilitado) |
| `CLIENT_ORIGIN` | URL pública del frontend (CORS) |
| `API_URL` (frontend) | URL interna del API para el proxy `/api` |

### 2. Base de datos

```bash
cd backend
npx prisma migrate deploy   # o: npm run prisma:push (primer despliegue sin migraciones)
npm run seed                # carga niveles, 69 ejercicios y bancos pretest/postest
```

> El seed es idempotente sobre una BD vacía. En producción NO crea usuarios demo si se desea partir limpio: revisar `prisma/seed.ts` y eliminar el bloque de usuarios demo, o desactivar esas cuentas desde el panel admin.

### 3. Primer administrador

```bash
cd backend
npm run crear-admin -- --nombre "Nombre Apellido" --email admin@dominio.bo --password "ClaveSegura123*"
```

Desde el panel admin (`/admin/usuarios`) ese usuario crea a los docentes e investigadores.

### 4. Build y arranque

```bash
# Backend
cd backend && npm ci && npm run build && npm run start:prod   # sirve en :4000

# Frontend
cd frontend && npm ci && npm run build && npm start           # sirve en :3000
```

Con Docker: `docker compose up -d --build` (ajustando en `docker-compose.yml` `NODE_ENV=production`, el `JWT_SECRET` y quitando los bind mounts de desarrollo).

### 5. Lista de verificación de seguridad

- ✅ Contraseñas con **bcrypt** (nunca en texto plano) y bloqueo tras 5 intentos fallidos.
- ✅ JWT en **cookie httpOnly** (`secure` en producción, `SameSite=Lax`).
- ✅ **Guards de rol** en todas las rutas; validación de DTOs global (`whitelist + forbidNonWhitelisted`).
- ✅ Rate limit del tutor IA por usuario/hora (`AiRateLimitGuard`, configurable por el admin).
- ✅ Errores no controlados: log interno completo, **sin stack traces al cliente**.
- ✅ Revisión de pretest/postest bloqueada hasta finalizar el examen (no expone respuestas).
- ✅ Subida de archivos restringida a PDF y validada en el servidor.
- ✅ El código del estudiante se ejecuta SOLO en el sandbox Piston aislado.
