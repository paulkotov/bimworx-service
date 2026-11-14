/**
 * Turns a Model Derivative property collection into the same report shape as
 * the Revit tools get-project-info and get-model-materials.
 *
 * Quantities stay in meters. A value with no recognizable unit is left out of
 * the sum. A bare length uses the length unit written on other properties in
 * the same model; area and volume units are not reused for that. Near-zero
 * rows are dropped, matching the Revit takeoff.
 *
 * Multi-layer elements (roofs, walls, floors) keep their materials in the
 * type's compound structure, which the cloud derivative does not expose. When
 * an element has no material property its type name labels the takeoff row, so
 * the quantity is still reported instead of the whole element being dropped.
 *
 * Level names on elements do not carry an elevation. Revit stores that on the
 * level itself, and the cloud derivative writes it to AECModelData in feet
 * (Level.ProjectElevation). Those levels replace elevations guessed from the
 * 3D property set. Material class is read from the element when the cloud
 * model puts it there, and otherwise from the material object of the same name.
 */

const NO_LEVEL = '(no level)';
const NO_CATEGORY = '(no category)';

const VOLUME_EPS = 0.0001;
const AREA_EPS = 0.0001;
const LENGTH_EPS = 0.01;

const KNOWN_TRANSLATIONS = new Set([
  'success',
  'pending',
  'inprogress',
  'failed',
  'timeout',
]);

const PROJECT_CATEGORIES = new Set(['project information', 'сведения о проекте']);
const LEVEL_CATEGORIES = new Set(['levels', 'level', 'уровни', 'уровень']);
const MATERIAL_CATEGORIES = new Set(['materials', 'material', 'материалы', 'материал']);
const LEVEL_CATEGORY_ID = '-2000240';

const SKIP_CATEGORIES = new Set([
  ...PROJECT_CATEGORIES,
  ...LEVEL_CATEGORIES,
  'grids',
  'оси',
  'views',
  'виды',
  'sheets',
  'листы',
  'viewports',
  'видовые экраны',
  'cameras',
  'камеры',
  'scope boxes',
  'области видимости',
  'materials',
  'материалы',
  'schedules',
  'спецификации',
  'matchlines',
  'reference planes',
  'опорные плоскости',
  'elevations',
  'фасады',
  'floor plans',
  'планы этажей',
  'ceiling plans',
  'планы потолков',
  'sections',
  'разрезы',
  'legends',
  'легенды',
  'rvt links',
  'revit links',
  'cad links',
  'связанные файлы',
  'rooms',
  'помещения',
  'spaces',
  'пространства',
  'areas',
  'зоны',
  // Non-physical helpers Revit lists among elements but that model no geometry.
  'room separation',
  'разделитель помещений',
  'curtain systems',
  'curtain grids',
  'curtain wall grids',
  'curtain wall mullions joins',
  'схемы разрезки витражей',
  'схемы разрезки крыш',
  'rectangular straight wall opening',
  'wall openings',
  'прямоугольный проем в стене',
  'shaft openings',
  'вырезание проема в перекрытии',
]);

const PROJECT_FIELDS = [
  ['projectName', ['Project Name', 'Имя проекта', 'Наименование проекта']],
  ['projectNumber', ['Project Number', 'Номер проекта']],
  ['buildingName', ['Building Name', 'Имя здания']],
  ['clientName', ['Client Name', 'Имя заказчика', 'Заказчик']],
  ['address', ['Project Address', 'Address', 'Адрес проекта', 'Адрес']],
  ['status', ['Project Status', 'Status', 'Статус проекта', 'Статус']],
  ['author', ['Author', 'Автор']],
  ['organizationName', ['Organization Name', 'Название организации', 'Имя организации']],
  ['organizationDescription', ['Organization Description', 'Описание организации']],
  ['issueDate', ['Issue Date', 'Дата выпуска']],
];

const MATERIAL_KEYS = ['Structural Material', 'Несущий материал', 'Material', 'Материал'];
// Multi-layer elements (roofs, walls, floors) keep their materials in the
// type's compound structure, which the cloud derivative does not expose as a
// property. When an element carries no material the type name labels the
// takeoff row instead, so the quantity is still reported.
const TYPE_NAME_KEYS = [
  'Type Name',
  'Имя типа',
  'Family and Type',
  'Семейство и типоразмер',
];
const ELEMENT_CLASS_KEYS = ['Material Class', 'Класс материала'];
const CATALOG_CLASS_KEYS = ['Class', 'Класс', 'Material Class', 'Класс материала'];
const FAMILY_KEYS = ['Family', 'Family Name', 'Семейство', 'Имя семейства'];
const LEVEL_NAME_KEYS = ['Name', 'Имя'];
const CATEGORY_ID_KEYS = ['CategoryId', 'Category ID', 'Id категории'];
const LEVEL_KEYS = [
  'Level',
  'Уровень',
  'Reference Level',
  'Базовый уровень',
  'Schedule Level',
  'Уровень спецификации',
  'Base Constraint',
  'Базовая зависимость',
  'Base Level',
  'Нижний уровень',
  'Associated Level',
  'Связанный уровень',
];
const VOLUME_KEYS = ['Volume', 'Объем', 'Объём'];
const AREA_KEYS = ['Area', 'Площадь', 'Surface Area', 'Площадь поверхности'];
const LENGTH_KEYS = [
  'Length',
  'Длина',
  'Cut Length',
  'Bar Length',
  'Total Bar Length',
  'Длина стержня',
];
const ELEVATION_KEYS = ['Elevation', 'Отметка', 'Высота'];

const EMPTY_TEXT = new Set(['—', '-', '–', 'n/a', 'na', 'none', '<none>', 'нет', 'не задано']);
const NO_LEVEL_TEXT = new Set(['none', '<none>', 'нет', 'не задано', 'unconstrained', 'не присвоено']);

const LENGTH_CANONICAL = {
  m: 'm',
  meter: 'm',
  meters: 'm',
  metre: 'm',
  metres: 'm',
  м: 'm',
  метр: 'm',
  метра: 'm',
  метров: 'm',
  mm: 'mm',
  millimeter: 'mm',
  millimeters: 'mm',
  millimetre: 'mm',
  мм: 'mm',
  cm: 'cm',
  centimeter: 'cm',
  centimeters: 'cm',
  см: 'cm',
  ft: 'ft',
  foot: 'ft',
  feet: 'ft',
  фут: 'ft',
  фута: 'ft',
  футов: 'ft',
  in: 'in',
  inch: 'in',
  inches: 'in',
  дюйм: 'in',
  дюйма: 'in',
  дюймов: 'in',
};

const LENGTH_TO_M = {
  m: 1,
  meter: 1,
  meters: 1,
  metre: 1,
  metres: 1,
  м: 1,
  метр: 1,
  метра: 1,
  метров: 1,
  mm: 0.001,
  millimeter: 0.001,
  millimeters: 0.001,
  millimetre: 0.001,
  мм: 0.001,
  cm: 0.01,
  centimeter: 0.01,
  centimeters: 0.01,
  см: 0.01,
  ft: 0.3048,
  foot: 0.3048,
  feet: 0.3048,
  фут: 0.3048,
  фута: 0.3048,
  футов: 0.3048,
  in: 0.0254,
  inch: 0.0254,
  inches: 0.0254,
  дюйм: 0.0254,
  дюйма: 0.0254,
  дюймов: 0.0254,
};

const AREA_TO_M2 = {
  m2: 1,
  sqm: 1,
  'sq m': 1,
  'square meter': 1,
  'square meters': 1,
  'square metre': 1,
  'square metres': 1,
  м2: 1,
  'кв м': 1,
  'кв. м': 1,
  mm2: 1e-6,
  мм2: 1e-6,
  cm2: 0.0001,
  см2: 0.0001,
  ft2: 0.09290304,
  sf: 0.09290304,
  sqft: 0.09290304,
  'sq ft': 0.09290304,
  'square feet': 0.09290304,
  'square foot': 0.09290304,
  in2: 0.00064516,
};

const VOLUME_TO_M3 = {
  m3: 1,
  'cubic meter': 1,
  'cubic meters': 1,
  'cubic metre': 1,
  'cubic metres': 1,
  м3: 1,
  'куб м': 1,
  'куб. м': 1,
  mm3: 1e-9,
  мм3: 1e-9,
  cm3: 1e-6,
  см3: 1e-6,
  ft3: 0.028316846592,
  cf: 0.028316846592,
  cuft: 0.028316846592,
  'cu ft': 0.028316846592,
  'cubic feet': 0.028316846592,
  'cubic foot': 0.028316846592,
  in3: 0.000016387064,
};

const UNIT_SCALES = {
  length: LENGTH_TO_M,
  area: AREA_TO_M2,
  volume: VOLUME_TO_M3,
};

const FEET_TO_M = 0.3048;
const AEC_MODEL_DATA_ROLE = 'autodesk.aec.modeldata';

const roundTo = (value, digits) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const finiteNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const asText = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || EMPTY_TEXT.has(text.toLowerCase())) return null;
  return text;
};

const WRAPPED_VALUE_KEYS = new Set(['value', 'displayValue', 'unit', 'units', 'type', 'displayUnit']);

const isWrappedValue = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return false;
  if (!keys.every((key) => WRAPPED_VALUE_KEYS.has(key))) return false;
  return 'value' in value || 'displayValue' in value;
};

const unwrap = (value) => {
  if (!isWrappedValue(value)) return value;
  const unit = value.unit ?? value.units ?? value.displayUnit;
  const inner = value.displayValue ?? value.value;
  if (inner == null) return null;
  if (
    unit != null &&
    String(unit).trim() !== '' &&
    (typeof inner === 'string' || typeof inner === 'number')
  ) {
    return `${inner} ${unit}`;
  }
  return inner;
};

const propertyEntries = (properties) => {
  if (!properties || typeof properties !== 'object') return [];
  const entries = [];
  for (const [key, value] of Object.entries(properties)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && !isWrappedValue(value)) {
      for (const [childKey, childValue] of Object.entries(value)) {
        entries.push([childKey, unwrap(childValue)]);
      }
      continue;
    }
    entries.push([key, unwrap(value)]);
  }
  return entries;
};

const findProp = (properties, keys) => {
  const entries = propertyEntries(properties);
  for (const wanted of keys) {
    const needle = wanted.toLowerCase();
    for (const [key, value] of entries) {
      if (String(key).toLowerCase() !== needle) continue;
      const text = asText(value);
      if (text) return text;
    }
  }
  return null;
};

const categoryLabel = (properties) => findProp(properties, ['Category', 'Категория']) || '';

const matchesCategory = (category, names) => {
  if (!category) return false;
  if (names.has(category)) return true;
  for (const name of names) {
    if (category.startsWith(`${name} `) || category.startsWith(`${name}(`)) return true;
  }
  return false;
};

const isLevelObject = (object, category) => {
  const properties = object?.properties;
  if (matchesCategory(category, LEVEL_CATEGORIES)) return true;
  const categoryId = findProp(properties, CATEGORY_ID_KEYS);
  if (categoryId === LEVEL_CATEGORY_ID) return true;
  const family = findProp(properties, FAMILY_KEYS);
  if (!family) return false;
  const normalized = family.trim().toLowerCase();
  return normalized === 'level' || normalized === 'уровень';
};

const isMaterialObject = (category) => matchesCategory(category, MATERIAL_CATEGORIES);

/**
 * Revit categories live in the object tree (Model → Category → Family →
 * Instance), not in the flat property set. This maps every element's objectid
 * to the name of its category node.
 * @param {object | Array | null | undefined} tree getObjectTree data, the raw
 *   ObjectTree, or the objects array
 * @returns {Map<number, string>}
 */
const treeRoots = (tree) =>
  Array.isArray(tree?.data?.objects)
    ? tree.data.objects
    : Array.isArray(tree?.objects)
      ? tree.objects
      : Array.isArray(tree)
        ? tree
        : [];

/**
 * Total number of nodes carrying an objectid in an object tree. Used as a
 * view-richness signal: a Revit file can expose several 3D "master" views (one
 * per phase/design option), and the first one is often a near-empty existing
 * phase. The view with the most objects is the one that actually holds the
 * modeled geometry, matching what the viewer opens.
 * @param {object | Array | null | undefined} tree
 * @returns {number}
 */
export const countTreeObjects = (tree) => {
  let count = 0;
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.objectid === 'number') count += 1;
    const children = Array.isArray(node.objects) ? node.objects : [];
    for (const child of children) walk(child);
  };
  for (const root of treeRoots(tree)) walk(root);
  return count;
};

export const buildCategoryIndex = (tree) => {
  const roots = treeRoots(tree);
  const map = new Map();

  const assign = (node, category) => {
    if (!node || typeof node !== 'object') return;
    if (category && typeof node.objectid === 'number') map.set(node.objectid, category);
    const children = Array.isArray(node.objects) ? node.objects : [];
    for (const child of children) assign(child, category);
  };

  for (const root of roots) {
    const categories = Array.isArray(root?.objects) ? root.objects : [];
    for (const categoryNode of categories) {
      const name = typeof categoryNode?.name === 'string' ? categoryNode.name.trim() : '';
      assign(categoryNode, name);
    }
  }

  return map;
};

const displayName = (name) => {
  if (typeof name !== 'string') return '';
  return name.replace(/\s*\[\d+\]\s*$/, '').trim();
};

const LEVEL_NAME_PREFIX = /^(?:levels?|уровни|уровень)\s*[:：]\s*/i;

const cleanLevelName = (name) => {
  if (typeof name !== 'string') return '';
  return displayName(name).replace(LEVEL_NAME_PREFIX, '').trim();
};

const levelKey = (name) => cleanLevelName(name).toLowerCase().replace(/\s+/g, ' ');

const materialKey = (name) => name.trim().toLowerCase().replace(/\s+/g, ' ');

const normalizeUnit = (unit) =>
  unit
    .trim()
    .toLowerCase()
    .replace(/\^/g, '')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '');

const parseLocalizedNumber = (token) => {
  const compact = token.replace(/[\s\u00a0\u202f]/g, '');
  if (!compact) return null;
  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalIndex = Math.max(lastComma, lastDot);
    const intPart = compact.slice(0, decimalIndex).replace(/[.,]/g, '');
    const fracPart = compact.slice(decimalIndex + 1);
    if (!/^\d+$/.test(intPart) || !/^\d+$/.test(fracPart)) return null;
    return Number(`${intPart}.${fracPart}`);
  }

  const sep = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : null;
  if (!sep) return /^\d+$/.test(compact) ? Number(compact) : null;

  const parts = compact.split(sep);
  const grouped =
    parts.length > 2 &&
    parts.every(
      (part, index) =>
        /^\d+$/.test(part) && (index === 0 ? part.length >= 1 && part.length <= 3 : part.length === 3),
    );
  if (grouped) return Number(parts.join(''));
  if (parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
    return Number(`${parts[0]}.${parts[1]}`);
  }
  return null;
};

const parseFeetInchesMeters = (text) => {
  const inchesOnly = text.match(/^([+-])?\s*(\d+(?:\.\d+)?)\s*"$/);
  if (inchesOnly) {
    const sign = inchesOnly[1] === '-' ? -1 : 1;
    return sign * Number(inchesOnly[2]) * 0.0254;
  }

  const feet = text.match(/^([+-])?\s*(\d+(?:\.\d+)?)\s*'\s*(?:-\s*(\d+(?:\.\d+)?)\s*")?$/);
  if (!feet) return null;
  const sign = feet[1] === '-' ? -1 : 1;
  const inchPart = feet[3] ? Number(feet[3]) : 0;
  return sign * (Number(feet[2]) * 0.3048 + inchPart * 0.0254);
};

/**
 * @param {unknown} raw
 * @param {'length' | 'area' | 'volume'} kind
 * @param {string | null} [fallbackUnit] length unit spelled out elsewhere in the same model
 * @returns {number | null} meters in the requested dimension, or null when the unit is unknown
 */
const parseQuantity = (raw, kind, fallbackUnit = null) => {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return parseQuantity(String(raw), kind, fallbackUnit);
  }
  if (typeof raw !== 'string') return null;
  const text = raw
    .trim()
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^±\s*/, '');
  if (!text) return null;

  const feet = parseFeetInchesMeters(text);
  if (feet != null) return kind === 'length' ? feet : null;

  const match = text.match(/^([+-]?\d[\d\s.,]*)\s*([^\d\s.,+-].*)$/);
  if (!match) {
    if (kind === 'length' && fallbackUnit && /^[+-]?\d[\d\s.,]*$/.test(text)) {
      return parseQuantity(`${text} ${fallbackUnit}`, kind);
    }
    return null;
  }
  const magnitude = parseLocalizedNumber(match[1].replace(/^[+-]/, ''));
  if (magnitude == null) return null;
  const sign = match[1].trim().startsWith('-') ? -1 : 1;
  const scale = UNIT_SCALES[kind][normalizeUnit(match[2])];
  if (scale == null) return null;
  return sign * magnitude * scale;
};

const inferLengthUnit = (objects) => {
  const votes = new Map();
  const add = (text) => {
    if (typeof text !== 'string') return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (parseFeetInchesMeters(trimmed) != null) {
      votes.set('ft', (votes.get('ft') ?? 0) + 1);
      return;
    }
    const match = trimmed.match(/^([+-]?\d[\d\s.,]*)\s*([^\d\s.,+-].*)$/);
    if (!match) return;
    const unit = normalizeUnit(match[2]);
    if (Object.hasOwn(AREA_TO_M2, unit) || Object.hasOwn(VOLUME_TO_M3, unit)) return;
    const canonical = LENGTH_CANONICAL[unit];
    if (!canonical) return;
    votes.set(canonical, (votes.get(canonical) ?? 0) + 1);
  };

  for (const object of objects) {
    for (const [, value] of propertyEntries(object?.properties)) {
      if (typeof value === 'string') add(value);
    }
  }

  let best = null;
  let bestCount = 0;
  for (const [unit, count] of votes) {
    if (count > bestCount) {
      best = unit;
      bestCount = count;
    }
  }
  return best;
};

const meaningful = (volume, area, length) =>
  volume >= VOLUME_EPS || area >= AREA_EPS || length >= LENGTH_EPS;

const byElevationThenName = (left, right) => {
  if (left.elevationM == null && right.elevationM != null) return 1;
  if (right.elevationM == null && left.elevationM != null) return -1;
  if (left.elevationM != null && right.elevationM != null && left.elevationM !== right.elevationM) {
    return left.elevationM - right.elevationM;
  }
  return left.name.localeCompare(right.name);
};

export const translationState = (manifest) => {
  const status = typeof manifest?.status === 'string' ? manifest.status.toLowerCase() : '';
  return KNOWN_TRANSLATIONS.has(status) ? status : 'missing';
};

export const findAecModelDataUrn = (manifest) => {
  const stack = [...(manifest?.derivatives ?? [])];
  while (stack.length > 0) {
    const node = stack.pop();
    const role = typeof node?.role === 'string' ? node.role.toLowerCase() : '';
    if (role === AEC_MODEL_DATA_ROLE && typeof node.urn === 'string' && node.urn) {
      return node.urn;
    }
    if (Array.isArray(node?.children)) stack.push(...node.children);
  }
  return null;
};

/**
 * Levels from the Revit AECModelData derivative. Elevations are Revit internal
 * feet. Project elevation matches Level.ProjectElevation; the plain elevation
 * is the fallback.
 * @param {object | null | undefined} aec
 * @returns {Array<{ name: string, elevationM: number | null }>}
 */
export const levelsFromAecModel = (aec) => {
  const source = Array.isArray(aec?.levels) ? aec.levels : [];
  const levels = [];
  for (const level of source) {
    const name = typeof level?.name === 'string' ? level.name.trim() : '';
    if (!name) continue;
    const feet =
      finiteNumber(level?.extension?.projectElevation) ?? finiteNumber(level?.elevation);
    levels.push({
      name,
      elevationM: feet == null ? null : roundTo(feet * FEET_TO_M, 3),
    });
  }
  levels.sort(byElevationThenName);
  return levels;
};

export const pickModelViewGuid = (modelViews) => {
  const views = modelViews?.data?.metadata ?? [];
  const master = views.find((view) => view?.role === '3d' && view.isMasterView && view.guid);
  if (master) return master.guid;
  const view = views.find((item) => item?.role === '3d' && item.guid);
  return view?.guid ?? null;
};

/**
 * Every 3D view guid, master views first so the historical choice wins ties.
 * A Revit derivative can carry one 3D view per phase/design option; the caller
 * reads each and keeps the richest instead of trusting the first master view.
 * @returns {string[]}
 */
export const list3dViewGuids = (modelViews) => {
  const views = modelViews?.data?.metadata ?? [];
  const threeD = views.filter((view) => view?.role === '3d' && view.guid);
  const masters = threeD.filter((view) => view.isMasterView).map((view) => view.guid);
  const rest = threeD.filter((view) => !view.isMasterView).map((view) => view.guid);
  return [...masters, ...rest];
};

const readProject = (object, fileName, versionId) => {
  const properties = object?.properties;
  const project = {
    projectName: null,
    projectNumber: null,
    buildingName: null,
    clientName: null,
    address: null,
    status: null,
    author: null,
    organizationName: null,
    organizationDescription: null,
    issueDate: null,
    fileName: fileName || 'Untitled',
    projectPath: versionId ?? '',
  };

  if (properties) {
    for (const [field, keys] of PROJECT_FIELDS) {
      project[field] = findProp(properties, keys);
    }
  }

  project.projectName = project.projectName || fileName || 'Untitled';
  return project;
};

const levelReference = (properties) => {
  const value = findProp(properties, LEVEL_KEYS);
  if (!value || NO_LEVEL_TEXT.has(value.toLowerCase())) return null;
  return value;
};

/**
 * @param {Array<{ name?: string, properties?: object }>} objects
 * @param {{ fileName?: string, versionId?: string }} identity
 */
export const mapModelProperties = (objects, identity = {}) => {
  const list = Array.isArray(objects) ? objects : [];
  const fileName = identity.fileName || 'Untitled';
  const versionId = identity.versionId ?? '';

  let projectObject = null;
  const levels = [];
  const elevationByKey = new Map();
  const seenLevelKeys = new Set();
  const materialClassByName = new Map();
  const lengthUnit = inferLengthUnit(list);
  const categoryById = buildCategoryIndex(identity.objectTree);

  const catOf = (object) => categoryLabel(object?.properties) || categoryById.get(object?.objectid) || '';

  const rememberLevel = (display, elevationM, aliases) => {
    const canonical = cleanLevelName(display);
    if (!canonical) return;
    const canonicalKey = levelKey(canonical);
    if (!seenLevelKeys.has(canonicalKey)) {
      seenLevelKeys.add(canonicalKey);
      levels.push({ name: canonical, elevationM });
    }
    for (const alias of [canonical, ...aliases]) {
      const key = levelKey(alias);
      if (!key || elevationByKey.has(key)) continue;
      elevationByKey.set(key, { name: canonical, elevationM });
    }
  };

  for (const object of list) {
    const category = catOf(object).toLowerCase();
    const name = displayName(object?.name);
    if (PROJECT_CATEGORIES.has(category) || PROJECT_CATEGORIES.has(name.toLowerCase())) {
      projectObject ??= object;
    }

    if (isMaterialObject(category)) {
      const materialName = findProp(object.properties, LEVEL_NAME_KEYS) || name;
      const materialClass = findProp(object.properties, CATALOG_CLASS_KEYS);
      const key = materialName ? materialKey(materialName) : '';
      if (key && materialClass && !materialClassByName.has(key)) {
        materialClassByName.set(key, materialClass);
      }
      continue;
    }

    if (!isLevelObject(object, category)) continue;

    const elevation = parseQuantity(
      findProp(object.properties, ELEVATION_KEYS) ?? '',
      'length',
      lengthUnit,
    );
    const elevationM = elevation == null ? null : roundTo(elevation, 3);
    const paramName = findProp(object.properties, LEVEL_NAME_KEYS);
    rememberLevel(paramName || name, elevationM, [name, paramName].filter(Boolean));
  }

  const aecLevels = levelsFromAecModel(identity.aecModel);
  if (aecLevels.length > 0) {
    levels.length = 0;
    elevationByKey.clear();
    seenLevelKeys.clear();
    for (const level of aecLevels) {
      rememberLevel(level.name, level.elevationM, [level.name]);
    }
  }

  levels.sort(byElevationThenName);

  const buckets = new Map();
  const categoryCounts = new Map();
  const pieceCounts = new Map();
  let elementCount = 0;
  let pieceCount = 0;

  // Per-stage tally so an empty Materials table can be explained: how many
  // objects were dropped by category, how many carried no material/type name,
  // and how many were counted as count-only (had a name but no quantity). The
  // raw Volume/Area/Length strings of the first few count-only rows show
  // whether the derivative lacks quantities or whether a unit failed to parse.
  const diagnostics = {
    totalObjects: list.length,
    skippedByCategory: 0,
    noMaterialName: 0,
    countOnly: 0,
    included: 0,
    countOnlySamples: [],
  };
  const COUNT_ONLY_SAMPLE_LIMIT = 8;

  for (const object of list) {
    const categoryName = catOf(object);
    const category = categoryName.toLowerCase();
    if (
      SKIP_CATEGORIES.has(category) ||
      isLevelObject(object, category) ||
      isMaterialObject(category)
    ) {
      diagnostics.skippedByCategory += 1;
      continue;
    }

    const materialName =
      findProp(object?.properties, MATERIAL_KEYS) ||
      findProp(object?.properties, TYPE_NAME_KEYS);
    if (!materialName) {
      diagnostics.noMaterialName += 1;
      continue;
    }

    const rawVolume = findProp(object.properties, VOLUME_KEYS);
    const rawArea = findProp(object.properties, AREA_KEYS);
    const rawLength = findProp(object.properties, LENGTH_KEYS);
    const volume = parseQuantity(rawVolume ?? '', 'volume') ?? 0;
    const area = parseQuantity(rawArea ?? '', 'area') ?? 0;
    const length = parseQuantity(rawLength ?? '', 'length') ?? 0;
    const countedCategory = categoryName || NO_CATEGORY;
    // Doors, windows and similar loadable families are modeled but carry no
    // volume/area/length in the cloud derivative. They are real elements, so
    // they are counted by category instead of being dropped from the report.
    if (!meaningful(volume, area, length)) {
      pieceCounts.set(countedCategory, (pieceCounts.get(countedCategory) ?? 0) + 1);
      pieceCount += 1;
      diagnostics.countOnly += 1;
      if (diagnostics.countOnlySamples.length < COUNT_ONLY_SAMPLE_LIMIT) {
        diagnostics.countOnlySamples.push({
          category: countedCategory,
          material: materialName,
          rawVolume: rawVolume ?? null,
          rawArea: rawArea ?? null,
          rawLength: rawLength ?? null,
        });
      }
      continue;
    }
    diagnostics.included += 1;

    const referenced = levelReference(object.properties);
    const record = referenced ? elevationByKey.get(levelKey(referenced)) : null;
    const levelName = record?.name || referenced || NO_LEVEL;
    const elevationM = record ? record.elevationM : null;
    const key = `${levelName}\0${materialName}`;
    const materialClass =
      findProp(object.properties, ELEMENT_CLASS_KEYS) ||
      materialClassByName.get(materialKey(materialName)) ||
      null;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        levelName,
        elevationM,
        name: materialName,
        materialClass: materialClass ?? null,
        volume: 0,
        area: 0,
        length: 0,
      };
      buckets.set(key, bucket);
    } else if (!bucket.materialClass && materialClass) {
      bucket.materialClass = materialClass;
    }

    bucket.volume += volume;
    bucket.area += area;
    bucket.length += length;
    categoryCounts.set(countedCategory, (categoryCounts.get(countedCategory) ?? 0) + 1);
    elementCount += 1;
  }

  const byCount = (left, right) =>
    right.count - left.count || left.name.localeCompare(right.name);
  const categories = [...categoryCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort(byCount);
  const pieces = [...pieceCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort(byCount);

  const groups = new Map();
  for (const bucket of buckets.values()) {
    let group = groups.get(bucket.levelName);
    if (!group) {
      group = {
        name: bucket.levelName,
        elevationM: bucket.elevationM,
        materials: [],
      };
      groups.set(bucket.levelName, group);
    }
    group.materials.push({
      name: bucket.name,
      materialClass: bucket.materialClass,
      volumeM3: roundTo(bucket.volume, 3),
      areaM2: roundTo(bucket.area, 3),
      lengthM: roundTo(bucket.length, 2),
    });
  }

  const materialLevels = [...groups.values()].sort(byElevationThenName);
  for (const group of materialLevels) {
    group.materials.sort((left, right) => left.name.localeCompare(right.name));
  }

  return {
    project: readProject(projectObject, fileName, versionId),
    units: { length: 'm', elevation: 'm', volume: 'm3', area: 'm2' },
    elementCount,
    categories,
    pieces: { count: pieceCount, categories: pieces },
    levels,
    materials: { byCategory: false, levels: materialLevels },
    diagnostics,
  };
};
