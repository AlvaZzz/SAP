# Despliegue: frontend en Vercel + backend fuera de Vercel

Procedimiento repetible. Complementa a [DESPLIEGUE-VPS.md](DESPLIEGUE-VPS.md), que
describe el despliegue completo en un VPS con Docker Compose.

---

## 0. Por qué el backend NO va a Vercel (evaluado, no asumido)

Se revisó si el backend podría adaptarse a funciones serverless. **No puede**, y no
es cuestión de configuración sino de arquitectura:

| Bloqueo | Detalle |
|---|---|
| **Sandbox Piston** | `docker-compose.prod.yml` lo corre con `privileged: true` porque isolate necesita cgroups y namespaces propios. El runtime de Vercel no da contenedores privilegiados. Sin Piston no hay ejecución de código del estudiante. |
| **Postgres + Prisma** | Cada invocación serverless abre su propia conexión; sin un pooler externo se agota `max_connections`. Requiere Postgres persistente de todos modos. |
| **Warm-up con estado** | `PistonService.onModuleInit()` precarga el runtime de Python al arrancar. En serverless no hay "arranque" único. |
| **Rate limit en memoria** | El límite de login por IP y el de recuperación viven en un `Map` del proceso (`auth.controller.ts`). Con N lambdas cada una tendría su propio contador. **Ojo: esto también aplica a cualquier despliegue multi-instancia del backend** — ahí habría que moverlos a Redis. |
| **Streaming de ALVARO** | `tutor-ia` usa respuestas en streaming de larga duración. |

**Conclusión:** a Vercel va **solo `frontend/`**. Backend + Postgres + Piston van al
VPS (o a Railway/Render/Fly.io, que sí dan contenedores de larga vida).

---

## 1. Backend: URL HTTPS pública y estable

Opción A — **VPS con Docker Compose** (lo ya documentado):

```bash
docker compose -f docker-compose.prod.yml up -d
```

Caddy (`deploy/Caddyfile`) resuelve el HTTPS. El resultado debe ser una URL como
`https://api.tudominio.com` que responda:

```bash
curl -s https://api.tudominio.com/api/health
```

Opción B — servicio administrado (Railway / Render / Fly.io): desplegar
`backend/Dockerfile` + un Postgres gestionado + un servicio aparte para Piston.
Requisito: contenedores de larga duración y Postgres persistente.

---

## 2. Frontend en Vercel

1. **Importar el repo** en Vercel y fijar **Root Directory = `frontend`**.
   Framework: Next.js (autodetectado). Build: `npm run build`.
2. **Variable de entorno** (Project → Settings → Environment Variables):

   | Variable | Valor | Ámbito |
   |---|---|---|
   | `API_URL` | `https://api.tudominio.com` | Production (y Preview si tienes API de staging) |

   Es la que consume `frontend/next.config.js` en el rewrite
   `/api/:path* → ${API_URL}/api/:path*`. **Sin barra final.**

3. **No hace falta ninguna otra variable en Vercel.** En particular **`JWT_SECRET`
   NO va aquí**: el frontend nunca firma ni verifica tokens — eso ocurre solo en el
   backend. Poner el secreto en Vercel lo expondría sin ganar nada. (`frontend/`
   no tiene ningún `.env*` versionado.)

---

## 3. Cookies entre dominios: por qué NO hay que tocar `sameSite`

Es el punto que más confusión genera, así que conviene dejarlo explícito.

**El navegador nunca habla con el backend.** Habla siempre con el dominio de Vercel;
es el servidor de Vercel quien reenvía a la API por el rewrite:

```
navegador  ──►  https://prexi.vercel.app/api/auth/login   (mismo origen)
                          │  rewrite de Next
                          ▼
                https://api.tudominio.com/api/auth/login
```

Consecuencias:

- El `Set-Cookie` del backend vuelve por el proxy y el navegador lo guarda como
  cookie **de primera parte** del dominio de Vercel (no fijamos `Domain`).
- Por eso **`sameSite: 'strict'` sigue funcionando** y **no debe relajarse**:
  relajarlo a `lax`/`none` debilitaría la defensa CSRF descrita en
  [ARCHITECTURE.md](ARCHITECTURE.md) sin resolver ningún problema real.
- La cookie de refresh usa `path=/api/auth`, que coincide con la ruta que ve el
  navegador a través del rewrite.
- `secure` se activa solo con `NODE_ENV=production`: en Vercel siempre es HTTPS.

**Lo que sí hay que configurar en el BACKEND** (variables del contenedor `api`):

| Variable | Valor | Para qué |
|---|---|---|
| `CLIENT_ORIGIN` | `https://prexi.vercel.app` (o tu dominio propio) | CORS con `credentials: true` (`backend/src/main.ts`) |
| `APP_URL` | el mismo dominio de Vercel | Lo usa `OrigenGuard` para aceptar las mutaciones, y arma el enlace de recuperación de contraseña |
| `ORIGENES_PERMITIDOS` | *(opcional)* dominios extra separados por coma | Útil para admitir también las URLs de preview de Vercel |

> Si usas **deploy previews** de Vercel, cada una tiene su propio subdominio. O los
> añades a `ORIGENES_PERMITIDOS`, o apuntas las previews a una API de staging.

---

## 4. Prueba de extremo a extremo tras el deploy

Sustituye `WEB` por tu dominio de Vercel y ejecuta **en ese orden**:

```bash
WEB=https://prexi.vercel.app
# 1) El proxy /api llega al backend
curl -s $WEB/api/health
# 2) Login: debe devolver 201 y DOS Set-Cookie (prexi_token + prexi_refresh)
curl -s -i -c ck.txt -X POST $WEB/api/auth/login \
  -H 'Content-Type: application/json' -H "Origin: $WEB" \
  -d '{"email":"TU_CORREO","password":"TU_CLAVE"}' | grep -i set-cookie
# 3) Sesión viva con la cookie
curl -s -b ck.txt $WEB/api/auth/me
# 4) Refresh silencioso: 201 y cookie de refresh ROTADA
curl -s -i -b ck.txt -c ck.txt -X POST $WEB/api/auth/refresh -H "Origin: $WEB" | head -1
# 5) Piston (ejecución real de código del estudiante)
curl -s -b ck.txt -X POST $WEB/api/practica/ejecutar -H 'Content-Type: application/json' \
  -H "Origin: $WEB" -d '{"codigo":"print(2+3)","contexto":"libre"}'
# 6) Postest disponible
curl -s -b ck.txt $WEB/api/postest/disponibilidad
```

Qué debe verse: (2) `HttpOnly; SameSite=Strict` en ambas cookies · (4) `201` con un
valor de `prexi_refresh` distinto al anterior · (5) `stdout: "5"`.

En el navegador, además: entrar, esperar a que caduque el access token (15 min) y
comprobar que la sesión **no** salta a `/login` — el refresh silencioso de
`lib/api.ts` lo renueva solo.

### Si algo falla

| Síntoma | Causa habitual |
|---|---|
| `/api/*` da 404 en Vercel | `API_URL` mal puesta o con barra final |
| Login 201 pero `/auth/me` 401 | La cookie no se guardó: revisa que la llamada salga al dominio de Vercel y no directo a la API |
| 403 "Origen no permitido" | Falta `APP_URL`/`ORIGENES_PERMITIDOS` en el backend con el dominio de Vercel |
| Ejecutar código da 503 | Piston no está arriba o no corre `privileged` |

---

## 5. Checklist

- [ ] Backend en HTTPS estable y `/api/health` responde
- [ ] Vercel con Root Directory = `frontend`
- [ ] `API_URL` apuntando al backend (sin barra final)
- [ ] Backend con `CLIENT_ORIGIN` y `APP_URL` = dominio de Vercel
- [ ] `sameSite=strict` **sin tocar**
- [ ] Los 6 pasos de la sección 4 en verde
