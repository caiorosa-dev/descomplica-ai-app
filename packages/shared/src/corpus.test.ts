import { parseCorpusManifest } from './corpus';

const entry = {
  key: 'stj-resp-1969219-sp',
  file: 'stj/resp-1969219-sp.pdf',
  issuer: 'STJ',
  title: 'REsp 1.969.219-SP',
  expectedType: 'court_decision',
  expectedSubtype: null,
  version: 'original',
  officialUrl: 'https://scon.stj.jus.br/x',
  sha256: 'a'.repeat(64),
  retrievedAt: '2026-10-18',
};

test('parses a manifest', () => expect(parseCorpusManifest([entry])).toEqual([entry]));

test('rejects duplicated keys', () => expect(() => parseCorpusManifest([entry, entry])).toThrow(/duplicad/));

test('rejects an invalid sha256 and a file outside stj/ or cnj/', () => {
  expect(() => parseCorpusManifest([{ ...entry, sha256: 'xyz' }])).toThrow();
  expect(() => parseCorpusManifest([{ ...entry, file: '../etc/passwd' }])).toThrow();
});
