import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapHub, mapProject } from '../src/services/apsData.js';

describe('apsData mappers', () => {
  it('mapHub extracts id, name, region', () => {
    assert.deepEqual(
      mapHub({
        id: 'b.hub-1',
        attributes: { name: 'Account A', region: 'US' },
      }),
      { id: 'b.hub-1', name: 'Account A', region: 'US' },
    );
  });

  it('mapProject extracts id and name', () => {
    assert.deepEqual(
      mapProject({
        id: 'b.proj-1',
        attributes: { name: 'Tower' },
      }),
      { id: 'b.proj-1', name: 'Tower' },
    );
  });
});
