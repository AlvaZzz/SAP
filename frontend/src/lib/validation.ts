import { z } from 'zod';

/**
 * Validación del módulo de autenticación (login).
 *
 * SE ACEPTA CUALQUIER CORREO VÁLIDO (Gmail, Outlook…), no solo el institucional:
 * el correo es el canal de contacto con la persona, y debe poder ser el que ya
 * usa. Así queda alineado con el backend (`RegisterDto` no restringe dominio) y
 * con la pantalla de registro, que nunca lo exigió — el login era el único
 * desincronizado. NO reintroducir aquí una restricción de dominio.
 */
export const loginSchema = z.object({
  // RU (solo dígitos) o correo. Los estudiantes que registró el docente entran
  // con su RU; el campo conserva el nombre `email` porque así lo espera el API.
  email: z
    .string()
    .trim()
    .min(1, 'Ingresa tu RU o tu correo electrónico.')
    .refine(
      (v) => /^\d{4,12}$/.test(v) || z.string().email().safeParse(v).success,
      'Escribe tu RU (solo números) o un correo válido.',
    ),
  // Mínimo 5: la contraseña inicial de un estudiante registrado es su CI.
  password: z.string().min(5, 'La contraseña debe tener al menos 5 caracteres.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type LoginErrores = Partial<Record<keyof LoginInput, string>>;

/** Valida sin lanzar y devuelve el primer error por campo (para mostrarlo bajo el input). */
export function validarLogin(data: LoginInput): LoginErrores {
  const r = loginSchema.safeParse(data);
  if (r.success) return {};
  const errs: LoginErrores = {};
  for (const issue of r.error.issues) {
    const k = issue.path[0] as keyof LoginInput;
    if (!errs[k]) errs[k] = issue.message;
  }
  return errs;
}
