import { makeDocx, makePdf } from '../../testing/fixtures';
import { detectFormat } from './detect-format';

const enc = (s: string) => new TextEncoder().encode(s);
const PNG_HEADER = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
]);

test('detects formats', async () => {
  expect(await detectFormat(await makePdf([['Art. 1º']]), 'a.pdf')).toBe('pdf');
  expect(await detectFormat(await makeDocx(['Art. 1º']), 'a.docx')).toBe('docx');
  expect(await detectFormat(enc('<html><body><p>Art. 1º</p></body></html>'), 'a.html')).toBe('html');
  expect(await detectFormat(enc('Art. 1º Fica instituído'), 'a.txt')).toBe('txt');
  await expect(detectFormat(PNG_HEADER, 'a.png')).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE' });
});

test('detects by content, not by extension', async () => {
  expect(await detectFormat(await makePdf([['x']]), 'renamed.txt')).toBe('pdf');
  expect(await detectFormat(enc('<!DOCTYPE html><title>x</title>'), 'page.txt')).toBe('html');
});

test('invalid utf-8 that is not a known binary is unsupported', async () =>
  await expect(detectFormat(new Uint8Array([0xff, 0xfe, 0xfd, 0x00, 0xc3]), 'x.bin')).rejects.toMatchObject({
    code: 'UNSUPPORTED_FILE',
  }));
