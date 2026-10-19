import { type Preset, Prisma, type PrismaClient } from '@app/db';
import { type PipelineConfig, type PresetDto, parsePipelineConfig } from '@app/shared';
import { HttpError, notFound } from '../../http-error';

export function toPresetDto(row: Preset): PresetDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    config: parsePipelineConfig(row.config),
    isBuiltin: row.isBuiltin,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const slugTaken = (slug: string) =>
  new HttpError(400, 'VALIDATION_ERROR', 'Os dados enviados são inválidos.', {
    issues: [{ path: ['slug'], message: `Já existe um preset com o slug "${slug}".`, code: 'custom' }],
  });

export function createPresetsService(prisma: PrismaClient) {
  const getRow = async (id: string) => {
    const row = await prisma.preset.findUnique({ where: { id } });
    if (!row) throw notFound('Preset');
    return row;
  };
  const writable = async (id: string) => {
    const row = await getRow(id);
    if (row.isBuiltin)
      throw new HttpError(409, 'PRESET_READ_ONLY', 'Presets padrão são somente leitura; duplique para alterar.');
    return row;
  };
  return {
    async list() {
      const rows = await prisma.preset.findMany({ orderBy: [{ isBuiltin: 'desc' }, { createdAt: 'asc' }] });
      return rows.map(toPresetDto);
    },
    get: async (id: string) => toPresetDto(await getRow(id)),
    async create(body: { slug: string; name: string; description: string; config: PipelineConfig }) {
      try {
        return toPresetDto(await prisma.preset.create({ data: { ...body, isBuiltin: false } }));
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw slugTaken(body.slug);
        throw e;
      }
    },
    async update(id: string, body: { name?: string; description?: string; config?: PipelineConfig }) {
      await writable(id);
      return toPresetDto(await prisma.preset.update({ where: { id }, data: body }));
    },
    async remove(id: string) {
      await writable(id);
      await prisma.preset.delete({ where: { id } });
    },
    async duplicate(id: string) {
      const source = await getRow(id);
      const base = `${source.slug}-copy`;
      const taken = new Set(
        (await prisma.preset.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map(
          (p) => p.slug,
        ),
      );
      let slug = base;
      for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
      const row = await prisma.preset.create({
        data: {
          slug,
          name: `${source.name} (cópia)`,
          description: source.description,
          config: source.config as Prisma.InputJsonValue,
          isBuiltin: false,
        },
      });
      return toPresetDto(row);
    },
  };
}
