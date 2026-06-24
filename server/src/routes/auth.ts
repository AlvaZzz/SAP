import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { query, queryOne } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, unauthorized } from '../utils/httpError';
import { requireAuth } from '../middleware/auth';
import { JwtPayload, Rol } from '../types';

export const authRouter = Router();

const registerSchema = z.object({
  nombre: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  carrera: z.string().max(120).optional(),
  // El registro público siempre crea estudiantes; roles elevados los crea un admin.
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
  password_hash: string;
}

function firmarToken(u: { id: number; rol: Rol; nombre: string }): string {
  const payload: JwtPayload = { sub: u.id, rol: u.rol, nombre: u.nombre };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);

    const existe = await queryOne(`SELECT 1 FROM usuarios WHERE email = $1`, [data.email]);
    if (existe) throw badRequest('Ya existe un usuario con ese email');

    const hash = await bcrypt.hash(data.password, 10);
    const rows = await query<UsuarioRow>(
      `INSERT INTO usuarios (nombre, email, rol, carrera, password_hash)
       VALUES ($1, $2, 'estudiante', $3, $4)
       RETURNING id, nombre, email, rol, carrera, diagnostico_completado`,
      [data.nombre, data.email, data.carrera ?? null, hash],
    );
    const u = rows[0];

    // Inicializa fila de ranking para el nuevo estudiante.
    await query(`INSERT INTO ranking (usuario_id, xp_total, racha_dias) VALUES ($1, 0, 0)`, [u.id]);

    res.status(201).json({ token: firmarToken(u), usuario: u });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const u = await queryOne<UsuarioRow>(
      `SELECT id, nombre, email, rol, carrera, diagnostico_completado, password_hash FROM usuarios WHERE email = $1`,
      [data.email],
    );
    if (!u) throw unauthorized('Credenciales inválidas');

    const ok = await bcrypt.compare(data.password, u.password_hash);
    if (!ok) throw unauthorized('Credenciales inválidas');

    const { password_hash, ...usuario } = u;
    res.json({ token: firmarToken(u), usuario });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const u = await queryOne(
      `SELECT id, nombre, email, rol, carrera, diagnostico_completado FROM usuarios WHERE id = $1`,
      [req.user!.sub],
    );
    if (!u) throw unauthorized();
    res.json({ usuario: u });
  }),
);
