/**
 * TECHO DE XP POR ÍTEM — fuente única.
 *
 * Un ejercicio o un reto no puede otorgar más de esto. El rango anterior de los
 * DTO del docente llegaba a 500, veinte veces por encima del ítem más generoso
 * que existía en el banco: un rango así no valida nada, acepta cualquier cifra
 * tecleada por error y desequilibra el ranking sin avisar.
 *
 * VIVE AQUÍ, Y NO REPETIDO EN CADA SITIO, por lo que pasó al bajarlo: el techo
 * se aplicó en los cuatro DTO del docente, pero los seeds (`seed.ts`,
 * `seed-unidad.ts` y los `data/unidad*.json`) seguían sembrando ítems de 40, 60,
 * 80 y 100 XP. Escriben con Prisma, sin pasar por la validación, así que
 * resembrar habría vuelto a crear contenido que el docente NO puede editar:
 * abriría un ejercicio de 40 XP, cambiaría el enunciado y recibiría un error por
 * un campo que no tocó. Un techo que solo conoce una capa no es un techo.
 *
 * Si se cambia, se cambia AQUÍ y hay que reajustar el contenido ya sembrado con
 * `scripts/topar-xp.ts --aplicar`. Ese ajuste no es retroactivo para nadie: el
 * XP se acumula al responder y cada `Intento` conserva su `xpOtorgado`.
 */
export const XP_MAX_ITEM = 25;

/** Acota un XP al techo vigente. Se usa en los seeds, que no pasan por los DTO. */
export const toparXp = (xp: number): number => Math.min(Math.max(0, Math.round(xp)), XP_MAX_ITEM);
