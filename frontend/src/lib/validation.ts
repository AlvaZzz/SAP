import { z } from 'zod';

/**
 * Validación del módulo de autenticación (login).
 * Mantiene el CONTRATO real de PREXI: correo institucional @upea.edu.bo y
 * contraseña de mínimo 6 caracteres (lo que exige el backend NestJS).
 */
export const DOMINIO_INSTITUCIONAL = '@upea.edu.bo';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Ingresa tu correo institucional.')
    .email('Formato de correo inválido.')
    .refine((v) => v.toLowerCase().endsWith(DOMINIO_INSTITUCIONAL), `Usa tu correo institucional (${DOMINIO_INSTITUCIONAL}).`),
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
