import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env, isProd } from '../config/env';
import { query, queryOne } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, unauthorized, HttpError } from '../utils/httpError';
import { requireAuth } from '../middleware/auth';
import { AUTH_COOKIE } from '../utils/cookies';
import { JwtPayload, Rol } from '../types';

export const authRouter = Router();

const DOMINIO = '@upea.edu.bo';
const MAX_FALLIDOS = 5;
const BLOQUEO_MIN = 15;

const emailUpea = z.string().email().refine((e) => e.toLowerCase().endsWith(DOMINIO), {
  message: `El correo debe ser institucional (${DOMINIO})`,
});

const registerSchema = z.object({
  nombre: z.string().min(2).max(120),
  email: emailUpea,
  password: z.string().min(6).max(100),
  cedula: z.string().min(4).max(20),
  carrera: z.string().min(2).max(120),
  // El registro público SIEMPRE crea estudiantes (rol ignorado si llega).
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface UsuarioRow {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  carrera: string | null;
  diagnostico_completado: boolean;
  pretest_completado: boolean;
  nivel_inicial: number;
  failed_login_count: number;
  locked_until: string | null;
  password_hash: string;
}

const CAMPOS_PUBLICOS = `id, nombre, email, rol, carrera, diagnostico_completado, pretest_completado, nivel_inicial`;

function firmarToken(u: { id: number; rol: Rol; nombre: string }): string {
  const payload: JwtPayload = { sub: u.id, rol: u.rol, nombre: u.nombre };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}

/** Coloca el JWT en una cookie httpOnly (no accesible desde JS del cliente). */
function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    path: '/',
  });
}

// ── Registro (solo estudiantes) ─────────────────────────────
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);

    if (await queryOne(`SELECT 1 FROM usuarios WHERE email = $1`, [data.email]))
      throw badRequest('Ya existe un usuario con ese correo');
    if (await queryOne(`SELECT 1 FROM usuarios WHERE cedula = $1`, [data.cedula]))
      throw badRequest('Ya existe un usuario con esa cédula');

    const hash = await bcrypt.hash(data.password, 10);
    const rows = await query<UsuarioRow>(
      `INSERT INTO usuarios (nombre, email, cedula, rol, carrera, password_hash)
       VALUES ($1, $2, $3, 'estudiante', $4, $5)
       RETURNING ${CAMPOS_PUBLICOS}`,
      [data.nombre, data.email, data.cedula, data.carrera, hash],
    );
    const u = rows[0];
    await query(`INSERT INTO ranking (usuario_id, xp_total, racha_dias) VALUES ($1, 0, 0)`, [u.id]);

    const token = firmarToken(u);
    setAuthCookie(res, token);
    res.status(201).json({ token, usuario: u });
  }),
);

// ── Login (con bloqueo por intentos fallidos) ───────────────
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const u = await queryOne<UsuarioRow>(
      `SELECT ${CAMPOS_PUBLICOS}, failed_login_count, locked_until, password_hash
         FROM usuarios WHERE email = $1`,
      [data.email],
    );

    // Mensaje genérico: nunca revelamos si el correo existe o no.
    const credInvalidas = () => unauthorized('Correo o contraseña incorrectos');

    if (!u) throw credInvalidas();

    // ¿Cuenta bloqueada temporalmente?
    if (u.locked_until && new Date(u.locked_until).getTime() > Date.now()) {
      throw new HttpError(423, `Cuenta bloqueada temporalmente, intenta en ${BLOQUEO_MIN} minutos`);
    }

    const ok = await bcrypt.compare(data.password, u.password_hash);
    if (!ok) {
      const nuevos = u.failed_login_count + 1;
      if (nuevos >= MAX_FALLIDOS) {
        await query(
          `UPDATE usuarios SET failed_login_count = 0, locked_until = now() + ($2 || ' minutes')::interval WHERE id = $1`,
          [u.id, BLOQUEO_MIN],
        );
        throw new HttpError(423, `Cuenta bloqueada temporalmente, intenta en ${BLOQUEO_MIN} minutos`);
      }
      await query(`UPDATE usuarios SET failed_login_count = $2 WHERE id = $1`, [u.id, nuevos]);
      throw credInvalidas();
    }

    // Éxito: limpia el contador de fallos.
    await query(`UPDATE usuarios SET failed_login_count = 0, locked_until = NULL WHERE id = $1`, [u.id]);

    const { password_hash, failed_login_count, locked_until, ...usuario } = u;
    void password_hash; void failed_login_count; void locked_until;
    const token = firmarToken(u);
    setAuthCookie(res, token);
    res.json({ token, usuario });
  }),
);

// ── Cierre de sesión (limpia la cookie) ─────────────────────
authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
  res.json({ ok: true });
});

// ── Usuario actual ──────────────────────────────────────────
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const u = await queryOne(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = $1`, [req.user!.sub]);
    if (!u) throw unauthorized();
    res.json({ usuario: u });
  }),
);

// ── Editar perfil (nombre, carrera) ─────────────────────────
const perfilSchema = z.object({
  nombre: z.string().min(2).max(120),
  carrera: z.string().min(2).max(120),
});
authRouter.put(
  '/perfil',
  requireAuth,
  asyncHandler(async (req, res) => {
    const d = perfilSchema.parse(req.body);
    const rows = await query(
      `UPDATE usuarios SET nombre = $2, carrera = $3 WHERE id = $1 RETURNING ${CAMPOS_PUBLICOS}`,
      [req.user!.sub, d.nombre, d.carrera],
    );
    res.json({ usuario: rows[0] });
  }),
);
