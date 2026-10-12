# Clasificación por niveles adaptativos en PREXI: fundamentación metodológica

> Documento de referencia para el marco metodológico de la tesis. Justifica por qué
> PREXI clasifica a cada estudiante en Básico, Intermedio o Avanzado usando los
> umbrales θ = ±0.5 del modelo de Rasch, y por qué esa decisión no es arbitraria.
>
> Última revisión de los umbrales: **7 de agosto de 2026** (valores originales, sin
> modificaciones). Todo cambio futuro debe registrarse en la sección 8.
>
> **Alcance desde el 11 de octubre de 2026.** Los umbrales θ = ±0.5 se usan para
> **ubicar el nivel inicial** de cada tema a partir del diagnóstico. La **subida** de
> nivel dentro de un tema ya no depende de θ: se decide con una evaluación de 10
> preguntas que se aprueba con 80 sobre 100 ([REGLAS_DE_AVANCE.md](REGLAS_DE_AVANCE.md)).
> θ se sigue calculando como dato complementario. Las secciones 4 y 6, que argumentan
> contra clasificar por porcentaje y a favor del umbral del 70 %, describen el criterio
> anterior y deben revisarse antes de citarlas en la tesis.

---

## 1. Qué se clasifica y con qué regla

PREXI asigna a cada estudiante un **nivel adaptativo** que determina qué ejercicios ve,
qué dificultad tienen y cómo le habla el tutor PREXI. Es el mecanismo central de la
adaptatividad y, por tanto, lo que sostiene la hipótesis de la tesis.

La regla es **una sola**, implementada en `nivelDesdeTheta` ([irt.ts](../backend/src/mediciones/irt/irt.ts)):

| Nivel | Condición sobre la habilidad estimada θ |
|---|---|
| **Básico** | θ < −0.5 |
| **Intermedio** | −0.5 ≤ θ ≤ 0.5 |
| **Avanzado** | θ > 0.5 |

Los límites son **cerrados hacia Intermedio**: θ = −0.5 y θ = +0.5 pertenecen ambos al
nivel central. En el borde exacto el estudiante está equidistante de las dos anclas de
dificultad, y ante el empate se prefiere no moverlo del centro: ni se le adelanta a
contenido para el que no hay evidencia, ni se le retiene por debajo de su habilidad.
Este contrato está fijado por pruebas unitarias en `irt.spec.ts`.

θ (theta) es la **habilidad estimada por máxima verosimilitud** bajo el modelo de Rasch,
a partir del patrón de respuestas del estudiante y de la dificultad de cada ítem que
respondió. Se recalcula en el diagnóstico inicial, en los exámenes de unidad y en los
mini-diagnósticos de subida de nivel.

---

## 2. El argumento central: θ y b viven en la misma escala

Esta es la propiedad que distingue al modelo de Rasch de una calificación corriente, y
es el núcleo de toda la justificación.

En el modelo de Rasch (1960), la probabilidad de que un estudiante con habilidad θ
responda correctamente un ítem de dificultad *b* es:

$$P(\theta) = \frac{1}{1 + e^{-(\theta - b)}}$$

Ambas magnitudes —la habilidad de la persona y la dificultad del ítem— se expresan en
**logits**, la misma unidad y la misma escala. De ahí se sigue la propiedad clave:

> **Cuando θ = b, entonces P = 0.5.**
> Un estudiante tiene exactamente 50 % de probabilidad de acertar un ítem cuya dificultad
> iguala su habilidad.

Por eso un corte en θ = 0.5 **no es un percentil ni un porcentaje de aciertos**: es una
afirmación sustantiva sobre lo que la persona puede hacer. Decir "este estudiante es
Avanzado" significa, literalmente:

> tiene probabilidad igual o superior al 50 % de resolver correctamente cualquier ítem
> cuya dificultad sea b ≤ 0.5.

Es un enunciado verificable sobre desempeño, no una posición relativa dentro del grupo.

---

## 3. El vínculo con el banco real de ítems

El argumento anterior sería incompleto si las dificultades *b* fueran arbitrarias. No lo
son: se derivan del nivel y de las estrellas asignadas por el docente, mediante
`dificultadDesdeNivel` y `dificultadDesdeEstrellas` ([irt.ts](../backend/src/mediciones/irt/irt.ts)).

### 3.1 Dificultad b de los ítems del banco, por nivel

| Nivel del ítem | b por nivel | Estrellas | b por estrellas | Rango efectivo |
|---|---|---|---|---|
| **Básico** | −1.0 | ★1 · ★2 | −1.50 · −0.75 | **−1.50 a −0.75** |
| **Intermedio** | 0.0 | ★3 | 0.00 | **0.00** |
| **Avanzado** | +1.0 | ★4 · ★5 | +0.75 · +1.50 | **+0.75 a +1.50** |

La fórmula por estrellas es *b* = (estrellas − 3) × 0.75, acotada a [−3, 3], y es
coherente por construcción con la asignación por nivel (básico ≈ −1, intermedio 0,
avanzado ≈ +1).

### 3.2 Los umbrales caen en los puntos medios entre anclas

```
   Básico              Intermedio              Avanzado
   b = −1                 b = 0                 b = +1
     │                      │                      │
     ●──────────┬───────────●───────────┬──────────●
                │                       │
            θ = −0.5                θ = +0.5
         umbral básico          umbral avanzado
```

Cada umbral es exactamente el **punto medio entre las dificultades ancla de dos niveles
contiguos**:

- −0.5 = (−1 + 0) / 2
- +0.5 = (0 + 1) / 2

La consecuencia interpretativa es directa: **un estudiante se clasifica en el nivel cuya
dificultad ancla está más cerca de su habilidad**. Se le llama Avanzado cuando su θ está
más próxima a la dificultad del material avanzado (+1) que a la del intermedio (0).

Este es el vínculo que convierte los umbrales en un **criterio de contenido** —"domina el
material de este nivel"— y no en un número elegido por conveniencia. Está verificado por
prueba unitaria: `irt.spec.ts` comprueba que cada umbral sigue siendo el punto medio
entre las anclas, de modo que si alguien cambiara una dificultad ancla sin revisar los
umbrales, la prueba falla.

---

## 4. Por qué NO se usa una partición en tercios de porcentaje

La alternativa habitual —clasificar por el porcentaje de aciertos del pretest, con cortes
en 33/66, 40/70 o similares— se descartó deliberadamente. Tres razones:

**4.1 Asume una distribución que no ocurre.** Partir en tercios presupone que los
puntajes se reparten de forma aproximadamente uniforme. En pruebas reales de programación
inicial la distribución suele ser asimétrica, y a menudo bimodal (quienes ya programaban
y quienes empiezan de cero). Con esa forma, los tercios no separan grupos con significado
pedagógico: cortan por donde no hay frontera.

**4.2 Un porcentaje depende de la prueba concreta.** Un 60 % en un examen fácil no
representa la misma habilidad que un 60 % en uno difícil. El porcentaje confunde la
habilidad de la persona con las propiedades del instrumento. θ, en cambio, se estima
*controlando* la dificultad de los ítems efectivamente respondidos: dos estudiantes con
el mismo porcentaje pueden tener θ distinta si acertaron ítems de dificultad distinta, y
eso es precisamente lo que se quiere capturar.

**4.3 No admite justificación sustantiva.** Ante la pregunta "¿por qué 40 y no 45?", la
única respuesta posible sería "porque es aproximadamente un tercio". Con θ = ±0.5 la
respuesta es la de la sección 3: porque es el punto medio entre las dificultades ancla
del banco, y por tanto marca dónde cambia lo que el estudiante puede resolver.

> **Nota sobre `clasificarDominio`.** El sistema sí usa cortes en 34/67, pero sobre otra
> escala y por otra razón. `clasificarDominio` no clasifica personas: clasifica el
> **promedio de los niveles ya asignados** en los temas de una unidad, donde cada nivel
> vale 0, 0.5 o 1. Esa escala tiene tres anclajes sustantivos (0 = todo Básico, 50 = todo
> Intermedio, 100 = todo Avanzado), y los cortes son los puntos medios entre ellos. Ahí la
> partición en tercios es una consecuencia aritmética de la codificación, no una elección
> arbitraria. Ver el comentario en
> [nivel-dificultad.ts](../backend/src/common/niveles/nivel-dificultad.ts).

---

## 5. Respaldo bibliográfico

La decisión se apoya en un marco reconocido, no en criterio propio.

**Modelo de medición**
- Rasch, G. (1960). *Probabilistic Models for Some Intelligence and Attainment Tests*.
  Copenhague: Danmarks Paedagogiske Institut. — Formulación original del modelo de un
  parámetro y de la propiedad de escala conjunta θ/b.
- Wright, B. D., & Stone, M. H. (1979). *Best Test Design*. Chicago: MESA Press. —
  Interpretación de la escala logit y construcción de mapas persona-ítem.
- Bond, T. G., & Fox, C. M. (2015). *Applying the Rasch Model: Fundamental Measurement in
  the Human Sciences* (3ª ed.). Routledge. — Aplicación del modelo a evaluación educativa
  y criterios de ajuste (infit/outfit).
- Embretson, S. E., & Reise, S. P. (2000). *Item Response Theory for Psychologists*.
  Lawrence Erlbaum. — Fundamentos de TRI y estimación de θ por máxima verosimilitud.

**Establecimiento de puntos de corte (standard setting)**
- Angoff, W. H. (1971). Scales, norms and equivalent scores. En R. L. Thorndike (Ed.),
  *Educational Measurement* (2ª ed.). American Council on Education. — Método clásico
  centrado en el ítem: los cortes se fijan según lo que se espera que resuelva un
  estudiante mínimamente competente. PREXI aplica la misma lógica de **referencia a
  criterio**: el umbral se ancla en la dificultad del contenido, no en la posición
  relativa del estudiante.
- Cizek, G. J., & Bunch, M. B. (2007). *Standard Setting: A Guide to Establishing and
  Evaluating Performance Standards on Tests*. Sage. — Revisión de métodos, incluido el
  **bookmark**, que ordena los ítems por dificultad y sitúa el corte donde cambia lo que
  el examinado domina: exactamente el razonamiento de la sección 3.2.
- Kane, M. T. (2013). Validating the interpretations and uses of test scores. *Journal of
  Educational Measurement*, 50(1), 1–73. — Marco de validez basado en argumentos: un
  punto de corte se justifica por la cadena de inferencias que sostiene, que es lo que
  documenta este archivo.

**Posición de PREXI dentro de ese marco.** La clasificación sigue la lógica del *bookmark*
en su forma más simple: los ítems del banco están ordenados por dificultad en logits y el
corte se ubica en la frontera entre bloques de dificultad contigua. No se realizó un panel
de jueces formal —lo que sería el procedimiento Angoff completo—, y eso se declara como
limitación en la sección 7.

---

## 6. Coherencia con el umbral de aprobación del 70 %

El examen de fin de unidad exige **≥ 70 % de aciertos** para aprobar, y el mini-diagnóstico
de subida de nivel exige **≥ 80 %**. A primera vista parece contradictorio con lo dicho en
la sección 4 sobre los porcentajes. No lo es: **miden cosas distintas y responden a
preguntas distintas**.

| | Clasificación por θ | Aprobación por % |
|---|---|---|
| **Pregunta que responde** | ¿En qué nivel de dificultad debe trabajar este estudiante? | ¿Ha cumplido el requisito para avanzar? |
| **Tipo de referencia** | A criterio, anclada en la dificultad del banco | A criterio, anclada en una expectativa institucional |
| **Naturaleza** | Continua (θ en logits), se reestima constantemente | Dicotómica (aprueba / no aprueba), por evento |
| **Efecto** | Adapta el contenido que se muestra | Habilita o bloquea el avance a la siguiente unidad |
| **Depende de la prueba concreta** | No (controla la dificultad de los ítems) | Sí, y por eso se aplica sobre un examen de composición fija |

Son dos decisiones independientes que conviven sin conflicto: la primera **ubica** al
estudiante en el material adecuado; la segunda **certifica** que cumplió un requisito.
El 70 % es además la exigencia de aprobación habitual en el contexto académico de la
carrera, de modo que su justificación es normativa e institucional, no psicométrica.

Un estudiante puede estar clasificado como Básico y aun así aprobar el examen de su unidad
—porque ese examen se le presenta con ítems adecuados a su nivel—, y eso es exactamente el
comportamiento deseado de un sistema adaptativo.

---

## 7. Validación empírica y limitaciones

La justificación teórica es necesaria pero no suficiente. El sistema incorpora una vista
de **validación de la clasificación** en el rol investigador
(`/investigador/clasificacion`), que contrasta la decisión con los datos reales:

1. **¿Discriminan?** Distribución de θ y reparto entre los tres niveles. Si el 80 % o más
   cae en un solo nivel, la pantalla lo marca como advertencia explícita.
2. **¿Predicen?** Tasa de acierto posterior según el nivel asignado, con su contraste
   estadístico y la correlación θ ↔ desempeño. Se excluyen los ejercicios del pretest,
   porque son los que produjeron la clasificación y usarlos sería circular. **Es la
   evidencia más fuerte disponible**: si el nivel asignado no predice el desempeño
   posterior, la clasificación no mide lo que dice medir.
3. **¿Adaptan?** Movilidad entre el nivel inicial y el alcanzado por tema, como evidencia
   de que la clasificación es un punto de partida y no una etiqueta permanente.
4. **Sensibilidad.** Cómo cambiaría el reparto con cortes en ±0.4 o ±0.6, para responder
   "¿y si hubiera elegido otro corte?" con un dato en lugar de una opinión.

### Limitaciones declaradas

- **Las dificultades b son estimaciones del docente, no calibraciones empíricas.** Se
  derivan del nivel y las estrellas asignadas, no de un análisis de respuestas masivo. Es
  una decisión consciente y documentada en `irt.ts`: calibrar requiere un volumen de datos
  que el proyecto aún no tiene. Los estadísticos de ajuste (infit/outfit) de la pantalla
  de Fiabilidad permiten evaluar hasta qué punto esa aproximación describe los datos.
- **No hubo panel de jueces formal** (Angoff completo) para fijar los cortes. La
  justificación es la coherencia interna con la escala de dificultad del banco.
- **Se usa el modelo de 1 parámetro (Rasch)**, no de 2 o 3. Los modelos con discriminación
  y azar requieren calibración con datos masivos. Con ítems de opción múltiple, ignorar el
  parámetro de azar tiende a sobreestimar levemente la habilidad de quienes aciertan por
  adivinación.
- **La validación empírica está pendiente de muestra suficiente.** Hasta alcanzarla, la
  justificación de los umbrales es teórica, y así debe presentarse.

---

## 8. Cuándo y cómo revisar los umbrales

**Los umbrales no se ajustan por intuición.** Modificarlos a mitad del estudio reclasifica
retroactivamente a los participantes e invalida cualquier comparación pretest/postest, lo
que destruiría la evidencia recolectada.

**Condiciones que habilitan una revisión** (todas requieren datos reales ya recolectados):

1. La distribución muestra **concentración extrema** (≥ 80 % en un solo nivel): los cortes
   no están discriminando.
2. **Ausencia de validez predictiva**: el nivel asignado no se asocia con el desempeño
   posterior. Es la señal más grave, porque indica que la clasificación no mide habilidad.
3. Se realiza una **calibración empírica de las dificultades b**. Si las anclas cambian,
   los umbrales —que son sus puntos medios— deben recalcularse en consecuencia.

**Procedimiento obligatorio ante un cambio:**

- Nunca durante una fase de recolección en curso. Se cierra el corte de datos primero.
- Se documenta en este archivo: valor anterior, valor nuevo, evidencia que lo motivó y
  fecha.
- Se declara en la tesis qué participantes fueron clasificados con qué criterio.
- Se actualizan las pruebas de borde en `irt.spec.ts`, que fallarán deliberadamente hasta
  que alguien tome esa decisión de forma consciente.

### Registro de cambios

| Fecha | Cambio | Evidencia que lo motivó |
|---|---|---|
| 2026-08-07 | Valores originales θ = ±0.5. Documentación de la justificación; sin modificación de los valores. | — |
| 2026-10-11 | Los umbrales θ quedan solo para la ubicación inicial. La subida de nivel pasa a nota ≥ 80/100 en 10 preguntas. | Requerimiento del rol docente (PROMPT_MAESTRO_ROL_DOCENTE.md): una sola escala (10 preguntas, 100 puntos, 80 para aprobar) en ejercicios y exámenes. |

---

## 9. Anexo: preguntas frecuentes de un tribunal

**¿Por qué 0.5 y no 0.7 o 1.0?**
Porque 0.5 es el punto medio entre las dificultades ancla de niveles contiguos del banco
(b = 0 para intermedio, b = +1 para avanzado). Un corte en 1.0 exigiría que el estudiante
igualara la dificultad del material avanzado para ser clasificado en él, cuando basta con
estar más cerca de esa ancla que de la anterior. Ver sección 3.2 y el análisis de
sensibilidad en `/investigador/clasificacion`.

**¿No sería más simple clasificar por el porcentaje del pretest?**
Más simple, sí; defendible, no. Un porcentaje depende de la dificultad de la prueba
concreta y no admite justificación sustantiva de sus cortes. Ver sección 4.

**¿Qué pasa si un estudiante queda justo en el límite?**
θ = ±0.5 exactos pertenecen a Intermedio. Es una decisión documentada y fijada por prueba
unitaria, no un efecto colateral de cómo se escribió el `if`.

**¿La clasificación encasilla al estudiante?**
No. Es un punto de partida por tema, y sube mediante el mini-diagnóstico. La pantalla de
validación reporta cuántos estudiantes alcanzaron un nivel superior al inicial.

**¿Cómo sabe que la clasificación funciona?**
Por su validez predictiva: si el nivel asignado predice el acierto en ejercicios
posteriores (excluyendo el pretest, que la generó), la clasificación mide habilidad. El
sistema lo calcula y lo reporta, incluso cuando el resultado es desfavorable.

**¿Por qué conviven el 70 % de aprobación y los umbrales θ?**
Porque responden a preguntas distintas: uno ubica al estudiante en el material adecuado,
el otro certifica un requisito de avance. Ver sección 6.

**¿Hay una sola regla de clasificación en el sistema?**
Sí, desde el 7 de agosto de 2026. Antes coexistían cuatro: una función muerta con cortes
40/70, una regla propia dentro del tutor PREXI con cortes 50/75, la clasificación por θ y
la clasificación de dominio agregado. Las dos primeras se eliminaron y unificaron; hay
pruebas unitarias que impiden que reaparezcan.
