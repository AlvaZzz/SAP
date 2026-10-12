# Reglas de avance y de contenido

Qué tiene que pasar para que un estudiante suba de nivel, complete un tema y pase a la
siguiente unidad, y qué tiene que cargar el docente para que eso funcione. Todas las
reglas se calculan en el backend; las constantes están en
`backend/src/common/niveles/reglas-evaluacion.ts`.

## Una sola escala

| Regla | Valor |
|---|---|
| Preguntas por evaluación (subida de nivel y examen de unidad) | 10 |
| Puntaje máximo | 100 |
| Nota para aprobar / subir de nivel | 80 |
| "Cerca de aprobar" (lo ve el docente) | 70 a 79 |
| Ejercicios que cada tema necesita por nivel | 10 en Básico, 10 en Intermedio, 10 en Avanzado |

## Diagnóstico inicial

El diagnóstico solo decide **con qué nivel empieza** el estudiante cada tema cuando le
toque (θ de Rasch con los umbrales ±0.5, ver [CLASIFICACION_NIVELES.md](CLASIFICACION_NIVELES.md)).
No desbloquea temas ni unidades: un diagnóstico alto no permite saltarse nada.

## Dentro de una unidad

1. Los temas y subtemas se abren **en orden**: el siguiente se desbloquea al completar el
   anterior (`common/niveles/desbloqueo.ts`).
2. En cada tema el estudiante practica en su nivel. Para subir rinde una evaluación de
   10 preguntas del nivel siguiente y necesita **80 sobre 100**.
3. Una respuesta puede ser correcta, **parcial** o incorrecta (`ejercicios/correccion.ts`).
   En la práctica, una respuesta parcial muestra qué falta y se puede completar. En una
   evaluación o examen cuenta con su puntaje proporcional y no se puede completar.
4. θ (Rasch) se sigue calculando y guardando como dato complementario para el análisis;
   ya no decide la subida de nivel.

## Examen de la unidad

- 10 preguntas de nivel intermedio, sobre 100. Se aprueba con 80.
- Cada pregunta **combina 2 o 3 temas o subtemas** de la unidad (`Ejercicio.temasIntegrados`).
  El examen prefiere estas preguntas; si el docente aún no cargó 10, completa con las que haya.
- Se habilita cuando el estudiante completó **todos** los temas y subtemas de la unidad y
  está al menos en nivel intermedio en cada uno.
- Si no llegó a eso, el docente puede **habilitarlo a mano** desde *Exámenes de unidad*
  (queda registrado quién y cuándo en `HabilitacionExamen`).
- La unidad siguiente solo se abre al **aprobar** el examen de la anterior.

No existe una "evaluación final" aparte: la evaluación de cierre es el examen de cada unidad.

## Qué carga el docente

Todo se hace en **Unidades**:

- Crear unidades, temas y subtemas.
- En cada tema, completar 10 ejercicios por nivel. Un tema no se puede publicar hasta
  tenerlos; el sistema dice cuántos faltan y de qué nivel.
- Las flashcards no se cargan: salen de los ejercicios activos y cada estudiante ve las de
  su nivel en ese tema.
- *Generar con PREXI* propone 10 preguntas del tipo y nivel elegidos (con un PDF, un texto
  pegado o solo el tema). Nada se publica sin que el docente lo apruebe.
- *Examen de la unidad*: 10 preguntas que combinan temas, escritas a mano o generadas.

## Estado del banco de ejercicios

El banco sembrado **no llega** a 10 ejercicios por nivel: en promedio cada tema tiene
unos 7 de nivel básico y 3 de intermedio y de avanzado, y las preguntas de examen
existentes son de un solo tema. El sistema funciona con lo que hay (toma las preguntas
disponibles), pero el estándar de 10 por nivel y de preguntas integradoras depende de que
el docente complete el contenido. La pantalla Unidades muestra el faltante tema por tema.
