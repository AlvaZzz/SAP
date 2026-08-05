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
  email: z
    .string()
    .min(1, 'Ingresa tu correo electrónico.')
    .email('Escribe un correo válido, por ejemplo tucorreo@ejemplo.com.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
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
