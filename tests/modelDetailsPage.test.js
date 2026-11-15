import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toModelDetailsPage, toModelDetailsShell, toTranslationDetailsPage, toTranslationDetailsShell } from '../src/viewModels/modelDetailsPage.js';

const ids = { hubId: 'b.hub', projectId: 'b.project', itemId: 'b.item' };

describe('toModelDetailsPage', () => {
  it('formats a ready report as display strings', () => {
    const page = toModelDetailsPage({
      ...ids,
      error: null,
      details: {
        fileName: 'Tower.rvt',
        region: 'US',
        translation: 'success',
        report: {
          project: {
            projectName: 'Tower A',
            projectNumber: null,
            buildingName: '',
            clientName: 'Northwind',
            address: null,
            status: null,
            author: 'Ada',
            organizationName: null,
            organizationDescription: null,
            issueDate: null,
            fileName: 'Tower.rvt',
            projectPath: 'urn:version:1',
          },
          elementCount: 2,
          categories: [
            { name: 'Walls', count: 2 },
            { name: 'Floors', count: 1 },
          ],
          pieces: {
            count: 42,
            categories: [
              { name: 'Windows', count: 32 },
              { name: 'Doors', count: 10 },
            ],
          },
          levels: [
            { name: 'Level 1', elevationM: 4 },
            { name: 'Level 2', elevationM: null },
          ],
          materials: {
            levels: [
              {
                name: 'Level 1',
                elevationM: 4,
                materials: [
                  {
                    name: 'Concrete',
                    materialClass: 'Concrete',
                    volumeM3: 2,
                    areaM2: 10,
                    lengthM: 5,
                  },
                ],
              },
              {
                name: '(no level)',
                elevationM: null,
                materials: [
                  {
                    name: 'Steel',
                    materialClass: null,
                    volumeM3: 1,
                    areaM2: 0,
                    lengthM: 12.5,
                  },
                ],
              },
            ],
          },
        },
      },
    });

    assert.equal(page.title, 'BimWorx · Tower.rvt · Details');
    assert.equal(page.showReport, true);
    assert.equal(page.notice, null);
    assert.equal(page.viewHref, '/hubs/b.hub/projects/b.project/items/b.item/view');
    assert.equal(page.report.elementCount, '2');
    assert.equal(page.report.hasCategories, true);
    assert.deepEqual(page.report.categories, [
      { name: 'Walls', count: '2' },
      { name: 'Floors', count: '1' },
    ]);
    assert.equal(page.report.pieceCount, '42');
    assert.equal(page.report.hasPieces, true);
    assert.deepEqual(page.report.pieces, [
      { name: 'Windows', count: '32' },
      { name: 'Doors', count: '10' },
    ]);
    assert.deepEqual(
      page.report.identity.find((row) => row.label === 'Project number'),
      { label: 'Project number', value: '—', className: '' },
    );
    assert.equal(page.report.identity.find((row) => row.label === 'Address').className, 'is-wide');
    assert.equal(page.report.hasLevels, true);
    assert.equal(page.report.hasMaterials, true);
    assert.deepEqual(page.report.levels, [
      { name: 'Level 1', elevation: '4' },
      { name: 'Level 2', elevation: '—' },
    ]);
    assert.deepEqual(page.report.materials[1], {
      level: '(no level)',
      elevation: '—',
      name: 'Steel',
      materialClass: '—',
      volume: '1',
      area: '0',
      length: '12.5',
    });
  });

  it('describes an in-progress derivative and offers refresh', () => {
    const page = toModelDetailsPage({
      ...ids,
      error: null,
      details: {
        fileName: 'Tower.rvt',
        region: 'EMEA',
        translation: 'inprogress',
        report: null,
      },
    });

    assert.equal(
      page.notice,
      'BIM 360 is still preparing this model. Refresh this page in a moment.',
    );
    assert.equal(page.showRefresh, true);
    assert.equal(page.showReport, false);
  });

  it('names the hub region when the viewable is missing', () => {
    const page = toModelDetailsPage({
      ...ids,
      error: null,
      details: {
        fileName: 'Tower.rvt',
        region: 'EMEA',
        translation: 'missing',
        report: null,
      },
    });

    assert.equal(page.notice, 'BIM 360 has no viewable for this model in region EMEA.');
    assert.equal(page.showRefresh, false);
  });

  it('opens as a shell with a details endpoint and no report', () => {
    const page = toModelDetailsShell({
      hubId: 'b.hub',
      projectId: 'b.project',
      itemId: 'b.item',
    });

    assert.equal(page.loading, true);
    assert.equal(page.showReport, false);
    assert.equal(page.showEmpty, false);
    assert.equal(page.fileName, 'Details');
    assert.equal(
      page.endpoint,
      '/api/hubs/b.hub/projects/b.project/items/b.item/details',
    );
    assert.equal(page.viewHref, '/hubs/b.hub/projects/b.project/items/b.item/view');
  });

  it('keeps a load error ahead of the report', () => {
    const page = toModelDetailsPage({
      ...ids,
      error: 'Failed to load model details.',
      details: null,
    });

    assert.equal(page.error, 'Failed to load model details.');
    assert.equal(page.fileName, 'Details');
    assert.equal(page.title, 'BimWorx · Details');
    assert.equal(page.notice, null);
    assert.equal(page.showReport, false);
  });
});

describe('toTranslationDetailsPage', () => {
  const urn = 'dXJuOmV4YW1wbGU';
  const root = 'Tower.rvt';

  it('points the shell at the translate report and keeps the root name', () => {
    const page = toTranslationDetailsShell({ urn, rootFilename: root });

    assert.equal(page.loading, true);
    assert.equal(page.fileName, 'Tower.rvt');
    assert.equal(page.subtitle, 'Translated composite model');
    assert.equal(page.crumbs[0].href, '/translate');
    assert.equal(page.endpoint, `/api/translate/reports?urn=${urn}&root=Tower.rvt`);
    assert.equal(page.viewHref, `/translate/reports/view?urn=${urn}&root=Tower.rvt`);
    assert.equal(page.actions[1].href, '/translate');
  });

  it('describes a running translation without BIM 360 copy', () => {
    const page = toTranslationDetailsPage({
      urn,
      rootFilename: root,
      error: null,
      details: {
        fileName: 'Tower.rvt',
        region: 'US',
        translation: 'inprogress',
        report: null,
      },
    });

    assert.equal(page.notice, 'Translation is still running. Refresh this page in a moment.');
    assert.equal(page.showRefresh, true);
    assert.equal(page.showReport, false);
  });

  it('formats materials and drops an empty source row', () => {
    const page = toTranslationDetailsPage({
      urn,
      rootFilename: root,
      error: null,
      details: {
        fileName: 'Tower.rvt',
        translation: 'success',
        report: {
          project: { fileName: 'Tower.rvt', projectPath: '' },
          elementCount: 1,
          categories: [],
          pieces: { count: 0, categories: [] },
          levels: [],
          materials: {
            levels: [
              {
                name: 'Level 1',
                elevationM: 3,
                materials: [
                  {
                    name: 'Concrete',
                    materialClass: 'Concrete',
                    volumeM3: 2,
                    areaM2: 4,
                    lengthM: 1,
                  },
                ],
              },
            ],
          },
        },
      },
    });

    assert.equal(page.showReport, true);
    assert.equal(page.report.materials[0].name, 'Concrete');
    assert.equal(page.report.materials[0].volume, '2');
    assert.equal(
      page.report.identity.some((row) => row.label === 'BIM 360 version'),
      false,
    );
  });
});
