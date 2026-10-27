import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('requireApsAuth', () => {
  it('returns 401 when session has no APS tokens', async () => {
    const { requireApsAuth } = await import('../src/middlewares/requireApsAuth.js');

    const req = { session: {} };
    const res = {
      statusCode: 0,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
    let nextCalled = false;

    await requireApsAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'Autodesk sign-in required.');
  });
});
