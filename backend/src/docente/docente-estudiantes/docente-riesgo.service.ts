import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const MS_DIA = 86_400_000;

/**
 * ESTUDIANTES EN RIESGO (rol docente).
 *
 * POR QUÉ IMPORTA
 * Detectar a tiempo a quien se está descolgando permite intervenir antes de que
 * abandone la asignatura.
 *
 * A diferencia del estado global que ya calcula `DocenteEstudiantesService`
 * (una única etiqueta por estudiante), aquí se listan TODOS los motivos que
 * concurren, cada uno con su umbral a la vista. El docente necesita saber POR
 * QUÉ está en riesgo alguien para poder hacer algo distinto en cada caso: no se
 * atiende igual a quien lleva tres semanas sin entrar que a quien entra todos
 * los días y falla todo.
 */
@Injectable()
export class DocenteRiesgoService {
  constructor(private readonly prisma: PrismaService) {}

  async listar() {
    const cfg = await this.prisma.configuracionSistema.findUnique({ where: { id: 1 } });
    const umbrales = {
      dias_inactivo: cfg?.riesgoDiasInactivo ?? 7,
      tasa_acierto_min: cfg?.riesgoTasaAciertoMin ?? 40,
      min_intentos: cfg?.riesgoMinIntentos ?? 4,
      // Criterio propio de esta pantalla: llevar mucho tiempo sin cambiar de
      // nivel en ningún tema sugiere estancamiento, aunque siga entrando.
      dias_estancado: 14,
    };

    const [estudiantes, intentos] = await Promise.all([
      this.prisma.usuario.findMany({
        where: { rol: 'estudiante' },
        orderBy: { nombre: 'asc' },
        select: {
          id: true, nombre: true, email: true, creadoEn: true,
          ranking: { select: { ultimaActividad: true } },
          evaluaciones: { select: { tipo: true } },
          progresoTemas: { select: { nivelActual: true, actualizadoEn: true } },
        },
      }),
      this.prisma.intento.findMany({ select: { usuarioId: true, correcto: true, fecha: true } }),
    ]);

    const porUsuario = new Map<number, { total: number; correctos: number; ultima: Date | null }>();
    for (const it of intentos) {
      const e = porUsuario.get(it.usuarioId) ?? { total: 0, correctos: 0, ultima: null };
      e.total++;
      if (it.correcto) e.correctos++;
      if (!e.ultima || it.fecha > e.ultima) e.ultima = it.fecha;
      porUsuario.set(it.usuarioId, e);
    }

    const ahora = Date.now();
    const enRiesgo = estudiantes
      .map((u) => {
        const agg = porUsuario.get(u.id) ?? { total: 0, correctos: 0, ultima: null };
        const ultima = u.ranking?.ultimaActividad ?? agg.ultima ?? null;
        const diasInactivo = ultima ? Math.floor((ahora - ultima.getTime()) / MS_DIA) : null;
        const tasa = agg.total > 0 ? Math.round((agg.correctos / agg.total) * 100) : null;
        const tienePretest = u.evaluaciones.some((e) => e.tipo === 'pre');

        // Estancamiento: hace cuánto que no cambia de nivel en NINGÚN tema.
        const ultimoCambioNivel = u.progresoTemas.length
          ? Math.max(...u.progresoTemas.map((p) => p.actualizadoEn.getTime()))
          : null;
        const diasEstancado = ultimoCambioNivel
          ? Math.floor((ahora - ultimoCambioNivel) / MS_DIA)
          : null;

        // Se acumulan TODOS los motivos, no solo el primero: un estudiante puede
        // estar inactivo Y sin pretest, y son dos acciones distintas.
        const motivos: { clave: string; detalle: string; gravedad: 'alta' | 'media' }[] = [];

        if (!tienePretest) {
          motivos.push({
            clave: 'sin_pretest',
            detalle: 'No rindió el diagnóstico inicial. Sin pretest no entra en el análisis pre-post del estudio.',
            gravedad: 'alta',
          });
        }
        if (ultima === null) {
          motivos.push({
            clave: 'nunca_entro',
            detalle: `Registrado el ${u.creadoEn.toLocaleDateString('es-BO')}, sin ninguna actividad registrada.`,
            gravedad: 'alta',
          });
        } else if (diasInactivo !== null && diasInactivo > umbrales.dias_inactivo) {
          motivos.push({
            clave: 'inactivo',
            detalle: `${diasInactivo} días sin actividad (umbral: ${umbrales.dias_inactivo}).`,
            gravedad: diasInactivo > umbrales.dias_inactivo * 2 ? 'alta' : 'media',
          });
        }
        if (agg.total >= umbrales.min_intentos && tasa !== null && tasa < umbrales.tasa_acierto_min) {
          motivos.push({
            clave: 'acierto_bajo',
            detalle: `${tasa} % de acierto en ${agg.total} intentos (umbral: ${umbrales.tasa_acierto_min} %). Entra y trabaja, pero no está entendiendo.`,
            gravedad: 'media',
          });
        }
        if (diasEstancado !== null && diasEstancado > umbrales.dias_estancado && ultima !== null) {
          motivos.push({
            clave: 'estancado',
            detalle: `${diasEstancado} días sin subir de nivel en ningún tema (umbral: ${umbrales.dias_estancado}).`,
            gravedad: 'media',
          });
        }

        return {
          id: u.id,
          nombre: u.nombre,
          email: u.email,
          dias_inactivo: diasInactivo,
          tasa_acierto: tasa,
          intentos: agg.total,
          tiene_pretest: tienePretest,
          ultima_actividad: ultima,
          motivos,
          // Prioridad: primero los que tienen un motivo grave, luego por cantidad.
          prioridad: motivos.filter((m) => m.gravedad === 'alta').length * 10 + motivos.length,
        };
      })
      .filter((e) => e.motivos.length > 0)
      .sort((a, b) => b.prioridad - a.prioridad || (b.dias_inactivo ?? 0) - (a.dias_inactivo ?? 0));

    return {
      total_estudiantes: estudiantes.length,
      en_riesgo: enRiesgo.length,
      umbrales,
      estudiantes: enRiesgo,
      que_significa:
        'Un estudiante aparece aquí si cumple al menos un criterio de riesgo. Se listan TODOS los ' +
        'motivos que concurren, porque cada uno pide una acción distinta: a quien lleva semanas sin ' +
        'entrar hay que buscarlo; a quien entra a diario y falla todo hay que explicarle.',
      por_que_importa:
        'Cada estudiante que se recupera a tiempo es uno que sigue aprendiendo. Mientras antes se ' +
        'detecte la señal, más fácil es corregirla.',
    };
  }
}
