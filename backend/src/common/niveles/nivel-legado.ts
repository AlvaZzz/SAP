import { PrismaService } from '../prisma/prisma.service';

/**
 * NIVEL LEGADO — vestigio de compatibilidad, NO una decisión pedagógica.
 *
 * `Ejercicio.nivelId` es una clave foránea OBLIGATORIA hacia `Nivel`, el modelo
 * de gamificación antiguo (numero 1-5, plano, atado a unidades). Ese modelo dejó
 * de gobernar la adaptatividad: lo que decide qué ejercicio ve cada estudiante
 * es `NivelDificultad` (básico/intermedio/avanzado) por tema.
 *
 * El docente ya NO elige un nivel 1-5 en ningún formulario. Pero mientras la
 * columna siga siendo obligatoria hay que ponerle algo, y ese algo se resuelve
 * aquí: el primer `Nivel` por número.
 *
 * POR QUÉ IMPORTA QUE ESTÉ EN UN SOLO SITIO: antes cada servicio del docente
 * traducía `dto.nivel` a un id con su propio helper `nivelId(numero)`, y los
 * cuatro lanzaban `No existe el nivel N`. Como el seed solo crea cinco filas,
 * cualquier contenido de una unidad más allá de la quinta era imposible de
 * crear: el formulario respondía "nivel must not be greater than 5" y el
 * docente no tenía forma de saber que le estaba hablando de un modelo obsoleto.
 *
 * CUANDO SE PUEDA ELIMINAR `Nivel` (ver docs), esta función y la columna se van
 * juntas. Hasta entonces, todo el contenido nuevo del docente cuelga del mismo
 * nivel de compatibilidad y ese dato no significa nada.
 */
export async function nivelLegadoId(prisma: PrismaService): Promise<number> {
  const primero = await prisma.nivel.findFirst({
    orderBy: { numero: 'asc' },
    select: { id: true },
  });
  if (primero) return primero.id;

  // Base sin ningún `Nivel` sembrado (posible en una instalación nueva). Se crea
  // uno de compatibilidad en vez de fallar: el docente no debería enterarse de
  // que este modelo existe, y mucho menos ver un error por su culpa.
  const creado = await prisma.nivel.create({
    data: {
      numero: 1,
      titulo: 'Compatibilidad',
      descripcion: 'Vestigio del modelo de niveles 1-5. No se usa para adaptar: ver NivelDificultad.',
      umbral: 0,
    },
    select: { id: true },
  });
  return creado.id;
}
