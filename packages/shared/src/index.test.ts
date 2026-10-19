import { SHARED_PACKAGE } from './index';

test('exports package marker', () => expect(SHARED_PACKAGE).toBe('@app/shared'));
