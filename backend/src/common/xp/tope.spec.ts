import { XP_MAX_ITEM, toparXp } from './tope';

/**
 * TECHO DE XP POR ÍTEM — pruebas de regresión.
 *
 * El defecto que fijan: los DTO del docente aceptaban hasta 500 XP por
 * ejercicio, veinte veces por encima del ítem más generoso del banco. Un rango
 * así no valida nada. Y cuando se bajó el techo, los seeds siguieron sembrando
 * ítems de 40, 60, 80 y 100 XP: escriben con Prisma, sin pasar por la
 * validación, así que resembrar volvía a crear contenido que el docente NO podía
 * editar (abrir un ejercicio de 40 XP, cambiar el enunciado y recibir un error
 * por un campo que no tocó).
 *
 * De ahí que el techo viva en UNA constante que usan las dos capas, y que estas
 * pruebas comprueben el acotado, que es lo que usan los seeds.
 */
describe('Techo de XP por ítem', () => {
  it('el techo es un entero positivo', () => {
    expect(Number.isInteger(XP_MAX_ITEM)).toBe(true);
    expect(XP_MAX_ITEM).toBeGreaterThan(0);
  });

  it('deja pasar lo que ya cabe bajo el techo', () => {
    expect(toparXp(5)).toBe(5);
    expect(toparXp(20)).toBe(20);
    expect(toparXp(XP_MAX_ITEM)).toBe(XP_MAX_ITEM);
  });

  it('acota lo que lo supera — los valores del seed viejo', () => {
    for (const xp of [40, 50, 60, 70, 80, 100, 500]) {
      expect(toparXp(xp)).toBe(XP_MAX_ITEM);
    }
  });

  it('nunca devuelve un XP negativo', () => {
    expect(toparXp(-10)).toBe(0);
    expect(toparXp(0)).toBe(0);
  });

  it('devuelve siempre un entero (los seeds pueden traer decimales)', () => {
    expect(toparXp(12.4)).toBe(12);
    expect(toparXp(12.6)).toBe(13);
    expect(Number.isInteger(toparXp(7.7))).toBe(true);
  });
});
