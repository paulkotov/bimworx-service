import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toContentEntry } from '../src/viewModels/contentEntry.js';
import { toFolderPage } from '../src/viewModels/folderPage.js';
import { toHubsPage } from '../src/viewModels/hubsPage.js';
import { toProjectPage } from '../src/viewModels/projectPage.js';

const ids = { hubId: 'b.hub', projectId: 'b.project' };

describe('toContentEntry', () => {
  it('builds folder and Revit rows', () => {
    const folder = toContentEntry(
      {
        id: 'folder 1',
        type: 'folders',
        name: 'Plans',
        objectCount: 2,
        lastModifiedTime: '2026-11-01T10:00:00.000Z',
        lastModifiedUserName: 'Ada',
      },
      ids,
    );
    assert.equal(folder.isFolder, true);
    assert.equal(folder.isRevit, false);
    assert.equal(folder.meta.startsWith('Folder · 2 item(s) · updated '), true);
    assert.equal(folder.meta.endsWith(' · by Ada'), true);
    assert.equal(
      folder.folderHref,
      '/hubs/b.hub/projects/b.project/folders/folder%201',
    );

    const revit = toContentEntry(
      { id: 'item 1', type: 'items', name: 'Tower.rvt', fileType: 'rvt' },
      ids,
    );
    assert.equal(revit.isRevit, true);
    assert.equal(revit.meta, 'rvt');
    assert.equal(
      revit.detailsHref,
      '/hubs/b.hub/projects/b.project/items/item%201/details',
    );
    assert.equal(
      revit.downloadHref,
      '/api/hubs/b.hub/projects/b.project/items/item%201/download',
    );
    assert.equal(
      revit.deleteHref,
      '/api/hubs/b.hub/projects/b.project/items/item%201',
    );
  });

  it('keeps Details off non-Revit files', () => {
    const pdf = toContentEntry(
      { id: 'pdf', type: 'items', name: 'Sheet.pdf', fileType: null },
      ids,
    );
    assert.equal(pdf.isRevit, false);
    assert.equal(pdf.meta, 'File');
  });
});

describe('toFolderPage', () => {
  it('summarizes contents and exposes the upload endpoint', () => {
    const page = toFolderPage({
      ...ids,
      error: null,
      view: {
        folder: { id: 'fld', name: 'Plans' },
        parent: { id: 'root', name: 'Project Files' },
        contents: [
          { id: 'a', type: 'folders', name: 'Sub', objectCount: 0 },
          { id: 'b', type: 'items', name: 'Tower.rvt', fileType: 'rvt' },
        ],
      },
    });

    assert.equal(page.summary, '1 folder(s) · 1 file(s)');
    assert.equal(page.showParent, true);
    assert.equal(page.parentName, 'Project Files');
    assert.equal(page.showUpload, true);
    assert.equal(
      page.uploadEndpoint,
      '/api/hubs/b.hub/projects/b.project/folders/fld/upload',
    );
    assert.equal(page.entries[1].isRevit, true);
  });
});

describe('toProjectPage', () => {
  it('formats project fields and folder counts', () => {
    const page = toProjectPage({
      ...ids,
      error: null,
      overview: {
        project: {
          id: 'b.project',
          name: 'Tower',
          extensionType: null,
          scopes: ['data:read'],
          extensionData: { projectType: 'Office' },
        },
        folders: [
          {
            name: 'Plans',
            objectCount: 3,
            contents: [{ id: 'f', type: 'items', name: 'a.pdf', fileType: 'pdf' }],
          },
        ],
      },
    });

    assert.deepEqual(
      page.fields.map((field) => field.value),
      ['—', 'data:read', 'Office'],
    );
    assert.equal(page.folders[0].countLabel, '3 item(s)');
    assert.equal(page.folders[0].entries[0].isRevit, false);
  });
});

describe('toHubsPage', () => {
  it('formats hub meta, project links, and warnings', () => {
    const page = toHubsPage({
      error: null,
      warnings: [{ code: 'W1', title: 'Heads up', detail: 'More' }],
      hubs: [
        {
          id: 'hub 1',
          name: 'Account',
          region: 'EMEA',
          projects: [{ id: 'p 1', name: 'Tower' }],
        },
      ],
    });

    assert.equal(page.hubs[0].meta, 'hub 1 · EMEA');
    assert.equal(page.hubs[0].projects[0].href, '/hubs/hub%201/projects/p%201');
    assert.deepEqual(page.warnings, [{ text: 'W1: Heads up — More' }]);
    assert.equal(page.isEmpty, false);
  });
});
