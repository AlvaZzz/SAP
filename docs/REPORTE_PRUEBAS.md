# REPORTE DE PRUEBAS — PREXI (preparación para producción)

Fecha: 2026-07-03 · Stack: NestJS + Prisma/PostgreSQL (backend) · Next.js 14 (frontend) · Docker Compose

## Resumen ejecutivo

| Suite | Resultado |
|---|---|
| Unitarias backend (`npm test`) | ✅ **50/50** (5 suites) |
| E2E flujo de la tesis (`npm run test:e2e`) | ✅ **28/28** (contra el stack Docker real) |
| Typecheck backend y frontend (`tsc --noEmit`) | ✅ sin errores |
| Build de producción backend (`nest build`) y frontend (`next build`) | ✅ ambos compilan |

**3 bugs reales encontrados y corregidos** durante las pruebas (detalle abajo).

---

## 1 · Qué se probó

### Unitarias (Prisma simulado, sin BD) — `backend/src/**/*.spec.ts`

- **PretestService**: puntaje real = aciertos/total×100; clasificación Bajo/Medio/Alto (40/70); nivel inicial 2 si es Alto (desbloquea niveles 1 y 2, no el 3); el estado de un pretest completado se lee de la `Evaluacion` persistida (regresión del bug 0/100); corrección evaluada en backend (case-insensitive); preguntas ajenas rechazadas; respuestas en blanco cuentan como incorrectas sin romper el cálculo.
- **PostestService**: disponibilidad según `postestDesdeNivel` y `umbralPorcentaje` de la config; **avance = postest − diagnóstico** exacto; `null` sin diagnóstico; finalizar sin preguntas cargadas rechazado (no persiste un 0); no se puede repetir; estado desde la `Evaluacion` persistida.
- **EjerciciosService**: XP base; penalización por pistas de PREXI (contadas en backend) con piso de 5 XP; multiplicadores de racha (1.2/1.5/2.0) y corte de racha; desbloqueo del siguiente nivel al alcanzar el umbral (y no antes); nivel bloqueado → 403; recálculo de posiciones del ranking por XP.
- **Guards**: `JwtAuthGuard` (sin token, token inválido, token expirado, cookie y Bearer) y `RolesGuard` (estudiante ✗ docente/admin/investigador, docente ✗ admin, investigador ✗ docente/admin, cada rol ✓ sus rutas).
- **AuthService**: bcrypt (nunca texto plano), mensaje idéntico para correo inexistente y contraseña errada, bloqueo 15 min al 5.º fallo (HTTP 423), cuenta desactivada no entra, email/cédula duplicados con mensaje claro.
- **Indicadores de la tesis** (diseño no experimental transversal): `motor.spec` (rango objetivo, personalización, latencia), `log-adaptacion.service.spec` (una fila por decisión, nunca rompe la respuesta), `bootstrap.spec` (IC reproducible con semilla fija), `instrumentos.spec` (SUS contra cálculo manual, ISO/IEC 25010, una sola aplicación) e `investigador-validacion.service.spec` (criterios de aceptación y CSV sin datos personales).

### E2E del flujo crítico de la tesis — `backend/test/flujo-tesis.e2e-spec.ts`

Corre por HTTP contra el stack real (`docker compose up -d`), con la BD sembrada:

1. **Registro**: correo inválido → 400 en español; no se puede auto-asignar rol (whitelist); duplicado → mensaje claro.
2. **Guards en vivo**: sin token → 401; estudiante bloqueado en 6 rutas de docente/admin/investigador; investigador y docente bloqueados fuera de su área.
3. **Pretest**: 20 preguntas **sin filtrar la respuesta correcta**; autosave por pregunta; puntaje persistido consistente 1:1 con la revisión; el estado lee lo persistido; no se puede repetir ni alterar tras finalizar.
4. **Ejercicios**: incorrecta = 0 XP; correcta = XP > 0 y aparece en el ranking; nivel bloqueado → 403.
5. **Postest**: bloqueado hasta el avance configurado; **finalizar sin iniciar → 400 (el examen NO salta al resultado — bug conocido, verificado que no reaparece)**; ganancia exacta postest−pretest; doble envío rechazado; `/progreso` refleja los valores persistidos.
6. **Docente/Investigador**: el estudiante nuevo aparece en el seguimiento docente; el **CSV** exporta columna por columna el pretest y el postest reales; el investigador accede a panel y dataset.
7. **Tours**: persistencia por usuario (vacío → marcar idempotente → reiniciar), clave vacía → 400.

### Casos límite cubiertos
Pretest/postest sin responder (puntaje parcial, nunca error ni salto), respuestas incompletas, sesión expirada (401), entrada inválida (400 con mensaje), doble envío (examen y formularios con spinner+disabled), acceso sin permiso (403), archivos no-PDF (firma binaria `%PDF-` + límite de tamaño verificados en código, ya existentes).

---

## 2 · Bugs encontrados y CORREGIDOS

1. **Listado de ejercicios vacío para el estudiante** (`ejercicios.service.ts`): `/ejercicios?nivel=1` filtraba por `nivelId` (id autoincremental) en lugar del **número** de nivel. Con los ids reales del seed (11–15) el estudiante veía todos los niveles vacíos. → Ahora filtra por `nivel.numero`.
2. **Fuga de respuestas correctas en plena evaluación** (`pretest/postest.controller.ts`): `/pretest/revision` y `/postest/revision` devolvían las respuestas correctas **sin verificar que el examen estuviera finalizado**: un estudiante podía consultarlas a mitad del examen. → La revisión ahora exige examen completado (400 antes).
3. **Alteración de respuestas tras finalizar**: `responder` de pretest/postest aceptaba cambios después de cerrado el examen. → Bloqueado con 400.

Además se eliminaron restos de demo para producción: credenciales precargadas y el recuadro "Demo: juan@…" en `/login`, y textos fijos del perfil ("2024-CS-", "Primer semestre").

## 3 · Qué queda pendiente

- **Tutor IA (PREXI)**: no se probó end-to-end porque requiere `GEMINI_API_KEY` real (el rate-limit y el registro de consultas están cubiertos por diseño y guard existente).
- **Subida real de PDF por multipart**: validación revisada en código (firma binaria + límite); falta un e2e con archivo real.
- ~~**Migraciones Prisma versionadas**~~ **RESUELTO**: el esquema ya se versiona en [`backend/prisma/migrations/`](../backend/prisma/migrations) y producción despliega con `prisma migrate deploy` (nunca `db push`). `db push` queda solo para iterar en la BD local de desarrollo.
- **Seed de producción**: decidir si se conservan las cuentas demo (documentado en README).
- Pruebas de interfaz (visual/interacción) automatizadas: la verificación fue manual + compilación.

## 4 · Cómo reproducir

```bash
cd backend
npm test              # unitarias (sin BD)
docker compose up -d  # stack completo
npm run test:e2e      # e2e del flujo de la tesis
```

## 5 · Ampliación del rol docente (2026-07-04)

Nueva suite `backend/test/estructura-academica.e2e-spec.ts` (16 pruebas, incluidas en el total de e2e):

- **Unidad → Tema**: creación, número duplicado rechazado, regla de publicación (mínimo 10 ejercicios activos, mensaje "X/10"), guard de rol (estudiante no accede a `/docente/unidades`).
- **Nuevos tipos de pregunta**: `completar_codigo` acepta variantes separadas por `|`; `ordenar_lineas` califica comparando el orden de ids; ambos se crean sin exigir `opciones` cuando no aplica.
- **Desbloqueo por tema**: el primer tema de la primera unidad se habilita solo tras publicarse; un segundo tema no publicado permanece bloqueado (403) aunque el ejercicio exista.
- **Paralelo**: registro con paralelo obligatorio. (La asignación de grupos control/experimental se retiró junto con el diseño cuasiexperimental.)

Total actualizado: **50 unitarias + 44 e2e**, todas en verde. Build de producción de frontend y backend verificado tras el cambio.

**Nota de diseño**: la generación de preguntas desde PDF (Gemini) no tiene e2e automatizado porque requiere `GEMINI_API_KEY` real; se verificó manualmente el flujo de parseo defensivo del JSON de respuesta y el guardado como borrador.

## 6 · Ampliación de gamificación del estudiante (2026-07-05)

Nueva suite `backend/test/gamificacion-avanzada.e2e-spec.ts` (9 pruebas) + 9 unitarias en `src/gamificacion/gamificacion-avanzada.spec.ts`:

- **Emblemas**: el catálogo expone los 15 emblemas con su requisito (`condicion`) e ícono SVG (`svgKey`); un estudiante nuevo tiene 0. Al resolver el primer ejercicio el backend otorga `primer_acierto` y lo devuelve en `emblemas_nuevos` (para la animación); **no se re-otorga** en aciertos posteriores (constraint anti-duplicado verificado). Unitarias cubren racha (7/14 días), top_5, y el combo tema_completado + sin_errores + mente_brillante + unidad_conquistada al cerrar un tema sin fallos ni pistas; perfeccionista solo con postest 100.
- **Rangos**: `rangoParaPuntaje` mapea 0-100 → Aprendiz…Maestro; `/gamificacion/rangos` da el rango global (Aprendiz para el nuevo) con `faltan` puntos al siguiente; `/rangos/catalogo` trae los 6 rangos ordenados con umbral creciente. `RangosService.recalcular` persiste `DesempenoUnidad` con el puntaje ponderado (acierto·0.5 + temas·0.3 + postest·0.2) y el rango derivado.
- **Progreso detallado**: `/progreso/detalle` devuelve unidad→tema con `dominio` (del estudiante) y `promedio_grupal`.

Total actualizado: **59 unitarias + 50 e2e**, todas en verde. Builds de producción (backend `nest build`, frontend `next build`) verificados.

**Nota de diseño**: iconos de emblemas y rangos son **SVG originales** (`components/emblema-icon.tsx`, `rango-icon.tsx`), sin assets de juegos con copyright. La animación "¡Logro desbloqueado!" (`components/logro-toast.tsx`) usa una cola global (`LogrosProvider`) y confeti; se dispara desde la vista de ejercicios con los `emblemas_nuevos`/`rango_subido` que devuelve el backend.

## 7 · Correcciones y mejoras del rol docente (2026-07-05)

Nueva suite `backend/test/rol-docente-mejoras.e2e-spec.ts` (11 pruebas) + 8 unitarias en `src/ejercicios/adaptatividad.service.spec.ts`. Total: **67 unitarias + 57 e2e**, todas en verde; builds de producción OK.

- **Responsividad**: `Modal` (ui.tsx) reescrito con `flex-col` + alto máximo del diálogo (`max-h-[calc(100dvh-3rem)]`), header/footer fijos y cuerpo scrolleable → nunca corta ni desborda; en móvil casi full-width. Dashboard docente: stat cards `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`, fila de actividad oculta badge/fecha en móvil. Todas las tablas ya con `overflow-x-auto`.
- **Ejercicios por Unidad → Tema → Subtema**: el formulario docente usa dropdowns dependientes (reutiliza `/docente/unidades`); el `temaId` final es el subtema si se elige, si no el tema padre.
- **Evaluación final controlada por el docente**: modelo `PostestControl` (por paralelo, deshabilitado por defecto). `PostestService.disponibilidad` ahora gatea por el switch docente. `/docente/postest` (listar + toggle) notifica a los estudiantes al habilitar. E2E: default bloqueado (400 "docente la habilite"), estudiante no puede togglear (403), al habilitar → disponible + notificación, deshabilitar → vuelve a bloquear. El módulo va al final del menú del estudiante.
- **Adaptatividad de la ruta**: (`PerfilAdaptativo` se eliminó por obsoleta en la migración `retirar_grupos`) `PasoRuta` (registro de la secuencia). `AdaptatividadService`: ruta ordenada por cercanía a la dificultad objetivo (bajo→fáciles primero, avanzado→difíciles antes); motor de reglas sube/baja tras cada intento. Banco y pretest/postest IGUALES para todos. Endpoints `/ejercicios/ruta` y `/ejercicios/mi-ruta` (evidencia). Unitarias cubren perfil inicial, orden por dificultad, resueltos al final, y el ajuste ±1 con topes.
- **Subida de PDF en generación**: el módulo `/docente/preguntas-ia` ahora tiene subida directa (input file + drag & drop) que sube a `/docente/documentos` con el tema y auto-selecciona el PDF. Verificado de punta a punta: subida → extracción de texto (`pdf-parse`) → Gemini propone borradores citando el material del docente → aprobación docente.

**Nota**: se detectó y eliminó una unidad huérfana VACÍA (0 ejercicios/progreso) que quedaba de exploración previa y alteraba el determinismo de los tests de desbloqueo (la "primera unidad" se decide por orden/número ascendente).
