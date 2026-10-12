import { BadRequestException } from '@nestjs/common';
import { DocentePreguntasIaService } from './docente-preguntas-ia.service';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TutorIaService } from '../../tutor-ia/tutor-ia.service';

const propuesta = (temas?: string[]) => ({
  categoria: 'General', enunciado: '¿Qué imprime?', codigoPython: null,
  opciones: [{ id: 'A', texto: '1' }, { id: 'B', texto: '2' }], respuestaCorrecta: 'A', explicacionIa: '', temas,
});

describe('DocentePreguntasIaService · generación', () => {
  let prisma: PrismaMock;
  let generarPreguntas: jest.Mock;
  let service: DocentePreguntasIaService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    prisma.preguntaGenerada.createManyAndReturn = jest.fn(({ data }: { data: unknown[] }) => Promise.resolve(data));
    generarPreguntas = jest.fn();
    service = new DocentePreguntasIaService(prisma as unknown as PrismaService, { generarPreguntas } as unknown as TutorIaService);
  });

  describe('examen de la unidad', () => {
    const TEMAS = [
      { id: 11, numero: '1.1', titulo: 'Algoritmos' },
      { id: 12, numero: '1.2', titulo: 'Variables' },
      { id: 13, numero: '1.3', titulo: 'Operadores' },
      { id: 14, numero: '1.4', titulo: 'Expresiones' },
    ];

    it('pide 10 preguntas de nivel intermedio con los temas de la unidad para combinar', async () => {
      prisma.tema.findMany.mockResolvedValue(TEMAS);
      generarPreguntas.mockResolvedValue([propuesta(['1.1', '1.2'])]);
      await service.generar(7, { unidadId: 1 });
      expect(generarPreguntas).toHaveBeenCalledWith(null, 10, 'opcion_multiple', {
        nivel: 'intermedio',
        integrar: TEMAS.map((t) => ({ numero: t.numero, titulo: t.titulo })),
      });
    });

    it('guarda cada borrador en el banco de examen con los 2 o 3 temas que combina', async () => {
      prisma.tema.findMany.mockResolvedValue(TEMAS);
      generarPreguntas.mockResolvedValue([
        propuesta(['1.2', '1.3']),
        propuesta(['1.1', '1.2', '1.3', '1.4']), // más de tres: se recorta
      ]);
      const r = await service.generar(7, { unidadId: 1 });
      const [a, b] = r.preguntas as unknown as { banco: string; nivelDificultad: string; temasIntegrados: number[]; temaId: number }[];
      expect(a).toMatchObject({ banco: 'examen', nivelDificultad: 'intermedio', temasIntegrados: [12, 13], temaId: 12 });
      expect(b.temasIntegrados).toEqual([11, 12, 13]);
    });

    it('si PREXI no declara al menos dos temas válidos, asigna dos para que el docente los revise', async () => {
      prisma.tema.findMany.mockResolvedValue(TEMAS);
      generarPreguntas.mockResolvedValue([propuesta(), propuesta(['9.9']), propuesta(['1.4'])]);
      const r = await service.generar(7, { unidadId: 1 });
      for (const p of r.preguntas as unknown as { temasIntegrados: number[] }[]) {
        expect(p.temasIntegrados).toHaveLength(2);
        expect(new Set(p.temasIntegrados).size).toBe(2);
      }
    });

    it('rechaza una unidad con un solo tema: no hay qué combinar', async () => {
      prisma.tema.findMany.mockResolvedValue([TEMAS[0]]);
      await expect(service.generar(7, { unidadId: 1 })).rejects.toBeInstanceOf(BadRequestException);
      expect(generarPreguntas).not.toHaveBeenCalled();
    });
  });

  describe('práctica de un tema', () => {
    it('genera para el nivel pedido y deja los borradores en práctica', async () => {
      prisma.tema.findUnique.mockResolvedValue({ id: 12, numero: '1.2', titulo: 'Variables', descripcion: null, unidad: { titulo: 'Fundamentos' } });
      generarPreguntas.mockResolvedValue([propuesta()]);
      const r = await service.generar(7, { temaId: 12, nivel: 'avanzado', texto: '  apuntes de clase  ' });
      expect(generarPreguntas).toHaveBeenCalledWith('apuntes de clase', 10, 'opcion_multiple', expect.objectContaining({ nivel: 'avanzado' }));
      expect(r.preguntas[0]).toMatchObject({ banco: 'practica', nivelDificultad: 'avanzado', temaId: 12 });
    });

    it('exige indicar tema o unidad', async () => {
      await expect(service.generar(7, {})).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('aprobación', () => {
    it('no publica una pregunta de examen que combine menos de dos temas', async () => {
      prisma.preguntaGenerada.findUnique.mockResolvedValue({ id: 1, autorId: 7, estado: 'borrador', banco: 'examen', nivelDificultad: 'intermedio', temasIntegrados: [11] });
      prisma.nivel.findFirst.mockResolvedValue({ id: 1 });
      await expect(service.aprobar(1, 7, {})).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.ejercicio.create).not.toHaveBeenCalled();
    });
  });
});
