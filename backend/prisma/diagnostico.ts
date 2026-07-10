// ════════════════════════════════════════════════════════════════════════════
//  CONTENIDO DEL DIAGNÓSTICO INICIAL POR TEMA + INTRODUCCIONES DIDÁCTICAS
//  · Banco de DIAGNÓSTICO (banco='pretest') asociado a TEMAS curados del plan
//    UPEA. Igual para todos (instrumento de medición). 3–5 ítems por tema, con
//    spread de dificultad (★) para que la estimación IRT (θ) por tema tenga señal.
//  · Introducciones teóricas DIDÁCTICAS por unidad (Markdown), contenido propio y
//    original, editable luego por el docente. Alimentan la fase previa (pestañas).
//  Contenido 100% original, sin reproducir material de terceros con derechos.
// ════════════════════════════════════════════════════════════════════════════

export type DifDiag = 1 | 2 | 3 | 4 | 5;

/** Un ítem de diagnóstico de opción múltiple. `correcta` es el índice en `opciones`. */
export interface DiagItem {
  enunciado: string;
  codigo?: string;
  opciones: string[];
  correcta: number;
  expl: string;
  estrellas: DifDiag;
}

/** Banco de diagnóstico de un tema (referenciado por su `numero`, ej. "1.5"). */
export interface DiagTema {
  tema: string; // numero del tema en el plan (debe existir en plan-upea.ts)
  categoria: string; // etiqueta corta para agrupar/mostrar
  items: DiagItem[];
}

// ── Banco de diagnóstico (2 temas curados por unidad, 3 ítems c/u) ──
export const DIAGNOSTICO: DiagTema[] = [
  // ───────────────── UNIDAD 1 · Fundamentos ─────────────────
  {
    tema: '1.1',
    categoria: 'Algoritmos',
    items: [
      {
        enunciado: '¿Qué es un algoritmo?',
        opciones: [
          'Una secuencia finita y ordenada de pasos para resolver un problema.',
          'Un lenguaje de programación de alto nivel.',
          'Un error en el código fuente.',
          'Un componente físico de la computadora.',
        ],
        correcta: 0,
        expl: 'Un algoritmo es un conjunto ordenado y finito de pasos que resuelve un problema, independiente del lenguaje.',
        estrellas: 1,
      },
      {
        enunciado: 'Una propiedad esencial de todo algoritmo es que debe ser FINITO. Esto significa que:',
        opciones: [
          'Debe terminar tras un número limitado de pasos.',
          'Debe usar poca memoria.',
          'Debe escribirse en una sola línea.',
          'Debe repetirse para siempre.',
        ],
        correcta: 0,
        expl: 'La finitud garantiza que el algoritmo concluye; un proceso que nunca termina no es un algoritmo válido.',
        estrellas: 3,
      },
      {
        enunciado: 'Un algoritmo recibe dos números y debe indicar el mayor. ¿Cuál es el orden lógico correcto?',
        opciones: [
          'Leer los dos números → compararlos → mostrar el mayor.',
          'Mostrar el mayor → leer los números → compararlos.',
          'Comparar → mostrar → leer.',
          'No se necesita leer los números.',
        ],
        correcta: 0,
        expl: 'Todo algoritmo sigue el esquema entrada → proceso → salida: primero se leen los datos, luego se procesan y al final se muestra el resultado.',
        estrellas: 4,
      },
    ],
  },
  {
    tema: '1.5',
    categoria: 'Tipos de datos',
    items: [
      {
        enunciado: '¿Qué tipo de dato usarías en Python para almacenar la edad de una persona?',
        opciones: ['int', 'str', 'bool', 'list'],
        correcta: 0,
        expl: 'La edad es un número entero → el tipo int.',
        estrellas: 1,
      },
      {
        enunciado: '¿Cuál es el valor y tipo de la variable resultado?',
        codigo: 'resultado = 7 / 2\nprint(resultado)',
        opciones: ['3.5 (float)', '3 (int)', '"3.5" (str)', 'Error'],
        correcta: 0,
        expl: 'En Python el operador / siempre devuelve un float: 7 / 2 = 3.5.',
        estrellas: 3,
      },
      {
        enunciado: '¿Qué imprime el siguiente código?',
        codigo: 'x = "5"\ny = 3\nprint(x * y)',
        opciones: ['555', '15', 'Error de tipos', '8'],
        correcta: 0,
        expl: 'Multiplicar un str por un int repite la cadena: "5" * 3 = "555".',
        estrellas: 5,
      },
    ],
  },

  // ───────────────── UNIDAD 2 · Programación Estructurada ─────────────────
  {
    tema: '2.3',
    categoria: 'Condicionales',
    items: [
      {
        enunciado: '¿Qué palabra clave inicia una estructura condicional en Python?',
        opciones: ['if', 'for', 'def', 'while'],
        correcta: 0,
        expl: 'La estructura selectiva básica en Python empieza con if.',
        estrellas: 1,
      },
      {
        enunciado: '¿Qué imprime este código?',
        codigo: 'n = 10\nif n % 2 == 0:\n    print("Par")\nelse:\n    print("Impar")',
        opciones: ['Par', 'Impar', '0', 'Error'],
        correcta: 0,
        expl: '10 % 2 == 0 es verdadero, así que se ejecuta la rama del if: "Par".',
        estrellas: 2,
      },
      {
        enunciado: '¿Qué valor imprime el programa?',
        codigo: 'nota = 75\nif nota >= 90:\n    print("A")\nelif nota >= 70:\n    print("B")\nelse:\n    print("C")',
        opciones: ['B', 'A', 'C', 'Nada'],
        correcta: 0,
        expl: 'nota=75 no cumple >=90 pero sí >=70, así que entra en el elif y muestra "B".',
        estrellas: 4,
      },
    ],
  },
  {
    tema: '2.4',
    categoria: 'Bucles',
    items: [
      {
        enunciado: '¿Qué bucle usarías para repetir una acción un número CONOCIDO de veces?',
        opciones: ['for', 'if', 'def', 'try'],
        correcta: 0,
        expl: 'El bucle for con range() es ideal cuando se conoce cuántas veces repetir.',
        estrellas: 1,
      },
      {
        enunciado: '¿Cuántas veces se imprime "Hola"?',
        codigo: 'for i in range(3):\n    print("Hola")',
        opciones: ['3', '2', '4', 'Infinitas'],
        correcta: 0,
        expl: 'range(3) genera 0, 1, 2 → tres iteraciones.',
        estrellas: 2,
      },
      {
        enunciado: '¿Qué valor final imprime?',
        codigo: 'suma = 0\nfor i in range(1, 5):\n    suma += i\nprint(suma)',
        opciones: ['10', '5', '15', '4'],
        correcta: 0,
        expl: 'range(1,5) da 1+2+3+4 = 10 (el acumulador suma cada valor).',
        estrellas: 4,
      },
    ],
  },

  // ───────────────── UNIDAD 3 · Programación Modular ─────────────────
  {
    tema: '3.2',
    categoria: 'Funciones',
    items: [
      {
        enunciado: '¿Qué palabra clave define una función en Python?',
        opciones: ['def', 'func', 'function', 'return'],
        correcta: 0,
        expl: 'En Python las funciones se definen con def.',
        estrellas: 1,
      },
      {
        enunciado: '¿Qué imprime este programa?',
        codigo: 'def doble(x):\n    return x * 2\n\nprint(doble(5))',
        opciones: ['10', '5', '25', 'None'],
        correcta: 0,
        expl: 'doble(5) devuelve 5*2 = 10.',
        estrellas: 3,
      },
      {
        enunciado: '¿Qué imprime el código?',
        codigo: 'def saludar(nombre="mundo"):\n    return "Hola " + nombre\n\nprint(saludar())',
        opciones: ['Hola mundo', 'Hola', 'Hola nombre', 'Error'],
        correcta: 0,
        expl: 'Al no pasar argumento se usa el valor por defecto "mundo" → "Hola mundo".',
        estrellas: 4,
      },
    ],
  },
  {
    tema: '3.3',
    categoria: 'Recursividad',
    items: [
      {
        enunciado: 'Una función recursiva es aquella que:',
        opciones: [
          'Se llama a sí misma.',
          'No devuelve ningún valor.',
          'Solo usa bucles for.',
          'No tiene parámetros.',
        ],
        correcta: 0,
        expl: 'La recursividad ocurre cuando una función se invoca a sí misma para resolver un subproblema.',
        estrellas: 2,
      },
      {
        enunciado: '¿Qué elemento es IMPRESCINDIBLE en toda función recursiva para que termine?',
        opciones: [
          'Un caso base (condición de parada).',
          'Un bucle while.',
          'Una variable global.',
          'Una lista vacía.',
        ],
        correcta: 0,
        expl: 'Sin caso base la recursión no termina y provoca desbordamiento de pila.',
        estrellas: 3,
      },
      {
        enunciado: '¿Qué devuelve factorial(3)?',
        codigo: 'def factorial(n):\n    if n == 0:\n        return 1\n    return n * factorial(n - 1)\n\nprint(factorial(3))',
        opciones: ['6', '3', '9', '1'],
        correcta: 0,
        expl: 'factorial(3) = 3*2*1 = 6.',
        estrellas: 5,
      },
    ],
  },

  // ───────────────── UNIDAD 4 · Estructura de Datos ─────────────────
  {
    tema: '4.1',
    categoria: 'Vectores',
    items: [
      {
        enunciado: 'En Python, un vector se representa habitualmente con una:',
        opciones: ['lista (list)', 'función', 'condición', 'cadena booleana'],
        correcta: 0,
        expl: 'Las listas de Python permiten almacenar colecciones ordenadas de elementos (vectores).',
        estrellas: 1,
      },
      {
        enunciado: '¿Qué imprime el código?',
        codigo: 'numeros = [10, 20, 30]\nprint(numeros[1])',
        opciones: ['20', '10', '30', '1'],
        correcta: 0,
        expl: 'Los índices empiezan en 0, así que numeros[1] es el segundo elemento: 20.',
        estrellas: 2,
      },
      {
        enunciado: '¿Qué valor imprime?',
        codigo: 'valores = [3, 7, 2, 8]\nprint(sum(valores) / len(valores))',
        opciones: ['5.0', '20', '4', '8'],
        correcta: 0,
        expl: 'sum=20, len=4 → 20/4 = 5.0 (promedio del vector).',
        estrellas: 4,
      },
    ],
  },
  {
    tema: '4.2',
    categoria: 'Matrices',
    items: [
      {
        enunciado: 'Una matriz en Python se suele representar como:',
        opciones: [
          'Una lista de listas.',
          'Una sola cadena de texto.',
          'Una función anidada.',
          'Un número decimal.',
        ],
        correcta: 0,
        expl: 'Una matriz (arreglo bidimensional) se modela como una lista cuyos elementos son listas (filas).',
        estrellas: 2,
      },
      {
        enunciado: '¿Qué imprime el código?',
        codigo: 'm = [[1, 2], [3, 4]]\nprint(m[1][0])',
        opciones: ['3', '2', '4', '1'],
        correcta: 0,
        expl: 'm[1] es la fila [3, 4]; su elemento [0] es 3.',
        estrellas: 3,
      },
      {
        enunciado: '¿Cuántos elementos recorre en total este doble bucle?',
        codigo: 'm = [[1, 2, 3], [4, 5, 6]]\nc = 0\nfor fila in m:\n    for x in fila:\n        c += 1\nprint(c)',
        opciones: ['6', '2', '3', '5'],
        correcta: 0,
        expl: 'La matriz tiene 2 filas × 3 columnas = 6 elementos recorridos.',
        estrellas: 5,
      },
    ],
  },

  // ───────────────── UNIDAD 5 · Interfaz Gráfica ─────────────────
  {
    tema: '5.1',
    categoria: 'Interfaz gráfica',
    items: [
      {
        enunciado: '¿Cuál es la librería estándar de Python para crear interfaces gráficas?',
        opciones: ['tkinter', 'numpy', 'random', 'os'],
        correcta: 0,
        expl: 'tkinter es el módulo estándar incluido en Python para construir GUIs.',
        estrellas: 1,
      },
      {
        enunciado: 'En una interfaz gráfica, un "widget" es:',
        opciones: [
          'Un componente visual (botón, etiqueta, caja de texto).',
          'Un tipo de bucle.',
          'Un archivo de imagen.',
          'Una base de datos.',
        ],
        correcta: 0,
        expl: 'Los widgets son los elementos visuales que componen la ventana: botones, etiquetas, entradas, etc.',
        estrellas: 3,
      },
      {
        enunciado: '¿Qué crea la línea resaltada?',
        codigo: 'import tkinter as tk\nventana = tk.Tk()\netiqueta = tk.Label(ventana, text="Hola")',
        opciones: [
          'Una etiqueta con el texto "Hola".',
          'Un botón que cierra la ventana.',
          'Una ventana secundaria.',
          'Una caja de entrada de texto.',
        ],
        correcta: 0,
        expl: 'tk.Label crea una etiqueta (texto no editable) dentro de la ventana.',
        estrellas: 4,
      },
    ],
  },
  {
    tema: '5.2',
    categoria: 'Eventos',
    items: [
      {
        enunciado: 'En una interfaz gráfica, un "evento" es:',
        opciones: [
          'Una acción del usuario (clic, tecla) a la que el programa responde.',
          'Un error de sintaxis.',
          'Una variable global.',
          'Un tipo de dato numérico.',
        ],
        correcta: 0,
        expl: 'La programación de GUIs es dirigida por eventos: el usuario interactúa y el programa reacciona.',
        estrellas: 2,
      },
      {
        enunciado: 'En tkinter, ¿qué parámetro de un botón indica la función a ejecutar al hacer clic?',
        opciones: ['command', 'onclick', 'event', 'action'],
        correcta: 0,
        expl: 'tk.Button(..., command=funcion) asocia la función que se ejecuta al pulsar el botón.',
        estrellas: 3,
      },
      {
        enunciado: '¿Por qué se escribe command=saludar y NO command=saludar()?',
        codigo: 'boton = tk.Button(ventana, text="Ok", command=saludar)',
        opciones: [
          'Se pasa la función como referencia; con () se ejecutaría de inmediato.',
          'Es un error; debe llevar paréntesis.',
          'Ambas formas hacen exactamente lo mismo.',
          'Porque saludar no tiene parámetros.',
        ],
        correcta: 0,
        expl: 'Sin paréntesis se entrega la función para que tkinter la llame al ocurrir el evento; con () se llamaría una sola vez al crear el botón.',
        estrellas: 5,
      },
    ],
  },
];

// ── Introducciones didácticas por unidad (Markdown, contenido original) ──
export const INTRO_UNIDADES: Record<number, string> = {
  1: `## Objetivos de la unidad
Comprender qué es un **algoritmo** y en qué consiste **programar**, e identificar los tipos de datos y variables con los que trabaja un programa.

## Conceptos clave
- **Algoritmo:** secuencia finita y ordenada de pasos que resuelve un problema. Todo algoritmo tiene **entrada → proceso → salida**.
- **Programa:** un algoritmo escrito en un lenguaje que la computadora entiende (aquí, **Python**).
- **Variable:** un espacio con nombre que guarda un valor y puede cambiar.
- **Tipos de datos básicos:** \`int\` (enteros), \`float\` (decimales), \`str\` (texto) y \`bool\` (verdadero/falso).

## Ejemplo ilustrativo
\`\`\`python
edad = 20          # int
promedio = 7.5     # float
nombre = "Ana"     # str
aprobado = True    # bool
print(nombre, "tiene", edad, "años")
\`\`\`

## Idea de cierre
Antes de escribir código, piensa el **algoritmo**: qué datos entran, qué proceso ocurre y qué resultado sale. Programar es traducir ese razonamiento a instrucciones claras.`,

  2: `## Objetivos de la unidad
Dominar las tres estructuras de control de la **programación estructurada**: secuencia, **selección** (condicionales) y **repetición** (bucles).

## Conceptos clave
- **Secuencia:** las instrucciones se ejecutan una tras otra, de arriba hacia abajo.
- **Selección:** \`if\`, \`elif\` y \`else\` permiten tomar decisiones según una condición.
- **Repetición:** \`for\` (cuando sabes cuántas veces) y \`while\` (mientras se cumpla una condición).
- La **indentación** (sangría) define qué instrucciones pertenecen a cada bloque.

## Ejemplo ilustrativo
\`\`\`python
for i in range(1, 6):
    if i % 2 == 0:
        print(i, "es par")
    else:
        print(i, "es impar")
\`\`\`

## Idea de cierre
Con secuencia, decisión y repetición puedes construir la lógica de casi cualquier programa. La clave está en elegir la estructura correcta para cada problema.`,

  3: `## Objetivos de la unidad
Aprender a dividir un programa en partes reutilizables mediante la **programación modular**: funciones, procedimientos y recursividad.

## Conceptos clave
- **Función:** bloque de código con nombre que realiza una tarea y puede **devolver** un valor con \`return\`.
- **Parámetros y argumentos:** datos de entrada que recibe la función.
- **Modularidad:** dividir un problema grande en funciones pequeñas facilita entender, probar y reutilizar el código.
- **Recursividad:** una función que se llama a sí misma; necesita un **caso base** para terminar.

## Ejemplo ilustrativo
\`\`\`python
def area_rectangulo(base, altura):
    return base * altura

print(area_rectangulo(4, 3))   # 12
\`\`\`

## Idea de cierre
"Divide y vencerás": construir con funciones bien nombradas hace tu código más ordenado, legible y fácil de mantener.`,

  4: `## Objetivos de la unidad
Manejar colecciones de datos con **arreglos**: vectores (una dimensión), matrices (dos dimensiones) y cadenas de caracteres.

## Conceptos clave
- **Vector:** en Python, una **lista** de elementos ordenados. Se accede por **índice**, empezando en 0.
- **Matriz:** una **lista de listas** (filas y columnas); se accede con dos índices \`m[fila][columna]\`.
- **Cadena (str):** una secuencia de caracteres que también se recorre e indexa.
- Recorrer estructuras con bucles permite **buscar, sumar, contar y transformar** datos.

## Ejemplo ilustrativo
\`\`\`python
notas = [7, 8, 6, 9]
print("Promedio:", sum(notas) / len(notas))   # 7.5

matriz = [[1, 2], [3, 4]]
print(matriz[1][0])   # 3
\`\`\`

## Idea de cierre
Los arreglos permiten trabajar con muchos datos a la vez. Combinados con bucles, son la base para procesar información de forma eficiente.`,

  5: `## Objetivos de la unidad
Introducirse en la creación de **interfaces gráficas de usuario (GUI)** en Python con \`tkinter\`, y entender la programación **dirigida por eventos**.

## Conceptos clave
- **Ventana:** el contenedor principal de la aplicación (\`tk.Tk()\`).
- **Widget:** cada componente visual (etiqueta \`Label\`, botón \`Button\`, entrada \`Entry\`).
- **Evento:** una acción del usuario (un clic, una tecla) a la que el programa responde.
- **Manejador (callback):** la función que se ejecuta cuando ocurre el evento (\`command=funcion\`).

## Ejemplo ilustrativo
\`\`\`python
import tkinter as tk

def saludar():
    print("¡Hola!")

ventana = tk.Tk()
boton = tk.Button(ventana, text="Saludar", command=saludar)
boton.pack()
ventana.mainloop()
\`\`\`

## Idea de cierre
En una GUI el programa no manda: **espera** a que el usuario actúe y responde a sus eventos. Ese cambio de mentalidad es la puerta a las aplicaciones interactivas.`,
};
