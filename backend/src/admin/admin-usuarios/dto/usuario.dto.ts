import { IsEmail, IsString, MinLength, MaxLength, IsEnum, IsOptional } from 'class-validator';
import { Rol } from '@prisma/client';

/** Crear un usuario de cualquier rol (docente/investigador/admin no se registran públicamente). */
export class CrearUsuarioDto {
  @IsString() @MinLength(2) @MaxLength(120)
  nombre!: string;

  @IsEmail({}, { message: 'Correo inválido' })
  email!: string;

  @IsString() @MinLength(4) @MaxLength(20)
  cedula!: string;

  @IsEnum(Rol, { message: 'Rol inválido' })
  rol!: Rol;

  @IsString() @MinLength(6) @MaxLength(100)
  password!: string;

  @IsOptional() @IsString() @MaxLength(120)
  carrera?: string;

  @IsOptional() @IsString() @MaxLength(120)
  institucion?: string;
}

export class EditarUsuarioDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  nombre?: string;

  @IsOptional() @IsEmail({}, { message: 'Correo inválido' })
  email?: string;

  @IsOptional() @IsString() @MinLength(4) @MaxLength(20)
  cedula?: string;

  @IsOptional() @IsEnum(Rol, { message: 'Rol inválido' })
  rol?: Rol;

  @IsOptional() @IsString() @MaxLength(120)
  carrera?: string;

  @IsOptional() @IsString() @MaxLength(120)
  institucion?: string;
}
