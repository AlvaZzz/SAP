# PREXI — Prompt maestro: parejar las tarjetas del Dashboard y arreglar el registro (que quedó roto)

Prompt reutilizable. Pégalo completo en Claude Code desde la raíz del `frontend/`, con el proyecto corriendo y capturas de referencia a mano (adjunta las mismas 2 capturas que usaste para pedir esto: dashboard y registro en desktop).

---

## PROMPT (copiar tal cual)

Tienes dos defectos visuales concretos y ya diagnosticados en **PREXI** (Next.js + Tailwind). No son de gusto ni de rediseño: son bugs de layout con causa identificada. Corrígelos con precisión quirúrgica, sin tocar nada más.

### Defecto 1 — Tarjetas del Dashboard de tamaño desigual

**Dónde:** `frontend/src/app/(estudiante)/dashboard/page.tsx`, línea ~113 — la fila de 3 columnas "Recomendado por ALVARO" / "Tu evolución" / "Progreso por unidad":

```tsx
<div className="grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(300px,0.9fr)] xl:gap-6">
```

**Causa exacta:** `items-start` hace que cada columna del grid tome SOLO el alto de su propio contenido, en vez de estirarse a la altura de la fila. Como "Recomendado por ALVARO" tiene una lista que crece más que las otras dos tarjetas, el resultado es lo que se ve en la captura: alturas desparejas.

**Fix:**
1. Cambia `items-start` por `items-stretch` (o quítalo, que es el valor por defecto de `align-items` en grid).
2. Cada tarjeta hija debe poder estirarse limpio: confirma que el contenedor de cada una use `h-full` y, si tiene contenido interno que varía en longitud (like la lista de "Recomendado por ALVARO"), que ese contenido interno use `flex flex-col` con el área scrolleable acotada (`max-h-[...] overflow-y-auto`) en vez de dejar que la tarjeta crezca sin límite — así, aunque ALVARO recomiende 5 o 15 ejercicios, la tarjeta no vuelve a desnivelar la fila.
3. Verifica el resultado en el breakpoint `lg` (2 columnas) también, no solo en `xl` (3 columnas) — ahí `items-start` tiene el mismo problema.

### Defecto 2 — El panel visual del registro quedó roto (texto superpuesto)

**Dónde:** `frontend/src/app/(auth)/registro/page.tsx` reutiliza `<LoginHero />` (el mismo componente del login) dentro de un contenedor distinto:

```tsx
<div className="hidden lg:block lg:h-screen lg:w-[56%] lg:self-start lg:sticky lg:top-0 2xl:w-[54%]">
  <LoginHero />
</div>
```

**Causa exacta:** `LoginHero` (`frontend/src/components/login/login-hero.tsx`) fue afinado con posiciones ABSOLUTAS y porcentajes (la mascota `bottom-0 right-[2%]`, la lista de beneficios `xl:absolute xl:bottom-[18%] xl:left-0 xl:max-w-[36%]`) calculados a mano para el alto y las proporciones EXACTAS del panel del login. El contenedor del registro (`lg:h-screen lg:sticky`) tiene un alto/comportamiento distinto al del login, así que esos mismos porcentajes caen en otro lugar y el título, la descripción, la mascota y la lista de beneficios terminan superpuestos — exactamente lo que se ve en la captura.

**Fix (elige el camino más limpio, no los mezcles a medias):**
- **Opción A (recomendada):** haz que el contenedor del registro reproduzca EXACTAMENTE la misma estructura de alto que usa `frontend/src/app/(auth)/login/page.tsx` alrededor de `<LoginHero />` (mismo esquema de flex/alto, sin agregarle `sticky`/`h-screen` si el login no lo tiene así), para que los porcentajes ya afinados vuelvan a caer donde deben.
- **Opción B:** si el registro necesita de verdad un contenedor con otra forma (por el `sticky`), haz que `LoginHero` sea robusto a distintas alturas: reemplaza las posiciones absolutas por porcentaje por un layout con CSS grid/flex que reparta el espacio de forma proporcional real (filas: logo+título / mascota / beneficios) en vez de asumir un alto de píxeles fijo. Es más trabajo, pero deja de romperse la próxima vez que se reutilice en un tercer lugar.

En cualquiera de las dos, el resultado final debe verse en el registro **tan limpio y profesional como en el login** (compáralo lado a lado): título y descripción legibles sin cruzarse con la mascota, mascota completa y bien ubicada, lista de beneficios legible y sin solaparse con nada.

### Qué NO hacer

- No cambies el contenido, textos ni datos de ninguna tarjeta del dashboard.
- No rediseñes `LoginHero` desde cero ni cambies el login (que ya funciona bien) — el login es la referencia de cómo debe verse, no lo toques.
- No quites la lista de beneficios ni la mascota del registro: el objetivo es que se posicionen bien, no que desaparezcan.

### Entregable esperado

1. Captura del dashboard después del fix, en el mismo ancho de la captura original, mostrando las 3 tarjetas parejas.
2. Captura del registro después del fix, comparada lado a lado con el login, mostrando que ya no hay superposición.
3. Confirma que probaste ambos en al menos 2 anchos de pantalla (una laptop típica ~1366-1440px y un monitor grande ~1920px), porque el bug del registro es sensible al breakpoint.

---

## Cómo usar este prompt

1. Copia el bloque **PROMPT** completo.
2. Pégalo en Claude Code parado en `frontend/`, con `npm run dev` corriendo, y adjunta las dos capturas originales como referencia de "así se ve mal hoy".
3. Pide las capturas del resultado antes de darlo por cerrado.
