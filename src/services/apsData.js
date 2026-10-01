import { dataClient } from './apsClients.js';
import { sanitizeApsError } from '../utils/httpError.js';
import {
  mapHub,
  mapProject,
  mapProjectDetails,
  mapFolder,
  mapContentEntry,
} from './apsMappers.js';

/**
 * Read-only APS Data Management access + view aggregation.
 * File download/upload lives in apsFiles.js; DTO mapping lives in apsMappers.js.
 */

/**
 * @returns {Promise<{ hubs: Array<{id,name,region}>, warnings: Array<{code,title,detail}> }>}
 */
export const listHubsWithMeta = async (accessToken) => {
  try {
    const resp = await dataClient.getHubs({ accessToken });
    const hubs = (resp.data ?? []).map(mapHub);
    const warnings = (resp.meta?.warnings ?? []).map((w) => ({
      code: w.ErrorCode ?? w.errorCode ?? null,
      title: w.Title ?? w.title ?? null,
      detail: w.Detail ?? w.detail ?? null,
    }));
    return { hubs, warnings };
  } catch (cause) {
    throw sanitizeApsError(cause, 'Failed to list Autodesk hubs.');
  }
};

export const listHubs = async (accessToken) => {
  const { hubs } = await listHubsWithMeta(accessToken);
  return hubs;
};

export const listProjects = async (hubId, accessToken) => {
  try {
    const resp = await dataClient.getHubProjects(hubId, { accessToken });
    return (resp.data ?? []).map(mapProject);
  } catch (cause) {
    throw sanitizeApsError(cause, 'Failed to list Autodesk projects.');
  }
};

export const getProjectDetails = async (hubId, projectId, accessToken) => {
  try {
    const resp = await dataClient.getProject(hubId, projectId, { accessToken });
    return mapProjectDetails(resp.data ?? {});
  } catch (cause) {
    throw sanitizeApsError(cause, 'Failed to load project details.');
  }
};

export const listTopFolders = async (hubId, projectId, accessToken) => {
  try {
    const resp = await dataClient.getProjectTopFolders(hubId, projectId, {
      accessToken,
    });
    return (resp.data ?? []).map(mapFolder);
  } catch (cause) {
    throw sanitizeApsError(cause, 'Failed to list project folders.');
  }
};

export const listFolderContents = async (projectId, folderId, accessToken) => {
  try {
    const resp = await dataClient.getFolderContents(projectId, folderId, {
      accessToken,
    });
    return (resp.data ?? []).map(mapContentEntry);
  } catch (cause) {
    throw sanitizeApsError(cause, 'Failed to list folder contents.');
  }
};

export const getFolderDetails = async (projectId, folderId, accessToken) => {
  try {
    const resp = await dataClient.getFolder(projectId, folderId, {
      accessToken,
    });
    return mapFolder(resp.data ?? {});
  } catch (cause) {
    throw sanitizeApsError(cause, 'Failed to load folder.');
  }
};

/** Immediate parent folder, or null when at a top folder / not accessible. */
export const getFolderParentInfo = async (projectId, folderId, accessToken) => {
  try {
    const resp = await dataClient.getFolderParent(projectId, folderId, {
      accessToken,
    });
    if (!resp?.data) return null;
    return {
      id: resp.data.id,
      name:
        resp.data.attributes?.displayName ??
        resp.data.attributes?.name ??
        resp.data.id,
    };
  } catch {
    return null;
  }
};

/**
 * Hubs with their projects resolved. Per-hub project failures are captured on
 * the hub (projectsError) instead of failing the whole list.
 * @returns {Promise<{ hubs: Array<object>, warnings: Array<object> }>}
 */
export const getHubsWithProjects = async (accessToken) => {
  const { hubs, warnings } = await listHubsWithMeta(accessToken);

  const withProjects = await Promise.all(
    hubs.map(async (hub) => {
      try {
        const projects = await listProjects(hub.id, accessToken);
        return { ...hub, projects };
      } catch {
        return { ...hub, projects: [], projectsError: true };
      }
    }),
  );

  return { hubs: withProjects, warnings };
};

/**
 * Everything needed to render a single folder: its metadata, immediate
 * parent (for the "up" link), and its contents.
 * @returns {Promise<{ folder: object, parent: object|null, contents: Array<object> }>}
 */
export const getFolderView = async (projectId, folderId, accessToken) => {
  const [folder, contents, parent] = await Promise.all([
    getFolderDetails(projectId, folderId, accessToken),
    listFolderContents(projectId, folderId, accessToken),
    getFolderParentInfo(projectId, folderId, accessToken),
  ]);
  return { folder, contents, parent };
};

/**
 * Aggregates everything we can surface for a single project: metadata,
 * its top-level folders, and the contents (files, documents, subfolders)
 * of each top folder.
 * @returns {Promise<{ project: object, folders: Array<object> }>}
 */
export const getProjectOverview = async (hubId, projectId, accessToken) => {
  const [project, topFolders] = await Promise.all([
    getProjectDetails(hubId, projectId, accessToken),
    listTopFolders(hubId, projectId, accessToken),
  ]);

  const folders = await Promise.all(
    topFolders.map(async (folder) => {
      try {
        const contents = await listFolderContents(
          projectId,
          folder.id,
          accessToken,
        );
        return { ...folder, contents };
      } catch (err) {
        return {
          ...folder,
          contents: [],
          contentsError: err.publicMessage ?? 'Could not load folder contents.',
        };
      }
    }),
  );

  return { project, folders };
};
