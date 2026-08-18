# PREXI — Auditoría: documento de tesis vs. sistema real

Contraste entre `TESIS EN PROCESO (1).docx` (Capítulos I y II) y el código fuente actual. Verificado leyendo ambos, no por suposición.

---

## RESUMEN EJECUTIVO

La tesis está sólida en marco preliminar y teórico. Los problemas están en tres frentes:

1. **La documentación describe un sistema distinto del que construiste** — y en general, uno más pobre. El sistema real es mejor que lo documentado.
2. **Faltan piezas metodológicas indispensables** para un cuasi-experimento (población, muestra, diseño de grupos).
3. **Dos variables que la tesis promete medir, el sistema no las mide.**

Lo más urgente: el **rol investigador no aparece ni una sola vez** en el documento, y es la pieza que sostiene toda la validación de la hipótesis.

---

## A. LO QUE FALTA EN LA DOCUMENTACIÓN

### A1. Población y muestra — no están definidas (crítico)

Búsqueda en el documento: "población" aparece **1 vez** (en una cita teórica ajena) y "muestra" **4 veces**, todas como verbo o en contexto teórico. **No existe** una sección que defina:

- Población objetivo (¿estudiantes de PRG-111 de la UPEA? ¿cuántos?)
- Muestra y su tamaño
- Tipo de muestreo (probabilístico, por conveniencia, censo)
- Criterios de inclusión y exclusión

*Por qué es crítico:* es lo primero que revisa un tribunal en la metodología. Sin muestra definida no se puede juzgar la validez externa ni justificar la prueba estadística.

### A2. Diseño experimental — los grupos no aparecen

El sistema tiene `grupo: control | experimental` en la base de datos, asignación por paralelo, y todo el rol investigador está construido sobre esa comparación. **El documento nunca menciona un diseño de grupo control ni experimental.**

Falta declarar: diseño cuasi-experimental con grupo de control, pretest–postest, y cómo se asignan los grupos (por paralelo completo, que es lo que hace el sistema).

### A3. El rol INVESTIGADOR no existe en el documento

**0 menciones.** El documento describe tres roles (estudiante, docente, administrador); el sistema tiene **cuatro**. El cuarto es precisamente el que produce la evidencia de la tesis: dataset anonimizado, descriptivos, contrastes, exportación.

### A4. Vacíos del marco metodológico

| Concepto | Menciones en el doc | Estado |
|---|---|---|
| θ (theta) / habilidad estimada | **0** | El sistema lo calcula y es su variable central |
| Confiabilidad / Alfa de Cronbach / KR-20 | **0** | Primera pregunta de un tribunal ante un instrumento propio |
| Tamaño del efecto / d de Cohen | **0** | Un p sin tamaño del efecto está incompleto |
| Validez del instrumento | **0** | — |
| Supuestos estadísticos (normalidad, homogeneidad) | **0** | — |
| Psicometría | **0** | — |

IRT/Rasch **sí** está en el marco teórico (sección 2.3.6, citando a Hambleton, Swaminathan & Rogers, 1991) — bien planteado, pero se queda en definición: no explica cómo se aplica en PREXI ni nombra θ.

### A5. El criterio del 25% no está operacionalizado

La hipótesis dice: *"mejora significativamente **al menos un 25%** el rendimiento académico"*.

No se define **25% de qué**: ¿puntos porcentuales absolutos (de 50 a 75)? ¿mejora relativa sobre el pretest (de 50 a 62.5)? ¿ganancia normalizada? Son tres criterios distintos que dan veredictos distintos con los mismos datos.

*Por qué importa:* es el umbral que decide si aceptas o rechazas H0. Debe estar definido **antes** de ver los resultados, o parecerá elegido a conveniencia.

### A6. Falta el Capítulo III (Marco Aplicativo) y IV (Resultados)

Esperado — el documento está en proceso. Pero conviene saber que ahí es donde entra todo lo anterior.

---

## B. DISCREPANCIAS ENTRE EL DOCUMENTO Y EL CÓDIGO

Todas verificadas en el código. **En casi todos los casos, el sistema real es superior a lo documentado.**

| El documento dice | El sistema realmente usa | Gravedad |
|---|---|---|
| **Express.js** ("framework de Node.js para crear APIs") | **NestJS 10** (Express solo como capa inferior). NestJS aparece 1 vez frente a 12 de Express | Alta — es el framework del backend |
| **JavaScript** | **TypeScript** en todo el proyecto (7 menciones sueltas, pero la tabla de herramientas dice JavaScript) | Media |
| Tutor IA **"ALEX"**, servicio `aiTutorService` | **ALVARO**, `TutorIaService`. El código tiene **ambos nombres** (`alex-panel.tsx` conviviendo con `alvaro-*`) | Alta — inconsistencia también en el código |
| **Python + Pandas + SciPy + Google Colab** para el análisis estadístico | La estadística se calcula **dentro del sistema en TypeScript** (rol investigador). No existe ningún microservicio Python | Alta |
| **Arquitectura MVC** (Tabla 9) | **Screaming Architecture** — organización por dominio, no por capas | Alta |
| 3 roles: estudiante, docente, administrador | **4 roles**: + investigador | Alta |
| Docker (marco teórico) | Ya no se usa en producción: el despliegue es serverless | Media |
| — no menciona — | **Pyodide / WebAssembly**: el Python del estudiante corre en su navegador. Decisión arquitectónica central | Alta |
| — no menciona — | **CodeMirror 6** (editor), **Recharts** (gráficos), **Zod**, **dnd-kit**, **framer-motion** | Media |
| — no menciona — | **Vercel + Render + Neon** (despliegue) | Media |
| — no menciona — | Emblemas, rangos, flashcards, retos derivados, examen de unidad (0 menciones de "emblema" y "rango") | Media |

> **Nota sobre tu prompt de auditoría:** menciona "el microservicio de IA (Python)". **Ese microservicio no existe.** Si se lo mandas a Claude Code tal cual, va a buscar algo que no está. Toda la IA es una llamada a Gemini desde NestJS (`TutorIaService`).

---

## C. LO QUE LA TESIS PROMETE Y EL SISTEMA NO MIDE

Verificado en el código: estas variables están operacionalizadas en las tablas 1–4 del documento pero **el sistema no las captura**.

### C1. Motivación académica — no existe módulo de encuestas (crítico)

La Tabla 2 operacionaliza *"Motivación académica → Nivel de interés y satisfacción → Encuesta → **Cuestionario Likert**"*, como dimensión de una **variable dependiente**.

Búsqueda en backend y esquema Prisma: **cero coincidencias** de encuesta, Likert, motivación o cuestionario. No hay forma de aplicar ni almacenar ese instrumento.

**Dos salidas posibles:**
- **(a)** Implementar un módulo de encuesta Likert en el sistema (aplicada pre y post, almacenada por estudiante). Más trabajo, pero deja la evidencia dentro del sistema y automáticamente vinculada al participante.
- **(b)** Aplicarla externamente (Google Forms/papel) y declararlo así en la metodología, cargando después los resultados al análisis.

Cualquiera sirve, pero hay que decidirlo **ya**: sin este instrumento, media hipótesis (la parte de *competitividad*) queda sin medir.

### C2. Interacción en rankings — no se registra

La Tabla 2 promete *"Interacción en rankings → **Frecuencia de consulta del ranking** → Monitoreo → Logs del sistema"*.

Verificado: `RankingController` **no registra ningún evento de visita**. Nadie sabe cuántas veces un estudiante consultó el ranking.

Es un arreglo pequeño (registrar el acceso a `GET /ranking`) y da un indicador conductual muy citable: *"los estudiantes consultaron el ranking N veces en promedio"*. Vale la pena.

### C3. Frecuencia de acceso / tiempo de uso — en curso

La Tabla 2 y la 4 piden *"Frecuencia de acceso → Logs del sistema"* y *"Número de accesos al sistema PREXI"*. Es la **dosis de intervención** (P1), que ya está implementándose. Cuando esté, cubre este punto.

### C4. Variables intervinientes — instrumentos externos, hay que declararlos

Acceso a internet/dispositivos, condiciones de estudio, motivación personal, tiempo de estudio autónomo, habilidades cognitivas: todas se operacionalizan con encuestas, listas de cotejo y tests externos. El sistema no las mide **ni tiene por qué**, pero la metodología debe declarar que se aplican fuera de la plataforma y en qué momento.

---

## D. LO QUE EL SISTEMA HACE Y LA TESIS NO APROVECHA

Esto es valor construido que hoy no se está cobrando en el documento:

1. **Estimación de θ por máxima verosimilitud** (Rasch), con dificultad `b` por ítem en la misma escala. Es lo que convierte tu clasificación de niveles en algo defendible y no en un corte arbitrario.
2. **Nivel adaptativo por tema** (no global): un estudiante puede ir Avanzado en un tema y Básico en otro. Es un diferencial real frente a los antecedentes citados.
3. **Mini-diagnóstico de subida de nivel** con umbral configurable, y su historial completo como evidencia.
4. **Trazabilidad total**: `PasoRuta`, `HistorialTheta`, `IntentoSubidaNivel`, auditoría. Permite reconstruir el recorrido de cada estudiante.
5. **Retos derivados del banco oficial**, con trazabilidad al ejercicio de origen.
6. **Anonimización y dataset canónico único** — decisión metodológica fuerte y citable.
7. **Ejecución de Python en el navegador** — resuelve el despliegue sin costo y sin servidor propio.

---

## E. ORDEN SUGERIDO DE TRABAJO

**Antes de escribir el Capítulo III:**

1. Decidir cómo se mide la **motivación** (C1) — condiciona el instrumento y la metodología.
2. Definir **población, muestra y muestreo** (A1).
3. Declarar el **diseño cuasi-experimental** con grupos (A2).
4. Fijar el **criterio del 25%** por escrito, antes de ver resultados (A5).
5. Registrar la **consulta al ranking** (C2) — cambio pequeño, indicador prometido.

**Al escribir el Capítulo III:**

6. Corregir la tabla de herramientas: NestJS, TypeScript, Pyodide, CodeMirror, Recharts, Vercel/Render/Neon (B).
7. Reemplazar "Arquitectura MVC" por Screaming Architecture, o justificar por qué se describe como MVC.
8. Unificar **ALVARO vs ALEX** — en el documento y en el código.
9. Documentar el **rol investigador** como cuarto rol (A3).
10. Ampliar el marco metodológico: θ, confiabilidad, tamaño del efecto, supuestos (A4).

**Lo que ya está bien y no hay que tocar:** marco preliminar, antecedentes, justificaciones, el planteamiento de IRT/Rasch en el marco teórico, límites y alcances.

---

## F. RIESGOS DE DEFENSA (preguntas que hoy no tienen respuesta)

1. *"¿Cuál fue su población y su muestra?"* → no está en el documento.
2. *"¿Cómo asignó los grupos control y experimental?"* → el sistema lo hace por paralelo; el documento no lo dice.
3. *"El 25% que plantea su hipótesis, ¿25% de qué exactamente?"* → sin definir.
4. *"¿Qué confiabilidad tiene su instrumento?"* → no calculada ni mencionada.
5. *"Dice que usa SciPy y Colab, pero su sistema calcula la estadística internamente. ¿Cuál es?"* → discrepancia.
6. *"Su tabla dice Express, pero su código es NestJS. ¿Cuál usó?"* → discrepancia.
7. *"¿Cómo midió la motivación académica que declara como variable dependiente?"* → sin instrumento.
