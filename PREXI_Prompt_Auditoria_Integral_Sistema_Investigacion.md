# PREXI — Prompt maestro: Auditoría integral del sistema y de los datos de investigación

Prompt reutilizable. Pégalo completo en Claude Code **desde la raíz del backend**, con el stack real levantado (`docker compose up -d`) y acceso a la base de datos real (no fixtures). Úsalo antes de cada ronda de recolección de datos, después de cualquier despliegue, y antes de la defensa de la tesis.

---

## PROMPT (copiar tal cual)

Eres el motor de auditoría del sistema **PREXI** (NestJS + Prisma + PostgreSQL en backend, Next.js en frontend), una plataforma adaptativa con IA y gamificación para el curso Programación I (PRG-111, UPEA), que además es el instrumento de una investigación con diseño control/experimental (pretest–postest, estimación de habilidad por IRT/Rasch). Tu tarea es auditar el sistema completo **contra la base de datos real** y reportar, sin corregir nada todavía, qué reglas de negocio y qué garantías de integridad de datos para la investigación se cumplen y cuáles no.

### 0. Disciplina obligatoria: diagnóstico antes que arreglo

No es negociable, en este orden:

1. **Paso 1 — Diagnóstico.** Escribe (o amplía) un script de auditoría que corra contra la BD real y muestre, regla por regla, PASS/FAIL con el detalle de cada fallo (ids afectados, conteos). No toques ningún archivo de código ni ningún dato en este paso.
2. **Paso 2 — Reporte y aprobación.** Muéstrame el resultado completo del Paso 1 y una explicación de la causa raíz de cada FAIL, priorizada por impacto en la investigación primero (un dato de tesis corrupto pesa más que un detalle cosmético). Para cada corrección que propongas, dime si es un problema de **datos** (te doy un script de migración dirigido, no un reseed completo) o de **código** (te doy el diff concreto) — y espera mi aprobación antes de aplicar cualquiera de los dos.
3. **Paso 3 — Confirmación.** Solo después de que apruebe, aplica los fixes uno por uno y vuelve a correr el script completo hasta que todas las reglas den PASS.

Si algún hallazgo solo se puede corregir cambiando el esquema (una migración), dímelo explícitamente ANTES de aplicarla — no la apliques por tu cuenta.

### 1. Bloque A — Reglas de negocio funcionales (regresión)

**A1. Gating por nivel (ejercicios y retos).** Re-corre `scripts/auditoria-completa.ts` y confirma que las 10 reglas ya definidas siguen en PASS (distribución 15/10/5 por tema en Unidad 1 y 2, sin códigos de ejercicio duplicados, opción_multiple/predecir_salida con 4 opciones, examen final de 10 ítems sin solape con la práctica, retos con origen válido y activo, retos de depuración con `codigoPython` no nulo en el origen, `nivelDificultad` del reto = el del origen, sin códigos de reto duplicados, y el test de gating estricto por `(temaCodigo, nivel)` en `/ejercicios/ruta` y `/retos`). Si en algún momento se aplicó el fix pendiente en `EjerciciosController.detalle()`/`responder()` y `RetosController.detalle()`/`entregar()` (validar que el nivel del ítem coincide con el nivel actual del estudiante en ese tema), confírmalo con una prueba explícita; si no se aplicó, repórtalo como hallazgo abierto.

**A2. Seguridad de autenticación.** Verifica: bcrypt con cost ≥ 10; access token corto (15 min) + refresh token opaco rotatorio en cookie httpOnly (30 días con "recordarme", 1 día sin él, con detección de reutilización/robo); bloqueo devuelve 429 con `retryAfterSeconds` (por cuenta y por IP); mensaje de credenciales inválidas idéntico exista o no el correo; el rol de la respuesta de login sale siempre de la BD; CSRF cubierto (cookie `sameSite=strict` + guard de Origin/Referer en mutaciones); contraseña con la MISMA regla de complejidad (8 caracteres, letra y número) en registro, cambio de contraseña y restablecimiento; intentos fallidos y bloqueos quedan en `LogAuditoria`; el token de recuperación es de un solo uso, expira a los 45 minutos y restablecer la contraseña cierra todas las sesiones abiertas (revoca los refresh tokens).

**A3. Integridad del banco de contenido.** Confirma que ninguna corrección de datos haya alterado los conteos certificados de las Unidades 1–3 (`backend/docs/unidad*-trazabilidad.md`) ni el examen final (que mezcla intermedio/avanzado a propósito: no lo toques ni lo "arregles").

### 2. Bloque B — Integridad de los datos para la investigación (LO MÁS IMPORTANTE)

Este bloque pesa más que el A: si el sistema "funciona" pero los datos no sirven para la tesis, la auditoría fracasó. Verifica cada punto contra la BD real y trata cualquier fila afectada como un hallazgo con su `usuarioId` (nunca nombre/correo/cédula en el reporte).

**B1. Registro y grupos de investigación**
- Todo `Usuario` con `rol=estudiante` tiene `paralelo`, `carrera` y `semestre` no nulos ni vacíos.
- Sin `email` ni `cedula` duplicados (ya restringido por `@unique`, pero confirma que no hay filas con esos campos vacíos/placeholder).
- `grupo` (`control`/`experimental`) es consistente **por paralelo completo**: nadie debería tener compañeros de su mismo paralelo en el grupo contrario, salvo una asignación individual forzada explícitamente — en ese caso debe existir el `LogAuditoria` correspondiente (`AdminGruposService.asignar` con `forzar: true`).
- Si `ConfiguracionSistema.gruposBloqueados` está activo, confirma que no hay cambios de grupo posteriores al bloqueo que no hayan pasado por `forzar` (y auditados).

**B2. Pretest y clasificación inicial**
- `pretestCompletado=true` implica que existe una fila real en `Evaluacion` (`tipo=pre`) Y respuestas en `PretestRespuesta` (`tipo=pre`) asociadas a ese usuario — nada de "completados" fantasma sin evidencia.
- `nivelInicialAdaptativo` está fijado (no nulo) en todo estudiante con pretest completado, y es un dato que **nunca debería cambiar** después de fijado (es permanente por diseño del instrumento); si encuentras evidencia de que cambió, repórtalo como hallazgo grave, no lo corrijas sin avisar.
- `thetaInicial` no nulo cuando el estudiante tiene suficientes respuestas de pretest con `dificultadB` válido en el ítem; si hay pretest completado pero `thetaInicial` sigue `null`, es un hallazgo.

**B3. Postest y evaluación final**
- `Evaluacion` (`tipo=post`) solo existe para estudiantes que también tienen `Evaluacion` (`tipo=pre`) — el pareo pre/post es obligatorio para cualquier prueba t de los resultados; reporta postests "huérfanos" (sin pretest) como hallazgo.
- `thetaFinal` no nulo cuando hay postest con respuestas suficientes.
- Nadie completó el postest sin cumplir `ConfiguracionSistema.postestDesdeNivel` (el gate de nivel mínimo para habilitarlo).

**B4. Trazabilidad de práctica y adaptatividad (evidencia del proceso)**
- Proporción de `Intento` cuyo ejercicio tiene `dificultadB` no nulo: si es baja o nula, θ_actual nunca se re-estima y la narrativa adaptativa del sistema queda sin evidencia cuantitativa que mostrar en la tesis.
- `PasoRuta` se está poblando para estudiantes activos (si está vacío, la "ruta seguida" que se expone en `/ejercicios/mi-ruta` no tiene datos que mostrar).
- Todo salto de `ProgresoTema.nivelActual` por encima del nivel inicial tiene al menos un `IntentoSubidaNivel` con `aprobado=true` que lo respalde.
- `HistorialTheta` registra puntos en cada `origen` esperado (`pretest`, `practica`, `subir_nivel`, `postest`) tal como está documentado en el código.

**B5. Dataset exportable para el investigador**
- Ejecuta (o revisa el resultado de) `InvestigadorExportacionService.construirDataset()` sobre todos los estudiantes elegibles y verifica: `id_anonimo` sin PII real; ningún campo crítico (`grupo`, `theta_inicial` cuando corresponde, `pretest_total`) en `null` en una fracción alta de filas; el número de filas coincide con el número de estudiantes elegibles (sin duplicados ni fugas); el CSV/JSON resultante abre limpio en pandas o R (sin columnas corridas, sin encoding roto, tildes correctas).
- Confirma que el endpoint de exportación es de solo lectura (no debe mutar nada) — revalida esto especialmente si se tocó código de este módulo.
- Reporta el balance real de conteos `control` vs `experimental` (solo repórtalo; no reasignes nada sin aprobación explícita).

### 3. Script de auditoría

Amplía `backend/scripts/auditoria-completa.ts` (o crea un script complementario `scripts/auditoria-investigacion.ts` que reutilice sus helpers) agregando una función por cada regla de B1 a B5, con el mismo formato PASS/FAIL y detalle de fallos que ya usa el script existente. No reescribas las reglas del Bloque A que ya están cubiertas: solo confírmalas re-corriendo el script.

### 4. Qué NO hacer

- No reasignes `grupo` (control/experimental) de nadie sin aprobación explícita: invalidaría el diseño de investigación ya en curso.
- No regeneres ni reclasifiques `nivelInicialAdaptativo` de nadie que ya lo tenga fijado.
- No toques el examen final (mezcla intermedio/avanzado a propósito).
- No imprimas ni exportes PII real (nombre/correo/cédula) en ningún reporte de esta auditoría — refiérete a los usuarios por `id` numérico.
- No apliques ningún fix, de datos o de código, antes de mostrarme el Paso 1 completo y recibir aprobación explícita.
- Si un hallazgo exige tocar el esquema de Prisma, señálamelo explícitamente antes de migrar.

### 5. Entregables esperados

1. Salida completa del script (Bloque A + Bloque B) con PASS/FAIL y detalle de cada fallo.
2. Explicación de la causa raíz de cada FAIL, priorizada por impacto en la investigación primero.
3. Para cada fix propuesto: si es de datos (script de migración dirigido) o de código (diff concreto), presentado ANTES de aplicarse.
4. Tras la aprobación y el fix: nueva corrida del script confirmando todas las reglas en PASS.
5. Un resumen ejecutivo final en tabla — regla / estado / filas afectadas / prioridad — listo para pegar en el capítulo de metodología o los anexos de la tesis.

---

## Cómo usar este prompt

1. Copia el bloque **PROMPT** completo.
2. Pégalo al inicio de una conversación con Claude Code, parado en la raíz de `backend/`, con `docker compose up -d` corriendo y la BD real accesible.
3. Espera el Paso 1 completo antes de aprobar ningún cambio.
4. Guarda el resumen ejecutivo final (punto 5 de los entregables) como evidencia para la tesis.
5. Repite esta auditoría antes de cada ronda de recolección de datos y antes de la defensa.
