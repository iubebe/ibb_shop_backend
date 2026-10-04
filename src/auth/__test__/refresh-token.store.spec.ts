import { RefreshTokenStore } from '../refresh-token.store.js';
import { authConfig } from './helpers.js';

function setup() {
  const tx = {
    hset: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    sadd: vi.fn().mockReturnThis(),
    del: vi.fn().mockReturnThis(),
    srem: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  };
  const client = {
    multi: vi.fn(() => tx),
    eval: vi.fn(),
    hget: vi.fn(),
    smembers: vi.fn(),
  };
  const store = new RefreshTokenStore({ client } as never, authConfig);
  return { store, client, tx };
}

describe('RefreshTokenStore', () => {
  it('stores only a hash of the secret with the refresh ttl', async () => {
    const { store, tx } = setup();
    const { sessionId, token } = await store.create('u1');
    const [, secret] = token.split('.');
    const stored = tx.hset.mock.calls[0]?.[1] as {
      userId: string;
      hash: string;
    };
    expect(token.startsWith(`${sessionId}.`)).toBe(true);
    expect(stored.userId).toBe('u1');
    expect(stored.hash).not.toContain(secret);
    expect(tx.expire).toHaveBeenCalledWith(
      `auth:session:${sessionId}`,
      authConfig.refreshTtlSeconds,
    );
  });

  it('rotates to a new token on success', async () => {
    const { store, client } = setup();
    client.eval.mockResolvedValue([1, 'u1']);
    const res = await store.rotate('sid.secret');
    expect(res).toMatchObject({ status: 'ok', userId: 'u1', sessionId: 'sid' });
    expect(res.status === 'ok' && res.token).not.toBe('sid.secret');
  });

  it('reports reuse and unknown sessions', async () => {
    const { store, client } = setup();
    client.eval.mockResolvedValueOnce([-1]).mockResolvedValueOnce([0]);
    expect(await store.rotate('sid.old')).toEqual({ status: 'reused' });
    expect(await store.rotate('sid.gone')).toEqual({ status: 'invalid' });
  });

  it('rejects malformed tokens without touching Redis', async () => {
    const { store, client } = setup();
    for (const bad of [undefined, '', 'nodot', 'a.b.c']) {
      expect(await store.rotate(bad)).toEqual({ status: 'invalid' });
    }
    expect(client.eval).not.toHaveBeenCalled();
  });

  it('revokes a session and removes it from the user index', async () => {
    const { store, client, tx } = setup();
    client.hget.mockResolvedValue('u1');
    await store.revoke('sid.secret');
    expect(tx.del).toHaveBeenCalledWith('auth:session:sid');
    expect(tx.srem).toHaveBeenCalledWith('auth:user-sessions:u1', 'sid');
  });

  it('revokes every session of a user', async () => {
    const { store, client, tx } = setup();
    client.smembers.mockResolvedValue(['s1', 's2']);
    await store.revokeAllForUser('u1');
    expect(tx.del).toHaveBeenCalledWith('auth:session:s1');
    expect(tx.del).toHaveBeenCalledWith('auth:session:s2');
    expect(tx.del).toHaveBeenCalledWith('auth:user-sessions:u1');
  });
});
