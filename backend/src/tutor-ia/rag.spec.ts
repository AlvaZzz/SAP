import { recuperarFragmentos } from './rag';

describe('RAG del material del docente (recuperación léxica)', () => {
  const MATERIAL = [
    'Las variables en Python guardan datos. Se asignan con el signo igual, por ejemplo x = 5.',
    'El bucle for recorre una secuencia. Se usa junto con range() para repetir n veces.',
    'Las listas almacenan varios valores. Se accede por índice empezando en cero.',
  ].join('\n\n');

  it('sin material devuelve cadena vacía', () => {
    expect(recuperarFragmentos('', 'bucles for')).toBe('');
    expect(recuperarFragmentos(null, 'bucles for')).toBe('');
  });

  it('recupera el fragmento más relevante a la consulta', () => {
    const r = recuperarFragmentos(MATERIAL, '¿cómo funciona el bucle for con range?');
    expect(r).toContain('bucle for');
    expect(r).not.toContain('Las listas almacenan');
  });

  it('es robusto a acentos y mayúsculas', () => {
    const r = recuperarFragmentos(MATERIAL, 'INDICE de las LÍSTAS');
    expect(r).toContain('listas');
  });

  it('sin coincidencias devuelve el inicio del material (mantiene el estilo del docente)', () => {
    const r = recuperarFragmentos(MATERIAL, 'diccionarios y conjuntos');
    expect(r).toContain('Las variables en Python');
  });

  it('respeta el límite de caracteres', () => {
    const largo = 'palabra clave '.repeat(500);
    const r = recuperarFragmentos(largo, 'clave', { maxChars: 100 });
    expect(r.length).toBeLessThanOrEqual(100);
  });
});
