// ════════════════════════════════════════════════════════════════════════════
//  CONTENIDO DEL "DASHBOARD DE DESTINO" (Preview de Unidad)
//  4 zonas por unidad: ① objetivos ② mapa (derivado del temario, no aquí)
//  ③ analogías del mundo real ④ banco de ejemplos ilustrados.
//  Objetivos y analogías son Markdown (editables por el docente); los ejemplos se
//  siembran. Contenido 100% original, sin material de terceros con derechos.
// ════════════════════════════════════════════════════════════════════════════

export interface DashEjemplo {
  titulo: string;
  codigo: string;
  diagrama: string; // diagrama de flujo en texto (monospace)
  salida: string;
}

// ── ① Objetivos de aprendizaje (Markdown; una casilla por objetivo) ──
export const DASH_OBJETIVOS: Record<number, string> = {
  1: `## Al final de esta unidad podrás…
- [ ] Explicar qué es un **algoritmo** (entrada → proceso → salida).
- [ ] Declarar **variables** y usar los tipos básicos: \`int\`, \`float\`, \`str\`, \`bool\`.
- [ ] Convertir entre tipos con \`int()\`, \`float()\` y \`str()\`.
- [ ] Evaluar **expresiones** con operadores aritméticos y lógicos.
- [ ] Leer un **diagrama de flujo** y traducirlo a pasos.`,

  2: `## Al final de esta unidad podrás…
- [ ] Tomar decisiones con \`if\`, \`elif\` y \`else\`.
- [ ] Repetir acciones un número conocido de veces con \`for\` y \`range()\`.
- [ ] Repetir mientras se cumpla una condición con \`while\`.
- [ ] Controlar el flujo con \`break\` y \`continue\`.
- [ ] Construir un **acumulador/contador** para resolver un caso real.`,

  3: `## Al final de esta unidad podrás…
- [ ] Dividir un problema en **funciones** con \`def\` y \`return\`.
- [ ] Pasar **parámetros** y usar valores por defecto.
- [ ] Reutilizar tu código evitando repetirlo.
- [ ] Entender la **recursividad** y su caso base.`,

  4: `## Al final de esta unidad podrás…
- [ ] Guardar colecciones de datos en **listas** (vectores).
- [ ] Recorrer, buscar, sumar y contar sobre una lista.
- [ ] Trabajar con **matrices** (listas de listas) y su doble índice.
- [ ] Procesar **cadenas de caracteres** carácter a carácter.`,

  5: `## Al final de esta unidad podrás…
- [ ] Crear una ventana y **widgets** con \`tkinter\` (\`Label\`, \`Button\`, \`Entry\`).
- [ ] Entender la programación **dirigida por eventos**.
- [ ] Asociar una función a un botón con \`command\`.
- [ ] Construir una mini‑aplicación interactiva.`,
};

// ── ③ Analogías del mundo real (Markdown) ──
export const DASH_ANALOGIAS: Record<number, string> = {
  1: `## Analogías para entenderlo
- **Variable = caja etiquetada.** Guardas un valor dentro y le pones un nombre en la etiqueta; puedes cambiar el contenido cuando quieras.
- **Tipo de dato = forma de la caja.** Una caja para números (\`int\`), otra para texto (\`str\`), otra para verdadero/falso (\`bool\`).
- **Algoritmo = receta de cocina.** Pasos ordenados y finitos: ingredientes (entrada) → preparación (proceso) → plato (salida).`,

  2: `## Analogías para entenderlo
- **Condicional \`if\` = bifurcación en el camino.** Según la señal, tomas la ruta izquierda o la derecha.
- **Bucle \`for\` = línea de ensamblaje.** Cada pieza pasa por la misma estación y recibe el mismo trabajo.
- **Bucle \`while\` = grifo abierto.** El agua fluye *mientras* la llave siga abierta (la condición sea verdadera).
- **Acumulador = alcancía.** Cada moneda se suma al total que ya tenías dentro.`,

  3: `## Analogías para entenderlo
- **Función = electrodoméstico.** Le das entradas (ingredientes), hace su tarea y te devuelve un resultado; no necesitas saber cómo funciona por dentro.
- **Parámetro = perilla de ajuste.** Cambias el valor de entrada y la función responde distinto.
- **Recursividad = muñecas rusas (matrioskas).** Cada muñeca contiene una más pequeña, hasta la última (el caso base) que ya no se abre.`,

  4: `## Analogías para entenderlo
- **Lista (vector) = fila de casilleros numerados.** Cada casillero guarda un valor y tiene un número de posición (índice) que empieza en 0.
- **Matriz = tablero de ajedrez.** Localizas cada casilla con dos coordenadas: fila y columna.
- **Cadena = collar de cuentas.** Cada letra es una cuenta en orden que puedes recorrer una por una.`,

  5: `## Analogías para entenderlo
- **Ventana = tablero de una app.** El contenedor donde colocas todos los controles.
- **Widget = control de un tablero.** Botones, etiquetas y cajas de texto, como los botones de un microondas.
- **Evento = timbre de la casa.** El programa espera tranquilo hasta que alguien toca el timbre (clic) y entonces reacciona.`,
};

// ── ④ Banco de ejemplos ilustrados ──
export const DASH_EJEMPLOS: Record<number, DashEjemplo[]> = {
  1: [
    {
      titulo: 'Guardar datos en variables e imprimirlos',
      codigo: 'nombre = "Ana"\nedad = 20\nprint(nombre, "tiene", edad, "años")',
      diagrama: '( inicio )\n    │\n nombre = "Ana"\n    │\n edad = 20\n    │\n mostrar nombre, edad\n    │\n ( fin )',
      salida: 'Ana tiene 20 años',
    },
    {
      titulo: 'Convertir texto a número y operar',
      codigo: 'texto = "15"\nnumero = int(texto)\nprint(numero + 5)',
      diagrama: '( inicio )\n    │\n texto = "15"\n    │\n numero = int(texto)\n    │\n mostrar numero + 5\n    │\n ( fin )',
      salida: '20',
    },
  ],
  2: [
    {
      titulo: 'Decidir si un número es par o impar',
      codigo: 'n = 7\nif n % 2 == 0:\n    print("Par")\nelse:\n    print("Impar")',
      diagrama: '( inicio )\n    │\n  ¿n % 2 == 0?\n   ╱      ╲\n  Sí       No\n  │         │\nprint(Par) print(Impar)\n   ╲      ╱\n   ( fin )',
      salida: 'Impar',
    },
    {
      titulo: 'Sumar del 1 al 5 con un acumulador',
      codigo: 'total = 0\nfor n in range(1, 6):\n    total = total + n\nprint(total)',
      diagrama: '( inicio )\n    │\n total = 0\n    │\n┌▶ ¿quedan n? ─No─▶ print(total) ─▶( fin )\n│      │Sí\n│ total = total + n\n└──────┘',
      salida: '15',
    },
  ],
  3: [
    {
      titulo: 'Una función que devuelve el doble',
      codigo: 'def doble(x):\n    return x * 2\n\nprint(doble(5))',
      diagrama: 'llamar doble(5)\n    │\n dentro: x = 5\n    │\n return 5 * 2\n    │\n mostrar 10',
      salida: '10',
    },
    {
      titulo: 'Factorial con recursividad',
      codigo: 'def factorial(n):\n    if n == 0:\n        return 1\n    return n * factorial(n - 1)\n\nprint(factorial(3))',
      diagrama: 'factorial(3)\n = 3 * factorial(2)\n = 3 * 2 * factorial(1)\n = 3 * 2 * 1 * factorial(0)\n = 3 * 2 * 1 * 1  ◀ caso base\n = 6',
      salida: '6',
    },
  ],
  4: [
    {
      titulo: 'Promedio de una lista',
      codigo: 'notas = [7, 8, 6, 9]\nprint(sum(notas) / len(notas))',
      diagrama: '( inicio )\n    │\n notas = [7, 8, 6, 9]\n    │\n suma = 30 ; cantidad = 4\n    │\n mostrar 30 / 4\n    │\n ( fin )',
      salida: '7.5',
    },
    {
      titulo: 'Acceder a una matriz por fila y columna',
      codigo: 'm = [[1, 2], [3, 4]]\nprint(m[1][0])',
      diagrama: ' m = [[1, 2],\n      [3, 4]]\n        │\n fila 1 = [3, 4]\n        │\n columna 0 = 3',
      salida: '3',
    },
  ],
  5: [
    {
      titulo: 'Ventana con una etiqueta',
      codigo: 'import tkinter as tk\nventana = tk.Tk()\ntk.Label(ventana, text="Hola").pack()\nventana.mainloop()',
      diagrama: 'crear ventana (Tk)\n    │\n agregar Label "Hola"\n    │\n mostrar y esperar eventos\n (mainloop)',
      salida: '[ventana con el texto "Hola"]',
    },
    {
      titulo: 'Botón que responde a un clic (evento)',
      codigo: 'import tkinter as tk\ndef saludar():\n    print("¡Hola!")\nventana = tk.Tk()\ntk.Button(ventana, text="Ok", command=saludar).pack()\nventana.mainloop()',
      diagrama: ' usuario hace clic\n        │\n  se dispara el evento\n        │\n  se ejecuta saludar()\n        │\n  imprime "¡Hola!"',
      salida: '¡Hola!  (al pulsar el botón)',
    },
  ],
};

// ── Tiempo estimado por unidad (minutos) ──
export const DASH_MINUTOS: Record<number, number> = { 1: 90, 2: 80, 3: 60, 4: 70, 5: 50 };
