# Créditos y licencia de los sonidos — PREXI

Todos los efectos de sonido del módulo de ejercicios se **generan por síntesis en
el navegador** con la **Web Audio API** (osciladores tipo *sine* con envolvente
de amplitud). **No se descarga ni se incrusta ningún archivo de audio de
terceros.**

## Implicación de derechos de autor

Al no existir ninguna obra de terceros, estos sonidos están **libres de derechos
por construcción** (equivalente a **CC0 / dominio público**): son datos generados
proceduralmente por el propio código de la aplicación. No provienen de
videojuegos, apps comerciales, YouTube ni bancos de sonido, por lo que **no
requieren atribución ni pago de regalías**.

- **Autoría:** PREXI (código propio).
- **Licencia:** CC0 1.0 (dominio público) — generación procedural, sin material
  de terceros.
- **Código fuente de la síntesis:** [`frontend/src/lib/sonidos.ts`](../../src/lib/sonidos.ts)
- **Gestor de reproducción (hook):** [`frontend/src/components/use-sound.ts`](../../src/components/use-sound.ts)

## Sonidos implementados

| Evento                         | Clave (`Sonido`) | Descripción sonora                                   |
|--------------------------------|------------------|-----------------------------------------------------|
| Click GLOBAL de botones        | `click`          | Un *tap* muy corto y suave (una nota). Conectado a TODOS los botones vía `SonidoGlobal`. |
| Respuesta correcta / "Ya la sé"| `acierto`        | Dos notas altas breves, positivas y muy sutiles.   |
| Respuesta incorrecta           | `incorrecto`     | Dos notas descendentes **consonantes** y amables (no estridente). |
| Notificación de PREXI         | `notificacion`   | *Chime* ascendente breve, tipo campanita.          |
| Voltear flashcard              | `flip`           | Subidita rápida de dos notas, casi un soplo.       |
| Descarte "Repasar" (flashcards)| `neutro`         | Una sola nota media, sin juicio.                   |
| Mazo completado                | `nivel`          | Dos notas ascendentes (logro corto).               |
| Emblema / medalla conseguida   | `emblema`        | Arpegio ascendente brillante (celebración corta).  |
| Subida de rango                | `rango`          | Fanfarria corta de logro.                          |
| Unidad completada              | `unidad`         | Acorde arpegiado más amplio.                       |

## Notas de uso

- **Volumen bajo por defecto** (maestro ≈ 0.3; los sonidos frecuentes — click,
  flip, acierto — aún más bajos) para que sea agradable y no invasivo en un aula.
- **Solo se reproducen tras una interacción** del usuario (se respeta la política
  de *autoplay* del navegador; nada suena al cargar la página).
- **Silencio global** con un clic en el altavoz de la barra superior
  (`SonidoToggle`); la preferencia se persiste por usuario.
- Los sonidos son un **complemento**: acertar/fallar se sigue indicando también
  visualmente (verde/rojo). Si el usuario silenció, no suena nada.

> Esta carpeta (`public/sounds/`) queda reservada por si en el futuro se añaden
> archivos `.mp3`/`.ogg`. Si se agregan, **deben** ser CC0 / libres de regalías
> (Freesound filtrando CC0, Pixabay Audio, o generados) y documentarse aquí con su
> fuente, autor y licencia.
