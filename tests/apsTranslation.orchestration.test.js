import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createUploadSession,
  finalizeTranslation,
  getTranslationStatus,
} from '../src/services/apsTranslation.js';

describe('createUploadSession validation', () => {
  it('rejects a non-.rvt rootFilename before any SDK call', async () => {
    await assert.rejects(
      () => createUploadSession({ rootFilename: 'model.zip', size: 1024 }),
      (e) => e.status === 400,
    );
  });
  it('rejects a non-positive size before any SDK call', async () => {
    await assert.rejects(
      () => createUploadSession({ rootFilename: 'Tower.rvt', size: 0 }),
      (e) => e.status === 400,
    );
  });
});

describe('finalizeTranslation validation', () => {
  it('rejects a bad rootFilename', async () => {
    await assert.rejects(
      () => finalizeTranslation({ objectKey: 'x.zip', uploadKey: 'k', size: 10, eTags: ['e'], rootFilename: 'nope' }),
      (e) => e.status === 400,
    );
  });
  it('rejects missing upload session fields', async () => {
    await assert.rejects(
      () => finalizeTranslation({ objectKey: '', uploadKey: '', size: 10, eTags: ['e'], rootFilename: 'Tower.rvt' }),
      (e) => e.status === 400,
    );
  });
  it('rejects empty eTags', async () => {
    await assert.rejects(
      () => finalizeTranslation({ objectKey: 'x.zip', uploadKey: 'k', size: 10, eTags: [], rootFilename: 'Tower.rvt' }),
      (e) => e.status === 400,
    );
  });
  it('rejects a non-positive or non-integer size', async () => {
    for (const bad of [0, -1, 1.5]) {
      await assert.rejects(
        () => finalizeTranslation({ objectKey: 'x.zip', uploadKey: 'k', size: bad, eTags: ['e'], rootFilename: 'Tower.rvt' }),
        (e) => e.status === 400,
      );
    }
  });
});

describe('getTranslationStatus validation', () => {
  it('rejects a missing urn', async () => {
    await assert.rejects(() => getTranslationStatus(''), (e) => e.status === 400);
  });
});
