import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCategoryIndex,
  countTreeObjects,
  findAecModelDataUrn,
  levelsFromAecModel,
  list3dViewGuids,
  mapModelProperties,
  pickModelViewGuid,
  translationState,
} from '../src/services/modelDetailsMap.js';

describe('translationState', () => {
  it('reads a ready manifest', () => {
    assert.equal(translationState({ status: 'success' }), 'success');
  });

  it('passes through an in-progress manifest', () => {
    assert.equal(translationState({ status: 'inprogress' }), 'inprogress');
    assert.equal(translationState({ status: 'pending' }), 'pending');
    assert.equal(translationState({ status: 'failed' }), 'failed');
    assert.equal(translationState({ status: 'timeout' }), 'timeout');
  });

  it('treats a missing or unknown manifest as missing', () => {
    assert.equal(translationState(null), 'missing');
    assert.equal(translationState({ status: 'weird' }), 'missing');
  });
});

describe('pickModelViewGuid', () => {
  it('prefers the Revit master 3D view', () => {
    assert.equal(
      pickModelViewGuid({
        data: {
          metadata: [
            { name: 'Camera', role: '3d', guid: 'cam', isMasterView: false },
            { name: '{3D}', role: '3d', guid: 'master', isMasterView: true },
          ],
        },
      }),
      'master',
    );
  });

  it('falls back to the first 3D view', () => {
    assert.equal(
      pickModelViewGuid({
        data: {
          metadata: [
            { name: 'Sheet', role: '2d', guid: 'sheet', isMasterView: false },
            { name: '{3D}', role: '3d', guid: 'view', isMasterView: false },
          ],
        },
      }),
      'view',
    );
  });

  it('returns null when the model has no 3D view', () => {
    assert.equal(pickModelViewGuid({ data: { metadata: [] } }), null);
  });
});

describe('list3dViewGuids', () => {
  it('lists every 3D view, master views first, skipping 2D views', () => {
    assert.deepEqual(
      list3dViewGuids({
        data: {
          metadata: [
            { name: '{3D}', role: '3d', guid: 'default', isMasterView: false },
            { name: 'Existing', role: '3d', guid: 'existing', isMasterView: true },
            { name: 'Sheet', role: '2d', guid: 'sheet', isMasterView: false },
            { name: 'New', role: '3d', guid: 'new', isMasterView: true },
          ],
        },
      }),
      ['existing', 'new', 'default'],
    );
  });

  it('returns an empty list when there is no 3D view', () => {
    assert.deepEqual(list3dViewGuids({ data: { metadata: [] } }), []);
  });
});

describe('countTreeObjects', () => {
  it('counts every node carrying an objectid', () => {
    const tree = {
      data: {
        objects: [
          {
            objectid: 1,
            name: 'model.rvt',
            objects: [
              { objectid: 2, name: 'Walls', objects: [{ objectid: 3 }, { objectid: 4 }] },
              { objectid: 5, name: 'Floors', objects: [{ objectid: 6 }] },
            ],
          },
        ],
      },
    };
    assert.equal(countTreeObjects(tree), 6);
  });

  it('is zero for a missing or empty tree', () => {
    assert.equal(countTreeObjects(null), 0);
    assert.equal(countTreeObjects({ data: { objects: [] } }), 0);
  });
});

describe('mapModelProperties', () => {
  const objects = [
    {
      objectid: 1,
      name: 'Project Information [10]',
      properties: {
        'Identity Data': {
          'Project Name': 'Tower A',
          'Project Number': 'P-1',
          'Project Address': '1 Main St',
          'Client Name': 'Northwind',
          'Project Status': 'Issued',
          Author: 'Ada',
          'Building Name': 'Tower',
          'Organization Name': 'BimWorx',
          'Organization Description': 'Lab',
          'Issue Date': '2026-01-02',
        },
        Other: { Category: 'Project Information' },
      },
    },
    {
      objectid: 2,
      name: 'Level 1 [20]',
      properties: {
        Constraints: { Elevation: '4.000 m' },
        Other: { Category: 'Levels' },
      },
    },
    {
      objectid: 3,
      name: 'Level 2 [21]',
      properties: {
        Constraints: { Elevation: '8000 mm' },
        Other: { Category: 'Levels' },
      },
    },
    {
      objectid: 4,
      name: 'Basic Wall [30]',
      properties: {
        Dimensions: { Volume: '2 m^3', Area: '10 m^2', Length: '5 m' },
        Constraints: { Level: 'Level 1' },
        'Materials and Finishes': { 'Structural Material': 'Concrete' },
        Other: { Category: 'Walls' },
      },
    },
    {
      objectid: 5,
      name: 'Basic Wall [31]',
      properties: {
        Dimensions: { Volume: '1 m^3', Area: '4 m^2' },
        Constraints: { 'Base Constraint': 'Level 1' },
        'Materials and Finishes': {
          'Structural Material': 'Concrete',
          'Material Class': 'Concrete',
        },
        Other: { Category: 'Walls' },
      },
    },
    {
      objectid: 6,
      name: 'Floor [32]',
      properties: {
        Dimensions: { Volume: '0.00001 m^3', Area: '0.00001 m^2' },
        Constraints: { Level: 'Level 1' },
        'Materials and Finishes': { Material: 'Dust' },
        Other: { Category: 'Floors' },
      },
    },
    {
      objectid: 7,
      name: 'Rebar [33]',
      properties: {
        Dimensions: { Length: '12.5 m' },
        Constraints: { 'Reference Level': 'Level 2' },
        'Materials and Finishes': { Material: 'Rebar' },
        Other: { Category: 'Structural Rebar' },
      },
    },
    {
      objectid: 8,
      name: 'Loose [34]',
      properties: {
        Dimensions: { Volume: '1 m^3' },
        'Materials and Finishes': { Material: 'Steel' },
        Other: { Category: 'Generic Models' },
      },
    },
    {
      objectid: 9,
      name: 'View 1 [40]',
      properties: {
        Dimensions: { Volume: '99 m^3' },
        'Materials and Finishes': { Material: 'Should Skip' },
        Other: { Category: 'Views' },
      },
    },
  ];

  const report = () =>
    mapModelProperties(objects, {
      fileName: 'tower.rvt',
      versionId: 'urn:version:1',
    });

  it('reads project identity and the BIM 360 version id', () => {
    assert.deepEqual(report().project, {
      projectName: 'Tower A',
      projectNumber: 'P-1',
      buildingName: 'Tower',
      clientName: 'Northwind',
      address: '1 Main St',
      status: 'Issued',
      author: 'Ada',
      organizationName: 'BimWorx',
      organizationDescription: 'Lab',
      issueDate: '2026-01-02',
      fileName: 'tower.rvt',
      projectPath: 'urn:version:1',
    });
  });

  it('lists levels in meters, lowest first', () => {
    assert.deepEqual(report().levels, [
      { name: 'Level 1', elevationM: 4 },
      { name: 'Level 2', elevationM: 8 },
    ]);
  });

  it('sums materials by level and drops near-zero rows', () => {
    const result = report();
    assert.equal(result.elementCount, 4);
    assert.deepEqual(result.categories, [
      { name: 'Walls', count: 2 },
      { name: 'Generic Models', count: 1 },
      { name: 'Structural Rebar', count: 1 },
    ]);
    assert.equal(result.materials.byCategory, false);
    assert.deepEqual(result.units, {
      length: 'm',
      elevation: 'm',
      volume: 'm3',
      area: 'm2',
    });
    assert.deepEqual(result.materials.levels, [
      {
        name: 'Level 1',
        elevationM: 4,
        materials: [
          {
            name: 'Concrete',
            materialClass: 'Concrete',
            volumeM3: 3,
            areaM2: 14,
            lengthM: 5,
          },
        ],
      },
      {
        name: 'Level 2',
        elevationM: 8,
        materials: [
          {
            name: 'Rebar',
            materialClass: null,
            volumeM3: 0,
            areaM2: 0,
            lengthM: 12.5,
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
            lengthM: 0,
          },
        ],
      },
    ]);
  });

  it('reads Russian project info, levels, and material quantities', () => {
    const result = mapModelProperties(
      [
        {
          objectid: 1,
          name: 'Сведения о проекте [1]',
          properties: {
            'Текст': {
              'Имя проекта': 'Башня',
              'Номер проекта': 'А-2',
              'Имя заказчика': 'Север',
            },
            'Прочее': { 'Категория': 'Сведения о проекте' },
          },
        },
        {
          objectid: 2,
          name: 'Этаж 01 [5]',
          properties: {
            'Зависимости': { 'Отметка': '0 мм' },
            'Прочее': { 'Категория': 'Уровни' },
          },
        },
        {
          objectid: 3,
          name: 'Стена [6]',
          properties: {
            'Размеры': { 'Объем': '1,5 м³', 'Площадь': '10 м²' },
            'Зависимости': { 'Уровень': 'Этаж 01' },
            'Материалы и отделка': { 'Несущий материал': 'Бетон' },
            'Прочее': { 'Категория': 'Стены' },
          },
        },
      ],
      { fileName: 'bashnya.rvt', versionId: 'urn:version:ru' },
    );

    assert.equal(result.project.projectName, 'Башня');
    assert.equal(result.project.projectNumber, 'А-2');
    assert.equal(result.project.clientName, 'Север');
    assert.deepEqual(result.levels, [{ name: 'Этаж 01', elevationM: 0 }]);
    assert.deepEqual(result.materials.levels, [
      {
        name: 'Этаж 01',
        elevationM: 0,
        materials: [
          {
            name: 'Бетон',
            materialClass: null,
            volumeM3: 1.5,
            areaM2: 10,
            lengthM: 0,
          },
        ],
      },
    ]);
  });

  it('skips a quantity whose unit is not recognized', () => {
    const result = mapModelProperties(
      [
        {
          objectid: 1,
          name: 'Wall [1]',
          properties: {
            Dimensions: { Volume: '5 widgets', Area: '2 m^2' },
            Constraints: { Level: 'Level 1' },
            'Materials and Finishes': { Material: 'Brick' },
            Other: { Category: 'Walls' },
          },
        },
      ],
      { fileName: 'a.rvt', versionId: 'v' },
    );

    assert.deepEqual(result.materials.levels[0].materials[0], {
      name: 'Brick',
      materialClass: null,
      volumeM3: 0,
      areaM2: 2,
      lengthM: 0,
    });
  });

  it('converts feet and cubic feet into meters', () => {
    const result = mapModelProperties(
      [
        {
          objectid: 1,
          name: 'Level 1 [1]',
          properties: {
            Constraints: { Elevation: "10' - 0\"" },
            Other: { Category: 'Levels' },
          },
        },
        {
          objectid: 2,
          name: 'Wall [2]',
          properties: {
            Dimensions: { Volume: '100 CF', Length: '10 ft' },
            Constraints: { Level: 'Level 1' },
            'Materials and Finishes': { Material: 'Concrete' },
            Other: { Category: 'Walls' },
          },
        },
      ],
      { fileName: 'a.rvt', versionId: 'v' },
    );

    assert.deepEqual(result.levels, [{ name: 'Level 1', elevationM: 3.048 }]);
    assert.deepEqual(result.materials.levels[0].materials[0], {
      name: 'Concrete',
      materialClass: null,
      volumeM3: 2.832,
      areaM2: 0,
      lengthM: 3.05,
    });
  });

  it('reads elevation and material class from the cloud level and material objects', () => {
    const result = mapModelProperties(
      [
        {
          objectid: 1,
          name: 'Level 1 [9]',
          properties: {
            Constraints: { Elevation: '4500' },
            'Identity Data': { Name: 'Этаж 1' },
            Other: { Category: 'Level', Family: 'Level', CategoryId: -2000240 },
          },
        },
        {
          objectid: 2,
          name: 'Фундамент [4]',
          properties: {
            Constraints: { Elevation: { value: -150, unit: 'mm' } },
            'Identity Data': { Name: 'Фундамент' },
            Other: { Family: 'Уровень' },
          },
        },
        {
          objectid: 3,
          name: 'Железобетон',
          properties: {
            'Identity Data': { Name: 'Железобетон', Class: 'Бетон' },
            Other: { Category: 'Materials' },
          },
        },
        {
          objectid: 4,
          name: 'Стена [8]',
          properties: {
            Dimensions: { Volume: '2 m^3', Length: '6000 mm' },
            Constraints: { 'Уровень': 'Level: Этаж 1' },
            'Материалы и отделка': { 'Несущий материал': 'Железобетон' },
            Other: { Category: 'Стены' },
          },
        },
        {
          objectid: 5,
          name: 'Фундаментная плита [10]',
          properties: {
            Dimensions: { Volume: '10 м³' },
            Constraints: { 'Уровень': 'Фундамент' },
            'Материалы и отделка': { 'Несущий материал': 'Железобетон' },
            Other: { Category: 'Перекрытия' },
          },
        },
      ],
      { fileName: 'a.rvt', versionId: 'v' },
    );

    assert.deepEqual(result.levels, [
      { name: 'Фундамент', elevationM: -0.15 },
      { name: 'Этаж 1', elevationM: 4.5 },
    ]);
    assert.deepEqual(
      result.materials.levels.map((level) => ({
        name: level.name,
        elevationM: level.elevationM,
        material: level.materials[0].name,
        materialClass: level.materials[0].materialClass,
      })),
      [
        { name: 'Фундамент', elevationM: -0.15, material: 'Железобетон', materialClass: 'Бетон' },
        { name: 'Этаж 1', elevationM: 4.5, material: 'Железобетон', materialClass: 'Бетон' },
      ],
    );
  });

  it('reads a Russian material class from the material element', () => {
    const result = mapModelProperties(
      [
        {
          objectid: 1,
          name: 'Железобетон',
          properties: {
            'Идентификация': { 'Имя': 'Железобетон', 'Класс': 'Бетон' },
            'Прочее': { 'Категория': 'Материалы' },
          },
        },
        {
          objectid: 2,
          name: 'Стена [2]',
          properties: {
            'Размеры': { 'Объем': '1 м³' },
            'Зависимости': { 'Уровень': 'Этаж 1' },
            'Материалы и отделка': { 'Несущий материал': 'Железобетон' },
            'Прочее': { 'Категория': 'Стены' },
          },
        },
      ],
      { fileName: 'a.rvt', versionId: 'v' },
    );

    assert.equal(result.materials.levels[0].materials[0].materialClass, 'Бетон');
    assert.equal(result.materials.levels[0].elevationM, null);
  });

  it('does not invent an elevation unit from area or volume', () => {
    const result = mapModelProperties(
      [
        {
          objectid: 1,
          name: 'Этаж 1',
          properties: {
            Constraints: { Elevation: '4500' },
            Other: { Category: 'Levels' },
          },
        },
        {
          objectid: 2,
          name: 'Wall [2]',
          properties: {
            Dimensions: { Volume: '2 m^3', Area: '4 m^2' },
            Constraints: { Level: 'Этаж 1' },
            'Materials and Finishes': { Material: 'Concrete' },
            Other: { Category: 'Walls' },
          },
        },
      ],
      { fileName: 'a.rvt', versionId: 'v' },
    );

    assert.equal(result.levels[0].elevationM, null);
    assert.equal(result.materials.levels[0].elevationM, null);
  });

  it('reads every Revit level from AEC model data when the 3D view has none', () => {
    const result = mapModelProperties(
      [
        {
          objectid: 1,
          name: 'Стена [1]',
          properties: {
            Dimensions: { Volume: '2 m^3' },
            Constraints: { Level: 'Этаж 1' },
            'Materials and Finishes': { Material: 'Железобетон' },
            Other: { Category: 'Walls' },
          },
        },
      ],
      {
        fileName: 'a.rvt',
        versionId: 'v',
        aecModel: {
          levels: [
            {
              name: 'Этаж 1',
              elevation: 100,
              extension: { buildingStory: true, projectElevation: 13.123359580052493 },
            },
            {
              name: 'Фундамент',
              elevation: 0,
              extension: { buildingStory: false, projectElevation: -0.4921259842519685 },
            },
            { name: '   ' },
          ],
        },
      },
    );

    assert.deepEqual(result.levels, [
      { name: 'Фундамент', elevationM: -0.15 },
      { name: 'Этаж 1', elevationM: 4 },
    ]);
    assert.equal(result.materials.levels[0].name, 'Этаж 1');
    assert.equal(result.materials.levels[0].elevationM, 4);
  });

  it('counts loadable families with no quantity as count-only elements', () => {
    const result = mapModelProperties(
      [
        {
          objectid: 1,
          name: 'Дверь [1]',
          properties: {
            'Идентификация': { 'Имя типа': 'Одностворчатая 900x2100' },
            'Прочее': { 'Категория': 'Двери' },
          },
        },
        {
          objectid: 2,
          name: 'Окно [2]',
          properties: {
            'Идентификация': { 'Имя типа': 'Окно 1200x1500' },
            'Прочее': { 'Категория': 'Окна' },
          },
        },
        {
          objectid: 3,
          name: 'Окно [3]',
          properties: {
            'Идентификация': { 'Имя типа': 'Окно 1200x1500' },
            'Прочее': { 'Категория': 'Окна' },
          },
        },
        {
          objectid: 4,
          name: 'Стена [4]',
          properties: {
            'Размеры': { 'Объем': '2 m^3' },
            'Зависимости': { 'Уровень': 'Этаж 1' },
            'Материалы и отделка': { 'Несущий материал': 'Бетон' },
            'Прочее': { 'Категория': 'Стены' },
          },
        },
      ],
      { fileName: 'a.rvt', versionId: 'v' },
    );

    assert.equal(result.elementCount, 1);
    assert.deepEqual(result.categories, [{ name: 'Стены', count: 1 }]);
    assert.deepEqual(result.pieces, {
      count: 3,
      categories: [
        { name: 'Окна', count: 2 },
        { name: 'Двери', count: 1 },
      ],
    });
  });

  it('labels a multi-layer element by its type when no material is exposed', () => {
    const result = mapModelProperties(
      [
        {
          objectid: 243,
          name: 'Базовая крыша [186510]',
          properties: {
            'Зависимости': { 'Базовый уровень': 'Кровля' },
            'Строительство': { 'Конструкция': '' },
            'Идентификация': { 'Имя типа': 'Типовой - 125мм' },
            'Размеры': { 'Объем': '5.879 m^3', 'Площадь': '47.035 m^2' },
            'Прочее': { 'Категория': 'Крыши' },
          },
        },
        {
          objectid: 300,
          name: 'Помещение [1]',
          properties: {
            'Размеры': { 'Объем': '30 m^3', 'Площадь': '12 m^2' },
            'Идентификация': { 'Имя типа': 'Жилая' },
            'Прочее': { 'Категория': 'Помещения' },
          },
        },
      ],
      {
        fileName: 'Коттедж.rvt',
        versionId: 'v',
        aecModel: {
          levels: [
            { name: 'Кровля', elevation: 20.669291338582678 },
          ],
        },
      },
    );

    assert.deepEqual(result.categories, [{ name: 'Крыши', count: 1 }]);
    // Rooms are spatial, not physical: excluded from both tables.
    assert.deepEqual(result.pieces, { count: 0, categories: [] });
    assert.deepEqual(result.materials.levels, [
      {
        name: 'Кровля',
        elevationM: 6.3,
        materials: [
          {
            name: 'Типовой - 125мм',
            materialClass: null,
            volumeM3: 5.879,
            areaM2: 47.035,
            lengthM: 0,
          },
        ],
      },
    ]);
  });
});

describe('findAecModelDataUrn', () => {
  it('finds the nested AEC model data derivative', () => {
    assert.equal(
      findAecModelDataUrn({
        derivatives: [
          {
            children: [
              { role: 'graphics', urn: 'urn:graphics' },
              { role: 'Autodesk.AEC.ModelData', urn: 'urn:aec', mime: 'application/json' },
            ],
          },
        ],
      }),
      'urn:aec',
    );
    assert.equal(findAecModelDataUrn({ derivatives: [] }), null);
  });
});

describe('levelsFromAecModel', () => {
  it('converts a level that only has the internal elevation', () => {
    assert.deepEqual(levelsFromAecModel({ levels: [{ name: 'Level 1', elevation: 10 }] }), [
      { name: 'Level 1', elevationM: 3.048 },
    ]);
  });
});

describe('buildCategoryIndex', () => {
  it('maps every instance objectid to its Revit category node', () => {
    const tree = {
      data: {
        objects: [
          {
            objectid: 1,
            name: 'tower.rvt',
            objects: [
              {
                objectid: 2,
                name: 'Walls',
                objects: [
                  {
                    objectid: 3,
                    name: 'Basic Wall',
                    objects: [{ objectid: 4, name: 'Wall A' }, { objectid: 5, name: 'Wall B' }],
                  },
                ],
              },
              { objectid: 6, name: 'Floors', objects: [{ objectid: 7, name: 'Floor A' }] },
            ],
          },
        ],
      },
    };

    const index = buildCategoryIndex(tree);
    assert.equal(index.get(4), 'Walls');
    assert.equal(index.get(5), 'Walls');
    assert.equal(index.get(7), 'Floors');
    assert.equal(index.has(1), false);
  });
});

describe('category split from the object tree', () => {
  it('counts elements by the category node when properties carry none', () => {
    const objects = [
      {
        objectid: 10,
        name: 'Wall A',
        properties: {
          Dimensions: { Volume: '2 m^3' },
          Constraints: { Level: 'Этаж 1' },
          'Materials and Finishes': { 'Structural Material': 'Железобетон' },
        },
      },
      {
        objectid: 11,
        name: 'Wall B',
        properties: {
          Dimensions: { Volume: '3 m^3' },
          Constraints: { Level: 'Этаж 1' },
          'Materials and Finishes': { 'Structural Material': 'Железобетон' },
        },
      },
      {
        objectid: 12,
        name: 'Floor A',
        properties: {
          Dimensions: { Volume: '4 m^3' },
          Constraints: { Level: 'Этаж 1' },
          'Materials and Finishes': { 'Structural Material': 'Бетон' },
        },
      },
    ];

    const objectTree = {
      data: {
        objects: [
          {
            objectid: 1,
            name: 'a.rvt',
            objects: [
              { objectid: 2, name: 'Стены', objects: [{ objectid: 10 }, { objectid: 11 }] },
              { objectid: 3, name: 'Перекрытия', objects: [{ objectid: 12 }] },
            ],
          },
        ],
      },
    };

    const result = mapModelProperties(objects, { fileName: 'a.rvt', versionId: 'v', objectTree });

    assert.deepEqual(result.categories, [
      { name: 'Стены', count: 2 },
      { name: 'Перекрытия', count: 1 },
    ]);
    assert.equal(result.elementCount, 3);
  });

  it('skips level and material nodes identified only by the object tree', () => {
    const objects = [
      {
        objectid: 20,
        name: 'Этаж 1',
        properties: { Constraints: { Elevation: '4500' }, 'Identity Data': { Name: 'Этаж 1' } },
      },
      {
        objectid: 21,
        name: 'Железобетон',
        properties: { 'Identity Data': { Name: 'Железобетон', Class: 'Бетон' } },
      },
      {
        objectid: 22,
        name: 'Wall A',
        properties: {
          Dimensions: { Volume: '2 m^3' },
          Constraints: { Level: 'Этаж 1' },
          'Materials and Finishes': { 'Structural Material': 'Железобетон' },
        },
      },
    ];

    const objectTree = {
      data: {
        objects: [
          {
            objectid: 1,
            name: 'a.rvt',
            objects: [
              { objectid: 2, name: 'Уровни', objects: [{ objectid: 20 }] },
              { objectid: 3, name: 'Материалы', objects: [{ objectid: 21 }] },
              { objectid: 4, name: 'Стены', objects: [{ objectid: 22 }] },
            ],
          },
        ],
      },
    };

    const result = mapModelProperties(objects, { fileName: 'a.rvt', versionId: 'v', objectTree });

    assert.deepEqual(result.categories, [{ name: 'Стены', count: 1 }]);
    assert.equal(result.materials.levels[0].materials[0].materialClass, 'Бетон');
  });
});
