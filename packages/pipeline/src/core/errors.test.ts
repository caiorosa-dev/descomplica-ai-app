import { isPipelineError, PipelineError, USER_MESSAGES } from './errors';

test('user message in pt-BR', () =>
  expect(new PipelineError('LOW_TEXT_DENSITY', 'x').userMessage).toMatch(/escaneado/));

test('keeps code, log message and details', () => {
  const e = new PipelineError('FILE_TOO_LARGE', 'file is 30 MB', { sizeMb: 30 });
  expect(e).toBeInstanceOf(Error);
  expect(e).toMatchObject({ code: 'FILE_TOO_LARGE', message: 'file is 30 MB', details: { sizeMb: 30 } });
  expect(e.userMessage).toBe(USER_MESSAGES.FILE_TOO_LARGE);
});

test('isPipelineError', () => {
  expect(isPipelineError(new PipelineError('CANCELLED', 'x'))).toBe(true);
  expect(isPipelineError(new Error('x'))).toBe(false);
  expect(isPipelineError({ code: 'CANCELLED' })).toBe(false);
});
