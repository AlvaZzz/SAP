// ============================================================
//  PLAN ACADÉMICO OFICIAL — Programación I (PRG-111) · UPEA
//  Estructura Unidad → Tema (→ Subtema) + banco masivo de ejercicios de Python.
//  Contenido 100% Python. Cada ejercicio es correcto POR CONSTRUCCIÓN:
//  las salidas de "predecir_salida" se calculan aquí (mismo resultado que Python
//  para el subconjunto usado: enteros no negativos, //, %, **, +, *, f-strings).
//
//  Para agregar OTRA institución/plan (ej. EMI) más adelante NO se reescribe:
//  se añade otro arreglo UnidadPlan con `institucion`/`plan` distintos y el seed
//  lo inserta igual (numero de unidad es único POR institución).
// ============================================================

export type Dif = 1 | 2 | 3 | 4 | 5;
export type TipoEjPlan = 'opcion_multiple' | 'predecir_salida' | 'completar_codigo' | 'ordenar_lineas';

export interface EjPlan {
  tipo: TipoEjPlan;
  categoria: string;
  dificultad: Dif;
  enunciado: string;
  codigo: string | null;
  opciones: { id: string; texto: string }[];
  respuestaCorrecta: string;
  xp: number;
  expl: string;
}

export interface TemaPlan {
  numero: string;
  titulo: string;
  descripcion: string;
  subtemas?: TemaPlan[];
  ejercicios: EjPlan[];
}

export interface UnidadPlan {
  numero: number;
  titulo: string;
  descripcion: string;
  nivel: number; // mapea a los 5 Niveles de gamificación (XP, pretest)
  institucion: string;
  plan: string;
  temas: TemaPlan[];
}

// ── Utilidades de construcción ──────────────────────────────
const L = ['A', 'B', 'C', 'D', 'E', 'F'];
const xpDe = (d: Dif) => d * 10; // 10..50 según dificultad

// Rota la posición de la respuesta correcta entre ejercicios (evita "siempre A").
let _ctr = 0;
function colocar(correcta: string, distractores: string[]): { opciones: { id: string; texto: string }[]; letra: string } {
  const pos = (_ctr++) % (distractores.length + 1);
  const arr = [...distractores];
  arr.splice(pos, 0, correcta);
  return { opciones: arr.map((t, i) => ({ id: L[i], texto: t })), letra: L[pos] };
}

/** opción múltiple (concepto) */
function mc(categoria: string, dificultad: Dif, enunciado: string, correcta: string, distractores: string[], expl: string, codigo: string | null = null): EjPlan {
  const { opciones, letra } = colocar(correcta, distractores);
  return { tipo: 'opcion_multiple', categoria, dificultad, enunciado, codigo, opciones, respuestaCorrecta: letra, xp: xpDe(dificultad), expl };
}

/** predecir la salida de un código */
function ps(categoria: string, dificultad: Dif, codigo: string, correcta: string, distractores: string[], expl: string, enunciado = '¿Qué imprime el siguiente código?'): EjPlan {
  const { opciones, letra } = colocar(correcta, distractores);
  return { tipo: 'predecir_salida', categoria, dificultad, enunciado, codigo, opciones, respuestaCorrecta: letra, xp: xpDe(dificultad), expl };
}

/** completar código (respuesta de texto; variantes válidas separadas por "|") */
function cc(categoria: string, dificultad: Dif, enunciado: string, codigo: string, respuesta: string, expl: string): EjPlan {
  return { tipo: 'completar_codigo', categoria, dificultad, enunciado, codigo, opciones: [], respuestaCorrecta: respuesta, xp: xpDe(dificultad), expl };
}

/** ordenar líneas (Parsons): las líneas se pasan EN ORDEN CORRECTO; el frontend las baraja. */
function ol(categoria: string, dificultad: Dif, enunciado: string, lineasEnOrden: string[], expl: string, codigo: string | null = null): EjPlan {
  const opciones = lineasEnOrden.map((t, i) => ({ id: L[i], texto: t }));
  return { tipo: 'ordenar_lineas', categoria, dificultad, enunciado, codigo, opciones, respuestaCorrecta: opciones.map((o) => o.id).join(','), xp: xpDe(dificultad), expl };
}

// ── Cálculos deterministas (mismo resultado que Python) ─────
const sumRange = (a: number, b: number) => { let s = 0; for (let i = a; i < b; i++) s += i; return s; };
const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

// ════════════════════════════════════════════════════════════
//  UNIDAD 1 — FUNDAMENTOS DE LA PROGRAMACIÓN
// ════════════════════════════════════════════════════════════

const U1_1_ALGORITMO: EjPlan[] = [
  mc('Algoritmo', 1, '¿Qué es un algoritmo?', 'Un conjunto ordenado y finito de pasos para resolver un problema.', ['Un lenguaje de programación de bajo nivel.', 'Un error lógico en el código.', 'Un componente físico de la computadora.'], 'Un algoritmo es una secuencia finita, ordenada y no ambigua de pasos que resuelve un problema.'),
  mc('Algoritmo', 1, '¿Cuál NO es una característica de un buen algoritmo?', 'Ser infinito y sin punto de término.', ['Ser preciso y no ambiguo.', 'Ser finito (termina).', 'Estar bien definido.'], 'Todo algoritmo debe ser FINITO: siempre termina tras un número limitado de pasos.'),
  mc('Algoritmo', 2, '¿Qué diferencia hay entre programa y algoritmo?', 'El algoritmo es la idea/pasos; el programa es su implementación en un lenguaje.', ['Son exactamente lo mismo.', 'El programa no necesita algoritmo.', 'El algoritmo solo existe en hardware.'], 'El algoritmo es la solución lógica; el programa la codifica en un lenguaje concreto como Python.'),
  mc('Algoritmo', 2, '¿Cuál es el orden lógico correcto para resolver un problema con un algoritmo?', 'Entrada → Proceso → Salida', ['Salida → Proceso → Entrada', 'Proceso → Entrada → Salida', 'Salida → Entrada → Proceso'], 'El modelo clásico es Entrada (datos) → Proceso (cálculo) → Salida (resultado).'),
  mc('Algoritmo', 1, 'La propiedad de que cada paso esté claramente definido y sin ambigüedad se llama:', 'Precisión', ['Recursividad', 'Redundancia', 'Volatilidad'], 'La precisión garantiza que cada paso se interprete de una sola manera.'),
  mc('Algoritmo', 2, '¿Qué representa la "finitud" de un algoritmo?', 'Que termina después de un número finito de pasos.', ['Que usa memoria infinita.', 'Que se repite para siempre.', 'Que no tiene entradas.'], 'La finitud asegura que el algoritmo concluye y entrega un resultado.'),
  ol('Algoritmo', 2, 'Ordena los pasos de un algoritmo que calcula el promedio de dos notas:', ['Leer la nota1 y la nota2', 'Sumar nota1 + nota2', 'Dividir la suma entre 2', 'Mostrar el promedio'], 'Primero se leen los datos, luego se procesan (suma y división) y al final se muestra el resultado.'),
  ol('Algoritmo', 1, 'Ordena los pasos del algoritmo "hervir agua":', ['Colocar el agua en la olla', 'Encender el fuego', 'Esperar a que hierva', 'Apagar el fuego'], 'La secuencia lógica va de preparar, ejecutar, esperar la condición y terminar.'),
  mc('Algoritmo', 3, 'Un algoritmo que para ciertos datos NUNCA termina, viola la propiedad de:', 'Finitud', ['Entrada definida', 'Salida definida', 'Efectividad'], 'Si no termina, incumple la finitud: un algoritmo debe concluir para toda entrada válida.'),
  mc('Algoritmo', 2, '¿Cuál es la MEJOR definición de "programación"?', 'El proceso de diseñar y codificar algoritmos para que la computadora los ejecute.', ['Encender y apagar la computadora.', 'Instalar programas ya hechos.', 'Navegar por internet.'], 'Programar es traducir la solución (algoritmo) a instrucciones que la máquina ejecuta.'),
];

const U1_2_FASES: EjPlan[] = [
  ol('Fases del software', 2, 'Ordena las fases clásicas del desarrollo de software:', ['Análisis de requisitos', 'Diseño', 'Codificación', 'Pruebas', 'Mantenimiento'], 'El ciclo de vida va de entender el problema (análisis) a mantener el producto final.'),
  mc('Fases del software', 1, '¿En qué fase se determina QUÉ debe hacer el sistema?', 'Análisis de requisitos', ['Codificación', 'Mantenimiento', 'Pruebas'], 'El análisis define los requisitos: qué necesita el usuario, antes de diseñar o programar.'),
  mc('Fases del software', 2, '¿En qué fase se escribe el código fuente?', 'Codificación', ['Análisis', 'Diseño', 'Pruebas'], 'La codificación (implementación) traduce el diseño a un lenguaje como Python.'),
  mc('Fases del software', 2, 'La fase que verifica que el software funcione sin errores es:', 'Pruebas', ['Diseño', 'Análisis', 'Instalación'], 'Las pruebas (testing) detectan y corrigen errores antes de la entrega.'),
  mc('Fases del software', 1, 'Corregir errores y agregar mejoras después de entregar el sistema corresponde a:', 'Mantenimiento', ['Análisis', 'Diseño', 'Codificación'], 'El mantenimiento ocurre tras la entrega: correcciones, mejoras y adaptaciones.'),
  mc('Fases del software', 3, '¿Qué se produce principalmente en la fase de diseño?', 'La arquitectura y los diagramas de la solución (cómo se hará).', ['El manual de usuario final.', 'La factura del proyecto.', 'El código ejecutable.'], 'El diseño define CÓMO se construirá: estructura, módulos y diagramas.'),
  mc('Fases del software', 2, '¿Por qué es riesgoso saltarse la fase de análisis?', 'Se puede construir un sistema que no resuelve el problema real.', ['El código corre más lento.', 'Se gasta menos dinero.', 'No afecta en nada.'], 'Sin análisis se corre el riesgo de programar algo que no cumple los requisitos.'),
  ol('Fases del software', 2, 'Ordena de lo más abstracto a lo más concreto:', ['Requisitos (qué)', 'Diseño (cómo)', 'Código (implementación)', 'Programa ejecutable'], 'Se avanza de la definición del problema hacia el producto ejecutable.'),
  mc('Fases del software', 1, 'El conjunto ordenado de fases del software se conoce como:', 'Ciclo de vida del software', ['Bucle infinito', 'Pila de ejecución', 'Árbol binario'], 'El ciclo de vida describe todas las etapas desde la concepción hasta el retiro del software.'),
  mc('Fases del software', 3, 'En un modelo iterativo, ¿qué ventaja hay frente al modelo en cascada?', 'Permite volver a fases anteriores y refinar por iteraciones.', ['Prohíbe cambios una vez iniciado.', 'Elimina la fase de pruebas.', 'No requiere análisis.'], 'Los modelos iterativos entregan versiones parciales y admiten refinamiento continuo.'),
];

const U1_3_LENGUAJES: EjPlan[] = [
  mc('Lenguajes', 1, 'Python es un lenguaje de:', 'Alto nivel', ['Bajo nivel (máquina)', 'Ensamblador', 'Binario puro'], 'Python es de alto nivel: cercano al lenguaje humano y lejos del código máquina.'),
  mc('Lenguajes', 1, 'El lenguaje que la CPU ejecuta directamente (0s y 1s) es:', 'Lenguaje máquina', ['Python', 'Java', 'Pseudocódigo'], 'El lenguaje máquina (binario) es el único que el procesador ejecuta directamente.'),
  mc('Lenguajes', 2, '¿Qué caracteriza a un lenguaje de bajo nivel?', 'Está muy cerca del hardware y es difícil de leer para humanos.', ['Es idéntico al español.', 'No necesita traducción.', 'Solo sirve para páginas web.'], 'Los lenguajes de bajo nivel (ensamblador) operan cerca del hardware y son poco legibles.'),
  mc('Lenguajes', 2, 'Python es un lenguaje principalmente:', 'Interpretado', ['Compilado a binario nativo', 'Cableado en hardware', 'De marcado (markup)'], 'Python se interpreta: un intérprete ejecuta el código línea por línea.'),
  mc('Lenguajes', 2, '¿Cuál es una ventaja de un lenguaje de alto nivel?', 'Es más legible y portable entre distintas máquinas.', ['Se ejecuta sin ningún traductor.', 'Depende del modelo exacto de CPU.', 'No permite comentarios.'], 'Los lenguajes de alto nivel son portables y legibles; un traductor los adapta a cada máquina.'),
  mc('Lenguajes', 3, 'HTML se clasifica como lenguaje de:', 'Marcado (no es de programación estructurada como Python)', ['Bajo nivel', 'Máquina', 'Ensamblador'], 'HTML es un lenguaje de marcado para estructurar contenido, no de programación algorítmica.'),
  mc('Lenguajes', 1, 'Un lenguaje "portable" significa que:', 'El mismo código puede ejecutarse en distintos sistemas.', ['Solo corre en una computadora.', 'Se escribe en binario.', 'No puede copiarse.'], 'La portabilidad permite ejecutar el mismo programa en distintas plataformas.'),
  mc('Lenguajes', 2, '¿Cuál de estos es un lenguaje de programación de alto nivel?', 'Python', ['Código binario', 'Lenguaje ensamblador', 'Microcódigo'], 'Python, Java y C++ son de alto nivel; binario y ensamblador son de bajo nivel.'),
  ol('Lenguajes', 3, 'Ordena del nivel MÁS cercano al hardware al MÁS cercano al humano:', ['Lenguaje máquina (binario)', 'Ensamblador', 'C', 'Python'], 'La escala de abstracción sube desde el binario hasta lenguajes muy legibles como Python.'),
  mc('Lenguajes', 2, '¿Qué necesita un lenguaje de alto nivel para poder ejecutarse en la CPU?', 'Un traductor (compilador o intérprete).', ['Nada, la CPU lo entiende directo.', 'Una impresora.', 'Una hoja de cálculo.'], 'Un traductor convierte el código de alto nivel a instrucciones que la CPU ejecuta.'),
];

const U1_4_HERRAMIENTAS: EjPlan[] = [
  mc('Herramientas', 1, '¿Qué es un IDE?', 'Un entorno integrado de desarrollo (editor + ejecución + depurador).', ['Un tipo de variable.', 'Un lenguaje de programación.', 'Un componente de la CPU.'], 'Un IDE (ej. VS Code, PyCharm) integra editor, ejecución y depuración en una sola herramienta.'),
  mc('Herramientas', 2, '¿Qué hace un INTÉRPRETE?', 'Ejecuta el código traduciéndolo línea por línea.', ['Convierte todo el programa a binario de una vez.', 'Dibuja diagramas de flujo.', 'Almacena datos en disco.'], 'El intérprete (como el de Python) traduce y ejecuta el código instrucción por instrucción.'),
  mc('Herramientas', 2, '¿Qué hace un COMPILADOR?', 'Traduce todo el programa a código máquina antes de ejecutarlo.', ['Ejecuta línea por línea sin traducir.', 'Es un editor de texto.', 'Corrige la ortografía.'], 'El compilador traduce el programa completo a un ejecutable antes de correrlo.'),
  mc('Herramientas', 3, 'Principal diferencia entre intérprete y compilador:', 'El intérprete traduce y ejecuta paso a paso; el compilador traduce todo antes.', ['No hay ninguna diferencia.', 'El intérprete es hardware.', 'El compilador no traduce.'], 'Intérprete = ejecución inmediata paso a paso; compilador = traducción total previa.'),
  mc('Herramientas', 1, 'La herramienta que ayuda a encontrar y corregir errores paso a paso es el:', 'Depurador (debugger)', ['Compilador', 'Navegador', 'Antivirus'], 'El depurador permite ejecutar paso a paso e inspeccionar variables para hallar errores.'),
  mc('Herramientas', 2, 'Python usa principalmente un:', 'Intérprete', ['Compilador a binario nativo obligatorio', 'Ensamblador', 'Sistema operativo propio'], 'La implementación estándar de Python (CPython) interpreta el código.'),
  mc('Herramientas', 1, '¿Cuál es un ejemplo de IDE o editor para Python?', 'VS Code / PyCharm', ['Microsoft Excel', 'Adobe Photoshop', 'WinRAR'], 'VS Code y PyCharm son entornos usados para escribir y ejecutar Python.'),
  mc('Herramientas', 2, 'Un error detectado por el intérprete al ejecutar una línea inválida es un error de:', 'Ejecución/sintaxis reportado por el intérprete', ['Hardware', 'Impresión', 'Red'], 'El intérprete reporta errores de sintaxis o de ejecución al procesar cada línea.'),
  ol('Herramientas', 2, 'Ordena el flujo típico al trabajar en un IDE:', ['Escribir el código en el editor', 'Ejecutar el programa', 'Leer los errores en la consola', 'Corregir y volver a ejecutar'], 'El ciclo de desarrollo es editar → ejecutar → observar errores → corregir.'),
  mc('Herramientas', 3, '¿Por qué Python es cómodo para principiantes?', 'Es interpretado: se prueba el código de inmediato, sin paso de compilación.', ['Necesita compilar por horas.', 'Solo funciona en supercomputadoras.', 'No tiene mensajes de error.'], 'Al ser interpretado, permite probar y corregir rápido, ideal para aprender.'),
];

const U1_5_TIPOS: EjPlan[] = [
  ps('Tipos de datos', 1, 'x = 7\ny = 2\nprint(x / y)', '3.5', ['3', '4', 'Error'], 'El operador / siempre devuelve float: 7 / 2 = 3.5.'),
  ps('Tipos de datos', 1, 'print(type(10))', "<class 'int'>", ["<class 'float'>", "<class 'str'>", '10'], '10 es un entero, por lo que su tipo es int.'),
  ps('Tipos de datos', 2, 'print(type(3.14))', "<class 'float'>", ["<class 'int'>", "<class 'str'>", '3.14'], '3.14 tiene parte decimal, así que su tipo es float.'),
  ps('Tipos de datos', 2, 'print(type("Hola"))', "<class 'str'>", ["<class 'int'>", "<class 'text'>", 'Hola'], 'El texto entre comillas es de tipo str (string).'),
  ps('Tipos de datos', 2, 'print(type(True))', "<class 'bool'>", ["<class 'int'>", "<class 'str'>", 'True'], 'True y False son valores booleanos, de tipo bool.'),
  ps('Tipos de datos', 2, 'edad = "20"\nprint(edad * 2)', '2020', ['40', 'Error', '20'], 'edad es un string; "20" * 2 repite el texto → "2020".'),
  cc('Tipos de datos', 2, 'Completa para convertir el texto "15" en un número entero.', 'texto = "15"\nnumero = ____("15")\nprint(numero + 5)', 'int', 'int("15") convierte el string a entero 15; luego 15 + 5 = 20.'),
  ps('Tipos de datos', 1, 'nombre = "Ana"\nedad = 20\nprint(f"{nombre} tiene {edad}")', 'Ana tiene 20', ['{nombre} tiene {edad}', 'Ana tiene edad', 'Error'], 'El f-string reemplaza {nombre} y {edad} por sus valores.'),
  ps('Tipos de datos', 3, 'a = 5\nb = 2\nprint(a % b, a // b)', '1 2', ['2 1', '2.5 2', '1 2.5'], '5 % 2 = 1 (resto) y 5 // 2 = 2 (división entera).'),
  cc('Tipos de datos', 1, 'Completa para crear una variable que guarde tu edad como número.', 'edad = ____\nprint(edad)', '18|20|edad', 'Una variable numérica se asigna con un valor entero, ej. edad = 18.'),
  ps('Tipos de datos', 3, 'x = 10\nx = "diez"\nprint(type(x))', "<class 'str'>", ["<class 'int'>", 'Error: cambio de tipo', "<class 'number'>"], 'Python es de tipado dinámico: la variable pasó de int a str sin error.'),
];

const U1_5_1_CONSTANTES: EjPlan[] = [
  mc('Constantes', 1, 'Por convención en Python, una constante se nombra:', 'En MAYÚSCULAS (ej. PI = 3.1416)', ['En minúsculas', 'Con un número al inicio', 'Con espacios'], 'Python no tiene constantes reales; por convención se escriben en MAYÚSCULAS.'),
  ps('Constantes', 1, 'PI = 3.1416\nradio = 2\nprint(PI * radio ** 2)', '12.5664', ['6.2832', '12.56', 'Error'], 'Área = PI * radio² = 3.1416 * 4 = 12.5664.'),
  ps('Constantes', 2, 'IVA = 0.13\nprecio = 100\nprint(precio * IVA)', '13.0', ['13', '113', '0.13'], '100 * 0.13 = 13.0 (float por la multiplicación con decimal).'),
  cc('Constantes', 1, 'Define la constante GRAVEDAD con el valor 9.8 (convención de mayúsculas).', '____ = 9.8\nprint(GRAVEDAD)', 'GRAVEDAD', 'Las constantes se nombran en MAYÚSCULAS: GRAVEDAD = 9.8.'),
  mc('Constantes', 2, '¿Python impide técnicamente cambiar una "constante"?', 'No; es solo una convención, el valor puede reasignarse.', ['Sí, lanza un error.', 'Sí, la borra.', 'Solo en mayúsculas.'], 'Python no tiene const real: MAYÚSCULAS es una convención, no una restricción.'),
  ps('Constantes', 2, 'DIAS_SEMANA = 7\nsemanas = 3\nprint(DIAS_SEMANA * semanas)', '21', ['10', '73', '4'], '7 * 3 = 21 días.'),
  ps('Constantes', 3, 'BASE = 5\nALTURA = 8\nprint((BASE * ALTURA) / 2)', '20.0', ['40', '20', '13.0'], 'Área del triángulo = base*altura/2 = 40/2 = 20.0.'),
  cc('Constantes', 2, 'Completa para calcular la circunferencia usando la constante PI.', 'PI = 3.14\nradio = 10\nlongitud = 2 * PI * ____\nprint(longitud)', 'radio', 'Circunferencia = 2 * PI * radio = 2*3.14*10 = 62.8.'),
  mc('Constantes', 1, '¿Cuál es un buen nombre de constante para la tasa de interés?', 'TASA_INTERES', ['tasa interes', '2tasa', 'TasaInteres()'], 'Se usan MAYÚSCULAS y guion bajo: TASA_INTERES.'),
  ps('Constantes', 3, 'PRECIO_UNIT = 25\nCANT = 4\nDESCUENTO = 10\nprint(PRECIO_UNIT * CANT - DESCUENTO)', '90', ['100', '110', '15'], '25*4 = 100; 100 - 10 = 90.'),
];

const U1_5_2_OPERADORES: EjPlan[] = [
  ps('Operadores', 1, 'print(17 // 5)', '3', ['3.4', '2', '4'], '// es división entera: 17 // 5 = 3.'),
  ps('Operadores', 1, 'print(23 % 5)', '3', ['4', '4.6', '0'], '% devuelve el resto: 23 = 5*4 + 3, resto 3.'),
  ps('Operadores', 2, 'print(2 ** 5)', '32', ['10', '25', '7'], '** es potencia: 2⁵ = 32.'),
  ps('Operadores', 1, 'print(8 + 3 * 2)', '14', ['22', '16', '11'], 'La multiplicación va antes que la suma: 3*2=6, 8+6=14.'),
  ps('Operadores', 2, 'print((8 + 3) * 2)', '22', ['14', '16', '11'], 'Los paréntesis fuerzan la suma primero: (11)*2=22.'),
  ps('Operadores', 2, 'print(10 > 5 and 3 < 1)', 'False', ['True', 'None', 'Error'], '10>5 es True pero 3<1 es False; True and False = False.'),
  ps('Operadores', 2, 'print(10 > 5 or 3 < 1)', 'True', ['False', 'None', 'Error'], 'Basta con que un lado sea True en un or: True or False = True.'),
  ps('Operadores', 2, 'print(not (5 == 5))', 'False', ['True', 'None', 'Error'], '5==5 es True; not True = False.'),
  ps('Operadores', 3, 'print(7 >= 7, 7 != 8)', 'True True', ['False True', 'True False', 'False False'], '7>=7 es True y 7!=8 es True.'),
  cc('Operadores', 2, 'Completa el operador para saber si "n" es par (resto 0 al dividir entre 2).', 'n = 8\nprint(n ____ 2 == 0)', '%', 'n % 2 == 0 es True cuando n es par (resto cero).'),
  ps('Operadores', 3, 'print(3 + 4 > 5 and 2 * 2 == 4)', 'True', ['False', 'None', 'Error'], '7>5 es True y 4==4 es True; True and True = True.'),
];

const U1_6_EXPRESIONES: EjPlan[] = [
  ps('Expresiones', 1, 'resultado = 5 + 2 * 3\nprint(resultado)', '11', ['21', '17', '13'], 'Precedencia: 2*3=6, luego 5+6=11.'),
  ps('Expresiones', 2, 'x = 4\ny = 2\nprint(x ** 2 + y ** 2)', '20', ['16', '12', '36'], '4²=16 y 2²=4; 16+4=20.'),
  ps('Expresiones', 2, 'print(10 - 4 - 2)', '4', ['8', '6', '0'], 'La resta es de izquierda a derecha: (10-4)-2 = 4.'),
  ps('Expresiones', 3, 'print(2 + 3 * 2 ** 2)', '14', ['20', '26', '17'], 'Primero potencia (2²=4), luego 3*4=12, luego 2+12=14.'),
  ps('Expresiones', 2, 'a = 5\nprint(a > 3 and a < 10)', 'True', ['False', 'None', 'Error'], '5>3 y 5<10 son ambas True; True and True = True.'),
  cc('Expresiones', 2, 'Escribe la expresión que promedia a y b.', 'a = 8\nb = 4\npromedio = ____\nprint(promedio)', '(a + b) / 2|(a+b)/2', 'El promedio es la suma dividida entre 2: (a+b)/2 = 6.0.'),
  ps('Expresiones', 3, 'print((6 % 4) + (6 // 4))', '3', ['2', '4', '1'], '6%4=2 y 6//4=1; 2+1=3.'),
  ps('Expresiones', 1, 'print(3 * 3 * 3)', '27', ['9', '33', '18'], '3*3*3 = 27.'),
  cc('Expresiones', 3, 'Completa la expresión que calcula el área de un rectángulo (base 5, altura 3).', 'base = 5\naltura = 3\narea = ____\nprint(area)', 'base * altura|base*altura', 'Área del rectángulo = base * altura = 15.'),
  ps('Expresiones', 2, 'print(True and not False)', 'True', ['False', 'None', 'Error'], 'not False = True; True and True = True.'),
];

const U1_7_RAZONAMIENTO: EjPlan[] = [
  mc('Razonamiento', 2, 'Si "todos los primos > 2 son impares" y 7 es primo mayor que 2, entonces 7 es:', 'Impar', ['Par', 'Negativo', 'No se puede saber'], 'Es deducción lógica: si la regla se cumple y 7 es primo>2, entonces es impar.'),
  mc('Razonamiento', 2, 'Serie: 2, 4, 6, 8, ... ¿Qué número sigue?', '10', ['9', '12', '16'], 'La serie suma 2 cada vez: 8+2 = 10.'),
  mc('Razonamiento', 2, 'Serie: 1, 3, 9, 27, ... ¿Qué número sigue?', '81', ['54', '30', '108'], 'Cada término se multiplica por 3: 27*3 = 81.'),
  mc('Razonamiento', 3, 'Serie de Fibonacci: 0, 1, 1, 2, 3, 5, ... ¿Qué sigue?', '8', ['7', '10', '6'], 'Cada término es la suma de los dos anteriores: 3+5 = 8.'),
  mc('Razonamiento', 3, 'Si A es mayor que B y B es mayor que C, entonces:', 'A es mayor que C', ['C es mayor que A', 'A es igual a C', 'No se puede deducir'], 'Por transitividad: A>B y B>C implica A>C.'),
  mc('Razonamiento', 2, 'Serie: 5, 10, 20, 40, ... ¿Qué número sigue?', '80', ['60', '50', '45'], 'Cada término se duplica: 40*2 = 80.'),
  ol('Razonamiento', 2, 'Ordena los pasos heurísticos para resolver un problema (método de Polya):', ['Entender el problema', 'Diseñar un plan', 'Ejecutar el plan', 'Revisar el resultado'], 'Polya propone: comprender, planear, ejecutar y verificar.'),
  mc('Razonamiento', 3, 'Serie: 1, 4, 9, 16, ... ¿Qué número sigue?', '25', ['20', '24', '18'], 'Son cuadrados perfectos: 1², 2², 3², 4², 5² = 25.'),
  mc('Razonamiento', 2, 'Un enfoque HEURÍSTICO se caracteriza por:', 'Buscar una solución razonable mediante prueba, error y experiencia.', ['Garantizar siempre la solución óptima.', 'Ser un lenguaje de programación.', 'No usar la lógica.'], 'La heurística busca soluciones prácticas y aproximadas, no siempre óptimas.'),
  mc('Razonamiento', 1, '¿Cuál es el siguiente en la serie 100, 90, 80, 70, ...?', '60', ['65', '75', '50'], 'La serie resta 10 cada vez: 70-10 = 60.'),
];

const U1_7_1_LOGICO: EjPlan[] = [
  ps('Lógica', 2, 'print(True and False)', 'False', ['True', 'None', 'Error'], 'and es True solo si AMBOS son True; aquí uno es False.'),
  ps('Lógica', 2, 'print(True or False)', 'True', ['False', 'None', 'Error'], 'or es True si AL MENOS uno es True.'),
  ps('Lógica', 2, 'print(not True)', 'False', ['True', 'None', 'Error'], 'not invierte el valor: not True = False.'),
  mc('Lógica', 3, 'En una tabla de verdad, "A and B" es True cuando:', 'A y B son ambos True', ['Al menos uno es True', 'Ambos son False', 'A es distinto de B'], 'La conjunción (and) exige que las dos condiciones sean verdaderas.'),
  mc('Lógica', 3, '"A or B" es False solo cuando:', 'A y B son ambos False', ['Al menos uno es True', 'Ambos son True', 'Nunca es False'], 'La disyunción (or) es False únicamente si ambos son False.'),
  ps('Lógica', 3, 'a = 5\nprint(a > 0 and a < 10)', 'True', ['False', 'None', 'Error'], '5>0 y 5<10 son True; True and True = True.'),
  ps('Lógica', 4, 'print((True or False) and not False)', 'True', ['False', 'None', 'Error'], '(True) and (not False = True) → True.'),
  mc('Lógica', 2, 'La negación de "es mayor de edad" (edad >= 18) es:', 'edad < 18', ['edad > 18', 'edad == 18', 'edad >= 18'], 'La negación de >=18 es <18.'),
  ol('Lógica', 3, 'Ordena para evaluar la expresión not (A and B):', ['Evaluar A and B', 'Obtener el resultado (True/False)', 'Aplicar not al resultado'], 'Primero se resuelve el paréntesis y luego se aplica la negación.'),
  ps('Lógica', 2, 'print(3 == 3 and 4 > 5)', 'False', ['True', 'None', 'Error'], '3==3 es True pero 4>5 es False; True and False = False.'),
];

const U1_7_2_MATEMATICO: EjPlan[] = [
  ps('Razonamiento matemático', 2, 'print(2 + 2 * 2)', '6', ['8', '4', '16'], 'Multiplicación antes que suma: 2*2=4, 2+4=6.'),
  ps('Razonamiento matemático', 2, 'print(15 % 4)', '3', ['3.75', '4', '1'], 'El resto de 15 entre 4: 15 = 4*3 + 3.'),
  ps('Razonamiento matemático', 3, 'print(sum([1, 2, 3, 4, 5]))', '15', ['10', '20', '12'], 'sum suma los elementos: 1+2+3+4+5 = 15.'),
  cc('Razonamiento matemático', 3, 'Completa para saber si n es divisible entre 3.', 'n = 12\nprint(n ____ 3 == 0)', '%', 'n % 3 == 0 es True si n es múltiplo de 3.'),
  ps('Razonamiento matemático', 2, 'print(max(4, 9, 2))', '9', ['4', '2', '15'], 'max devuelve el mayor: 9.'),
  ps('Razonamiento matemático', 2, 'print(min(4, 9, 2))', '2', ['4', '9', '15'], 'min devuelve el menor: 2.'),
  ps('Razonamiento matemático', 3, 'print(abs(-7))', '7', ['-7', '0', '14'], 'abs devuelve el valor absoluto: |-7| = 7.'),
  ps('Razonamiento matemático', 4, 'print(round(3.14159, 2))', '3.14', ['3.1', '3.142', '3'], 'round(x, 2) redondea a 2 decimales.'),
  ps('Razonamiento matemático', 3, `print(10 ** 2 // 3)`, '33', ['33.3', '30', '34'], '10²=100; 100 // 3 = 33 (división entera).'),
  ol('Razonamiento matemático', 3, 'Ordena para calcular el promedio de 3 números:', ['suma = a + b + c', 'promedio = suma / 3', 'print(promedio)'], 'Primero se suma, luego se divide entre la cantidad y se muestra.'),
];

const U1_8_DIAGRAMAS: EjPlan[] = [
  mc('Diagramas de flujo', 1, 'En un diagrama de flujo, ¿qué representa un rombo (◇)?', 'Una decisión/condición', ['El inicio', 'Un proceso', 'La salida'], 'El rombo representa una decisión (condición con salidas Sí/No).'),
  mc('Diagramas de flujo', 1, '¿Qué símbolo indica INICIO o FIN del algoritmo?', 'Óvalo (terminal)', ['Rectángulo', 'Rombo', 'Flecha'], 'El óvalo (terminal) marca el inicio y el fin del diagrama.'),
  mc('Diagramas de flujo', 1, 'El rectángulo en un diagrama de flujo representa:', 'Un proceso o acción', ['Una decisión', 'Entrada/salida', 'El fin'], 'El rectángulo simboliza un proceso: un cálculo o una asignación.'),
  mc('Diagramas de flujo', 2, 'El romboide/paralelogramo representa:', 'Entrada o salida de datos', ['Una decisión', 'El inicio', 'Un bucle'], 'El paralelogramo indica lectura (entrada) o impresión (salida) de datos.'),
  mc('Diagramas de flujo', 2, '¿Qué es el pseudocódigo?', 'Una descripción del algoritmo en lenguaje natural estructurado, previa al código.', ['Código máquina.', 'Un lenguaje compilado.', 'Un tipo de variable.'], 'El pseudocódigo describe la lógica con palabras estructuradas, sin sintaxis estricta.'),
  ol('Diagramas de flujo', 2, 'Ordena el pseudocódigo para leer un número e indicar si es positivo:', ['Inicio', 'Leer numero', 'Si numero > 0 entonces mostrar "Positivo"', 'Fin'], 'Todo pseudocódigo va de Inicio, entrada, proceso/decisión, hasta Fin.'),
  mc('Diagramas de flujo', 3, 'Las flechas en un diagrama de flujo indican:', 'El orden/secuencia de ejecución', ['Errores', 'Comentarios', 'Variables'], 'Las flechas conectan los símbolos mostrando el flujo de ejecución.'),
  ol('Diagramas de flujo', 3, 'Ordena el pseudocódigo que suma dos números:', ['Inicio', 'Leer a, b', 'suma = a + b', 'Mostrar suma', 'Fin'], 'Secuencia: inicio, entrada de datos, proceso, salida y fin.'),
  mc('Diagramas de flujo', 2, 'Un diagrama de flujo sirve principalmente para:', 'Visualizar la lógica del algoritmo antes de programar.', ['Ejecutar el programa.', 'Compilar el código.', 'Guardar archivos.'], 'El diagrama de flujo representa gráficamente la lógica para diseñarla y comunicarla.'),
  mc('Diagramas de flujo', 1, 'En pseudocódigo, "Leer x" equivale en Python a:', 'x = input()', ['print(x)', 'x == input', 'def x()'], '"Leer" es entrada de datos, que en Python se hace con input().'),
];

const U1_9_METODOLOGIAS: EjPlan[] = [
  mc('Metodologías', 2, 'La programación estructurada se basa en tres estructuras de control:', 'Secuencia, selección y repetición', ['Suma, resta y multiplicación', 'Variables, constantes y tipos', 'Editor, compilador y depurador'], 'Toda lógica se construye con secuencia, selección (condicionales) y repetición (bucles).'),
  mc('Metodologías', 2, 'El enfoque "divide y vencerás" consiste en:', 'Dividir un problema grande en subproblemas más pequeños.', ['Repetir el mismo código.', 'Evitar las funciones.', 'Programar sin planificar.'], 'Se descompone el problema en partes manejables que son más fáciles de resolver.'),
  mc('Metodologías', 2, 'El diseño "top-down" (descendente) implica:', 'Ir de lo general a lo específico, refinando por pasos.', ['Empezar por los detalles finales.', 'Programar sin estructura.', 'Escribir todo en una línea.'], 'Top-down parte del problema general y lo refina hacia módulos y detalles.'),
  mc('Metodologías', 1, 'La programación modular busca:', 'Dividir el programa en módulos/funciones reutilizables.', ['Usar una sola función gigante.', 'Evitar reutilizar código.', 'No comentar el código.'], 'La modularidad separa responsabilidades en módulos reutilizables.'),
  mc('Metodologías', 3, '¿Por qué se evita el uso indiscriminado de "goto"?', 'Rompe el flujo estructurado y dificulta leer el código.', ['Es más rápido.', 'Es obligatorio en Python.', 'Mejora la modularidad.'], 'La programación estructurada evita saltos arbitrarios que vuelven el código difícil de seguir.'),
  mc('Metodologías', 2, 'La "reutilización" de código se logra principalmente con:', 'Funciones y módulos', ['Copiar y pegar en todas partes', 'Escribir sin funciones', 'Comentarios'], 'Funciones y módulos permiten reusar la misma lógica sin duplicarla.'),
  ol('Metodologías', 3, 'Ordena el enfoque top-down para "gestionar una biblioteca":', ['Sistema de biblioteca', 'Módulo de préstamos', 'Función registrar_prestamo()', 'Detalle: validar fecha'], 'De lo general (sistema) a lo específico (una validación puntual).'),
  mc('Metodologías', 2, 'La "cohesión" alta en un módulo significa:', 'El módulo hace una sola cosa bien definida.', ['El módulo hace de todo.', 'Depende de muchos otros.', 'No tiene propósito.'], 'Alta cohesión: cada módulo tiene una responsabilidad única y clara.'),
  mc('Metodologías', 3, 'El "acoplamiento" bajo entre módulos es deseable porque:', 'Reduce las dependencias y facilita el mantenimiento.', ['Aumenta los errores.', 'Obliga a repetir código.', 'Hace el programa más lento siempre.'], 'Bajo acoplamiento: los módulos dependen poco entre sí, más fáciles de cambiar.'),
  mc('Metodologías', 1, 'Programar de forma estructurada mejora principalmente:', 'La legibilidad y el mantenimiento del código', ['La velocidad del hardware', 'El tamaño del monitor', 'La marca del procesador'], 'La estructura clara facilita leer, entender y mantener el programa.'),
];

const U1_10_ESTRUCTURA: EjPlan[] = [
  ol('Estructura del algoritmo', 1, 'Ordena las partes generales de un algoritmo:', ['Entrada de datos', 'Procesamiento', 'Salida de resultados'], 'Todo algoritmo sigue el modelo Entrada → Proceso → Salida.'),
  mc('Estructura del algoritmo', 1, '¿Qué parte del algoritmo recibe los datos iniciales?', 'La entrada', ['El proceso', 'La salida', 'El comentario'], 'La entrada obtiene los datos que el algoritmo necesita para trabajar.'),
  mc('Estructura del algoritmo', 2, 'La sección donde se realizan los cálculos es:', 'El proceso', ['La entrada', 'La salida', 'El título'], 'El proceso transforma los datos de entrada en resultados.'),
  mc('Estructura del algoritmo', 2, 'Mostrar el resultado final corresponde a:', 'La salida', ['La entrada', 'El proceso', 'La declaración'], 'La salida comunica el resultado al usuario (por ejemplo con print).'),
  ol('Estructura del algoritmo', 2, 'Ordena el algoritmo para calcular el área de un círculo:', ['Leer el radio', 'area = 3.1416 * radio ** 2', 'Mostrar area'], 'Entrada (radio) → Proceso (fórmula) → Salida (mostrar).'),
  mc('Estructura del algoritmo', 1, 'En Python, la ENTRADA de datos se hace típicamente con:', 'input()', ['print()', 'def', 'return'], 'input() lee datos del usuario (entrada).'),
  mc('Estructura del algoritmo', 1, 'En Python, la SALIDA de datos se hace con:', 'print()', ['input()', 'import', 'while'], 'print() muestra resultados en pantalla (salida).'),
  ol('Estructura del algoritmo', 3, 'Ordena el algoritmo para convertir grados Celsius a Fahrenheit:', ['Leer celsius', 'fahrenheit = celsius * 9/5 + 32', 'Mostrar fahrenheit'], 'Entrada (celsius) → Proceso (conversión) → Salida.'),
  mc('Estructura del algoritmo', 2, 'Un algoritmo bien estructurado debe tener:', 'Un inicio, un desarrollo y un fin claros.', ['Solo el inicio.', 'Ningún orden.', 'Solo salida.'], 'La estructura general contempla inicio, proceso y fin definidos.'),
  ol('Estructura del algoritmo', 2, 'Ordena el algoritmo que determina el mayor de dos números:', ['Leer a, b', 'Si a > b mostrar a', 'Sino mostrar b'], 'Se leen los datos y una decisión determina el resultado.'),
];

const U1_11_DISENO: EjPlan[] = [
  ol('Diseño de algoritmos', 2, 'Ordena el diseño de un algoritmo para calcular el promedio de N notas:', ['Leer la cantidad N de notas', 'Sumar todas las notas', 'Dividir la suma entre N', 'Mostrar el promedio'], 'Se define la entrada, el proceso acumulativo, el cálculo y la salida.'),
  mc('Diseño de algoritmos', 2, 'Antes de programar, el diseño del algoritmo sirve para:', 'Planear la solución paso a paso.', ['Elegir el color del editor.', 'Comprar hardware.', 'Instalar el sistema operativo.'], 'El diseño organiza la lógica antes de escribir el código.'),
  ol('Diseño de algoritmos', 3, 'Ordena el diseño para determinar si un número es par o impar:', ['Leer numero', 'Calcular resto = numero % 2', 'Si resto == 0 mostrar "Par"', 'Sino mostrar "Impar"'], 'Se lee el dato, se procesa con módulo y una decisión da el resultado.'),
  mc('Diseño de algoritmos', 3, 'Refinar un algoritmo por pasos sucesivos se conoce como:', 'Refinamiento por pasos (stepwise refinement)', ['Compilación', 'Depuración', 'Ejecución'], 'El refinamiento por pasos detalla la solución progresivamente.'),
  ol('Diseño de algoritmos', 2, 'Ordena el diseño para sumar los números del 1 al 100:', ['suma = 0', 'Repetir i de 1 a 100', 'suma = suma + i', 'Mostrar suma'], 'Se inicializa el acumulador, se recorre el rango sumando y se muestra.'),
  mc('Diseño de algoritmos', 1, 'Una variable "acumulador" sirve para:', 'Ir sumando o acumulando valores progresivamente.', ['Guardar el título del programa.', 'Detener el programa.', 'Cambiar el tipo de dato.'], 'El acumulador arranca en 0 y va sumando valores dentro de un bucle.'),
  ol('Diseño de algoritmos', 3, 'Ordena el diseño para encontrar el mayor de una lista de N números:', ['mayor = primer número', 'Recorrer los demás números', 'Si el número actual > mayor, actualizar mayor', 'Mostrar mayor'], 'Se toma un candidato inicial y se compara con cada elemento.'),
  mc('Diseño de algoritmos', 2, 'Una variable "contador" normalmente:', 'Aumenta de uno en uno para contar repeticiones.', ['Guarda texto.', 'Divide números.', 'Borra variables.'], 'El contador se incrementa (contador += 1) para contar eventos o vueltas.'),
  ol('Diseño de algoritmos', 2, 'Ordena el diseño para contar cuántos números positivos hay en una lista:', ['contador = 0', 'Recorrer cada número de la lista', 'Si el número > 0, contador = contador + 1', 'Mostrar contador'], 'El contador inicia en 0 y se incrementa cuando se cumple la condición.'),
  mc('Diseño de algoritmos', 1, 'El diseño de un algoritmo es independiente del:', 'Lenguaje de programación específico', ['Problema a resolver', 'Modelo Entrada-Proceso-Salida', 'Razonamiento lógico'], 'Un mismo algoritmo puede implementarse en Python, Java, C, etc.'),
];

// ════════════════════════════════════════════════════════════
//  UNIDAD 2 — PROGRAMACIÓN ESTRUCTURADA
// ════════════════════════════════════════════════════════════

const U2_1_CONCEPTOS: EjPlan[] = [
  mc('Prog. estructurada', 1, 'Las tres estructuras de control básicas son:', 'Secuencial, selectiva y repetitiva', ['Suma, resta y división', 'int, float y str', 'CPU, RAM y disco'], 'La programación estructurada usa secuencia, selección y repetición.'),
  ps('Prog. estructurada', 1, 'a = 3\nb = 4\nc = a + b\nprint(c)', '7', ['34', '12', 'a+b'], 'Secuencial: se ejecutan las líneas en orden; 3+4=7.'),
  mc('Prog. estructurada', 2, '¿Qué garantiza la programación estructurada?', 'Código con un solo punto de entrada y salida por bloque.', ['Que el código sea más largo.', 'Uso obligatorio de goto.', 'Que no haya funciones.'], 'Cada estructura tiene una entrada y una salida bien definidas.'),
  ps('Prog. estructurada', 2, 'x = 10\nx = x + 5\nx = x * 2\nprint(x)', '30', ['20', '25', '15'], 'Paso a paso: 10 → 15 → 30.'),
  mc('Prog. estructurada', 2, 'La indentación (sangría) en Python:', 'Define los bloques de código (es obligatoria).', ['Es decorativa y opcional.', 'Solo sirve para comentarios.', 'Genera errores siempre.'], 'En Python la indentación delimita los bloques; no es opcional.'),
  ol('Prog. estructurada', 2, 'Ordena las instrucciones secuenciales para calcular el perímetro de un cuadrado:', ['lado = 5', 'perimetro = lado * 4', 'print(perimetro)'], 'Se asigna, se calcula y se muestra, en ese orden.'),
  ps('Prog. estructurada', 1, 'nombre = "Ana"\nsaludo = "Hola " + nombre\nprint(saludo)', 'Hola Ana', ['Hola nombre', 'HolaAna', 'Error'], 'La concatenación une "Hola " con el valor de nombre.'),
  mc('Prog. estructurada', 3, '¿Cuál rompe el paradigma estructurado?', 'Saltar arbitrariamente con goto a cualquier línea.', ['Usar if/else.', 'Usar while.', 'Usar funciones.'], 'Los saltos incondicionales (goto) rompen el flujo estructurado.'),
  ps('Prog. estructurada', 2, 'total = 0\ntotal += 100\ntotal -= 30\nprint(total)', '70', ['130', '30', '100'], 'total: 0 → 100 → 70.'),
  cc('Prog. estructurada', 1, 'Completa para mostrar el doble de un número leído secuencialmente.', 'n = 6\ndoble = n * 2\n____(doble)', 'print', 'La salida secuencial se hace con print(doble).'),
];

const U2_2_SECUENCIALES: EjPlan[] = [
  ps('Estructuras secuenciales', 1, 'a = 5\nb = 3\nprint(a - b)', '2', ['8', '-2', '15'], 'Resta secuencial: 5-3=2.'),
  ps('Estructuras secuenciales', 2, 'precio = 50\ncantidad = 3\ntotal = precio * cantidad\nprint(total)', '150', ['53', '15', '503'], 'total = 50*3 = 150.'),
  cc('Estructuras secuenciales', 2, 'Completa para leer un número entero desde el teclado.', 'edad = int(____("Edad: "))\nprint(edad)', 'input', 'int(input(...)) lee texto y lo convierte a entero.'),
  ps('Estructuras secuenciales', 2, 'base = 4\naltura = 5\narea = base * altura / 2\nprint(area)', '10.0', ['20', '10', '9'], 'Área del triángulo = 4*5/2 = 10.0 (float por /).'),
  ps('Estructuras secuenciales', 1, 'x = 7\ny = x\nx = 2\nprint(y)', '7', ['2', '9', '0'], 'y copió el valor 7 antes de que x cambiara a 2.'),
  ol('Estructuras secuenciales', 2, 'Ordena para convertir minutos a segundos:', ['minutos = 3', 'segundos = minutos * 60', 'print(segundos)'], 'Entrada, proceso (×60) y salida en secuencia.'),
  ps('Estructuras secuenciales', 3, 'c = 20\nf = c * 9 / 5 + 32\nprint(f)', '68.0', ['68', '52', '36'], 'Celsius→Fahrenheit: 20*9/5+32 = 36+32 = 68.0.'),
  cc('Estructuras secuenciales', 2, 'Completa para intercambiar los valores de a y b.', 'a = 1\nb = 2\na, b = ____\nprint(a, b)', 'b, a', 'La asignación múltiple a, b = b, a intercambia los valores.'),
  ps('Estructuras secuenciales', 2, 'suma = 10 + 20\npromedio = suma / 2\nprint(promedio)', '15.0', ['30', '15', '10'], 'suma=30; promedio=30/2=15.0.'),
  ps('Estructuras secuenciales', 1, 'msg = "Py" + "thon"\nprint(msg)', 'Python', ['Py thon', 'Pythonthon', 'Error'], 'La concatenación une "Py" y "thon" → "Python".'),
];

const U2_3_SELECTIVAS: EjPlan[] = [
  ps('Condicionales', 1, 'x = 8\nif x > 5:\n    print("Grande")\nelse:\n    print("Chico")', 'Grande', ['Chico', 'Error', 'Grande\nChico'], '8>5 es True, se ejecuta el bloque if → "Grande".'),
  ps('Condicionales', 2, 'n = 4\nif n % 2 == 0:\n    print("Par")\nelse:\n    print("Impar")', 'Par', ['Impar', 'Error', '0'], '4 % 2 == 0 es True → "Par".'),
  ps('Condicionales', 2, 'nota = 51\nif nota >= 51:\n    print("Aprobado")\nelse:\n    print("Reprobado")', 'Aprobado', ['Reprobado', 'Error', '51'], '51>=51 es True → "Aprobado".'),
  ps('Condicionales', 3, 'x = 0\nif x > 0:\n    print("Positivo")\nelif x < 0:\n    print("Negativo")\nelse:\n    print("Cero")', 'Cero', ['Positivo', 'Negativo', 'Error'], 'x no es >0 ni <0, cae en el else → "Cero".'),
  cc('Condicionales', 2, 'Completa la palabra clave para la condición alternativa múltiple.', 'if x > 0:\n    print("pos")\n____ x < 0:\n    print("neg")\nelse:\n    print("cero")', 'elif', 'elif encadena condiciones alternativas.'),
  ps('Condicionales', 3, 'edad = 20\nif edad >= 18 and edad < 65:\n    print("Adulto")\nelse:\n    print("Otro")', 'Adulto', ['Otro', 'Error', 'Adulto\nOtro'], '20>=18 y 20<65 son True → "Adulto".'),
  ol('Condicionales', 2, 'Ordena para clasificar un número como positivo o no:', ['numero = 5', 'if numero > 0:', '    print("Positivo")', 'else:', '    print("No positivo")'], 'Se lee el dato, se evalúa la condición y se elige la rama.'),
  ps('Condicionales', 4, 'x = 15\nif x > 10:\n    if x > 20:\n        print("A")\n    else:\n        print("B")\nelse:\n    print("C")', 'B', ['A', 'C', 'Error'], 'x>10 True; dentro x>20 False → "B" (condicional anidada).'),
  ps('Condicionales', 3, 'dia = 3\nif dia == 1:\n    print("Lun")\nelif dia == 3:\n    print("Mie")\nelse:\n    print("Otro")', 'Mie', ['Lun', 'Otro', 'Error'], 'dia==3 coincide con el segundo elif → "Mie".'),
  cc('Condicionales', 2, 'Completa el operador para verificar si dos valores son iguales.', 'a = 5\nif a ____ 5:\n    print("igual")', '==', '== compara igualdad; = es asignación.'),
  ps('Condicionales', 2, 'temp = 30\nif temp > 25:\n    print("Calor")\nprint("Fin")', 'Calor\nFin', ['Calor', 'Fin', 'Error'], 'La condición imprime "Calor" y luego el print de afuera imprime "Fin".'),
];

const U2_4_REPETITIVAS: EjPlan[] = [
  ps('Bucles', 1, 'for i in range(3):\n    print(i)', '0\n1\n2', ['1\n2\n3', '0\n1\n2\n3', '3'], 'range(3) genera 0, 1, 2.'),
  ps('Bucles', 2, 'suma = 0\nfor i in range(1, 5):\n    suma += i\nprint(suma)', String(sumRange(1, 5)), ['15', '4', '5'], 'range(1,5) = 1,2,3,4; su suma es 10.'),
  ps('Bucles', 2, 'i = 0\nwhile i < 3:\n    print(i)\n    i += 1', '0\n1\n2', ['0\n1\n2\n3', '1\n2\n3', 'bucle infinito'], 'while imprime mientras i<3: 0,1,2.'),
  ps('Bucles', 2, 'for letra in "abc":\n    print(letra)', 'a\nb\nc', ['abc', '0\n1\n2', 'a b c'], 'El for recorre cada carácter del string.'),
  cc('Bucles', 2, 'Completa para repetir 10 veces (índices 0 a 9).', 'for i in ____(10):\n    print(i)', 'range', 'range(10) genera los números de 0 a 9.'),
  ps('Bucles', 3, 'total = 0\nfor i in range(1, 6):\n    total += i\nprint(total)', String(sumRange(1, 6)), ['10', '21', '6'], '1+2+3+4+5 = 15.'),
  ps('Bucles', 3, 'for i in range(0, 10, 2):\n    print(i, end=" ")', '0 2 4 6 8 ', ['0 2 4 6 8 10 ', '1 3 5 7 9 ', '2 4 6 8 '], 'range(0,10,2) avanza de 2 en 2: 0,2,4,6,8.'),
  ps('Bucles', 4, 'i = 1\nwhile i <= 5:\n    if i == 3:\n        break\n    print(i)\n    i += 1', '1\n2', ['1\n2\n3', '1\n2\n3\n4\n5', '3'], 'break corta el bucle cuando i==3, tras imprimir 1 y 2.'),
  cc('Bucles', 3, 'Completa la instrucción que salta a la siguiente iteración sin terminar el bucle.', 'for i in range(5):\n    if i == 2:\n        ____\n    print(i)', 'continue', 'continue omite el resto de la iteración y sigue con la próxima.'),
  ps('Bucles', 4, 'cuenta = 0\nfor i in range(1, 8):\n    if i % 2 == 0:\n        cuenta += 1\nprint(cuenta)', '3', ['4', '7', '2'], 'Pares en 1..7: 2,4,6 → 3.'),
  ol('Bucles', 3, 'Ordena para imprimir la tabla del 5 (del 5 al 50):', ['for i in range(1, 11):', '    resultado = 5 * i', '    print(resultado)'], 'Se recorre 1..10 multiplicando por 5 e imprimiendo.'),
];

const U2_5_PATRONES: EjPlan[] = [
  ps('Patrones numéricos', 3, 'n = 253\nunidades = n % 10\nprint(unidades)', '3', ['2', '5', '253'], 'n % 10 extrae el último dígito (unidades): 253 → 3.'),
  ps('Patrones numéricos', 3, 'n = 253\ndecenas = (n // 10) % 10\nprint(decenas)', '5', ['3', '2', '25'], '(253//10)=25; 25%10 = 5 (dígito de las decenas).'),
  ps('Patrones numéricos', 2, 'n = 47\nprint(n // 10, n % 10)', '4 7', ['7 4', '47 0', '4.7'], '47//10=4 (decenas), 47%10=7 (unidades).'),
  ps('Patrones numéricos', 4, `suma = 0\nfor i in range(1, 11):\n    suma += i\nprint(suma)`, String(sumRange(1, 11)), ['45', '10', '100'], 'Suma de 1 a 10 = 55.'),
  ps('Patrones numéricos', 4, 'resultado = 1\nfor i in range(1, 5):\n    resultado *= i\nprint(resultado)', String(factorial(4)), ['10', '20', '120'], 'Factorial de 4 = 1*2*3*4 = 24.'),
  cc('Patrones numéricos', 3, 'Completa para obtener el último dígito de un número.', 'n = 189\nultimo = n ____ 10\nprint(ultimo)', '%', 'n % 10 devuelve el dígito de las unidades.'),
  ps('Patrones numéricos', 3, 'serie = 0\nfor i in range(2, 11, 2):\n    serie += i\nprint(serie)', '30', ['20', '25', '2'], 'Pares 2+4+6+8+10 = 30.'),
  ps('Patrones numéricos', 5, 'a, b = 0, 1\nfor _ in range(5):\n    a, b = b, a + b\nprint(a)', '5', ['3', '8', '13'], 'Fibonacci: tras 5 pasos a=5 (0,1,1,2,3,5).'),
  ol('Patrones numéricos', 4, 'Ordena para sumar los dígitos de un número de 3 cifras (n=347):', ['n = 347', 'suma = n // 100 + (n // 10) % 10 + n % 10', 'print(suma)'], 'Se extrae cada dígito con // y % y se suman: 3+4+7=14.'),
  ps('Patrones numéricos', 4, 'cont = 0\nfor i in range(1, 21):\n    if i % 3 == 0:\n        cont += 1\nprint(cont)', '6', ['7', '5', '3'], 'Múltiplos de 3 entre 1 y 20: 3,6,9,12,15,18 → 6.'),
];

// ════════════════════════════════════════════════════════════
//  UNIDAD 3 — PROGRAMACIÓN MODULAR
// ════════════════════════════════════════════════════════════

const U3_1_PRINCIPIOS: EjPlan[] = [
  mc('Prog. modular', 1, '¿Qué es la programación modular?', 'Dividir el programa en módulos/funciones con tareas específicas.', ['Escribir todo en una función.', 'No usar funciones.', 'Repetir código.'], 'La modularidad separa el programa en piezas reutilizables y mantenibles.'),
  mc('Prog. modular', 2, 'Alta cohesión significa que un módulo:', 'Realiza una única tarea bien definida.', ['Hace muchas cosas distintas.', 'Depende de todos los demás.', 'No tiene función.'], 'La cohesión mide cuán enfocada está la responsabilidad de un módulo.'),
  mc('Prog. modular', 2, 'Bajo acoplamiento entre módulos implica:', 'Poca dependencia entre ellos.', ['Mucha dependencia.', 'Módulos idénticos.', 'Un solo módulo.'], 'El bajo acoplamiento facilita cambiar un módulo sin afectar a otros.'),
  mc('Prog. modular', 2, 'La reutilización de código se consigue con:', 'Funciones y módulos importables.', ['Copiar y pegar todo.', 'Escribir sin funciones.', 'Borrar el código.'], 'Definir funciones/módulos permite usarlos muchas veces.'),
  mc('Prog. modular', 3, '"Divide y vencerás" en programación consiste en:', 'Descomponer un problema grande en subproblemas menores.', ['Duplicar el código.', 'Evitar planificar.', 'Usar una sola variable.'], 'Se resuelven partes pequeñas y luego se combinan.'),
  ps('Prog. modular', 2, 'def saludar():\n    print("Hola")\n\nsaludar()\nsaludar()', 'Hola\nHola', ['Hola', 'saludar saludar', 'Error'], 'La función se define una vez y se reutiliza en cada llamada.'),
  mc('Prog. modular', 1, 'En Python, un "módulo" es:', 'Un archivo .py con funciones/variables reutilizables.', ['Un tipo de bucle.', 'Una variable global.', 'Un operador.'], 'Un módulo es un archivo Python que se puede importar.'),
  ol('Prog. modular', 3, 'Ordena el enfoque top-down para un programa de calculadora:', ['Calculadora', 'Módulo de operaciones', 'función sumar(a, b)', 'return a + b'], 'De lo general (calculadora) al detalle (una operación).'),
  mc('Prog. modular', 3, 'Una ventaja de la modularidad es:', 'Facilita probar y depurar cada parte por separado.', ['Hace el código imposible de leer.', 'Impide reutilizar código.', 'Elimina las funciones.'], 'Módulos pequeños se prueban y corrigen de forma aislada.'),
  cc('Prog. modular', 2, 'Completa para llamar a la función ya definida "calcular".', 'def calcular():\n    return 42\n\nx = ____()\nprint(x)', 'calcular', 'Se invoca la función por su nombre seguido de ().'),
];

const U3_2_FUNCIONES: EjPlan[] = [
  ps('Funciones', 1, 'def cuadrado(n):\n    return n * n\n\nprint(cuadrado(4))', '16', ['8', '4', '44'], 'cuadrado(4) devuelve 4*4 = 16.'),
  ps('Funciones', 2, 'def sumar(a, b):\n    return a + b\n\nprint(sumar(3, 5))', '8', ['35', '15', '2'], 'La función devuelve 3+5 = 8.'),
  cc('Funciones', 1, 'Completa la palabra clave para DEFINIR una función.', '____ saludar():\n    print("Hola")', 'def', 'def define una función en Python.'),
  cc('Funciones', 2, 'Completa para DEVOLVER el resultado desde la función.', 'def doble(n):\n    ____ n * 2\n\nprint(doble(5))', 'return', 'return entrega el valor calculado a quien llamó la función.'),
  ps('Funciones', 3, 'def saludar(nombre="mundo"):\n    print("Hola", nombre)\n\nsaludar()', 'Hola mundo', ['Hola nombre', 'Hola', 'Error'], 'El parámetro por defecto "mundo" se usa al no pasar argumento.'),
  ps('Funciones', 3, 'x = 10\ndef cambiar():\n    x = 5\n    print(x)\n\ncambiar()\nprint(x)', '5\n10', ['5\n5', '10\n10', '10\n5'], 'La x dentro de la función es LOCAL; la global sigue siendo 10.'),
  ps('Funciones', 4, 'def op(a, b):\n    return a - b\n\nprint(op(b=2, a=9))', '7', ['-7', '92', '11'], 'Argumentos por nombre: a=9, b=2 → 9-2 = 7.'),
  ps('Funciones', 2, 'def area(base, altura):\n    return base * altura / 2\n\nprint(area(6, 4))', '12.0', ['24', '12', '10'], 'Área del triángulo = 6*4/2 = 12.0.'),
  ol('Funciones', 3, 'Ordena para definir y usar una función que multiplica por 3:', ['def triple(n):', '    return n * 3', 'resultado = triple(7)', 'print(resultado)'], 'Primero se define la función y luego se llama guardando el resultado.'),
  mc('Funciones', 2, 'El "ámbito" (scope) de una variable definida DENTRO de una función es:', 'Local (solo existe dentro de la función)', ['Global siempre', 'Del sistema operativo', 'Del hardware'], 'Las variables locales solo viven dentro de su función.'),
  cc('Funciones', 3, 'Completa para importar la función sqrt del módulo math.', 'from math ____ sqrt\nprint(sqrt(9))', 'import', 'from math import sqrt trae la función al programa.'),
];

const U3_3_RECURSIVIDAD: EjPlan[] = [
  ps('Recursividad', 3, 'def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)\n\nprint(fact(4))', String(factorial(4)), ['12', '16', '10'], 'fact(4)=4*3*2*1=24 (recursión con caso base n<=1).'),
  mc('Recursividad', 2, 'Una función recursiva SIEMPRE necesita:', 'Un caso base que detenga la recursión.', ['Un bucle for.', 'Una variable global.', 'Un import.'], 'Sin caso base la recursión no termina (recursión infinita).'),
  ps('Recursividad', 4, 'def cuenta(n):\n    if n == 0:\n        return\n    print(n)\n    cuenta(n - 1)\n\ncuenta(3)', '3\n2\n1', ['1\n2\n3', '3\n2\n1\n0', '0'], 'Imprime 3,2,1 y para al llegar al caso base n==0.'),
  mc('Recursividad', 3, '¿Qué ocurre si una función recursiva no tiene caso base?', 'Se produce recursión infinita (RecursionError).', ['Se ejecuta más rápido.', 'Devuelve 0.', 'No compila.'], 'Sin condición de término la pila de llamadas se desborda.'),
  ps('Recursividad', 4, 'def suma(n):\n    if n == 0:\n        return 0\n    return n + suma(n - 1)\n\nprint(suma(5))', String(sumRange(0, 6)), ['10', '120', '5'], 'suma(5)=5+4+3+2+1+0 = 15.'),
  mc('Recursividad', 3, 'La recursividad es una alternativa a:', 'La iteración (bucles)', ['La entrada de datos', 'La declaración de variables', 'Los comentarios'], 'Muchos problemas iterativos pueden resolverse también recursivamente.'),
  ps('Recursividad', 5, 'def pot(base, exp):\n    if exp == 0:\n        return 1\n    return base * pot(base, exp - 1)\n\nprint(pot(2, 4))', '16', ['8', '6', '32'], 'pot(2,4)=2*2*2*2 = 16 con caso base exp==0.'),
  ol('Recursividad', 4, 'Ordena la estructura de una función recursiva de factorial:', ['def fact(n):', '    if n <= 1:', '        return 1', '    return n * fact(n - 1)'], 'Primero la definición, el caso base, y luego el caso recursivo.'),
  mc('Recursividad', 4, 'En fact(3) → 3*fact(2) → 3*2*fact(1), fact(1) devuelve:', '1 (caso base)', ['3', '6', '0'], 'El caso base n<=1 devuelve 1, deteniendo la recursión.'),
  cc('Recursividad', 3, 'Completa el caso base para que la recursión termine en 0.', 'def bajar(n):\n    if n == ____:\n        return\n    print(n)\n    bajar(n - 1)', '0', 'El caso base n==0 detiene la recursión.'),
];

// ════════════════════════════════════════════════════════════
//  UNIDAD 4 — ESTRUCTURA DE DATOS (VECTORES Y MATRICES)
// ════════════════════════════════════════════════════════════

const U4_1_VECTORES: EjPlan[] = [
  ps('Vectores', 1, 'nums = [10, 20, 30]\nprint(nums[0])', '10', ['20', '30', '0'], 'El índice 0 accede al primer elemento: 10.'),
  ps('Vectores', 1, 'nums = [10, 20, 30]\nprint(nums[-1])', '30', ['10', '20', '-1'], 'El índice -1 accede al último elemento: 30.'),
  ps('Vectores', 2, 'nums = [1, 2, 3]\nnums.append(4)\nprint(nums)', '[1, 2, 3, 4]', ['[1, 2, 3]', '[4, 1, 2, 3]', '[1, 2, 4]'], 'append agrega el elemento al final de la lista.'),
  ps('Vectores', 2, 'nums = [5, 3, 8, 1]\nprint(len(nums))', '4', ['3', '5', '17'], 'len devuelve la cantidad de elementos: 4.'),
  ps('Vectores', 2, 'nums = [4, 2, 7, 1]\nprint(sum(nums))', '14', ['4', '13', '7'], 'sum suma todos los elementos: 4+2+7+1 = 14.'),
  ps('Vectores', 3, 'nums = [4, 2, 7, 1]\nprint(max(nums), min(nums))', '7 1', ['1 7', '7 2', '4 1'], 'max=7 y min=1.'),
  cc('Vectores', 2, 'Completa para agregar el número 99 al final de la lista.', 'nums = [1, 2, 3]\nnums.____(99)\nprint(nums)', 'append', 'append(99) añade 99 al final.'),
  ps('Vectores', 3, 'nums = [1, 2, 3, 4, 5]\nprint(nums[1:4])', '[2, 3, 4]', ['[1, 2, 3]', '[2, 3, 4, 5]', '[1, 2, 3, 4]'], 'El slice [1:4] toma índices 1,2,3 (el 4 no se incluye).'),
  ps('Vectores', 4, 'nums = [3, 1, 2]\nnums.sort()\nprint(nums)', '[1, 2, 3]', ['[3, 2, 1]', '[3, 1, 2]', '[1, 3, 2]'], 'sort ordena la lista de menor a mayor.'),
  mc('Vectores', 3, 'El ordenamiento "burbuja" funciona:', 'Comparando e intercambiando elementos adyacentes repetidamente.', ['Dividiendo la lista a la mitad.', 'Buscando un elemento.', 'Sin comparar.'], 'Burbuja compara pares vecinos y los intercambia hasta ordenar.'),
  mc('Vectores', 4, 'La búsqueda BINARIA requiere que la lista esté:', 'Ordenada', ['Vacía', 'Desordenada', 'Con un solo elemento'], 'La búsqueda binaria divide a la mitad y solo funciona en listas ordenadas.'),
  ps('Vectores', 4, 'nums = [2, 4, 6, 8]\ntotal = 0\nfor n in nums:\n    total += n\nprint(total)', '20', ['16', '8', '10'], 'Acumula 2+4+6+8 = 20.'),
];

const U4_2_MATRICES: EjPlan[] = [
  ps('Matrices', 2, 'm = [[1, 2], [3, 4]]\nprint(m[0][1])', '2', ['1', '3', '4'], 'm[0] es [1,2]; su índice [1] es 2.'),
  ps('Matrices', 2, 'm = [[1, 2], [3, 4]]\nprint(m[1][0])', '3', ['2', '4', '1'], 'm[1] es [3,4]; su índice [0] es 3.'),
  ps('Matrices', 3, 'm = [[1, 2, 3], [4, 5, 6]]\nprint(len(m), len(m[0]))', '2 3', ['3 2', '6 1', '2 2'], 'La matriz tiene 2 filas y 3 columnas.'),
  cc('Matrices', 2, 'Completa para acceder al elemento de la fila 1, columna 2.', 'm = [[1, 2, 3], [4, 5, 6]]\nprint(m[1]____)', '[2]', 'm[1][2] accede a la fila 1, columna 2 → 6.'),
  ps('Matrices', 4, 'm = [[1, 2], [3, 4]]\ntotal = 0\nfor fila in m:\n    for x in fila:\n        total += x\nprint(total)', '10', ['7', '4', '6'], 'Suma de todos: 1+2+3+4 = 10 (doble bucle).'),
  ps('Matrices', 3, 'm = [[0, 0], [0, 0]]\nm[0][0] = 5\nprint(m)', '[[5, 0], [0, 0]]', ['[[0, 0], [0, 5]]', '[[5, 5], [0, 0]]', '[[0, 5], [0, 0]]'], 'Se modifica solo la posición [0][0] a 5.'),
  ol('Matrices', 4, 'Ordena para recorrer e imprimir todos los elementos de una matriz:', ['for fila in matriz:', '    for elemento in fila:', '        print(elemento)'], 'Un bucle recorre las filas y otro anidado los elementos de cada fila.'),
  ps('Matrices', 4, 'm = [[1, 2, 3], [4, 5, 6]]\nsuma_fila0 = sum(m[0])\nprint(suma_fila0)', '6', ['15', '5', '9'], 'sum(m[0]) suma la primera fila: 1+2+3 = 6.'),
  mc('Matrices', 3, 'Una matriz en Python se representa como:', 'Una lista de listas', ['Un solo número', 'Un string', 'Una función'], 'La matriz (2D) es una lista cuyos elementos son listas (las filas).'),
  ps('Matrices', 3, 'm = [[1, 2], [3, 4], [5, 6]]\nprint(len(m))', '3', ['2', '6', '1'], 'La matriz tiene 3 filas, por eso len(m) = 3.'),
];

const U4_3_CADENAS: EjPlan[] = [
  ps('Cadenas', 1, 's = "Python"\nprint(len(s))', '6', ['5', '7', 'Python'], 'len cuenta los caracteres: "Python" tiene 6.'),
  ps('Cadenas', 1, 's = "Hola"\nprint(s[0])', 'H', ['o', 'a', 'Hola'], 'El índice 0 accede al primer carácter: "H".'),
  ps('Cadenas', 2, 's = "Python"\nprint(s.upper())', 'PYTHON', ['python', 'Python', 'PYTHON()'], 'upper() convierte todo a mayúsculas.'),
  ps('Cadenas', 2, 's = "HOLA"\nprint(s.lower())', 'hola', ['HOLA', 'Hola', 'hola()'], 'lower() convierte todo a minúsculas.'),
  ps('Cadenas', 2, 's = "abc"\nprint(s * 3)', 'abcabcabc', ['abc3', 'aaabbbccc', 'Error'], 'El operador * repite el string 3 veces.'),
  ps('Cadenas', 3, 's = "Python"\nprint(s[1:4])', 'yth', ['Pyt', 'ytho', 'yt'], 'El slice [1:4] toma los índices 1,2,3 → "yth".'),
  cc('Cadenas', 2, 'Completa para saber si "gato" contiene la letra "a".', 'palabra = "gato"\nprint("a" ____ palabra)', 'in', 'El operador in verifica pertenencia: "a" in "gato" → True.'),
  ps('Cadenas', 3, 's = "hola mundo"\nprint(s.replace("mundo", "Python"))', 'hola Python', ['hola mundo', 'Python mundo', 'holaPython'], 'replace cambia "mundo" por "Python".'),
  ps('Cadenas', 3, 's = "a,b,c"\nprint(s.split(","))', "['a', 'b', 'c']", ['a b c', "['a,b,c']", 'abc'], 'split(",") separa el string en una lista usando la coma.'),
  ps('Cadenas', 4, 's = "reconocer"\nprint(s == s[::-1])', 'True', ['False', 'reconocer', 'Error'], '"reconocer" es palíndromo: igual leído al revés (s[::-1]).'),
  cc('Cadenas', 3, 'Completa para invertir la cadena usando slicing.', 's = "python"\nprint(s[____])', '::-1', 's[::-1] recorre la cadena en sentido inverso.'),
];

// ════════════════════════════════════════════════════════════
//  UNIDAD 5 — INTERFAZ GRÁFICA (tkinter)
// ════════════════════════════════════════════════════════════

const U5_1_COMPONENTES: EjPlan[] = [
  mc('Interfaz gráfica', 1, 'En Python, la librería estándar para crear interfaces gráficas es:', 'tkinter', ['numpy', 'random', 'os'], 'tkinter es el módulo estándar de Python para GUIs.'),
  cc('Interfaz gráfica', 1, 'Completa para importar la librería gráfica estándar.', 'import ____\nventana = tkinter.Tk()', 'tkinter', 'import tkinter da acceso a los componentes gráficos.'),
  mc('Interfaz gráfica', 2, 'En tkinter, la ventana principal se crea con:', 'Tk()', ['Window()', 'Frame()', 'Screen()'], 'ventana = Tk() crea la ventana raíz de la aplicación.'),
  mc('Interfaz gráfica', 2, 'El widget que muestra texto NO editable es:', 'Label', ['Entry', 'Button', 'Menu'], 'Label muestra texto o imágenes fijas (etiqueta).'),
  mc('Interfaz gráfica', 2, 'El widget donde el usuario ESCRIBE texto es:', 'Entry', ['Label', 'Button', 'Canvas'], 'Entry es el cuadro de texto de una línea para entrada del usuario.'),
  mc('Interfaz gráfica', 1, 'El widget que el usuario presiona para ejecutar una acción es:', 'Button', ['Label', 'Entry', 'Frame'], 'Button es el botón que dispara una acción al hacer clic.'),
  mc('Interfaz gráfica', 3, '¿Qué widget agrupa/contiene otros widgets?', 'Frame (contenedor)', ['Label', 'Button', 'Entry'], 'Frame es un contenedor para organizar otros widgets.'),
  cc('Interfaz gráfica', 2, 'Completa para mostrar la ventana e iniciar el bucle de eventos.', 'ventana = Tk()\nventana.____()', 'mainloop', 'mainloop() inicia el bucle que mantiene la ventana abierta.'),
  ol('Interfaz gráfica', 3, 'Ordena los pasos para crear una ventana con un botón en tkinter:', ['from tkinter import Tk, Button', 'ventana = Tk()', 'boton = Button(ventana, text="OK")', 'boton.pack()', 'ventana.mainloop()'], 'Se importa, se crea la ventana, el widget, se ubica y se inicia el bucle.'),
  mc('Interfaz gráfica', 2, 'El método pack() o grid() sirve para:', 'Ubicar (posicionar) los widgets en la ventana.', ['Cerrar la ventana.', 'Crear variables.', 'Ejecutar cálculos.'], 'pack/grid/place son gestores de geometría que posicionan los widgets.'),
];

const U5_2_EVENTOS: EjPlan[] = [
  mc('Eventos', 1, 'Un "evento" en una interfaz gráfica es:', 'Una acción del usuario (clic, tecla, etc.) que el programa detecta.', ['Un error de sintaxis.', 'Una variable global.', 'Un tipo de dato.'], 'Los eventos son acciones (clic, teclado) a las que la GUI reacciona.'),
  mc('Eventos', 2, 'En tkinter, la acción a ejecutar al presionar un botón se indica con el parámetro:', 'command', ['action', 'onclick', 'event'], 'Button(..., command=funcion) asigna la función que se ejecuta al hacer clic.'),
  cc('Eventos', 2, 'Completa para que el botón ejecute la función saludar al hacer clic.', 'def saludar():\n    print("Hola")\nboton = Button(ventana, text="Saludar", ____=saludar)', 'command', 'command=saludar enlaza el clic del botón con la función.'),
  mc('Eventos', 3, 'El "manejador de eventos" (event handler) es:', 'La función que se ejecuta cuando ocurre el evento.', ['El botón en sí.', 'La ventana principal.', 'Un tipo de variable.'], 'El handler es la función asociada a un evento (callback).'),
  mc('Eventos', 3, 'El método bind() en tkinter sirve para:', 'Asociar un evento (ej. clic o tecla) a una función.', ['Cerrar la ventana.', 'Crear una lista.', 'Sumar números.'], 'widget.bind("<Button-1>", funcion) enlaza un evento con su manejador.'),
  mc('Eventos', 2, 'El modelo de programación basado en eventos significa que:', 'El programa reacciona a las acciones del usuario, no sigue solo un orden fijo.', ['El programa ignora al usuario.', 'No usa funciones.', 'Solo imprime texto.'], 'En la programación dirigida por eventos el flujo lo marcan las interacciones.'),
  cc('Eventos', 3, 'Completa para asociar el clic izquierdo del ratón a la función clic.', 'def clic(evento):\n    print("Clic!")\nlienzo.____("<Button-1>", clic)', 'bind', 'bind("<Button-1>", clic) asocia el clic izquierdo con la función.'),
  mc('Eventos', 2, 'Al presionar un botón con command=contar, ¿qué se ejecuta?', 'La función contar()', ['Se cierra la app.', 'Se borra la ventana.', 'Nada.'], 'command=contar ejecuta la función contar cada vez que se hace clic.'),
  ol('Eventos', 3, 'Ordena para crear un botón que ejecuta una función al hacer clic:', ['def accion():', '    print("Presionado")', 'boton = Button(ventana, text="Ir", command=accion)', 'boton.pack()'], 'Se define el manejador, se crea el botón enlazándolo y se ubica.'),
  mc('Eventos', 4, 'Un evento "<Key>" en tkinter representa:', 'La pulsación de una tecla del teclado.', ['Un clic del ratón.', 'Cerrar la ventana.', 'Un temporizador.'], '"<Key>" captura la pulsación de teclas del teclado.'),
];

// ── Árbol del plan (UPEA / PRG-111) ─────────────────────────
export const PLAN_UPEA: UnidadPlan[] = [
  {
    numero: 1, titulo: 'Fundamentos de la Programación', nivel: 1, institucion: 'UPEA', plan: 'PRG-111',
    descripcion: 'Algoritmos, fases del software, lenguajes, tipos de datos, operadores, expresiones, razonamiento, diagramas de flujo y diseño de algoritmos.',
    temas: [
      { numero: '1.1', titulo: 'Concepto de algoritmo y programación', descripcion: 'Qué es un algoritmo y qué es programar.', ejercicios: U1_1_ALGORITMO },
      { numero: '1.2', titulo: 'Fases del desarrollo de software', descripcion: 'Ciclo de vida: análisis, diseño, codificación, pruebas y mantenimiento.', ejercicios: U1_2_FASES },
      { numero: '1.3', titulo: 'Lenguajes de programación', descripcion: 'Tipos y niveles (bajo/alto nivel, compilado/interpretado).', ejercicios: U1_3_LENGUAJES },
      { numero: '1.4', titulo: 'Herramientas de desarrollo', descripcion: 'IDE, compiladores, intérpretes y depuradores.', ejercicios: U1_4_HERRAMIENTAS },
      {
        numero: '1.5', titulo: 'Tipos de datos y variables', descripcion: 'int, float, str, bool y el uso de variables.', ejercicios: U1_5_TIPOS,
        subtemas: [
          { numero: '1.5.1', titulo: 'Constantes', descripcion: 'Valores fijos y convención de mayúsculas.', ejercicios: U1_5_1_CONSTANTES },
          { numero: '1.5.2', titulo: 'Operadores', descripcion: 'Aritméticos, relacionales y lógicos.', ejercicios: U1_5_2_OPERADORES },
        ],
      },
      { numero: '1.6', titulo: 'Expresiones', descripcion: 'Precedencia de operadores y evaluación de expresiones.', ejercicios: U1_6_EXPRESIONES },
      {
        numero: '1.7', titulo: 'Razonamiento', descripcion: 'Razonamiento lógico-heurístico y matemático.', ejercicios: U1_7_RAZONAMIENTO,
        subtemas: [
          { numero: '1.7.1', titulo: 'Lógico-Heurístico', descripcion: 'Lógica booleana y resolución heurística.', ejercicios: U1_7_1_LOGICO },
          { numero: '1.7.2', titulo: 'Matemático', descripcion: 'Razonamiento numérico aplicado.', ejercicios: U1_7_2_MATEMATICO },
        ],
      },
      { numero: '1.8', titulo: 'Diagramas de flujo y pseudocódigo', descripcion: 'Símbolos y representación de la lógica.', ejercicios: U1_8_DIAGRAMAS },
      { numero: '1.9', titulo: 'Metodologías de la programación', descripcion: 'Estructurada, modular, top-down y divide y vencerás.', ejercicios: U1_9_METODOLOGIAS },
      { numero: '1.10', titulo: 'Estructura general de un algoritmo', descripcion: 'Entrada, proceso y salida.', ejercicios: U1_10_ESTRUCTURA },
      { numero: '1.11', titulo: 'Diseño de un algoritmo', descripcion: 'Acumuladores, contadores y refinamiento por pasos.', ejercicios: U1_11_DISENO },
    ],
  },
  {
    numero: 2, titulo: 'Programación Estructurada', nivel: 2, institucion: 'UPEA', plan: 'PRG-111',
    descripcion: 'Estructuras secuenciales, selectivas (if/elif/else, match-case) y repetitivas (for, while), además de patrones numéricos.',
    temas: [
      { numero: '2.1', titulo: 'Conceptos de programación estructurada', descripcion: 'Secuencia, selección y repetición.', ejercicios: U2_1_CONCEPTOS },
      { numero: '2.2', titulo: 'Estructuras secuenciales', descripcion: 'Ejecución paso a paso, entrada/proceso/salida.', ejercicios: U2_2_SECUENCIALES },
      { numero: '2.3', titulo: 'Estructuras selectivas o condicionales', descripcion: 'if, if-else, if-elif-else, anidadas y match-case.', ejercicios: U2_3_SELECTIVAS },
      { numero: '2.4', titulo: 'Estructuras repetitivas o bucles', descripcion: 'for, while, range, break y continue.', ejercicios: U2_4_REPETITIVAS },
      { numero: '2.5', titulo: 'Procesamiento y patrones numéricos', descripcion: 'Descomposición de números, series y sucesiones.', ejercicios: U2_5_PATRONES },
    ],
  },
  {
    numero: 3, titulo: 'Programación Modular', nivel: 3, institucion: 'UPEA', plan: 'PRG-111',
    descripcion: 'Principios de modularidad, funciones y procedimientos, y recursividad.',
    temas: [
      { numero: '3.1', titulo: 'Principios de la programación modular', descripcion: 'Cohesión, acoplamiento, reutilización y top-down.', ejercicios: U3_1_PRINCIPIOS },
      { numero: '3.2', titulo: 'Funciones y procedimientos', descripcion: 'Parámetros, ámbito local/global, módulos.', ejercicios: U3_2_FUNCIONES },
      { numero: '3.3', titulo: 'Técnica de programación recursiva', descripcion: 'Recursividad, caso base y casos recursivos.', ejercicios: U3_3_RECURSIVIDAD },
    ],
  },
  {
    numero: 4, titulo: 'Estructura de Datos (Vectores y Matrices)', nivel: 4, institucion: 'UPEA', plan: 'PRG-111',
    descripcion: 'Arreglos unidimensionales (vectores), bidimensionales (matrices) y cadenas de caracteres.',
    temas: [
      { numero: '4.1', titulo: 'Arreglos unidimensionales / vectores', descripcion: 'Declaración, acceso, operaciones, ordenamiento y búsqueda.', ejercicios: U4_1_VECTORES },
      { numero: '4.2', titulo: 'Arreglos bidimensionales / matrices', descripcion: 'Declaración, acceso y operaciones con matrices.', ejercicios: U4_2_MATRICES },
      { numero: '4.3', titulo: 'Cadenas de caracteres', descripcion: 'Operaciones, métodos y búsqueda de patrones.', ejercicios: U4_3_CADENAS },
    ],
  },
  {
    numero: 5, titulo: 'Interfaz Gráfica en Lenguaje de Alto Nivel', nivel: 5, institucion: 'UPEA', plan: 'PRG-111',
    descripcion: 'Componentes de la interfaz gráfica y gestión de eventos con Python (tkinter).',
    temas: [
      { numero: '5.1', titulo: 'Componentes básicos de la interfaz gráfica', descripcion: 'Ventanas, etiquetas, cuadros de texto, botones y contenedores.', ejercicios: U5_1_COMPONENTES },
      { numero: '5.2', titulo: 'Gestión de eventos', descripcion: 'Modelo de eventos, tipos y manejo de eventos.', ejercicios: U5_2_EVENTOS },
    ],
  },
];

// ════════════════════════════════════════════════════════════
//  NIVEL AVANZADO por tema (garantiza cobertura Básico/Intermedio/Avanzado).
//  Se inyectan en el seed por `numero` de tema. dificultad 4 → nivel avanzado.
// ════════════════════════════════════════════════════════════
export const EXTRA_AVANZADO: Record<string, EjPlan[]> = {
  '1.1': [
    mc('Algoritmo', 4, 'Dos algoritmos resuelven el mismo problema. ¿Qué criterio decide formalmente cuál es "mejor" para entradas grandes?', 'Su complejidad (orden de crecimiento del número de operaciones).', ['El color del editor donde se escribió.', 'La cantidad de comentarios que tiene.', 'El lenguaje de programación usado.'], 'La eficiencia se compara por el orden de crecimiento (complejidad), no por detalles superficiales.'),
    mc('Algoritmo', 4, 'Una condición que se mantiene verdadera antes y después de cada iteración de un bucle se denomina:', 'Invariante de bucle', ['Variable global', 'Efecto colateral', 'Caso base'], 'El invariante de bucle permite demostrar formalmente que un algoritmo es correcto.'),
    mc('Algoritmo', 4, 'La propiedad de "efectividad" de un algoritmo exige que cada paso sea:', 'Realizable en tiempo finito con recursos finitos.', ['Escrito en inglés.', 'Ejecutado en paralelo.', 'Aproximado y ambiguo.'], 'La efectividad implica que cada operación pueda ejecutarse de forma exacta y en tiempo finito.'),
  ],
  '1.2': [
    mc('Fases del software', 4, 'En el modelo en V, cada fase de desarrollo se asocia directamente con una fase de:', 'Verificación/pruebas correspondiente.', ['Facturación al cliente.', 'Marketing del producto.', 'Contratación de personal.'], 'El modelo en V empareja cada nivel de diseño con su nivel de prueba.'),
    mc('Fases del software', 4, 'La acumulación de decisiones de diseño apresuradas que dificultan cambios futuros se conoce como:', 'Deuda técnica', ['Requisito funcional', 'Prueba de regresión', 'Refactorización'], 'La deuda técnica encarece el mantenimiento y suele pagarse con refactorización.'),
    mc('Fases del software', 4, 'Volver a ejecutar pruebas ya superadas tras un cambio, para asegurar que no se rompió nada, es una prueba de:', 'Regresión', ['Aceptación', 'Humo (smoke) inicial', 'Carga'], 'Las pruebas de regresión protegen la funcionalidad existente frente a nuevos cambios.'),
  ],
  '1.3': [
    mc('Lenguajes', 4, '¿Qué genera un COMPILADOR a diferencia de un intérprete?', 'Un archivo traducido (objeto/ejecutable) que se ejecuta después.', ['Ejecuta el código sin traducirlo nunca.', 'Un diagrama de flujo automático.', 'Únicamente mensajes de error.'], 'El compilador traduce todo el programa; el intérprete lo ejecuta instrucción a instrucción.'),
    ps('Lenguajes', 4, "print(type(10).__name__)", 'int', ['integer', 'number', 'Int'], 'En CPython, type(10).__name__ devuelve la cadena "int".'),
    mc('Lenguajes', 4, 'CPython traduce el código fuente a una representación intermedia que ejecuta su máquina virtual. Esa representación es el:', 'Bytecode', ['Código máquina nativo x86.', 'Lenguaje ensamblador.', 'HTML'], 'Python compila a bytecode (.pyc) que la PVM interpreta; no genera binario nativo por defecto.'),
  ],
  '1.4': [
    mc('Herramientas', 4, 'Un depurador (debugger) permite principalmente:', 'Detener la ejecución e inspeccionar el estado paso a paso.', ['Aumentar la velocidad del procesador.', 'Compilar más rápido siempre.', 'Formatear el disco duro.'], 'El debugger fija breakpoints y examina variables para localizar errores lógicos.'),
    mc('Herramientas', 4, 'Un entorno virtual (venv) en Python sirve para:', 'Aislar las dependencias/paquetes de un proyecto.', ['Acelerar la CPU.', 'Cifrar el código fuente.', 'Traducir el código a inglés.'], 'venv evita conflictos de versiones manteniendo dependencias separadas por proyecto.'),
    mc('Herramientas', 4, 'Una herramienta que analiza el código buscando errores de estilo y posibles fallos SIN ejecutarlo es un:', 'Linter (análisis estático)', ['Depurador dinámico', 'Compilador JIT', 'Profiler de memoria'], 'El linter hace análisis estático: revisa el código sin ejecutarlo.'),
  ],
  '1.5': [
    ps('Tipos de datos', 4, "print(int('101', 2))", '5', ['101', '3', '7'], "int('101', 2) interpreta '101' en base 2 → 5."),
    ps('Tipos de datos', 4, "print(type(5 / 2).__name__)", 'float', ['int', 'double', 'number'], 'La división / en Python 3 siempre produce float, aun con enteros.'),
    mc('Tipos de datos', 4, 'En Python, ¿qué diferencia hay entre "==" e "is"?', '"==" compara valores; "is" compara identidad (mismo objeto en memoria).', ['Son idénticos en todos los casos.', '"is" compara valores y "==" identidad.', 'Ninguno existe en Python.'], '"==" evalúa igualdad de valor; "is" evalúa si dos nombres apuntan al mismo objeto.'),
  ],
  '1.5.1': [
    mc('Constantes', 4, 'Python no tiene constantes "reales". ¿Cómo se expresa la INTENCIÓN de que un valor no cambie?', 'Nombrándolo en MAYÚSCULAS por convención (ej. PI = 3.1416).', ['Con la palabra clave const.', 'Escribiéndolo en minúsculas.', 'Es imposible expresarlo.'], 'Por convención PEP 8, los nombres en MAYÚSCULAS indican constantes; el lenguaje no las impone.'),
    mc('Constantes', 4, 'Usar constantes con nombre en lugar de "números mágicos" mejora principalmente:', 'La legibilidad y el mantenimiento del código.', ['La velocidad del procesador.', 'El tamaño del disco.', 'La resolución de pantalla.'], 'Nombrar los valores evita repetir literales y facilita cambiarlos en un solo lugar.'),
    mc('Constantes', 4, '¿Qué módulo de la librería estándar ofrece constantes como pi y e?', 'math', ['random', 'os', 'sys'], 'math.pi y math.e son constantes matemáticas de la librería estándar.'),
  ],
  '1.5.2': [
    ps('Operadores', 4, "print(2 ** 3 ** 2)", '512', ['64', '512.0', '18'], 'El operador ** es asociativo por la derecha: 3**2=9, luego 2**9=512.'),
    ps('Operadores', 4, "print(7 // 2 - 3 % 4)", '0', ['1', '-1', '4'], '7//2=3 y 3%4=3 → 3 - 3 = 0.'),
    ps('Operadores', 4, "print(5 & 3)", '1', ['7', '8', '2'], 'El AND a nivel de bits de 101 y 011 es 001 = 1.'),
  ],
  '1.6': [
    ps('Expresiones', 4, "print(0 or 5 and 3)", '3', ['0', '5', 'True'], '"and" tiene mayor precedencia: 5 and 3 → 3; luego 0 or 3 → 3.'),
    ps('Expresiones', 4, "print(True + True + False)", '2', ['True', '1', 'TrueTrueFalse'], 'Los booleanos valen 1 y 0 en aritmética: 1+1+0 = 2.'),
    mc('Expresiones', 4, 'Dada "def f(): print(1)", ¿por qué "False and f()" no imprime nada?', 'Por cortocircuito: si el primer operando es False, no se evalúa el segundo.', ['Porque f() está mal definida.', 'Porque and siempre evalúa todo.', 'Porque print no funciona dentro de and.'], 'El cortocircuito de "and" detiene la evaluación al encontrar un valor falso.'),
  ],
  '1.7': [
    mc('Razonamiento', 4, 'Si "todos los P son Q" y "algún Q es R", ¿qué se concluye necesariamente sobre P y R?', 'Nada necesariamente: no se puede concluir que algún P sea R.', ['Todos los P son R.', 'Ningún P es R.', 'Algún P es R con certeza.'], 'La conclusión no se sigue lógicamente; relacionar P y R por el Q intermedio es una falacia.'),
    ps('Razonamiento', 4, "x = 5\ny = x\nx = x + 1\nprint(x, y)", '6 5', ['6 6', '5 5', '5 6'], 'y guarda el valor 5; reasignar x no cambia y (enteros inmutables).'),
    mc('Razonamiento', 4, 'La negación de "todos los números son pares" es:', 'Existe al menos un número que no es par.', ['Ningún número es par.', 'Todos los números son impares.', 'Todos los números son pares.'], 'La negación de un "para todo" es un "existe" que lo contradice.'),
  ],
  '1.8': [
    mc('Diagramas de flujo', 4, 'Un rombo en un diagrama de flujo con DOS salidas etiquetadas representa:', 'Una decisión (condición) que bifurca el flujo.', ['Un proceso de cálculo.', 'El inicio del programa.', 'Una operación de entrada/salida.'], 'El rombo modela una condición; sus salidas (V/F) dirigen el flujo.'),
    mc('Diagramas de flujo', 4, 'Un diagrama de flujo con un ciclo que nunca alcanza su condición de salida evidencia un:', 'Bucle infinito (viola la finitud).', ['Algoritmo óptimo.', 'Caso base correcto.', 'Diagrama estructurado.'], 'Sin condición de salida alcanzable, el algoritmo no termina.'),
    ol('Diagramas de flujo', 4, 'Ordena el pseudocódigo que valida una edad y decide si es mayor de edad:', ['Inicio', 'Leer edad', 'Si edad >= 18: escribir "Mayor de edad"', 'Sino: escribir "Menor de edad"', 'Fin'], 'Se lee el dato, se evalúa la condición y se elige una de las dos ramas antes de terminar.'),
  ],
  '1.9': [
    mc('Metodologías', 4, 'El diseño "top-down" (descendente) consiste en:', 'Descomponer el problema general en subproblemas más pequeños.', ['Empezar por los detalles de bajo nivel y unirlos.', 'Escribir todo el código en una sola función.', 'Programar sin analizar el problema.'], 'Top-down parte del problema global y lo refina en módulos manejables.'),
    mc('Metodologías', 4, 'En el paradigma de programación ESTRUCTURADA se prescinde de:', 'La instrucción GOTO (saltos incondicionales).', ['Las funciones.', 'Los bucles.', 'Las condiciones.'], 'La programación estructurada evita el GOTO usando secuencia, selección e iteración.'),
    mc('Metodologías', 4, 'La reutilización mediante bloques independientes con una única responsabilidad es propia del enfoque:', 'Modular', ['Monolítico', 'Espagueti', 'Aleatorio'], 'El enfoque modular favorece componentes cohesivos y reutilizables.'),
  ],
  '1.10': [
    ol('Estructura del algoritmo', 4, 'Ordena la estructura general de un algoritmo bien formado:', ['Cabecera (nombre)', 'Declaración de datos', 'Entrada de datos', 'Proceso', 'Salida de resultados'], 'Un algoritmo se organiza en cabecera, declaraciones y el cuerpo Entrada→Proceso→Salida.'),
    mc('Estructura del algoritmo', 4, 'Separar claramente ENTRADA, PROCESO y SALIDA en un algoritmo ayuda sobre todo a:', 'Comprender, depurar y mantener la solución.', ['Que el programa ocupe más memoria.', 'Ocultar errores.', 'Eliminar la necesidad de pruebas.'], 'La separación de responsabilidades clarifica el algoritmo y facilita su mantenimiento.'),
    mc('Estructura del algoritmo', 4, 'Las tres estructuras de control suficientes para expresar cualquier algoritmo son:', 'Secuencia, selección e iteración.', ['GOTO, salto y retorno.', 'Suma, resta y multiplicación.', 'Entrada, salida y comentario.'], 'El teorema de la programación estructurada garantiza que esas tres bastan.'),
  ],
  '1.11': [
    mc('Diseño de algoritmos', 4, 'Al diseñar un algoritmo, elegir una solución con menos operaciones para entradas grandes mejora su:', 'Eficiencia (complejidad temporal).', ['Color de sintaxis.', 'Número de comentarios.', 'Nombre del archivo.'], 'Un buen diseño reduce el costo computacional para datos grandes.'),
    mc('Diseño de algoritmos', 4, 'El refinamiento por pasos sucesivos (stepwise refinement) consiste en:', 'Detallar progresivamente cada paso general hasta el nivel ejecutable.', ['Escribir el algoritmo de una vez sin revisar.', 'Copiar un algoritmo existente sin cambios.', 'Eliminar los pasos difíciles.'], 'Se parte de una descripción abstracta y se refina cada paso gradualmente.'),
    mc('Diseño de algoritmos', 4, 'Antes de codificar, probar el algoritmo "a mano" con datos de ejemplo se llama:', 'Prueba de escritorio (traza).', ['Compilación.', 'Despliegue.', 'Documentación.'], 'La prueba de escritorio simula la ejecución paso a paso para validar la lógica.'),
  ],
  '2.1': [
    mc('Estructuras secuenciales', 4, 'El teorema de Böhm-Jacopini afirma que todo algoritmo puede escribirse usando solo:', 'Secuencia, selección e iteración.', ['Recursividad y GOTO.', 'Únicamente secuencia.', 'Solo funciones anónimas.'], 'Es el fundamento teórico de la programación estructurada.'),
    mc('Estructuras secuenciales', 4, 'Una función con "una sola entrada y una sola salida" facilita:', 'El razonamiento y la verificación del flujo de control.', ['El uso obligatorio de GOTO.', 'Duplicar el código.', 'Ocultar los parámetros.'], 'El principio de entrada/salida única es central en la programación estructurada.'),
    mc('Estructuras secuenciales', 4, 'El código difícil de seguir por saltos arbitrarios del flujo se apoda coloquialmente código:', 'Espagueti', ['Modular', 'Estructurado', 'Refactorizado'], 'El "código espagueti" enreda el flujo; la programación estructurada lo evita.'),
  ],
  '2.2': [
    ps('Estructuras secuenciales', 4, "a = 2\nb = 3\na, b = b, a\nprint(a, b)", '3 2', ['2 3', '3 3', '2 2'], 'La asignación múltiple intercambia los valores en una sola instrucción.'),
    ps('Estructuras secuenciales', 4, "x = 10\nx += 5\nx //= 3\nprint(x)", '5', ['3', '15', '4'], 'x=10 → 15 → 15//3 = 5.'),
    ol('Estructuras secuenciales', 4, 'Ordena las instrucciones para intercambiar dos variables usando una auxiliar:', ['aux = a', 'a = b', 'b = aux'], 'Se guarda a en aux, se copia b en a y finalmente aux (el a original) en b.'),
  ],
  '3.1': [
    mc('Metodologías', 4, 'Una función con ALTA cohesión se caracteriza por:', 'Realizar una única tarea bien definida.', ['Depender de muchas variables globales.', 'Hacer muchas cosas no relacionadas.', 'No recibir parámetros nunca.'], 'La alta cohesión (una responsabilidad) es un objetivo del diseño modular.'),
    mc('Metodologías', 4, 'Un BAJO acoplamiento entre módulos significa que:', 'Los módulos dependen poco unos de otros.', ['Comparten muchas variables globales.', 'No pueden reutilizarse.', 'Están todos en una sola función.'], 'Bajo acoplamiento facilita cambiar un módulo sin afectar a los demás.'),
    ps('Metodologías', 4, "x = 10\ndef f():\n    x = 5\n    return x\nprint(f(), x)", '5 10', ['5 5', '10 10', '10 5'], 'La x dentro de f es LOCAL; no modifica la x global.'),
  ],
  '5.1': [
    mc('Interfaz gráfica', 4, 'En tkinter, el método que gestiona el bucle de eventos de la ventana es:', 'mainloop()', ['start()', 'run()', 'loop_forever()'], 'window.mainloop() mantiene la interfaz activa esperando eventos.'),
    mc('Interfaz gráfica', 4, '¿Cuál de estos gestores de geometría de tkinter posiciona widgets por fila y columna?', 'grid()', ['pack()', 'place() absoluto', 'flow()'], 'grid() organiza los widgets en una cuadrícula de filas y columnas.'),
    mc('Interfaz gráfica', 4, 'Para que un Button ejecute una función al pulsarse, se enlaza mediante:', 'El parámetro command=funcion.', ['El parámetro color=', 'El método print()', 'La propiedad text='], 'command recibe la función (callback) que se ejecuta al hacer clic.'),
  ],
};
