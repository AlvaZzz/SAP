# PREXI UPEA

Sistema adaptativo con **Inteligencia Artificial (PREXI/Gemini)** y **gamificación** para aprender **programación en Python** — UPEA, Ingeniería de Sistemas.

> Sistema **adaptativo por un motor de reglas determinístico**; la IA (PREXI, sobre Google Gemini) es de **apoyo** (explica, guía y acompaña), nunca decide calificación, adaptatividad ni desbloqueo. Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | **Next.js 14** (App Router) + TailwindCSS + CodeMirror 6 |
| Backend | **NestJS** (Screaming Architecture) + TypeScript |
| ORM / BD | **Prisma** + PostgreSQL |
| Auth | JWT en **cookie httpOnly** + bcrypt |
| IA | **Google Gemini** (variante Flash, `gemini-3.5-flash-lite`), solo en el backend |
| Ejecución de código | **Pyodide** en el navegador del estudiante (CPython compilado a WebAssembly) |

Backend y frontend **completamente separados**: [`backend/`](backend) (NestJS) y [`frontend/`](frontend) (Next.js).

## Arquitectura (Screaming Architecture)

El backend se organiza **por dominio**, no por capas técnicas. Cada módulo NestJS tiene su controller, service y DTOs:

```
backend/src/
  auth/          estudiantes (en auth)   pretest/       ejercicios/
  practica/      tutor-ia/               documentos/    retos/
  ranking/       progreso/               gamificacion/  common/ (prisma, guards)
```

Regla clave: **toda** decisión (corrección de respuestas, XP, desbloqueo de nivel, ranking) se calcula en el backend. El frontend solo muestra.

El código del estudiante **nunca** se ejecuta en el backend: corre en **su propio navegador** con [Pyodide](https://pyodide.org) (CPython compilado a WebAssembly), dentro de un *web worker* aislado del hilo principal ([`python-runtime.ts`](frontend/src/lib/python-runtime.ts) + [`pyodide-worker.js`](frontend/public/pyodide-worker.js)). El servidor nunca recibe ni ejecuta código de terceros, así que no hace falta ningún sandbox privilegiado — y por eso PREXI puede desplegarse en plataformas gestionadas gratuitas (Render/Vercel/Neon) en lugar de exigir un VPS.

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

> El puerto **5433** evita chocar con un PostgreSQL local en el 5432.

El contenedor `api` aplica las **migraciones versionadas** (`prisma migrate deploy`, carpeta [`backend/prisma/migrations/`](backend/prisma/migrations)) y **siembra el contenido Python** solo si la BD está vacía. La primera ejecución de código en el navegador descarga Pyodide (unos segundos, una sola vez por sesión).

### Cuentas demo (clave `Prexi123*`)
`juan@upea.edu.bo` (estudiante) · `docente@upea.edu.bo` · `admin@upea.edu.bo`

Para probar el flujo nuevo de pretest, **regístrate** con cualquier correo (se acepta Gmail).

## Variables de entorno

`.env` en la raíz (leído por docker-compose):

```
JWT_SECRET=...                 # secreto para firmar JWT
GEMINI_API_KEY=...             # opcional; sin ella PREXI queda deshabilitado. NUNCA se expone al cliente
GEMINI_MODEL=gemini-3.5-flash-lite
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
cp .env.example .env           # DATABASE_URL, DIRECT_URL, JWT_SECRET, GEMINI_API_KEY
npx prisma migrate deploy && npm run seed && npm run dev   # :4000

# Frontend
cd frontend && npm install && npm run dev           # :3000 (proxy /api → :4000)
```

> **Nota (Windows):** los watchers en contenedores a veces no detectan cambios del bind mount. Si editas el backend y no se refleja, `docker compose restart api`.

## Investigación (diseño no experimental transversal)

PREXI es también el objeto de estudio de la tesis: sin manipular variables ni comparar
grupos, al final del período de uso se evalúa **si el sistema funciona bien**.

| Variable | Indicador | De dónde sale |
|---|---|---|
| Precisión del motor adaptativo | % de asignaciones dentro del rango objetivo (IC 95 % por bootstrap) y latencia de reajuste | `LogAdaptacion` |
| Usabilidad percibida | Puntaje medio SUS (0–100) | `RespuestaInstrumento` (estudiantes) |
| Calidad del producto de software | Media por característica ISO/IEC 25010 y % de subcaracterísticas en nivel aceptable | `RespuestaInstrumento` (docentes y evaluadores) |

El rol investigador los muestra en **Validación del sistema** (`/investigador/validacion`),
junto a la tabla de criterios de aceptación, y exporta un CSV anonimizado por instrumento
(`log_adaptacion`, `sus`, `iso25010`, `uso_gamificacion`) para analizar con Python, Pandas y
SciPy. El pretest es solo el **diagnóstico inicial** (ubica el nivel de partida); la
evaluación de cierre es el **examen de cada unidad**. Detalle y fórmulas en
[docs/DISENO_INVESTIGACION.md](docs/DISENO_INVESTIGACION.md).

### Reglas de avance

Toda evaluación tiene 10 preguntas, vale 100 puntos y se aprueba con 80. Cada tema necesita
10 ejercicios por nivel; cada unidad cierra con un examen cuyas preguntas combinan 2 o 3
temas, y la unidad siguiente solo se abre al aprobarlo. El docente arma todo el contenido
desde una sola pantalla (**Unidades**) y registra a sus estudiantes subiendo su lista de
Excel. Ver [docs/REGLAS_DE_AVANCE.md](docs/REGLAS_DE_AVANCE.md).

## Mapa de la reescritura

| Fase | Entregable |
|---|---|
| R1–R2 | Scaffold NestJS + schema Prisma + auth |
| R3 | pretest + ejercicios + seed Python |
| R4 | Zona de Práctica + tutor-ia (Gemini) + ejecución de Python |
| R5 | gamificación, ranking, progreso, documentos, retos + export CSV |
| R6 | Frontend Next.js — 11 vistas del estudiante |

## Pruebas

```bash
cd backend
npm test          # pruebas unitarias (services críticos, estadística y guards, sin BD)
npm run test:e2e  # pruebas e2e del flujo de la tesis (requiere: docker compose up -d)
```

- **Unitarias**: puntaje del diagnóstico y de la evaluación final, XP y penalización por pistas, racha, desbloqueo de nivel, ranking, guards de los 4 roles, login/bloqueo de cuenta, tutor IA (PREXI), recuperación de contraseña, y los indicadores de la tesis: rango objetivo y latencia del motor adaptativo, puntaje SUS, calidad ISO/IEC 25010, bootstrap y criterios de aceptación.
- **E2E** (contra el stack real): registro → pretest → ejercicios → evaluación final → docente/investigador → CSV, más casos límite (doble envío, sesión sin token, examen sin iniciar, revisión bloqueada durante el examen).

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
| `GEMINI_API_KEY` | clave real de Google AI Studio (sin ella, PREXI queda deshabilitado) |
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

**Producción:** el despliegue real no usa Docker. Va a Vercel (frontend) + Render (backend) + Neon (PostgreSQL), bajo el dominio propio `prexi.lat`. El procedimiento completo, paso a paso, está en **[docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)**.

### 5. Lista de verificación de seguridad

- ✅ Contraseñas con **bcrypt** (nunca en texto plano) y bloqueo tras 5 intentos fallidos.
- ✅ JWT en **cookie httpOnly** (`secure` en producción, `SameSite=Strict`), con refresh rotatorio y verificación de `Origin` en las mutaciones (`OrigenGuard`).
- ✅ **Guards de rol** en todas las rutas; validación de DTOs global (`whitelist + forbidNonWhitelisted`).
- ✅ Rate limit del tutor IA por usuario/hora (`AiRateLimitGuard`, configurable por el admin).
- ✅ Errores no controlados: log interno completo, **sin stack traces al cliente**.
- ✅ Revisión de pretest/postest bloqueada hasta finalizar el examen (no expone respuestas).
- ✅ Subida de archivos restringida a PDF y validada en el servidor.
- ✅ El código del estudiante NUNCA llega al servidor: se ejecuta en su navegador (Pyodide), en un worker aislado y bajo el sandbox del propio navegador.
