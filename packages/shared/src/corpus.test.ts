import { parseCorpusManifest } from './corpus';

const entry = {
  key: 'stj-resp-1969219-sp',
  file: 'stj/resp-1969219-sp.pdf',
  issuer: 'STJ',
  title: 'REsp 1.969.219/SP',
  expectedType: 'court_decision',
  expectedSubtype: null,
  version: 'original',
};

test('parses a manifest without hashes or bookkeeping fields', () =>
  expect(parseCorpusManifest([entry])).toEqual([entry]));

test('rejects duplicated keys', () => expect(() => parseCorpusManifest([entry, entry])).toThrow(/duplicad/));

test('rejects a file outside stj/ or cnj/', () =>
  expect(() => parseCorpusManifest([{ ...entry, file: '../etc/passwd' }])).toThrow());
