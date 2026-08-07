import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { InvestigadorExportacionService } from '../investigador-exportacion/investigador-exportacion.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ALFA, MIN_INTERPRETABLE } from '../../common/estadistica/contraste';

/** Una entrada del diccionario de variables (codebook). */
export interface VariableCodebook {
  variable: string;
  descripcion: string;
  tipo: 'texto' | 'entero' | 'decimal' | 'categórica' | 'fecha';
  unidad: string;
  rango: string;
  calculo: string;
}

/**
 * PAQUETE DE REPRODUCIBILIDAD (rol investigador, SOLO LECTURA).
 *
 * Lo que convierte una tesis en una tesis seria: que otra persona pueda
 * entender cada variable, saber exactamente sobre qué corte de datos se
 * calculó cada número, y reproducirlo aunque la base haya seguido creciendo.
 */
@Injectable()
export class InvestigadorReproducibilidadService {
  constructor(
    private readonly exportacion: InvestigadorExportacionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * DICCIONARIO DE VARIABLES (codebook) del dataset exportado.
   *
   * Va directo a los anexos de la tesis. Cada columna con qué es, en qué
   * unidad, qué valores puede tomar y cómo se calcula — que es justo lo que
   * evita decenas de preguntas en la defensa.
   */
  codebook(): VariableCodebook[] {
    return [
      { variable: 'id_anonimo', descripcion: 'Identificador anónimo del estudiante. Sustituye a nombre, correo y cédula.', tipo: 'texto', unidad: '—', rango: 'E-001 … E-nnn', calculo: 'Correlativo asignado por orden de id interno. No permite reidentificar.' },
      { variable: 'grupo', descripcion: 'Grupo experimental al que pertenece.', tipo: 'categórica', unidad: '—', rango: 'control | experimental', calculo: 'Asignado por el administrador del estudio.' },
      { variable: 'institucion', descripcion: 'Institución del estudiante.', tipo: 'categórica', unidad: '—', rango: 'texto libre', calculo: 'Declarada en el registro.' },
      { variable: 'paralelo', descripcion: 'Paralelo o curso.', tipo: 'categórica', unidad: '—', rango: 'texto libre', calculo: 'Declarado en el registro.' },
      { variable: 'nivel_inicial', descripcion: 'Nivel adaptativo permanente asignado tras el diagnóstico.', tipo: 'categórica', unidad: '—', rango: 'basico | intermedio | avanzado', calculo: 'Derivado de θ inicial: θ<−0.5 básico, −0.5≤θ≤0.5 intermedio, θ>0.5 avanzado.' },
      { variable: 'theta_inicial', descripcion: 'Habilidad estimada por IRT (Rasch) en el pretest.', tipo: 'decimal', unidad: 'logits', rango: '−4 a +4', calculo: 'Máxima verosimilitud (Newton-Raphson) sobre el patrón de respuestas del pretest y la dificultad b de cada ítem.' },
      { variable: 'theta_final', descripcion: 'Habilidad estimada por IRT en el postest.', tipo: 'decimal', unidad: 'logits', rango: '−4 a +4', calculo: 'Igual que theta_inicial, sobre el postest.' },
      { variable: 'delta_theta', descripcion: 'Ganancia de habilidad en la escala IRT.', tipo: 'decimal', unidad: 'logits', rango: '−8 a +8', calculo: 'theta_final − theta_inicial. Null si falta alguna de las dos.' },
      { variable: 'pretest_total', descripcion: 'Puntaje del pretest.', tipo: 'entero', unidad: 'puntos (0–100)', rango: '0 a 100', calculo: 'Porcentaje de aciertos del examen diagnóstico.' },
      { variable: 'postest_total', descripcion: 'Puntaje del postest.', tipo: 'entero', unidad: 'puntos (0–100)', rango: '0 a 100', calculo: 'Porcentaje de aciertos del examen final.' },
      { variable: 'ganancia', descripcion: 'Ganancia bruta de aprendizaje.', tipo: 'entero', unidad: 'puntos', rango: '−100 a 100', calculo: 'postest_total − pretest_total. Null si falta alguno.' },
      { variable: 'pretest_<categoría>', descripcion: 'Puntaje del pretest en una de las 5 áreas temáticas.', tipo: 'entero', unidad: '% de aciertos', rango: '0 a 100', calculo: 'Aciertos/total de los ítems de esa categoría. Null si el examen no incluyó ítems del área.' },
      { variable: 'postest_<categoría>', descripcion: 'Ídem para el postest.', tipo: 'entero', unidad: '% de aciertos', rango: '0 a 100', calculo: 'Ídem sobre el postest.' },
      { variable: 'tiempo_pretest', descripcion: 'Tiempo empleado en el pretest.', tipo: 'entero', unidad: 'segundos', rango: '≥ 0', calculo: 'Cronometrado por el sistema durante el examen.' },
      { variable: 'tiempo_postest', descripcion: 'Tiempo empleado en el postest.', tipo: 'entero', unidad: 'segundos', rango: '≥ 0', calculo: 'Ídem.' },
      { variable: 'ejercicios_resueltos', descripcion: 'Ejercicios DISTINTOS resueltos correctamente.', tipo: 'entero', unidad: 'ejercicios', rango: '≥ 0', calculo: 'Cardinalidad del conjunto de ejercicios con al menos un intento correcto (no cuenta repeticiones).' },
      { variable: 'tiempo_promedio_ejercicio', descripcion: 'Tiempo medio por ejercicio resuelto.', tipo: 'entero', unidad: 'segundos', rango: '≥ 0', calculo: 'Media del tiempo de los intentos CORRECTOS con tiempo > 0.' },
      { variable: 'xp_total', descripcion: 'Experiencia acumulada (gamificación).', tipo: 'entero', unidad: 'XP', rango: '≥ 0', calculo: 'Suma de XP otorgado por el motor de reglas del backend.' },
      { variable: 'racha', descripcion: 'Racha de días consecutivos de actividad.', tipo: 'entero', unidad: 'días', rango: '≥ 0', calculo: 'Registrada por el módulo de ranking.' },
      { variable: 'consultas_ia', descripcion: 'Consultas al tutor ALVARO.', tipo: 'entero', unidad: 'consultas', rango: '≥ 0', calculo: 'Total de registros de ConsultaIa del estudiante.' },
      { variable: 'pistas_usadas', descripcion: 'Consultas del tipo "pista".', tipo: 'entero', unidad: 'pistas', rango: '≥ 0', calculo: 'Subconjunto de consultas_ia con tipo = pista.' },
      { variable: 'retos_entregados', descripcion: 'Retos del docente entregados.', tipo: 'entero', unidad: 'retos', rango: '≥ 0', calculo: 'RetoUsuario con estado distinto de sin_entregar.' },
      { variable: 'intentos_totales', descripcion: 'Intentos de ejercicio registrados.', tipo: 'entero', unidad: 'intentos', rango: '≥ 0', calculo: 'Todos los intentos, correctos e incorrectos. Es la medida de DOSIS de intervención.' },
      { variable: 'tasa_acierto', descripcion: 'Porcentaje de intentos correctos.', tipo: 'entero', unidad: '%', rango: '0 a 100', calculo: 'intentos correctos / intentos_totales × 100.' },
      { variable: 'pistas_por_ejercicio', descripcion: 'Pistas promedio por intento.', tipo: 'decimal', unidad: 'pistas/intento', rango: '≥ 0', calculo: 'Media de pistasUsadas sobre todos los intentos.' },
      { variable: 'sin_pistas_pct', descripcion: 'Porcentaje de intentos resueltos sin pistas.', tipo: 'entero', unidad: '%', rango: '0 a 100', calculo: 'Intentos con 0 pistas / intentos_totales × 100.' },
      { variable: 'autonomia_delta', descripcion: 'Cambio en el uso de pistas entre la segunda y la primera mitad del historial.', tipo: 'decimal', unidad: 'pistas/intento', rango: 'negativo = más autonomía', calculo: 'Media(2ª mitad) − Media(1ª mitad) de pistasUsadas. Null si hay pocos intentos.' },
      { variable: 'tasa_acierto_delta', descripcion: 'Cambio en la tasa de acierto entre mitades del historial.', tipo: 'entero', unidad: 'puntos %', rango: '−100 a 100', calculo: 'Ídem sobre acierto (0/100). Null si hay pocos intentos.' },
      { variable: 'tiempo_medio_delta', descripcion: 'Cambio en el tiempo medio por intento entre mitades.', tipo: 'entero', unidad: 'segundos', rango: 'negativo = más rápido', calculo: 'Ídem sobre tiempoSeg de intentos con tiempo > 0.' },
      { variable: 'subidas_nivel_intentos', descripcion: 'Mini-diagnósticos de subida de nivel rendidos.', tipo: 'entero', unidad: 'intentos', rango: '≥ 0', calculo: 'Registros de IntentoSubidaNivel.' },
      { variable: 'subidas_nivel_aprobadas', descripcion: 'Subidas de nivel superadas.', tipo: 'entero', unidad: 'intentos', rango: '≥ 0', calculo: 'Subconjunto aprobado de lo anterior.' },
    ];
  }

  /** CSV del codebook, para anexar directamente a la tesis. */
  codebookCsv(): string {
    const cols = ['variable', 'descripcion', 'tipo', 'unidad', 'rango', 'calculo'];
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const filas = this.codebook().map((v) =>
      [v.variable, v.descripcion, v.tipo, v.unidad, v.rango, v.calculo].map(esc).join(','),
    );
    return [cols.join(','), ...filas].join('\n');
  }

  /**
   * FICHA METODOLÓGICA del estudio. Diseño, población, instrumentos, variables
   * e hipótesis. Se muestra y se exporta para que conste en el documento sin
   * tener que redactarla aparte (y sin que se desincronice de lo que el sistema
   * realmente hace).
   */
  async fichaMetodologica() {
    const dataset = await this.exportacion.construirDataset();
    const instituciones = [...new Set(dataset.map((f) => f.institucion))];
    const paralelos = [...new Set(dataset.map((f) => f.paralelo))];

    return {
      diseno: {
        tipo: 'Cuasi-experimental con grupo de control no equivalente',
        esquema: 'Pretest – intervención – postest, con grupo control y grupo experimental',
        por_que_cuasi:
          'Los grupos son cursos ya constituidos (paralelos), no se asignaron los estudiantes al azar. ' +
          'Por eso es cuasi-experimental y no experimental puro, y por eso la equivalencia inicial debe ' +
          'demostrarse estadísticamente en vez de presumirse de la aleatorización.',
      },
      poblacion: {
        descripcion: 'Estudiantes de Programación I (PRG-111) que usan PREXI.',
        instituciones,
        paralelos,
        n_registrados: dataset.length,
        n_control: dataset.filter((f) => f.grupo === 'control').length,
        n_experimental: dataset.filter((f) => f.grupo === 'experimental').length,
        n_casos_completos: dataset.filter((f) => f.pretest_total !== null && f.postest_total !== null).length,
      },
      muestreo: {
        tipo: 'No probabilístico por conveniencia (grupos intactos)',
        implicacion:
          'Limita la generalización de los resultados más allá de la población estudiada. Es una ' +
          'limitación a declarar, no un defecto ocultable.',
      },
      instrumentos: [
        {
          nombre: 'Pretest / Postest de Programación I',
          tipo: 'Prueba objetiva de ítems dicotómicos (acierto/error)',
          areas: 'Variables, condicionales, bucles, funciones y estructuras de datos',
          fiabilidad: 'Se reporta KR-20 calculado sobre las respuestas reales (ver pantalla de Fiabilidad).',
          calibracion:
            'Cada ítem tiene una dificultad b en la escala logit del modelo de Rasch, estimada ' +
            'inicialmente a partir del nivel y las estrellas asignadas por el docente.',
        },
        {
          nombre: 'Registro automático de actividad',
          tipo: 'Bitácora del sistema',
          areas: 'Intentos, tiempos, pistas, consultas al tutor, retos y XP',
          fiabilidad: 'Registro censal, sin autoinforme: no depende de la memoria ni de la sinceridad del participante.',
          calibracion: '—',
        },
      ],
      variables: {
        independiente: 'Uso de PREXI (plataforma adaptativa con tutor IA y gamificación) — grupo experimental vs. control',
        dependientes: [
          'Puntaje del postest (0–100)',
          'Ganancia bruta (postest − pretest)',
          'Ganancia normalizada de Hake ⟨g⟩',
          'Habilidad estimada por IRT (θ) y su ganancia Δθ',
        ],
        intervinientes: 'Nivel inicial, institución, paralelo, dosis de uso del sistema',
      },
      hipotesis: {
        nula:
          'H₀: no existe diferencia estadísticamente significativa en el aprendizaje de Programación I ' +
          'entre los estudiantes que usan PREXI y los que no.',
        alterna:
          'H₁: los estudiantes que usan PREXI obtienen un aprendizaje significativamente mayor que ' +
          'quienes no lo usan.',
        nivel_significancia: ALFA,
        criterio_decision: `Se rechaza H₀ si p < ${ALFA}. Todo contraste se acompaña del tamaño del efecto y del intervalo de confianza del 95 %.`,
        potencia:
          `Los contrastes solo se consideran interpretables con al menos ${MIN_INTERPRETABLE} casos por grupo. ` +
          'Por debajo de ese umbral, un resultado no significativo no distingue entre "no hay efecto" y ' +
          '"no hay datos para detectarlo".',
      },
      tratamiento_datos: {
        faltantes: 'Análisis de casos completos. No se imputan valores.',
        anonimizacion: 'El dataset no contiene nombre, correo ni cédula. Cada estudiante aparece como id_anonimo.',
        supuestos: 'Normalidad por Shapiro-Wilk y homogeneidad de varianzas por Levene, verificados antes de cada prueba paramétrica.',
      },
    };
  }

  /**
   * METADATOS DEL CORTE + HASH del contenido.
   *
   * Permite que un número reportado en la tesis se pueda reproducir después,
   * aunque la base haya seguido creciendo: si el hash coincide, el dataset es
   * exactamente el mismo que se usó entonces.
   */
  async metadatosCorte() {
    const csv = await this.exportacion.exportCsv();
    const dataset = await this.exportacion.construirDataset();
    const hash = createHash('sha256').update(csv, 'utf8').digest('hex');

    const ultimaActividad = await this.prisma.intento.findFirst({
      orderBy: { fecha: 'desc' }, select: { fecha: true },
    });
    const ultimaEvaluacion = await this.prisma.evaluacion.findFirst({
      orderBy: { fecha: 'desc' }, select: { fecha: true },
    });

    return {
      fecha_corte: new Date().toISOString(),
      n_participantes: dataset.length,
      n_control: dataset.filter((f) => f.grupo === 'control').length,
      n_experimental: dataset.filter((f) => f.grupo === 'experimental').length,
      n_casos_completos: dataset.filter((f) => f.pretest_total !== null && f.postest_total !== null).length,
      ultima_actividad_registrada: ultimaActividad?.fecha ?? null,
      ultima_evaluacion_registrada: ultimaEvaluacion?.fecha ?? null,
      hash_sha256: hash,
      bytes_csv: Buffer.byteLength(csv, 'utf8'),
      como_verificar:
        'El hash es SHA-256 del CSV exportado. Para comprobar que un análisis usó exactamente este ' +
        'corte, vuelva a exportar el dataset y compare el hash: si coincide, los datos son idénticos.',
    };
  }

  /**
   * ÉTICA Y CONSENTIMIENTO.
   *
   * Declara con exactitud qué se puede verificar y qué no. La casilla de
   * aceptación de términos existía en el formulario de registro desde el
   * principio, pero hasta la incorporación del campo `consentimientoEn` no se
   * persistía: para las cuentas anteriores no hay registro verificable, y eso
   * se reporta como tal en vez de darlo por supuesto.
   */
  async etica() {
    const [total, conRegistro, masAntiguo] = await Promise.all([
      this.prisma.usuario.count({ where: { rol: 'estudiante' } }),
      this.prisma.usuario.count({ where: { rol: 'estudiante', consentimientoEn: { not: null } } }),
      this.prisma.usuario.findFirst({
        where: { rol: 'estudiante', consentimientoEn: { not: null } },
        orderBy: { consentimientoEn: 'asc' },
        select: { consentimientoEn: true },
      }),
    ]);

    const sinRegistro = total - conRegistro;

    return {
      consentimiento: {
        total_estudiantes: total,
        con_registro_verificable: conRegistro,
        sin_registro_verificable: sinRegistro,
        primer_registro: masAntiguo?.consentimientoEn ?? null,
        limitacion: sinRegistro > 0
          ? `${sinRegistro} estudiantes se registraron antes de que el sistema empezara a persistir la ` +
            'aceptación de términos. Aceptaron la casilla en el formulario (era obligatoria para crear la ' +
            'cuenta), pero NO existe registro verificable en la base con fecha. Se declara como limitación ' +
            'en lugar de presentarse como dato confirmado.'
          : null,
        nota:
          'La casilla de aceptación es obligatoria para completar el registro: no es posible crear una ' +
          'cuenta sin marcarla.',
      },
      anonimizacion: {
        confirmado: true,
        identificador_usado: 'id_anonimo (formato E-001, correlativo por orden de registro)',
        campos_excluidos: ['nombre', 'email', 'cédula', 'contraseña', 'fecha de nacimiento'],
        alcance:
          'Ninguna vista ni exportación del rol investigador expone datos personales. El id_anonimo no ' +
          'permite reidentificar a un participante desde el dataset por sí solo.',
        advertencia:
          'La correspondencia entre id_anonimo y estudiante es reconstruible por un administrador con ' +
          'acceso a la base (el correlativo sigue el orden de id). El dataset EXPORTADO es anónimo; la ' +
          'base de origen es seudonimizada. Es la distinción honesta.',
      },
    };
  }
}
