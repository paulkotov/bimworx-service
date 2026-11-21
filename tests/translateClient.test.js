import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { uploadAndTranslate } from '../src/public/translate.js';

class FakeFile {
  constructor(size) { this.size = size; }
  slice(start, end) { return { __part: [start, end] }; }
}

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe('uploadAndTranslate', () => {
  it('inits, PUTs each part in order with its ETag, then completes with only the echoed fields', async () => {
    const puts = [];
    let completeBody = null;
    globalThis.fetch = async (url, opts = {}) => {
      if (url === '/api/translate/uploads') {
        return { ok: true, json: async () => ({
          objectKey: 'obj.zip', uploadKey: 'uk',
          urls: ['https://s3/part1', 'https://s3/part2'], partSize: 4,
        }) };
      }
      if (String(url).startsWith('https://s3/')) {
        const idx = puts.length + 1;
        puts.push({ url, body: opts.body });
        return { ok: true, headers: { get: (h) => h.toLowerCase() === 'etag' ? `\"etag-${idx}\"` : null } };
      }
      if (url === '/api/translate/uploads/complete') {
        completeBody = JSON.parse(opts.body);
        return { ok: true, json: async () => ({ urn: 'URN123', status: 'inprogress' }) };
      }
      throw new Error(`unexpected url ${url}`);
    };

    const progress = [];
    const urn = await uploadAndTranslate(new FakeFile(8), 'Tower.rvt', (p) => progress.push(p));

    assert.equal(urn, 'URN123');
    assert.equal(puts.length, 2);
    assert.deepEqual(puts.map((p) => p.url), ['https://s3/part1', 'https://s3/part2']);
    assert.deepEqual(puts.map((p) => p.body.__part), [[0, 4], [4, 8]]);
    assert.deepEqual(progress, [50, 100]);
    assert.deepEqual(completeBody, {
      objectKey: 'obj.zip', uploadKey: 'uk', size: 8,
      eTags: ['etag-1', 'etag-2'], rootFilename: 'Tower.rvt',
    });
  });

  it('retries a failed part and succeeds within PART_RETRIES', async () => {
    let attempts = 0;
    globalThis.fetch = async (url) => {
      if (url === '/api/translate/uploads') {
        return { ok: true, json: async () => ({ objectKey: 'o', uploadKey: 'k', urls: ['https://s3/p1'], partSize: 8 }) };
      }
      if (String(url).startsWith('https://s3/')) {
        attempts += 1;
        if (attempts < 2) return { ok: false, status: 500, headers: { get: () => null } };
        return { ok: true, headers: { get: () => '\"etag-ok\"' } };
      }
      if (url === '/api/translate/uploads/complete') {
        return { ok: true, json: async () => ({ urn: 'URN-R', status: 'inprogress' }) };
      }
      throw new Error(`unexpected url ${url}`);
    };
    const urn = await uploadAndTranslate(new FakeFile(4), 'Tower.rvt');
    assert.equal(urn, 'URN-R');
    assert.equal(attempts, 2);
  });

  it('throws after exhausting PART_RETRIES', async () => {
    globalThis.fetch = async (url) => {
      if (url === '/api/translate/uploads') {
        return { ok: true, json: async () => ({ objectKey: 'o', uploadKey: 'k', urls: ['https://s3/p1'], partSize: 8 }) };
      }
      return { ok: false, status: 500, headers: { get: () => null } };
    };
    await assert.rejects(() => uploadAndTranslate(new FakeFile(4), 'Tower.rvt'), /Part upload failed/);
  });

  it('throws when S3 does not return an ETag', async () => {
    globalThis.fetch = async (url) => {
      if (url === '/api/translate/uploads') {
        return { ok: true, json: async () => ({ objectKey: 'o', uploadKey: 'k', urls: ['https://s3/p1'], partSize: 8 }) };
      }
      return { ok: true, headers: { get: () => null } };
    };
    await assert.rejects(() => uploadAndTranslate(new FakeFile(4), 'Tower.rvt'), /ETag/);
  });
});
