import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsInt, Min, Max } from 'class-validator';

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

  // Paralelo del estudiante (ej. "A", "B", "C"): permite al admin armar los
  // grupos de investigación (control/experimental) por paralelo completo.
  @IsString() @MinLength(1) @MaxLength(10)
  paralelo!: string;

  @IsOptional() @IsInt() @Min(1) @Max(12)
  semestre?: number;
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

export class TourVistoDto {
  @IsString({ message: 'La clave del tutorial es obligatoria' })
  @MinLength(1) @MaxLength(60)
  clave!: string;
}

export class PasswordDto {
  @IsString() @MinLength(1)
  actual!: string;

  @IsString() @MinLength(6) @MaxLength(100)
  nueva!: string;
}

// ── Recuperación de contraseña (todos los roles) ──
export class RecuperarDto {
  @IsEmail({}, { message: 'Correo inválido' })
  email!: string;
}

export class ValidarTokenDto {
  @IsString() @MinLength(10) @MaxLength(200)
  token!: string;
}

export class RestablecerDto {
  @IsString() @MinLength(10) @MaxLength(200)
  token!: string;

  @IsString() @MinLength(6) @MaxLength(100)
  nueva!: string;
}
