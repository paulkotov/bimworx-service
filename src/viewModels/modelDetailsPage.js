/**
 * Display model for the details page. Formatting happens here so the template
 * only prints ready strings.
 */

const EMPTY = '—';

const NOTICES = {
  pending: 'BIM 360 is still preparing this model. Refresh this page in a moment.',
  inprogress: 'BIM 360 is still preparing this model. Refresh this page in a moment.',
  failed: 'BIM 360 could not prepare a viewable for this model.',
  timeout: 'BIM 360 could not prepare a viewable for this model.',
  'no-3d': 'This model has no 3D view to read.',
};

const IDENTITY_FIELDS = [
  ['projectName', 'Project name', false],
  ['projectNumber', 'Project number', false],
  ['buildingName', 'Building', false],
  ['clientName', 'Client', false],
  ['address', 'Address', true],
  ['status', 'Status', false],
  ['author', 'Author', false],
  ['organizationName', 'Organization', false],
  ['organizationDescription', 'Organization description', true],
  ['issueDate', 'Issue date', false],
  ['fileName', 'File', false],
  ['projectPath', 'BIM 360 version', true],
];

const formatText = (value) => {
  if (value == null || value === '') return EMPTY;
  return String(value);
};

const formatQuantity = (value, digits) => {
  if (value == null || value === '') return EMPTY;
  const number = Number(value);
  if (!Number.isFinite(number)) return EMPTY;
  return number.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
};

const noticeFor = (translation, region) => {
  if (translation === 'missing') {
    return region
      ? `BIM 360 has no viewable for this model in region ${region}.`
      : 'BIM 360 has no viewable for this model.';
  }
  return NOTICES[translation] ?? 'BIM 360 has no viewable for this model.';
};

const formatReport = (report, { versionLabel = 'BIM 360 version' } = {}) => ({
  identity: IDENTITY_FIELDS.map(([key, label, wide]) => ({
    label: key === 'projectPath' ? versionLabel : label,
    value: formatText(report.project?.[key]),
    className: wide ? 'is-wide' : '',
  })).filter((row) => row.label !== versionLabel || row.value !== EMPTY),
  elementCount: formatQuantity(report.elementCount, 0),
  categories: (report.categories ?? []).map((category) => ({
    name: formatText(category.name),
    count: formatQuantity(category.count, 0),
  })),
  hasCategories: (report.categories ?? []).length > 0,
  pieceCount: formatQuantity(report.pieces?.count ?? 0, 0),
  pieces: (report.pieces?.categories ?? []).map((piece) => ({
    name: formatText(piece.name),
    count: formatQuantity(piece.count, 0),
  })),
  hasPieces: (report.pieces?.categories ?? []).length > 0,
  pieceItems: (report.pieces?.items ?? []).map((item) => ({
    level: formatText(item.level),
    category: formatText(item.category),
    family: formatText(item.family),
    type: formatText(item.type),
    count: formatQuantity(item.count, 0),
  })),
  hasPieceItems: (report.pieces?.items ?? []).length > 0,
  levels: (report.levels ?? []).map((level) => ({
    name: formatText(level.name),
    elevation: formatQuantity(level.elevationM, 3),
  })),
  materials: (report.materials?.levels ?? []).flatMap((level) =>
    (level.materials ?? []).map((material) => ({
      level: formatText(level.name),
      elevation: formatQuantity(level.elevationM, 3),
      name: formatText(material.name),
      materialClass: formatText(material.materialClass),
      volume: formatQuantity(material.volumeM3, 3),
      area: formatQuantity(material.areaM2, 3),
      length: formatQuantity(material.lengthM, 2),
    })),
  ),
  hasLevels: (report.levels ?? []).length > 0,
  hasMaterials: (report.materials?.levels ?? []).some((level) => level.materials?.length),
});

/**
 * @param {{ hubId: string, projectId: string, itemId: string, details: object | null, error: string | null }} input
 */
export const toModelDetailsPage = ({ hubId, projectId, itemId, details, error }) => {
  const projectHref =
    `/hubs/${encodeURIComponent(hubId)}` +
    `/projects/${encodeURIComponent(projectId)}`;
  const itemHref = `${projectHref}/items/${encodeURIComponent(itemId)}`;
  const fileName = details?.fileName || 'Details';
  const translation = details?.translation ?? null;
  const preparing = translation === 'pending' || translation === 'inprogress';
  const notice =
    !error && translation && translation !== 'success'
      ? noticeFor(translation, details?.region)
      : null;
  const report = !error && !notice && details?.report ? formatReport(details.report) : null;

  return {
    title: details?.fileName
      ? `BimWorx · ${details.fileName} · Details`
      : 'BimWorx · Details',
    fileName,
    projectHref,
    viewHref: `${itemHref}/view`,
    detailsHref: `${itemHref}/details`,
    endpoint: `/api${itemHref}/details`,
    crumbs: [
      { href: '/hubs', label: 'Hubs' },
      { href: projectHref, label: 'Project' },
    ],
    subtitle: 'Model details from BIM 360',
    loadingHint: 'Reading project information and material quantities from BIM 360.',
    actions: [
      { href: `${itemHref}/view`, label: 'View model' },
      { href: projectHref, label: 'Back to project' },
    ],
    loading: false,
    error,
    notice,
    showRefresh: Boolean(notice && preparing),
    showReport: Boolean(report),
    showEmpty: !error && !notice && !report,
    report,
  };
};

/** Page shell. The browser fills the report after the details request returns. */
export const toModelDetailsShell = ({ hubId, projectId, itemId }) => ({
  ...toModelDetailsPage({ hubId, projectId, itemId, details: null, error: null }),
  title: 'BimWorx · Details',
  fileName: 'Details',
  loading: true,
  showEmpty: false,
});

const TRANSLATION_NOTICES = {
  pending: 'Translation is still running. Refresh this page in a moment.',
  inprogress: 'Translation is still running. Refresh this page in a moment.',
  failed: 'Translation failed for this model.',
  timeout: 'Translation timed out for this model.',
  'no-3d': 'This model has no 3D view to read.',
  missing: 'This translation has no viewable yet.',
};

const safeRootName = (value) => {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || !/\.rvt$/i.test(name) || /[\\/]/.test(name)) return 'Composite model';
  return name;
};

const translationHref = (path, urn, rootFilename) => {
  const params = new URLSearchParams();
  if (urn) params.set('urn', urn);
  if (rootFilename) params.set('root', rootFilename);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

/**
 * Details page for a composite ZIP translation. Same report shape as a hub
 * item, with navigation that stays on the translate flow.
 */
export const toTranslationDetailsPage = ({ urn, rootFilename, details, error }) => {
  const fileName = details?.fileName || safeRootName(rootFilename);
  const translation = details?.translation ?? null;
  const preparing = translation === 'pending' || translation === 'inprogress';
  const notice =
    !error && translation && translation !== 'success'
      ? (TRANSLATION_NOTICES[translation] ?? 'This translation has no viewable yet.')
      : null;
  const report =
    !error && !notice && details?.report
      ? formatReport(details.report, { versionLabel: 'Source file' })
      : null;
  const detailsHref = translationHref('/translate/reports', urn, rootFilename);
  const viewHref = translationHref('/translate/reports/view', urn, rootFilename);

  return {
    title: `BimWorx · ${fileName} · Details`,
    fileName,
    projectHref: '/translate',
    viewHref,
    detailsHref,
    endpoint: translationHref('/api/translate/reports', urn, rootFilename),
    crumbs: [{ href: '/translate', label: 'Translate' }],
    subtitle: 'Translated composite model',
    loadingHint: 'Reading project information and material quantities.',
    actions: [
      { href: viewHref, label: 'View model' },
      { href: '/translate', label: 'Back' },
    ],
    loading: false,
    error,
    notice,
    showRefresh: Boolean(notice && preparing),
    showReport: Boolean(report),
    showEmpty: !error && !notice && !report,
    report,
  };
};

/** Page shell. The browser fills the report after the details request returns. */
export const toTranslationDetailsShell = ({ urn, rootFilename }) => {
  const fileName = safeRootName(rootFilename);
  return {
    ...toTranslationDetailsPage({ urn, rootFilename, details: null, error: null }),
    title: `BimWorx · ${fileName} · Details`,
    fileName,
    loading: true,
    showEmpty: false,
  };
};
