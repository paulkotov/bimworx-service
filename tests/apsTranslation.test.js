// tests/apsTranslation.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeUrn,
  assertRootFilename,
  assertOwnObjectUrn,
  planParts,
  buildTranslationJobPayload,
  isBucketConflict,
} from '../src/services/apsTranslation.js';
import { env } from '../src/config/env.js';

describe('encodeUrn', () => {
  it('produces padded-free base64url', () => {
    const urn = encodeUrn('urn:adsk.objects:os.object:my_bucket/a.zip');
    assert.ok(!urn.includes('+'));
    assert.ok(!urn.includes('/'));
    assert.ok(!urn.includes('='));
    assert.equal(Buffer.from(urn.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
      'urn:adsk.objects:os.object:my_bucket/a.zip');
  });
});

describe('assertOwnObjectUrn', () => {
  it('rejects a missing or non-object URN before reading the bucket', () => {
    for (const bad of ['', 'not-a-urn', null]) {
      assert.throws(() => assertOwnObjectUrn(bad), (error) => error.status === 400);
    }
  });

  it('accepts an object in the configured bucket and rejects another bucket', () => {
    const previous = env.aps.bucketKey;
    env.aps.bucketKey = 'my_bucket';
    const own = encodeUrn('urn:adsk.objects:os.object:my_bucket/model.zip');
    const other = encodeUrn('urn:adsk.objects:os.object:other_bucket/model.zip');
    try {
      assert.equal(assertOwnObjectUrn(`  ${own}  `), own);
      assert.throws(() => assertOwnObjectUrn(other), (error) => error.status === 400);
    } finally {
      env.aps.bucketKey = previous;
    }
  });
});

describe('assertRootFilename', () => {
  it('accepts a .rvt name and trims it', () => {
    assert.equal(assertRootFilename('  Tower.rvt '), 'Tower.rvt');
  });
  it('rejects non-.rvt, pathy, or non-string names', () => {
    for (const bad of ['model.zip', 'a/b.rvt', 'a\\b.rvt', '', 42, null]) {
      assert.throws(() => assertRootFilename(bad), (e) => e.status === 400);
    }
  });
});

describe('planParts', () => {
  it('computes ceil(size/partSize)', () => {
    assert.equal(planParts(10, 4), 3);
    assert.equal(planParts(8, 4), 2);
  });
  it('rejects non-positive or non-integer sizes', () => {
    for (const bad of [0, -1, 1.5, NaN, '5']) {
      assert.throws(() => planParts(bad, 4), (e) => e.status === 400);
    }
  });
  it('rejects more than 10000 parts', () => {
    assert.throws(() => planParts(10_001, 1), (e) => e.status === 400);
  });
});

describe('buildTranslationJobPayload', () => {
  it('sets compressedUrn, rootFilename and svf2 output', () => {
    const payload = buildTranslationJobPayload('URN', 'Tower.rvt');
    assert.deepEqual(payload, {
      input: { urn: 'URN', compressedUrn: true, rootFilename: 'Tower.rvt' },
      output: { formats: [{ type: 'svf2', views: ['2d', '3d'] }] },
    });
  });
});

describe('isBucketConflict', () => {
  it('detects 409 across error shapes', () => {
    assert.equal(isBucketConflict({ httpStatusCode: () => 409 }), true);
    assert.equal(isBucketConflict({ axiosError: { response: { status: 409 } } }), true);
    assert.equal(isBucketConflict({ response: { status: 404 } }), false);
    assert.equal(isBucketConflict(null), false);
  });
});
