import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseCorpusManifest } from '@app/shared';
import { createTestContext } from '../../testing/context';
import { BOILERPLATE_PATTERN_SETS } from './cleaning/patterns';
import { textExtractionStage } from './stage';

const CORPUS_DIR = resolve(import.meta.dirname, '../../../../../corpus');
const manifest = parseCorpusManifest(JSON.parse(readFileSync(join(CORPUS_DIR, 'manifest.json'), 'utf8')));

test('manifest lists the 20 corpus documents', () => expect(manifest).toHaveLength(20));

test.each(manifest)('stage 1 snapshot: $key', async (e) => {
  const out = await textExtractionStage.run(
    { buffer: readFileSync(join(CORPUS_DIR, e.file)), filename: e.file },
    createTestContext(),
  );
  expect(out.canonicalText).toMatchSnapshot();
  for (const set of Object.values(BOILERPLATE_PATTERN_SETS))
    for (const re of set) expect(out.canonicalText.split('\n').filter((l) => re.test(l))).toEqual([]);
  if (e.issuer === 'STJ') {
    // Some STJ PDFs carry the letterhead as an image and the stamp on one page only: any page furniture counts.
    const furniture = out.cleaningReport.removedByRule.filter(
      (r) => r.rule === 'repeated_edge' || r.rule === 'boilerplate:stj-e-signature',
    );
    expect(furniture.reduce((n, r) => n + r.count, 0)).toBeGreaterThan(0);
  }
});
