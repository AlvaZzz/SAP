import { avanceTemaGuardado, desbloqueoSecuencial } from './desbloqueo';

describe('tema completo: los 10 ejercicios de su nivel actual', () => {
  it('con 8 de 10 en su nivel el tema NO está completo (8 solo alcanza para pedir la subida)', () => {
    expect(avanceTemaGuardado(0, 8, 10, 10)).toBe(8);
  });

  it('con los 10 de su nivel el tema queda completo', () => {
    expect(avanceTemaGuardado(8, 10, 10, 10)).toBe(10);
  });

  it('si el nivel tiene menos de 10 cargados, alcanza con resolverlos todos (nadie queda atrapado)', () => {
    expect(avanceTemaGuardado(0, 4, 5, 10)).toBe(4);
    expect(avanceTemaGuardado(4, 5, 5, 10)).toBe(10);
  });

  it('al subir de nivel sin haberlo completado, el avance se mide en el nivel nuevo', () => {
    // Subió a Intermedio con 8 de Básico: ahora lleva 3 de Intermedio.
    expect(avanceTemaGuardado(8, 3, 10, 10)).toBe(3);
  });

  it('una vez completo no vuelve a bajar (no se cierra otra vez el tema siguiente)', () => {
    expect(avanceTemaGuardado(10, 0, 10, 10)).toBe(10);
  });

  it('el siguiente tema se abre solo con el anterior completo', () => {
    expect(desbloqueoSecuencial([{ completados: 8, umbral: 10 }, { completados: 0, umbral: 10 }], 80)).toEqual([true, false]);
    expect(desbloqueoSecuencial([{ completados: 10, umbral: 10 }, { completados: 0, umbral: 10 }], 80)).toEqual([true, true]);
  });
});
