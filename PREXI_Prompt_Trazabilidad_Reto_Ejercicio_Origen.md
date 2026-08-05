# PREXI — Prompt maestro: mostrar de verdad el ejercicio de origen de cada Reto

Prompt reutilizable. Pégalo completo en Claude Code desde la raíz del `frontend/` (y `backend/` si hace falta ampliar el endpoint), con el proyecto corriendo.

---

## PROMPT (copiar tal cual)

En **PREXI**, cada Reto derivado del banco cita de dónde salió (ej. *"Este reto se basa en el ejercicio E3.6.B.05 de U3 · 3.6 Definición de Funciones en Python"*), pero hoy esa cita es solo texto plano y una línea de enunciado en gris chico — no ayuda a que el estudiante realmente UBIQUE ni ENTIENDA el ejercicio de origen. Tu tarea es convertir esa cita en un bloque de trazabilidad claro, profesional y con criterio de diseño real: descripción completa + un modelo/vista del ejercicio, no solo una referencia de texto.

### 0. Dónde está esto hoy (punto de partida real)

- `frontend/src/app/(estudiante)/retos/[id]/page.tsx`, líneas ~164-176: el bloque `{reto.origen && (...)}` es el que hoy renderiza la cita — ahí es donde trabajas.
- El backend ya arma este dato en `backend/src/modulos/retos/retos.controller.ts` → `detalle()`: hoy solo manda `{ ejercicio_id, codigo, enunciado }` del ejercicio origen. **Nunca** expone `respuestaCorrecta` (esto está documentado a propósito en ese archivo — no lo cambies).
- Revisa también `retos.service.ts` → `disponibles()` (la lista de retos, no el detalle): ya trae `origen_ejercicio: { id, codigo }` en cada tarjeta — evalúa si la tarjeta de la lista también debería insinuar el origen de forma consistente con lo que hagas en el detalle, sin sobrecargarla.

### 1. Qué construir

1. **Amplía el payload del backend** (`RetosController.detalle()`) para incluir, del ejercicio origen, además de lo que ya manda: `tipo` (opcion_multiple/predecir_salida/completar_codigo/ordenar_lineas), y si aplica `codigoPython` y `opciones`. Estos campos YA son públicos en el resto del sistema (se usan para renderizar ejercicios normales) — no estás exponiendo nada nuevo, solo reutilizando lo que el ejercicio original ya muestra. **Sigue sin exponer `respuestaCorrecta` del origen bajo ningún motivo.**
2. **Rediseña el bloque de origen** en la pantalla del reto como una tarjeta clara (no una línea de texto perdida): título tipo "Basado en el ejercicio", el código de banco (`E3.6.B.05`) como badge, el tema/unidad de origen, la sigla del tipo de ejercicio (usa la misma convención OM/PS/CC/OL que ya existe en los bancos de ejercicios), el enunciado COMPLETO (no cortado), y si el ejercicio origen trae `codigoPython` (el snippet con el que trabaja, sin la respuesta) muéstralo con resaltado de sintaxis reutilizando los componentes que ya existen (`components/code-block.tsx` / `components/code-viewer.tsx`) — así el estudiante ve un "modelo" real del ejercicio, no solo lo lee.
3. Hazlo **plegable/expandible** (colapsado por defecto con un resumen de una línea, expandible a la tarjeta completa) para no saturar la pantalla del reto, que ya tiene bastante contenido (editor, consola, panel de ALVARO).
4. Si tiene sentido, agrega un enlace "Ver el ejercicio completo" que lleve a `/ejercicios/[id]` del ejercicio origen (repaso en su contexto real) — **antes de agregarlo, confirma si `GET /ejercicios/:id` ya valida que el nivel del ejercicio coincide con el nivel actual del estudiante en ese tema** (esto se identificó como un hueco pendiente en una auditoría de seguridad anterior de este mismo proyecto). Si ese fix todavía no está aplicado, dilo explícitamente y no agregues el enlace todavía — o aplica tú ese fix puntual primero, mostrándomelo antes de tocar el controller.

### 2. Estilo y tono

- Profesional y con propósito, no decorativo: la idea central es "esto pone a prueba lo que ya practicaste en X" — dale ese enfoque motivador (repaso conectado con lo enseñado), no una cita académica seca.
- Reutiliza el sistema de diseño existente (tokens de color, tipografía, el ícono `BookOpen` que ya se usa para esto) — no introduzcas un estilo visual nuevo para esta tarjeta.
- Debe verse bien en PC y celular, y no debe desplazar el editor de código a un lugar incómodo en pantallas angostas.

### 3. Qué NO hacer

- No expongas `respuestaCorrecta` del ejercicio origen en ningún punto (ni en el backend ni en el frontend).
- No agregues el enlace "Ver ejercicio completo" sin antes confirmar (o corregir) el gating por nivel de `GET /ejercicios/:id`.
- No cambies el resto de la pantalla del reto (editor, consola, panel de ALVARO) — el alcance es solo el bloque de trazabilidad del origen.

### 4. Entregable esperado

1. Diff del backend (campos nuevos en `detalle()`, sin tocar `respuestaCorrecta`).
2. Captura antes/después de la tarjeta de origen en la pantalla del reto (PC y celular).
3. Confirmación explícita de si agregaste el enlace al ejercicio completo, y si tuviste que corregir el gating por nivel para hacerlo con seguridad.

---

## Cómo usar este prompt

1. Copia el bloque **PROMPT** completo.
2. Pégalo en Claude Code parado en la raíz del repo, con el proyecto corriendo.
3. Pide que te muestre el diff del backend y las capturas antes de darlo por cerrado.
