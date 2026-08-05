# PREXI — Prompt maestro: auditoría de iconos y detalles "que parecen hechos por IA"

Prompt reutilizable. Pégalo completo en Claude Code desde la raíz del `frontend/`, con el proyecto corriendo y acceso a un navegador (o Playwright) para poder VER cada pantalla real antes de cambiar nada — este tipo de defecto solo se detecta mirando, no leyendo código a ciegas.

---

## PROMPT (copiar tal cual)

Eres responsable de una pasada de pulido visual sobre **PREXI** (Next.js + Tailwind, ícono base `lucide-react` vía `frontend/src/components/icons.tsx`). El objetivo no es rediseñar: es encontrar y corregir los detalles que se sienten genéricos, sobrantes o "hechos por IA sin criterio" (iconos que no comunican nada, mezcla de estilos, relleno decorativo sin propósito) y dejar cada pantalla **intuitiva** (que el ícono/elemento comunique su función de un vistazo, sin ambigüedad) y **atractiva** (coherente con el sistema de marca que ya existe, no genérica).

### 0. Diagnóstico antes que arreglo — es obligatorio

No cambies nada a ciegas. Primero:

1. Recorre TODAS las pantallas principales de cada rol (estudiante: dashboard, ejercicios, retos, flashcards, documentos, progreso, ranking, perfil, postest; docente: dashboard, unidades, ejercicios, preguntas IA, retos, documentos, estudiantes, revisiones, reportes; investigador: panel, resultados, datos, exportación; admin: dashboard, usuarios, grupos, sistema, auditoría) y toma capturas en desktop y en celular.
2. Por cada pantalla, haz una lista de TODOS los íconos, ilustraciones, badges y elementos puramente decorativos que aparecen.
3. Solo después de tener ese catálogo completo, evalúa cada ítem contra los criterios del punto 1. No propongas cambios pantalla por pantalla sobre la marcha: junta el diagnóstico completo primero y preséntamelo antes de tocar código.

### 1. Qué buscar (señales concretas de "se ve hecho por IA sin criterio")

- **Ícono que no comunica nada por sí solo**: si tapas el texto de al lado y el ícono no te dice qué hace ese botón/sección, es candidato a cambiar o quitar.
- **Mezcla de estilos de ícono**: todo el sistema usa `lucide-react` (trazo fino, consistente) — si encuentras un emoji suelto, un ícono de otro set, o un SVG con un grosor de trazo distinto al resto, es una inconsistencia visual que "delata" un parche apurado.
- **Clichés genéricos de "app hecha con IA"**: chispas/destellos (`Sparkles`), robots, bombillas o rayos usados como decoración repetida en cualquier cosa remotamente "inteligente" sin relación directa con lo que la función realmente hace. No los prohíbas de plano (`Sparkles` para algo de IA puede tener sentido puntual) — el criterio es: ¿este ícono específico, en este lugar específico, ayuda a entender la función, o es relleno?
- **Íconos redundantes**: un ícono al lado de un texto que ya dice exactamente lo mismo (ej. un ícono de "reloj" junto a la palabra "Tiempo:") no añade información — evalúa si aporta jerarquía visual real o es ruido.
- **Tamaño/peso inconsistente dentro de la misma pantalla**: íconos de distinto tamaño o grosor de trazo en elementos del mismo nivel jerárquico (ej. dos tarjetas hermanas con íconos de tamaños distintos sin razón).
- **Exceso decorativo sin jerarquía**: gradientes, sombras o "glow" aplicados por todos lados sin que ayuden a distinguir qué es más importante en la pantalla — si todo brilla, nada resalta.
- **Microcopy genérico pegado al ícono**: textos de relleno tipo "¡Genial!", "¡Excelente trabajo!" repetidos sin variación ni contexto real del logro/acción — no es parte central de esta tarea (es copy, no ícono), pero si lo notas en el mismo lugar que un ícono problemático, repórtalo igual.

### 2. Qué SÍ dejar intacto

- La mascota (`PenguinMascot`), el logo (`PrexiLogo`) y la paleta/tipografía de marca — eso ya está aprobado, esta tarea es sobre iconografía funcional y detalles decorativos, no sobre la identidad visual central.
- Los cambios de layout/espaciado y el fix del correo institucional de un prompt anterior — no los repitas ni los deshagas.
- Cualquier ícono que, tras evaluarlo con el criterio del punto 1, SÍ cumple su función con claridad: no cambies por cambiar. Si algo ya está bien, dilo explícitamente en el diagnóstico y no lo toques.

### 3. Reglas para las correcciones

1. Antes de introducir un ícono nuevo, revisa si `lucide-react` (ya usado en todo el proyecto vía `components/icons.tsx`) tiene uno más preciso para esa función — mantén un único set de íconos en toda la app, no mezcles librerías.
2. Si un ícono no aporta nada, la corrección puede ser simplemente QUITARLO (menos es más), no reemplazarlo por otro ícono a la fuerza.
3. Todo ícono debe tener un tamaño y peso de trazo consistente con sus pares del mismo nivel (compáralo con elementos hermanos en la misma pantalla, no solo a ojo).
4. Si cambias un ícono, verifica accesibilidad: `aria-hidden` cuando es puramente decorativo, `aria-label` en el elemento interactivo cuando el ícono es la única pista de la acción (ej. un botón que solo tiene ícono, sin texto visible).

### 4. Proceso

1. **Diagnóstico completo** (capturas + catálogo + evaluación por pantalla) — preséntamelo primero.
2. Para cada hallazgo, propón el cambio concreto (quitar / reemplazar por cuál ícono de `lucide-react` / ajustar tamaño) ANTES de aplicarlo.
3. Aplica solo lo que apruebe, pantalla por pantalla.
4. Captura de nuevo cada pantalla corregida (antes/después) para confirmar la mejora.

### 5. Entregable esperado

1. El catálogo completo de íconos/elementos decorativos por pantalla, con el veredicto de cada uno (mantener / quitar / reemplazar) y por qué.
2. Capturas antes/después de cada pantalla donde hubo cambios.
3. Confirmación de que no se tocó la mascota, el logo, la paleta ni la tipografía de marca.
4. Confirmación de que todo el proyecto sigue usando un único set de íconos (`lucide-react`) sin mezclas.

---

## Cómo usar este prompt

1. Copia el bloque **PROMPT** completo.
2. Pégalo en Claude Code parado en `frontend/`, con `npm run dev` corriendo.
3. Exige el diagnóstico completo (capturas + catálogo) antes de aprobar ningún cambio — es la parte que evita que "arregle" cosas que en realidad ya estaban bien.
