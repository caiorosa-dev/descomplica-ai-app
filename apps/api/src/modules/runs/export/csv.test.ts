import { toCsv } from './csv';

test('toCsv quotes commas, quotes and newlines', () =>
  expect(toCsv([{ a: 'x,"y"\nz', b: 1 }], ['a', 'b'])).toBe('﻿a,b\r\n"x,""y""\nz",1\r\n'));

test('toCsv renders null and booleans and keeps column order', () =>
  expect(toCsv([{ b: true, a: null }], ['a', 'b'])).toBe('﻿a,b\r\n,true\r\n'));

test('toCsv with no rows still has the header', () => expect(toCsv([], ['x'])).toBe('﻿x\r\n'));
