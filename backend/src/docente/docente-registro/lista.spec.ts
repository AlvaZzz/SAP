import {
  aplicarMapeo, campoDeEncabezado, capitalizar, detectarColumnas, limpiarCi, limpiarParalelo, limpiarRu,
  separarNombreCompleto, validarFilas,
} from './lista';

describe('reconocimiento de columnas de la lista de estudiantes', () => {
  it('reconoce los encabezados de la plantilla', () => {
    const d = detectarColumnas([['AP. PATERNO', 'AP. MATERNO', 'NOMBRES', 'CI', 'RU', 'PARALELO']]);
    expect(d.filaEncabezado).toBe(0);
    expect(d.mapeo).toMatchObject({ apellidoPaterno: 0, apellidoMaterno: 1, nombres: 2, ci: 3, ru: 4, paralelo: 5 });
    expect(d.faltantes).toEqual([]);
  });

  it('reconoce columnas con OTROS nombres y en OTRO orden', () => {
    const d = detectarColumnas([['Nº', 'Registro Universitario', 'C.I.', 'Apellido Pat.', 'Apellido Mat.', 'Nombre(s)', 'Grupo']]);
    expect(d.mapeo).toMatchObject({ ru: 1, ci: 2, apellidoPaterno: 3, apellidoMaterno: 4, nombres: 5, paralelo: 6 });
    expect(d.faltantes).toEqual([]);
  });

  it('salta los títulos de la nómina y encuentra la fila de encabezados', () => {
    const d = detectarColumnas([
      ['UNIVERSIDAD PÚBLICA DE EL ALTO'],
      ['CARRERA INGENIERÍA DE SISTEMAS — NÓMINA PRG-111'],
      [],
      ['Nro', 'Apellidos y Nombres', 'Cédula de Identidad', 'Matrícula'],
      ['1', 'MAMANI QUISPE JUAN CARLOS', '1234567', '200012345'],
    ]);
    expect(d.filaEncabezado).toBe(3);
    expect(d.mapeo).toMatchObject({ nombreCompleto: 1, ci: 2, ru: 3 });
    expect(d.faltantes).toEqual([]);
  });

  it('si no reconoce encabezados lo dice, en vez de adivinar', () => {
    const d = detectarColumnas([['a', 'b', 'c'], ['1', '2', '3']]);
    expect(d.filaEncabezado).toBe(-1);
    expect(d.faltantes).toEqual(['Nombre (apellidos y nombres)', 'CI', 'RU']);
    expect(d.encabezados).toEqual(['Columna 1', 'Columna 2', 'Columna 3']);
  });

  it('no confunde "apellidos y nombres" con la columna de nombres', () => {
    expect(campoDeEncabezado('Apellidos y Nombres')).toBe('nombreCompleto');
    expect(campoDeEncabezado('NOMBRES')).toBe('nombres');
    expect(campoDeEncabezado('R.U.')).toBe('ru');
    expect(campoDeEncabezado('Carnet')).toBe('ci');
    expect(campoDeEncabezado('Observaciones')).toBeNull();
  });
});

describe('separación del nombre completo', () => {
  it('formato de nómina: PATERNO MATERNO NOMBRES', () => {
    expect(separarNombreCompleto('MAMANI QUISPE JUAN CARLOS')).toEqual({
      apellidoPaterno: 'Mamani', apellidoMaterno: 'Quispe', nombres: 'Juan Carlos',
    });
  });

  it('formato "Apellidos, Nombres"', () => {
    expect(separarNombreCompleto('Condori Flores, María Elena')).toEqual({
      apellidoPaterno: 'Condori', apellidoMaterno: 'Flores', nombres: 'María Elena',
    });
  });

  it('mantiene juntas las partículas del apellido', () => {
    expect(separarNombreCompleto('DE LA CRUZ MAMANI PEDRO')).toEqual({
      apellidoPaterno: 'De la Cruz', apellidoMaterno: 'Mamani', nombres: 'Pedro',
    });
  });

  it('con dos palabras: un apellido y un nombre', () => {
    expect(separarNombreCompleto('Quispe Ana')).toEqual({ apellidoPaterno: 'Quispe', apellidoMaterno: '', nombres: 'Ana' });
  });
});

describe('limpieza de valores', () => {
  it('CI: quita extensión, puntos y el ".0" que agrega Excel', () => {
    expect(limpiarCi('1234567 LP')).toBe('1234567');
    expect(limpiarCi('1.234.567')).toBe('1234567');
    expect(limpiarCi('1234567.0')).toBe('1234567');
    expect(limpiarCi('1234567-1A')).toBe('1234567-1A');
  });

  it('RU: solo dígitos', () => {
    expect(limpiarRu(' 200012345.0 ')).toBe('200012345');
    expect(limpiarRu('RU-200012345')).toBe('200012345');
  });

  it('paralelo y mayúsculas', () => {
    expect(limpiarParalelo('paralelo a')).toBe('A');
    expect(limpiarParalelo(' b ')).toBe('B');
    expect(capitalizar('MAMANI DE LA TORRE')).toBe('Mamani de la Torre');
  });
});

describe('de filas crudas a estudiantes', () => {
  const filas = [
    ['Nro', 'Apellidos y Nombres', 'C.I.', 'R.U.'],
    ['1', 'MAMANI QUISPE JUAN', '1234567', '200012345'],
    ['', '', '', ''],
    ['2', 'Flores, Ana', '7654321 LP', '200054321'],
    ['TOTAL: 2', '', '', ''],
  ];

  it('aplica el mapeo, usa el paralelo por defecto y descarta filas vacías o de totales', () => {
    const d = detectarColumnas(filas);
    const est = aplicarMapeo(filas, d.filaEncabezado, d.mapeo, 'a');
    expect(est).toEqual([
      { fila: 2, apellidoPaterno: 'Mamani', apellidoMaterno: 'Quispe', nombres: 'Juan', ci: '1234567', ru: '200012345', paralelo: 'A' },
      { fila: 4, apellidoPaterno: 'Flores', apellidoMaterno: '', nombres: 'Ana', ci: '7654321', ru: '200054321', paralelo: 'A' },
    ]);
  });
});

describe('validación de la vista previa', () => {
  const base = { fila: 1, apellidoPaterno: 'Mamani', apellidoMaterno: 'Quispe', nombres: 'Juan', ci: '1234567', ru: '200012345', paralelo: 'A' };

  it('una fila completa y sin coincidencias es NUEVA', () => {
    const [f] = validarFilas([base], []);
    expect(f).toMatchObject({ estado: 'nuevo', errores: [], nombreCompleto: 'Mamani Quispe Juan' });
  });

  it('marca campos vacíos y formatos inválidos', () => {
    const [f] = validarFilas([{ ...base, nombres: '', ci: '12', ru: '', paralelo: '' }], []);
    expect(f.estado).toBe('error');
    expect(f.camposConError.sort()).toEqual(['ci', 'nombres', 'paralelo', 'ru']);
  });

  it('marca CI y RU repetidos DENTRO de la lista', () => {
    const r = validarFilas([base, { ...base, fila: 2, nombres: 'Otro' }], []);
    expect(r.every((f) => f.estado === 'error')).toBe(true);
    expect(r[0].errores).toEqual(expect.arrayContaining(['CI repetido en la lista.', 'RU repetido en la lista.']));
  });

  it('un RU que ya está registrado como estudiante es EXISTE (no error)', () => {
    const [f] = validarFilas([base], [{ id: 9, ci: '1234567', ru: '200012345', rol: 'estudiante' }]);
    expect(f).toMatchObject({ estado: 'existe', existenteId: 9, errores: [] });
  });

  it('un CI que pertenece a OTRA cuenta es un error real', () => {
    const [f] = validarFilas([base], [{ id: 3, ci: '1234567', ru: '999', rol: 'estudiante' }]);
    expect(f.estado).toBe('error');
    expect(f.errores).toContain('Ese CI ya está registrado en otra cuenta.');
  });
});
