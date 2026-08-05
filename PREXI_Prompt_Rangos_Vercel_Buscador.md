# PREXI — Prompt maestro: pantalla de Rangos, despliegue en Vercel y buscador funcional

Prompt reutilizable. Pégalo completo en Claude Code desde la raíz del repo (`backend/` + `frontend/`), con el proyecto corriendo localmente para poder verificar cada parte antes de darla por cerrada.

---

## PROMPT (copiar tal cual)

Trabajas sobre **PREXI** (Next.js 14 + TailwindCSS en frontend, NestJS + Prisma + PostgreSQL en backend). Esta tarea tiene tres partes independientes; complétalas en orden y no mezcles los cambios de una con otra en el mismo commit.

### Parte 1 — Pantalla de Rangos (visible, con estética por niveles/colores tipo Clash of Clans / Mobile Legends, con tema de programación)

**Contexto real que ya existe (no lo dupliques, reutilízalo):**
- El catálogo de 6 rangos ya está definido en `backend/src/gamificacion/catalogo.ts` (`RANGOS`): Aprendiz → Junior → Semi-Senior → Senior → Arquitecto → Maestro del Código, cada uno con `umbral` (0-100), `svgKey` (`escudo_1`..`escudo_6`) y `color` propio.
- El backend ya expone `GET /gamificacion/rangos/catalogo` (los 6 rangos, para pintar la escalera completa) y `GET /gamificacion/rangos` (el progreso REAL del estudiante: rango actual por unidad + rango global + cuánto falta para el siguiente, vía `RangosService.resumen`). No inventes un endpoint nuevo si estos ya alcanzan.
- El componente `frontend/src/components/rango-icon.tsx` ya dibuja un escudo SVG original (sin copiar assets con copyright) que escala en detalle según el nivel (laureles desde el rango 4, corona en el rango 6). Se usa hoy en dashboard, progreso y el toast de logro — pero en ningún lado se ve la ESCALERA COMPLETA de los 6 rangos a la vez.

**Qué construir:**
1. Una sección/pantalla donde el estudiante vea LOS 6 RANGOS EN FILA O GRILLA (la "escalera" completa), no solo el suyo — como el árbol de ligas de un juego. Usa `GET /gamificacion/rangos/catalogo` para los 6 y `GET /gamificacion/rangos` para saber cuál tiene alcanzado y cuánto le falta para el siguiente.
2. Mejora visualmente `RangoIcon` (o créale una variante) para que la diferencia entre niveles se sienta como en Clash of Clans / Mobile Legends: más color y "peso" visual a medida que sube el rango (ej. más brillo/glow, gradiente más rico, marco o fondo distinto por tramo), pero **sin salirte del tema de programación** de PREXI (nada de espadas/dragones genéricos de fantasía: mantén el lenguaje visual de escudos/insignias de "desarrollador" que ya existe — puedes apoyarte en iconografía de código: `< >`, llaves `{ }`, terminal, circuitos, según el nivel).
3. Los rangos NO alcanzados aún deben verse claramente distintos de los alcanzados (ej. en escala de grises / semitransparentes / con un candado), para que la progresión se perciba como una meta, no como una lista plana.
4. Muestra el rango actual del estudiante resaltado (borde/glow) y, si no es el máximo, cuánto puntaje le falta para el siguiente (ese dato ya viene en `siguiente.faltan` de `GET /gamificacion/rangos`).
5. Debe verse bien en PC y en celular (grilla que colapse, sin scroll horizontal).

**Dónde ubicarla:** decide el lugar más natural dentro de la navegación existente del estudiante (`/progreso` ya muestra el rango — puede ser una sección ahí, o una pantalla propia enlazada desde ese apartado). No agregues un ítem nuevo al menú principal si no es imprescindible; si lo hace falta, usa el mismo patrón de `NAV_ESTUDIANTE` en `frontend/src/components/shell.tsx`.

**Qué NO hacer:** no cambies el cálculo de rangos (`RangosService`, `catalogo()`, umbrales) — es lógica de negocio ya validada; esta tarea es de presentación. No uses ni references marcas ni assets de ningún juego real.

### Parte 2 — Prompt/guía para desplegar en Vercel

Antes de escribir pasos, ten clara la arquitectura real (no la fuerces a Vercel completa): el proyecto es **dos apps separadas** — `frontend/` (Next.js, esto SÍ es ideal para Vercel) y `backend/` (NestJS + PostgreSQL + sandbox Piston con `privileged: true`, que NO corre en el runtime serverless de Vercel). Hoy el despliegue real documentado es un VPS con Docker Compose (`docker-compose.prod.yml` + Caddy para HTTPS), ver `deploy/Caddyfile`.

Con eso claro, prepara y documenta (como un procedimiento repetible, no solo lo hagas una vez):

1. **Backend, base de datos y Piston se quedan fuera de Vercel.** Despliégalos donde ya están pensados para correr (el VPS con `docker-compose.prod.yml`) o, si se prefiere un servicio administrado, en algo con contenedores de larga duración y Postgres persistente (Railway, Render, Fly.io). El resultado debe ser una URL HTTPS pública y estable de la API (ej. `https://api.tudominio.com`).
2. **Frontend a Vercel:**
   - Conecta el repo en Vercel apuntando el "Root Directory" del proyecto a `frontend/`.
   - Configura la variable de entorno `API_URL` (la que usa `frontend/next.config.js` en el rewrite `/api/:path* → ${API_URL}/api/:path*`) con la URL pública del backend del paso 1.
   - Revisa que el backend tenga `CLIENT_ORIGIN` apuntando al dominio real de Vercel (CORS con `credentials: true`) y que la cookie httpOnly siga funcionando entre dominios distintos (frontend en `*.vercel.app`/dominio propio, backend en otro dominio) — si Vercel y el backend NO comparten el mismo dominio raíz, evalúa si hace falta mover el rewrite a un dominio común o ajustar `sameSite`/`secure` de las cookies (`AUTH_COOKIE`, `prexi_refresh`) para que sigan viajando correctamente entre orígenes distintos vía HTTPS.
   - Define en Vercel también `JWT_SECRET`/lo que el frontend necesite (revisa `frontend/.env*` si existen) — nunca subas secretos al repo.
3. Prueba real de extremo a extremo tras el deploy: login, refresh silencioso, un ejercicio de práctica (que golpea Piston) y el postest — confirma que las cookies y el proxy `/api` funcionan cruzando los dos dominios.
4. Entrega un documento corto (`docs/DEPLOY_VERCEL.md` o similar) con los pasos exactos y las variables de entorno necesarias, para que el despliegue sea repetible sin tener que redescubrir esto cada vez.

Si en el camino encuentras que el backend SÍ podría adaptarse a funciones serverless de Vercel (poco probable por Postgres+Piston, pero evalúalo), dilo explícitamente antes de intentarlo — es un cambio de arquitectura, no de configuración.

### Parte 3 — Darle utilidad real al buscador

El input de búsqueda en `frontend/src/components/shell.tsx` (línea con `placeholder="Buscar…"`) hoy es puramente decorativo: no tiene `value`, ni `onChange`, ni lógica alguna detrás. Dale una utilidad real, acorde al rol de quien esté navegando:

1. **Mínimo viable (hazlo primero):** búsqueda/filtro rápido sobre los propios ítems de navegación del rol activo (`NAV_ESTUDIANTE`, `NAV_DOCENTE`, `NAV_INVESTIGADOR`, `NAV_ADMIN`, ya definidos en `shell.tsx`) — al escribir, resalta o filtra las opciones del menú que coincidan, con navegación por teclado (flechas + Enter) y `Escape` para cerrar. Es información que ya está en el frontend, sin pegarle al backend.
2. **Si tiene sentido ampliarlo** (evalúalo, no lo fuerces si no aplica al rol): búsqueda de contenido real vía los endpoints que ya existen, por ejemplo:
   - Estudiante: ejercicios/temas por título o categoría (reutiliza lo que ya consulta `/ejercicios/ruta` o similar; no crees un endpoint de búsqueda "libre" que exponga el banco completo con respuestas — respeta el gating por nivel que ya se implementó).
   - Docente: buscar estudiantes por nombre (`docente-estudiantes`), ejercicios propios, retos.
   - Admin: buscar usuarios (`admin-usuarios`).
   Si agregas búsqueda contra el backend, con debounce (~300ms) y sin disparar una petición por cada tecla.
3. Que el buscador sea accesible: `aria-label`, resultados anunciables, y que funcione igual de bien en el drawer móvil que en el sidebar de escritorio.

**Qué NO hacer:** no construyas un buscador que devuelva contenido fuera del alcance del rol actual (ej. un estudiante nunca debe poder buscar y encontrar ejercicios de un nivel que no tiene desbloqueado en su tema — la misma regla de gating de la auditoría anterior aplica aquí también).

### Entregable esperado

1. Capturas de la pantalla de Rangos (PC y celular) mostrando la escalera completa con los niveles alcanzados/no alcanzados diferenciados.
2. El documento de despliegue en Vercel + confirmación de que el flujo completo (login → ejercicio → postest) funciona cruzando el dominio de Vercel con el del backend.
3. El buscador funcionando de verdad, con capturas o un GIF corto mostrándolo en uso, y confirmación de que respeta el gating por nivel si terminó buscando contenido del banco.

---

## Cómo usar este prompt

1. Copia el bloque **PROMPT** completo.
2. Pégalo en Claude Code parado en la raíz del repo, con el proyecto corriendo localmente.
3. Pide que se completen las tres partes EN ORDEN y que cada una te muestre su propio entregable antes de pasar a la siguiente.
