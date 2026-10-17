# Contenido de una unidad — formato del archivo `unidad<N>.json`

El seed `prisma/seed-unidad.ts` **no genera contenido**: lee `prisma/data/unidad<N>.json`
(entregado por el autor con revisión pedagógica) y lo siembra. Todo ítem debe ser
**trazable al material oficial** de la UPEA (PRG-111). Material usado hasta hoy:

- **Unidad 1** — banco `PREXI_Unidad1_Banco_Ejercicios.pdf` (250 ítems), derivado de
  "UNIDAD 1 PROGRAMACION 1.pdf" y "PRACTICA_1 PROGRAMACION 1.pdf".
- **Unidad 2** — banco `PREXI_Unidad2_Banco_Ejercicios.pdf` (130 ítems), derivado del
  Módulo Unidad 2 (Programación Estructurada).

El campo `fuente` del archivo encabeza el reporte de trazabilidad; declara ahí de
dónde salió el contenido de esa unidad.

## Comandos

```bash
# 1) Aplicar el schema (columna fuenteDoc) — dentro del contenedor api:
npx prisma db push

# 2) Sembrar (aborta si hay datos de estudiantes; --force para forzar en pre-producción):
npx tsx prisma/seed-unidad.ts --unidad 1
npx tsx prisma/seed-unidad.ts --unidad 2 --force

# 3) Verificar la cobertura del banco sembrado (salvaguarda; sale con 1 si algo falla):
npx tsx scripts/verificar-cobertura-unidad.ts 2
```

El seed: valida TODO el archivo antes de tocar la base → respalda el estado actual en
`prisma/backups/unidad<N>-<fecha>.json` → borra e inserta **en una sola transacción**
(solo bancos `practica`+`examen` de esa unidad y sus retos) → genera
`docs/unidad<N>-trazabilidad.md` + `.csv`. **Pretest/postest jamás se tocan.**
Los temas no se borran: se actualizan por número y los que salgan del temario se
despublican (protege el progreso y los ítems de diagnóstico ligados).

### Conservar contenido que el banco nuevo no cubre

El seed **borra e inserta desde el archivo**: lo que no esté en el JSON desaparece.
Si el material oficial nuevo no cubre un tema que ya funciona (caso del **2.5**, cuyo
módulo aún no fue entregado) o unos retos que quieres mantener, vuélcalos primero:

```bash
npx tsx scripts/exportar-tema-existente.ts --unidad 2 --temas 2.5 --retos
```

Eso imprime el JSON listo para pegar en `temas`/`retos`, marcado con
`fuenteDoc.origen: "preexistente"`. La verificación de cobertura reconoce esa marca y
a esos temas les exige solo el mínimo de 10 ejercicios, no la distribución 15/10/5.

## Estructura (ver `unidad1.ejemplo.json` con el temario 1.1–1.11 ya cargado)

```jsonc
{
  "unidad": { "numero": 1, "titulo": "Fundamentos de la Programación" },
  "autorEmail": "docente@upea.edu.bo",   // autor de los retos (rol docente)
  "temas": [ { "numero": "1.5", "titulo": "…", "descripcion": "…", "umbral": 10,
               "subtemas": [ /* mismo formato, 1 nivel máximo */ ],
               "ejercicios": [ /* ítems */ ], "retos": [ /* retos */ ] } ],
  "examen": [ /* ítems del examen de fin de unidad (banco `examen`) */ ]
}
```

### Ejercicio (banco adaptativo, autoevaluable)

| Campo | Notas |
|---|---|
| `tipo` | `opcion_multiple` \| `predecir_salida` \| `completar_codigo` \| `ordenar_lineas` |
| `nivel` | `basico` \| `intermedio` \| `avanzado` (ámbar/azul/verde en la app) |
| `b` | dificultad IRT esperada por juicio de experto (escala θ; si falta: −1/0/+1 según nivel) |
| `opciones` | `[{id:"A",texto:"…"}]`. En `ordenar_lineas`, cada línea (la sangría va en el texto) |
| `respuestaCorrecta` | letra (opción/predicción) · texto con variantes `a\|b` (completar) · ids `"B,A,C"` (ordenar) |
| `explicacion` | retroalimentación que ve el estudiante |
| `fuenteDoc` | **OBLIGATORIO**: `{unidad, tema, citaBreve}` + opcionales `subtema`, `paginaPDF`, `codigo` |

Sobre `fuenteDoc`: `tema` y `citaBreve` son obligatorios. `paginaPDF` es **opcional**
—los bancos entregados como documento propio citan el módulo por contenido y no por
página—; si se omite, el reporte de trazabilidad lo marca como `—` y lo descuenta del
conteo "con página" (sin castigar el conteo "con tema"). `codigo` guarda la clave de
negocio del banco de origen (ej. `E1.5.I.03`, `EF.04`) para localizar el ítem en ese
documento; es la vía para conservar esa clave **sin migrar el esquema**.

Para el 3er nivel del texto guía (p. ej. `1.5.4.1 Operadores Aritméticos`) usar
`fuenteDoc.subtema`: el sistema modela 2 niveles (Tema → Subtema).

### Reto (estilo Práctica 1: análisis → lógica → código)

`titulo, categoria, nivelSugerido (intermedio|avanzado), enunciado, ejemploEntrada,
ejemploSalida, solucionReferencia, criteriosEvaluacion[], xp, esBugHunt?, fuenteDoc`.

Mapeo a la base: `solucionReferencia` → `respuestaCorrecta` (la ve el docente al
revisar); `criteriosEvaluacion` se anexan al enunciado como rúbrica visible. Los retos
solo los ven Intermedio/Avanzado cuando el docente los habilita (config existente).

### Flashcards

**No se siembran**: se derivan automáticamente del banco de ejercicios (server-side)
y por eso **heredan la trazabilidad** del ejercicio origen. No puntúan ni afectan θ.

### Examen de fin de unidad

Ítems con el mismo formato de ejercicio; `fuenteDoc.tema` debe existir en el temario
(el examen se compone del banco sembrado, no se inventa fuera de él). Si el array
`examen` va vacío, el banco de examen actual no se toca.

## Bancos de las prácticas (U1–U2: Práctica Nro. 1 · U3–U4: Práctica Nro. 2) — carga ADITIVA

| Archivo | Contenido |
|---|---|
| `banco_unidades_1_y_2.json` | 60 preguntas (10 integradoras por unidad × 3 niveles) y 40 retos de la Práctica Nro. 1 |
| `retos_bugs_unidades_1_y_2.json` | 30 retos "Encuentra el bug" de U1 y U2 |
| `banco_unidades_3_y_4.json` | 60 preguntas (10 integradoras por unidad × 3 niveles) y 40 retos de la Práctica Nro. 2 |

Se cargan con un script propio que **no borra nada** y se puede repetir:

```bash
npm run seed:banco                # simulación: valida y muestra qué entra en cada tema
npm run seed:banco -- --aplicar   # escribe en la base (todos los archivos de arriba)
npm run seed:banco -- --archivo banco_unidades_3_y_4.json --aplicar   # solo uno
```

- Las preguntas van al banco de práctica, cada una en su "Tema en PREXI". Una pregunta
  puede integrar temas de unidades anteriores (p. ej. una de U4 que usa 2.4).
- Las 10 versiones intermedias de cada unidad forman su examen (banco `examen`); las
  preguntas de examen anteriores de esas unidades quedan **desactivadas**, no borradas.
- Cada ítem se identifica por `fuenteDoc.codigo` (y cada reto por `codigo`): si ya existe
  se actualiza; si no, se crea. Si un tema del archivo no existe en la base, no se escribe nada.
- La clave de respuestas se reparte A/B/C/D **por archivo**: agregar un banco nuevo no
  reordena las opciones de los que ya estaban.
