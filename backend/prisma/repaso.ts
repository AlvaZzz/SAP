// ════════════════════════════════════════════════════════════════════════════
//  CONTENIDO DE REPASO/CIERRE + BANCO DEL EXAMEN DE FIN DE UNIDAD
//  · Repaso por UNIDAD (fase previa al postest) y por TEMA (fase previa al examen
//    de unidad). Markdown, editable por el docente. Contenido de CIERRE (consolida
//    lo trabajado), distinto de la introducción inicial.
//  · Banco de EXAMEN de fin de unidad (banco='examen'), asociado a los temas de
//    cada unidad. Preguntas PROPIAS y DISTINTAS del diagnóstico y de la práctica
//    (aplicadas, un poco más exigentes), con spread de dificultad para estimar θ.
//  Contenido 100% original, sin reproducir material de terceros con derechos.
// ════════════════════════════════════════════════════════════════════════════

import { DiagItem, DiagTema } from './diagnostico';

// ── Repaso de cierre por UNIDAD (previo al postest; una pestaña por unidad) ──
export const REPASO_UNIDADES: Record<number, string> = {
  1: `## Lo esencial que ya dominas
Cerramos los **fundamentos**: pensar el problema como un **algoritmo** (entrada → proceso → salida) antes de programar, y manejar los **tipos de datos** y **variables** básicos.

## Conceptos clave a recordar
- Un algoritmo es **finito y ordenado**; primero se diseña, luego se codifica.
- Tipos: \`int\`, \`float\`, \`str\`, \`bool\`. El operador \`/\` siempre da \`float\`.
- Una variable **guarda** un valor y puede cambiar durante la ejecución.

## Antes de la evaluación final
Repasa cómo descomponer un problema en pasos y cómo elegir el tipo de dato correcto: son la base de todo lo que sigue.`,

  2: `## Lo esencial que ya dominas
La **programación estructurada**: secuencia, **decisiones** (\`if/elif/else\`) y **repetición** (\`for/while\`). Con estas tres estructuras se construye casi cualquier lógica.

## Conceptos clave a recordar
- \`if/elif/else\` elige un camino según una condición.
- \`for\` cuando conoces las repeticiones; \`while\` mientras se cumpla algo.
- **Acumuladores** y **contadores** dentro de bucles resuelven sumas y conteos.

## Antes de la evaluación final
Ten claro cuándo usar cada estructura y cómo combinar condición + repetición.`,

  3: `## Lo esencial que ya dominas
La **programación modular**: dividir el problema en **funciones** con \`def\` y \`return\`, y la idea de **recursividad** (una función que se llama a sí misma con un caso base).

## Conceptos clave a recordar
- Una función encapsula una tarea, recibe **parámetros** y **devuelve** un valor.
- Modularizar hace el código legible, reutilizable y fácil de probar.
- Toda recursión necesita un **caso base** para terminar.

## Antes de la evaluación final
Practica identificar qué partes de un problema conviene extraer a funciones.`,

  4: `## Lo esencial que ya dominas
Las **estructuras de datos**: **vectores** (listas), **matrices** (listas de listas) y **cadenas**, recorridas con bucles para buscar, sumar, contar y transformar.

## Conceptos clave a recordar
- La lista se indexa desde **0**; \`len()\`, \`sum()\` y los bucles la recorren.
- Una matriz se accede con dos índices: \`m[fila][columna]\`.
- El doble bucle recorre todos los elementos de una matriz.

## Antes de la evaluación final
Repasa el recorrido de listas y matrices: aparece en casi todos los problemas.`,

  5: `## Lo esencial que ya dominas
La **interfaz gráfica** con \`tkinter\` y la **programación dirigida por eventos**: la ventana espera a que el usuario actúe y responde con funciones manejadoras.

## Conceptos clave a recordar
- \`tk.Tk()\` crea la ventana; los **widgets** (\`Label\`, \`Button\`, \`Entry\`) la componen.
- Un **evento** (clic, tecla) dispara su **callback** (\`command=funcion\`).
- Se pasa la función **sin paréntesis** para que tkinter la llame al ocurrir el evento.

## Antes de la evaluación final
Ten presente el cambio de mentalidad: el programa reacciona a eventos, no manda.`,
};

// ── Repaso de cierre por TEMA (previo al examen de fin de unidad) ──
export const REPASO_TEMAS: Record<string, string> = {
  '1.1': `**Algoritmos.** Recuerda: pasos finitos y ordenados con esquema **entrada → proceso → salida**. Antes de codificar, escribe el algoritmo en lenguaje natural o pseudocódigo.`,
  '1.5': `**Tipos de datos y variables.** \`int\`, \`float\`, \`str\`, \`bool\`. Cuidado: \`/\` devuelve \`float\`; \`str * int\` repite el texto. Convierte con \`int()\`, \`float()\`, \`str()\`.`,
  '2.3': `**Condicionales.** \`if/elif/else\` evalúa condiciones en orden y ejecuta la **primera** rama verdadera. La indentación define el bloque de cada rama.`,
  '2.4': `**Bucles.** \`for i in range(n)\` repite n veces (0..n-1); \`while\` repite mientras la condición sea verdadera. Usa un **acumulador** para sumar dentro del bucle.`,
  '3.2': `**Funciones.** \`def nombre(parámetros): ... return valor\`. Sin \`return\`, la función devuelve \`None\`. Los parámetros pueden tener **valor por defecto**.`,
  '3.3': `**Recursividad.** Una función que se llama a sí misma. Necesita un **caso base** (condición de parada) y un paso que se acerque a él, o no termina.`,
  '4.1': `**Vectores (listas).** Indexadas desde 0. \`len(lista)\`, \`sum(lista)\`, \`lista.append(x)\`. El promedio es \`sum(lista)/len(lista)\`.`,
  '4.2': `**Matrices.** Lista de listas; \`m[fila][columna]\`. Se recorren con **dos bucles** anidados (filas × columnas).`,
  '5.1': `**Componentes de la GUI.** \`tk.Tk()\` es la ventana; \`Label\`, \`Button\`, \`Entry\` son widgets. \`.pack()\` o \`.grid()\` los colocan.`,
  '5.2': `**Eventos.** El usuario interactúa y el programa responde. En un botón, \`command=funcion\` (sin paréntesis) asocia el manejador que se ejecuta al hacer clic.`,
};

// ── Banco del EXAMEN de fin de unidad (banco='examen'), por tema ──
//  Preguntas APLICADAS, distintas del diagnóstico. 4 por tema (spread de dificultad).
export const EXAMEN_UNIDAD: DiagTema[] = [
  // ───────── UNIDAD 1 ─────────
  {
    tema: '1.1',
    categoria: 'Algoritmos',
    items: [
      {
        enunciado: 'Un algoritmo para calcular el área de un triángulo (base × altura ÷ 2) necesita como ENTRADA:',
        opciones: ['La base y la altura.', 'Solo el área.', 'El perímetro.', 'Nada, se calcula solo.'],
        correcta: 0,
        expl: 'La entrada son los datos necesarios para el proceso: base y altura.',
        estrellas: 2,
      },
      {
        enunciado: '¿Cuál de estas NO es una característica de un algoritmo?',
        opciones: ['Ser infinito.', 'Ser preciso.', 'Ser finito.', 'Tener un orden definido.'],
        correcta: 0,
        expl: 'Todo algoritmo debe ser finito; un proceso infinito no es un algoritmo válido.',
        estrellas: 3,
      },
      {
        enunciado: 'En el esquema entrada → proceso → salida, calcular el promedio de 3 notas es:',
        opciones: ['El proceso.', 'La entrada.', 'La salida.', 'Ninguno.'],
        correcta: 0,
        expl: 'Leer las notas es la entrada, calcular el promedio es el proceso y mostrarlo es la salida.',
        estrellas: 3,
      },
      {
        enunciado: 'Ordena mentalmente: para saber si alguien aprueba (nota ≥ 51), lo PRIMERO del algoritmo es:',
        opciones: ['Leer la nota.', 'Mostrar "Aprobado".', 'Comparar con 51.', 'Terminar.'],
        correcta: 0,
        expl: 'Primero se obtiene el dato (entrada), luego se procesa (comparación) y al final se muestra.',
        estrellas: 4,
      },
    ],
  },
  {
    tema: '1.5',
    categoria: 'Tipos de datos',
    items: [
      {
        enunciado: '¿Qué imprime?',
        codigo: 'a = 10\nb = 3\nprint(a % b)',
        opciones: ['1', '3', '0', '3.33'],
        correcta: 0,
        expl: 'El operador % da el resto: 10 entre 3 es 3 con resto 1.',
        estrellas: 2,
      },
      {
        enunciado: '¿De qué tipo es el resultado de 4 == 4?',
        opciones: ['bool', 'int', 'str', 'float'],
        correcta: 0,
        expl: 'Una comparación devuelve un booleano (True/False).',
        estrellas: 3,
      },
      {
        enunciado: '¿Qué imprime?',
        codigo: 'x = int("7")\nprint(x + 3)',
        opciones: ['10', '73', '"73"', 'Error'],
        correcta: 0,
        expl: 'int("7") convierte el texto a 7; 7 + 3 = 10.',
        estrellas: 3,
      },
      {
        enunciado: '¿Cuál da error de tipos en Python?',
        opciones: ['"2" + 3', '"2" * 3', '2 + 3', 'str(2) + "3"'],
        correcta: 0,
        expl: 'No se puede sumar str + int; sí se puede repetir con *, o convertir con str().',
        estrellas: 5,
      },
    ],
  },

  // ───────── UNIDAD 2 ─────────
  {
    tema: '2.3',
    categoria: 'Condicionales',
    items: [
      {
        enunciado: '¿Qué imprime?',
        codigo: 'x = 5\nif x > 3:\n    print("A")\nelse:\n    print("B")',
        opciones: ['A', 'B', 'AB', 'Nada'],
        correcta: 0,
        expl: '5 > 3 es verdadero → imprime "A".',
        estrellas: 2,
      },
      {
        enunciado: '¿Qué imprime?',
        codigo: 'n = 0\nif n > 0:\n    print("pos")\nelif n == 0:\n    print("cero")\nelse:\n    print("neg")',
        opciones: ['cero', 'pos', 'neg', 'Error'],
        correcta: 0,
        expl: 'n no es > 0 pero sí == 0 → entra en el elif e imprime "cero".',
        estrellas: 3,
      },
      {
        enunciado: '¿Qué condición es verdadera si edad está entre 18 y 65 (inclusive)?',
        opciones: ['18 <= edad <= 65', 'edad > 18 or edad < 65', 'edad == 18 and 65', '18 < edad > 65'],
        correcta: 0,
        expl: 'Python permite encadenar: 18 <= edad <= 65.',
        estrellas: 4,
      },
      {
        enunciado: '¿Qué imprime?',
        codigo: 'a = 7\nif a % 2 == 0:\n    print("par")\nelif a > 5:\n    print("grande")\nelse:\n    print("otro")',
        opciones: ['grande', 'par', 'otro', 'Nada'],
        correcta: 0,
        expl: '7 no es par; 7 > 5 → "grande".',
        estrellas: 4,
      },
    ],
  },
  {
    tema: '2.4',
    categoria: 'Bucles',
    items: [
      {
        enunciado: '¿Cuántas veces se ejecuta el bucle?',
        codigo: 'for i in range(2, 6):\n    print(i)',
        opciones: ['4', '6', '3', '5'],
        correcta: 0,
        expl: 'range(2,6) genera 2,3,4,5 → 4 iteraciones.',
        estrellas: 2,
      },
      {
        enunciado: '¿Qué imprime?',
        codigo: 'p = 1\nfor i in range(1, 4):\n    p = p * i\nprint(p)',
        opciones: ['6', '3', '4', '1'],
        correcta: 0,
        expl: '1*1*2*3 = 6 (factorial de 3).',
        estrellas: 4,
      },
      {
        enunciado: '¿Qué imprime?',
        codigo: 'c = 0\nn = 5\nwhile n > 0:\n    c += 1\n    n -= 1\nprint(c)',
        opciones: ['5', '0', '4', 'infinito'],
        correcta: 0,
        expl: 'El while resta 1 a n en cada vuelta y suma 1 a c: 5 vueltas → c=5.',
        estrellas: 3,
      },
      {
        enunciado: '¿Qué hace break dentro de un for?',
        opciones: ['Corta el bucle inmediatamente.', 'Salta a la siguiente vuelta.', 'Reinicia el bucle.', 'No hace nada.'],
        correcta: 0,
        expl: 'break termina el bucle; continue salta a la siguiente iteración.',
        estrellas: 3,
      },
    ],
  },

  // ───────── UNIDAD 3 ─────────
  {
    tema: '3.2',
    categoria: 'Funciones',
    items: [
      {
        enunciado: '¿Qué imprime?',
        codigo: 'def suma(a, b):\n    return a + b\n\nprint(suma(4, 6))',
        opciones: ['10', '46', 'None', 'Error'],
        correcta: 0,
        expl: 'suma(4,6) devuelve 10.',
        estrellas: 2,
      },
      {
        enunciado: '¿Qué devuelve una función que NO tiene return?',
        opciones: ['None', '0', '""', 'Error'],
        correcta: 0,
        expl: 'Sin return explícito, la función devuelve None.',
        estrellas: 3,
      },
      {
        enunciado: '¿Qué imprime?',
        codigo: 'def potencia(base, exp=2):\n    return base ** exp\n\nprint(potencia(3))',
        opciones: ['9', '6', '3', '8'],
        correcta: 0,
        expl: 'exp usa su valor por defecto 2 → 3**2 = 9.',
        estrellas: 4,
      },
      {
        enunciado: '¿Qué imprime?',
        codigo: 'def f(x):\n    x = x + 1\n    return x\n\ny = 5\nf(y)\nprint(y)',
        opciones: ['5', '6', 'None', 'Error'],
        correcta: 0,
        expl: 'f(y) no cambia y (los enteros se pasan por valor); como no se asigna el retorno, y sigue en 5.',
        estrellas: 5,
      },
    ],
  },
  {
    tema: '3.3',
    categoria: 'Recursividad',
    items: [
      {
        enunciado: 'En una función recursiva, el caso base sirve para:',
        opciones: ['Detener la recursión.', 'Acelerar el cálculo.', 'Ahorrar memoria.', 'Nada, es opcional.'],
        correcta: 0,
        expl: 'El caso base es la condición de parada; sin él la recursión es infinita.',
        estrellas: 2,
      },
      {
        enunciado: '¿Qué devuelve suma(3)?',
        codigo: 'def suma(n):\n    if n == 0:\n        return 0\n    return n + suma(n - 1)\n\nprint(suma(3))',
        opciones: ['6', '3', '0', '9'],
        correcta: 0,
        expl: '3 + 2 + 1 + 0 = 6.',
        estrellas: 4,
      },
      {
        enunciado: '¿Qué pasa si una función recursiva NO tiene caso base?',
        opciones: ['Se desborda la pila (RecursionError).', 'Devuelve 0.', 'No compila.', 'Se ejecuta una vez.'],
        correcta: 0,
        expl: 'Sin parada, se llama infinitamente hasta agotar la pila de llamadas.',
        estrellas: 3,
      },
      {
        enunciado: '¿Cuántas veces se llama a cuenta (contando la inicial) en cuenta(3)?',
        codigo: 'def cuenta(n):\n    if n == 0:\n        return\n    cuenta(n - 1)\n\ncuenta(3)',
        opciones: ['4', '3', '2', 'infinito'],
        correcta: 0,
        expl: 'cuenta(3), (2), (1) y (0) → 4 llamadas.',
        estrellas: 4,
      },
    ],
  },

  // ───────── UNIDAD 4 ─────────
  {
    tema: '4.1',
    categoria: 'Vectores',
    items: [
      {
        enunciado: '¿Qué imprime?',
        codigo: 'v = [5, 10, 15]\nprint(len(v))',
        opciones: ['3', '15', '30', '2'],
        correcta: 0,
        expl: 'len cuenta los elementos: 3.',
        estrellas: 1,
      },
      {
        enunciado: '¿Qué imprime?',
        codigo: 'v = [1, 2, 3]\nv.append(4)\nprint(v[-1])',
        opciones: ['4', '3', '1', 'Error'],
        correcta: 0,
        expl: 'append agrega 4 al final; v[-1] es el último: 4.',
        estrellas: 3,
      },
      {
        enunciado: '¿Qué imprime?',
        codigo: 'v = [4, 8, 12, 16]\nprint(sum(v) / len(v))',
        opciones: ['10.0', '40', '4', '16'],
        correcta: 0,
        expl: 'sum=40, len=4 → 10.0 (promedio).',
        estrellas: 4,
      },
      {
        enunciado: '¿Qué imprime?',
        codigo: 'v = [3, 1, 4, 1, 5]\nc = 0\nfor x in v:\n    if x > 2:\n        c += 1\nprint(c)',
        opciones: ['3', '2', '5', '4'],
        correcta: 0,
        expl: 'Mayores que 2: 3, 4 y 5 → 3.',
        estrellas: 4,
      },
    ],
  },
  {
    tema: '4.2',
    categoria: 'Matrices',
    items: [
      {
        enunciado: '¿Qué imprime?',
        codigo: 'm = [[1, 2, 3], [4, 5, 6]]\nprint(m[0][2])',
        opciones: ['3', '2', '6', '4'],
        correcta: 0,
        expl: 'Fila 0 = [1,2,3]; columna 2 = 3.',
        estrellas: 2,
      },
      {
        enunciado: 'Una matriz de 3 filas y 2 columnas tiene cuántos elementos:',
        opciones: ['6', '5', '3', '2'],
        correcta: 0,
        expl: '3 × 2 = 6 elementos.',
        estrellas: 3,
      },
      {
        enunciado: '¿Qué imprime?',
        codigo: 'm = [[1, 2], [3, 4]]\ns = 0\nfor fila in m:\n    for x in fila:\n        s += x\nprint(s)',
        opciones: ['10', '4', '6', '7'],
        correcta: 0,
        expl: '1+2+3+4 = 10 (suma de todos los elementos).',
        estrellas: 4,
      },
      {
        enunciado: '¿Cómo accedes al elemento de la 2ª fila y 1ª columna?',
        opciones: ['m[1][0]', 'm[2][1]', 'm[0][1]', 'm[1][1]'],
        correcta: 0,
        expl: 'Los índices empiezan en 0: 2ª fila = 1, 1ª columna = 0 → m[1][0].',
        estrellas: 5,
      },
    ],
  },

  // ───────── UNIDAD 5 ─────────
  {
    tema: '5.1',
    categoria: 'Interfaz gráfica',
    items: [
      {
        enunciado: '¿Qué widget usarías para mostrar un texto NO editable?',
        opciones: ['Label', 'Entry', 'Button', 'Frame'],
        correcta: 0,
        expl: 'Label muestra texto fijo; Entry es para entrada editable.',
        estrellas: 2,
      },
      {
        enunciado: '¿Qué crea la ventana principal en tkinter?',
        opciones: ['tk.Tk()', 'tk.Window()', 'tk.Main()', 'tk.App()'],
        correcta: 0,
        expl: 'tk.Tk() crea la ventana raíz de la aplicación.',
        estrellas: 3,
      },
      {
        enunciado: '¿Qué método coloca un widget en la ventana?',
        opciones: ['.pack()', '.show()', '.draw()', '.open()'],
        correcta: 0,
        expl: 'pack() (o grid/place) posiciona el widget dentro de su contenedor.',
        estrellas: 3,
      },
      {
        enunciado: '¿Qué inicia el ciclo que mantiene la ventana abierta y atenta a eventos?',
        opciones: ['ventana.mainloop()', 'ventana.run()', 'ventana.start()', 'ventana.loop()'],
        correcta: 0,
        expl: 'mainloop() mantiene la aplicación escuchando eventos.',
        estrellas: 4,
      },
    ],
  },
  {
    tema: '5.2',
    categoria: 'Eventos',
    items: [
      {
        enunciado: 'La programación de interfaces gráficas se dice que es dirigida por:',
        opciones: ['eventos', 'bucles', 'archivos', 'números'],
        correcta: 0,
        expl: 'El programa reacciona a eventos del usuario (clics, teclas).',
        estrellas: 2,
      },
      {
        enunciado: 'En tk.Button(..., command=accion), ¿cuándo se ejecuta accion?',
        opciones: ['Al hacer clic en el botón.', 'Al crear el botón.', 'Al cerrar la ventana.', 'Nunca.'],
        correcta: 0,
        expl: 'command asocia la función que se llama cuando ocurre el evento de clic.',
        estrellas: 3,
      },
      {
        enunciado: '¿Por qué command=saludar y no command=saludar()?',
        opciones: [
          'Para pasar la función como referencia (con () se ejecutaría al instante).',
          'Porque es más rápido.',
          'Porque saludar no existe aún.',
          'Da igual, son equivalentes.',
        ],
        correcta: 0,
        expl: 'Sin paréntesis se entrega la función; con () se ejecutaría una vez al crear el botón.',
        estrellas: 5,
      },
      {
        enunciado: 'Un manejador de evento (callback) es:',
        opciones: ['La función que responde al evento.', 'El botón.', 'La ventana.', 'Una variable global.'],
        correcta: 0,
        expl: 'El callback es la función que se ejecuta cuando ocurre el evento.',
        estrellas: 3,
      },
    ],
  },
];

// Re-exporta el tipo para el seed (comparte forma con el banco de diagnóstico).
export type { DiagItem, DiagTema };
