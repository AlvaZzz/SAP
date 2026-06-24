import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';

import { authRouter } from './routes/auth';
import { ejerciciosRouter } from './routes/ejercicios';
import { nivelesRouter } from './routes/niveles';
import { intentosRouter } from './routes/intentos';
import { pretestRouter } from './routes/pretest';
import { aiRouter } from './routes/ai';
import { diagnosticoRouter } from './routes/diagnostico';
import { rankingRouter } from './routes/ranking';
import { dashboardRouter } from './routes/dashboard';
import { reportesRouter } from './routes/reportes';
import { adminRouter } from './routes/admin';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, servicio: 'PREXI UPEA API' }));

  // Sprint 1
  app.use('/api/auth', authRouter);
  app.use('/api/ejercicios', ejerciciosRouter);
  app.use('/api/niveles', nivelesRouter);
  // Sprint 2
  app.use('/api/intentos', intentosRouter);
  app.use('/api/pretest', pretestRouter);
  // Sprint 3
  app.use('/api/ai', aiRouter);
  app.use('/api/diagnostico', diagnosticoRouter);
  // Sprint 4
  app.use('/api/ranking', rankingRouter);
  app.use('/api/dashboard', dashboardRouter);
  // Sprint 5
  app.use('/api/reportes', reportesRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
