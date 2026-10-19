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
| Resueltos del nivel para pedir la subida | 8 |
| Resueltos del nivel para completar el tema | 10 (todos los del nivel) |

## Diagnóstico inicial

El diagnóstico solo decide **con qué nivel empieza** el estudiante cada tema cuando le
toque (θ de Rasch con los umbrales ±0.5, ver [CLASIFICACION_NIVELES.md](CLASIFICACION_NIVELES.md)).
No desbloquea temas ni unidades: un diagnóstico alto no permite saltarse nada.

## Dentro de una unidad

1. Los temas y subtemas se abren **en orden**: el siguiente se desbloquea al completar el
   anterior (`common/niveles/desbloqueo.ts`). Un tema se completa al resolver **los 10
   ejercicios del nivel en que está** el estudiante en ese tema (o todos los de ese nivel,
   si el docente aún no cargó 10). Cuentan ejercicios distintos: repetir uno no suma. Si
   sube de nivel antes de completarlo, el avance pasa a medirse en el nivel nuevo; una vez
   completo, el tema no vuelve a cerrarse.
2. En cada tema el estudiante practica en su nivel. Al resolver **8 ejercicios** de su nivel
   (o todos, si el tema tiene menos; configurable en `minPractica*`) se abre la **prueba de nivel**: 10 preguntas del nivel
   siguiente y **80 sobre 100** para subir. Si el nivel siguiente tiene menos de 10
   ejercicios, la prueba se completa hasta 10 con los más difíciles del nivel actual.
   Solo cuentan los ejercicios del banco de práctica.
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

Todo se hace en **Unidades**, con un asistente de cuatro pasos por unidad (unidad y temas →
ejercicios → flashcards → examen y publicación):

- Crear unidades, temas y subtemas.
- En cada tema, completar 10 ejercicios por nivel. Un tema no se puede publicar hasta
  tenerlos; el sistema dice cuántos faltan y de qué nivel.
- Las flashcards se preparan por tema (meta: 10): «Generar desde mis ejercicios» crea una
  por cada ejercicio —PREXI redacta el frente; el reverso es siempre la respuesta correcta
  del ejercicio— y también se escriben a mano. Si un tema no tiene ninguna, el estudiante
  recibe las que se derivan solas de sus ejercicios. Cada estudiante ve las de su nivel.
- *Generar con PREXI* propone 10 preguntas del tipo y nivel elegidos (con un PDF, un texto
  pegado o solo el tema). Nada se publica sin que el docente lo apruebe.
- *Examen de la unidad*: 10 preguntas que combinan temas, escritas a mano o generadas.

## Estado del banco de ejercicios

El banco sembrado **no llega** a 10 ejercicios por nivel: en promedio cada tema tiene
unos 7 de nivel básico y 3 de intermedio y de avanzado, y las preguntas de examen
existentes son de un solo tema. El sistema funciona con lo que hay (toma las preguntas
disponibles), pero el estándar de 10 por nivel y de preguntas integradoras depende de que
el docente complete el contenido. La pantalla Unidades muestra el faltante tema por tema.

## Retos

Los retos son práctica extra en el editor de código y tienen dos tipos:

| Tipo | Qué entrega el docente | Cómo se califica |
|---|---|---|
| **Encuentra el bug** | Un código con un error y la salida correcta (ambos obligatorios) | Solo: se compara la salida del estudiante con la correcta |
| **Escribe tu código** | Un problema; el ejemplo y el código de partida son opcionales | El docente, en *Revisiones de retos* |

Cada reto pertenece a un tema y a un nivel: lo ven los estudiantes que están en ese nivel
en ese tema. El docente los crea con un asistente de tres pasos (tipo y tema → contenido →
publicación) y los ve agrupados por tipo, unidad y tema. En el paso del contenido puede
pedirle a PREXI tres ideas para ese tema, tipo y nivel; elegir una solo rellena el
formulario, y la salida correcta de un bug debe comprobarla el docente. Un interruptor único muestra u
oculta todo el módulo.

## Cómo entra un estudiante al curso

Hay dos caminos y ambos terminan igual: el estudiante inicia sesión con su RU.

1. **Lo registra su docente** desde su lista (Registro de estudiantes). Queda inscrito de
   inmediato; su contraseña inicial es su CI y la cambia en el primer ingreso.
2. **Se registra solo** en "Crear cuenta": da apellidos, nombres, CI y RU, y elige su
   materia y paralelo. La cuenta se crea, pero como **solicitud pendiente**. El docente de
   ese paralelo recibe un aviso en la campana, la ve en *Registro de estudiantes → Solicitudes
   por aceptar* y la acepta (en el paralelo pedido o en otro suyo) o
   la rechaza con un mensaje. Mientras no esté aceptado, el estudiante no puede rendir el
   diagnóstico ni aparece en las listas del docente. Si lo rechazan, ve el motivo y puede
   pedir otro paralelo.

El sistema no maneja un cupo numérico por paralelo: al revisar las solicitudes el docente
ve cuántos inscritos tiene cada uno y decide.

## Orden de las preguntas

Para que no sirva copiar "la 3 es la B", dos estudiantes del mismo nivel no reciben las
preguntas en el mismo orden (`backend/src/common/orden/orden-personal.ts`):

- **Práctica de un tema** y **diagnóstico inicial**: cada estudiante tiene su propio orden,
  que sale de su id y es estable; al recargar o volver otro día encuentra lo mismo. En el
  diagnóstico se baraja dentro de cada tema.
- **Evaluación para subir de nivel** y **examen de unidad**: el orden (y, si el banco tiene
  más de 10, la selección) cambia en cada intento.

Las opciones de respuesta de cada pregunta conservan su orden (A, B, C, D).
