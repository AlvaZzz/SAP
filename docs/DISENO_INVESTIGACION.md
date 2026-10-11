# Diseño de la investigación: qué mide PREXI y cómo

Puente entre el código y los Capítulos I y III de la tesis. Para cada indicador:
qué es, cómo se calcula, de qué tabla sale y en qué pantalla se ve.

## 1. El diseño en una frase

**No experimental, transversal.** Sin manipular variables ni comparar grupos, en un
único momento al final del período de uso se evalúa **si el sistema funciona bien**.

```
M:  X  →  (O₁, O₂, O₃)
```

- **M** — estudiantes de primer semestre de Programación I, Ingeniería de Sistemas, UPEA.
- **X** — el Sistema Adaptativo Inteligente con gamificación y ranking (se describe, no se manipula).
- **O₁** precisión del motor adaptativo · **O₂** usabilidad percibida · **O₃** calidad del producto de software.

**Hipótesis:** PREXI alcanza niveles satisfactorios de precisión del motor adaptativo,
de usabilidad percibida y de calidad del producto de software. Se acepta solo si los
**tres** criterios de aceptación se cumplen de forma conjunta.

El **pretest** es el diagnóstico inicial (clasifica el nivel y personaliza la ruta) y el
**postest** es la evaluación final del curso (la administra el docente). **No se comparan
entre sí**: no hay ganancia pre→post, ni grupos control/experimental, ni equivalencia
inicial. La encuesta de motivación (MSLQ) no forma parte del estudio y está apagada.

## 2. Variables dependientes

| Variable | Indicador | Fórmula | Tabla | Pantalla |
|---|---|---|---|---|
| **Precisión del motor adaptativo** | Proporción de asignaciones dentro del rango objetivo, con IC 95 % | `P = 1/(1+e^-(θ_antes − b))` ; en rango ⇔ `0,50 ≤ P ≤ 0,85` ; `% = en rango ÷ evaluables × 100` | `log_adaptacion.en_rango_objetivo` | Investigador → Validación del sistema, bloque 1 |
| | Latencia de reajuste (s) | Desde que llega la respuesta hasta que la habilidad queda re-estimada. Media, mediana y p95 | `log_adaptacion.latencia_ms` | ídem |
| **Usabilidad percibida** | Puntaje medio SUS (0–100) | Ítems impares `r − 1`, pares `5 − r`; suma × 2,5 (Brooke, 1996) | `respuestas_instrumento` (`instrumento = 'SUS'`) | Validación del sistema, bloque 2 |
| **Calidad del producto de software** | Valoración media por característica ISO/IEC 25010 | Media, entre evaluadores, de la media de los ítems de la característica | `respuestas_instrumento` (`instrumento = 'ISO25010'`) | Validación del sistema, bloque 3 |
| | Cumplimiento de subcaracterísticas (%) | Subcaracterísticas con media ≥ nivel aceptable ÷ total × 100 | ídem | ídem |
| | Criterios de aceptación (cantidad) | Nº de criterios cumplidos, de 3 | Calculado | Validación del sistema, tabla de criterios |

Notas:

- **θ_antes** es la habilidad del estudiante antes de responder; **b**, la dificultad del
  ejercicio que el motor le asignó (modelo de Rasch, ver [IRT.md](IRT.md)). Si el
  estudiante aún no tiene θ, la asignación no es evaluable y sale del denominador.
- El **rango objetivo** (50–85 %) y el **nivel aceptable** de calidad (4,0) son
  configurables en Administración → Configuración → Investigación.
- La escala adjetival del SUS usa los cortes de la Tabla 2 del Capítulo III: menos de 51
  deficiente, 51–68 aceptable con reservas, 69–80 bueno, más de 80 excelente.

## 3. Variable independiente (descriptiva)

| Dimensión | Indicador | Fórmula | Tabla |
|---|---|---|---|
| **Adaptabilidad** | Nivel de personalización del contenido (%) | Ejercicios servidos por la ruta adaptativa ÷ ejercicios servidos × 100 | `log_adaptacion.personalizado` |
| **Gamificación** | Retos completados (cantidad) | Entregas aprobadas | `retos_usuario.resuelto` |
| | Cambios de posición en el ranking (cantidad) | Filas con posición anterior | `historial_ranking` |
| **Retroalimentación** | Tiempo de respuesta ante cada actividad resuelta (s) | Desde que llega la respuesta hasta que la corrección está lista | `log_adaptacion.tiempo_respuesta_ms` |

Los tiempos se miden en el **backend** (`process.hrtime.bigint()`), no en el cliente.

## 4. Intervalos de confianza

IC del 95 % por **bootstrap de percentil**: 2000 remuestreos con reemplazo y semilla
fija (`20261011`), de modo que el mismo dato produce siempre el mismo intervalo.
Código: `backend/src/common/estadistica/bootstrap.ts`. El análisis definitivo se
repite fuera del sistema con Python, Pandas y SciPy sobre los CSV exportados.

## 5. Criterios de aceptación

| Criterio | Se cumple si… | Umbral por defecto |
|---|---|---|
| Precisión | el **límite inferior** del IC 95 % del % en rango objetivo alcanza el umbral | ≥ 70 % |
| Usabilidad | el puntaje medio SUS alcanza el rango "bueno" | ≥ 69 |
| Calidad | **todas** las características ISO/IEC 25010 alcanzan el nivel aceptable | media ≥ 4,0 |

Mientras falte algún dato, el panel dice "faltan datos" y no declara la hipótesis ni
aceptada ni rechazada. Los umbrales deben fijarse **antes** de recolectar datos.

## 6. Instrumentos y quién los responde

| Instrumento | Quién | Cuándo | Código |
|---|---|---|---|
| Registro automatizado del motor | El propio sistema | En cada respuesta de práctica | `ejercicios/log-adaptacion.service.ts` |
| SUS (10 ítems, Likert 1–5) | Estudiantes | Una vez, con la fase de evaluación habilitada | `mediciones/instrumentos/sus.ts` |
| ISO/IEC 25010:2023 (Likert 1–5) | Docentes del área y evaluadores (cuenta de rol docente) | Una vez, con la fase habilitada | `mediciones/calidad/items-iso25010.ts` |

La **fase de evaluación** la habilita el docente (menú "Evaluar PREXI") o el admin
(Configuración). Cada persona responde una sola vez por versión del instrumento.

> ⚠ Los ítems del cuestionario ISO/IEC 25010 son **provisionales**. Antes de recolectar
> datos reales hay que reemplazarlos por los validados por juicio de expertos, marcar
> `INSTRUMENTO_VALIDADO = true` y subir la versión, todo en `items-iso25010.ts`.

## 7. Exportación

Investigador → Exportación. Un CSV anonimizado por instrumento, con `id_anonimo` y sin
nombre, CI, RU ni correo:

| Archivo | Una fila por | Indicadores que alimenta |
|---|---|---|
| `log_adaptacion.csv` | decisión del motor | Precisión, latencia, personalización, tiempo de retroalimentación |
| `sus.csv` | estudiante | Usabilidad |
| `iso25010.csv` | evaluador | Calidad |
| `uso_gamificacion.csv` | estudiante | Variable independiente |

El **codebook** (`/api/investigador/codebook.csv`) describe cada columna de cada archivo.
