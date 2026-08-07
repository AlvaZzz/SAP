# Desplegar PREXI en Render + Vercel + Neon (sin VPS, sin pagar)

Guía vigente de despliegue. Tres plataformas con capa gratuita, ninguna tarjeta.

| Pieza | Plataforma | Por qué ahí |
|---|---|---|
| Frontend (Next.js) | **Vercel** | Es el hosting nativo de Next.js |
| Backend (NestJS) | **Render** (Web Service) | Necesita un proceso de larga vida: streaming de ALVARO y conexiones Prisma persistentes |
| PostgreSQL | **Neon** | Postgres gestionado con capa gratuita real |

**Por qué ya no hace falta un VPS:** el Python del estudiante corre en su
navegador con Pyodide, no en el servidor. Al desaparecer el sandbox Piston
(`privileged: true`) desapareció el único componente que exigía un servidor propio.

---

## 0. Antes de empezar

Necesitas crear tres cuentas (todas admiten login con GitHub) y tener el repo en
GitHub:

- <https://neon.com> · <https://render.com> · <https://vercel.com>

El orden importa: **Neon → Render → Vercel**, porque cada uno necesita la URL del
anterior.

---

## 1. Neon (base de datos)

1. Crea un proyecto. Región: la más cercana a la que usarás en Render.
2. En **Connection Details** copia las **dos** cadenas:
   - **Pooled connection** (el host contiene `-pooler`) → será `DATABASE_URL`
   - **Direct connection** (sin `-pooler`) → será `DIRECT_URL`
3. Verifica que ambas terminen en `?sslmode=require`.

No hay nada más que configurar. **No crees tablas a mano:** las crea
`prisma migrate deploy` en el primer arranque de Render.

---

## 2. Render (backend)

El repo trae [`render.yaml`](../render.yaml): en Render, **New → Blueprint**,
apunta al repo y detectará el servicio `prexi-api` con todos los comandos ya
puestos. Si prefieres crearlo a mano, estos son los valores:

| Campo | Valor |
|---|---|
| Type | Web Service · Runtime **Node** · Plan **Free** |
| Root Directory | `backend` |
| Build Command | `npm ci --include=dev && npx prisma generate && npm run build` |
| Start Command | `npx prisma migrate deploy && node dist/src/main.js` |
| Health Check Path | `/api/health` |

> **`--include=dev` es obligatorio.** Render define `NODE_ENV=production`, y con
> esa variable `npm ci` omite las devDependencies — incluido `@nestjs/cli`, sin el
> cual `nest build` no existe y el build falla con "nest: not found".

### Variables de entorno en Render

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` — **imprescindible**: es lo que activa `secure: true` en las cookies. Sin esto no hay sesión sobre HTTPS |
| `DATABASE_URL` | Cadena **pooled** de Neon |
| `DIRECT_URL` | Cadena **directa** de Neon |
| `JWT_SECRET` | Genera uno largo y aleatorio (`openssl rand -base64 48`) |
| `JWT_EXPIRES_IN` | `15m` |
| `CLIENT_ORIGIN` | URL de Vercel, sin barra final (CORS) |
| `APP_URL` | URL de Vercel, sin barra final (**OrigenGuard** + enlaces de recuperación) |
| `GEMINI_API_KEY` | Tu clave de Gemini |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` |
| `AI_RATE_LIMIT_PER_HOUR` | `20` |
| `MAX_PDF_BYTES` | `15728640` |
| `SMTP_*`, `MAIL_FROM` | Solo si quieres correo real de recuperación. Vacío = el enlace se escribe en los logs de Render |

> **El error más fácil de cometer:** dejar `APP_URL` con el valor de desarrollo.
> El `OrigenGuard` compara el `Origin` de toda mutación contra `APP_URL`, así que
> si no coincide con el dominio de Vercel **todo POST/PUT/DELETE responde 403
> "Origen no permitido"** — el login parecerá roto sin explicación.

`CLIENT_ORIGIN` y `APP_URL` los sabrás recién tras el paso 3: despliega Render
primero con un valor provisional y actualízalos después (Render redespliega solo).

---

## 3. Vercel (frontend)

1. **Import Project** → el repo → **Root Directory: `frontend`**. Next.js se
   autodetecta.
2. Una sola variable de entorno:

   | Variable | Valor |
   |---|---|
   | `API_URL` | La URL de Render, p. ej. `https://prexi-api.onrender.com` — **sin barra final** |

3. Deploy. Copia la URL resultante y vuelve a Render a poner `CLIENT_ORIGIN` y
   `APP_URL` con ese valor exacto.

### Por qué la sesión funciona aunque sean dominios distintos

Las cookies (`prexi_token`, `prexi_refresh`) usan `sameSite: 'strict'`, que en
principio impide que viajen entre sitios distintos. Funcionan igualmente porque
**el navegador nunca habla con Render**: `next.config.js` reenvía `/api/*` hacia
`API_URL` desde el servidor de Vercel, y [`lib/api.ts`](../frontend/src/lib/api.ts)
siempre llama a rutas relativas. Para el navegador todo ocurre en su propio
dominio, así que las cookies son de primera parte y la defensa CSRF sigue intacta.

**Consecuencia práctica:** nunca introduzcas una URL absoluta del backend en el
código del cliente. Rompería la sesión de inmediato.

---

## 4. Sembrar la base (una sola vez)

El seed **no** corre en el arranque, a propósito: Render reinicia el servicio con
frecuencia y sembraría una y otra vez. Render Free tampoco da acceso a shell, así
que se ejecuta **desde tu PC** apuntando a Neon:

```bash
cd backend
DATABASE_URL='CADENA_DIRECTA_DE_NEON' DIRECT_URL='CADENA_DIRECTA_DE_NEON' npm run seed
```

Usa la cadena **directa**, no la pooled. Para el plan oficial de la UPEA y los
bancos por unidad, ver los scripts de `backend/prisma/`.

---

## 5. Comprobación tras desplegar

```bash
WEB=https://TU-APP.vercel.app

# 1) El API responde a través del proxy de Vercel
curl -s $WEB/api/health

# 2) Login: 201 y DOS Set-Cookie con HttpOnly; Secure; SameSite=Strict
curl -s -i -c ck.txt -X POST $WEB/api/auth/login \
  -H 'Content-Type: application/json' -H "Origin: $WEB" \
  -d '{"email":"TU_CORREO","password":"TU_CLAVE"}' | grep -i set-cookie

# 3) Sesión viva
curl -s -b ck.txt $WEB/api/auth/me

# 4) Refresh: 201 y un prexi_refresh DISTINTO al anterior (rotación)
curl -s -i -b ck.txt -c ck.txt -X POST $WEB/api/auth/refresh -H "Origin: $WEB" | head -1

# 5) Logout
curl -s -i -b ck.txt -X POST $WEB/api/auth/logout -H "Origin: $WEB" | head -1
```

En el navegador, además: entra, deja pasar los 15 minutos del access token y
comprueba que **no** te manda a `/login` — el refresh silencioso lo renueva solo.
Y abre un reto para confirmar que "Ejecutar" corre el código (Pyodide se descarga
la primera vez, tarda unos segundos).

### Si algo falla

| Síntoma | Causa habitual |
|---|---|
| Build falla con `nest: not found` | Falta `--include=dev` en el Build Command |
| `/api/*` da 404 | `API_URL` mal escrita en Vercel o con barra final |
| Login 201 pero `/auth/me` 401 | La cookie no se guardó: `NODE_ENV` no es `production`, o alguna llamada va directa a Render en vez de por `/api` |
| 403 "Origen no permitido" | `APP_URL` en Render no coincide con el dominio de Vercel |
| La primera visita tarda ~1 min | Arranque en frío de Render Free (ver abajo) |
| "Ejecutar" no hace nada | La red bloquea `cdn.jsdelivr.net`, de donde se descarga Pyodide |

---

## 6. Limitaciones de la capa gratuita (léelas antes de la defensa)

Verificadas en agosto de 2026. Conviene reconfirmarlas: estas condiciones cambian.

### Render Free
- El servicio **se suspende tras 15 minutos sin tráfico**; la siguiente petición
  lo despierta y tarda **cerca de un minuto**.
- 750 horas de instancia al mes por workspace.
- **Sin discos persistentes**, filesystem efímero.

> **El día de la defensa o de una sesión con estudiantes: entra 5 minutos antes**
> para despertarlo. Si no, el primero en conectarse mira una pantalla en blanco
> durante un minuto y parece que el sistema no funciona.

### Neon Free
- **0.5 GB** de almacenamiento. Si se supera, el proyecto **se suspende**.
- El cómputo baja a cero tras 5 minutos de inactividad (suma latencia al primer acceso).
- **Recuperación por punto en el tiempo: solo 6 horas.**

### Vercel Hobby
- Uso **no comercial**, 100 GB de ancho de banda al mes.

### Qué implica esto para la investigación

Tres puntos que conviene tener claros, en vez de descubrirlos tarde:

1. **La ventana de 6 horas de Neon no protege tus datos.** Es el motivo por el que
   el respaldo manual con `pg_dump` es obligatorio: haz uno al final de cada sesión
   con estudiantes. Ver [BASE_DE_DATOS.md](BASE_DE_DATOS.md).
2. **Los 0.5 GB los comparten los datos y los PDF**, porque los archivos se guardan
   dentro de la base (Render no tiene disco). Unos 30 PDF de 15 MB llenarían la
   cuota y Neon suspendería el proyecto en plena recolección de datos. Vigila el
   tamaño y sube solo el material que realmente se use.
3. **El bloqueo por intentos de login vive en memoria** y se reinicia cada vez que
   Render suspende el servicio. En producción gratuita la protección contra fuerza
   bruta queda debilitada. Vale la pena saberlo por si te lo preguntan en la defensa.
