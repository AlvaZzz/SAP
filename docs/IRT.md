# Teoría de Respuesta al Ítem (IRT) en PREXI — Modelo de Rasch

Este documento explica el fundamento matemático de la adaptatividad de PREXI:
la **Teoría de Respuesta al Ítem (IRT)** en su variante de **1 parámetro
(modelo de Rasch)**. Sirve como base para el marco teórico de la tesis y para
explicar el código en la defensa.

La implementación está en el backend, en el módulo de dominio
[`backend/src/irt/irt.ts`](backend/src/irt/irt.ts) (matemática pura y
documentada) con sus pruebas unitarias en
[`backend/src/irt/irt.spec.ts`](backend/src/irt/irt.spec.ts).

---

## 1. ¿Qué es el modelo de Rasch?

La IRT modela la probabilidad de que un estudiante responda correctamente un
ítem (ejercicio) en función de **dos cantidades medidas en la misma escala**
(logits):

- **θ (theta)** — la **habilidad** del estudiante.
- **b** — la **dificultad** del ítem.

El **modelo de Rasch** (Georg Rasch, 1960), también llamado **1PL** (un
parámetro logístico), postula que esa probabilidad depende **únicamente de la
diferencia `(θ − b)`**:

```
P(θ) = 1 / (1 + e^(−(θ − b)))
```

Interpretación:

- Si **θ = b**, entonces **P = 0.5**: el estudiante tiene 50 % de probabilidad
  de acertar un ítem exactamente a su nivel.
- Si **θ > b** (el estudiante es más hábil que la dificultad del ítem) → P > 0.5.
- Si **θ < b** (el ítem es más difícil que su habilidad) → P < 0.5.

### ¿Por qué 1 parámetro y no 2 o 3?

Los modelos de 2PL y 3PL añaden un parámetro de **discriminación** (`a`) y uno
de **azar/adivinación** (`c`). Estos requieren **calibración con datos masivos**
de respuestas reales, que **aún no existen** en el proyecto. Por honestidad
metodológica se implementa el modelo de Rasch (1PL): los valores de dificultad
`b` son estimaciones iniciales del docente por nivel, **calibrables en trabajo
futuro** cuando se acumulen respuestas.

---

## 2. Fórmulas implementadas

### 2.1. Curva característica del ítem — `probabilidadAcierto(theta, b)`

```
P(θ) = 1 / (1 + e^(−(θ − b)))
```

Probabilidad de acierto de un ítem de dificultad `b` para una habilidad `θ`.

### 2.2. Dificultad `b` de los ítems

Cada ejercicio guarda su dificultad `b` en la columna `Ejercicio.dificultadB`
(escala de θ, típicamente −3..+3). Se siembra a partir de las estrellas del
ejercicio (`dificultadDesdeEstrellas`), de forma coherente con el mapeo por
nivel (`dificultadDesdeNivel`):

| Nivel       | b inicial | Estrellas → b                     |
|-------------|-----------|-----------------------------------|
| Básico      | −1        | ★1 → −1.5 · ★2 → −0.75            |
| Intermedio  |  0        | ★3 → 0                            |
| Avanzado    | +1        | ★4 → +0.75 · ★5 → +1.5           |

> Los `b` iniciales son estimaciones del docente por nivel. Se documentan como
> **calibrables con más datos** (trabajo futuro).

### 2.3. Información de Fisher — `informacionItem(theta, b)`

```
I(θ) = P(θ) · (1 − P(θ))
```

Es **máxima (0.25) cuando `b = θ`**. Fundamenta la **selección adaptativa**: un
ítem aporta la máxima información sobre la habilidad cuando su dificultad
coincide con la habilidad del estudiante.

### 2.4. Estimación de la habilidad θ por máxima verosimilitud (MLE)

Dado el patrón de respuestas del estudiante (qué ítems acertó/falló y su
dificultad `b`), se busca el `θ` que **mejor explica** ese patrón, es decir, el
que **maximiza la función de log-verosimilitud**:

```
ln L(θ) = Σ_i [ u_iˑ(θ − b_i) − ln(1 + e^(θ − b_i)) ]
```

donde `u_i ∈ {0,1}` indica si el ítem `i` se acertó.

Se resuelve con el método iterativo de **Newton-Raphson**. Para el modelo de
Rasch la primera y segunda derivada son:

```
L'(θ)  = Σ_i [ u_i − P_i(θ) ]                 (gradiente / "score")
L''(θ) = − Σ_i [ P_i(θ)ˑ(1 − P_i(θ)) ]        (siempre < 0 → función cóncava)
```

y la actualización de cada iteración es:

```
θ ← θ − L'(θ) / L''(θ) = θ + L'(θ) / Σ_i P_i(1 − P_i)
```

Detalles de robustez en `estimarTheta`:

- **Paso amortiguado** a ±1 logit por iteración: en las colas la curvatura es
  mínima y el paso puro de Newton podría dispararse/oscilar; el amortiguamiento
  garantiza **convergencia monótona** sea cual sea el punto inicial.
- **Acotación** del resultado a `[THETA_MIN, THETA_MAX] = [−4, 4]`.
- **Patrones extremos**: si acierta **todo**, la verosimilitud se maximiza en
  +∞ → se devuelve `THETA_MAX`; si falla **todo**, `THETA_MIN`. (Con un patrón
  perfecto la habilidad no se puede estimar con precisión, solo acotar.)
- **Sin respuestas** → `θ = 0` (habilidad neutra, sin evidencia).

### 2.5. Mapeo θ → nivel adaptativo — `nivelDesdeTheta(theta)`

| θ estimado           | Nivel       |
|----------------------|-------------|
| θ < −0.5             | Básico      |
| −0.5 ≤ θ ≤ 0.5       | Intermedio  |
| θ > 0.5              | Avanzado    |

(Umbrales ajustables mediante las constantes del módulo.)

### 2.6. Ganancia de habilidad — `gananciaTheta`

```
Δθ = θ_final − θ_inicial
```

Complementa la ganancia en puntaje con la **ganancia en habilidad estimada**.

---

## 3. Dónde se usa la IRT en el sistema

| Momento                        | Uso de la IRT | Código |
|--------------------------------|---------------|--------|
| **Diagnóstico (pretest)**      | Al finalizar, se estima **θ_inicial** por MLE desde las respuestas y se **clasifica el nivel inicial a partir de θ** (no del % de aciertos). Se guarda `Usuario.thetaInicial`. | `pretest.service.ts` → `finalizar` / `estimarThetaPretest` |
| **Selección adaptativa**       | La ruta de práctica ordena los ejercicios pendientes por **máxima información** (b más cercano a θ), presentando primero los más informativos para la habilidad actual. | `adaptatividad.service.ts` → `ruta` / `thetaActual` |
| **Actualización continua**     | Tras cada intento de práctica se **re-estima θ** con todas las respuestas y se persiste `Usuario.thetaActual`; se registra un punto en la evolución si cambia ≥ 0.1 logit. | `ejercicios.service.ts` → `responder` |
| **Subir de nivel**             | El mini-diagnóstico **re-estima θ** con las nuevas respuestas y lo registra (origen `subir_nivel`). El cambio de nivel se opera con el umbral de % (equivalente al gate por θ del nivel objetivo). | `adaptatividad.service.ts` → `evaluarSubida` |
| **Postest**                    | Se estima **θ_final** desde el postest y se calcula **Δθ = θ_final − θ_inicial** (evidencia cuantitativa de progreso, además del puntaje). Se guarda `Usuario.thetaFinal`. | `postest.service.ts` → `finalizar` / `estimarThetaPostest` |

---

## 4. Datos que la IRT genera para la investigación

Se registran y se exponen para exportación (rol investigador,
`investigador-exportacion.service.ts`):

- **θ_inicial** (pretest) y **θ_final** (postest) por estudiante, con
  **Δθ = θ_final − θ_inicial** → dataset consolidado y CSV
  (`theta_inicial`, `theta_final`, `delta_theta`).
- **Evolución de θ** a lo largo del uso (modelo `HistorialTheta`: pretest,
  práctica, subida de nivel, postest) → endpoint `evolucion-theta`.
- **Dificultad `b`** de cada ítem → endpoint `items-irt`.
- **Nivel inicial** y niveles alcanzados por tema (ya existentes).

Esto enriquece el estudio: además de la ganancia en **puntaje**, se dispone de
la ganancia en **habilidad estimada (θ)**, fundamentada en la IRT.

---

## 5. Honestidad metodológica (alcance)

- Se implementa el **modelo de Rasch (1PL)**, no 2PL/3PL (requieren calibración
  con datos masivos que aún no existen).
- Los `b` iniciales son **estimaciones del docente por nivel**; podrían
  **calibrarse con más datos** en trabajo futuro.
- La IRT **calcula la habilidad y guía la dificultad**; el **pretest y el
  postest siguen siendo IGUALES para todos** (instrumento de medición), y la
  **comparación experimental vs. control se mantiene**.
- Toda la matemática está en el **backend**, con **pruebas unitarias** que
  verifican las funciones (p. ej. que `P(θ) = 0.5` cuando `θ = b`, y que
  `estimarTheta` converge correctamente con patrones conocidos).
```
