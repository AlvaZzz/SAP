# Desplegar PREXI en producción — prexi.lat

Guía **única y vigente** de despliegue. Sustituye a `DEPLOY_VERCEL.md`,
`DESPLIEGUE-VPS.md` y `DESPLIEGUE_RENDER_VERCEL_NEON.md`, que fueron eliminados
porque se contradecían entre sí.

Todo con **planes gratuitos**. El único gasto es el dominio, ya adquirido en
Namecheap.

| Pieza | Plataforma | Dirección final |
|---|---|---|
| Frontend (Next.js) | **Vercel** | `https://prexi.lat` y `https://www.prexi.lat` |
| Backend (NestJS) | **Render** · Web Service | `https://api.prexi.lat` |
| PostgreSQL | **Neon** | (interna, no se publica) |
| DNS del dominio | **Namecheap** | — |

**No hace falta un VPS.** El Python del estudiante se ejecuta en su propio
navegador con Pyodide (`frontend/src/lib/python-runtime.ts`). Al desaparecer el
sandbox Piston desapareció el único componente que exigía un servidor propio con
contenedores privilegiados.

### Por qué el dominio se usa en las DOS puntas

Es la decisión más importante de todo el documento, y no es estética:

- Con `prexi.lat` (frontend) y `api.prexi.lat` (backend), ambos comparten el mismo
  dominio registrable. Las cookies de sesión `prexi_token` y `prexi_refresh` son
  **de primera parte** y `sameSite: 'strict'` sigue haciendo su trabajo.
- Con `*.vercel.app` + `*.onrender.com` serían sitios distintos a efectos del
  navegador y habría que **debilitar** la cookie a `sameSite: 'lax'` o `'none'`,
  que es exactamente la defensa CSRF que el sistema ya tiene construida.
- Y, sencillamente, `prexi.lat` en una defensa de tesis se ve mejor que
  `prexi-web-3f2a.vercel.app`.

> Aun así, el navegador **nunca** habla directamente con Render: `next.config.js`
> reenvía `/api/*` a `API_URL` desde el servidor de Vercel y
> [`lib/api.ts`](../frontend/src/lib/api.ts) siempre llama a rutas relativas. El
> dominio propio hace esa garantía **robusta** en lugar de depender del proxy.
> **Nunca pongas una URL absoluta del backend en el código del cliente.**

---

## 0. Antes de empezar

- El repositorio en GitHub.
- Tres cuentas gratuitas (todas admiten entrar con GitHub):
  <https://neon.com> · <https://render.com> · <https://vercel.com>
- Acceso al panel de Namecheap donde está `prexi.lat`.
- Una clave de Gemini (<https://aistudio.google.com/apikey>), gratuita.

**El orden importa**: Neon → Render → Namecheap (DNS) → Vercel → verificación.
Cada paso necesita un dato del anterior.

Calcula unas 2 horas la primera vez, de las cuales buena parte es esperar a que
propague el DNS.

---

## 1. Neon — la base de datos

1. **New Project**. Nombre: `prexi`. Región: la más cercana a la que usarás en
   Render (si Render va en Oregon, Neon en `US West`).
2. En **Connection Details** copia las **dos** cadenas y guárdalas en un bloc de
   notas; las necesitarás varias veces:

   | Cadena | Cómo se reconoce | Para qué |
   |---|---|---|
   | **Pooled** | el host contiene `-pooler` | `DATABASE_URL` — la que usa la app |
   | **Direct** | el host **no** contiene `-pooler` | `DIRECT_URL` — migraciones y seed |

3. Comprueba que ambas terminen en `?sslmode=require`. Si no, añádelo a mano.

**No crees tablas a mano.** El esquema lo aplican las migraciones versionadas de
`backend/prisma/migrations/`.

### 1.1 Aplicar el esquema

Desde tu PC, en la raíz del repo:

```bash
cd backend
DATABASE_URL='CADENA_DIRECTA' DIRECT_URL='CADENA_DIRECTA' npx prisma migrate deploy
```

`migrate deploy` aplica solo las migraciones pendientes y es idempotente.
**Nunca uses `prisma db push` contra producción**: reescribe el esquema sin
historial y puede borrar columnas con datos dentro.

### 1.2 Sembrar el contenido (UNA sola vez)

```bash
DATABASE_URL='CADENA_DIRECTA' DIRECT_URL='CADENA_DIRECTA' npm run seed
```

Usa la cadena **directa**, no la pooled. Para el plan oficial de la UPEA y los
bancos por unidad, ver los scripts de `backend/prisma/` (`plan-upea.ts`,
`seed-unidad.ts`).

El seed **no** corre en el arranque de Render, y es deliberado: Render reinicia el
servicio con frecuencia y volvería a sembrar una y otra vez.

### 1.3 Verificar

```bash
DATABASE_URL='CADENA_DIRECTA' npx prisma studio
```

Abre `http://localhost:5555` y comprueba que existan `usuarios`, `unidades`,
`temas` y `ejercicios` con datos. Prisma Studio es la herramienta de inspección
del proyecto; no se usa pgAdmin.

---

## 2. Render — el backend

El repo trae [`render.yaml`](../render.yaml) con todo configurado: en Render,
**New → Blueprint**, apunta al repositorio y detectará el servicio `prexi-api`.
Si prefieres crearlo a mano (**New → Web Service**):

| Campo | Valor |
|---|---|
| Type | Web Service · Runtime **Node** · Plan **Free** |
| Root Directory | `backend` |
| Build Command | `npm ci --include=dev && npx prisma generate && npm run build` |
| Start Command | `npx prisma migrate deploy && node dist/src/main.js` |
| Health Check Path | `/api/health` |

> **`--include=dev` es obligatorio.** Render define `NODE_ENV=production` y con esa
> variable `npm ci` omite las devDependencies — incluido `@nestjs/cli`, sin el cual
> `nest build` no existe y el build falla con `nest: not found`.

> **El seed NO va en el Start Command.** Solo `migrate deploy`, que es idempotente.

### 2.1 Variables de entorno

| Variable | Valor | Notas |
|---|---|---|
| `NODE_ENV` | `production` | **Imprescindible.** Es lo que activa `secure: true` en las cookies; sin esto no hay sesión sobre HTTPS |
| `DATABASE_URL` | cadena **pooled** de Neon | |
| `DIRECT_URL` | cadena **directa** de Neon | |
| `JWT_SECRET` | aleatorio y largo | `openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | `15m` | debe ir a la par de la cookie de acceso |
| `CLIENT_ORIGIN` | `https://prexi.lat,https://www.prexi.lat` | CORS. Admite **varios** separados por coma, sin barra final |
| `APP_URL` | `https://prexi.lat` | **Un solo valor.** Gobierna el OrigenGuard (CSRF) y los enlaces de recuperación de contraseña |
| `ORIGENES_PERMITIDOS` | `https://www.prexi.lat` | Orígenes extra que acepta el OrigenGuard. Déjalo **vacío** si haces que `www` redirija al dominio raíz (más estricto) |
| `GEMINI_API_KEY` | tu clave | |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | |
| `AI_RATE_LIMIT_PER_HOUR` | `20` | |
| `MAX_PDF_BYTES` | `15728640` | 15 MB. Ojo: los PDF viven **dentro** de Postgres |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | opcionales | Sin `SMTP_HOST`, el enlace de recuperación se escribe en los logs de Render en vez de enviarse |

> **El error más fácil de cometer:** dejar `APP_URL` con el valor de desarrollo.
> El `OrigenGuard` compara el `Origin` de **toda mutación** contra `APP_URL` (más
> `ORIGENES_PERMITIDOS`); si no coincide, todo POST/PUT/DELETE responde
> **403 "Origen no permitido"** y el login parece roto sin ninguna explicación.

> La rama del guard que acepta direcciones de red local (`192.168.x.x`, para
> probar desde el celular) **no se evalúa cuando `NODE_ENV=production`**. En
> producción solo valen `APP_URL` y `ORIGENES_PERMITIDOS`.

### 2.2 Dominio personalizado del API

En el servicio → **Settings → Custom Domains → Add Custom Domain**:

```
api.prexi.lat
```

Render mostrará entonces **el destino CNAME que debes crear en Namecheap**.
Anótalo tal cual: se usa en el paso 3. Quedará en estado *Pending* hasta que el
DNS propague; es normal.

---

## 3. Namecheap — el DNS

Entra en <https://ap.www.namecheap.com> → **Domain List** → botón **Manage** de
`prexi.lat` → pestaña **Advanced DNS**. Ahí está la tabla **Host Records**.

Necesitas **tres** registros:

| Host | Tipo | Valor | De dónde sale |
|---|---|---|---|
| `@` | el que indique Vercel (A o ALIAS/CNAME) | el que indique Vercel | Vercel → Project → Settings → Domains, al añadir `prexi.lat` |
| `www` | `CNAME` | el que indique Vercel | ídem |
| `api` | `CNAME` | el que indique Render | Render → Settings → Custom Domains, al añadir `api.prexi.lat` |

> **Copia los valores de la pantalla de cada plataforma, no de esta guía.**
> Vercel y Render cambian sus IP y sus destinos CNAME con el tiempo; un valor
> fijado aquí sería correcto hoy y silenciosamente incorrecto dentro de un año.
> Cada panel te muestra el registro exacto en el momento de añadir el dominio.

Detalles prácticos de Namecheap:

- Si el dominio es nuevo, Namecheap trae registros de ejemplo (un `CNAME` a
  `parkingpage.namecheap.com` y una redirección). **Bórralos**: si no, compiten
  con los tuyos.
- El campo **TTL** puede quedarse en `Automatic`.
- En Namecheap el host se escribe **sin el dominio**: `api`, no `api.prexi.lat`.
- Asegúrate de que **Nameservers** (pestaña *Domain*) esté en *Namecheap
  BasicDNS*. Si apunta a otro proveedor, los registros de *Advanced DNS* no se
  usan.

**La propagación tarda.** Suele bastar con 15–30 minutos, pero puede llegar a 48
horas. El certificado HTTPS lo emiten Vercel y Render **automáticamente y solo
después** de ver el DNS correcto: hasta entonces verás avisos de certificado
inválido. No es un error, es la espera.

Para comprobar el avance:

```bash
nslookup api.prexi.lat
nslookup www.prexi.lat
```

---

## 4. Vercel — el frontend

1. **Add New → Project** → importa el repositorio.
2. **Root Directory: `frontend`**. Next.js se autodetecta (build `npm run build`).
3. **Environment Variables**, una sola:

   | Variable | Valor |
   |---|---|
   | `API_URL` | `https://api.prexi.lat` — **sin barra final** |

   Si falta, el build **falla a propósito** con un mensaje explícito
   (`next.config.js`): sin ella el proxy apuntaría a `localhost:4000` dentro del
   contenedor de Vercel y la aplicación desplegada parecería viva pero ninguna
   petición funcionaría.

4. **Deploy**.
5. **Settings → Domains** → añade `prexi.lat` y `www.prexi.lat`. Vercel te dará
   los registros DNS del paso 3. Lo habitual y recomendable: dejar `prexi.lat`
   como principal y que `www` **redirija** a él (Vercel lo ofrece como opción al
   añadirlo). Así solo hay un origen real y `ORIGENES_PERMITIDOS` puede quedar
   vacío.
6. Vuelve a Render y confirma que `APP_URL` y `CLIENT_ORIGIN` tienen el dominio
   propio, **no** la URL `*.vercel.app`. Render redespliega solo al guardarlas.

---

## 5. Verificación final

### 5.1 Desde la terminal

```bash
WEB=https://prexi.lat

# 1) El API responde a través del proxy de Vercel
curl -s $WEB/api/health

# 2) El API también responde en su propio dominio
curl -s https://api.prexi.lat/api/health

# 3) Login: 201 y DOS Set-Cookie con HttpOnly; Secure; SameSite=Strict
curl -s -i -c ck.txt -X POST $WEB/api/auth/login \
  -H 'Content-Type: application/json' -H "Origin: $WEB" \
  -d '{"email":"TU_CORREO","password":"TU_CLAVE"}' | grep -i set-cookie

# 4) Sesión viva
curl -s -b ck.txt $WEB/api/auth/me

# 5) Refresh: 201 y un prexi_refresh DISTINTO al anterior (rotación)
curl -s -i -b ck.txt -c ck.txt -X POST $WEB/api/auth/refresh -H "Origin: $WEB" | head -1

# 6) Logout
curl -s -i -b ck.txt -X POST $WEB/api/auth/logout -H "Origin: $WEB" | head -1
```

### 5.2 En el navegador (la que de verdad cuenta)

Recórrela entera antes de dar el despliegue por bueno:

1. **Registro** con un correo cualquiera → debe entrar directo a la introducción.
2. **Login** con esa cuenta → llega al dashboard.
3. **Ejecutar Python** en un ejercicio o reto → el botón *Ejecutar* corre el
   código. La primera vez tarda unos segundos porque el navegador descarga
   Pyodide.
4. **Renovación silenciosa de sesión**: deja la pestaña abierta más de 15 minutos
   (el access token dura eso), vuelve y navega. **No** debe mandarte a `/login`:
   el refresh rotatorio renueva la sesión sola. Espera unos 20 minutos para estar
   seguro.
5. **Cuenta docente**: entra con un usuario de rol docente y comprueba que ves el
   panel docente y **no** el del estudiante.
6. **HTTPS**: candado verde en `prexi.lat` y en `api.prexi.lat`.

---

## 6. Problemas comunes

| Síntoma | Causa habitual |
|---|---|
| Build de Render falla con `nest: not found` | Falta `--include=dev` en el Build Command |
| Build de Vercel falla pidiendo `API_URL` | Es intencionado: define la variable con `https://api.prexi.lat` |
| `/api/*` responde 404 | `API_URL` mal escrita o con barra final |
| Login devuelve 201 pero `/auth/me` da 401 | La cookie no se guardó: `NODE_ENV` no vale `production` en Render, o alguna llamada del cliente va directa a Render en vez de por `/api` |
| **403 "Origen no permitido"** en cualquier POST | `APP_URL` no coincide con el origen desde el que navegas. Si entras por `www` y `APP_URL` es el apex, añade el `www` a `ORIGENES_PERMITIDOS` o redirige `www` al apex |
| Certificado inválido tras configurar el DNS | Todavía no propagó. Espera y recarga; el certificado se emite solo después |
| El dominio raíz muestra la página de "parking" de Namecheap | Quedaron los registros de ejemplo en *Advanced DNS*; bórralos |
| Los cambios de DNS "no se aplican" | Los *Nameservers* del dominio no son los de Namecheap, así que *Advanced DNS* se ignora |
| La primera visita del día tarda ~1 minuto | Arranque en frío de Render Free (ver §7) |
| *Ejecutar* no hace nada | La red bloquea `cdn.jsdelivr.net`, de donde se descarga Pyodide |
| Migración pendiente tras un despliegue | `migrate deploy` corre en el arranque; mira los logs de Render. Si falló, ejecútala desde tu PC con la cadena **directa** |

---

## 7. Límites de la capa gratuita — léelos antes de la defensa

Verificados en agosto de 2026. Conviene reconfirmarlos: estas condiciones cambian.

### Render Free
- El servicio **se suspende tras 15 minutos sin tráfico**; la siguiente petición
  lo despierta y tarda **cerca de un minuto**.
- 750 horas de instancia al mes por workspace.
- **Sin discos persistentes**; el sistema de archivos es efímero.

### Neon Free
- **0.5 GB** de almacenamiento. Si se supera, el proyecto **se suspende**.
- El cómputo baja a cero tras 5 minutos de inactividad.
- Recuperación por punto en el tiempo: **solo 6 horas**.

### Vercel Hobby
- Uso **no comercial**, 100 GB de ancho de banda al mes.

> ### ⚠️ El día de la defensa o de una sesión con estudiantes
> **Entra al sistema 5–10 minutos antes** y navega un poco. Render y Neon están
> dormidos y el primero en conectarse se come el arranque en frío: mira una
> pantalla en blanco durante un minuto y parece que el sistema no funciona.

### Qué implica esto para la investigación

1. **La ventana de 6 horas de Neon no protege tus datos.** Por eso el respaldo
   manual con `pg_dump` es obligatorio: uno al final de cada sesión con
   estudiantes. Ver [BASE_DE_DATOS.md](BASE_DE_DATOS.md).
2. **Los 0.5 GB los comparten los datos y los PDF**, porque los archivos se
   guardan dentro de la base (Render no tiene disco). Unos 30 PDF de 15 MB
   llenarían la cuota y Neon suspendería el proyecto en plena recolección de
   datos. Sube solo el material que realmente se use.
3. **El bloqueo por intentos de login vive en memoria** y se reinicia cada vez que
   Render suspende el servicio. En producción gratuita la protección contra fuerza
   bruta queda debilitada. Conviene saberlo por si lo preguntan en la defensa.

---

## 8. Cambios posteriores

- **Código**: `git push` a la rama principal. Vercel y Render redespliegan solos.
- **Esquema de base de datos**: genera la migración en desarrollo
  (`npx prisma migrate dev --name lo_que_cambia`), súbela al repo y el
  `migrate deploy` del arranque la aplicará. **Nunca `db push` contra Neon.**
- **Variables de entorno**: cambiarlas en Render fuerza un redespliegue; en Vercel
  hay que redesplegar a mano (Deployments → ⋯ → Redeploy).

---

## 9. El proceso de despliegue (obligatorio)

Este es el procedimiento. No es una recomendación: existe porque ya ocurrió lo
contrario —cuarenta archivos sin commitear mientras `main` llevaba días
congelada— y en producción se seguía viendo el sistema de la semana anterior.

### Los dos comandos

| Comando | Cuándo | Qué comprueba |
|---|---|---|
| `npm run validar` | **Antes** de fusionar | El CÓDIGO: tipos, lint, pruebas, e2e, auditoría, recursos, texto y entorno |
| `npm run smoke` | **Después** de desplegar | Lo DESPLEGADO: que responde de verdad, recorriendo el camino de un estudiante |

Son cosas distintas y hacen falta las dos. Un despliegue puede estar en verde en
validación y aun así servir errores 500 porque faltó una variable de entorno en
Render: eso solo lo ve el humo.

### La secuencia

```bash
git checkout -b feature/lo-que-sea    # 1. nunca se trabaja sobre main
npm run validar                       # 2. TIENE que salir en verde
git checkout main && git merge feature/lo-que-sea
git push                              # 3. Vercel y Render redespliegan solos
# 4. esperar a que ambos terminen (Vercel ~2 min · Render ~5 min en frío)
npm run smoke                         # 5. contra prexi.lat
```

`npm run validar` sale con código distinto de cero si algo falla **y también si
algún paso quedó sin ejecutar** (por ejemplo, sin base de datos local). Una
validación incompleta no es una validación: levanta el stack
(`docker compose up -d`) y repítela.

### Si el humo falla

No se arregla en caliente. Primero se vuelve a un estado bueno conocido:

- **Vercel** → Deployments → el despliegue anterior → **Instant Rollback**.
- **Render** → Events → el despliegue anterior → **Redeploy**.
- **Base de datos**: una migración ya aplicada **no** se revierte sola. Si el
  despliegue incluía una migración, revisa antes si el código anterior sigue
  funcionando contra el esquema nuevo.

Con producción ya estabilizada, se reproduce el fallo en local, se corrige en una
rama y se vuelve a empezar por el paso 1.

### Cuándo NO se despliega

- **Con estudiantes dentro.** Render tarda en reiniciar y Vercel cambia la versión
  servida a mitad de sesión: quien esté resolviendo un ejercicio pierde el intento.
  Se despliega fuera del horario de clase, y tras un despliegue se comprueba el
  humo antes de avisar a nadie.
- **El día de la defensa.** Ni ese día ni el anterior. El sistema que se defiende
  es el que lleva días funcionando, no el que se acaba de tocar. Si aparece un
  fallo grave la víspera, se decide entre convivir con él o revertir al último
  despliegue estable — nunca desplegar una corrección sin probar.
- **Sin respaldo reciente**, si el despliegue toca el esquema de la base. Ver
  [BASE_DE_DATOS.md](BASE_DE_DATOS.md).

### Qué comprueba `npm run validar`

| Paso | Por qué está |
|---|---|
| Integridad del texto (U+FFFD) | La pantalla de registro llegó a producción con 73 caracteres de reemplazo. Era UTF-8 válido y compilaba sin una queja |
| Recursos estáticos | `/python-logo.svg` daba 404 en cada visita al login: el archivo nunca existió y nada lo detectaba |
| Variables de entorno | Una variable ausente o con el valor de ejemplo no rompe la compilación, rompe el arranque |
| Tipos y lint (backend y frontend) | Lo de siempre |
| Pruebas unitarias | 500 pruebas |
| Pruebas end-to-end | Contra el stack local |
| Auditoría del contenido | Distribución del banco, gating por nivel, clave de respuestas repartida |

### Qué comprueba `npm run smoke`

Frontend y `/health` responden (con espera para el arranque en frío de Render),
registro, login con cookies, renovación de sesión, cargar y responder un
ejercicio, el tutor PREXI y cero 404 en los recursos estáticos.

Usa una cuenta desechable `smoke+<marca>@prexi.test` y la borra al terminar con
`backend/scripts/limpiar-smoke.ts` (hace falta `DATABASE_URL`; el sistema no
expone borrado duro de usuarios a propósito). Si no puede borrarla, lo dice con
el correo exacto en vez de dejar basura en silencio.

---

## 10. Despliegue de esta versión: los pasos de DATOS

Esta versión es distinta de un despliegue normal. Además del código trae tres
cambios que viven en la **base de datos** y que `git push` **no** aplica:
equilibrar la clave de respuestas, renombrar al tutor en el texto ya escrito y
retirar el residuo de demostración. Son de una sola vez: una vez hechos, los
despliegues vuelven a ser los de la sección 9.

> El orden importa. La clave de respuestas va **antes** de que entren
> estudiantes, porque reordena las opciones de 474 ejercicios: hacerlo con
> respuestas ya registradas las invalidaría (se guardan como letra, y esa letra
> pasaría a significar otra cosa).

### Nota sobre la shell

Los comandos de abajo van en **Bash** (Git Bash). Si usas **PowerShell**, dos
cosas de Bash NO existen ahí: el operador `&&` y el prefijo `VAR=valor comando`.
Para eso está `scripts/cargar-env.ps1`, que carga un `.env` en la sesión actual:

```powershell
. .\scripts\cargar-env.ps1 .env.neon
```

El **punto y el espacio del principio son obligatorios** (*dot-sourcing*): sin
ellos el script corre en una sesión hija y las variables se pierden. Al terminar
imprime a qué host apunta `DATABASE_URL` — la última oportunidad de darte cuenta
antes de escribir en producción.

Con las variables ya cargadas, cada comando queda en dos líneas:

```powershell
Push-Location backend; npx tsx scripts/auditoria-completa.ts; Pop-Location
```

### Preparación

Crea `.env.neon` en la raíz (lo ignora `.gitignore`, no puede subirse):

```bash
DATABASE_URL=postgresql://USUARIO:CLAVE@ep-XXXX-pooler.REGION.aws.neon.tech/DB?sslmode=require
DIRECT_URL=postgresql://USUARIO:CLAVE@ep-XXXX.REGION.aws.neon.tech/DB?sslmode=require
```

`DATABASE_URL` es la cadena **pooled** (el host lleva `-pooler`); `DIRECT_URL`
es la **directa**, y es la que usan las migraciones. Las dos con `sslmode=require`.

### Paso 1 — Mirar antes de tocar

Todos los scripts de datos son **simulación por defecto**: sin `--aplicar` no
escriben nada. Ejecútalos y lee la salida antes de seguir.

```bash
cd backend && set -a && . ../.env.neon && set +a && npx tsx scripts/auditoria-completa.ts
```

Las 12 reglas contra el contenido real. Compara con lo que sale en local: lo que
falle **solo** en producción es contenido real y hay que mirarlo caso por caso.

> **La regla 10 necesita ADEMÁS `E2E_API_URL`.** No se conforma con leer la base:
> registra un estudiante y ejercita el gating por HTTP, y por defecto apunta a
> `http://localhost:4000/api`. Si la base es Neon y la API es la local, el
> estudiante se crea en un sitio y se busca en el otro: la regla revienta con una
> violación de clave foránea que no tiene nada que ver con el contenido.
> Las dos puntas tienen que mirar al mismo entorno:
>
> ```bash
> cd backend && set -a && . ../.env.neon && set +a && E2E_API_URL=https://prexi.lat/api npx tsx scripts/auditoria-completa.ts
> ```

### Sembrar los bancos oficiales

`prisma/seed-unidad.ts --unidad N` carga el banco de `prisma/data/unidadN.json`
(15/10/5 por tema + 10 ítems de examen). Respalda antes, va en una transacción y
**nunca toca los bancos `pretest` y `postest`** — son los instrumentos del estudio.

Aborta si encuentra datos de estudiantes ligados a esa unidad; `--force` los
cascadea. Antes de forzar, mira QUÉ son con `scripts/quien-respondio.ts`.

Efecto secundario a tener presente: los temas que **no** aparecen en el JSON se
DESPUBLICAN. Al sembrar la Unidad 1 se despublicaron 1.5.1, 1.5.2, 1.7.1, 1.7.2,
1.9, 1.10 y 1.11 por no estar en el material oficial. No se borran: dejan de
verse.

### Paso 2 — Equilibrar la clave de respuestas

```bash
cd backend && set -a && . ../.env.neon && set +a && npm run clave:informe
cd backend && set -a && . ../.env.neon && set +a && npx tsx scripts/equilibrar-clave-bd.ts
```

La simulación dice cuántos ejercicios cambiarían y, sobre todo, **si hay
respuestas ya registradas** de cuentas que no son de demostración. Si las hay, el
script **aborta a propósito**: esa decisión es del investigador, no del script.
Solo cuando la simulación salga limpia:

```bash
cd backend && set -a && . ../.env.neon && set +a && npx tsx scripts/equilibrar-clave-bd.ts --aplicar
```

Es idempotente: volver a ejecutarlo no cambia nada. Verifica después que ninguna
posición supere el 30 % y que la regla 11 de la auditoría pase.

### Paso 3 — Renombrar al tutor en el texto guardado

```bash
cd backend && set -a && . ../.env.neon && set +a && npm run tutor:renombrar
```

Muestra el antes y el después de cada fila. Si es lo esperado:

```bash
cd backend && set -a && . ../.env.neon && set +a && npm run tutor:renombrar:aplicar
```

Nunca toca `usuarios.nombre` ni `usuarios.email`: ahí viven nombres de personas
reales y el titular del proyecto se llama Alvaro. La lista de columnas es blanca,
no negra.

### Paso 4 — Retirar el residuo de demostración

```bash
cd backend && set -a && . ../.env.neon && set +a && npx tsx scripts/limpiar-demo.ts
```

Si la salida cuadra, `--aplicar`. **Desactiva, no borra**: algunos de esos retos
tienen entregas de estudiantes.

### Paso 5 — Desplegar el código

Ya en la secuencia normal de la sección 9. La migración
`20260820120000_minimos_practica_por_nivel` la aplica sola el Start Command de
Render (`npx prisma migrate deploy`), no hay que hacer nada.

### Paso 6 — Comprobaciones de producción que no son de código

- **`JWT_SECRET` en Render**: si mide menos de 32 caracteres, cámbialo
  (`openssl rand -base64 48`). Cambiarlo cierra todas las sesiones abiertas, así
  que hazlo sin estudiantes dentro.
- **Rotar la clave de Gemini** si estuvo expuesta. La cuota por minuto es el
  recurso escaso del sistema.
- `npm run verificar:entorno -- --produccion` con `.env.neon` cargado comprueba
  formato y que no sobreviva ningún valor de ejemplo.
