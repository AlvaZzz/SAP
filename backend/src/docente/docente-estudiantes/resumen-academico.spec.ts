import { motivosDeRiesgo, nivelGlobal, promedioGeneral, situacionPromedio } from './resumen-academico';

const UMB = { diasInactivo: 7, tasaAciertoMin: 40, minIntentos: 4, diasEstancado: 14 };
const AHORA = new Date('2026-10-20T12:00:00Z').getTime();
const hace = (dias: number) => new Date(AHORA - dias * 86_400_000);

describe('resumen académico del estudiante', () => {
  describe('nivel actual', () => {
    it('sin práctica vale el nivel del diagnóstico; sin diagnóstico, Básico', () => {
      expect(nivelGlobal([], 'avanzado')).toBe('avanzado');
      expect(nivelGlobal([], null)).toBe('basico');
    });

    it('con práctica resume sus niveles por tema', () => {
      expect(nivelGlobal(['intermedio', 'intermedio'], 'basico')).toBe('intermedio');
      expect(nivelGlobal(['avanzado', 'avanzado', 'avanzado'], 'basico')).toBe('avanzado');
      expect(nivelGlobal(['basico', 'basico', 'intermedio'], 'avanzado')).toBe('basico');
    });
  });

  describe('promedio general sobre 100', () => {
    it('sin evaluaciones es null, no cero', () => {
      expect(promedioGeneral([], [])).toBeNull();
      expect(situacionPromedio(null)).toBe('sin_evaluaciones');
    });

    it('cuenta el MEJOR intento de cada evaluación', () => {
      // Unidad 1: 60 y luego 90 → 90. Tema 4 a intermedio: 80. Media = 85.
      const p = promedioGeneral(
        [{ unidadId: 1, puntaje: 60 }, { unidadId: 1, puntaje: 90 }],
        [{ temaId: 4, hacia: 'intermedio', puntaje: 80 }],
      );
      expect(p).toBe(85);
    });

    it('80 aprueba; 78 queda "cerca del umbral"; 65 queda bajo', () => {
      expect(situacionPromedio(80)).toBe('aprobado');
      expect(situacionPromedio(78)).toBe('cerca');
      expect(situacionPromedio(70)).toBe('cerca');
      expect(situacionPromedio(65)).toBe('bajo');
    });
  });

  describe('motivos de atención', () => {
    const base = {
      tieneDiagnostico: true, ultimaActividad: hace(1), intentos: 20, tasaAcierto: 75,
      ultimoCambioNivel: hace(2), creadoEn: hace(30), yaIngreso: true,
    };

    it('un estudiante que trabaja y acierta no tiene motivos', () => {
      expect(motivosDeRiesgo(base, UMB, AHORA)).toEqual([]);
    });

    it('quien nunca entró solo muestra ese motivo', () => {
      const m = motivosDeRiesgo({ ...base, yaIngreso: false, tieneDiagnostico: false, ultimaActividad: null, intentos: 0, tasaAcierto: null }, UMB, AHORA);
      expect(m.map((x) => x.clave)).toEqual(['nunca_entro']);
    });

    it('acumula inactividad y acierto bajo cuando concurren', () => {
      const m = motivosDeRiesgo({ ...base, ultimaActividad: hace(20), tasaAcierto: 25 }, UMB, AHORA);
      expect(m.map((x) => x.clave)).toEqual(['inactivo', 'acierto_bajo']);
      expect(m[0].gravedad).toBe('alta'); // más del doble del umbral
    });

    it('no juzga el acierto con muy pocos intentos', () => {
      expect(motivosDeRiesgo({ ...base, intentos: 2, tasaAcierto: 0 }, UMB, AHORA)).toEqual([]);
    });
  });
});
