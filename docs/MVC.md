# PREXI y el patrón MVC — correspondencia con el código real

Este documento responde a una pregunta concreta: **¿el sistema implementado es
MVC, como afirma el documento de tesis?** La respuesta corta es **sí**, y lo que
sigue lo demuestra con archivos reales, no con un diagrama genérico.

Sirve como respaldo de la Tabla 9 del documento y como guía para quien tenga que
mantener el código.

---

## 1. Dónde vive cada rol del patrón

NestJS implementa MVC de forma **nativa**: el framework está construido sobre esa
separación, no la añade uno a mano.

| Rol MVC | Tecnología | Responsabilidad | Ejemplo real |
|---|---|---|---|
| **Modelo** | Prisma + PostgreSQL | Entidades, relaciones y persistencia. 38 modelos declarados | [`prisma/schema.prisma`](../backend/prisma/schema.prisma) → `model Usuario` (l. 85), `model Ejercicio` (l. 506), `model Evaluacion` (l. 601) |
| **Controlador** | NestJS `@Controller` | Recibe la petición HTTP, valida la entrada (DTO), aplica guards de autenticación y rol, delega. **No** contiene reglas de negocio | [`ranking.controller.ts`](../backend/src/modulos/ranking/ranking.controller.ts), [`auth.controller.ts`](../backend/src/auth/auth.controller.ts) |
| **Lógica de negocio** | NestJS `@Injectable` (Service) | Las reglas: corrección, XP, desbloqueo, adaptatividad, estadística | [`ranking.service.ts`](../backend/src/modulos/ranking/ranking.service.ts), [`ejercicios.service.ts`](../backend/src/ejercicios) |
| **Vista** | Next.js (App Router) + React | Presentación e interacción. **Nunca** calcula reglas ni es fuente de verdad | [`frontend/src/app/(estudiante)/ranking/page.tsx`](../frontend/src/app/(estudiante)/ranking/page.tsx) |

Recuento actual del backend: **38 controladores, 49 servicios, 40 módulos, 38
modelos de Prisma, 201 archivos TypeScript, ~21 500 líneas**.

### El ciclo completo, con un caso

Pedir el ranking global recorre exactamente el ciclo del patrón:

1. **Vista** — `ranking/page.tsx` llama a `api.get('/ranking')` (ruta relativa).
2. **Controlador** — `RankingController` recibe `GET /api/ranking`, `JwtAuthGuard`
   resuelve la identidad y el controlador delega. No decide nada.
3. **Lógica** — `RankingService` calcula posiciones, empates y visibilidad.
4. **Modelo** — Prisma consulta `Ranking`, `Usuario` y `Estadistica`.
5. La respuesta vuelve a la **Vista**, que solo la dibuja.

La *regla de oro* del proyecto —toda decisión con consecuencia se calcula en el
backend— es precisamente la disciplina que impide que la Vista invada al Modelo,
que es el modo habitual en que un MVC se degrada.

---

## 2. Por qué las carpetas no se llaman `models/`, `views/`, `controllers/`

Porque el backend agrupa **por dominio** (*screaming architecture*) y no por capa
técnica:

```
backend/src/ranking/           ← todo lo del ranking junto
  ranking.controller.ts        ← Controlador
  ranking.service.ts           ← Lógica de negocio
  ranking.module.ts            ← Cableado (inyección de dependencias)
  ranking.service.spec.ts      ← Sus pruebas
```

frente a la disposición por capa:

```
src/controllers/ranking.controller.ts
src/services/ranking.service.ts
src/models/ranking.model.ts
```

**Las dos son MVC.** La diferencia es únicamente *cómo se ordenan las carpetas*,
no qué responsabilidad tiene cada archivo. Un `RankingController` es un
controlador viva donde viva; moverlo a `controllers/` no lo hace "más MVC", solo
lo aleja de su servicio.

La agrupación por dominio es además la recomendación oficial de NestJS y la
práctica dominante en el ecosistema desde hace años, justamente porque mantiene
junto lo que cambia junto.

---

## 3. Qué costaría reorganizar por capas

Medido sobre el código real, no estimado a ojo:

| Concepto | Magnitud |
|---|---|
| Archivos a mover | ~127 (38 controladores + 49 servicios + 40 módulos) |
| Importaciones relativas a reescribir | **561** rutas `./` y `../` |
| Archivos de prueba afectados | 33 suites (447 pruebas) |
| Módulos a recablear | 40 `@Module` con sus `imports`/`providers` |

Qué se rompe mientras dura:

- **Inyección de dependencias**: cada `@Module` declara sus `providers` y
  `exports` por ruta. Un import mal resuelto no falla al compilar de forma obvia:
  falla en tiempo de ejecución con `Nest can't resolve dependencies of X`.
- **Rutas HTTP**: no cambian (dependen de `@Controller('ranking')`, no de la
  carpeta), pero cualquier controlador que se quede fuera de su módulo tras el
  movimiento **desaparece silenciosamente** del enrutador. No hay error de
  compilación; simplemente esa ruta pasa a devolver 404.
- **Pruebas**: las 33 suites importan por ruta relativa.
- **Historial de git**: los `git blame` de ~127 archivos quedan atados al commit
  de la mudanza.

---

## 4. Riesgo

El sistema **está a punto de recolectar datos reales** de la investigación. Ese
dato cambia por completo la evaluación:

- Un fallo introducido aquí no se paga con un rato de depuración: se paga con
  **sesiones de estudiantes perdidas**, que son datos que no se pueden repetir.
- El modo de fallo más probable (ruta que deja de registrarse, dependencia que no
  resuelve) es **silencioso**: no lo detecta el `typecheck` ni necesariamente las
  pruebas unitarias, porque estas prueban servicios aislados.
- La ganancia funcional de la reorganización es **exactamente cero**: ni una
  función nueva, ni un milisegundo menos, ni una línea menos de código.

Es riesgo real a cambio de nada más que un nombre de carpeta.

---

## 5. La alternativa: documentar lo que ya existe

El documento de tesis no exige la carpeta `controllers/`; exige demostrar que el
sistema **separa responsabilidades según MVC**. Eso ya está demostrado, y la
Tabla 9 puede rellenarse con archivos reales:

| Componente MVC | Tecnología | Archivos representativos | Qué hace |
|---|---|---|---|
| Modelo | Prisma ORM + PostgreSQL | `prisma/schema.prisma` (38 modelos) | Define entidades, relaciones e integridad; toda la persistencia |
| Controlador | NestJS `@Controller` (38) | `auth.controller.ts`, `ejercicios.controller.ts`, `ranking.controller.ts` | Recibe la petición, valida el DTO, aplica guards de rol, delega |
| Lógica de negocio | NestJS `@Injectable` (49) | `ejercicios.service.ts`, `ranking.service.ts`, `pretest.service.ts` | Reglas de corrección, XP, adaptatividad, IRT y estadística |
| Vista | Next.js 14 + React + Tailwind | `frontend/src/app/**/page.tsx`, `components/**` | Presentación e interacción; no calcula reglas |

Y conviene añadir una frase en el capítulo, porque es defendible y honesta:

> El backend aplica el patrón MVC con la organización de carpetas **por dominio**
> que recomienda NestJS: cada dominio agrupa su controlador, su servicio y sus
> pruebas, en lugar de separarlos en carpetas por capa técnica. La separación de
> responsabilidades propia de MVC se mantiene íntegra; lo que cambia es el
> criterio de agrupación de los archivos.

Un tribunal que pregunte "¿dónde está el controlador?" recibe una respuesta
inmediata y verificable: `backend/src/<dominio>/<dominio>.controller.ts`.

---

## 6. Recomendación

**No reorganizar.** Documentar la correspondencia (sección 5) y dedicar el tiempo
a la recolección de datos.

El argumento en una línea: reorganizar por capas es un cambio **cosmético** que
toca ~127 archivos y 561 importaciones, cuyo modo de fallo típico es silencioso,
en un sistema que empieza a recibir datos irrepetibles la semana que viene. La
tesis no pierde nada, porque el patrón ya está implementado; solo se documenta
dónde vive cada pieza.

Si aun así se decide reorganizar, la condición mínima es hacerlo **después** de
la recolección de datos, un módulo por commit, con las 447 pruebas en verde tras
cada uno y verificando además que el número de rutas registradas al arrancar no
cambia.
