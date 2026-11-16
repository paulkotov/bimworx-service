import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('getInternalToken', () => {
  it('throws 503 when APS credentials are not configured', async () => {
    delete process.env.APS_CLIENT_ID;
    delete process.env.APS_CLIENT_SECRET;
    const { getInternalToken } = await import('../src/services/apsAuth.js');
    await assert.rejects(() => getInternalToken(), (e) => e.status === 503);
  });
});
