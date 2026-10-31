/**
 * Tours de onboarding por módulo. Cada tour tiene una clave única (persistida
 * en el backend por usuario), una regla de coincidencia de ruta y sus pasos.
 * Un paso puede anclarse a un elemento (selector CSS) o mostrarse centrado.
 */
export interface PasoTour {
  titulo: string;
  texto: string;
  selector?: string; // si falta o no se encuentra, el paso se muestra centrado
}

export interface Tour {
  clave: string;
  ruta: (pathname: string) => boolean;
  pasos: PasoTour[];
}

const en = (prefijo: string) => (p: string) => p === prefijo || p.startsWith(prefijo + '/');

export const TOURS: Tour[] = [
  // ── Bienvenida general (primer login, antes del pretest) ──
  {
    clave: 'bienvenida',
    ruta: en('/pretest'),
    pasos: [
      { titulo: 'Bienvenido a PREXI', texto: 'PREXI es tu plataforma para aprender programación en Python con ayuda de tu tutor PREXI, que funciona con inteligencia artificial. Este breve recorrido te explica cómo funciona todo.' },
      { titulo: '1º · Evaluación diagnóstica', texto: 'Empezarás con un PRETEST de 20 preguntas. No es una nota: sirve para conocer tu punto de partida y ubicarte en el nivel adecuado. Responde con calma; tus respuestas se guardan automáticamente.' },
      { titulo: '2º · Aprende resolviendo', texto: 'Después practicarás con ejercicios organizados en 5 niveles. Cada acierto te da XP, y al completar un nivel se desbloquea el siguiente. Si te atascas, tu tutor PREXI te dará pistas.' },
      { titulo: '3º · Demuestra tu avance', texto: 'Cuando completes suficientes niveles se habilitará el POSTEST (evaluación final). Comparando ambos resultados verás cuánto mejoraste en la sección "Progreso".' },
      { titulo: '¡Listo para empezar!', texto: 'Ahora rinde tu pretest. Lee cada pregunta, elige una opción y usa los botones para avanzar. Al terminar pulsa "Finalizar" para ver tu resultado. ¡Éxitos!' },
    ],
  },

  // ── Estudiante ──
  {
    clave: 'dashboard',
    ruta: en('/dashboard'),
    pasos: [
      { titulo: 'Tu panel principal', texto: 'Este es tu dashboard: resume tu nivel actual, XP acumulado, racha de días y tu avance general del curso de un vistazo.' },
      { titulo: 'Menú de navegación', texto: 'Desde este menú accedes a todos los módulos: ejercicios, práctica, documentos, retos, tu progreso, el ranking y tu perfil.', selector: 'nav' },
      { titulo: 'Continúa donde quedaste', texto: 'El dashboard te sugiere el siguiente paso recomendado (ejercicio o nivel). Entra a "Ejercicios" cuando quieras seguir avanzando.' },
    ],
  },
  {
    clave: 'ejercicios',
    ruta: en('/ejercicios'),
    pasos: [
      { titulo: 'Tu camino', texto: 'Las unidades del curso van en orden, cada una con su color. El botón de arriba te lleva directo a lo que toca hacer ahora.' },
      { titulo: 'Temas y niveles', texto: 'Dentro de una unidad, cada tema tiene tres niveles: Básico, Intermedio y Avanzado. Resuelve los ejercicios de tu nivel y rinde la prueba de nivel: con 80 sobre 100 subes al siguiente.' },
      { titulo: 'El examen de la unidad', texto: 'Cuando completes todos los temas en nivel Intermedio o más, se habilita el examen. Al aprobarlo se abre la siguiente unidad.' },
      { titulo: 'XP y pistas', texto: 'Cada ejercicio correcto suma XP (más si mantienes tu racha). Puedes pedir pistas a PREXI, pero restan un poco de XP: intenta primero por tu cuenta.' },
    ],
  },
  {
    clave: 'practica',
    ruta: en('/practica'),
    pasos: [
      { titulo: 'Zona de práctica libre', texto: 'Un editor de Python real donde puedes escribir y EJECUTAR código libremente, sin calificaciones. Ideal para experimentar lo aprendido.' },
      { titulo: 'PREXI a tu lado', texto: 'El asistente PREXI puede explicarte errores, sugerir mejoras o responder dudas sobre tu código. Pregúntale en lenguaje natural.' },
      { titulo: 'Tu código se guarda', texto: 'Lo que escribas queda guardado en tu cuenta: puedes cerrar sesión y retomarlo después.' },
    ],
  },
  {
    clave: 'documentos',
    ruta: en('/documentos'),
    pasos: [
      { titulo: 'Material del curso', texto: 'Aquí encuentras los PDFs y guías que suben tus docentes, organizados por nivel.' },
      { titulo: 'Descarga y estudia', texto: 'Puedes ver o descargar cada documento. Revisa el material del nivel en el que estás antes de rendir sus ejercicios.' },
    ],
  },
  {
    clave: 'retos',
    ruta: en('/retos'),
    pasos: [
      { titulo: 'Dos tipos de reto', texto: 'En «Encuentra el bug» recibes un programa con un error y lo corriges: sabes al instante si lo lograste. En «Escribe tu código» programas la solución y tu docente la revisa.' },
      { titulo: 'Cómo vas', texto: 'Los recuadros de arriba cuentan cuántos te faltan, cuántos tienes que corregir, cuántos están en revisión y cuántos ya aprobaste. Tócalos para ver solo esos.' },
      { titulo: 'Ordenados por tema', texto: 'Abajo están en lista, por unidad y tema. Cada fila lleva su sello (Completado, Pendiente, Incompleto, En revisión o Sin empezar) y los puntos. En cada tema ves los de tu nivel y los del nivel siguiente.' },
    ],
  },
  {
    clave: 'progreso',
    ruta: en('/progreso'),
    pasos: [
      { titulo: '① Progreso de aprendizaje', texto: 'Este banner compara tu PRETEST y tu POSTEST, y muestra tu AVANCE: cuántos puntos mejoraste entre ambas evaluaciones.', selector: '[data-tour="progreso-banner"]' },
      { titulo: '② Dominio por unidad', texto: 'Elige una unidad y verás tu nivel actual y el dominio de cada tema, comparado con el promedio del grupo. Abajo te decimos qué tema conviene reforzar.', selector: '[data-tour="progreso-dominio"]' },
      { titulo: 'Cómo estudias', texto: 'Tus hábitos: constancia (tu racha), autonomía (si cada vez necesitas menos pistas) y eficiencia (cómo evoluciona tu acierto). No son una nota: describen cómo trabajas.', selector: '[data-tour="progreso-habitos"]' },
    ],
  },
  {
    clave: 'ranking',
    ruta: en('/ranking'),
    pasos: [
      { titulo: 'Tabla de posiciones', texto: 'El ranking ordena a los estudiantes por XP total. Resolver ejercicios, mantener tu racha y completar retos te hace subir.' },
      { titulo: 'Racha de días', texto: 'Practicar días consecutivos multiplica el XP que ganas (hasta ×2 con 14 días seguidos). ¡La constancia paga!' },
    ],
  },
  {
    clave: 'perfil',
    ruta: en('/perfil'),
    pasos: [
      { titulo: 'Tu perfil', texto: 'Aquí puedes editar tu nombre y carrera, cambiar tu contraseña y ver tus logros e insignias obtenidas.' },
      { titulo: 'Volver a ver los tutoriales', texto: 'Si algún día quieres repasar estas guías, en esta página está el botón "Volver a ver los tutoriales": reinicia todos los tours del sistema.' },
    ],
  },

  // ── Docente ──
  {
    clave: 'docente-dashboard',
    ruta: en('/docente/dashboard'),
    pasos: [
      { titulo: 'Tus paralelos', texto: 'Aquí ves una tarjeta por cada paralelo a tu cargo. Entra a uno para ver cuántos estudiantes hay en nivel Básico, Intermedio y Avanzado.' },
      { titulo: 'Cada número tiene nombres', texto: 'Toca un nivel y se abre la lista de esos estudiantes, con su CI. Al tocar un estudiante ves su ficha completa.' },
      { titulo: 'Tus herramientas', texto: 'Desde el menú registras estudiantes, haces su seguimiento, armas el contenido y habilitas los exámenes de unidad.', selector: 'nav' },
    ],
  },
  {
    clave: 'docente-unidades',
    ruta: en('/docente/unidades'),
    pasos: [
      { titulo: 'Tus unidades', texto: 'Cada tarjeta es una unidad de tu materia y muestra cuatro pasos. El botón azul te lleva directo al paso que falta.' },
      { titulo: 'Paso 1: unidad y temas', texto: 'Le pones nombre a la unidad y agregas sus temas y subtemas, en el orden en que se enseñan.' },
      { titulo: 'Paso 2: ejercicios', texto: 'Eliges un tema y un nivel, y cargas 10 ejercicios. Puedes escribirlos o pedirle 10 a PREXI: tú apruebas, editas o descartas cada uno.' },
      { titulo: 'Paso 3: flashcards', texto: 'Con un botón, PREXI convierte tus ejercicios en tarjetas de repaso. También puedes escribirlas a mano.' },
      { titulo: 'Paso 4: examen', texto: 'Armas las 10 preguntas del examen, cada una combinando 2 o 3 temas, y publicas los temas que ya están completos.' },
    ],
  },
  {
    clave: 'docente-retos',
    ruta: en('/docente/retos'),
    pasos: [
      { titulo: 'Dos tipos de reto', texto: '«Encuentra el bug»: das un código con un error y el sistema califica solo. «Escribe tu código»: planteas un problema y tú revisas la entrega.' },
      { titulo: 'Elige unidad y tema', texto: 'Arriba eliges la unidad y a la izquierda el tema: cada uno muestra cuántos retos tiene. A la derecha ves solo los retos de ese tema.' },
      { titulo: 'Tres pasos para crear uno', texto: '«Nuevo reto» te pregunta el tipo, el tema y el nivel; luego el contenido; y al final los puntos y si lo publicas.' },
    ],
  },
  {
    clave: 'docente-documentos',
    ruta: en('/docente/documentos'),
    pasos: [
      { titulo: 'Material del curso', texto: 'Aquí están los PDF que compartes con tus estudiantes, ordenados por unidad y tema, igual que ellos los ven.' },
      { titulo: 'Subir es en tres pasos', texto: 'Eliges el PDF (o lo arrastras), indicas de qué tema es y le pones un nombre. Solo se aceptan PDF de hasta 15 MB.' },
      { titulo: 'PREXI también lo usa', texto: 'Si el PDF tiene texto seleccionable, PREXI lo usa como referencia. Los escaneados se pueden leer, pero PREXI no.' },
    ],
  },
  {
    clave: 'docente-registro',
    ruta: en('/docente/estudiantes/registro'),
    pasos: [
      { titulo: 'Registro de estudiantes', texto: 'Aquí creas las cuentas de tu curso en cuatro pasos: eliges la materia y el paralelo, subes tu lista, revisas las columnas y confirmas la vista previa.' },
      { titulo: 'Sirve la lista que ya tienes', texto: 'No hace falta copiar nada a una plantilla: sube tu Excel tal como está. PREXI reconoce qué columna es el nombre, el CI, el RU y el paralelo.' },
      { titulo: 'Nada se guarda sin tu revisión', texto: 'Antes de registrar verás a todos los estudiantes en una tabla. Ahí corriges datos, mueves estudiantes de paralelo y ves marcados en rojo los problemas.' },
      { titulo: 'Cómo entran', texto: 'Cada estudiante entra con su primer nombre y su CI como usuario (por ejemplo, Alvaro_12929098) y su CI como contraseña inicial. En su primer ingreso el sistema le pide crear la suya. El RU es opcional.' },
    ],
  },
  {
    clave: 'docente-estudiantes',
    // Coincidencia exacta: el registro (subruta) tiene su propio tutorial.
    ruta: (p: string) => p === '/docente/estudiantes' || /^\/docente\/estudiantes\/\d+$/.test(p),
    pasos: [
      { titulo: 'Tus estudiantes', texto: 'Una sola lista. Los que necesitan atención aparecen primero, con el motivo escrito debajo de su nombre.' },
      { titulo: 'Los contadores', texto: 'Arriba ves cuántos nunca ingresaron, dejaron de entrar, fallan mucho o están cerca de aprobar. Toca uno para ver solo a esos estudiantes.' },
      { titulo: 'Su ficha', texto: 'Toca a un estudiante para ver su detalle. También puedes descargar la lista para abrirla en Excel.' },
    ],
  },
  {
    clave: 'docente-revisiones',
    ruta: en('/docente/revisiones'),
    pasos: [
      { titulo: 'Revisión de entregas', texto: 'Aquí llegan las entregas de retos pendientes. Revisa el código del estudiante y decide: aprobar (se otorga el XP) o pedir mejoras.' },
      { titulo: 'Feedback', texto: 'Tu comentario le llega al estudiante como notificación. Si pides mejoras, él puede corregir y reenviar.' },
    ],
  },
  {
    clave: 'docente-reportes',
    ruta: en('/docente/reportes'),
    pasos: [
      { titulo: 'Reportes del curso', texto: 'Métricas agregadas: avance por nivel, temas con más errores, uso del tutor PREXI y comparativa pretest/postest del curso.' },
      { titulo: 'Exportación CSV', texto: 'Puedes descargar los datos (incluido el pretest/postest) en CSV para tu análisis externo o para la tesis.' },
    ],
  },

  // ── Investigador ──
  {
    clave: 'investigador-panel',
    ruta: en('/investigador/panel'),
    pasos: [
      { titulo: 'Panel del estudio', texto: 'Vista general del estudio (no experimental, transversal): muestra, paralelos, período de uso y ficha metodológica.' },
      { titulo: 'Solo lectura', texto: 'Tu rol es de observación: puedes ver y exportar datos, pero no modificar usuarios ni contenidos (eso protege la integridad del estudio).' },
    ],
  },
  {
    clave: 'investigador-exportacion',
    ruta: en('/investigador/exportacion'),
    pasos: [
      { titulo: 'Exportación del dataset', texto: 'Descarga el dataset canónico del estudio en CSV, anonimizado y listo para el análisis en Python (Pandas y SciPy).' },
      { titulo: 'Un solo dataset', texto: 'Todos los roles exportan desde esta misma fuente: lo que analices aquí coincide con lo que ven docente y admin.' },
    ],
  },

  // ── Admin ──
  {
    clave: 'admin-dashboard',
    ruta: en('/admin/dashboard'),
    pasos: [
      { titulo: 'Empieza por los avisos', texto: '«Requiere tu atención» junta lo que hay que resolver: paralelos sin docente, solicitudes, cuentas bloqueadas, la IA o el contenido. Cada aviso te lleva a donde se arregla.' },
      { titulo: 'Tu menú', texto: 'Usuarios, Cursos y docentes, Contenido, Configuración y Auditoría. También puedes entrar al área docente o a la de investigación.', selector: 'nav' },
    ],
  },
  {
    clave: 'admin-usuarios',
    ruta: en('/admin/usuarios'),
    pasos: [
      { titulo: 'Todas las cuentas', texto: 'Arriba eliges el rol y ves cuántos hay. Puedes buscar por nombre, correo, CI, RU o el usuario de un estudiante (Alvaro_12929098).' },
      { titulo: 'Crear en dos pasos', texto: '«Nuevo usuario» te pide primero el rol, con lo que puede hacer cada uno, y luego sus datos. La contraseña inicial se genera sola y la persona la cambia al entrar.' },
      { titulo: 'Desactivar, no borrar', texto: 'Una cuenta desactivada no puede entrar, pero conserva todo su historial (importante para el estudio).' },
    ],
  },
  {
    clave: 'admin-cursos',
    ruta: en('/admin/cursos'),
    pasos: [
      { titulo: 'Cada paralelo, su docente', texto: 'El docente acepta las solicitudes de sus estudiantes y sigue su avance. Un paralelo sin docente se marca en ámbar: elige al docente en su lista y se guarda al momento.' },
      { titulo: 'Materias y paralelos', texto: 'Crea la materia de la gestión (por ejemplo, Programación I · 2026-II) y agrégale sus paralelos.' },
    ],
  },
  {
    clave: 'admin-contenido',
    ruta: en('/admin/contenido'),
    pasos: [
      { titulo: 'Lo que tiene cada tema', texto: 'Por unidad, cuántos ejercicios hay en Básico, Intermedio y Avanzado, cuántas preguntas tiene el examen y cuántos retos. En ámbar lo que no llega a 10.' },
    ],
  },
  {
    clave: 'admin-sistema',
    ruta: en('/admin/sistema'),
    pasos: [
      { titulo: 'Configuración por temas', texto: 'A la izquierda eliges la sección: reglas de avance, puntos, la IA, las alertas al docente o la evaluación. Cada opción explica qué cambia.' },
      { titulo: 'Guardar o descartar', texto: 'Los cambios se juntan en una barra abajo: los guardas todos juntos o los descartas. Rigen para todos desde que guardas.' },
    ],
  },
  {
    clave: 'admin-auditoria',
    ruta: en('/admin/auditoria'),
    pasos: [
      { titulo: 'Quién hizo qué', texto: 'Cada acción importante queda registrada por día y no se puede borrar. Busca por persona o detalle, o filtra por tipo de acción y fechas.' },
    ],
  },
];

/** Primer tour que corresponde a la ruta actual. */
export function tourParaRuta(pathname: string): Tour | null {
  return TOURS.find((t) => t.ruta(pathname)) ?? null;
}
