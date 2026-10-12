# Pendientes fuera del alcance del PROMPT 00

Cosas detectadas al alinear PREXI al diseño no experimental transversal que **no** se
tocaron porque quedaban fuera de ese alcance.

## Antes de recolectar datos reales

1. **Ítems del cuestionario ISO/IEC 25010.** Los 12 de
   `backend/src/mediciones/calidad/items-iso25010.ts` son un borrador. Hay que
   reemplazarlos por los validados por juicio de expertos (V de Aiken ≥ 0,80, apartado
   3.7.1 de la tesis), poner `INSTRUMENTO_VALIDADO = true` y subir `VERSION_ISO25010`.
2. **Rango objetivo.** El sistema usa `0,50 ≤ P ≤ 0,85` sobre la probabilidad de acierto
   esperada del modelo de Rasch. La tesis (Cap. II, "Selección adaptativa de ejercicios")
   todavía tiene los límites entre corchetes y describe el rango como una *tasa de
   acierto observada*. Hay que redactar ese apartado con la definición que el sistema
   aplica y justificar los dos límites en el marco teórico.
3. **La tesis dice que la IRT es "referente conceptual y no procedimiento de cálculo".**
   El sistema sí estima θ por máxima verosimilitud (Rasch). Corregir el texto del
   Cap. II para que describa lo implementado.
4. **Umbral del criterio de precisión.** La tesis lo deja como "[apartado del Cap. II]".
   El valor por defecto en el sistema es 70 % y es configurable; debe fijarse y
   declararse antes de la recolección.
5. **Respaldo de producción.** Render aplica `prisma migrate deploy` en cada despliegue:
   al desplegar esta rama, la migración `retirar_grupos` borra `usuarios.grupo` en Neon
   sin vuelta atrás. Respaldar Neon antes (docs/BASE_DE_DATOS.md, sección 4).

## Diferencias entre la tesis y el sistema que conviene resolver

6. **"Ningún dato individual se comunica al docente"** (3.5.4, consideraciones éticas).
   El rol docente ve el seguimiento individual de cada estudiante (ejercicios, niveles,
   evaluación final), y el PROMPT del rol docente pide ampliarlo. Lo coherente es
   precisar en la tesis que el docente accede a los datos **académicos** del curso, y que
   lo que no se le comunica son las **respuestas a los cuestionarios** de la
   investigación (SUS), que solo salen anonimizadas.
7. **Indicadores de la Tabla 4 del Cap. III no implementados:** "tasa de finalización de
   ruta" y "progresión de nivel". Los datos existen (`ProgresoTema`, `IntentoSubidaNivel`,
   `DesempenoUnidad`) pero no están en el panel de validación.
8. **Criterio de exclusión "patrón de respuesta invariante"** (Tabla 18): el sistema no
   descarta cuestionarios con la misma respuesta en todos los ítems. Se puede filtrar en
   el análisis con Pandas a partir de `sus.csv`.
9. **"Evaluadores con formación en ingeniería de software".** Hoy responden el
   cuestionario de calidad las cuentas con rol docente. Si se necesita distinguir a un
   evaluador externo de un docente del curso, hace falta un rol o una marca propia.

## Limpieza técnica

10. **El motor nunca baja de nivel.** El nivel por tema solo sube (mini-diagnóstico). La
    tesis describe un motor que también reduce la dificultad cuando el desempeño cae.
11. **Exportación XLSX.** Solo hay CSV; el proyecto no tiene librería de Excel y Pandas
    lee CSV directamente.
12. **Campos obsoletos de `ConfiguracionSistema`** (`retosIntermedioHabilitado`,
    `retosAvanzadoHabilitado`): siguen en el esquema sin gobernar nada.
13. **`seed-demo.ts`** sigue simulando una mejora entre el diagnóstico y la evaluación
    final. Ya no alimenta ningún indicador, pero convendría que también genere
    respuestas SUS e ISO/IEC 25010 sintéticas para poder ver el panel poblado.
14. **Pruebas e2e.** `flujo-tesis.e2e-spec.ts` y `estructura-academica.e2e-spec.ts` se
    adaptaron pero no se ejecutaron en esta pasada (ver el resumen de la entrega).
    Falta además un e2e del flujo SUS → panel de validación.
15. **`next build` dentro del contenedor de desarrollo** falla al escribir en el volumen
    `web_next` que usa `next dev`. No afecta a producción (Vercel); para compilar en
    local hay que hacerlo en una copia fuera de ese volumen.

## Pendientes del rol docente y del rol estudiante (11 de octubre de 2026)

16. **Banco de ejercicios por debajo del estándar.** La regla es 10 ejercicios por nivel
    en cada tema; el banco sembrado tiene en promedio 7 de nivel básico y 3 de
    intermedio y de avanzado. Los temas ya publicados siguen publicados, pero un tema
    nuevo no se puede publicar hasta completarlos. Falta cargar el contenido (a mano o
    con PREXI) desde la pantalla Unidades.
17. **Preguntas de examen que combinan temas.** Las preguntas de examen sembradas son de
    un solo tema. El examen las usa mientras no haya 10 integradoras; hay que generarlas
    o escribirlas en "Examen de la unidad".
18. **Generador de PREXI sin probar contra Gemini en local.** El entorno de desarrollo no
    tiene `GEMINI_API_KEY`: la lógica está cubierta con pruebas unitarias (PREXI simulado)
    y la pantalla muestra el aviso de IA no configurada. Falta una prueba real con la
    clave de producción, sobre todo para confirmar que 10 preguntas con código caben en
    la respuesta y que PREXI declara bien los temas que combina. Lo mismo vale para la
    redacción de flashcards y para las propuestas de retos: en un reto de bug hay que
    comprobar que la "salida correcta" que propone PREXI sea la real.
19. **Backend de la evaluación final (postest) dormido.** Se retiraron sus pantallas y el
    control del docente, pero siguen el módulo `mediciones/postest`, `PostestControl`, el
    banco `postest`, el campo `postestDesdeNivel` de Administración → Sistema y el
    endpoint `docente/reportes/pretest-postest`. No los usa ninguna pantalla.
20. **`CLASIFICACION_NIVELES.md`, secciones 4 y 6.** Argumentan contra clasificar por
    porcentaje y a favor de un umbral del 70 %; con la regla de 80/100 hay que
    reescribirlas antes de citarlas en la tesis.
21. **Campo "umbral" del tema.** Sigue en la base de datos (ejercicios para completar el
    tema); se quitó del formulario del docente y vale 10 por defecto.
