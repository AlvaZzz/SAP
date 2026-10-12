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
      { titulo: 'Ejercicios por nivel', texto: 'Aquí están los 5 niveles del curso. Cada uno agrupa ejercicios de un tema (variables, condicionales, bucles, funciones, listas).' },
      { titulo: 'Desbloqueo progresivo', texto: 'Los niveles se desbloquean en orden: al completar el porcentaje requerido de un nivel, se abre el siguiente. Los candados indican niveles aún bloqueados.' },
      { titulo: 'XP y pistas', texto: 'Cada ejercicio correcto suma XP (más si mantienes racha diaria). Puedes pedir pistas a PREXI, pero usarlas descuenta un poco de XP: intenta primero por tu cuenta.' },
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
      { titulo: 'Retos del docente', texto: 'Los retos son ejercicios especiales creados por tus docentes, generalmente de programación completa con un ejemplo de entrada y salida.' },
      { titulo: 'Entrega y revisión', texto: 'Resuelves el reto, lo entregas y tu docente lo revisa: puede aprobarlo (ganas el XP) o pedirte mejoras con comentarios. Recibirás una notificación con su veredicto.' },
      { titulo: 'Fechas límite', texto: 'Algunos retos tienen fecha límite de entrega: revisa la etiqueta de cada tarjeta para no quedarte fuera.' },
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
  {
    clave: 'postest',
    ruta: en('/postest'),
    pasos: [
      { titulo: 'Evaluación final', texto: 'Este es el POSTEST: 20 preguntas similares a las del pretest, para medir cuánto aprendiste. Solo se rinde una vez, así que tómate tu tiempo.' },
      { titulo: 'Autoguardado', texto: 'Cada respuesta se guarda automáticamente. Al finalizar verás tu puntaje y tu AVANCE respecto al pretest en la sección "Progreso".' },
    ],
  },

  // ── Docente ──
  {
    clave: 'docente-dashboard',
    ruta: en('/docente/dashboard'),
    pasos: [
      { titulo: 'Tus paralelos', texto: 'Aquí ves una tarjeta por cada paralelo a tu cargo. Entra a uno para ver cuántos estudiantes hay en nivel Básico, Intermedio y Avanzado.' },
      { titulo: 'Cada número tiene nombres', texto: 'Toca un nivel y se abre la lista de esos estudiantes, con su CI y su RU. Al tocar un estudiante ves su ficha completa.' },
      { titulo: 'Tus herramientas', texto: 'Desde el menú registras estudiantes, haces su seguimiento, armas el contenido y habilitas la evaluación final.', selector: 'nav' },
    ],
  },
  {
    clave: 'docente-ejercicios',
    ruta: en('/docente/ejercicios'),
    pasos: [
      { titulo: 'Banco de ejercicios', texto: 'Crea y edita los ejercicios de práctica y de los bancos pretest/postest. Cada ejercicio tiene tipo, nivel, opciones y respuesta correcta.' },
      { titulo: 'Activar y desactivar', texto: 'Puedes desactivar un ejercicio sin borrarlo: los estudiantes dejan de verlo pero sus datos históricos se conservan (importante para el estudio).' },
    ],
  },
  {
    clave: 'docente-retos',
    ruta: en('/docente/retos'),
    pasos: [
      { titulo: 'Retos para tus estudiantes', texto: 'Crea desafíos de programación con enunciado, código inicial, ejemplo de entrada/salida, XP y fecha límite opcional.' },
      { titulo: 'Publicación', texto: 'Un reto publicado aparece de inmediato a los estudiantes. Puedes despublicarlo en cualquier momento sin perder las entregas.' },
    ],
  },
  {
    clave: 'docente-documentos',
    ruta: en('/docente/documentos'),
    pasos: [
      { titulo: 'Material del curso', texto: 'Sube PDFs (guías, teoría, prácticas) y asócialos a un nivel para que los estudiantes los encuentren en su sección "Documentos".' },
      { titulo: 'Solo PDF', texto: 'Por seguridad el sistema solo acepta archivos PDF de hasta el tamaño configurado. El archivo se valida en el servidor.' },
    ],
  },
  {
    clave: 'docente-registro',
    ruta: en('/docente/estudiantes/registro'),
    pasos: [
      { titulo: 'Registro de estudiantes', texto: 'Aquí creas las cuentas de tu curso en cuatro pasos: eliges la materia y el paralelo, subes tu lista, revisas las columnas y confirmas la vista previa.' },
      { titulo: 'Sirve la lista que ya tienes', texto: 'No hace falta copiar nada a una plantilla: sube tu Excel tal como está. PREXI reconoce qué columna es el nombre, el CI, el RU y el paralelo.' },
      { titulo: 'Nada se guarda sin tu revisión', texto: 'Antes de registrar verás a todos los estudiantes en una tabla. Ahí corriges datos, mueves estudiantes de paralelo y ves marcados en rojo los problemas.' },
      { titulo: 'Cómo entran', texto: 'Cada estudiante usa su RU como usuario y su CI como contraseña inicial. En su primer ingreso el sistema le pide crear la suya.' },
    ],
  },
  {
    clave: 'docente-estudiantes',
    // Coincidencia exacta: el registro (subruta) tiene su propio tutorial.
    ruta: (p: string) => p === '/docente/estudiantes' || /^\/docente\/estudiantes\/\d+$/.test(p),
    pasos: [
      { titulo: 'Seguimiento de estudiantes', texto: 'Los estudiantes de tus paralelos con su nivel actual y su promedio sobre 100. Búscalos por nombre, CI o RU, y haz clic en uno para ver su ficha.' },
      { titulo: 'Quién necesita atención', texto: 'Los botones de arriba filtran la lista: quiénes necesitan atención, quiénes aún no ingresaron y quiénes están cerca del 80.' },
      { titulo: 'Notas privadas', texto: 'Puedes escribir una nota de seguimiento por estudiante: solo tú la ves.' },
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
      { titulo: 'Panel de administración', texto: 'Estado global del sistema: usuarios por rol, actividad reciente y salud de la configuración.' },
      { titulo: 'Máximo privilegio', texto: 'Como admin puedes ver todas las áreas y gestionar usuarios, configuración y auditoría.', selector: 'nav' },
    ],
  },
  {
    clave: 'admin-usuarios',
    ruta: en('/admin/usuarios'),
    pasos: [
      { titulo: 'Gestión de usuarios', texto: 'Crea usuarios de cualquier rol, edítalos, resetea contraseñas y activa/desactiva cuentas.' },
      { titulo: 'Desactivar, no borrar', texto: 'Las cuentas se desactivan (soft-disable) en lugar de borrarse: así se conservan los datos del estudio.' },
    ],
  },
  {
    clave: 'admin-sistema',
    ruta: en('/admin/sistema'),
    pasos: [
      { titulo: 'Configuración central', texto: 'Única fuente de parámetros del sistema: XP por ejercicio, umbral de desbloqueo, pistas y límites de PREXI, nivel desde el que se habilita el postest…' },
      { titulo: 'Efecto inmediato', texto: 'Los cambios aplican al instante para todos los usuarios: la IA y el módulo del estudiante leen esta configuración en cada operación.' },
    ],
  },
  {
    clave: 'admin-auditoria',
    ruta: en('/admin/auditoria'),
    pasos: [
      { titulo: 'Auditoría', texto: 'Registro inmutable de acciones sensibles: quién creó/editó usuarios, cambió roles o configuración, y cuándo.' },
    ],
  },
];

/** Primer tour que corresponde a la ruta actual. */
export function tourParaRuta(pathname: string): Tour | null {
  return TOURS.find((t) => t.ruta(pathname)) ?? null;
}
