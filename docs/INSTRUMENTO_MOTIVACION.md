# Instrumento de motivación académica (MSLQ)

> ## ⚠ Funcionalidad del sistema no empleada en esta investigación
>
> La tesis adopta un diseño **no experimental transversal** cuyas variables son la
> precisión del motor adaptativo, la usabilidad percibida (SUS) y la calidad del
> producto de software (ISO/IEC 25010). **La motivación académica no es una
> variable del estudio.**
>
> Por eso, desde la migración `retirar_grupos`:
>
> - La encuesta está **apagada por configuración**
>   (`ConfiguracionSistema.encuestaMotivacionActiva = false`); mientras siga así,
>   `GET/POST /encuesta/:momento` responden `503`.
> - No tiene pantalla en el frontend ni aparece en el flujo del estudiante.
> - Se retiró del rol investigador: ya no hay endpoint `/investigador/motivacion`,
>   ni contrastes pre/post o entre grupos, ni columnas `motivacion_*` en el dataset.
> - El código del instrumento (`backend/src/mediciones/encuesta`) y la tabla
>   `RespuestaEncuesta` **se conservan** por si se quiere usar más adelante.
>
> El resto de este documento describe el instrumento tal como quedó implementado
> y se mantiene solo como referencia.

Documentación del instrumento y **borrador de la sección del marco metodológico**
(no aplicable a la tesis actual).

---

## 1. Qué se implementó

| Pieza | Estado |
|---|---|
| Modelo de datos (`RespuestaEncuesta`) | ✅ Aplicado por migración |
| Escala de **7 puntos** (la del MSLQ) | ✅ |
| Tres subescalas de motivación | ✅ Declaradas |
| Aplicación en dos momentos (pre / post) | ✅ Una sola vez por momento |
| Alfa de Cronbach por subescala | ✅ Verificado contra numpy |
| Comparación con el α de la literatura | ✅ Donde hay valor citable |
| Contrastes entre grupos y entre momentos | ✅ Con supuestos verificados |
| Integración al dataset canónico | ✅ `motivacion_pre/post/delta` |
| **Ítems oficiales del MSLQ** | ⛔ **PENDIENTE — los cargas tú** |

Mientras los ítems no estén cargados, el sistema **se niega a aplicar la encuesta**
y responde `503` con un mensaje que dice exactamente qué falta. Es intencional:
es preferible que falle de forma ruidosa a que aplique un instrumento vacío a un
participante real.

---

## 2. Cómo cargar los ítems

Edita **un solo archivo**: `backend/src/mediciones/encuesta/items-mslq.ts`.

```ts
export const ITEMS_MSLQ: ItemMslq[] = [
  { codigo: 'vt1', subescala: 'valoracion_tarea',  numeroOriginal: 4,
    texto: '<texto oficial del ítem 4>' },
  { codigo: 'ae1', subescala: 'autoeficacia',      numeroOriginal: 5,
    texto: '<texto oficial del ítem 5>' },
  { codigo: 'mi1', subescala: 'metas_intrinsecas', numeroOriginal: 1,
    texto: '<texto oficial del ítem 1>', inverso: false },
];
```

Reglas que conviene respetar:

- **El texto, tal cual.** No lo parafrasees ni lo "mejores": cambiar la redacción
  rompe la equivalencia con el instrumento validado y con ella el derecho a citar
  sus propiedades psicométricas.
- **El `codigo` no se cambia** una vez aplicada la encuesta: es lo que se guarda
  en la base y cambiarlo dejaría huérfanas las respuestas ya recogidas.
- **`inverso: true`** solo si el manual indica recodificar ese ítem. Marcarlo mal
  distorsiona el puntaje de toda la subescala.
- **`numeroOriginal`** permite rastrear cada ítem hasta el manual cuando el
  tribunal lo pida.

Después: completa `ADAPTACION_ESPANOL` con la referencia aprobada y sube
`VERSION_INSTRUMENTO_ITEMS` si más adelante cambian los ítems.

---

## 3. Advertencia de uso legítimo

El MSLQ se distribuye para **uso académico** y debe solicitarse a la University of
Michigan. Aquí se emplea con fines de investigación académica, citando la fuente.

**Si este repositorio se hace público, `items-mslq.ts` no debe publicarse con el
texto íntegro de los ítems.**

---

## 4. Borrador para el marco metodológico

> Adaptar antes de pegar: hay que completar la adaptación al español que apruebe
> la tutora, y sustituir los valores entre `<…>` por los reales una vez recogidos
> los datos.

### 4.x Instrumento de medición de la motivación académica

Para medir la motivación académica —declarada como variable dependiente del
estudio— se empleó la sección de motivación del **Motivated Strategies for
Learning Questionnaire (MSLQ)**, desarrollado por Pintrich, Smith, García y
McKeachie (1991) en el National Center for Research to Improve Postsecondary
Teaching and Learning de la University of Michigan.

El MSLQ es un instrumento de autoinforme ampliamente utilizado en investigación
educativa universitaria, compuesto por dos secciones: motivación (31 ítems en
seis subescalas) y estrategias de aprendizaje (50 ítems). **En este estudio se
aplicó únicamente la sección de motivación**, y dentro de ella tres subescalas,
por corresponder directamente a las dimensiones operacionalizadas en la
investigación:

| Subescala | Qué mide | Correspondencia con el estudio |
|---|---|---|
| Valoración de la tarea | Interés, importancia y utilidad percibida de la materia | Indicador "nivel de interés" |
| Metas de orientación intrínseca | Si el estudiante aprende por interés propio o por recompensa externa | Núcleo de la motivación académica |
| Autoeficacia y expectativas | Confianza en la propia capacidad de aprender y rendir | Pertinente en programación de primer semestre |

Se excluyó deliberadamente la sección de estrategias de aprendizaje por exceder
el alcance de la investigación y por no aportar evidencia a la hipótesis
planteada, evitando además alargar innecesariamente la aplicación.

**Formato de respuesta.** Los ítems se responden en una escala Likert de siete
puntos, donde 1 corresponde a "no me describe en absoluto" y 7 a "me describe
totalmente", conservando el formato original del instrumento para mantener la
comparabilidad con los valores reportados en la literatura. Los ítems redactados
en sentido inverso se recodificaron antes del cálculo de los puntajes; el sistema
almacena la respuesta original sin modificar, de modo que la recodificación es
auditable.

**Puntuación.** El puntaje de cada subescala se obtuvo como la media aritmética
de sus ítems, quedando expresado en la escala original de 1 a 7. Se optó por la
media y no por la suma porque las subescalas contienen distinto número de ítems,
y la suma haría que la subescala más extensa pesara más en las comparaciones sin
justificación sustantiva.

**Adaptación al español.** Se utilizó la adaptación de `<AUTORES, AÑO, PAÍS>`,
validada en población universitaria hispanohablante.

**Aplicación.** El instrumento se aplicó en dos momentos: antes del inicio de la
intervención, junto con el pretest de conocimientos, y al finalizarla, junto con
el postest. El sistema impide responderlo más de una vez por momento. Los
estudiantes que no completaron el instrumento se registraron como datos
faltantes y fueron excluidos del análisis correspondiente, sin imputación de
valores.

**Confiabilidad.** Se calculó el coeficiente alfa de Cronbach para cada subescala
sobre la muestra del estudio. Los valores obtenidos fueron
`<α = ..., α = ..., α = ...>`, comparables con los reportados en la validación de
referencia (α = .87 para valoración de la tarea y α = .83 para autoeficacia y
expectativas), lo que indica que las subescalas se comportaron de manera
consistente en esta población.

**Uso del instrumento.** El MSLQ se distribuye para fines académicos y de
investigación; su empleo en este estudio se realizó bajo esa condición, citando
a los autores originales.

---

## 5. Referencias

- Pintrich, P. R., Smith, D. A. F., García, T., & McKeachie, W. J. (1991).
  *A Manual for the Use of the Motivated Strategies for Learning Questionnaire
  (MSLQ)*. Ann Arbor: University of Michigan, National Center for Research to
  Improve Postsecondary Teaching and Learning.

**Adaptaciones al español disponibles** (elegir la aprobada y citarla):

- Roces, C., Tourón, J., & González Torres, M. C. (1995). España — CEAM.
- Donolo, D., Chiecher, A., Paolini, P., & Rinaudo, M. C. (2008). Argentina — MSLQe.
- Validaciones adicionales en Chile, Colombia, México, Venezuela y Uruguay.

---

## 6. Dónde se ve el resultado

Rol investigador → módulo de motivación (`/api/investigador/motivacion`):

- Cobertura: cuántos respondieron pre, post y ambos.
- Alfa de Cronbach por subescala, con su comparación contra la literatura.
- Contraste entre grupos en el pretest (equivalencia inicial en motivación).
- Contraste entre grupos en el postest.
- Contraste pre-post dentro de cada grupo.
- Contraste por subescala, para ver dónde se concentra el efecto.

Todos los contrastes verifican supuestos y se bloquean si la muestra no alcanza,
igual que el resto del rol.
