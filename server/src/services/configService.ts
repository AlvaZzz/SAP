import { queryOne, query } from '../config/db';

export interface ConfiguracionSistema {
  xp_por_ejercicio: number;
  umbral_nivel: number;
  max_pistas_ia: number;
  modelo_ia: string;
}

const DEFAULTS: ConfiguracionSistema = {
  xp_por_ejercicio: 50,
  umbral_nivel: 8,
  max_pistas_ia: 3,
  modelo_ia: 'gemini-2.0-flash',
};

export async function getConfig(): Promise<ConfiguracionSistema> {
  const row = await queryOne<ConfiguracionSistema>(
    `SELECT xp_por_ejercicio, umbral_nivel, max_pistas_ia, modelo_ia
       FROM configuracion_sistema WHERE id = 1`,
  );
  return row ?? DEFAULTS;
}

export async function updateConfig(
  patch: Partial<ConfiguracionSistema>,
): Promise<ConfiguracionSistema> {
  const current = await getConfig();
  const next = { ...current, ...patch };
  await query(
    `INSERT INTO configuracion_sistema (id, xp_por_ejercicio, umbral_nivel, max_pistas_ia, modelo_ia)
     VALUES (1, $1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       xp_por_ejercicio = EXCLUDED.xp_por_ejercicio,
       umbral_nivel     = EXCLUDED.umbral_nivel,
       max_pistas_ia    = EXCLUDED.max_pistas_ia,
       modelo_ia        = EXCLUDED.modelo_ia`,
    [next.xp_por_ejercicio, next.umbral_nivel, next.max_pistas_ia, next.modelo_ia],
  );
  return next;
}
