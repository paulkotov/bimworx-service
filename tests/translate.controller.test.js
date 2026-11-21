import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const makeNext = () => {
  const calls = [];
  const next = (err) => calls.push(err);
  return { next, calls };
};
const res = { json() {}, status() { return this; } };

describe('createUpload controller', () => {
  it('forwards a 400 when rootFilename is missing', async () => {
    const { createUpload } = await import('../src/controllers/translate.controller.js');
    const { next, calls } = makeNext();
    await createUpload({ body: { size: 1024 } }, res, next);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].status, 400);
  });
  it('forwards a 400 when size is not a positive integer', async () => {
    const { createUpload } = await import('../src/controllers/translate.controller.js');
    const { next, calls } = makeNext();
    await createUpload({ body: { rootFilename: 'Tower.rvt', size: -5 } }, res, next);
    assert.equal(calls[0].status, 400);
  });
});

describe('getTranslationReport controller', () => {
  it('forwards a 400 when urn is missing', async () => {
    const { getTranslationReport } = await import('../src/controllers/translate.controller.js');
    const { next, calls } = makeNext();
    await getTranslationReport({ query: {} }, res, next);
    assert.equal(calls[0].status, 400);
  });

  it('forwards a 400 when the URN is outside the app bucket', async () => {
    const { env } = await import('../src/config/env.js');
    const { encodeUrn } = await import('../src/services/apsTranslation.js');
    const { getTranslationReport } = await import('../src/controllers/translate.controller.js');
    const previous = env.aps.bucketKey;
    env.aps.bucketKey = 'my_bucket';
    const urn = encodeUrn('urn:adsk.objects:os.object:other_bucket/model.zip');
    try {
      const { next, calls } = makeNext();
      await getTranslationReport({ query: { urn, root: 'Tower.rvt' } }, res, next);
      assert.equal(calls[0].status, 400);
    } finally {
      env.aps.bucketKey = previous;
    }
  });
});

describe('getStatus controller', () => {
  it('forwards a 400 when urn is missing', async () => {
    const { getStatus } = await import('../src/controllers/translate.controller.js');
    const { next, calls } = makeNext();
    await getStatus({ query: {} }, res, next);
    assert.equal(calls[0].status, 400);
  });
});
