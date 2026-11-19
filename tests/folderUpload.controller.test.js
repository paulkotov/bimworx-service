import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const makeNext = () => {
  const calls = [];
  const next = (err) => calls.push(err);
  return { next, calls };
};
const res = { json() {}, status() { return this; } };
const params = { projectId: 'b.project', folderId: 'b.folder' };

describe('createFolderUpload', () => {
  it('forwards a 400 when the file name is missing', async () => {
    const { createFolderUpload } = await import('../src/controllers/hubs.controller.js');
    const { next, calls } = makeNext();
    await createFolderUpload(
      { params, body: { size: 1024 }, session: {}, apsAccessToken: 't' },
      res,
      next,
    );
    assert.equal(calls[0].status, 400);
  });

  it('forwards a 400 when size is not a positive integer', async () => {
    const { createFolderUpload } = await import('../src/controllers/hubs.controller.js');
    const { next, calls } = makeNext();
    await createFolderUpload(
      { params, body: { name: 'Tower.rvt', size: 0 }, session: {}, apsAccessToken: 't' },
      res,
      next,
    );
    assert.equal(calls[0].status, 400);
  });
});

describe('uploadFolderPart', () => {
  it('rejects an unknown upload session with 409', async () => {
    const { uploadFolderPart } = await import('../src/controllers/hubs.controller.js');
    const { next, calls } = makeNext();
    await uploadFolderPart(
      { query: { uploadId: 'nope', index: '0' }, session: {}, body: Buffer.from('x') },
      res,
      next,
    );
    assert.equal(calls[0].status, 409);
  });

  it('rejects a part index outside the session with 400', async () => {
    const { uploadFolderPart } = await import('../src/controllers/hubs.controller.js');
    const { next, calls } = makeNext();
    const session = { folderUploads: { u1: { urls: ['a', 'b'], eTags: [] } } };
    await uploadFolderPart(
      { query: { uploadId: 'u1', index: '5' }, session, body: Buffer.from('x') },
      res,
      next,
    );
    assert.equal(calls[0].status, 400);
  });
});

describe('finishFolderUpload', () => {
  it('forwards a 409 when the upload session is unknown', async () => {
    const { finishFolderUpload } = await import('../src/controllers/hubs.controller.js');
    const { next, calls } = makeNext();
    await finishFolderUpload(
      { body: { uploadId: 'gone' }, session: {}, apsAccessToken: 't' },
      res,
      next,
    );
    assert.equal(calls[0].status, 409);
  });
});
