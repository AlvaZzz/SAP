import { IntroduccionService } from './introduccion.service';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';

describe('IntroduccionService (fase previa al diagnóstico)', () => {
  let prisma: PrismaMock;
  let service: IntroduccionService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new IntroduccionService(prisma as never);
  });

  it('lista las unidades con su introducción, ordenadas', async () => {
    prisma.unidad.findMany.mockResolvedValue([
      { id: 1, numero: 1, titulo: 'Fundamentos', descripcion: null, introduccion: '## Objetivos' },
    ]);
    const u = await service.unidades();
    expect(u).toHaveLength(1);
    expect(u[0].introduccion).toContain('Objetivos');
    expect(prisma.unidad.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ orden: 'asc' }, { numero: 'asc' }] }),
    );
  });

  it('estado devuelve completada=false si el usuario no la revisó', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ introduccionCompletada: false });
    expect(await service.estado(7)).toEqual({ completada: false });
  });

  it('completar marca introduccionCompletada=true (habilita el diagnóstico)', async () => {
    prisma.usuario.update.mockResolvedValue({});
    const r = await service.completar(7);
    expect(r).toEqual({ completada: true });
    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 7 }, data: { introduccionCompletada: true } }),
    );
  });
});
