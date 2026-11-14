import { Region } from '@aps_sdk/model-derivative';
import { env } from '../config/env.js';
import { createHttpError, sanitizeApsError } from '../utils/httpError.js';
import { derivativeClient } from './apsClients.js';
import { listHubs } from './apsData.js';
import { getItemViewInfo } from './apsFiles.js';
import {
  countTreeObjects,
  findAecModelDataUrn,
  list3dViewGuids,
  mapModelProperties,
  pickModelViewGuid,
  translationState,
} from './modelDetailsMap.js';

const PROPERTIES_TIMEOUT_MS = 45_000;
const POLL_MS = 2_000;

const KNOWN_REGIONS = new Set(Object.values(Region));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const derivativeRegion = (value) => {
  const key = String(value ?? '').trim().toUpperCase();
  return KNOWN_REGIONS.has(key) ? key : Region.Us;
};

const apsHttpStatus = (cause) => {
  if (typeof cause?.httpStatusCode === 'function') {
    const status = Number(cause.httpStatusCode());
    if (status) return status;
  }
  return cause?.axiosError?.response?.status ?? cause?.response?.status ?? null;
};

/**
 * BIM 360 stores the derivative in the hub's region. The env value is only a
 * fallback when the hub list cannot be read.
 */
const resolveRegion = async (hubId, accessToken) => {
  try {
    const hubs = await listHubs(accessToken);
    const hub = hubs.find((item) => item.id === hubId);
    if (hub?.region) return derivativeRegion(hub.region);
  } catch {
    // Fall through to the configured region.
  }
  return derivativeRegion(env.aps.region);
};

/**
 * Revit writes level elevations into AECModelData, not into the 3D view
 * properties. A missing file leaves level discovery on the property set.
 */
const readAecModel = async (urn, manifest, call) => {
  const derivativeUrn = findAecModelDataUrn(manifest);
  if (!derivativeUrn) return null;

  try {
    const download = await derivativeClient.getDerivativeUrl(derivativeUrn, urn, call);
    if (!download?.url) return null;
    const response = await fetch(download.url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

/**
 * Polls a Model Derivative fetch that may answer 202 (still preparing) before
 * it returns content. The first call omits forceget; retries set it so large
 * resources come through.
 */
const pollDerivative = async (fetchPage, timeoutMessage) => {
  const deadline = Date.now() + PROPERTIES_TIMEOUT_MS;
  let forceget;

  while (true) {
    let page;
    try {
      page = await fetchPage(forceget);
    } catch (cause) {
      throw sanitizeApsError(cause, 'Failed to read model properties.');
    }

    if (!page?.isProcessing) return page?.data ?? null;

    if (Date.now() >= deadline) {
      throw createHttpError(504, timeoutMessage);
    }

    forceget = 'true';
    await sleep(POLL_MS);
  }
};

const readProperties = async (urn, modelGuid, call) => {
  const data = await pollDerivative(
    (forceget) => derivativeClient.getAllProperties(urn, modelGuid, { ...call, forceget }),
    'Model properties are still being prepared. Refresh the page in a moment.',
  );
  return data?.collection ?? [];
};

/**
 * Revit categories are not in the flat property set; they come from the object
 * tree (Model → Category → Family → Instance). A failure leaves category
 * discovery to whatever the property set carries.
 */
const readObjectTree = async (urn, modelGuid, call) => {
  try {
    return await pollDerivative(
      (forceget) => derivativeClient.getObjectTree(urn, modelGuid, { ...call, forceget }),
      'Model properties are still being prepared. Refresh the page in a moment.',
    );
  } catch {
    return null;
  }
};

/**
 * Reads the raw Model Derivative data for the tip version of a Revit item from
 * the BIM 360 derivative that already exists. Does not start a new translation.
 * On a non-ready translation it returns the state and no data so callers can
 * surface a notice.
 * @returns {Promise<{ viewInfo: object, region: string, translation: string, objects: Array, aecModel: object | null, objectTree: object | null }>}
 */
const loadItemModelData = async (hubId, projectId, itemId, accessToken) => {
  const viewInfo = await getItemViewInfo(projectId, itemId, accessToken);
  const region = await resolveRegion(hubId, accessToken);
  const call = { accessToken, region };
  const base = (translation, extra = {}) => ({
    viewInfo,
    region,
    translation,
    objects: [],
    aecModel: null,
    objectTree: null,
    ...extra,
  });

  let manifest;
  try {
    manifest = await derivativeClient.getManifest(viewInfo.urn, call);
  } catch (cause) {
    if (apsHttpStatus(cause) === 404) return base('missing');
    throw sanitizeApsError(cause, 'Failed to read the model manifest.');
  }

  const translation = translationState(manifest);
  if (translation !== 'success') return base(translation);

  let views;
  try {
    views = await derivativeClient.getModelViews(viewInfo.urn, call);
  } catch (cause) {
    throw sanitizeApsError(cause, 'Failed to read the model views.');
  }

  const { modelGuid, objectTree } = await pickRichest3dView(viewInfo, views, call);
  if (!modelGuid) return base('no-3d');

  const [objects, aecModel] = await Promise.all([
    readProperties(viewInfo.urn, modelGuid, call),
    readAecModel(viewInfo.urn, manifest, call),
  ]);
  console.log(
    `[model-details] ${viewInfo.fileName}: rawObjects=${objects.length} ` +
      `aecModel=${aecModel ? 'yes' : 'no'} objectTree=${objectTree ? 'yes' : 'no'}`,
  );
  return base('success', { objects, aecModel, objectTree });
};

/**
 * Chooses which 3D view to read. A Revit derivative can expose several 3D
 * "master" views (one per phase or design option); the first one is often a
 * near-empty existing-conditions view. Each 3D view's object tree is read and
 * the richest (most objects) wins, so the report matches the geometry the
 * viewer shows instead of an empty phase. The historical first-master pick is
 * the fallback when no tree reveals any objects.
 * @returns {Promise<{ modelGuid: string | null, objectTree: object | null }>}
 */
const pickRichest3dView = async (viewInfo, views, call) => {
  const guids = list3dViewGuids(views);
  if (guids.length === 0) return { modelGuid: null, objectTree: null };

  const probes = await Promise.all(
    guids.map(async (guid) => {
      const tree = await readObjectTree(viewInfo.urn, guid, call);
      return { guid, tree, count: countTreeObjects(tree) };
    }),
  );

  let best = probes[0];
  for (const probe of probes) {
    if (probe.count > best.count) best = probe;
  }
  // Every tree read came back empty (counts are 0): keep the historical pick.
  const chosen = best.count > 0 ? best : null;
  const fallbackGuid = pickModelViewGuid(views);
  const modelGuid = chosen?.guid ?? fallbackGuid;
  const objectTree =
    chosen?.tree ?? probes.find((probe) => probe.guid === modelGuid)?.tree ?? null;

  logViewSelection(viewInfo.fileName, views, modelGuid, probes);
  return { modelGuid, objectTree };
};

/**
 * Logs every 3D view the derivative offers, each view's object count, and
 * which one was read, so a thin property read can be traced to the wrong
 * viewable (e.g. an empty phase that only holds a linked DWG).
 */
const logViewSelection = (fileName, views, modelGuid, probes) => {
  const metadata = views?.data?.metadata ?? [];
  const countByGuid = new Map(probes.map((probe) => [probe.guid, probe.count]));
  const summary = metadata.map((view) => ({
    name: view?.name,
    role: view?.role,
    isMasterView: Boolean(view?.isMasterView),
    guid: view?.guid,
    objects: countByGuid.has(view?.guid) ? countByGuid.get(view?.guid) : null,
    picked: view?.guid === modelGuid,
  }));
  console.log(
    `[model-details] ${fileName}: views=${metadata.length} picked=${modelGuid}`,
    JSON.stringify(summary),
  );
};

/**
 * Project identity, levels, and material quantities for the tip version of a
 * Revit item, read from the BIM 360 derivative that already exists.
 * Does not start a new translation.
 * @returns {Promise<{ fileName: string, versionId: string, region: string, translation: string, report: object | null }>}
 */
export const getItemModelDetails = async (hubId, projectId, itemId, accessToken) => {
  const { viewInfo, region, translation, objects, aecModel, objectTree } =
    await loadItemModelData(hubId, projectId, itemId, accessToken);
  const base = (report) => ({
    fileName: viewInfo.fileName,
    versionId: viewInfo.versionId,
    region,
    translation,
    report,
  });

  if (translation !== 'success') return base(null);

  const report = mapModelProperties(objects, {
    fileName: viewInfo.fileName,
    versionId: viewInfo.versionId,
    aecModel,
    objectTree,
  });

  logReportDiagnostics(viewInfo.fileName, report);

  return base(report);
};

/**
 * Explains why the Materials table may be empty: how the derivative's objects
 * split across the filter stages, and the raw Volume/Area/Length strings of a
 * few count-only rows (no quantity vs. an unparsed unit).
 */
const logReportDiagnostics = (fileName, report) => {
  const d = report?.diagnostics;
  if (!d) return;
  const materialRows = (report.materials?.levels ?? []).reduce(
    (sum, level) => sum + (level.materials?.length ?? 0),
    0,
  );
  console.log(
    `[model-details] ${fileName}: objects=${d.totalObjects} skipped=${d.skippedByCategory} ` +
      `noName=${d.noMaterialName} countOnly=${d.countOnly} inTakeoff=${d.included} ` +
      `materialRows=${materialRows}`,
  );
  if (materialRows === 0 && d.countOnlySamples.length > 0) {
    console.log(
      `[model-details] ${fileName}: count-only samples`,
      JSON.stringify(d.countOnlySamples),
    );
  }
};
