import { estudiantesDelDocente, paralelosDelDocente } from './docente-registro.service';

describe('visibilidad del docente: solo sus paralelos', () => {
  it('el docente ve solo los estudiantes de los paralelos donde él es el docente', () => {
    expect(estudiantesDelDocente(7, 'docente')).toEqual({
      rol: 'estudiante', estadoInscripcion: 'aprobada', paraleloRef: { docenteId: 7 },
    });
  });

  it('ni paralelos sin docente ni estudiantes sin paralelo: eso es del admin', () => {
    const filtro = JSON.stringify(estudiantesDelDocente(7, 'docente'));
    expect(filtro).not.toContain('null');
    expect(paralelosDelDocente(7, 'docente')).toEqual({ docenteId: 7 });
  });

  it('el admin ve todo', () => {
    expect(estudiantesDelDocente(1, 'admin')).toEqual({ rol: 'estudiante', estadoInscripcion: 'aprobada' });
    expect(paralelosDelDocente(1, 'admin')).toEqual({});
  });
});
