import { ValidationPipe } from '@nestjs/common';
import { IsInt, IsString, Max, MaxLength, MinLength } from 'class-validator';
import { fabricaErroresValidacion, traducirRestriccion } from './mensajes-validacion';

class Ejemplo {
  @IsString() @MinLength(3) @MaxLength(10) nombre!: string;
  @IsInt() @Max(12) semestre!: number;
  @IsString() @MinLength(3, { message: 'Escribe tu usuario' }) email!: string;
}

const pipe = new ValidationPipe({
  whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: fabricaErroresValidacion,
});

async function mensajes(body: unknown): Promise<string[]> {
  try {
    await pipe.transform(body, { type: 'body', metatype: Ejemplo });
    return [];
  } catch (e) {
    return (e as { getResponse: () => { message: string[] } }).getResponse().message;
  }
}

describe('mensajes de validación en español', () => {
  it('traduce los mensajes por defecto de class-validator', async () => {
    const m = await mensajes({ nombre: 'ab', semestre: 20, email: 'Ana_123' });
    expect(m).toContain('El nombre debe tener al menos 3 caracteres.');
    expect(m).toContain('El semestre no puede ser mayor que 12.');
    expect(m.join(' ')).not.toMatch(/must|should/);
  });

  it('respeta los mensajes propios ya escritos en español', async () => {
    const m = await mensajes({ nombre: 'Ana', semestre: 1, email: 'a' });
    expect(m).toEqual(['Escribe tu usuario']);
  });

  it('avisa en español de un campo que no se esperaba', async () => {
    const m = await mensajes({ nombre: 'Ana', semestre: 1, email: 'Ana_123', usuario: 'x' });
    expect(m).toEqual(['No se esperaba el usuario. Recarga la página e inténtalo de nuevo.']);
  });

  it('nombra los campos desconocidos sin inventar una etiqueta', () => {
    expect(traducirRestriccion('isString', 'fooBar must be a string', 'fooBar')).toBe('El campo «fooBar» debe ser un texto.');
  });
});
