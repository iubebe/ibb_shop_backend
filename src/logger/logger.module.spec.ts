import type { IncomingMessage, ServerResponse } from 'node:http';
import { genTraceId, TRACE_ID_HEADER } from './logger.module.js';

function call(header?: string | string[]) {
  const setHeader = vi.fn();
  const req = {
    headers: { [TRACE_ID_HEADER]: header },
  } as unknown as IncomingMessage;
  const id = genTraceId(req, { setHeader } as unknown as ServerResponse);
  return { id, setHeader };
}

describe('genTraceId', () => {
  it('reuses a valid incoming trace id and echoes it back', () => {
    const { id, setHeader } = call('abc-12345678');
    expect(id).toBe('abc-12345678');
    expect(setHeader).toHaveBeenCalledWith(TRACE_ID_HEADER, 'abc-12345678');
  });

  it('generates a uuid when the header is missing', () => {
    const { id, setHeader } = call();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith(TRACE_ID_HEADER, id);
  });

  it.each(['short', 'has spaces in it!', 'x'.repeat(65), ['a', 'b']])(
    'rejects an invalid incoming id (%j)',
    (bad) => {
      const { id } = call(bad);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    },
  );
});
