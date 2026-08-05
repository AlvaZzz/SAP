# PREXI — Prompt maestro: mejorar la interfaz de login/registro (PC y celular) + correo libre

Prompt reutilizable. Pégalo completo en Claude Code desde la raíz del **frontend**, con el proyecto corriendo (`npm run dev`) y acceso a un navegador (Chrome DevTools / modo responsivo o Playwright) para poder VER la pantalla real antes de tocar CSS.

---

## PROMPT (copiar tal cual)

Eres responsable de mejorar la interfaz del **módulo de autenticación de PREXI** (Next.js + TailwindCSS): `frontend/src/app/(auth)/login/page.tsx`, `frontend/src/app/(auth)/registro/page.tsx`, `frontend/src/app/recuperar-contrasena/page.tsx`, `frontend/src/app/restablecer-contrasena/page.tsx`, y los componentes que usan (`components/login/*`). El diseño visual (paleta, tipografía, marca, mascota) ya está aprobado — **no lo rediseñes desde cero**. El problema reportado es de **espacio y estructura**: los campos se sienten apretados/recortados y no se ve suficientemente claro, tanto en computadora como en celular. Además hay un bug funcional: el login sigue exigiendo correo institucional cuando ya no debería.

### 0. Antes de tocar nada: mira la pantalla real

No cambies una sola línea de CSS a ciegas. Primero:

1. Levanta el frontend y abre cada una de las 4 pantallas (login, registro, recuperar contraseña, restablecer contraseña).
2. Tómales captura en estos anchos, como mínimo: **375px y 414px** (celular), **768px** (tablet), **1024–1280px** (laptop angosta — aquí es más probable que se "coma" espacio), **1440px+** (desktop grande).
3. Anota concretamente qué se ve mal en cada una (texto cortado, inputs muy angostos para escribir cómodo, elementos solapados, scroll horizontal, botón fuera de la vista con el teclado del celular abierto, etc.) antes de proponer el fix. El diagnóstico visual concreto es el Paso 1; no pases al Paso 2 sin él.

### 1. Objetivo

1. **Todos los campos deben tener el espacio necesario para escribir cómodo**, en PC y en celular: sin inputs angostos, sin textos de ayuda o de error que se solapen con otros elementos, sin scroll horizontal nunca.
2. **El correo electrónico debe aceptar cualquier dirección**, no solo `@upea.edu.bo`: el correo es el canal por el que se contactará a cada usuario, así que debe poder ser el que la persona ya usa (Gmail, Outlook, etc.).

### 2. El bug del correo institucional (arréglalo primero, es concreto)

En `frontend/src/lib/validation.ts`, `loginSchema` tiene:

```ts
.refine((v) => v.toLowerCase().endsWith(DOMINIO_INSTITUCIONAL), `Usa tu correo institucional (${DOMINIO_INSTITUCIONAL}).`)
```

Esto bloquea el login de cualquier correo que no termine en `@upea.edu.bo`. Es inconsistente con el resto del sistema:
- El backend (`RegisterDto` en `backend/src/auth/dto/auth.dto.ts`) ya acepta cualquier correo válido — la restricción institucional está deshabilitada a propósito.
- La página de registro (`registro/page.tsx`) ya valida con un regex de correo genérico, sin exigir el dominio.

Solo el **login** quedó desincronizado. Quita ese `.refine(...)` (deja solo `.email(...)`), y de paso:
- Revisa con un `grep -ri "upea.edu.bo"` en `frontend/src` que no quede la misma restricción escondida en otro lado (placeholder, mensaje de error, validación duplicada).
- Cambia el label "Correo institucional" por algo neutral como "Correo electrónico", y el placeholder `tucorreo@upea.edu.bo` por algo genérico (`tucorreo@ejemplo.com`). Si tiene sentido, agrega un texto de ayuda breve tipo "Usaremos este correo para contactarte" — sin exagerar el copy, una línea corta.

### 3. Por pantalla, qué revisar

**Login (`login-form.tsx`)**: solo 2 campos + checkbox "Recordarme" + link — si a pesar de eso se ve apretado, probablemente sea el padding interno de la card o el espaciado vertical entre bloques. En celular, confirma que con el teclado abierto el botón "Ingresar" y el mensaje de error/bloqueo (429) sigan visibles o accesibles con scroll, y que el ícono de "correo válido" (`CheckCircle`) no se solape con el botón de mostrar/ocultar contraseña.

**Registro (`registro/page.tsx`)**: 7 campos (nombre, correo, cédula, carrera, paralelo, contraseña, confirmar) en una rejilla de 2 columnas — es el candidato más probable al apretujamiento reportado, sobre todo en laptops de 1024–1280px donde el panel del formulario queda angosto. Revisa:
- Que en móvil colapse limpio a 1 columna (sin quedar a medio camino en tablets).
- Que el `<select>` de carrera tenga el mismo alto y estilo que los inputs de texto (no debe verse más chico ni desalineado).
- Que el medidor de fuerza de contraseña y los mensajes de error reserven su espacio (o usen una transición suave) en vez de empujar el resto del formulario de golpe cuando aparecen.
- Que en el ancho de laptop angosta los inputs de la rejilla de 2 columnas no queden tan angostos que resulte incómodo escribir un correo o una carrera larga — si hace falta, baja a 1 columna antes de lo que hoy tenga como breakpoint.

**Recuperar contraseña / Restablecer contraseña**: son pantallas de 1 columna, más simples. Confirma que tengan el mismo aire (padding, separación entre label/input/mensaje de error) que el resto del sistema, y que la barra de fuerza de contraseña en "restablecer" no quede pegada al input.

### 4. Qué NO hacer

- No cambies la paleta de colores, la tipografía, el logo ni la mascota (`PenguinMascot`, `LoginHero`, `PrexiLogo`).
- No quites ni renombres ningún campo del formulario (los datos que se piden ya están definidos).
- No toques la lógica de autenticación, validación de contraseña, ni las llamadas a la API — eso ya se resolvió en un prompt anterior; este es un cambio de **espaciado y estructura visual**, no de comportamiento (salvo el punto 2, que es el único fix funcional).
- No reintroduzcas la restricción de dominio institucional en ningún punto nuevo.
- No uses una librería nueva de UI: quédate con Tailwind + los componentes ya existentes (`inputAuthCls`, `Campo`, etc.).

### 5. Entregable esperado

1. Capturas ANTES/DESPUÉS de las 4 pantallas en al menos 3 anchos (celular, laptop angosta, desktop grande).
2. Diff de los archivos tocados (CSS/Tailwind + el fix de `validation.ts`).
3. Confirmación de que un registro y un login con un correo NO institucional (ej. `alguien@gmail.com`) funcionan sin error.
4. Confirmación de que ningún campo queda cortado, solapado, ni obliga a scroll horizontal en ninguno de los anchos probados.

---

## Cómo usar este prompt

1. Copia el bloque **PROMPT** completo.
2. Pégalo en Claude Code parado en `frontend/`, con `npm run dev` corriendo.
3. Deja que capture el estado actual (Paso 0) antes de aprobar cualquier cambio de espaciado.
4. Revisa las capturas antes/después que te entregue antes de dar por cerrado el ajuste.
