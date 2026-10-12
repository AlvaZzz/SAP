import { BadRequestException } from '@nestjs/common';
import { DocenteFlashcardsService } from './docente-flashcards.service';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TutorIaService } from '../../tutor-ia/tutor-ia.service';

const ejercicio = (id: number) => ({
  id, tipo: 'opcion_multiple', enunciado: `Pregunta ${id}`, codigoPython: null, explicacionIa: 'Explicación del ejercicio',
  opciones: [{ id: 'A', texto: 'mal' }, { id: 'B', texto: `bien ${id}` }], respuestaCorrecta: 'B', nivelDificultad: 'intermedio',
});

describe('DocenteFlashcardsService · generar desde los ejercicios', () => {
  let prisma: PrismaMock;
  let generarFlashcards: jest.Mock;
  let service: DocenteFlashcardsService;
  const creadas = () => (prisma.flashcard.createMany.mock.calls[0][0] as { data: Record<string, unknown>[] }).data;

  beforeEach(() => {
    prisma = crearPrismaMock();
    generarFlashcards = jest.fn();
    service = new DocenteFlashcardsService(prisma as unknown as PrismaService, { generarFlashcards } as unknown as TutorIaService);
    prisma.tema.findUnique.mockResolvedValue({ id: 5, numero: '1.2', titulo: 'Variables' });
  });

  it('crea una tarjeta por ejercicio que aún no tiene la suya', async () => {
    prisma.ejercicio.findMany.mockResolvedValue([ejercicio(1), ejercicio(2), ejercicio(3)]);
    prisma.flashcard.findMany.mockResolvedValue([{ ejercicioId: 2 }]);
    generarFlashcards.mockResolvedValue(new Map());
    const r = await service.generar(5);
    expect(r.creadas).toBe(2);
    expect(creadas().map((c) => c.ejercicioId)).toEqual([1, 3]);
  });

  it('si PREXI falla, arma la tarjeta con el enunciado y la respuesta del ejercicio', async () => {
    prisma.ejercicio.findMany.mockResolvedValue([ejercicio(1)]);
    generarFlashcards.mockRejectedValue(new Error('La IA no está configurada'));
    const r = await service.generar(5);
    expect(r.con_ia).toBe(false);
    expect(creadas()[0]).toMatchObject({ frente: 'Pregunta 1', reverso: 'bien 1', nivelDificultad: 'intermedio', temaId: 5 });
  });

  it('PREXI redacta el frente, pero el reverso lo fija siempre el ejercicio', async () => {
    prisma.ejercicio.findMany.mockResolvedValue([ejercicio(1)]);
    generarFlashcards.mockResolvedValue(new Map([[1, { frente: '¿Cuál es la correcta?', reverso: 'respuesta inventada', explicacion: 'Truco para recordar' }]]));
    const r = await service.generar(5);
    expect(r.con_ia).toBe(true);
    expect(creadas()[0]).toMatchObject({ frente: '¿Cuál es la correcta?', reverso: 'bien 1', explicacion: 'Truco para recordar' });
  });

  it('avisa si el tema no tiene ejercicios que sirvan para tarjetas', async () => {
    prisma.ejercicio.findMany.mockResolvedValue([]);
    await expect(service.generar(5)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('no duplica: si todos tienen tarjeta, no crea nada', async () => {
    prisma.ejercicio.findMany.mockResolvedValue([ejercicio(1)]);
    prisma.flashcard.findMany.mockResolvedValue([{ ejercicioId: 1 }]);
    const r = await service.generar(5);
    expect(r.creadas).toBe(0);
    expect(prisma.flashcard.createMany).not.toHaveBeenCalled();
  });
});
