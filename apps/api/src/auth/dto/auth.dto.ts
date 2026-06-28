import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

// Nota: por ahora se acepta cualquier correo válido (p. ej. Gmail). La
// restricción al dominio institucional @upea.edu.bo está deshabilitada
// a pedido del usuario; reactivarla aquí si la tesis lo requiere.
export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(120)
  nombre!: string;

  @IsEmail({}, { message: 'Correo inválido' })
  email!: string;

  @IsString() @MinLength(6) @MaxLength(100)
  password!: string;

  @IsString() @MinLength(4) @MaxLength(20)
  cedula!: string;

  @IsString() @MinLength(2) @MaxLength(120)
  carrera!: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Correo inválido' })
  email!: string;

  @IsString() @MinLength(1)
  password!: string;
}

export class PerfilDto {
  @IsString() @MinLength(2) @MaxLength(120)
  nombre!: string;

  @IsString() @MinLength(2) @MaxLength(120)
  carrera!: string;
}
