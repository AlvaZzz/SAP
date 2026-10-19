import { fuentePractica } from './fuente-practica';

describe('fuente de práctica de un reto', () => {
  it('separa la práctica y el ejercicio de la cita del banco', () => {
    expect(fuentePractica({ citaBreve: 'Práctica Nro. 1 · Secuenciales, ejercicio 4', codigo: 'BUG-U1-02' })).toEqual({
      texto: 'Práctica Nro. 1 · Secuenciales, ejercicio 4', practica: 'Práctica Nro. 1', ejercicio: 'Secuenciales, ejercicio 4',
    });
  });

  it('los retos del docente (sin práctica) no muestran fuente', () => {
    expect(fuentePractica(null)).toBeNull();
    expect(fuentePractica({ citaBreve: 'Módulo Unidad 2' })).toBeNull();
  });
});
