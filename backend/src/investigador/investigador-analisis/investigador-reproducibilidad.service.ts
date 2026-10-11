import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { InvestigadorExportacionService } from '../investigador-exportacion/investigador-exportacion.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UMBRAL_SESION_MIN, NOTA_TIEMPO_ESTIMADO } from '../../common/estadistica/uso';

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
      { variable: 'institucion', descripcion: 'Institución del estudiante.', tipo: 'categórica', unidad: '—', rango: 'texto libre', calculo: 'Declarada en el registro.' },
      { variable: 'paralelo', descripcion: 'Paralelo o curso.', tipo: 'categórica', unidad: '—', rango: 'texto libre', calculo: 'Declarado en el registro.' },
      { variable: 'nivel_inicial', descripcion: 'Nivel adaptativo permanente asignado tras el diagnóstico.', tipo: 'categórica', unidad: '—', rango: 'basico | intermedio | avanzado', calculo: 'Derivado de θ inicial: θ<−0.5 básico, −0.5≤θ≤0.5 intermedio, θ>0.5 avanzado.' },
      { variable: 'theta_inicial', descripcion: 'Habilidad estimada por IRT (Rasch) en el diagnóstico inicial.', tipo: 'decimal', unidad: 'logits', rango: '−4 a +4', calculo: 'Máxima verosimilitud (Newton-Raphson) sobre el patrón de respuestas del pretest y la dificultad b de cada ítem.' },
      { variable: 'theta_final', descripcion: 'Habilidad estimada por IRT en la evaluación final del curso.', tipo: 'decimal', unidad: 'logits', rango: '−4 a +4', calculo: 'Igual que theta_inicial, sobre el postest.' },
      { variable: 'pretest_total', descripcion: 'Puntaje del diagnóstico inicial (pretest).', tipo: 'entero', unidad: 'puntos (0–100)', rango: '0 a 100', calculo: 'Porcentaje de aciertos del examen diagnóstico.' },
      { variable: 'postest_total', descripcion: 'Puntaje de la evaluación final del curso (postest).', tipo: 'entero', unidad: 'puntos (0–100)', rango: '0 a 100', calculo: 'Porcentaje de aciertos del examen final.' },
      { variable: 'pretest_<categoría>', descripcion: 'Puntaje del pretest en una de las 5 áreas temáticas.', tipo: 'entero', unidad: '% de aciertos', rango: '0 a 100', calculo: 'Aciertos/total de los ítems de esa categoría. Null si el examen no incluyó ítems del área.' },
      { variable: 'postest_<categoría>', descripcion: 'Ídem para el postest.', tipo: 'entero', unidad: '% de aciertos', rango: '0 a 100', calculo: 'Ídem sobre el postest.' },
      { variable: 'tiempo_pretest', descripcion: 'Tiempo empleado en el pretest.', tipo: 'entero', unidad: 'segundos', rango: '≥ 0', calculo: 'Cronometrado por el sistema durante el examen.' },
      { variable: 'tiempo_postest', descripcion: 'Tiempo empleado en el postest.', tipo: 'entero', unidad: 'segundos', rango: '≥ 0', calculo: 'Ídem.' },
      { variable: 'ejercicios_resueltos', descripcion: 'Ejercicios DISTINTOS resueltos correctamente.', tipo: 'entero', unidad: 'ejercicios', rango: '≥ 0', calculo: 'Cardinalidad del conjunto de ejercicios con al menos un intento correcto (no cuenta repeticiones).' },
      { variable: 'tiempo_promedio_ejercicio', descripcion: 'Tiempo medio por ejercicio resuelto.', tipo: 'entero', unidad: 'segundos', rango: '≥ 0', calculo: 'Media del tiempo de los intentos CORRECTOS con tiempo > 0.' },
      { variable: 'xp_total', descripcion: 'Experiencia acumulada (gamificación).', tipo: 'entero', unidad: 'XP', rango: '≥ 0', calculo: 'Suma de XP otorgado por el motor de reglas del backend.' },
      { variable: 'racha', descripcion: 'Racha de días consecutivos de actividad.', tipo: 'entero', unidad: 'días', rango: '≥ 0', calculo: 'Registrada por el módulo de ranking.' },
      { variable: 'consultas_ia', descripcion: 'Consultas al tutor PREXI.', tipo: 'entero', unidad: 'consultas', rango: '≥ 0', calculo: 'Total de registros de ConsultaIa del estudiante.' },
      { variable: 'pistas_usadas', descripcion: 'Consultas del tipo "pista".', tipo: 'entero', unidad: 'pistas', rango: '≥ 0', calculo: 'Subconjunto de consultas_ia con tipo = pista.' },
      { variable: 'retos_entregados', descripcion: 'Retos del docente entregados.', tipo: 'entero', unidad: 'retos', rango: '≥ 0', calculo: 'RetoUsuario con estado distinto de sin_entregar.' },
      { variable: 'intentos_totales', descripcion: 'Intentos de ejercicio registrados.', tipo: 'entero', unidad: 'intentos', rango: '≥ 0', calculo: 'Todos los intentos, correctos e incorrectos.' },
      { variable: 'tasa_acierto', descripcion: 'Porcentaje de intentos correctos.', tipo: 'entero', unidad: '%', rango: '0 a 100', calculo: 'intentos correctos / intentos_totales × 100.' },
      { variable: 'pistas_por_ejercicio', descripcion: 'Pistas promedio por intento.', tipo: 'decimal', unidad: 'pistas/intento', rango: '≥ 0', calculo: 'Media de pistasUsadas sobre todos los intentos.' },
      { variable: 'sin_pistas_pct', descripcion: 'Porcentaje de intentos resueltos sin pistas.', tipo: 'entero', unidad: '%', rango: '0 a 100', calculo: 'Intentos con 0 pistas / intentos_totales × 100.' },
      { variable: 'autonomia_delta', descripcion: 'Cambio en el uso de pistas entre la segunda y la primera mitad del historial.', tipo: 'decimal', unidad: 'pistas/intento', rango: 'negativo = más autonomía', calculo: 'Media(2ª mitad) − Media(1ª mitad) de pistasUsadas. Null si hay pocos intentos.' },
      { variable: 'tasa_acierto_delta', descripcion: 'Cambio en la tasa de acierto entre mitades del historial.', tipo: 'entero', unidad: 'puntos %', rango: '−100 a 100', calculo: 'Ídem sobre acierto (0/100). Null si hay pocos intentos.' },
      { variable: 'tiempo_medio_delta', descripcion: 'Cambio en el tiempo medio por intento entre mitades.', tipo: 'entero', unidad: 'segundos', rango: 'negativo = más rápido', calculo: 'Ídem sobre tiempoSeg de intentos con tiempo > 0.' },
      { variable: 'subidas_nivel_intentos', descripcion: 'Mini-diagnósticos de subida de nivel rendidos.', tipo: 'entero', unidad: 'intentos', rango: '≥ 0', calculo: 'Registros de IntentoSubidaNivel.' },
      { variable: 'subidas_nivel_aprobadas', descripcion: 'Subidas de nivel superadas.', tipo: 'entero', unidad: 'intentos', rango: '≥ 0', calculo: 'Subconjunto aprobado de lo anterior.' },
      // ── USO DE LA PLATAFORMA ──
      { variable: 'dias_activos', descripcion: 'Días distintos con actividad en la plataforma.', tipo: 'entero', unidad: 'días', rango: '≥ 0', calculo: `Fechas únicas (calendario local) con al menos un evento, uniendo intentos, consultas al tutor, entregas de retos y código guardado.` },
      { variable: 'primer_dia', descripcion: 'Fecha del primer evento registrado.', tipo: 'fecha', unidad: 'AAAA-MM-DD', rango: '—', calculo: 'Mínimo de las fechas de sus eventos.' },
      { variable: 'ultimo_dia', descripcion: 'Fecha del último evento registrado.', tipo: 'fecha', unidad: 'AAAA-MM-DD', rango: '—', calculo: 'Máximo de las fechas de sus eventos.' },
      { variable: 'periodo_dias', descripcion: 'Duración de la participación.', tipo: 'entero', unidad: 'días', rango: '≥ 1', calculo: 'Días calendario entre el primer y el último evento, INCLUSIVE (quien entró un solo día tiene 1, no 0).' },
      { variable: 'sesiones', descripcion: 'Bloques de trabajo estimados.', tipo: 'entero', unidad: 'sesiones', rango: '≥ 0', calculo: `Eventos consecutivos separados por MÁS de ${UMBRAL_SESION_MIN} minutos abren una sesión nueva. El umbral de ${UMBRAL_SESION_MIN} min es la convención habitual en analítica de aprendizaje; en el borde exacto se considera la MISMA sesión.` },
      { variable: 'minutos_estimados', descripcion: 'Tiempo estimado en plataforma. NO es una medición directa.', tipo: 'entero', unidad: 'minutos', rango: '≥ 0', calculo: NOTA_TIEMPO_ESTIMADO },
      { variable: 'minutos_por_sesion', descripcion: 'Duración media estimada de una sesión.', tipo: 'entero', unidad: 'minutos', rango: '≥ 0', calculo: 'minutos_estimados ÷ sesiones.' },
      { variable: 'regularidad', descripcion: 'Constancia de uso: distingue el trabajo sostenido del atracón concentrado.', tipo: 'decimal', unidad: 'proporción', rango: '0 a 1', calculo: 'dias_activos ÷ periodo_dias. Cerca de 1 = usó el sistema casi todos los días de su periodo; cerca de 0 = concentró la actividad en pocos días. Null si no hay actividad.' },
      // ── GAMIFICACIÓN ──
      { variable: 'consultas_ranking', descripcion: 'Veces que el estudiante consultó el ranking (uso de la gamificación).', tipo: 'entero', unidad: 'consultas', rango: '≥ 0', calculo: 'Registros de ConsultaRanking del estudiante. Se registra cada apertura de la pantalla de ranking, de forma asíncrona para no afectar su experiencia.' },
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
   * FICHA METODOLÓGICA del estudio (diseño no experimental transversal):
   * diseño, población, instrumentos, variables e hipótesis. Se muestra y se exporta para que conste en el documento sin
   * tener que redactarla aparte (y sin que se desincronice de lo que el sistema
   * realmente hace).
   */
  async fichaMetodologica() {
    const dataset = await this.exportacion.construirDataset();
    const paralelos = [...new Set(dataset.map((f) => f.paralelo))];

    return {
      diseno: {
        tipo: 'No experimental, transversal',
        esquema: 'M: X → (O₁, O₂, O₃): un único grupo, una única medición al final del período de uso',
        por_que:
          'No se manipulan variables ni se comparan grupos. Se observa el sistema en condiciones reales ' +
          'de uso y, en un único momento, se evalúa si funciona bien: precisión del motor adaptativo ' +
          '(O₁), usabilidad percibida (O₂) y calidad del producto de software (O₃).',
      },
      poblacion: {
        descripcion:
          'Estudiantes de primer semestre de Programación I, Carrera de Ingeniería de Sistemas, ' +
          'Universidad Pública de El Alto (UPEA).',
        paralelos,
        n_registrados: dataset.length,
        n_con_actividad: dataset.filter((f) => f.intentos_totales > 0).length,
      },
      muestreo: {
        tipo: 'No probabilístico por conveniencia (censo del paralelo participante)',
        implicacion:
          'Los resultados describen el comportamiento del sistema en el grupo estudiado y no admiten ' +
          'generalización estadística a la población completa. Es una limitación a declarar.',
      },
      instrumentos: [
        {
          nombre: 'Registro automatizado del motor adaptativo',
          tipo: 'Logs del sistema (una fila por decisión del motor)',
          mide: 'Precisión del ajuste de dificultad y latencia de reajuste',
          responde: 'El propio sistema (sin autorreporte)',
        },
        {
          nombre: 'Escala de Usabilidad del Sistema (SUS, Brooke, 1996)',
          tipo: 'Cuestionario de 10 ítems, Likert 1–5, puntaje 0–100',
          mide: 'Usabilidad percibida',
          responde: 'Estudiantes usuarios, una sola vez al final del período de uso',
        },
        {
          nombre: 'Cuestionario estructurado ISO/IEC 25010',
          tipo: 'Ítems Likert 1–5 agrupados por característica de calidad',
          mide: 'Calidad del producto de software',
          responde: 'Docentes del área y evaluadores con formación en ingeniería de software',
        },
      ],
      variables: {
        independiente:
          'Sistema Adaptativo Inteligente con gamificación y ranking (se describe, no se manipula): ' +
          'adaptabilidad (% de personalización), gamificación (retos completados y cambios de posición ' +
          'en el ranking) y retroalimentación (tiempo de respuesta ante cada actividad resuelta).',
        dependientes: [
          'Precisión del motor adaptativo: % de asignaciones dentro del rango objetivo (IC 95 %) y latencia de reajuste',
          'Usabilidad percibida: puntaje medio SUS (0–100)',
          'Calidad del producto de software: valoración media por característica ISO/IEC 25010, ' +
            '% de subcaracterísticas en nivel aceptable y criterios de aceptación satisfechos',
        ],
      },
      hipotesis: {
        investigacion:
          'El Sistema Adaptativo Inteligente con gamificación PREXI alcanza niveles satisfactorios de ' +
          'precisión en el motor adaptativo, de usabilidad percibida y de calidad del producto de software.',
        criterio_decision:
          'La hipótesis se acepta solo si los tres criterios de aceptación (precisión, usabilidad y ' +
          'calidad) se satisfacen de forma conjunta. Cada indicador se acompaña de su intervalo de ' +
          'confianza del 95 % por bootstrap de percentil.',
      },
      tratamiento_datos: {
        faltantes: 'No se imputan valores: un dato ausente viaja como ausente hasta el análisis.',
        anonimizacion: 'El dataset no contiene nombre, correo, CI ni RU. Cada estudiante aparece como id_anonimo.',
        analisis: 'Los datasets exportados se analizan fuera del sistema con Python, Pandas y SciPy.',
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
      n_con_actividad: dataset.filter((f) => f.intentos_totales > 0).length,
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
