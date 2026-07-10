import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class GamificacionService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Resumen del dashboard (stat cards + desempeño por categoría) ──
  async resumen(usuarioId: number) {
    const [rk, total, completados, intentos] = await Promise.all([
      this.prisma.ranking.findUnique({ where: { usuarioId } }),
      this.prisma.ejercicio.count({ where: { banco: 'practica', activo: true } }),
      this.prisma.intento.findMany({ where: { usuarioId, correcto: true }, distinct: ['ejercicioId'], select: { ejercicioId: true } }),
      this.prisma.intento.findMany({ where: { usuarioId }, select: { correcto: true, ejercicio: { select: { categoria: true } } } }),
    ]);

    const porCat = new Map<string, { ok: number; total: number }>();
    for (const i of intentos) {
      const c = i.ejercicio.categoria;
      const e = porCat.get(c) ?? { ok: 0, total: 0 };
      e.total++; if (i.correcto) e.ok++;
      porCat.set(c, e);
    }

    return {
      puntos: rk?.xpTotal ?? 0,
      posicion: rk?.posicion ?? null,
      racha_dias: rk?.rachaDias ?? 0,
      ejercicios: { completados: completados.length, total },
      desempeno_categorias: [...porCat.entries()].map(([categoria, v]) => ({
        categoria, porcentaje: v.total ? Math.round((v.ok / v.total) * 100) : 0,
      })).sort((a, b) => a.categoria.localeCompare(b.categoria)),
    };
  }

  // ── Logros (desbloqueados a color, resto bloqueados con su condición) ──
  async logros(usuarioId: number) {
    const todos = await this.prisma.logro.findMany({
      orderBy: { id: 'asc' },
      include: { usuarios: { where: { usuarioId } } },
    });
    return todos.map((l) => ({
      id: l.id, clave: l.clave, nombre: l.nombre, condicion: l.condicion, icono: l.icono,
      obtenido: l.usuarios.length > 0,
      fecha_obtenido: l.usuarios[0]?.fechaObtenido ?? null,
    }));
  }

  // ── Recomendados: 3 ejercicios reales del nivel actual no resueltos ──
  async recomendados(usuarioId: number) {
    // Nivel actual = el más bajo desbloqueado que aún NO está completo.
    const niveles = await this.prisma.nivel.findMany({
      orderBy: { numero: 'asc' },
      include: { progreso: { where: { usuarioId } } },
    });
    const desbloqueados = niveles.filter((n) => n.progreso[0]?.desbloqueado || n.numero === 1);
    const nivel =
      desbloqueados.find((n) => (n.progreso[0]?.ejerciciosCompletados ?? 0) < n.umbral) ??
      desbloqueados[desbloqueados.length - 1] ??
      null;
    const resueltos = await this.prisma.intento.findMany({
      where: { usuarioId, correcto: true }, distinct: ['ejercicioId'], select: { ejercicioId: true },
    });
    const ids = resueltos.map((r) => r.ejercicioId);
    return this.prisma.ejercicio.findMany({
      where: { banco: 'practica', activo: true, ...(nivel ? { nivelId: nivel.id } : {}), id: { notIn: ids.length ? ids : [0] } },
      orderBy: [{ estrellas: 'asc' }, { id: 'asc' }],
      take: 3,
      select: { id: true, titulo: true, categoria: true, estrellas: true, xp: true, enunciado: true },
    });
  }

  // ── Actividad semanal (intentos por día) ──
  async actividad(usuarioId: number) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dias: { dia: string; intentos: number; aciertos: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoy); d.setDate(hoy.getDate() - i);
      const sig = new Date(d); sig.setDate(d.getDate() + 1);
      const [intentos, aciertos] = await Promise.all([
        this.prisma.intento.count({ where: { usuarioId, fecha: { gte: d, lt: sig } } }),
        this.prisma.intento.count({ where: { usuarioId, correcto: true, fecha: { gte: d, lt: sig } } }),
      ]);
      dias.push({ dia: d.toISOString().slice(0, 10), intentos, aciertos });
    }
    return dias;
  }
}
