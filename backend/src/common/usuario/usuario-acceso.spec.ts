import { leerUsuarioDeAcceso, nombreCoincide, primerNombre, usuarioDeAcceso } from './usuario-acceso';

describe('Usuario de acceso del estudiante (PrimerNombre_CI)', () => {
  it('se arma con el primer nombre sin tildes y el CI', () => {
    expect(usuarioDeAcceso({ nombres: 'Álvaro Daniel', cedula: '12929098' })).toBe('Alvaro_12929098');
    expect(usuarioDeAcceso({ nombres: 'MARÍA josé', cedula: '7654321' })).toBe('Maria_7654321');
  });

  it('conserva la ñ y usa el nombre completo si faltan los nombres', () => {
    expect(primerNombre('Ñusta')).toBe('Ñusta');
    expect(usuarioDeAcceso({ nombres: null, nombre: 'Juan Pérez', cedula: '1234567' })).toBe('Juan_1234567');
  });

  it('queda vacío si falta el CI o el nombre', () => {
    expect(usuarioDeAcceso({ nombres: 'Ana', cedula: null })).toBe('');
    expect(usuarioDeAcceso({ nombres: '', nombre: '', cedula: '123' })).toBe('');
  });

  it('lee lo que se escribe al iniciar sesión', () => {
    expect(leerUsuarioDeAcceso(' Alvaro_12929098 ')).toEqual({ nombre: 'Alvaro', ci: '12929098' });
    expect(leerUsuarioDeAcceso('alvaro_1234567-1a')).toEqual({ nombre: 'alvaro', ci: '1234567-1A' });
    expect(leerUsuarioDeAcceso('200012345')).toBeNull();
    expect(leerUsuarioDeAcceso('ana@upea.edu.bo')).toBeNull();
  });

  it('el nombre se compara sin mayúsculas ni tildes', () => {
    const u = { nombres: 'Álvaro Daniel', nombre: 'Veizaga Acarapi Álvaro Daniel' };
    expect(nombreCoincide('alvaro', u)).toBe(true);
    expect(nombreCoincide('ALVARO', u)).toBe(true);
    expect(nombreCoincide('Daniel', u)).toBe(false); // solo el PRIMER nombre
    expect(nombreCoincide('Pedro', u)).toBe(false);
  });

  it('en cuentas antiguas sin "nombres" vale cualquier palabra del nombre', () => {
    expect(nombreCoincide('juan', { nombres: null, nombre: 'Juan Pérez' })).toBe(true);
  });
});
