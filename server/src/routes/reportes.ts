import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import * as reportes from '../services/reportService';
import { estudiantesAExcel, estudiantesAPdf } from '../services/exportService';

export const reportesRouter = Router();

// Solo docente/admin.
reportesRouter.use(requireAuth, requireRole('docente', 'admin'));

// ── Reportes en JSON ────────────────────────────────────────
reportesRouter.get(
  '/estudiantes',
  asyncHandler(async (_req, res) => {
    res.json({ estudiantes: await reportes.reporteEstudiantes() });
  }),
);

reportesRouter.get(
  '/categorias',
  asyncHandler(async (_req, res) => {
    res.json({ categorias: await reportes.reporteCategorias() });
  }),
);

reportesRouter.get(
  '/ganancia',
  asyncHandler(async (_req, res) => {
    res.json({ ganancia: await reportes.reporteGanancia() });
  }),
);

// ── Exportación Excel ───────────────────────────────────────
reportesRouter.get(
  '/estudiantes/export/excel',
  asyncHandler(async (_req, res) => {
    const buffer = await estudiantesAExcel(await reportes.reporteEstudiantes());
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="prexi_estudiantes.xlsx"');
    res.send(buffer);
  }),
);

// ── Exportación PDF ─────────────────────────────────────────
reportesRouter.get(
  '/estudiantes/export/pdf',
  asyncHandler(async (_req, res) => {
    const buffer = await estudiantesAPdf(await reportes.reporteEstudiantes());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="prexi_estudiantes.pdf"');
    res.send(buffer);
  }),
);
