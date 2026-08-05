# PREXI — Prompt maestro: reinventar el módulo de Ranking (diseño + funcionalidad)

Prompt reutilizable. Pégalo completo en Claude Code desde la raíz del repo, con el proyecto corriendo localmente.

---

## PROMPT (copiar tal cual)

Eres un diseñador de producto y desarrollador senior trabajando sobre **PREXI**. Tu tarea es **reinventar el módulo de Ranking** — hoy es funcional pero básico, y quiero que lo lleves a un nivel notablemente más atractivo y motivador, sin salirte del sistema de diseño ni de las reglas de la investigación que sostiene la plataforma. Actúa como lo haría el mejor diseñador de producto de un juego con gamificación seria (piensa Duolingo, no un casino de puntos vacíos): cada mejora debe tener un propósito motivacional claro, no ser decoración.

### 0. Punto de partida real (no lo reconstruyas desde cero, entiéndelo primero)

- Backend: `backend/src/modulos/ranking/ranking.controller.ts` — un único `GET /ranking` que devuelve el top global por `xpTotal` (todo el tiempo, sin segmentar, sin resets) más la fila del usuario actual. El modelo `Ranking` (`prisma/schema.prisma`) solo tiene `xpTotal`, `rachaDias`, `ultimaActividad`, `posicion` — sin historial, sin temporadas.
- Frontend: `frontend/src/app/(estudiante)/ranking/page.tsx` — podio de los 3 primeros, lista plana del resto, panel lateral con "tu posición" y la galería de emblemas. Se pinta una sola vez al montar (el título dice "en vivo" pero no lo es de verdad).
- Ya existen piezas reutilizables que le faltan a esta pantalla: `components/count-up.tsx` (animación de conteo, no se usa aquí todavía) y todo el sistema de **Rangos** (`backend/src/gamificacion/catalogo.ts` / `RangoIcon` / `GET /gamificacion/rangos`) que hoy vive completamente separado del ranking, sin cruzarse en ningún lado — son dos sistemas de "estatus" del estudiante que el usuario ve por separado sin conexión visual.

### 1. Diagnóstico del problema real de este ranking (antes de rediseñar)

El defecto de fondo de un ranking global por XP acumulado de por vida es conocido: en cuanto alguien saca ventaja, el resto deja de tener motivo para competir (nadie alcanza al primero) y el ranking se vuelve desmotivador en vez de motivador. Confirma si esto ya está pasando (mira la distribución real de XP en la BD: ¿hay una brecha enorme entre el top 3 y el resto?) y usa ese diagnóstico para justificar las mejoras que propongas, no cambies el diseño por moda.

### 2. Ideas concretas a evaluar e implementar (elige y combina las que tengan sentido, con criterio, no las apliques todas por inercia)

1. **Ranking por temporada** (semanal o por unidad) en vez de (o además de) el global de toda la vida — así quien tuvo una mala racha puede "empezar de nuevo" y competir de verdad la próxima semana. Esto requiere guardar XP por periodo, no solo el acumulado total — **si implica cambiar el esquema de Prisma, dímelo explícitamente antes de migrar** (no lo apliques por tu cuenta).
2. **Segmentar por paralelo**, además del global: competir contra tus ~30 compañeros de paralelo es más relevante socialmente que competir contra todo el curso. Pestañas tipo "Mi paralelo" / "Global".
3. **Cruzar Ranking con Rangos**: muestra el `RangoIcon`/tier (Aprendiz→Maestro del Código) de cada estudiante junto a su fila en el ranking — hoy son dos sistemas de estatus que el estudiante ve en pantallas distintas sin relación visual entre sí; unirlos da más lectura de "liga" (como en un juego con divisiones) sin inventar un sistema nuevo, reutilizando el que ya existe.
4. **Movimiento real, no solo la posición estática**: indicador de si subiste o bajaste puestos desde la última vez (▲/▼ con la cantidad), para que se sienta vivo de verdad y no una foto fija.
5. **Usa `CountUp`** para animar los números de XP en vez de mostrarlos estáticos (ya existe el componente, solo falta usarlo aquí).
6. Evalúa si vale la pena que el título "Ranking en vivo" sea honesto: refresco automático cada cierto intervalo (polling razonable, no un websocket nuevo si no hace falta) en vez de una sola carga al entrar.
7. Micro-interacciones en el podio (hover, entrada animada escalonada) y en la fila del propio usuario (que resalte de forma más clara que hoy, no solo el fondo azul tenue).

### 3. Restricción NO negociable de investigación

El campo `grupo` (`control`/`experimental`) de cada estudiante — usado para el diseño de la tesis — **nunca debe exponerse ni insinuarse en esta pantalla**, sea cual sea el segmento o filtro que agregues. Si un estudiante supiera en qué grupo está, podría cambiar su comportamiento y contaminar los resultados de la investigación (efecto Hawthorne). Verifica que ningún filtro nuevo (por paralelo, por temporada, etc.) termine revelando esa información de forma indirecta (ej. si un paralelo entero es de un solo grupo, ten cuidado con filtros que crucen paralelo + algo más y permitan inferirlo).

### 4. Qué NO hacer

- No inventes XP ni posiciones en el frontend: todo cálculo de ranking sigue viviendo en el backend, como el resto del sistema (ver `README.md`: "toda decisión se calcula en el backend").
- No cambies el sistema de Rangos (`RangosService`, umbrales) — esta tarea es sobre el módulo de Ranking; si los cruzas visualmente, solo LEE los datos de rangos, no los recalcules aquí.
- No apliques una migración de esquema sin mostrármela y esperar aprobación.
- No rompas la galería de emblemas ni el resto del sistema de diseño (paleta, tipografía) ya aprobado.

### 5. Proceso

1. Diagnóstico (distribución real de XP + qué de la lista del punto 2 tiene sentido aplicar y por qué) — preséntamelo primero.
2. Si algo requiere migración, muéstramela antes de aplicarla.
3. Implementa, con capturas antes/después (PC y celular).
4. Prueba con al menos 3 usuarios reales de la BD (distintas posiciones: top, medio, último) para confirmar que cada vista tiene sentido en los tres casos, no solo para el líder.

### 6. Entregable esperado

1. Diagnóstico de la distribución real de XP y justificación de qué mejoras aplicaste.
2. Diseño final (capturas PC + celular, antes/después).
3. Confirmación explícita de que `grupo` (control/experimental) no se expone en ningún punto nuevo.
4. Si hubo migración de esquema, el detalle de qué cambió y por qué era necesario.

---

## Cómo usar este prompt

1. Copia el bloque **PROMPT** completo.
2. Pégalo en Claude Code parado en la raíz del repo, con el proyecto corriendo.
3. Pide el diagnóstico y el menú de mejoras propuestas antes de aprobar la implementación — así decides tú qué tan lejos llegar (por ejemplo, si quieres o no una migración para temporadas).
