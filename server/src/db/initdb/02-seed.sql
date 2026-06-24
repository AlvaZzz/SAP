-- ════════════════════════════════════════════════════════════
--  PREXI UPEA — Datos de ejemplo (seed)
--
--  Se ejecuta automáticamente tras 01-schema.sql en el primer arranque
--  de Postgres (volumen vacío). También lo reutiliza `npm run db:seed`.
--
--  Contraseña por defecto de todos los usuarios: Prexi123*
--  El hash bcrypt se genera en SQL con pgcrypto: crypt('...', gen_salt('bf', 10)).
-- ════════════════════════════════════════════════════════════

BEGIN;

-- Idempotencia: limpia todo antes de sembrar (útil al re-ejecutar el seed).
TRUNCATE
  logros_usuario, logros, ranking, pretest_postest, progreso_niveles,
  intentos, ia_uso, ia_cache, ejercicios, niveles, configuracion_sistema, usuarios
  RESTART IDENTITY CASCADE;

-- ── Configuración del sistema ───────────────────────────────
INSERT INTO configuracion_sistema (id, xp_por_ejercicio, umbral_nivel, max_pistas_ia, modelo_ia)
VALUES (1, 50, 8, 3, 'gemini-2.0-flash');

-- ── Usuarios (password = 'Prexi123*') ───────────────────────
INSERT INTO usuarios (nombre, email, rol, carrera, password_hash) VALUES
  ('Juan Mamani',   'juan@upea.bo',    'estudiante', 'Ingeniería de Sistemas', crypt('Prexi123*', gen_salt('bf', 10))),
  ('Ana Quispe',    'ana@upea.bo',     'estudiante', 'Ingeniería de Sistemas', crypt('Prexi123*', gen_salt('bf', 10))),
  ('Carlos Mamani', 'carlos@upea.bo',  'estudiante', 'Ingeniería de Sistemas', crypt('Prexi123*', gen_salt('bf', 10))),
  ('Maria Vera',    'maria@upea.bo',   'estudiante', 'Ingeniería de Sistemas', crypt('Prexi123*', gen_salt('bf', 10))),
  ('Docente Demo',  'docente@upea.bo', 'docente',    'Ingeniería de Sistemas', crypt('Prexi123*', gen_salt('bf', 10))),
  ('Admin PREXI',   'admin@upea.bo',   'admin',      'Ingeniería de Sistemas', crypt('Prexi123*', gen_salt('bf', 10)));

-- Los usuarios de ejemplo ya tienen su diagnóstico hecho, así el demo entra
-- directo al dashboard. El flujo de diagnóstico se prueba registrando un
-- estudiante NUEVO desde la pantalla de registro.
UPDATE usuarios SET diagnostico_completado = TRUE;

-- ── Niveles ─────────────────────────────────────────────────
INSERT INTO niveles (numero, titulo, descripcion, umbral) VALUES
  (1, 'Fundamentos de C++',      'Sintaxis básica, tipos de datos y operadores iniciales.', 8),
  (2, 'Control de Flujo',        'Sentencias if, switch, bucles while y for.',             8),
  (3, 'Funciones y Modularidad', 'Definición de funciones, paso de parámetros y recursividad.', 8),
  (4, 'Estructuras de Datos',    'Arrays, vectores y matrices en profundidad.',            8),
  (5, 'Algoritmos Avanzados',    'Complejidad, ordenamiento y estructuras como heaps.',    8);

-- ── Ejercicios (nivel_id resuelto por número de nivel) ──────
INSERT INTO ejercicios (titulo, categoria, nivel_id, dificultad, enunciado, pseudocodigo, opciones, respuesta_correcta, xp, max_pistas)
VALUES
  (
    'Operador módulo en condicional', 'Lógica',
    (SELECT id FROM niveles WHERE numero = 2), 'media',
    '¿Cuál será el valor de la variable resultado al finalizar la ejecución?',
    $pseudo$INICIO
    VAR numero1 = 15;
    VAR numero2 = 4;
    VAR resultado;

    SI (numero1 % numero2 == 3) ENTONCES
        resultado = numero1 + numero2;
    SINO
        resultado = numero1 - numero2;
    FIN SI

    ESCRIBIR resultado;
FIN$pseudo$,
    '[{"id":"A","texto":"11"},{"id":"B","texto":"19"},{"id":"C","texto":"3"},{"id":"D","texto":"Error de Sintaxis"}]'::jsonb,
    'B', 50, 3
  ),
  (
    'Declaración de variable entera', 'Lógica',
    (SELECT id FROM niveles WHERE numero = 1), 'facil',
    '¿Qué tipo de dato almacena la variable edad en: int edad = 20;?',
    $pseudo$int edad = 20;$pseudo$,
    '[{"id":"A","texto":"Texto (string)"},{"id":"B","texto":"Número entero"},{"id":"C","texto":"Número decimal"},{"id":"D","texto":"Booleano"}]'::jsonb,
    'B', 30, 3
  ),
  (
    'Salida de un bucle for', 'Lógica',
    (SELECT id FROM niveles WHERE numero = 2), 'media',
    '¿Cuántas veces se imprime "Hola"?',
    $pseudo$PARA i DESDE 1 HASTA 5 HACER
    ESCRIBIR "Hola";
FIN PARA$pseudo$,
    '[{"id":"A","texto":"4"},{"id":"B","texto":"5"},{"id":"C","texto":"6"},{"id":"D","texto":"Infinitas"}]'::jsonb,
    'B', 40, 3
  ),
  (
    'Resultado de función recursiva', 'Algoritmos',
    (SELECT id FROM niveles WHERE numero = 3), 'dificil',
    '¿Qué devuelve factorial(4)?',
    $pseudo$Algoritmo factorial(n)
    Si n <= 1 Entonces
        Devolver 1
    Sino
        Devolver n * factorial(n - 1)
    Fin Si
Fin Algoritmo$pseudo$,
    '[{"id":"A","texto":"12"},{"id":"B","texto":"24"},{"id":"C","texto":"16"},{"id":"D","texto":"4"}]'::jsonb,
    'B', 60, 3
  ),
  (
    'Acceso a un arreglo', 'Estructuras',
    (SELECT id FROM niveles WHERE numero = 4), 'media',
    'Dado int v[] = {10,20,30,40}; ¿qué imprime ESCRIBIR v[2]?',
    $pseudo$int v[] = {10, 20, 30, 40};
ESCRIBIR v[2];$pseudo$,
    '[{"id":"A","texto":"20"},{"id":"B","texto":"30"},{"id":"C","texto":"40"},{"id":"D","texto":"10"}]'::jsonb,
    'B', 50, 3
  );

-- ── Progreso de niveles de Juan ─────────────────────────────
INSERT INTO progreso_niveles (usuario_id, nivel_id, ejercicios_completados, desbloqueado)
SELECT u.id, n.id, p.completados, p.desbloqueado
FROM (VALUES (1, 8, true), (2, 8, true), (3, 9, true), (4, 0, false), (5, 0, false))
       AS p(numero, completados, desbloqueado)
JOIN niveles n ON n.numero = p.numero
CROSS JOIN (SELECT id FROM usuarios WHERE email = 'juan@upea.bo') u;

-- ── Ranking ─────────────────────────────────────────────────
INSERT INTO ranking (usuario_id, xp_total, racha_dias, ultima_actividad)
SELECT u.id, r.xp, r.racha, CURRENT_DATE
FROM (VALUES
        ('ana@upea.bo',    1240, 7),
        ('carlos@upea.bo', 1105, 4),
        ('maria@upea.bo',   920, 3),
        ('juan@upea.bo',    850, 5))
       AS r(email, xp, racha)
JOIN usuarios u ON u.email = r.email;

-- Filas de ranking en cero para el resto (docente/admin no rankean, pero
-- se inicializan para evitar nulos al registrar actividad).
INSERT INTO ranking (usuario_id, xp_total, racha_dias)
SELECT id, 0, 0 FROM usuarios
WHERE email IN ('docente@upea.bo', 'admin@upea.bo');

-- Calcula posiciones iniciales por XP.
WITH ordenado AS (
  SELECT usuario_id, ROW_NUMBER() OVER (ORDER BY xp_total DESC, usuario_id) AS pos
  FROM ranking
)
UPDATE ranking r SET posicion = o.pos FROM ordenado o WHERE o.usuario_id = r.usuario_id;

-- ── Pretest / Postest de Juan ───────────────────────────────
INSERT INTO pretest_postest (usuario_id, tipo, categoria, puntaje)
SELECT u.id, t.tipo::tipo_test, t.categoria, t.puntaje
FROM (VALUES
        ('pre',  'Variables y Tipos de Datos',     45),
        ('pre',  'Estructuras Condicionales',      60),
        ('pre',  'Bucles e Iteraciones',           30),
        ('pre',  'Funciones y Procedimientos',     65),
        ('post', 'Variables y Tipos de Datos',     85),
        ('post', 'Estructuras Condicionales',      85),
        ('post', 'Bucles e Iteraciones',           80),
        ('post', 'Funciones y Procedimientos',     80))
       AS t(tipo, categoria, puntaje)
CROSS JOIN (SELECT id FROM usuarios WHERE email = 'juan@upea.bo') u;

-- ── Diagnóstico inicial de ejemplo (Juan) ──────────────────
INSERT INTO diagnostico_inicial
  (usuario_id, puntaje, nivel, fortalezas, debilidades, recomendaciones, detalle_respuestas, analisis_ia)
SELECT u.id, 75, 'Intermedio',
  '["Estructuras condicionales", "Variables y tipos de datos"]'::jsonb,
  '["Bucles e iteraciones", "Recursividad"]'::jsonb,
  (SELECT jsonb_agg(jsonb_build_object('nivel_id', n.id, 'titulo', n.titulo, 'prioridad', 'alta'))
     FROM niveles n WHERE n.numero IN (3, 4))::jsonb,
  '[]'::jsonb,
  'Juan demuestra un sólido conocimiento en fundamentos de programación y lógica condicional. Se recomienda reforzar bucles y recursividad para avanzar al siguiente nivel.'
FROM usuarios u WHERE u.email = 'juan@upea.bo';

-- ── Logros / insignias ──────────────────────────────────────
INSERT INTO logros (clave, nombre, condicion, icono) VALUES
  ('primer_acierto',   'Primer Acierto',    'Responde correctamente tu primer ejercicio', '🎯'),
  ('nivel_completado', 'Nivel Conquistado', 'Completa todos los ejercicios de un nivel',  '🏆'),
  ('top_5',            'Top 5',             'Entra al top 5 del ranking',                 '⭐'),
  ('racha_7',          'Racha de Fuego',    'Mantén una racha de 7 días',                 '🔥'),
  ('sin_pistas',       'Mente Brillante',   'Acierta 5 ejercicios sin usar pistas',       '💡');

COMMIT;
