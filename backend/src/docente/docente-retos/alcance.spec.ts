import { puedeGestionarReto, retosDelDocente } from './alcance';

describe('Retos que gestiona un docente', () => {
  it('ve los suyos y los del banco del curso (con código)', () => {
    expect(retosDelDocente(5)).toEqual({ OR: [{ autorId: 5 }, { codigo: { not: null } }] });
  });

  it('puede gestionar un reto del banco aunque lo haya sembrado otro docente', () => {
    expect(puedeGestionarReto({ autorId: 2, codigo: 'BUG-U1-01' }, 5)).toBe(true);
  });

  it('no puede gestionar un reto escrito a mano por otro docente', () => {
    expect(puedeGestionarReto({ autorId: 2, codigo: null }, 5)).toBe(false);
    expect(puedeGestionarReto({ autorId: 5, codigo: null }, 5)).toBe(true);
  });
});
