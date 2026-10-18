import { IsEmail, IsString, MinLength, MaxLength, IsEnum, IsOptional, ValidateIf } from 'class-validator';
import { Rol } from '@prisma/client';

/**
 * Crear una cuenta de cualquier rol. Todas entran con su USUARIO
 * (PrimerNombre_CI), igual que los estudiantes: por eso se piden los apellidos,
 * los nombres y el CI, y el correo ya no hace falta.
 */
export class CrearUsuarioDto {
  @IsString() @MinLength(2, { message: 'Escribe el apellido paterno.' }) @MaxLength(60)
  apellidoPaterno!: string;

  @IsOptional() @IsString() @MaxLength(60)
  apellidoMaterno?: string;

  @IsString() @MinLength(2, { message: 'Escribe los nombres.' }) @MaxLength(80)
  nombres!: string;

  @IsString() @MinLength(5, { message: 'Escribe el CI (5 a 10 dígitos).' }) @MaxLength(20)
  cedula!: string;

  @IsEnum(Rol, { message: 'Rol inválido' })
  rol!: Rol;

  @IsString() @MinLength(6, { message: 'La contraseña inicial debe tener al menos 6 caracteres.' }) @MaxLength(100)
  password!: string;

  /** Opcional: solo para cuentas que ya lo tenían. Ya no se usa para entrar ni para recuperar. */
  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @IsEmail({}, { message: 'Correo inválido' })
  email?: string;

  @IsOptional() @IsString() @MaxLength(120)
  carrera?: string;

  @IsOptional() @IsString() @MaxLength(120)
  institucion?: string;
}

export class EditarUsuarioDto {
  @IsOptional() @IsString() @MinLength(2, { message: 'Escribe el apellido paterno.' }) @MaxLength(60)
  apellidoPaterno?: string;

  @IsOptional() @IsString() @MaxLength(60)
  apellidoMaterno?: string;

  @IsOptional() @IsString() @MinLength(2, { message: 'Escribe los nombres.' }) @MaxLength(80)
  nombres?: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  nombre?: string;

  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @IsEmail({}, { message: 'Correo inválido' })
  email?: string;

  @IsOptional() @IsString() @MinLength(5, { message: 'Escribe el CI (5 a 10 dígitos).' }) @MaxLength(20)
  cedula?: string;

  @IsOptional() @IsEnum(Rol, { message: 'Rol inválido' })
  rol?: Rol;

  @IsOptional() @IsString() @MaxLength(120)
  carrera?: string;

  @IsOptional() @IsString() @MaxLength(120)
  institucion?: string;
}
