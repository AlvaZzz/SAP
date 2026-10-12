import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsInt, Min, Max, IsBoolean, Matches, ValidateIf } from 'class-validator';

/** Un estudiante no aceptado vuelve a pedir inscripción en un paralelo. */
export class SolicitarInscripcionDto {
  @IsInt() @Min(1)
  paraleloId!: number;
}

/**
 * Complejidad mínima de contraseña: 8 caracteres con al menos una letra y un
 * número. Deliberadamente sencilla — son estudiantes de primer semestre; exigir
 * símbolos y mayúsculas produce contraseñas apuntadas en papel, no más seguras.
 * Declarada ANTES de las clases que la usan: los decoradores se evalúan al
 * cargar el módulo y necesitan la constante ya inicializada.
 */
export const PASSWORD_REGEX = /^(?=.*[A-Za-zÁÉÍÓÚáéíóúÑñ])(?=.*\d).{8,}$/;
export const PASSWORD_MENSAJE = 'La contraseña debe tener al menos 8 caracteres, una letra y un número';

// Nota: por ahora se acepta cualquier correo válido (p. ej. Gmail). La
// restricción al dominio institucional @upea.edu.bo está deshabilitada
// a pedido del usuario; reactivarla aquí si la tesis lo requiere.
export class RegisterDto {
  // Datos del estudiante, igual que en la lista del docente.
  @IsOptional() @IsString() @MaxLength(60)
  apellidoPaterno?: string;

  @IsOptional() @IsString() @MaxLength(60)
  apellidoMaterno?: string;

  @IsOptional() @IsString() @MaxLength(80)
  nombres?: string;

  // Registro universitario: con él inicia sesión.
  @IsOptional() @IsString() @Matches(/^[0-9A-Za-z-]{4,20}$/, { message: 'El RU solo lleva números y letras (4 a 20)' })
  ru?: string;

  // Paralelo exacto al que pide inscribirse: la cuenta queda como SOLICITUD.
  @IsOptional() @IsInt() @Min(1)
  paraleloId?: number;

  // Compatibilidad con clientes anteriores (nombre en un solo campo).
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  nombre?: string;

  // Opcional: sirve para recuperar la contraseña.
  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @IsEmail({}, { message: 'Correo inválido' })
  email?: string;

  @IsString() @MaxLength(100) @Matches(PASSWORD_REGEX, { message: PASSWORD_MENSAJE })
  password!: string;

  @IsString() @MinLength(4) @MaxLength(20)
  cedula!: string;

  @IsOptional() @IsString() @MaxLength(120)
  carrera?: string;

  // Letra del paralelo (clientes anteriores). El formulario actual manda `paraleloId`.
  @IsOptional() @IsString() @MaxLength(10)
  paralelo?: string;

  @IsOptional() @IsInt() @Min(1) @Max(12)
  semestre?: number;

  /**
   * CONSENTIMIENTO INFORMADO. El formulario ya obligaba a marcar la casilla,
   * pero hasta ahora no llegaba al servidor y no quedaba constancia de nada.
   * Es opcional en el DTO para no romper a los clientes que aún no lo envían;
   * solo se registra la fecha cuando llega explícitamente en `true`, de modo
   * que un consentimiento no declarado nunca se dé por otorgado.
   */
  @IsOptional() @IsBoolean()
  aceptaTerminos?: boolean;
}

export class LoginDto {
  // Correo O RU: los estudiantes registrados por el docente entran con su RU.
  // Se conserva el nombre `email` del campo para no romper a los clientes.
  @IsString() @MinLength(3, { message: 'Escribe tu RU o tu correo' }) @MaxLength(120)
  email!: string;

  @IsString() @MinLength(1)
  password!: string;

  /**
   * "Recordarme": SOLO alarga la vida del refresh token en el backend (30 días
   * frente a 1). Nunca implica guardar correo ni contraseña en el navegador.
   */
  @IsOptional() @IsBoolean()
  recordarme?: boolean;
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

/** Preferencias de audio del usuario (ambas opcionales: se actualiza lo enviado). */
export class PreferenciasAudioDto {
  @IsOptional() @IsBoolean()
  sonidosActivados?: boolean;

  @IsOptional() @IsBoolean()
  vozAutomatica?: boolean;
}

/** Primer ingreso con contraseña temporal (ver AuthService.primerIngreso). */
export class PrimerIngresoDto {
  @IsString() @MaxLength(100) @Matches(PASSWORD_REGEX, { message: PASSWORD_MENSAJE })
  nueva!: string;

  @IsOptional() @IsBoolean()
  aceptaTerminos?: boolean;
}

export class PasswordDto {
  @IsString() @MinLength(1)
  actual!: string;

  @IsString() @MaxLength(100) @Matches(PASSWORD_REGEX, { message: PASSWORD_MENSAJE })
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

  @IsString() @MaxLength(100) @Matches(PASSWORD_REGEX, { message: PASSWORD_MENSAJE })
  nueva!: string;
}
